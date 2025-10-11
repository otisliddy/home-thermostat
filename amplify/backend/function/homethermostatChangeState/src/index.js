/* Amplify Params - DO NOT EDIT *//* Amplify Params - DO NOT EDIT
    ENV
    REGION
    STORAGE_HOMETHERMOSTATDEVICESTATE_ARN
    STORAGE_HOMETHERMOSTATDEVICESTATE_NAME
    STORAGE_HOMETHERMOSTATDEVICESTATE_STREAMARN
Amplify Params - DO NOT EDIT */

const { modes, DynamodbClient, statusHelper } = require('./home-thermostat-common');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { IoTDataPlaneClient, UpdateThingShadowCommand } = require('@aws-sdk/client-iot-data-plane');

const dynamodbClient = new DynamodbClient(new DynamoDBClient({ region: process.env.REGION }));
const iotDataClient = new IoTDataPlaneClient({
    region: process.env.REGION,
    endpoint: 'https://a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com'
});
const stateTableName = process.env.STORAGE_HOMETHERMOSTATDEVICESTATE_NAME;

exports.handler = async function (event, context) {
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
        payload: new TextEncoder().encode(`{"state":{"desired":{"on":${mode === 'ON'}}}}`)
    };

    try {
        await iotDataClient.send(new UpdateThingShadowCommand(params));
        return await handleSuccessfulResponse(event, thingName, mode, recurring, startTime, durationSeconds, executionArn);
    } catch (err) {
        console.log(err, err.stack);
        throw err;
    }
}

async function handleSuccessfulResponse(event, thingName, mode, recurring, startTime, durationSeconds, executionArn) {
    const statusOptions = buildStatusOptions(mode, durationSeconds, executionArn);

    // Convert mode string to modes constant value
    const modeValue = mode === 'ON' ? modes.ON.val : modes.OFF.val;
    const status = statusHelper.createStatus(thingName, modeValue, statusOptions);

    try {
        await dynamodbClient.insertStatus(stateTableName, status);
        // Return the original event data to pass through the state machine
        return event;
    } catch (error) {
        console.error('Error inserting status:', error);
        throw error;
    }
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
