/* Amplify Params - DO NOT EDIT *//* Amplify Params - DO NOT EDIT
    ENV
    REGION
    STORAGE_DEVICESTATE_ARN
    STORAGE_DEVICESTATE_NAME
    STORAGE_DEVICESTATE_STREAMARN
Amplify Params - DO NOT EDIT */

const { modes, DynamodbClient, statusHelper } = require('./home-thermostat-common');
const AWS = require('aws-sdk');
AWS.config.region = process.env.REGION; // TODO use REGION

const dynamodbClient = new DynamodbClient(new AWS.DynamoDB());
const iotData = new AWS.IotData({ endpoint: 'a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com' });
const stateTableName = process.env.STORAGE_DEVICESTATE_NAME;

exports.handler = function (event, context) { // TODO don't pass in context and instead return response = {statusCode: 200,body:  JSON.stringify('Hello from Lambda!')}
    console.log('Payload: ', event);
    const mode = event.stateChanges[0].mode;
    const params = { thingName: 'ht-main', payload: `{"state":{"desired":{"on":${mode === modes.ON.val}}}}` };

    iotData.updateThingShadow(params, function (err, data) {
        if (err) {
            console.log(err, err.stack);
        }
        else {
            console.log('success', data);
            handleSuccessfulResponse(event, mode, context);
        }
    });
}

function handleSuccessfulResponse(event, mode, context) {
    const statusOptions = buildStatusOptions(event);
    const workflowStatus = buildStepFunctionStatus(event);

    const status = statusHelper.createStatus(mode, statusOptions); //mode + until
    dynamodbClient.insertStatus(stateTableName, status)
        .then(() => context.done(null, workflowStatus));
}

function buildStatusOptions(event) {
    const statusOptions = {};
    if (event.stateChanges.length > 1 && event.stateChanges[1].waitSeconds) {
        statusOptions.duration = event.stateChanges[1].waitSeconds;
    }
    return statusOptions;
}

function buildStepFunctionStatus(event) {
    event.stateChanges.splice(0, 1);
    const continueWorkflow = event.stateChanges.length > 0; //TODO move to step functions result path https://docs.aws.amazon.com/step-functions/latest/dg/concepts-input-output-filtering.html
    const workflowStatus = {
        stateChanges: event.stateChanges,
        continueWorkflow: continueWorkflow
    };

    return workflowStatus;
}
