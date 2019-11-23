import React, { Component } from 'react';
import AWS from 'aws-sdk';
import TempDisplay from './component/temp-display';
import Status from './component/status';
import SelectMode from './component/select-mode';
import thingSpeak from './rest/rest-handler';


/*TODO: - convert components to functional components
- convert text modes to images
- create state machine through amplify
- create enum for modes
- auto-fill durationOptions
*/

const thingSpeakModeUrl = 'https://api.thingspeak.com/channels/879596/fields/2/last.json';
const thingSpeakControlTempUrl = 'https://api.thingspeak.com/channels/879596/fields/3/last.json';
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';

// Have to use a proxyLambda because can't invoke StepFunctions directly: https://forums.aws.amazon.com/thread.jspa?threadID=248225
const initiateWorkflowLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:initiate-home-thermostat-state-machine-test';
const identityPoolId = 'eu-west-1:12319816-c5b9-4593-8dae-129cfab87abf';
AWS.config.region = 'eu-west-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: identityPoolId,
});
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { status: { mode: 'Loading...' } };
  }

  componentDidMount() {
    thingSpeak(thingSpeakModeUrl, (res) => {
      const fieldVal = res.field2
      const mode = fieldVal === '0' ? 'Off' : fieldVal === '1' ? 'On' : 'Fixed Temp';
      this.setState({ status: { mode: mode } });
      if (mode === 'Fixed Temp') {
        console.log('otis');
        thingSpeak(thingSpeakControlTempUrl, (res) => {
          console.log(res.field3);
          this.setState({ status: { mode: mode, fixedTemp: res.field3 } });
        })
      }
    });
  }

  handleSchedule() {
    this.setState({ status: { mode: 'Schedule' } });
  }

  handleFixedTemp(selectedTemp) {
    console.log('Changing to fixed temp');
    const temp = selectedTemp[0].value;
    var params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: `{"waitSeconds": "0", "action": "2", "temp": "${temp}"}` //TODO use json.stringify
    };

    this.setState({ status: { mode: 'Setting fixed temp...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        this.setState({ status: { mode: 'Fixed Temp' , fixedTemp: temp} });
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
      Payload: `{"waitSeconds": "${timeSeconds}", "action": "0"}` //TODO use json.stringify
    };

    this.setState({ status: { mode: 'Turning on...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        const since = new Date();
        const until = new Date(since.getTime());
        until.setSeconds(until.getSeconds() + timeSeconds);
        thingSpeak(thingSpeakModeWriteUrl + '1', () => this.setState({
          status: {
            mode: 'On',
            since: since,
            until: until
          }
        }));
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  handleOff() {
    console.log('Turning off');
    var params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: `{"waitSeconds": "0", "action": "0"}` //TODO use json.stringify
    };

    this.setState({ status: { mode: 'Turning off...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        this.setState({ status: { mode: 'Off' } });
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  render() {
    //<Status status={this.state.status} />
    return (
      <div>
        <TempDisplay />
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
