const StepFunctions = require('aws-sdk/clients/stepfunctions');
const { StepFunctionsClient } = require('./home-thermostat-common');
const AWS = require('aws-sdk');

AWS.config.region = 'eu-west-1';
const stepFunctionsClient = new StepFunctionsClient(new StepFunctions());

exports.handler = function (event, context) {
  console.log('Payload: ', event);
  stepFunctionsClient.stopRunningExecution(event.executionArn).then(() => {
    context.done(null, 'Success!');
  });
};
