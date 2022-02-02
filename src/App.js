import React, { Component } from 'react';
import TempDisplay from './component/temp-display';
import Status from './component/status';
import SelectMode from './component/select-mode';
import PreviousActivity from './component/previous-activity';
import ScheduledActivity from './component/scheduled-activity';
import ScheduleModal from './component/schedule-modal';
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
const cancelRunningWorfklowsLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:homethermostatCancelRunningWorkflow-test';
const stateTableName = 'homethermostat-device-state-dev';
const scheduleTableName = 'homethermostat-scheduled-activity-dev';

const lambda = new AWS.Lambda(); // TODO { apiVersion: '2015-03-31' }
const dynamodbClient = new DynamodbClient(new AWS.DynamoDB());
const stepFunctionsClient = new StepFunctionsClient(new AWS.StepFunctions());
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

  syncStatus() {
    iot.getThingShadow({ thingName: 'ht-main' }, function (error, data) {
      if (!error) {
        const jsonResponse = JSON.parse(data.payload);
        const reportedMode = jsonResponse.state.reported.on ? modes.ON : modes.OFF;
        this.setState({ status: { mode: reportedMode.val } });

        dynamodbClient.getStatuses(relativeDateAgo(30)).then((statuses) => {
          if (statuses.length > 0 && statuses[0] !== this.state.status) {
            //alert('Let Otis know that error 12 occurred');
            return this.setState({ status: { mode: modes.OFF.val } });
          }
          console.log('statuses', statuses);
          this.setState({ statuses: statuses });
        });
      } else {
        alert('Let Otis know that error 11 occurred');
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
    const duration = selection;

    console.log('Turning on');
    this.setState({ status: { mode: 'Turning On...' } });

    //this.cancelCurrentStatusExecution();

    const params = this.createScheduleStateChangeParams(0, selection);
    lambda.invoke(params, function (error, data) {
      if (!error) {
        console.log('turned on OK', data)
        const status = statusHelper.createStatus(modes.ON, { duration: duration, executionArn: data.Payload });
        this.persistStatus(status);
      } else {
        alert('Let Otis know that error 15 occurred');
      }
    }.bind(this));
  }

  handleOff() {
    console.log('Turning off', this.state.status);
    this.setState({ status: { mode: 'Turning Off...' } });

    //this.cancelCurrentStatusExecution();

    const params = { thingName: 'ht-main', payload: `{"state":{"desired":{"on":false}}}}` };

    iot.updateThingShadow(params, function (err, data) {
      if (err) {
        console.log(err, err.stack);
      }
      else {
        const status = statusHelper.createStatus(modes.OFF);
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
        const status = statusHelper.createStatus(this.state.scheduleModalMode, options, hoursMinsToDate(startTime));
        dynamodbClient.insertStatus(scheduleTableName, status).then(() => {
          console.log('Scheduled successfully');
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
    this.cancelExecution(status.executionArn);
    dynamodbClient.delete(scheduleTableName, status.since)
      .then(() => {
        this.syncStatus();
      });
  }

  cancelExecution(executionArn) {
    stepFunctionsClient.stopRunningExecution(executionArn).then(() => {
      console.log('success');
    });
  }

  persistStatus(status) {
    console.log('status', status);
    dynamodbClient.insertStatus(stateTableName, status).then(() => {
      this.setState({ status: status });
      this.syncStatus();
    });
  }

  cancelCurrentStatusExecution() {
    if (this.state.status.executionArn) {
      this.cancelExecution(this.state.status.executionArn, () => { })
    }
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
