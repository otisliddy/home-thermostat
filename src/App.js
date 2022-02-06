import React, { Component } from 'react';
import TempDisplay from './component/temp-display';
import Status from './component/status';
import SelectMode from './component/select-mode';
import PreviousActivity from './component/previous-activity';
import ScheduledActivity from './component/scheduled-activity';
import ScheduleModal from './component/schedule-modal';
import AWS from './config/aws-config';
import {
  modes,
  DynamodbClient,
  statusHelper
} from 'home-thermostat-common';
import {
  hoursMinsToSeconds,
  hoursMinsToDate,
  hoursMinsToSecondsFromNow,
  relativeDateAgo
} from './util/time-helper';

/*TODO: 
- convert components to functional componentsx
- Write unit tests for generateAgoString
- Change to AWS.DynamoDB.DocumentClient()
- Copy home-thermostat-common into node_modules
- Move table names to constants
*/

const startScheduleStateChangeLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:homethermostatStartScheduleStateChange-dev';
const cancelRunningWorkflowLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:homethermostatCancelRunningWorkflow-dev';
const stateTableName = 'homethermostat-device-state-dev';
const scheduleTableName = 'homethermostat-scheduled-activity-dev';

const lambda = new AWS.Lambda();
const dynamodbClient = new DynamodbClient(new AWS.DynamoDB());
const iot = new AWS.IotData({ endpoint: 'a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com' })

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

  /**
   * Compares the reported status from the Arduino to the status from DynamoDB. If they match, the current state is set
   * and true is returned. If the states don't match or there is an error, false is returned.
   */
  syncStatus() {
    return iot.getThingShadow({ thingName: 'ht-main' }, function (error, data) {
      if (!error) {
        const jsonResponse = JSON.parse(data.payload);
        const reportedMode = jsonResponse.state.reported.on ? modes.ON : modes.OFF;
        const connected = jsonResponse.state.reported.connected;
        this.setState({ connected, status: { ...this.state.status, mode: reportedMode.val } });

        dynamodbClient.getStatuses(relativeDateAgo(180)).then((statuses) => {
          if (statuses.length > 0) {
            this.setState({ statuses: statuses });
            if (statuses[0].mode !== this.state.status.mode) {
              console.log('Mismatch between reported status and DynamoDB');
            }
            return this.setState({ status: statuses[0] });
          }
        });
      } else {
        console.log('Error returned by IOT getThingShadow', error);
        return false;
      }
    }.bind(this));

    // dynamodbClient.getScheduledActivity().then((statuses) => {
    //   this.setState({ scheduledActivity: statuses });
    // });
  }

  handleProfile() {
    this.setState({ status: { mode: modes.PROFILE.val } });
  }

  handleOn(selection) {
    if (typeof selection === 'string' && selection.includes('schedule')) {
      return this.setState({ scheduleModalShow: true, scheduleModalMode: modes.ON });
    }

    console.log('Turning on');
    this.setState({ status: { mode: 'Turning On...' } });

    this.cancelCurrentStatusExecution();

    const params = this.createScheduleStateChangeParams(0, selection);
    lambda.invoke(params, function (error, data) {
      if (!error) {
        const status = statusHelper.createStatus(modes.ON.val, { duration: selection, executionArn: data.Payload });
        console.log('statusw', status);
        this.setState({ status: status });
      } else {
        alert('Let Otis know that error 15 occurred');
      }
    }.bind(this));
  }

  handleOff() {
    console.log('Turning off', this.state.status);
    this.setState({ status: { mode: 'Turning Off...' } });

    this.cancelCurrentStatusExecution();

    const params = { thingName: 'ht-main', payload: `{"state":{"desired":{"on":false}}}}` };

    iot.updateThingShadow(params, function (err, data) {
      if (err) console.log(err, err.stack);
      else {
        const status = statusHelper.createStatus(modes.OFF.val);
        this.persistStatus(status);
      }
    }.bind(this));

  }

  handleScheduleConfirm(startTime, duration) {
    this.setState({ scheduleModalShow: false });

    const params = this.createScheduleStateChangeParams(hoursMinsToSecondsFromNow(startTime), hoursMinsToSeconds(duration));
    lambda.invoke(params, function (error, data) {
      if (!error) {
        const options = {
          duration: hoursMinsToSeconds(duration),
          executionArn: data.Payload
        };
        const status = statusHelper.createStatus(this.state.scheduleModalMode.val, options, hoursMinsToDate(startTime));
        dynamodbClient.insertStatus(scheduleTableName, status).then(() => {
          this.syncStatus();
        });
      } else {
        alert('Let Otis know that error 16 occurred');
      }
    }.bind(this));
  }

  createScheduleStateChangeParams(startSecondsFromNow, durationSeconds) {
    const stateChange = { waitSeconds: startSecondsFromNow, mode: this.state.scheduleModalMode.val };
    const payload = {
      stateMachineInput: [],
      cancelExisting: false
    };
    payload.stateMachineInput.push(stateChange);
    payload.stateMachineInput.push({ waitSeconds: durationSeconds, mode: modes.OFF.val });

    const params = {
      FunctionName: startScheduleStateChangeLambdaArn,
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

  handleScheduleDelete(status) {
    this.cancelExecution(status.executionArn).then(() => {
      dynamodbClient.delete(scheduleTableName, status.since)
      .then(() => {
        this.syncStatus();
      });
    });
  }

  cancelExecution(executionArn) {
    const params = {
      FunctionName: cancelRunningWorkflowLambdaArn,
      Payload: JSON.stringify({ executionArn: executionArn })
    };
    return lambda.invoke(params, function (error, data) {
      if (!error) {
        console.log('Cancelled existing heating change');
      } else console.log(error);
    });
  }

  persistStatus(status) {
    dynamodbClient.insertStatus(stateTableName, status).then(() => {
      this.setState({ status: status });
      this.syncStatus();
    });
  }

  cancelCurrentStatusExecution() {
    console.log('latest arn', this.state.status);
    if (this.state.status.executionArn) {
      this.cancelExecution(this.state.status.executionArn, () => { })
    }
  }

  render() {
    return (
      <div>
        <div disabled={this.state.scheduleModalShow}>
          <TempDisplay />
          <Status status={this.state.status} connected={this.state.connected} />
          <SelectMode currentMode={this.state.status.mode}
            handleOn={this.handleOn.bind(this)}
            handleOff={this.handleOff.bind(this)}
            handleProfile={this.handleProfile.bind(this)} />
          <ScheduledActivity statuses={this.state.scheduledActivity}
            handleDelete={this.handleScheduleDelete.bind(this)} />
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
