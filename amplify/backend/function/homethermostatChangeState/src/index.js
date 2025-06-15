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
    const params = { thingName:  event.heatingChanges[0].thingName, payload: `{"state":{"desired":{"on":${mode === modes.ON.val}}}}` };

    iotData.updateThingShadow(params, function (err, data) {
        if (err) {
            console.log(err, err.stack);
        }
        else {
            handleSuccessfulResponse(event, mode, context);
        }
    });
}

function handleSuccessfulResponse(event, mode, context) {
    const statusOptions = buildStatusOptions(event);

    const status = statusHelper.createStatus(mode, statusOptions); //mode + until
    dynamodbClient.insertStatus(stateTableName, status)
        .then(() => context.done(null, event));
}

function buildStatusOptions(event) {
    const statusOptions = {};
    if (event.heatingChanges.length > 1 && event.heatingChanges[1].waitSeconds) {
        statusOptions.duration = event.heatingChanges[1].waitSeconds;
    }
    statusOptions.executionArn = event.executionArn;
    return statusOptions;
}
