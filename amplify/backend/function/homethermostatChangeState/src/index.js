/* Amplify Params - DO NOT EDIT *//* Amplify Params - DO NOT EDIT
    ENV
    REGION
    STORAGE_HOMETHERMOSTATDEVICESTATE_ARN
    STORAGE_HOMETHERMOSTATDEVICESTATE_NAME
    STORAGE_HOMETHERMOSTATDEVICESTATE_STREAMARN
Amplify Params - DO NOT EDIT */

const { modes, DynamodbClient, statusHelper } = require('./home-thermostat-common');
const AWS = require('aws-sdk');
AWS.config.region = process.env.REGION;

const dynamodbClient = new DynamodbClient(new AWS.DynamoDB());
const iotData = new AWS.IotData({ endpoint: 'a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com' });
const stateTableName = process.env.STORAGE_HOMETHERMOSTATDEVICESTATE_NAME;

exports.handler = function (event, context) {
    console.log('Payload: ', event);

    // Extract parameters from the new simplified structure
    const mode = event.mode; // 'ON' or 'OFF'
    const thingName = event.thingName;
    const recurring = event.recurring;
    const startTime = event.startTime;
    const durationSeconds = event.durationSeconds;
    const executionArn = event.executionArn;

    // Update the thing shadow
    const params = {
        thingName: thingName,
        shadowName: thingName + '_shadow',
        payload: `{"state":{"desired":{"on":${mode === 'ON'}}}}`
    };

    iotData.updateThingShadow(params, function (err, data) {
        if (err) {
            console.log(err, err.stack);
            context.fail(err);
        }
        else {
            handleSuccessfulResponse(event, thingName, mode, recurring, startTime, durationSeconds, executionArn, context);
        }
    });
}

function handleSuccessfulResponse(event, thingName, mode, recurring, startTime, durationSeconds, executionArn, context) {
    const statusOptions = buildStatusOptions(mode, durationSeconds, executionArn);

    // Convert mode string to modes constant value
    const modeValue = mode === 'ON' ? modes.ON.val : modes.OFF.val;
    const status = statusHelper.createStatus(thingName, modeValue, statusOptions);

    dynamodbClient.insertStatus(stateTableName, status)
        .then(() => {
            // Return the original event data to pass through the state machine
            context.done(null, event);
        })
        .catch((error) => {
            console.error('Error inserting status:', error);
            context.fail(error);
        });
}

function buildStatusOptions(mode, durationSeconds, executionArn) {
    const statusOptions = {};

    // Only add duration if we're turning ON and have a duration
    if (mode === 'ON' && durationSeconds) {
        statusOptions.duration = durationSeconds;
    }

    if (executionArn) {
        statusOptions.executionArn = executionArn;
    }

    return statusOptions;
}
