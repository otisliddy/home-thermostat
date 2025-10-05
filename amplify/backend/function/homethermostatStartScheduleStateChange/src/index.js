const { StepFunctionsClient } = require('./home-thermostat-common');
const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.REGION });
const StepFunctions = require('aws-sdk/clients/stepfunctions');

const stepFunctionsClient = new StepFunctionsClient(new StepFunctions());

exports.handler = function (event, context) {
  console.log('Event: ', event);

  // Extract parameters - they come directly from App.js or from RescheduleRecurring
  const thingName = event.thingName;
  const recurring = event.recurring || false;
  const startTime = event.startTime;
  const durationSeconds = event.durationSeconds;

  // Calculate startWaitSeconds based on startTime
  let startWaitSeconds;
  if (startTime === 0 || startTime === '0') {
    // Immediate execution
    startWaitSeconds = 0;
  } else if (typeof startTime === 'string') {
    // ISO 8601 timestamp string (e.g., "2025-10-05T16:31:00.000Z")
    startWaitSeconds = calculateSecondsUntilTimestamp(startTime, recurring, event.isInitialInvocation);
  } else {
    console.error('Invalid startTime format:', startTime);
    context.fail('Invalid startTime format');
    return;
  }

  // Build the state machine input
  const stateMachineInput = {
    thingName: thingName,
    startWaitSeconds: startWaitSeconds,
    durationSeconds: durationSeconds,
    recurring: recurring,
    startTime: startTime
  };

  console.log('Starting state machine with input:', stateMachineInput);

  // Start the step function execution
  stepFunctionsClient.startNewExecution(stateMachineInput)
    .then((executionArn) => {
      console.log('Successfully started execution:', executionArn);
      context.done(null, executionArn);
    })
    .catch((error) => {
      console.error('Error starting execution:', error);
      context.fail(null, error);
    });
};

function calculateSecondsUntilTimestamp(isoTimestamp, isRecurring, isInitialInvocation) {
  const targetTime = new Date(isoTimestamp);
  const now = new Date();

  console.log('Original target time:', targetTime.toISOString());
  console.log('Current time:', now.toISOString());

  // For recurring activities, we need to schedule for the next occurrence (tomorrow at the same time)
  if (isRecurring && !isInitialInvocation) {
    targetTime.setTime(targetTime.getTime() + 24 * 60 * 60 * 1000);
    console.log('Recurring - adjusted target time:', targetTime.toISOString());
  }

  const secondsUntil = Math.floor((targetTime - now) / 1000);
  console.log('Scheduling for:', targetTime.toISOString(), '(', secondsUntil, 'seconds from now)');
  return secondsUntil;
}
