import * as homethermostatChangeState from './function/homethermostatChangeState/resource';
import * as homethermostatProcessTemperatureStream from './function/homethermostatProcessTemperatureStream/resource';
import * as homethermostatSignUp from './function/homethermostatSignUp/resource';
import * as homethermostatStartScheduleStateChange from './function/homethermostatStartScheduleStateChange/resource';
import * as homethermostatStoreTaskToken from './function/homethermostatStoreTaskToken/resource';
import * as storageHomethermostatDeviceState from './storage/homethermostatDeviceState/resource';
import * as storageHomethermostatScheduledActivity from './storage/homethermostatScheduledActivity/resource';
import * as storageHomethermostatTemperature from './storage/homethermostatTemperature/resource';
import { defineBackend } from '@aws-amplify/backend';
import { Tags } from 'aws-cdk-lib';

const backend = defineBackend({
  homethermostatChangeState: homethermostatChangeState.homethermostatChangeState,
  homethermostatProcessTemperatureStream: homethermostatProcessTemperatureStream.homethermostatProcessTemperatureStream,
  homethermostatSignUp: homethermostatSignUp.homethermostatSignUp,
  homethermostatStartScheduleStateChange: homethermostatStartScheduleStateChange.homethermostatStartScheduleStateChange,
  homethermostatStoreTaskToken: homethermostatStoreTaskToken.homethermostatStoreTaskToken,
});

export type Backend = typeof backend;

const homethermostatDeviceState = storageHomethermostatDeviceState.defineStorageHomethermostatDeviceState(backend);
const homethermostatScheduledActivity =
  storageHomethermostatScheduledActivity.defineStorageHomethermostatScheduledActivity(backend);
const homethermostatTemperature = storageHomethermostatTemperature.defineStorageHomethermostatTemperature(backend);

homethermostatChangeState.applyEscapeHatches(backend, homethermostatdevicestate);
homethermostatProcessTemperatureStream.applyEscapeHatches(
  backend,
  homethermostatscheduledactivity,
  homethermostattemperature
);
homethermostatSignUp.applyEscapeHatches(backend);
homethermostatStartScheduleStateChange.applyEscapeHatches(backend, homethermostatscheduledactivity);
homethermostatStoreTaskToken.applyEscapeHatches(backend, homethermostatscheduledactivity);

export function postRefactor() {
  storageHomethermostatDeviceState.postRefactor(homethermostatDeviceState);
  storageHomethermostatScheduledActivity.postRefactor(homethermostatScheduledActivity);
  storageHomethermostatTemperature.postRefactor(homethermostatTemperature);
  Tags.of(backend.stack).add('gen2-migration/post-refactor', 'true');
}

// Uncomment after refactor
// postRefactor();
