
import StepFunctions from 'aws-sdk/clients/stepfunctions';
import { StepFunctionsClient } from 'home-thermostat-common';
const stepFunctionsClient = new StepFunctionsClient(new StepFunctions());

exports.handler = function (event, context) {
  stepFunctionsClient.stopCurrentExecutions().then(() => {
    context.done(null, 'Success boop!');
  });
};
