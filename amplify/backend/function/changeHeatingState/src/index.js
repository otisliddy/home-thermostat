const { modes, fromOrdinal, DynamodbClient, statusHelper } = require('./home-thermostat-common');
const Client = require('node-rest-client').Client;
const AWS = require('aws-sdk');
AWS.config.region = 'eu-west-1';

const restClient = new Client();
const dynamodbClient = new DynamodbClient(new AWS.DynamoDB());
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';
const thingSpeakControlTempUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=2&field3=';
const stateTableName = 'thermostatState-test';

exports.handler = function (event, context) {
  console.log('Payload: ', event);
  const mode = event.stateChanges[0].mode;

  if (mode === modes.OFF.ordinal || mode === modes.ON.ordinal) {
    thingSpeak(thingSpeakModeWriteUrl + mode, (res) => {
      handleSuccessfulResponse(event, mode, context);
    });
  } else if (mode === modes.FIXED_TEMP.ordinal) {
    thingSpeak(thingSpeakControlTempUrl + event.stateChanges[0].temp, (res) => {
      handleSuccessfulResponse(event, mode, context);
    })
  };
}

function handleSuccessfulResponse(event, mode, context) {
  const statusOptions = buildStatusOptions(event, mode);
  const workflowStatus = buildWofkflowStatus(event);

  const status = statusHelper.createStatus(fromOrdinal(mode), statusOptions);
  dynamodbClient.insertStatus(stateTableName, status)
    .then(() => context.done(null, workflowStatus));
}

function buildStatusOptions(event, mode) {
  const statusOptions = {};
  if (event.stateChanges.length > 1 && event.stateChanges[1].waitSeconds) {
    statusOptions.duration = event.stateChanges[1].waitSeconds;
  }
  if (mode === modes.FIXED_TEMP.ordinal) {
    statusOptions.temp = event.stateChanges[0].temp;
  }
  return statusOptions;
}

function buildWofkflowStatus(event) {
  event.stateChanges.splice(0, 1);
  const continueWorkflow = event.stateChanges.length > 0;
  const workflowStatus = {
    stateChanges: event.stateChanges,
    continueWorkflow: continueWorkflow
  };

  return workflowStatus;
}

function thingSpeak(url, callback) {
  getWithRetry(url, callback, 60);
}

function getWithRetry(url, callback, maxRetries) {
  return new Promise(function (resolve, reject) {
    restClient.get(url, async (data, res) => {
      if (String(data) !== '0') {
        callback(data);
        resolve(data);
      } else {
        if (maxRetries === 1) return reject('Max retries reached');
        await sleep(1000);
        getWithRetry(url, callback, maxRetries - 1);
      }
    });
  });
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
