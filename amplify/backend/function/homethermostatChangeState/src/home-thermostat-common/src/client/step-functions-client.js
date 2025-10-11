const { StartExecutionCommand, StopExecutionCommand } = require('@aws-sdk/client-sfn');
const stateMachineArn = 'arn:aws:states:eu-west-1:056402289766:stateMachine:schedule-heating-change';

class StepFunctionsClient {
    constructor(stepFunctions) {
        this.stepFunctions = stepFunctions;
    }

    async startNewExecution(stateMachineInput) {
        const params = {
            stateMachineArn: stateMachineArn,
            input: JSON.stringify(stateMachineInput),
            name: 'ScheduleHeatChange-' + makeId(10),
        };
        console.log('Params:', params);

        try {
            const data = await this.stepFunctions.send(new StartExecutionCommand(params));
            console.log('stepFunctions started', data);
            return data.executionArn;
        } catch (error) {
            console.log(error, error.stack);
            throw error;
        }
    }

    async stopRunningExecution(executionArn) {
        try {
            const data = await this.stepFunctions.send(new StopExecutionCommand({ executionArn: executionArn }));
            console.log('Stopped execution. Response: ', data);
        } catch (error) {
            console.log('Error received trying to stop execution', error.stack);
            throw error;
        }
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
