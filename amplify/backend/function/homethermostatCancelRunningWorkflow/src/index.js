// TODO remove this Lambda, can now invoke StepFunctions from UI
const { SFNClient } = require('@aws-sdk/client-sfn');
const { StepFunctionsClient } = require('./home-thermostat-common');

const sfnClient = new SFNClient({ region: 'eu-west-1' });
const stepFunctionsClient = new StepFunctionsClient(sfnClient);

exports.handler = async function (event, context) {
  console.log('Payload: ', event);
  try {
    await stepFunctionsClient.stopRunningExecution(event.executionArn);
    return 'Success!';
  } catch (error) {
    console.error('Error stopping execution:', error);
    throw error;
  }
};