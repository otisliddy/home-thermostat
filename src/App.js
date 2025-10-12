import React, {useEffect, useState} from 'react';
import Header from './component/header';
import Status from './component/status';
import SelectMode from './component/select-mode';
import PreviousActivity from './component/previous-activity';
import ScheduledActivity from './component/scheduled-activity';
import ScheduleModal from './component/schedule-modal';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { IoTDataPlaneClient, GetThingShadowCommand, UpdateThingShadowCommand } from '@aws-sdk/client-iot-data-plane';
import {DynamodbClient, modes, statusHelper} from 'home-thermostat-common';
import {hoursMinsToSecondsFromNow, hoursMinsToISOString, relativeDateAgo} from './util/time-helper';

import {Amplify} from 'aws-amplify';
import {fetchAuthSession} from 'aws-amplify/auth';
import {Hub} from '@aws-amplify/core';
import {Authenticator} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

const identityPoolId = 'eu-west-1:a2b980af-483f-41fb-ab4a-fcfef938015a'
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

/* TODO:
- convert components to functional components
- Introduce loading state
- Write unit tests for generateAgoString
- Change to AWS.DynamoDB.DocumentClient()
- Move table names to constants
*/

const startScheduleStateChangeLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:homethermostatStartScheduleStateChange-dev';
const cancelRunningWorkflowLambdaArn = 'arn:aws:lambda:eu-west-1:056402289766:function:homethermostatCancelRunningWorkflow-dev';
const stateTableName = 'homethermostat-device-state-dev';
const scheduleTableName = 'homethermostat-scheduled-activity-dev';
const temperatureTableName = 'homethermostat-temperature-dev';
let lambda, dynamodbClient, iotData;

const App = () => {
  const [status, setStatus] = useState({ mode: 'Loading...' });
  const [scheduleModalShow, setScheduleModalShow] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [scheduledActivity, setScheduledActivity] = useState([]);
  const [thingName, setThingName] = useState('ht-main');
  const [dhwTemperature, setDhwTemperature] = useState(null);

  Hub.listen('auth', async (data) => {
    if ('signIn' === data.payload.event) {
      await setUserAndSyncStatus();
    }
  });

  useEffect(() => {
    fetchAuthSession().then(creds => {
      setUserAndSyncStatus();
    });
  }, []);

  useEffect(() => {
    if (lambda && dynamodbClient && iotData) {
      setStatus({ mode: 'Loading...' });
      setConnected(false);
      setStatuses([]);
      setScheduledActivity([]);
      syncStatus();
    }
  }, [thingName]);

  async function setUserAndSyncStatus() {
    try {
      const session = await fetchAuthSession();
      if (!session.credentials) throw new Error('No credentials available');
      const { accessKeyId, secretAccessKey, sessionToken } = session.credentials;
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
      iotData = new IoTDataPlaneClient({
        region: 'eu-west-1',
        endpoint: 'https://a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com',
        credentials: awsCredentials
      });

      await syncStatus();
    } catch (error) {
      console.log(error);
    }
  }

  /**
  * Compares the reported status from the Arduino to the status from DynamoDB. If they match, the current state is set
  * and true is returned. If the states don't match or there is an error, false is returned.
  */
  async function syncStatus() {
    try {
      const command = new GetThingShadowCommand({ thingName: thingName, shadowName: thingName + '_shadow' });
      const data = await iotData.send(command);
      const payloadString = new TextDecoder().decode(data.payload);
      const jsonResponse = JSON.parse(payloadString);
      const reportedMode = jsonResponse.state.reported.on ? modes.ON : modes.OFF;
      const connected = jsonResponse.state.reported.connected;
      setConnected(connected);
      setStatus({ mode: reportedMode.val, device: thingName });

      const statuses = await dynamodbClient.getStatuses(thingName, relativeDateAgo(30));
      if (statuses.length > 0) {
        setStatuses(statuses);
        setStatus(statuses[0]);
      }
    } catch (error) {
      console.log('Error when getting thing shadow', error);
      return false;
    }

    const scheduledActivity = await dynamodbClient.getScheduledActivity(thingName);
    setScheduledActivity(scheduledActivity);

    await fetchDhwTemperature();
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
      // Don't show DHW temperature if there's an error
      setDhwTemperature(null);
    }
  }

  async function handleOn(selection) {
    if (typeof selection === 'string' && selection.includes('schedule')) {
      return setScheduleModalShow(true);
    }

    console.log('Turning on');
    await cancelCurrentStatusExecution();

    const params = createScheduleStateChangeParams(0, selection);
    try {
      const command = new InvokeCommand(params);
      const data = await lambda.send(command);
      // Lambda returns the execution ARN as a JSON string (or undefined for non-recurring)
      let executionArn;
      if (data.Payload) {
        const responseText = new TextDecoder().decode(data.Payload);
        console.log('Lambda response text:', responseText);
        if (responseText && responseText !== 'null' && responseText !== 'undefined') {
          executionArn = JSON.parse(responseText);
          console.log('Parsed executionArn:', executionArn, 'type:', typeof executionArn);
        }
      }
      const status = statusHelper.createStatus(thingName, modes.ON.val, { duration: selection, executionArn: executionArn });
      setStatus(status);
    } catch (error) {
      if (error.statusCode === 403 || error.$metadata?.httpStatusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        console.error('Error invoking lambda:', error);
        alert('Let Otis know that error 15 occurred.');
      }
    }
  }

  async function handleOff() {
    console.log('Turning off', status);

    await cancelCurrentStatusExecution();

    const params = {
      thingName: thingName,
      shadowName: thingName + '_shadow',
      payload: new TextEncoder().encode(`{"state":{"desired":{"on":false}}}`)
    };

    try {
      const command = new UpdateThingShadowCommand(params);
      await iotData.send(command);
      const status = statusHelper.createStatus(thingName, modes.OFF.val);
      persistStatus(status);
    } catch (error) {
      if (error.statusCode === 403 || error.$metadata?.httpStatusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        console.error('Error updating thing shadow:', error);
      }
    }
  }

  async function handleScheduleConfirm(startTime, duration, recurring) {
    setScheduleModalShow(false);

    const startTimeISO = hoursMinsToISOString(startTime);
    const params = createScheduleStateChangeParams(hoursMinsToSecondsFromNow(startTime), duration * 60, recurring, startTimeISO);
    try {
      const command = new InvokeCommand(params);
      await lambda.send(command);
      syncStatus();
    } catch (error) {
      if (error.statusCode === 403 || error.$metadata?.httpStatusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        console.log(error);
        alert('Let Otis know that error 16 occurred.');
      }
    }
  }

  function createScheduleStateChangeParams(startSecondsFromNow, durationSeconds, recurring, startTime) {
    // Set startTime to 0 for immediate execution
    const effectiveStartTime = startTime || 0;

    return {
      FunctionName: startScheduleStateChangeLambdaArn,
      Payload: JSON.stringify({
        thingName: thingName,
        recurring: recurring || false,
        startTime: effectiveStartTime,
        durationSeconds: durationSeconds,
        isInitialInvocation: true
      })
    };
  }

  function handleScheduleCancel() {
    setScheduleModalShow(false);
  }

  async function handleScheduleDelete(status) {
    cancelExecution(status.executionArn, () => {
      dynamodbClient.delete(scheduleTableName, thingName, status.since)
        .then(() => {
          syncStatus();
        });
    });
  }

  async function cancelExecution(executionArn, callback) {
    const params = {
      FunctionName: cancelRunningWorkflowLambdaArn,
      Payload: JSON.stringify({ executionArn: executionArn })
    };
    try {
      const command = new InvokeCommand(params);
      await lambda.send(command);
      console.log('Cancelled heating change');
      callback();
    } catch (error) {
      if (error.statusCode === 403 || error.$metadata?.httpStatusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        console.log(error);
        alert('Let Otis know that error 17 occurred.');
      }
    }
  }

  async function persistStatus(status) {
    dynamodbClient.insertStatus(stateTableName, status).then(() => {
      setStatus(status);
      syncStatus();
    });
  }

  async function cancelCurrentStatusExecution() {
    if (status.executionArn) {
      // Check if this execution belongs to a recurring scheduled activity
      const isRecurring = scheduledActivity.some(
        activity => activity.executionArn === status.executionArn && activity.recurring
      );

      if (!isRecurring) {
        await cancelExecution(status.executionArn, () => {})
      } else {
        console.log('Not cancelling recurring execution:', status.executionArn);
      }
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
  }

  return (
    <div id="root">
      <Authenticator components={authComponents} />
      <div id="homethermostat">
        <div className="tabs">
          <button onClick={() => setThingName('ht-main')} className={thingName === 'ht-main' ? 'active' : ''}>Oil</button>
          <button onClick={() => setThingName('ht-immersion')} className={thingName === 'ht-immersion' ? 'active' : ''}>Immersion</button>
        </div>
        <div disabled={scheduleModalShow}>
          <Header connected={connected} dhwTemperature={dhwTemperature}/>
          <Status status={status}/>
          <SelectMode currentMode={status.mode} handleOn={handleOn} handleOff={handleOff}/>
          <ScheduledActivity statuses={scheduledActivity} handleDelete={handleScheduleDelete}/>
          <PreviousActivity statuses={statuses}/>
        </div>
        <ScheduleModal
            show={scheduleModalShow}
            handleConfirm={handleScheduleConfirm}
            handleCancel={handleScheduleCancel} />
      </div>
    </div>
  );
};

export default App;
