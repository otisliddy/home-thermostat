/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_ARN
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_STREAMARN
	STORAGE_HOMETHERMOSTATTEMPERATURE_ARN
	STORAGE_HOMETHERMOSTATTEMPERATURE_NAME
	STORAGE_HOMETHERMOSTATTEMPERATURE_STREAMARN
Amplify Params - DO NOT EDIT */

const { SFNClient, SendTaskSuccessCommand } = require('@aws-sdk/client-sfn');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { QueryCommand } = require('@aws-sdk/client-dynamodb');

const sfnClient = new SFNClient({ region: process.env.REGION });
const dynamodbClient = new DynamoDBClient({ region: process.env.REGION });
const scheduledActivityTableName = process.env.STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME;

/**
 * Lambda function triggered by DynamoDB Stream on homethermostat-temperature table.
 * When a temperature reading comes in, checks if any active scheduled activities
 * are waiting for a temperature target to be reached.
 */
exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    if (!["INSERT", "MODIFY"].includes(record.eventName)) {
      console.log(`Skipping event type: ${record.eventName}`);
      continue;
    }

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) continue;

    const device = newImage.device?.S;
    const temperature = parseFloat(newImage.temperature?.N);
    const timestamp = parseInt(newImage.timestamp?.N, 10);

    if (isNaN(temperature) || !device) {
      console.log('Invalid temperature or device, skipping');
      continue;
    }

    console.log(
        `Processing temperature record for ${device}: temperature=${temperature}°C, timestamp=${timestamp}`
    );

    // Query scheduled-activity table for active temperature-based tasks
    // Note: device here is the temperature sensor (e.g., ht-dhw-temp)
    // We need to find tasks for all heating devices that might be controlling this temperature
    const activeTasks = await getAllActiveTemperatureTasks();

    if (!activeTasks || activeTasks.length === 0) {
      console.log(`No active temperature tasks found`);
      continue;
    }

    console.log(`Found ${activeTasks.length} active temperature task(s)`);

    // Check each active task to see if this temperature reading satisfies it
    for (const activeTask of activeTasks) {
      if (temperature >= activeTask.dhwTargetTemperature) {
        console.log(`Target temperature reached for ${activeTask.device} (${temperature}°C >= ${activeTask.dhwTargetTemperature}°C). Sending task success.`);

        try {
          const command = new SendTaskSuccessCommand({
            taskToken: activeTask.taskToken,
            output: JSON.stringify({
              temperatureSensor: device,
              heatingDevice: activeTask.device,
              temperature,
              timestamp,
              dhwTargetTemperature: activeTask.dhwTargetTemperature,
              reason: "target_temperature_reached",
            }),
          });
          await sfnClient.send(command);
          console.log(`Successfully sent task success for device: ${activeTask.device}`);
        } catch (err) {
          console.error("Error sending task success:", err);
        }
      } else {
        console.log(`Temperature ${temperature}°C has not reached target ${activeTask.dhwTargetTemperature}°C for device ${activeTask.device}`);
      }
    }
  }

  return { status: "done" };
};

/**
 * Get all active temperature tasks from the scheduled-activity table.
 * Since we need to check across all heating devices (ht-main, ht-immersion, etc.),
 * we query each known device and filter in-memory for:
 * - since value within last 24 hours
 * - until is null
 * - taskToken is not null
 * - dhwTargetTemperature is not null
 */
async function getAllActiveTemperatureTasks() {
  const twentyFourHoursAgo = Date.now() / 1000 - (24 * 60 * 60 * 1000);
  const devices = ['ht-main', 'ht-immersion'];
  const activeTasks = [];

  for (const device of devices) {
    const params = {
      TableName: scheduledActivityTableName,
      KeyConditionExpression: 'device = :device AND since > :twentyFourHoursAgo',
      ExpressionAttributeValues: {
        ':device': { S: device },
        ':twentyFourHoursAgo': { N: twentyFourHoursAgo.toString() }
      }
    };

    try {
      const command = new QueryCommand(params);
      const data = await dynamodbClient.send(command);

      if (data.Items && data.Items.length > 0) {
        // Filter in-memory for active temperature tasks
        const deviceActiveTasks = data.Items.filter(item => {
          const hasNoUntil = !item.until;
          const hasTaskToken = item.taskToken && item.taskToken.S;
          const hasDhwTarget = item.dhwTargetTemperature && item.dhwTargetTemperature.N;
          const withinTimeRange = parseInt(item.since?.N) > twentyFourHoursAgo;

          return hasNoUntil && hasTaskToken && hasDhwTarget && withinTimeRange;
        }).map(item => ({
          device: item.device?.S,
          since: parseInt(item.since?.N),
          taskToken: item.taskToken?.S,
          dhwTargetTemperature: parseFloat(item.dhwTargetTemperature?.N)
        }));

        activeTasks.push(...deviceActiveTasks);
      }
    } catch (err) {
      console.error(`Error querying scheduled activity table for device ${device}:`, err);
      // Continue with other devices even if one fails
    }
  }

  return activeTasks;
}
