/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_ARN
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME
	STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_STREAMARN
Amplify Params - DO NOT EDIT */
import { StepFunctionsClient, DynamodbClient, statusHelper, modes } from 'home-thermostat-common';
import { SFNClient } from '@aws-sdk/client-sfn';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const stepFunctionsClient = new StepFunctionsClient(new SFNClient({ region: process.env.REGION }));
const dynamodbClient = new DynamodbClient(new DynamoDBClient({ region: process.env.REGION }));
const scheduleTableName = process.env.STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME;
// Gen 2 names the state machines per branch, so the ARNs are injected rather than hardcoded.
const scheduleStateMachineArn = process.env.SCHEDULE_STATE_MACHINE_ARN;
const temperatureStateMachineArn = process.env.TEMPERATURE_STATE_MACHINE_ARN;

export const handler = async (event) => {
  console.log('Event: ', event);

  const thingName = event.thingName;
  const recurring = event.recurring || false;
  const durationSeconds = event.durationSeconds;
  const dhwTargetTemperature = event.dhwTargetTemperature;
  const isInitialInvocation = event.isInitialInvocation;
  const isRecurring = recurring && !isInitialInvocation;

  const { startTime, startWaitSeconds } = resolveStart(event.startTime, isRecurring);

  const runsToTemperature = dhwTargetTemperature !== undefined && dhwTargetTemperature !== null;

  // Must match the 'since' createStatus derives below: the machine keys its closing update on it.
  const since = Math.round(startTime.getTime() / 1000);

  const stateMachineArn = runsToTemperature ? temperatureStateMachineArn : scheduleStateMachineArn;
  const stateMachineInput = runsToTemperature
    ? { thingName, startWaitSeconds, dhwTargetTemperature, recurring, startTime, since }
    : { thingName, startWaitSeconds, durationSeconds, recurring, startTime };

  console.log('Starting state machine', stateMachineArn, 'with input:', stateMachineInput);

  try {
    const executionArn = await stepFunctionsClient.startNewExecution(stateMachineArn, stateMachineInput);
    console.log('Successfully started execution:', executionArn);

    const options = { executionArn, recurring };
    if (durationSeconds) {
      options.duration = durationSeconds;
    }
    if (runsToTemperature) {
      options.dhwTargetTemperature = dhwTargetTemperature;
    }

    const status = statusHelper.createStatus(thingName, modes.ON.val, options, startTime);

    // A temperature run always needs a row: it is the only record of the target. An immediate
    // timed run does not, because changeState writes the device state itself.
    if (runsToTemperature || startWaitSeconds !== 0) {
      console.log('Inserting scheduled activity:', status);
      await dynamodbClient.insertStatus(scheduleTableName, status);
      console.log('Successfully inserted scheduled activity');
    }

    if (isRecurring) {
      return executionArn;
    }

    return { executionArn, since };
  } catch (error) {
    console.error('Error starting execution or inserting status:', error);
    throw error;
  }
};

// A recurring run moves on a day: the time it carries is the one just served.
function resolveStart(rawStartTime, isRecurring) {
  if (rawStartTime === 0 || rawStartTime === '0') {
    return { startTime: new Date(), startWaitSeconds: 0 };
  }

  if (typeof rawStartTime === 'string' || rawStartTime instanceof Date) {
    const startTime = new Date(rawStartTime);

    if (isRecurring) {
      startTime.setTime(startTime.getTime() + 24 * 60 * 60 * 1000);
    }

    return { startTime, startWaitSeconds: calculateSecondsUntilTimestamp(startTime) };
  }

  console.error('Invalid startTime format:', rawStartTime);
  throw new Error('Invalid startTime format');
}

function calculateSecondsUntilTimestamp(targetTime) {
  const now = new Date();

  console.log('Target time:', targetTime.toISOString());
  console.log('Current time:', now.toISOString());

  const secondsUntil = Math.floor((targetTime - now) / 1000);
  console.log('Scheduling for:', targetTime.toISOString(), '(', secondsUntil, 'seconds from now)');
  return secondsUntil;
}
