import { CfnStateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import type { Backend } from '../../backend';

const branchName = process.env.AWS_BRANCH ?? 'sandbox';

/*
 * The two Step Functions state machines. `amplify gen2-migration` reports the Gen 1
 * customCloudformation category as an unknown resource type and skips it in both generate and
 * refactor, so these are ported by hand. The definitions below are the deployed Gen 1
 * definitions verbatim, with the Lambda ARNs and the table name swapped for CDK references.
 *
 * They are named per branch, because the Gen 1 state machines keep the unsuffixed names while
 * they continue to run.
 */
export function defineStateMachines(backend: Backend, scheduledActivityTable: Table) {
  const stack = backend.createStack('stateMachines');

  const changeStateArn = backend.homethermostatChangeState.resources.lambda.functionArn;
  const startScheduleArn = backend.homethermostatStartScheduleStateChange.resources.lambda.functionArn;
  const storeTaskTokenArn = backend.homethermostatStoreTaskToken.resources.lambda.functionArn;
  const scheduledActivityTableName = scheduledActivityTable.tableName;

  const role = new Role(stack, 'stateMachineRole', {
    assumedBy: new ServicePrincipal('states.amazonaws.com'),
  });
  role.addToPolicy(
    new PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [changeStateArn, startScheduleArn, storeTaskTokenArn],
    })
  );
  role.addToPolicy(
    new PolicyStatement({
      actions: ['dynamodb:UpdateItem'],
      resources: [scheduledActivityTable.tableArn],
    })
  );

  const SCHEDULE_DEFINITION = {
      "Comment": "State machine for changing the heating mode of the Arduino.",
      "StartAt": "WaitBeforeTurnOn",
      "States": {
          "CheckIfRecurring": {
              "Choices": [
                  {
                      "BooleanEquals": true,
                      "Next": "RescheduleRecurring",
                      "Variable": "$.recurring"
                  }
              ],
              "Default": "Done",
              "Type": "Choice"
          },
          "Done": {
              "End": true,
              "Type": "Pass"
          },
          "RescheduleRecurring": {
              "End": true,
              "Parameters": {
                  "durationSeconds.$": "$.durationSeconds",
                  "recurring.$": "$.recurring",
                  "startTime.$": "$.startTime",
                  "thingName.$": "$.thingName"
              },
              "Resource": startScheduleArn,
              "Type": "Task"
          },
          "TurnOff": {
              "Next": "CheckIfRecurring",
              "Parameters": {
                  "executionArn.$": "$$.Execution.Id",
                  "mode": "OFF",
                  "recurring.$": "$.recurring",
                  "startTime.$": "$.startTime",
                  "thingName.$": "$.thingName"
              },
              "Resource": changeStateArn,
              "ResultPath": "$.turnOffResult",
              "Type": "Task"
          },
          "TurnOn": {
              "Next": "WaitBeforeTurnOff",
              "Parameters": {
                  "durationSeconds.$": "$.durationSeconds",
                  "executionArn.$": "$$.Execution.Id",
                  "mode": "ON",
                  "recurring.$": "$.recurring",
                  "startTime.$": "$.startTime",
                  "thingName.$": "$.thingName"
              },
              "Resource": changeStateArn,
              "ResultPath": "$.turnOnResult",
              "Type": "Task"
          },
          "WaitBeforeTurnOff": {
              "Next": "TurnOff",
              "SecondsPath": "$.durationSeconds",
              "Type": "Wait"
          },
          "WaitBeforeTurnOn": {
              "Next": "TurnOn",
              "SecondsPath": "$.startWaitSeconds",
              "Type": "Wait"
          }
      }
  };

  const TEMPERATURE_DEFINITION = {
      "Comment": "State machine for controlling heating until target temperature is reached",
      "StartAt": "TurnOn",
      "States": {
          "TurnOff": {
              "Next": "UpdateScheduledActivityUntil",
              "Parameters": {
                  "executionArn.$": "$$.Execution.Id",
                  "mode": "OFF",
                  "since.$": "$.since",
                  "thingName.$": "$.thingName"
              },
              "Resource": changeStateArn,
              "ResultPath": "$",
              "Type": "Task"
          },
          "TurnOn": {
              "Next": "WaitForTargetTemperature",
              "Parameters": {
                  "executionArn.$": "$$.Execution.Id",
                  "mode": "ON",
                  "thingName.$": "$.thingName"
              },
              "Resource": changeStateArn,
              "ResultPath": "$.turnOnResult",
              "Type": "Task"
          },
          "UpdateScheduledActivityUntil": {
              "End": true,
              "Parameters": {
                  "ExpressionAttributeNames": {
                      "#until": "until"
                  },
                  "ExpressionAttributeValues": {
                      ":until": {
                          "N.$": "States.Format('{}', $.until)"
                      }
                  },
                  "Key": {
                      "device": {
                          "S.$": "$.thingName"
                      },
                      "since": {
                          "N.$": "States.Format('{}', $.since)"
                      }
                  },
                  "TableName": scheduledActivityTableName,
                  "UpdateExpression": "SET #until = :until"
              },
              "Resource": "arn:aws:states:::dynamodb:updateItem",
              "Type": "Task"
          },
          "WaitForTargetTemperature": {
              "Catch": [
                  {
                      "ErrorEquals": [
                          "States.Timeout"
                      ],
                      "Next": "TurnOff",
                      "ResultPath": "$.timeoutError"
                  }
              ],
              "Next": "TurnOff",
              "Parameters": {
                  "FunctionName": storeTaskTokenArn,
                  "Payload": {
                      "dhwTargetTemperature.$": "$.dhwTargetTemperature",
                      "since.$": "$.since",
                      "taskToken.$": "$$.Task.Token",
                      "thingName.$": "$.thingName"
                  }
              },
              "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
              "ResultPath": "$.waitResult",
              "TimeoutSeconds": 3600,
              "Type": "Task"
          }
      }
  };

  const scheduleHeatingChange = new CfnStateMachine(stack, 'scheduleHeatingChange', {
    stateMachineName: `schedule-heating-change-${branchName}`,
    roleArn: role.roleArn,
    definitionString: stack.toJsonString(SCHEDULE_DEFINITION),
  });

  const temperatureHeatingChange = new CfnStateMachine(stack, 'temperatureHeatingChange', {
    stateMachineName: `temperature-heating-change-${branchName}`,
    roleArn: role.roleArn,
    definitionString: stack.toJsonString(TEMPERATURE_DEFINITION),
  });

  // The lambda and the front end read these rather than hardcoding an ARN, which is what tied
  // the Gen 1 code to a single environment.
  backend.homethermostatStartScheduleStateChange.addEnvironment(
    'SCHEDULE_STATE_MACHINE_ARN',
    scheduleHeatingChange.ref
  );

  return { scheduleHeatingChange, temperatureHeatingChange };
}
