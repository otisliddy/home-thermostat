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
    const mode = event.heatingChanges[0].mode;
    const thingName = event.heatingChanges[0].thingName;
    const recurring = event.heatingChanges[0].recurring;
    const startTime = event.heatingChanges[0].startTime;
    const params = { thingName:  thingName,
        shadowName: thingName + '_shadow',
        payload: `{"state":{"desired":{"on":${mode === modes.ON.val}}}}` };

    iotData.updateThingShadow(params, function (err, data) {
        if (err) {
            console.log(err, err.stack);
        }
        else {
            handleSuccessfulResponse(event, thingName, mode, recurring, startTime, context);
        }
    });
}

function handleSuccessfulResponse(event, thingName, mode, recurring, startTime, context) {
    const statusOptions = buildStatusOptions(event);

    const status = statusHelper.createStatus(thingName, mode, statusOptions); //mode + until

    // Preserve recurring and startTime from the first item in heatingChanges, or from the event itself
    const preservedRecurring = recurring || event.recurring;
    const preservedStartTime = startTime || event.startTime;
    const preservedDurationSeconds = event.durationSeconds || (event.heatingChanges.length > 1 ? event.heatingChanges[1].waitSeconds : undefined);

    // Pass recurring and startTime info back through the state machine
    const response = {
        heatingChanges: event.heatingChanges.slice(1),
        recurring: preservedRecurring,
        startTime: preservedStartTime,
        thingName: thingName,
        waitSeconds: event.heatingChanges[0].waitSeconds,
        durationSeconds: preservedDurationSeconds
    };

    dynamodbClient.insertStatus(stateTableName, status)
        .then(() => context.done(null, response));
}

function buildStatusOptions(event) {
    const statusOptions = {};
    if (event.heatingChanges.length > 1 && event.heatingChanges[1].waitSeconds) {
        statusOptions.duration = event.heatingChanges[1].waitSeconds;
    }
    statusOptions.executionArn = event.executionArn;
    return statusOptions;
}
