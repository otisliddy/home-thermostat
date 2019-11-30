import React, { Component } from 'react';
import TempDisplay from './component/temp-display';
import Status from './component/status';
import SelectMode from './component/select-mode';
import thingSpeak from './rest/rest-handler';
import { modes, dynamodbClient, AWS, statusHelper } from 'home-thermostat-common';

/*TODO: - convert components to functional components
- convert text modes to images
- auto-fill durationOptions
- Write unit tests for generateAgoString,findStatusConsideringDuplicates
- Create fallback structure when getting status from thingspeak
- sync status immediately after setting
*/

const thingSpeakModeUrl = 'https://api.thingspeak.com/channels/879596/fields/2/last.json';
const thingSpeakControlTempUrl = 'https://api.thingspeak.com/channels/879596/fields/3/last.json';
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';

// Have to use a proxyLambda because can't invoke StepFunctions directly: https://forums.aws.amazon.com/thread.jspa?threadID=248225
const initiateWorkflowLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:initiate-home-thermostat-state-machine-test';

const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { status: { mode: 'Loading...' } };
  }

  componentDidMount() {

    dynamodbClient.scan().then((status) => {
      this.setState({ status: status });

      thingSpeak(thingSpeakModeUrl, (res) => {
        const fieldVal = res.field2
        const mode = fieldVal === '0' ? 'Off' : fieldVal === '1' ? 'On' : 'Fixed Temp';

        //todo handle "off for at least two weeks"
        if (mode !== status.mode) {
          alert('Let Otis know that error 13 occurred');
          this.setState({ status: { mode: mode } });
          if (mode === 'Fixed Temp') {
            thingSpeak(thingSpeakControlTempUrl, (res) => {
              this.setState({ status: { mode: mode, fixedTemp: res.field3 } });
            })
          }
        }
      });
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
        const status = statusHelper.createStatus(modes.FIXED_TEMP, { fixedTemp: temp });
        this.setState({ status: status });
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
        thingSpeak(thingSpeakModeWriteUrl + '1', () => {
          const status = statusHelper.createStatus(modes.ON, { timeSeconds: timeSeconds });
          this.setState({ status: status });
        });
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  handleOff() {
    console.log('Turning off');
    var params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: `{"waitSeconds": "0", "action": "${modes.OFF.ordinal}"}`
    };

    this.setState({ status: { mode: 'Turning off...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        const status = statusHelper.createStatus(modes.OFF);
        this.setState({ status: status });
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
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

export default App;
