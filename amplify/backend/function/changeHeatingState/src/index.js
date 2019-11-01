/* Amplify Params - DO NOT EDIT
You can access the following resource attributes as environment variables from your Lambda function
var environment = process.env.ENV
var region = process.env.REGION

Amplify Params - DO NOT EDIT */

const { Client } = require('node-rest-client');
const client = new Client();
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';


exports.handler = function (event, context) {
  const action = event.action;
  console.log(`Action = ${action}`);

  if (action !== null) {
    thingSpeak(thingSpeakModeWriteUrl + action, (response) => context.done(null, 'Successfully changed state ' + response) );
  }
};

function thingSpeak(url, callback) {
  getWithRetry(url, callback, 40);
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
