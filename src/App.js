import React, { Component } from 'react';
import AWS from 'aws-sdk';
import TempDisplay from './component/temp-display';
import Status from './component/status';
import SelectMode from './component/select-mode';
import thingSpeak from './rest/rest-handler';
import modes from './constants/constants';

/*TODO: - convert components to functional components
- convert text modes to images
- create enum for modes
- auto-fill durationOptions
- Write unit tests for generateAgoString
- Create fallback structure when getting status from thingspeak
*/

const thingSpeakModeUrl = 'https://api.thingspeak.com/channels/879596/fields/2/last.json';
const thingSpeakControlTempUrl = 'https://api.thingspeak.com/channels/879596/fields/3/last.json';
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';

// Have to use a proxyLambda because can't invoke StepFunctions directly: https://forums.aws.amazon.com/thread.jspa?threadID=248225
const initiateWorkflowLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:initiate-home-thermostat-state-machine-test';
const stateDynamoTable = 'thermostatState-test';

const identityPoolId = 'eu-west-1:12319816-c5b9-4593-8dae-129cfab87abf';
AWS.config.region = 'eu-west-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: identityPoolId,
});
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
const dynamodb = new AWS.DynamoDB();



class App extends Component {
  constructor(props) {
    super(props);
    this.state = { status: { mode: 'Loading...' } };
  }

  componentDidMount() {
    const params = {
      TableName: stateDynamoTable
    }

    dynamodb.scan(params, (err, data) => {
      if (err) {
        console.error(err, err.stack);
      } else {
        const items = data.Items;
        const itemsSorted = items.sort((a, b) => (a.since.N < b.since.N) ? 1 : -1);
        this.setState({ status: dynamoItemToStatus(itemsSorted[0]) });

        thingSpeak(thingSpeakModeUrl, (res) => {
          const fieldVal = res.field2
          const mode = fieldVal === '0' ? 'Off' : fieldVal === '1' ? 'On' : 'Fixed Temp';

          if (mode !== this.state.status.mode) {
            alert('Let Otis know that error 13 occurred');
            this.setState({ status: { mode: mode } });
            if (mode === 'Fixed Temp') {
              thingSpeak(thingSpeakControlTempUrl, (res) => {
                console.log(res.field3);
                this.setState({ status: { mode: mode, fixedTemp: res.field3 } });
              })
            }
          }
        });

      }
    });
  }

  handleSchedule() {
    this.setState({ status: { mode: modes.SCHEDULE.val } });
  }

  handleFixedTemp(selectedTemp) {
    console.log('Changing to fixed temp');
    const temp = selectedTemp[0].value;
    var params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: `{"waitSeconds": "0", "action": "${modes.FIXED_TEMP.ordinal}", "temp": "${temp}"}` //TODO use json.stringify
    };

    this.setState({ status: { mode: 'Setting fixed temp...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        this.updateStatus(modes.FIXED_TEMP.val, { fixedTemp: temp });
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  handleOn(selectedDuration) {
    console.log('Turning on');
    const timeSeconds = selectedDuration[0].value;
    var params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: `{"waitSeconds": "${timeSeconds}", "action": "${modes.OFF.ordinal}"}`
    };

    this.setState({ status: { mode: 'Turning on...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        thingSpeak(thingSpeakModeWriteUrl + '1', () => this.updateStatus(modes.ON.val, { timeSeconds: timeSeconds }));
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  handleOff() {
    console.log('Turning off');
    this.updateStatus(modes.OFF.val, { timeSeconds: 900 });
    var params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: `{"waitSeconds": "0", "action": "${modes.OFF.ordinal}"}`
    };

    this.setState({ status: { mode: 'Turning off...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        this.updateStatus(modes.OFF.val);
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  updateStatus(mode, options) {
    const status = { mode: mode };
    status.since = new Date().getTime();

    if (options && options.timeSeconds) {
      const until = new Date(status.since);
      until.setSeconds(until.getSeconds() + options.timeSeconds);
      status.until = until.getTime();
    }

    if (options && options.fixedTemp) {
      status.fixedTemp = options.fixedTemp;
    }

    this.setState({ status: status });
    insertStatus(status);
  }

  render() {
    return (
      <div>
        <TempDisplay />
        <Status status={this.state.status} />
        <SelectMode currentMode={this.state.status.mode}
          handleOn={this.handleOn.bind(this)}
          handleOff={this.handleOff.bind(this)}
          handleFixedTemp={this.handleFixedTemp.bind(this)}
          handleSchedule={this.handleSchedule.bind(this)} />
      </div>
    );
  }
}

function insertStatus(status) {
  const params = {
    TableName: stateDynamoTable,
    Item: statusToDynamoItem(status),
  };

  dynamodb.putItem(params, (err, data) => {
    if (err) {
      alert('Let otis know that error 14 occurred')
      console.error("Unable to add. Error JSON:", JSON.stringify(err, null, 2));
    }
  });

}

function dynamoItemToStatus(dynamoItem) {
  const status = {};
  for (const key in dynamoItem) {
    if (dynamoItem.hasOwnProperty(key)) {
      if (dynamoItem[key].N) {
        status[key] = parseInt(dynamoItem[key]['N']);
      } else {
        status[key] = dynamoItem[key]['S'];
      }
    }
  }
  return status;
}

function statusToDynamoItem(status) {
  const item = {};
  for (const key in status) {
    if (status.hasOwnProperty(key)) {
      if (isNaN(status[key])) {
        item[key] = { S: status[key] }
      } else {
        item[key] = { N: status[key].toString() }
      }
    }
  }
  return item;
}

export default App;
