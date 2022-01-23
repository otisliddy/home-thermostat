const { StepFunctionsClient } = require('./home-thermostat-common');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'eu-west-1' });
const StepFunctions = require('aws-sdk/clients/stepfunctions');

const stepFunctionsClient = new StepFunctionsClient(new StepFunctions());

exports.handler = function (event, context) {
  console.log('Event: ', event);

  Promise.resolve()
    .then(() => {
      if (event.cancelExisting === true) {
        return stepFunctionsClient.stopCurrentExecutions();
      }
    })
    .then(() => stepFunctionsClient.startNewExecution(event.workflowInput))
    .then((executionArn) => {
      context.done(null, executionArn);
    })
    .catch((error) => {
      context.fail(null, error);
    });
};
