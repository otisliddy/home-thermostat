const { modes, DynamodbClient, statusHelper } = require('./home-thermostat-common');
const Client = require('node-rest-client').Client;

const restClient = new Client();
const dynamodbClient = new DynamodbClient();
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';
const thingSpeakControlTempUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=2&field3=';

exports.handler = function (event, context) {
  console.log('Payload: ', event);
  const action = event.stateChanges[0].action;

  const workflowStatus = buildWofkflowStatus(event);

  if (action === modes.OFF.ordinal || action === modes.ON.ordinal) {
    thingSpeak(thingSpeakModeWriteUrl + action, (res) => {
      if (action === modes.OFF.ordinal) {
        const status = statusHelper.createStatus(modes.OFF);
        dynamodbClient.insertStatus(status)
          .then(() => context.done(null, workflowStatus));
      } else {
        const status = statusHelper.createStatus(modes.ON, { duration: event.waitSeconds });
        dynamodbClient.insertStatus(status)
          .then(() => context.done(null, workflowStatus));
      }
    });
  } else if (action === modes.FIXED_TEMP.ordinal) {
    thingSpeak(thingSpeakControlTempUrl + event.temp, (res) => {
      const status = statusHelper.createStatus(modes.FIXED_TEMP, { fixedTemp: event.temp });
      dynamodbClient.insertStatus(status)
        .then(() => context.done(null, workflowStatus));
    });
  }


}

function buildWofkflowStatus(event) {
  event.stateChanges.splice(0, 1);

  const continueWorkflow = event.stateChanges.length > 0;
  
  //on the off-chance something is amiss, wait a long time so to not go through costly state changes
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
