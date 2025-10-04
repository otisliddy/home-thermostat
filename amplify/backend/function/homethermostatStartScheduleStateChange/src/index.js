const { StepFunctionsClient } = require('./home-thermostat-common');
const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.REGION });
const StepFunctions = require('aws-sdk/clients/stepfunctions');

const stepFunctionsClient = new StepFunctionsClient(new StepFunctions());

exports.handler = function (event, context) {
  console.log('Event: ', event);

  // Check if this is a recurring re-schedule call from Step Functions
  if (event.recurring && event.startTime) {
    console.log('Re-scheduling recurring activity for next occurrence');

    const waitSeconds = calculateSecondsUntilTime(event.startTime);
    const stateMachineInput = [
      {
        thingName: event.thingName,
        waitSeconds: waitSeconds,
        mode: 'ON',
        recurring: event.recurring,
        startTime: event.startTime
      },
      {
        thingName: event.thingName,
        waitSeconds: event.durationSeconds,
        mode: 'OFF'
      }
    ];

    stepFunctionsClient.startNewExecution(stateMachineInput)
      .then((executionArn) => {
        console.log('Successfully re-scheduled recurring activity');

        // Update the scheduled activity in DynamoDB with new executionArn and time
        const targetTime = new Date();
        const [hours, minutes] = event.startTime.split(':').map(Number);
        targetTime.setHours(hours, minutes, 0, 0);
        if (targetTime <= new Date()) {
          targetTime.setDate(targetTime.getDate() + 1);
        }

        // Delete old entry and create new one
        // Note: We need to find the old entry first - for now just create the new one
        // The old entry will naturally expire or can be cleaned up

        context.done(null, executionArn);
      })
      .catch((error) => {
        console.error('Error re-scheduling recurring activity:', error);
        context.fail(null, error);
      });
  } else {
    // Original scheduling logic
    Promise.resolve()
      .then(() => {
        if (event.cancelExisting === true) {
          return stepFunctionsClient.stopCurrentExecutions();
        }
      })
      .then(() => stepFunctionsClient.startNewExecution(event.stateMachineInput))
      .then((executionArn) => {
        context.done(null, executionArn);
      })
      .catch((error) => {
        context.fail(null, error);
      });
  }
};

function calculateSecondsUntilTime(timeString) {
  // timeString format: "HH:MM" (e.g., "07:40")
  // For recurring schedules, always schedule for tomorrow at the same time
  // This ensures exactly 24-hour intervals
  const [hours, minutes] = timeString.split(':').map(Number);

  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // Always add one day for recurring activities
  target.setDate(target.getDate() + 1);

  const secondsUntil = Math.floor((target - now) / 1000);
  console.log('Scheduling recurring activity for:', target.toISOString(), '(', secondsUntil, 'seconds from now)');
  return secondsUntil;
}
