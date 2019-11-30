const { modes, dynamodbClient, statusHelper } = require('./home-thermostat-common');
const Client = require('node-rest-client').Client;

const client = new Client();
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';
const thingSpeakControlTempUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=2&field3=';

exports.handler = function (event, context) {
  console.log('Payload: ', event);
  const action = event.action;

  if (action === modes.OFF.ordinal || action === modes.ON.ordinal) {
    thingSpeak(thingSpeakModeWriteUrl + action, (res) => {
      if (action === modes.OFF.ordinal) {
        const status = statusHelper.createStatus(modes.OFF);
        dynamodbClient.insertStatus(status)
          .then(() => context.done(null, 'Turned off successfully ' + res));
      } else {
        const status = statusHelper.createStatus(modes.ON, { timeSeconds: event.waitSeconds });
        dynamodbClient.insertStatus(status)
          .then(() => context.done(null, 'Turned on successfully ' + res));
      }
    });
  } else if (action === modes.FIXED_TEMP.ordinal) {
    thingSpeak(thingSpeakControlTempUrl + event.temp, (res) => {
      const status = statusHelper.createStatus(modes.FIXED_TEMP, { fixedTemp: event.temp });
      dynamodbClient.insertStatus(status)
        .then(() => context.done(null, 'Changed fixed temp successfully ' + res));
    });
  }
}

function thingSpeak(url, callback) {
  getWithRetry(url, callback, 60);
}

function getWithRetry(url, callback, maxRetries) {
  return new Promise(function (resolve, reject) {
    client.get(url, async (data, res) => {
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
