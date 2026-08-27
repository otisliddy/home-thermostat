/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_ARN
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_STREAMARN
Amplify Params - DO NOT EDIT */
const { StepFunctionsClient, DynamodbClient, statusHelper, modes } = require('./home-thermostat-common');
const { SFNClient } = require('@aws-sdk/client-sfn');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const stepFunctionsClient = new StepFunctionsClient(new SFNClient({ region: process.env.REGION }));
const dynamodbClient = new DynamodbClient(new DynamoDBClient({ region: process.env.REGION }));
const scheduleTableName = process.env.STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME;
const stateMachineArn = "arn:aws:states:eu-west-1:056402289766:stateMachine:schedule-heating-change";

exports.handler = async function (event, context) {
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
    throw new Error('Invalid startTime format');
  }

  const stateMachineInput = {
    thingName: thingName,
    startWaitSeconds: startWaitSeconds,
    durationSeconds: durationSeconds,
    recurring: recurring,
    startTime: startTime
  };

  console.log('Starting state machine with input:', stateMachineInput);

  try {
    const executionArn = await stepFunctionsClient.startNewExecution(stateMachineArn, stateMachineInput);
    console.log('Successfully started execution:', executionArn);

    const options = {
      duration: durationSeconds,
      executionArn: executionArn,
      recurring: recurring
    };

    const status = statusHelper.createStatus(thingName, modes.ON.val, options, startTime);

    console.log('Inserting scheduled activity:', status);

    if (startWaitSeconds !== 0) {
      await dynamodbClient.insertStatus(scheduleTableName, status);
      console.log('Successfully inserted scheduled activity');
    }

    if (isRecurring) {
      return executionArn;
    }
  } catch (error) {
    console.error('Error starting execution or inserting status:', error);
    throw error;
  }
};

function calculateSecondsUntilTimestamp(targetTime) {
  const now = new Date();

  console.log('Target time:', targetTime.toISOString());
  console.log('Current time:', now.toISOString());

  const secondsUntil = Math.floor((targetTime - now) / 1000);
  console.log('Scheduling for:', targetTime.toISOString(), '(', secondsUntil, 'seconds from now)');
  return secondsUntil;
}
