import React, { Component } from 'react';
import TempDisplay from './component/temp-display';
import Status from './component/status';
import SelectMode from './component/select-mode';
import RecentActivity from './component/recent-activity';
import ScheduleModal from './component/schedule-modal';
import thingSpeak from './util/rest-handler';
import { modes, DynamodbClient, AWS, statusHelper } from 'home-thermostat-common';
import { toSeconds, relativeDate, toFormattedDate } from './util/time-helper';

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
      scheduleModal: {
        show: false
      }
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

  handleFixedTemp(selection) {
    if (typeof selection === 'string' && selection.includes('schedule')) {
      return this.setState({ scheduleModal: { show: true, mode: modes.FIXED_TEMP } });
    }

    console.log('Changing to fixed temp');
    this.setState({ status: { mode: 'Changing to Fixed Temp...' } })

    thingSpeak(thingSpeakWriteControlTempUrl + modes.FIXED_TEMP.ordinal, () => {
      const status = statusHelper.createStatus(modes.FIXED_TEMP, { fixedTemp: selection });
      dynamodbClient.insertStatus(status).then(() => {
        this.setState({ status: status });
        this.syncStatus();
      });
    });
  }

  handleOn(selection) {
    if (typeof selection === 'string' && selection.includes('schedule')) {
      return this.setState({ scheduleModal: { show: true, mode: modes.ON } });
    }

    console.log('Turning on');
    this.setState({ status: { mode: 'Turning On...' } })

    const duration = selection;
    const payload = {
      stateChanges: [{ waitSeconds: duration, action: modes.OFF.ordinal }]
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
        console.log(error, error.stack);
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

  handleScheduleConfirm(startTime, duration) {
    this.setState({ scheduleModal: { show: false } });

    const payload = this.createPayload(startTime, duration);

    const params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: JSON.stringify(payload)
    };

    lambda.invoke(params, function (error) {
      if (!error) {
        this.syncStatus();
        console.log('Scheduled successfully');
      } else {
        console.log(error, error.stack);
      }
    }.bind(this));
  }

  createPayload(startTime, duration) {
    const startHour = startTime.split(':')[0];
    const startMinute = startTime.split(':')[1];
    const timeToStart = new Date();
    timeToStart.setHours(startHour);
    timeToStart.setMinutes(startMinute);
    timeToStart.setSeconds(0);
    if (timeToStart.getTime() < new Date().getTime()) {
      timeToStart.setTime(timeToStart.getTime() + 1000 * 3600 * 24);
    }
    let timeToWait = (timeToStart.getTime() - new Date().getTime()) / 1000;
    const durationSeconds = toSeconds(duration);

    const payload = {
      stateChanges: []
    };
    payload.stateChanges.push({ waitSeconds: timeToWait, action: this.state.scheduleModal.mode.ordinal });
    payload.stateChanges.push({ waitSeconds: durationSeconds, action: modes.OFF.ordinal });

    return payload;
  }

  handleScheduleCancel() {
    this.setState({ showSchedule: false });
  }

  render() {
    return (
      <div>
        <TempDisplay />
        <br />
        <Status status={this.state.status} />
        <br /><br />
        <SelectMode currentMode={this.state.status.mode}
          handleOn={this.handleOn.bind(this)}
          handleOff={this.handleOff.bind(this)}
          handleFixedTemp={this.handleFixedTemp.bind(this)}
          handleSchedule={this.handleSchedule.bind(this)} />
        <br /><br />
        <RecentActivity statuses={this.state.statuses} />

        <ScheduleModal show={this.state.scheduleModal.show}
          handleConfirm={this.handleScheduleConfirm.bind(this)}
          handleCancel={this.handleScheduleCancel.bind(this)}
        />
      </div>
    );
  }
}

export default App;
