const stateMachineArn = 'arn:aws:states:eu-west-1:056402289766:stateMachine:schedule-heating-change';

class StepFunctionsClient {
    constructor(stepFunctions) {
        this.stepFunctions = stepFunctions;
    }

    startNewExecution(workflowInput) {
        return new Promise((resolve, reject) => {
            const params = {
                stateMachineArn: stateMachineArn,
                input: JSON.stringify(workflowInput),
                name: 'ScheduleHeatChange-' + makeId(10),
            };
            console.log('Params:', params);

            return this.stepFunctions.startExecution(params, function (error, data) {
                if (error) {
                    console.log(error, error.stack);
                    reject(error);
                } else {
                    resolve('Workflow started');
                }
            });
        });
    }

    stopCurrentExecutions() {
        return new Promise((resolve, reject) => {
            return this.stepFunctions.listExecutions({ stateMachineArn: stateMachineArn, statusFilter: 'RUNNING' }, function (err, data) {
                console.log('Execution objects: ', data);
                if (data === null || data.executions.length === 0) {
                    return resolve();
                }
                data.executions.forEach(function (execution) {
                    console.log('Stopping execution ' + execution.executionArn);
                    this.stepFunctions.stopExecution({ executionArn: execution.executionArn }, function (error, data) {
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

}

function makeId(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

module.exports = StepFunctionsClient;
