import React, { useState, useEffect } from 'react';
import Header from './component/header';
import Status from './component/status';
import SelectMode from './component/select-mode';
import PreviousActivity from './component/previous-activity';
import ScheduledActivity from './component/scheduled-activity';
import ScheduleModal from './component/schedule-modal';
import AWS from 'aws-sdk';
import {
  modes,
  DynamodbClient,
  statusHelper
} from 'home-thermostat-common';
import {
  hoursMinsToDate,
  hoursMinsToSecondsFromNow,
  relativeDateAgo
} from './util/time-helper';
import { IoTClient, AttachPolicyCommand } from "@aws-sdk/client-iot";

import { Amplify, Hub } from 'aws-amplify';
import { Auth } from '@aws-amplify/auth';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
const identityPoolId = 'eu-west-1:a2b980af-483f-41fb-ab4a-fcfef938015a'
Amplify.configure({
  Auth: {
    identityPoolId: identityPoolId,
    region: 'eu-west-1',
    userPoolId: 'eu-west-1_kaR3nNFXA',
    userPoolWebClientId: 'pj9peastf76fjjhm1cl1jumpf',
    signUpVerificationMethod: 'link'
  }
});

/* TODO: 
- Restrict homethermostat-frontend-view resource
                "arn:aws:acm:region:123456789012:certificate/*",
                "arn:aws:iot:eu-west-1:056402289766:thing/ht-main",
                "arn:aws:dynamodb:eu-west-1:056402289766:table/homethermostat-*"
- Don't scan Dynamo statuses
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
let lambda, dynamodbClient, iotData;

const App = () => {
  const [status, setStatus] = useState({ mode: 'Loading...' });
  const [scheduleModalShow, setScheduleModalShow] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [scheduledActivity, setScheduledActivity] = useState([]);

  Hub.listen('auth', async (data) => {
    if ('signIn' === data.payload.event) {
      setUserAndSyncStatus();
    }
  });

  useEffect(() => {
    Auth.currentCredentials().then(creds => {
      setUserAndSyncStatus();
    });
  }, []);

  async function setUserAndSyncStatus() {
    try {
      const credentials = await Auth.currentCredentials();
      AWS.config.region = 'eu-west-1';

      lambda = new AWS.Lambda({
        credentials: Auth.essentialCredentials(credentials)
      });
      dynamodbClient = new DynamodbClient(new AWS.DynamoDB({
        credentials: Auth.essentialCredentials(credentials)
      }));
      iotData = new AWS.IotData({
        endpoint: 'a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com',
        credentials: Auth.essentialCredentials(credentials)
      });

      const iotClient = new IoTClient({
        region: 'eu-west-1',
        credentials: Auth.essentialCredentials(credentials)
      });
      const command = new AttachPolicyCommand({
        policyName: 'HtFrontendPolicy',
        target: credentials.identityId
      });
      await iotClient.send(command);

      syncStatus();
    } catch (error) {
      console.log(error);
    }
  }

  /**
  * Compares the reported status from the Arduino to the status from DynamoDB. If they match, the current state is set
  * and true is returned. If the states don't match or there is an error, false is returned.
  */
  async function syncStatus() {
    iotData.getThingShadow({ thingName: 'ht-main' }, function (error, data) {
      if (!error) {
        const jsonResponse = JSON.parse(data.payload);
        const reportedMode = jsonResponse.state.reported.on ? modes.ON : modes.OFF;
        const connected = jsonResponse.state.reported.connected;
        setConnected(connected);
        setStatus({ mode: reportedMode.val });

        dynamodbClient.getStatuses(relativeDateAgo(180)).then((statuses) => {
          if (statuses.length > 0) {
            setStatuses(statuses);
            return setStatus(statuses[0]);
          }
        });
      } else {
        console.log('Error when getting thing shadow', error);
        return false;
      }
    });

    const statuses_1 = await dynamodbClient.getScheduledActivity();
    setScheduledActivity(statuses_1);
  }

  async function handleOn(selection) {
    if (typeof selection === 'string' && selection.includes('schedule')) {
      return setScheduleModalShow(true);
    }

    console.log('Turning on');
    cancelCurrentStatusExecution();

    const params = createScheduleStateChangeParams(0, selection);
    lambda.invoke(params, function (error, data) {
      if (!error) {
        const status = statusHelper.createStatus(modes.ON.val, { duration: selection, executionArn: data.Payload });
        setStatus(status);
      } else if (error.statusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        alert('Let Otis know that error 15 occurred.');
      }
    });
  }

  async function handleOff() {
    console.log('Turning off', status);

    cancelCurrentStatusExecution();

    const params = { thingName: 'ht-main', payload: `{"state":{"desired":{"on":false}}}}` };

    iotData.updateThingShadow(params, function (error, data) {
      if (!error) {
        const status = statusHelper.createStatus(modes.OFF.val);
        persistStatus(status);
      }
      else if (error.statusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      }
    });

  }

  async function handleScheduleConfirm(startTime, duration) {
    setScheduleModalShow(false);

    const params = createScheduleStateChangeParams(hoursMinsToSecondsFromNow(startTime), duration * 60);
    lambda.invoke(params, function (error, data) {
      if (!error) {
        const options = {
          duration: duration * 60,
          executionArn: data.Payload
        };
        const status = statusHelper.createStatus(modes.ON.val, options, hoursMinsToDate(startTime));
        dynamodbClient.insertStatus(scheduleTableName, status).then(() => {
          syncStatus();
        });
      } else if (error.statusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        console.log(error);
        alert('Let Otis know that error 16 occurred.');
      }
    });
  }

  function createScheduleStateChangeParams(startSecondsFromNow, durationSeconds) {
    const payload = {
      stateMachineInput: [],
      cancelExisting: false
    };
    payload.stateMachineInput.push({ waitSeconds: startSecondsFromNow, mode: modes.ON.val });
    payload.stateMachineInput.push({ waitSeconds: durationSeconds, mode: modes.OFF.val });

    const params = {
      FunctionName: startScheduleStateChangeLambdaArn,
      Payload: JSON.stringify(payload)
    };

    return params;
  }

  function handleScheduleCancel() {
    setScheduleModalShow(false);
  }

  async function handleScheduleDelete(status) {
    cancelExecution(status.executionArn, () => {
      dynamodbClient.delete(scheduleTableName, status.since)
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
    return lambda.invoke(params, function (error, data) {
      if (!error) {
        console.log('Cancelled heating change');
        callback();
      } else if (error.statusCode === 403) {
        alert('Forbidden, you must be an authorized user.');
      } else {
        console.log(error);
        alert('Let Otis know that error 17 occurred.');
      }
    });
  }

  async function persistStatus(status) {
    dynamodbClient.insertStatus(stateTableName, status).then(() => {
      setStatus(status);
      syncStatus();
    });
  }

  async function cancelCurrentStatusExecution() {
    if (status.executionArn) {
      cancelExecution(status.executionArn, () => { })
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
    <div>
      <Authenticator components={authComponents} />
      <div id="homethermostat">
        <div disabled={scheduleModalShow}>
          <Header connected={connected} />
          <Status status={status} />
          <SelectMode currentMode={status.mode}
            handleOn={handleOn}
            handleOff={handleOff} />
          <ScheduledActivity statuses={scheduledActivity}
            handleDelete={handleScheduleDelete} />
          <PreviousActivity statuses={statuses} />
        </div>
        <ScheduleModal
          show={scheduleModalShow}
          handleConfirm={handleScheduleConfirm}
          handleCancel={handleScheduleCancel}
        />
      </div></div>
  );
};

export default App;
