const { StepFunctionsClient } = require('./home-thermostat-common');

const stepFunctions = new StepFunctionsClient();

exports.handler = function (event, context) {
  console.log('Event: ', event);

  Promise.resolve()
    .then(() => {
      if (event.cancelExisting === true) {
        return stepFunctions.stopCurrentExecutions();
      }
    })
    .then(() => stepFunctions.startNewExecution(event.workflowInput))
    .then((resolve) => {
      context.done(null, resolve);
    })
    .catch((error) => {
      context.fail(null, error);
    });
};
