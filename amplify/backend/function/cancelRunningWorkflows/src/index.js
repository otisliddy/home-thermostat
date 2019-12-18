import StepFunctions from 'aws-sdk/clients/stepfunctions';
import { StepFunctionsClient } from 'home-thermostat-common';
import AWS from 'aws-sdk';

AWS.config.region = 'eu-west-1';
const stepFunctionsClient = new StepFunctionsClient(new StepFunctions());

exports.handler = function (event, context) {
  console.log('Payload: ', event);
  stepFunctionsClient.stopRunningExecution(event.executionArn).then(() => {
    context.done(null, 'Success!');
  });
};
