import { CfnStateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Arn, ArnFormat, Stack } from 'aws-cdk-lib';
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
                  "end": {
                      "endReason": "duration_elapsed"
                  },
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

  // TurnOff's ResultPath "$" replaces the state with changeState's echoed input, so anything the
  // later states read must be listed in its Parameters or it is lost.
  const TEMPERATURE_DEFINITION = {
      "Comment": "State machine for controlling heating until target temperature is reached",
      "StartAt": "WaitBeforeTurnOn",
      "States": {
          "WaitBeforeTurnOn": {
              "Next": "TurnOn",
              "SecondsPath": "$.startWaitSeconds",
              "Type": "Wait"
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
          "WaitForTargetTemperature": {
              "Catch": [
                  {
                      "ErrorEquals": [
                          "States.Timeout"
                      ],
                      "Next": "RecordTimeout",
                      "ResultPath": "$.timeoutError"
                  }
              ],
              "Next": "RecordTargetReached",
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
          },
          "RecordTargetReached": {
              "Next": "TurnOff",
              "Parameters": {
                  "endReason.$": "$.waitResult.reason",
                  "endTemperature.$": "$.waitResult.temperature"
              },
              "ResultPath": "$.end",
              "Type": "Pass"
          },
          "RecordTimeout": {
              "Next": "TurnOff",
              "Result": {
                  "endReason": "timed_out"
              },
              "ResultPath": "$.end",
              "Type": "Pass"
          },
          "TurnOff": {
              "Next": "UpdateScheduledActivityUntil",
              "Parameters": {
                  "dhwTargetTemperature.$": "$.dhwTargetTemperature",
                  "end.$": "$.end",
                  "executionArn.$": "$$.Execution.Id",
                  "mode": "OFF",
                  "recurring.$": "$.recurring",
                  "since.$": "$.since",
                  "startTime.$": "$.startTime",
                  "thingName.$": "$.thingName"
              },
              "Resource": changeStateArn,
              "ResultPath": "$",
              "Type": "Task"
          },
          "UpdateScheduledActivityUntil": {
              "Next": "CheckIfRecurring",
              "Parameters": {
                  "ExpressionAttributeNames": {
                      "#endReason": "endReason",
                      "#until": "until"
                  },
                  "ExpressionAttributeValues": {
                      ":endReason": {
                          "S.$": "$.end.endReason"
                      },
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
                  "UpdateExpression": "SET #until = :until, #endReason = :endReason"
              },
              "Resource": "arn:aws:states:::dynamodb:updateItem",
              "ResultPath": "$.updateResult",
              "Type": "Task"
          },
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
          "RescheduleRecurring": {
              "End": true,
              "Parameters": {
                  "dhwTargetTemperature.$": "$.dhwTargetTemperature",
                  "recurring.$": "$.recurring",
                  "startTime.$": "$.startTime",
                  "thingName.$": "$.thingName"
              },
              "Resource": startScheduleArn,
              "Type": "Task"
          },
          "Done": {
              "End": true,
              "Type": "Pass"
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

  // Built from the name rather than read off the resource. Referencing scheduleHeatingChange.ref
  // here would make the function stack depend on this one, which already depends on the function
  // stack for the ARNs above, and CloudFormation rejects the cycle.
  const stateMachineArnByName = (name: string) =>
    Arn.format(
      {
        service: 'states',
        resource: 'stateMachine',
        resourceName: name,
        arnFormat: ArnFormat.COLON_RESOURCE_NAME,
      },
      Stack.of(backend.homethermostatStartScheduleStateChange.resources.lambda)
    );

  const scheduleStateMachineArn = stateMachineArnByName(`schedule-heating-change-${branchName}`);
  const temperatureStateMachineArn = stateMachineArnByName(
    `temperature-heating-change-${branchName}`
  );

  backend.homethermostatStartScheduleStateChange.addEnvironment(
    'SCHEDULE_STATE_MACHINE_ARN',
    scheduleStateMachineArn
  );
  backend.homethermostatStartScheduleStateChange.addEnvironment(
    'TEMPERATURE_STATE_MACHINE_ARN',
    temperatureStateMachineArn
  );
  backend.homethermostatStartScheduleStateChange.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      actions: ['states:StartExecution', 'states:StopExecution'],
      resources: [scheduleStateMachineArn, temperatureStateMachineArn],
    })
  );

  return { scheduleHeatingChange, temperatureHeatingChange };
}
