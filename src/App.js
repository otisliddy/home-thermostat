import React, { Component } from 'react';
import TempDisplay from './component/temp-display';
import Status from './component/status';
import SelectMode from './component/select-mode';
import RecentActivity from './component/recent-activity';
import ScheduleModal from './component/schedule-modal';
import thingSpeak from './util/rest-handler';
import { modes, DynamodbClient, AWS, statusHelper } from 'home-thermostat-common';
import {
  hoursMinsToSeconds,
  hoursMinsToSecondsFromNow
} from './util/time-helper';

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
    this.state = {
      status: { mode: 'Loading...' },
      scheduleModalShow: false,
      scheduleModalMode: modes.ON
    };
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
              this.setState({ status: { temp: res.field3 } });
            })
          }
        }
      });
    });
  }

  handleProfile() {
    this.setState({ status: { mode: modes.PROFILE.val } });
  }

  handleFixedTemp(selection) {
    if (typeof selection === 'string' && selection.includes('schedule')) {
      return this.setState({ scheduleModalShow: true, scheduleModalMode: modes.FIXED_TEMP });
    }

    console.log('Changing to fixed temp');
    this.setState({ status: { mode: 'Changing to Fixed Temp...' } })
    
    thingSpeak(thingSpeakWriteControlTempUrl + modes.FIXED_TEMP.ordinal, () => {
      const status = statusHelper.createStatus(modes.FIXED_TEMP, { temp: selection });
      dynamodbClient.insertStatus(status).then(() => {
        this.setState({ status: status });
        this.syncStatus();
      });
    });
  }

  handleOn(selection) {
    if (typeof selection === 'string' && selection.includes('schedule')) {
      return this.setState({ scheduleModalShow: true, scheduleModalMode: modes.ON });
    }

    console.log('Turning on');
    this.setState({ status: { mode: 'Turning On...' } })

    const duration = selection;
    const payload = {
      stateChanges: [{ waitSeconds: duration, mode: modes.OFF.ordinal }]
    };
    const params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: JSON.stringify(payload)
    };

    lambda.invoke(params, function (error) {
      if (!error) {
        thingSpeak(thingSpeakModeWriteUrl + modes.ON.ordinal, () => {
          const status = statusHelper.createStatus(modes.ON, { duration: duration });
          dynamodbClient.insertStatus(status).then(() => {
            this.setState({ status: status });
            this.syncStatus();
          });
        });
      } else {
        alert('Let Otis know that error 15 occurred');
      }
    }.bind(this));
  }

  handleOff() {
    console.log('Turning off');
    this.setState({ status: { mode: 'Turning Off...' } })

    thingSpeak(thingSpeakModeWriteUrl + modes.OFF.ordinal, () => {
      const status = statusHelper.createStatus(modes.OFF);
      dynamodbClient.insertStatus(status).then(() => {
        this.setState({ status: status });
        this.syncStatus();
      });
    });
  }

  handleScheduleConfirm(mode, startTime, duration, temp) {
    this.setState({ scheduleModalShow: false });

    const payload = this.createPayload(mode, startTime, duration, temp);

    const params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: JSON.stringify(payload)
    };

    lambda.invoke(params, function (error) {
      if (!error) {
        this.syncStatus();
        console.log('Scheduled successfully');
      } else {
        alert('Let Otis know that error 16 occurred');
      }
    }.bind(this));
  }

  createPayload(startTime, duration, temp) {
    const stateChange = { waitSeconds: hoursMinsToSecondsFromNow(startTime), mode: this.state.scheduleModalMode.ordinal };
    if (this.state.scheduleModalMode === modes.FIXED_TEMP) {
      stateChange.temp = temp;
    }

    const payload = {
      stateChanges: []
    };
    payload.stateChanges.push(stateChange);
    payload.stateChanges.push({ waitSeconds: hoursMinsToSeconds(duration), mode: modes.OFF.ordinal });

    return payload;
  }

  handleScheduleCancel() {
    this.setState({ scheduleModalShow: false });
  }

  handleScheduleModeChange(changeEvent) {
    const mode = modes[Object.keys(modes).find(key => modes[key].val === changeEvent.target.value)];
    this.setState({ scheduleModalShow: true, scheduleModalMode: mode });
  }

  render() {
    return (
      <div>
        <div disabled={this.state.scheduleModalShow}>
          <TempDisplay />
          <Status status={this.state.status} />
          <SelectMode currentMode={this.state.status.mode}
            handleOn={this.handleOn.bind(this)}
            handleOff={this.handleOff.bind(this)}
            handleFixedTemp={this.handleFixedTemp.bind(this)}
            handleProfile={this.handleProfile.bind(this)} />
          <RecentActivity statuses={this.state.statuses} />
        </div>
        <ScheduleModal show={this.state.scheduleModalShow}
          mode={this.state.scheduleModalMode}
          handleModeChange={this.handleScheduleModeChange.bind(this)}
          handleConfirm={this.handleScheduleConfirm.bind(this)}
          handleCancel={this.handleScheduleCancel.bind(this)}
        />
      </div>
    );
  }
}

export default App;
