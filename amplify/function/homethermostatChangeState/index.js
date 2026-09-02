/* Amplify Params - DO NOT EDIT *//* Amplify Params - DO NOT EDIT
    ENV
    REGION
    STORAGE_HOMETHERMOSTATDEVICESTATE_ARN
    STORAGE_HOMETHERMOSTATDEVICESTATE_NAME
    STORAGE_HOMETHERMOSTATDEVICESTATE_STREAMARN
Amplify Params - DO NOT EDIT */

import { modes, DynamodbClient, statusHelper } from 'home-thermostat-common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { IoTDataPlaneClient, UpdateThingShadowCommand } from '@aws-sdk/client-iot-data-plane';

const dynamodbClient = new DynamodbClient(new DynamoDBClient({ region: process.env.REGION }));
const iotDataClient = new IoTDataPlaneClient({
    region: process.env.REGION,
    endpoint: 'https://a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com'
});
const stateTableName = process.env.STORAGE_HOMETHERMOSTATDEVICESTATE_NAME;

export const handler = async (event, context) => {
    console.log('Payload: ', event);

    // Extract parameters from the new simplified structure
    const mode = event.mode; // 'ON' or 'OFF'
    const thingName = event.thingName;
    // todo recurring and startTime aren't used. Can they be omitted from this state machine task params without messing up rest of state machine?
    const recurring = event.recurring;
    const startTime = event.startTime;
    const durationSeconds = event.durationSeconds;
    const executionArn = event.executionArn;
    const end = event.end;

    // Update the thing shadow
    const params = {
        thingName: thingName,
        shadowName: thingName + '_shadow',
        payload: new TextEncoder().encode(`{"state":{"desired":{"on":${mode === 'ON'}}}}`)
    };

    try {
        await iotDataClient.send(new UpdateThingShadowCommand(params));
        return await handleSuccessfulResponse(event, thingName, mode, recurring, startTime, durationSeconds, executionArn, end);
    } catch (err) {
        console.log(err, err.stack);
        throw err;
    }
}

async function handleSuccessfulResponse(event, thingName, mode, recurring, startTime, durationSeconds, executionArn, end) {
    const statusOptions = buildStatusOptions(mode, durationSeconds, executionArn, end);

    // Convert mode string to modes constant value
    const modeValue = mode === 'ON' ? modes.ON.val : modes.OFF.val;
    const status = statusHelper.createStatus(thingName, modeValue, statusOptions);

    try {
        await dynamodbClient.insertStatus(stateTableName, status);

        // Return event with until timestamp (timestamp when heating was turned off)
        return {
            ...event,
            until: Math.floor(Date.now() / 1000)
        };
    } catch (error) {
        console.error('Error inserting status:', error);
        throw error;
    }
}

function buildStatusOptions(mode, durationSeconds, executionArn, end) {
    const statusOptions = {};

    // Only add duration if we're turning ON and have a duration
    if (mode === 'ON' && durationSeconds) {
        statusOptions.duration = durationSeconds;
    }

    if (executionArn) {
        statusOptions.executionArn = executionArn;
    }

    if (mode === 'OFF' && end) {
        if (end.endReason) {
            statusOptions.endReason = end.endReason;
        }
        if (end.endTemperature !== undefined && end.endTemperature !== null) {
            statusOptions.endTemperature = end.endTemperature;
        }
    }

    return statusOptions;
}
