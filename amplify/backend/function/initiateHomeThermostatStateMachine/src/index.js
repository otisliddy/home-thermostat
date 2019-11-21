
const AWS = require('aws-sdk');
const StepFunctions = require('aws-sdk/clients/stepfunctions');
const uuidv4 = require('uuid');

const stateMachineArn = 'arn:aws:states:eu-west-1:056402289766:stateMachine:HomeThermostatStateMachine';
const accessKeyId = 'AKIAQ2IOWURTEDHC7RWE';
const secretAccessKey = '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';

AWS.config.region = 'eu-west-1';
AWS.config.credentials = new AWS.Credentials(accessKeyId, secretAccessKey);

const stepFunctions = new StepFunctions({ apiVersion: '2016-11-23' });

exports.handler = function (event, context) {
  console.log('Event: ', event);
  
  stopCurrentExecutions();
  startNewExecution(event, context)
};

function stopCurrentExecutions() {
  stepFunctions.listExecutions({ stateMachineArn: stateMachineArn, statusFilter: 'RUNNING' }, function (err, data) {
    console.log('Execution objects: ', data);
    data.executions.forEach(function (execution) {
      console.log('Stopping execution ' + execution.executionArn);
      stepFunctions.stopExecution({ executionArn: execution.executionArn }, function (error, data) {
        if (error) {
          console.log('Error received trying to stop execution', error.stack)
        } else {
          console.log('Stopped execution. Response: ', data);
        }
      });
    });
  });
}

function startNewExecution(event, context) {
  const params = {
    stateMachineArn: stateMachineArn,
    input: JSON.stringify(event), //TODO use json.stringify
    name: 'ScheduleHeatChange-' + uuidv4(),
  };
  console.log('Params: ' + params);

  stepFunctions.startExecution(params, function (error, data) {
    if (error) {
      console.log(error, error.stack);
      throw Error(error);
    } else {
      context.done(null, 'Workflow started');
    }
  });
}