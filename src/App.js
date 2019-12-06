import React, { Component } from 'react';
import TempDisplay from './component/temp-display';
import Status from './component/status';
import SelectMode from './component/select-mode';
import RecentActivity from './component/recent-activity';
import thingSpeak from './util/rest-handler';
import { modes, DynamodbClient, AWS, statusHelper } from 'home-thermostat-common';

/*TODO: - convert components to functional components
- Write unit tests for generateAgoString
- Migrate to AWS IoT
*/

const thingSpeakModeUrl = 'https://api.thingspeak.com/channels/879596/fields/2/last.json';
const thingSpeakControlTempUrl = 'https://api.thingspeak.com/channels/879596/fields/3/last.json';
const thingSpeakModeWriteUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=';
const thingSpeakWriteControlTempUrl = 'https://api.thingspeak.com/update?api_key=QERCNNZO451W8OA3&field2=2&field3=';

// Have to use a proxyLambda because can't invoke StepFunctions directly: https://forums.aws.amazon.com/thread.jspa?threadID=248225
const initiateWorkflowLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:initiate-home-thermostat-state-machine-test';

const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
const dynamodbClient = new DynamodbClient();

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { status: { mode: 'Loading...' } };
  }

  componentDidMount() {
    this.syncStatus();
  }

  syncStatus() {
    dynamodbClient.scan().then((statuses) => {
      if (statuses.length === 0) {
        return this.setState({ status: { mode: modes.OFF.val } });
      }

      this.setState({ status: statuses[0], statuses: statuses });

      thingSpeak(thingSpeakModeUrl, (res) => {
        const fieldVal = res.field2
        const mode = modes[Object.keys(modes).find(key => modes[key].ordinal === fieldVal)];

        if (mode.val !== statuses[0].mode) {
          alert('Let Otis know that error 13 occurred');
          this.setState({ status: { mode: mode.val } });
          if (mode === modes.FIXED_TEMP) {
            thingSpeak(thingSpeakControlTempUrl, (res) => {
              this.setState({ status: { fixedTemp: res.field3 } });
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
    this.setState({status: {mode:'Changing to Fixed Temp...'}})
    
    const temp = selectedTemp[0].value;
    thingSpeak(thingSpeakWriteControlTempUrl + modes.FIXED_TEMP.ordinal, () => {
      const status = statusHelper.createStatus(modes.FIXED_TEMP, { fixedTemp: temp });
      dynamodbClient.insertStatus(status).then(() => {
        this.setState({ status: status });
        this.syncStatus();
      });
    });
  }

  handleOn(selectedDuration) {
    console.log('Turning on');
    this.setState({status: {mode:'Turning Off...'}})
    
    const timeSeconds = selectedDuration[0].value;
    var params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: `{"waitSeconds": "${timeSeconds}", "action": "${modes.OFF.ordinal}"}`
    };

    this.setState({ status: { mode: 'Turning On...' } });
    lambda.invoke(params, function (error) {
      if (!error) {
        thingSpeak(thingSpeakModeWriteUrl + modes.ON.ordinal, () => {
          const status = statusHelper.createStatus(modes.ON, { timeSeconds: timeSeconds });
          dynamodbClient.insertStatus(status).then(() => {
            this.setState({ status: status });
            this.syncStatus();
          });
        });
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  handleOff() {
    console.log('Turning off');
    this.setState({status: {mode:'Turning Off...'}})
    
    thingSpeak(thingSpeakModeWriteUrl + modes.OFF.ordinal, () => {
      const status = statusHelper.createStatus(modes.OFF);
      dynamodbClient.insertStatus(status).then(() => {
        this.setState({ status: status });
        this.syncStatus();
      });
    });
  }

  render() {
    return (
      <div>
        <TempDisplay />
        <br />
        <Status status={this.state.status} />
        <SelectMode currentMode={this.state.status.mode}
          handleOn={this.handleOn.bind(this)}
          handleOff={this.handleOff.bind(this)}
          handleFixedTemp={this.handleFixedTemp.bind(this)}
          handleSchedule={this.handleSchedule.bind(this)} />
        <br />
        <br />
        <RecentActivity statuses={this.state.statuses} />
      </div>
    );
  }
}

export default App;
