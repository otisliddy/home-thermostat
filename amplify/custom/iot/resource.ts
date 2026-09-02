import { CfnPolicy, CfnThing, CfnTopicRule } from 'aws-cdk-lib/aws-iot';
import { Arn, Stack } from 'aws-cdk-lib';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import type { Backend } from '../../backend';

const branchName = process.env.AWS_BRANCH ?? 'sandbox';

/*
 * Branch-suffixed copies of the hand-made Gen 1 things, so nothing here touches the ones the
 * heating runs on. Certificates are absent because CloudFormation cannot return a private key;
 * they are minted at cutover. See "IoT cutover" in the README.
 */
const RELAY_DEVICES = ['ht-main', 'ht-immersion'];
const SENSOR_DEVICES = ['ht-dhw-temp'];

export function thingNameFor(device: string) {
  return `${device}-${branchName}`;
}

export function defineIotResources(backend: Backend, temperatureTable: Table) {
  const stack = backend.createStack('iot');
  const { account, region } = Stack.of(stack);

  const things = [...RELAY_DEVICES, ...SENSOR_DEVICES].map(
    (device) =>
      new CfnThing(stack, `thing${device}`, {
        thingName: thingNameFor(device)
      })
  );

  const iotArn = (resource: string, resourceName: string) =>
    Arn.format({ service: 'iot', region, account, resource, resourceName }, stack);

  /*
   * Scoped by the thing name on the connection rather than by listing every device and topic:
   * enumerating them overflowed IoT's 2048-byte policy limit, and this way a certificate can only
   * reach the shadow of the thing it is attached to.
   */
  const CONNECTED_THING = '${iot:Connection.Thing.ThingName}';
  const ownShadow = `$aws/things/${CONNECTED_THING}/shadow/name/*`;

  const devicePolicy = new CfnPolicy(stack, 'devicePolicy', {
    policyName: `ht-device-policy-${branchName}`,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 'iot:Connect',
          Resource: iotArn('client', CONNECTED_THING)
        },
        {
          Effect: 'Allow',
          Action: ['iot:Publish', 'iot:Receive'],
          Resource: iotArn('topic', ownShadow)
        },
        {
          Effect: 'Allow',
          Action: 'iot:Subscribe',
          Resource: iotArn('topicfilter', ownShadow)
        }
      ]
    }
  });

  const ruleRole = new Role(stack, 'temperatureRuleRole', {
    assumedBy: new ServicePrincipal('iot.amazonaws.com')
  });
  ruleRole.addToPolicy(
    new PolicyStatement({
      actions: ['dynamodb:PutItem'],
      resources: [temperatureTable.tableArn]
    })
  );

  const dhwThingName = thingNameFor('ht-dhw-temp');
  const temperatureRule = new CfnTopicRule(stack, 'temperatureToDynamoDb', {
    ruleName: `dhw_temp_to_dynamodb_${branchName.replace(/-/g, '_')}`,
    topicRulePayload: {
      description: 'Update DynamoDB with the DHW temperature',
      awsIotSqlVersion: '2016-03-23',
      ruleDisabled: false,
      sql: [
        `SELECT '${dhwThingName}' AS device,`,
        'current.state.reported.temperature AS temperature,',
        'timestamp() AS timestamp,',
        'timestamp()/1000 + 604800 AS expireAt',
        `FROM '$aws/things/${dhwThingName}/shadow/name/${dhwThingName}_shadow/update/documents'`
      ].join(' '),
      actions: [
        {
          dynamoDBv2: {
            roleArn: ruleRole.roleArn,
            putItem: { tableName: temperatureTable.tableName }
          }
        }
      ]
    }
  });

  return { things, devicePolicy, temperatureRule };
}
