
const AWS = require('aws-sdk');
const StepFunctions = require('aws-sdk/clients/stepfunctions');
const uuidv4 = require('uuid');

const stateMachineArn = 'arn:aws:states:eu-west-1:056402289766:stateMachine:HomeThermostatStateMachine';
const stepFunctions = new StepFunctions({ apiVersion: '2016-11-23' });
AWS.config.region = 'eu-west-1';

exports.handler = function (event, context) {
  console.log('Event: ', event);

  Promise.resolve()
    .then(() => stopCurrentExecutions())
    .then(() => startNewExecution(event, context))
    .then((resolve) => {
      context.done(null, resolve);
    })
    .catch((error) => {
      context.fail(null, error);
    });
};

function stopCurrentExecutions() {
  return new Promise((resolve, reject) => {
    return stepFunctions.listExecutions({ stateMachineArn: stateMachineArn, statusFilter: 'RUNNING' }, function (err, data) {
      console.log('Execution objects: ', data);
      if (data == null || data.executions.length === 0) {
        resolve();
      }
      data.executions.forEach(function (execution) {
        console.log('Stopping execution ' + execution.executionArn);
        stepFunctions.stopExecution({ executionArn: execution.executionArn }, function (error, data) {
          if (error) {
            console.log('Error received trying to stop execution', error.stack);
            reject();
          } else {
            console.log('Stopped execution. Response: ', data);
            resolve();
          }
        });
      });
    });
  });
}

function startNewExecution(event, context) {
  return new Promise((resolve, reject) => {
    const params = {
      stateMachineArn: stateMachineArn,
      input: JSON.stringify(event),
      name: 'ScheduleHeatChange-' + uuidv4(),
    };
    console.log('Params:', params);

    return stepFunctions.startExecution(params, function (error, data) {
      if (error) {
        console.log(error, error.stack);
        reject(error);
      } else {
        resolve('Workflow started');
      }
    });
  });
}