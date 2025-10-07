/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_ARN
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_STREAMARN
Amplify Params - DO NOT EDIT */const { StepFunctionsClient, DynamodbClient, statusHelper, modes } = require('./home-thermostat-common');
const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.REGION });
const StepFunctions = require('aws-sdk/clients/stepfunctions');

const stepFunctionsClient = new StepFunctionsClient(new StepFunctions());
const dynamodbClient = new DynamodbClient(new AWS.DynamoDB());
const scheduleTableName = process.env.STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME;

exports.handler = function (event, context) {
  console.log('Event: ', event);

  // Extract parameters - for initial invocation they come from App.js
  // or for recurring invocations they come from Step Functions RescheduleRecurring state
  const thingName = event.thingName;
  const recurring = event.recurring || false;
  let startTime = event.startTime;
  const durationSeconds = event.durationSeconds;
  const isInitialInvocation = event.isInitialInvocation;
  const isRecurring = recurring && !isInitialInvocation;

  let startWaitSeconds;

  if (startTime === 0 || startTime === '0') {
    // Immediate execution
    startWaitSeconds = 0;
    startTime = new Date(); // Now
  } else if (typeof startTime === 'string') {
    startTime = new Date(startTime);

    // For recurring tasks, increment by one day
    if (isRecurring) {
      startTime.setTime(startTime.getTime() + 24 * 60 * 60 * 1000);
    }

    startWaitSeconds = calculateSecondsUntilTimestamp(startTime);
  } else {
    console.error('Invalid startTime format:', startTime);
    context.fail('Invalid startTime format');
    return;
  }

  const stateMachineInput = {
    thingName: thingName,
    startWaitSeconds: startWaitSeconds,
    durationSeconds: durationSeconds,
    recurring: recurring,
    startTime: startTime
  };

  console.log('Starting state machine with input:', stateMachineInput);

  stepFunctionsClient.startNewExecution(stateMachineInput)
    .then((executionArn) => {
      console.log('Successfully started execution:', executionArn);

      const options = {
        duration: durationSeconds,
        executionArn: executionArn,
        recurring: recurring
      };

      const status = statusHelper.createStatus(thingName, modes.ON.val, options, startTime);

      console.log('Inserting scheduled activity:', status);

      return dynamodbClient.insertStatus(scheduleTableName, status)
        .then(() => {
          console.log('Successfully inserted scheduled activity');
          if (isRecurring) {
            context.done(null, executionArn);
          }
        });
    })
    .catch((error) => {
      console.error('Error starting execution or inserting status:', error);
      context.fail(null, error);
    });
};

function calculateSecondsUntilTimestamp(targetTime) {
  const now = new Date();

  console.log('Target time:', targetTime.toISOString());
  console.log('Current time:', now.toISOString());

  const secondsUntil = Math.floor((targetTime - now) / 1000);
  console.log('Scheduling for:', targetTime.toISOString(), '(', secondsUntil, 'seconds from now)');
  return secondsUntil;
}
