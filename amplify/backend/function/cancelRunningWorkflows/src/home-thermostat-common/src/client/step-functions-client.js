const uuidv4 = require('uuid');

const stateMachineArn = 'arn:aws:states:eu-west-1:056402289766:stateMachine:HomeThermostatStateMachine';

class StepFunctionsClient {
    constructor(stepFunctions) {
        this.stepFunctions = stepFunctions;
    }

    startNewExecution(workflowInput) {
        return new Promise((resolve, reject) => {
            const params = {
                stateMachineArn: stateMachineArn,
                input: JSON.stringify(workflowInput),
                name: 'ScheduleHeatChange-' + uuidv4(),
            };

            return this.stepFunctions.startExecution(params, function (error, data) {
                if (error) {
                    console.log(error, error.stack);
                    reject(error);
                } else {
                    resolve(data.executionArn);
                }
            });
        });
    }

    stopRunningExecution(executionArn) {
        return new Promise((resolve, reject) => {
            this.stepFunctions.stopExecution({ executionArn: executionArn }, function (error, data) {
                if (error) {
                    console.log('Error received trying to stop execution', error.stack);
                    reject();
                } else {
                    console.log('Stopped execution. Response: ', data);
                    resolve();
                }
            });
        });
    }
}

module.exports = StepFunctionsClient;
