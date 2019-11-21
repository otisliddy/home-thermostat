/* Amplify Params - DO NOT EDIT
You can access the following resource attributes as environment variables from your Lambda function
var environment = process.env.ENV
var region = process.env.REGION

Amplify Params - DO NOT EDIT */

const Client = require('node-rest-client').Client;
const client = new Client();
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';
const thingSpeakControlTempUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=2&field3=';

exports.handler = function (event, context) {
  console.log('Payload: ', event);
  const action = event.action;

  if (action === '0' || action === '1') {
    thingSpeak(thingSpeakModeWriteUrl + action, (res) => context.done(null, 'Changed mode successfully') );
  } else if (action === '2') {
    thingSpeak(thingSpeakControlTempUrl + event.temp, (res) => context.done(null, 'Changed fixed temp successfully' + res));
  }
}

function thingSpeak(url, callback) {
  getWithRetry(url, callback, 60);
}

function getWithRetry(url, callback, n) {
  return new Promise(function (resolve, reject) {
    client.get(url, async (data, res) => {
      if (String(data) !== '0') {
        callback(data);
        resolve(data);
      } else {
        if (n === 1) return reject('Max retries reached');
        await sleep(1000);
        getWithRetry(url, callback, n - 1);
      }
    });
  });
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
