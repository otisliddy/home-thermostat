import React, { Component } from 'react';
import TempDisplay from './component/temp-display';
import Status from './component/status';
import SelectMode from './component/select-mode';
import PreviousActivity from './component/previous-activity';
import ScheduledActivity from './component/scheduled-activity';
import ScheduleModal from './component/schedule-modal';
import thingSpeak from './util/rest-handler';
import AWS from './config/aws-config';

import StepFunctions from 'aws-sdk/clients/stepfunctions';
import {
  modes,
  DynamodbClient,
  StepFunctionsClient,
  statusHelper
} from 'home-thermostat-common';
import {
  hoursMinsToSeconds,
  hoursMinsToDate,
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

const initiateWorkflowLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:initiate-home-thermostat-state-machine-test';
const stateTableName = 'thermostatState-test';
const scheduleTableName = 'scheduledActivity-test';

const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
const dynamodbClient = new DynamodbClient(new AWS.DynamoDB());
const stepFunctionsClient = new StepFunctionsClient(new StepFunctions());

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
    dynamodbClient.scan(scheduleTableName).then((rawStatuses) => {
      const statuses = [];
      rawStatuses.forEach(status => {
        statuses.push(statusHelper.dynamoItemToStatus(status));
      });
      this.setState({ scheduledActivity: statuses });
    });

    dynamodbClient.scan(stateTableName).then((statusesRaw) => {
      const statusesSorted = statusesRaw.sort((a, b) => (parseInt(a.since.N) < parseInt(b.since.N)) ? 1 : -1);
      const statuses = statusHelper.findStatusesConsideringDuplicates(statusesSorted);

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

    thingSpeak(thingSpeakWriteControlTempUrl + selection, () => {
      const status = statusHelper.createStatus(modes.FIXED_TEMP, { temp: selection });
      this.persistStatus(status);
    });
  }

  handleOn(selection) {
    if (typeof selection === 'string' && selection.includes('schedule')) {
      return this.setState({ scheduleModalShow: true, scheduleModalMode: modes.ON });
    }
    const duration = selection;

    console.log('Turning on');
    this.setState({ status: { mode: 'Turning On...' } })

    const params = this.createInitiateWorkflowParams(0, selection);
    lambda.invoke(params, function (error) {
      if (!error) {
        thingSpeak(thingSpeakModeWriteUrl + modes.ON.ordinal, () => {
          const status = statusHelper.createStatus(modes.ON, { duration: duration });
          this.persistStatus(status);
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
      this.persistStatus(status);
    });
  }

  handleScheduleConfirm(startTime, duration, temp) {
    this.setState({ scheduleModalShow: false });

    const params = this.createInitiateWorkflowParams(hoursMinsToSecondsFromNow(startTime), hoursMinsToSeconds(duration), temp);
    lambda.invoke(params, function (error) {
      if (!error) {
        const options = { duration: hoursMinsToSeconds(duration) };
        if (this.state.scheduleModalMode === modes.FIXED_TEMP) {
          options.temp = temp;
        }
        const status = statusHelper.createStatus(this.state.scheduleModalMode, options, hoursMinsToDate(startTime));
        dynamodbClient.insertStatus(scheduleTableName, status).then(() => {
          this.syncStatus();
          console.log('Scheduled successfully');
        });
      } else {
        alert('Let Otis know that error 16 occurred');
      }
    }.bind(this));
  }

  createInitiateWorkflowParams(startSecondsFromNow, durationSeconds, temp) {
    const stateChange = { waitSeconds: startSecondsFromNow, mode: this.state.scheduleModalMode.ordinal };
    if (this.state.scheduleModalMode === modes.FIXED_TEMP) {
      stateChange.temp = temp;
    }

    const payload = {
      workflowInput: {
        stateChanges: []
      },
      cancelExisting: false
    };
    payload.workflowInput.stateChanges.push(stateChange);
    payload.workflowInput.stateChanges.push({ waitSeconds: durationSeconds, mode: modes.OFF.ordinal });

    const params = {
      FunctionName: initiateWorkflowLambdaArn,
      Payload: JSON.stringify(payload)
    };

    return params;
  }

  handleScheduleCancel() {
    this.setState({ scheduleModalShow: false });
  }

  handleScheduleModeChange(changeEvent) {
    const mode = modes[Object.keys(modes).find(key => modes[key].val === changeEvent.target.value)];
    this.setState({ scheduleModalShow: true, scheduleModalMode: mode });
  }

  handleScheduleCancelAll() {
    console.log('otis');
    dynamodbClient.scan(scheduleTableName).then((statuses) => {
      statuses.forEach(status => {
        dynamodbClient.delete(scheduleTableName, statusHelper.dynamoItemToStatus(status).since);
      });
    });
    stepFunctionsClient.stopCurrentExecutions().then(() => {
      this.handleOff();
    });
  }

  persistStatus(status) {
    console.log(status);
    dynamodbClient.insertStatus(stateTableName, status).then(() => {
      this.setState({ status: status });
      this.syncStatus();
    });
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
          <ScheduledActivity statuses={this.state.scheduledActivity}
            handleCancelAll={this.handleScheduleCancelAll.bind(this)} />
          <PreviousActivity statuses={this.state.statuses} />
        </div>
        <ScheduleModal
          show={this.state.scheduleModalShow}
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
