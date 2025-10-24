import React, {useEffect, useState} from 'react';
import {InvokeCommand, LambdaClient} from '@aws-sdk/client-lambda';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {GetThingShadowCommand, IoTDataPlaneClient, UpdateThingShadowCommand} from '@aws-sdk/client-iot-data-plane';
import {DynamodbClient, modes, statusHelper, StepFunctionsClient} from 'home-thermostat-common';
import {Amplify} from 'aws-amplify';
import {Hub} from '@aws-amplify/core';
import {Authenticator} from '@aws-amplify/ui-react';
import {fetchAuthSession} from 'aws-amplify/auth';
import {SFNClient} from '@aws-sdk/client-sfn';

// New components
import NewHeader from './component/new-header';
import TimelineChart from './component/timeline-chart';
import DhwGraphModal from './component/dhw-graph-modal';
import DeviceCard from './component/device-card';
import HistoryStats from './component/history-stats';
import ScheduleModal from './component/schedule-modal';

import './App.css';
import '@aws-amplify/ui-react/styles.css';
import {hoursMinsToISOString} from "./util/time-helper";

const identityPoolId = 'eu-west-1:a2b980af-483f-41fb-ab4a-fcfef938015a';
Amplify.configure({
  Auth: {
    Cognito: {
      identityPoolId: identityPoolId,
      userPoolId: 'eu-west-1_kaR3nNFXA',
      userPoolClientId: 'pj9peastf76fjjhm1cl1jumpf',
      signUpVerificationMethod: 'link'
    }
  }
});

const startScheduleStateChangeLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:homethermostatStartScheduleStateChange-dev';
const temperatureStateChangeStateMachineArn = 'arn:aws:states:eu-west-1:056402289766:stateMachine:temperature-heating-change';
const stateTableName = 'homethermostat-device-state-dev';
const scheduleTableName = 'homethermostat-scheduled-activity-dev';
const temperatureTableName = 'homethermostat-temperature-dev';
let lambda, dynamodbClient, stepFunctionsClient, iotData;

const App = () => {
  const [status, setStatus] = useState({mode: 'Loading...'});
  const [scheduleModalShow, setScheduleModalShow] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null); // For schedule modal
  const [connected, setConnected] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [scheduledActivity, setScheduledActivity] = useState([]);
  const [dhwTemperature, setDhwTemperature] = useState(null);
  const [showDhwGraph, setShowDhwGraph] = useState(false);
  const [outsideTemp, setOutsideTemp] = useState(null);
  const [selectedStatsDevice, setSelectedStatsDevice] = useState(null);

  // Device-specific statuses
  const [oilStatus, setOilStatus] = useState({mode: 'Loading...'});
  const [immersionStatus, setImmersionStatus] = useState({mode: 'Loading...'});

  Hub.listen('auth', async (data) => {
    if ('signIn' === data.payload.event) {
      await setUserAndSyncStatus();
    }
  });

  useEffect(() => {
    fetchAuthSession().then(creds => {
      setUserAndSyncStatus();
    });
    fetchOutsideTemperature();
  }, []);

  async function fetchOutsideTemperature() {
    try {
      const weatherApiUrl = 'https://api.openweathermap.org/data/2.5/weather?lat=52.9807857&lon=-6.046806&appid=5796abbde9106b7da4febfae8c44c232';
      const response = await fetch(weatherApiUrl);
      const data = await response.json();
      const tempCelsius = Math.round((data.main.temp - 273.15) * 2) / 2;
      setOutsideTemp(tempCelsius);
    } catch (error) {
      console.error('Error fetching outside temperature:', error);
    }
  }

  async function setUserAndSyncStatus() {
    try {
      const session = await fetchAuthSession();
      if (!session.credentials) throw new Error('No credentials available');
      const {accessKeyId, secretAccessKey, sessionToken} = session.credentials;
      const awsCredentials = {
        accessKeyId,
        secretAccessKey,
        sessionToken
      };

      lambda = new LambdaClient({
        region: 'eu-west-1',
        credentials: awsCredentials
      });
      dynamodbClient = new DynamodbClient(new DynamoDBClient({
        region: 'eu-west-1',
        credentials: awsCredentials
      }));
      stepFunctionsClient = new StepFunctionsClient(new SFNClient({
        region: 'eu-west-1',
        credentials: awsCredentials
      }));
      iotData = new IoTDataPlaneClient({
        region: 'eu-west-1',
        endpoint: 'https://a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com',
        credentials: awsCredentials
      });

      await syncAllStatuses();
    } catch (error) {
      console.log(error);
    }
  }

  async function syncAllStatuses() {
    await Promise.all([
      syncDeviceStatus('ht-main', setOilStatus),
      syncDeviceStatus('ht-immersion', setImmersionStatus),
      fetchDhwTemperature(),
      fetchTimelineAndScheduledActivity(),
      fetchHistoricalStatuses()
    ]);
  }

  async function syncDeviceStatus(device, setDeviceStatus) {
    try {
      const command = new GetThingShadowCommand({thingName: device, shadowName: device + '_shadow'});
      const data = await iotData.send(command);
      const payloadString = new TextDecoder().decode(data.payload);
      const jsonResponse = JSON.parse(payloadString);
      const reportedMode = jsonResponse.state.reported.on ? modes.ON : modes.OFF;
      const connected = jsonResponse.state.reported.connected;

      if (device === 'ht-main') {
        setConnected(connected);
      }

      // Initial status from IoT Shadow
      setDeviceStatus({mode: reportedMode.val, device: device});
    } catch (error) {
      console.error(`Error syncing status for ${device}:`, error);
      setDeviceStatus({mode: 'Error', device: device});
    }
  }

  async function fetchDhwTemperature() {
    try {
      const tempData = await dynamodbClient.getLatestTemperature(temperatureTableName, 'ht-dhw-temp');
      if (tempData) {
        const now = Date.now();
        const tempAge = now - tempData.timestamp;
        const tenMinutes = 10 * 60 * 1000;
        setDhwTemperature({
          temperature: tempData.temperature,
          timestamp: tempData.timestamp,
          isStale: tempAge > tenMinutes
        });
      }
    } catch (error) {
      console.log('Error fetching DHW temperature:', error);
      setDhwTemperature(null);
    }
  }

  // Fetch last 1 day of statuses for timeline AND scheduled activity (both devices)
  async function fetchTimelineAndScheduledActivity() {
    try {
      const oneDayAgo = Math.floor((Date.now() - (24 * 60 * 60 * 1000)) / 1000);

      const [oilStatuses, immersionStatuses, oilScheduled, immersionScheduled] = await Promise.all([
        dynamodbClient.getStatuses('ht-main', oneDayAgo),
        dynamodbClient.getStatuses('ht-immersion', oneDayAgo),
        dynamodbClient.getScheduledActivity('ht-main'),
        dynamodbClient.getScheduledActivity('ht-immersion')
      ]);

      // Update device statuses with most recent
      if (oilStatuses.length > 0) {
        setOilStatus(oilStatuses[0]);
      }
      if (immersionStatuses.length > 0) {
        setImmersionStatus(immersionStatuses[0]);
      }

      // Combine scheduled activities from both devices
      const allScheduled = [...oilScheduled, ...immersionScheduled];
      setScheduledActivity(allScheduled);
    } catch (error) {
      console.error('Error fetching timeline and scheduled activity:', error);
    }
  }

  // Fetch last 90 days of statuses for history stats (both devices)
  async function fetchHistoricalStatuses() {
    try {
      const ninetyDaysAgo = Math.floor((Date.now() - (90 * 24 * 60 * 60 * 1000)) / 1000);

      const [oilStatuses, immersionStatuses] = await Promise.all([
        dynamodbClient.getStatuses('ht-main', ninetyDaysAgo),
        dynamodbClient.getStatuses('ht-immersion', ninetyDaysAgo)
      ]);

      // Combine and sort all statuses
      const allStatuses = [...oilStatuses, ...immersionStatuses].sort((a, b) => b.since - a.since);
      setStatuses(allStatuses);
    } catch (error) {
      console.error('Error fetching historical statuses:', error);
    }
  }

  // Handler for "On for time" action
  async function handleTurnOn(device, durationSeconds) {
    try {
      const params = {
        FunctionName: startScheduleStateChangeLambdaArn,
        Payload: JSON.stringify({
          thingName: device,
          startTime: '0',
          durationSeconds: durationSeconds,
          recurring: false,
          isInitialInvocation: true
        })
      };

      const command = new InvokeCommand(params);
      const data = await lambda.send(command);

      if (data.Payload) {
        const responseText = new TextDecoder().decode(data.Payload);
        console.log('Lambda response:', responseText);
      }

      await syncAllStatuses();
    } catch (error) {
      console.error('Error turning on:', error);
      if (error.statusCode === 403 || error.$metadata?.httpStatusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        alert('Error turning on heating.');
      }
    }
  }

  // Handler for "On to DHW" action
  async function handleTurnOnToDHW(device, targetTemp) {
    try {
      const since = Math.floor(Date.now() / 1000);

      const executionArn = await stepFunctionsClient.startNewExecution(temperatureStateChangeStateMachineArn, {
        thingName: device,
        dhwTargetTemperature: targetTemp,
        since: since
      });

      console.log('Started temperature state machine:', executionArn);

      const status = statusHelper.createStatus(device, modes.ON.val, {
        executionArn: executionArn,
        dhwTargetTemperature: targetTemp
      });

      await dynamodbClient.insertStatus(scheduleTableName, status);
      console.log('Successfully inserted temperature schedule status');

      await syncAllStatuses();
    } catch (error) {
      console.error('Error starting temperature schedule:', error);
      alert('Error starting temperature schedule');
    }
  }

  // Handler for Schedule action
  function handleSchedule(device) {
    setSelectedDevice(device);
    setScheduleModalShow(true);
  }

  // Handler for Turn Off action
  async function handleTurnOff(device) {
    try {
      // Get the current status for this device
      const deviceStatus = device === 'ht-main' ? oilStatus : immersionStatus;

      // Also check scheduled activity for this device (includes DHW activities)
      const currentActivity = scheduledActivity.find(
        activity => activity.device === device && !activity.until
      );

      const executionArnToCancel = deviceStatus.executionArn || currentActivity?.executionArn;

      if (executionArnToCancel) {
        // Check if this execution belongs to a recurring scheduled activity
        const isRecurring = scheduledActivity.some(
          activity => activity.executionArn === executionArnToCancel && activity.recurring
        );

        if (!isRecurring) {
          // Cancel the execution (works for both scheduled and DHW temperature-based)
          await cancelExecution(executionArnToCancel);
          console.log('Cancelled execution:', executionArnToCancel);
        } else {
          console.log('Not cancelling recurring execution:', executionArnToCancel);
        }
      }

      // Update thing shadow to turn off the heating
      const params = {
        thingName: device,
        shadowName: device + '_shadow',
        payload: new TextEncoder().encode('{"state":{"desired":{"on":false}}}')
      };

      await iotData.send(new UpdateThingShadowCommand(params));

      // Create OFF status
      const status = statusHelper.createStatus(device, modes.OFF.val, {});
      await dynamodbClient.insertStatus(stateTableName, status);

      await syncAllStatuses();
    } catch (error) {
      console.error('Error turning off:', error);
      if (error.statusCode === 403 || error.$metadata?.httpStatusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        alert('Error turning off heating.');
      }
    }
  }

  // Handler for Schedule modal confirm
  async function handleScheduleConfirm(startTime, durationSeconds, recurring) {
    try {
      const startTimeISO = hoursMinsToISOString(startTime);
      const params = {
        FunctionName: startScheduleStateChangeLambdaArn,
        Payload: JSON.stringify({
          thingName: selectedDevice,
          startTime: startTimeISO,
          durationSeconds: durationSeconds,
          recurring: recurring,
          isInitialInvocation: true
        })
      };

      const command = new InvokeCommand(params);
      await lambda.send(command);

      setScheduleModalShow(false);
      await syncAllStatuses();
    } catch (error) {
      console.error('Error scheduling:', error);
      if (error.statusCode === 403 || error.$metadata?.httpStatusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        alert('Error scheduling heating.');
      }
    }
  }

  function handleScheduleCancel() {
    setScheduleModalShow(false);
    setSelectedDevice(null);
  }

  async function cancelExecution(executionArn) {
    try {
      await stepFunctionsClient.stopRunningExecution(executionArn);
      console.log('Cancelled execution:', executionArn);
    } catch (error) {
      console.error('Error cancelling execution:', error);
      if (error.statusCode === 403 || error.$metadata?.httpStatusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        alert('Error cancelling execution.');
      }
    }
  }

  function handleViewStats(device) {
    setSelectedStatsDevice(device === selectedStatsDevice ? null : device);
  }

  async function handleDeleteScheduled(activity) {
    try {
      await cancelExecution(activity.executionArn);
      await dynamodbClient.delete(scheduleTableName, activity.device, activity.since);
      await syncAllStatuses();
    } catch (error) {
      console.error('Error deleting scheduled activity:', error);
      alert('Error deleting scheduled activity.');
    }
  }

  const authComponents = {
    ConfirmSignUp: {
      Header() {
        return (
          <label>Your signup request has been sent to Otis for approval.</label>
        );
      }
    }
  };

  return (
    <div id="root">
      <Authenticator components={authComponents}/>
      <div id="homethermostat-new">
        {/* Header */}
        <NewHeader
          connected={connected}
          outsideTemp={outsideTemp}
          dhwTemperature={dhwTemperature}
          onDhwClick={() => setShowDhwGraph(true)}
        />

        {/* Temporary refresh button */}
        <button onClick={syncAllStatuses}>Refresh All Statuses</button>

        {/* Timeline */}
        <TimelineChart
          statuses={statuses}
          scheduledActivity={scheduledActivity}
          currentTime={Date.now()}
          onDeleteScheduled={handleDeleteScheduled}
        />

        {/* Device Cards */}
        <DeviceCard
          device="ht-main"
          deviceName="Oil Heating"
          status={oilStatus}
          scheduledActivity={scheduledActivity}
          onTurnOn={(duration) => handleTurnOn('ht-main', duration)}
          onTurnOnToDHW={(temp) => handleTurnOnToDHW('ht-main', temp)}
          onSchedule={() => handleSchedule('ht-main')}
          onTurnOff={() => handleTurnOff('ht-main')}
          onViewStats={() => handleViewStats('ht-main')}
        />

        {selectedStatsDevice === 'ht-main' && (
          <HistoryStats
            statuses={statuses}
            device="ht-main"
            deviceName="Oil Heating"
          />
        )}

        <DeviceCard
          device="ht-immersion"
          deviceName="Immersion Heating"
          status={immersionStatus}
          scheduledActivity={scheduledActivity}
          onTurnOn={(duration) => handleTurnOn('ht-immersion', duration)}
          onTurnOnToDHW={(temp) => handleTurnOnToDHW('ht-immersion', temp)}
          onSchedule={() => handleSchedule('ht-immersion')}
          onTurnOff={() => handleTurnOff('ht-immersion')}
          onViewStats={() => handleViewStats('ht-immersion')}
        />

        {selectedStatsDevice === 'ht-immersion' && (
          <HistoryStats
            statuses={statuses}
            device="ht-immersion"
            deviceName="Immersion Heating"
          />
        )}

        {/* Schedule Modal */}
        <ScheduleModal
          show={scheduleModalShow}
          handleConfirm={handleScheduleConfirm}
          handleCancel={handleScheduleCancel}
        />

        {/* DHW Graph Modal */}
        <DhwGraphModal
          isOpen={showDhwGraph}
          onClose={() => setShowDhwGraph(false)}
          dynamodbClient={dynamodbClient}
          temperatureTableName={temperatureTableName}
          statuses={statuses}
        />
      </div>
    </div>
  );
};

export default App;
