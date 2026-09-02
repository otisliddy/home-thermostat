import { readFileSync } from 'node:fs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, PutItemCommand, GetItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { IoTDataPlaneClient, GetThingShadowCommand } from '@aws-sdk/client-iot-data-plane';
import { SFNClient, StopExecutionCommand, DescribeExecutionCommand } from '@aws-sdk/client-sfn';

const REGION = 'eu-west-1';
const IOT_ENDPOINT = 'https://a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com';

export const outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8')).custom;

// These tests flip relays, so refuse to run against the things the real boiler is connected to.
export function assertNotLiveHardware() {
  const live = ['ht-main', 'ht-immersion', 'ht-dhw-temp'];
  const addressing = [outputs.oilThingName, outputs.immersionThingName, outputs.dhwTempThingName];

  const clash = addressing.find((thing) => live.includes(thing));
  if (clash) {
    throw new Error(
      `Refusing to run: this stack addresses the live thing '${clash}'. Point it at a sandbox.`
    );
  }
}

export const lambda = new LambdaClient({ region: REGION });
export const dynamo = new DynamoDBClient({ region: REGION });
export const iot = new IoTDataPlaneClient({ region: REGION, endpoint: IOT_ENDPOINT });
export const sfn = new SFNClient({ region: REGION });

export async function invokeLambda(functionArn, payload) {
  const response = await lambda.send(
    new InvokeCommand({ FunctionName: functionArn, Payload: JSON.stringify(payload) })
  );
  const body = response.Payload ? new TextDecoder().decode(response.Payload) : '';

  if (response.FunctionError) {
    throw new Error(`${functionArn} failed: ${body}`);
  }
  return body ? JSON.parse(body) : null;
}

export async function desiredShadowState(thingName) {
  const response = await iot.send(
    new GetThingShadowCommand({ thingName, shadowName: `${thingName}_shadow` })
  );
  const document = JSON.parse(new TextDecoder().decode(response.payload));
  return document.state?.desired ?? {};
}

export async function latestStatus(tableName, device, since) {
  const response = await dynamo.send(
    new GetItemCommand({
      TableName: tableName,
      Key: { device: { S: device }, since: { N: String(since) } }
    })
  );
  return response.Item ?? null;
}

export async function putTemperature(device, temperature) {
  const now = Date.now();
  await dynamo.send(
    new PutItemCommand({
      TableName: outputs.temperatureTableName,
      Item: {
        device: { S: device },
        timestamp: { N: String(now) },
        temperature: { N: String(temperature) },
        expireAt: { N: String(Math.floor(now / 1000) + 3600) }
      }
    })
  );
  return now;
}

export async function deleteItem(tableName, device, since) {
  await dynamo.send(
    new DeleteItemCommand({
      TableName: tableName,
      Key: { device: { S: device }, since: { N: String(since) } }
    })
  );
}

export async function stopExecutionQuietly(executionArn) {
  if (!executionArn) return;
  try {
    const { status } = await sfn.send(new DescribeExecutionCommand({ executionArn }));
    if (status === 'RUNNING') {
      await sfn.send(new StopExecutionCommand({ executionArn }));
    }
  } catch {
    // A finished or already-gone execution needs no cleanup.
  }
}

// The pipeline is asynchronous end to end, so assertions poll rather than wait a fixed time.
export async function eventually(check, { timeoutMs = 60000, intervalMs = 1500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      return await check();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw lastError ?? new Error('Timed out with no result');
}
