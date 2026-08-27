import * as homethermostatChangeState from './function/homethermostatChangeState/resource';
import * as homethermostatProcessTemperatureStream from './function/homethermostatProcessTemperatureStream/resource';
import * as homethermostatSignUp from './function/homethermostatSignUp/resource';
import * as homethermostatStartScheduleStateChange from './function/homethermostatStartScheduleStateChange/resource';
import * as homethermostatStoreTaskToken from './function/homethermostatStoreTaskToken/resource';
import * as storageHomethermostatDeviceState from './storage/homethermostatDeviceState/resource';
import * as storageHomethermostatScheduledActivity from './storage/homethermostatScheduledActivity/resource';
import * as storageHomethermostatTemperature from './storage/homethermostatTemperature/resource';
import * as stateMachines from './custom/stateMachines/resource';
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

homethermostatChangeState.applyEscapeHatches(backend, homethermostatDeviceState);
homethermostatProcessTemperatureStream.applyEscapeHatches(
  backend,
  homethermostatScheduledActivity,
  homethermostatTemperature
);
homethermostatSignUp.applyEscapeHatches(backend);
homethermostatStartScheduleStateChange.applyEscapeHatches(backend, homethermostatScheduledActivity);
homethermostatStoreTaskToken.applyEscapeHatches(backend, homethermostatScheduledActivity);

// Ported by hand: the migration tool skips the Gen 1 customCloudformation resources.
const { temperatureHeatingChange } = stateMachines.defineStateMachines(backend, homethermostatScheduledActivity);

// The front end reads these from amplify_outputs.json instead of hardcoding Gen 1 ARNs, which
// only resolved in the 'dev' environment.
backend.addOutput({
  custom: {
    startScheduleStateChangeFunctionArn:
      backend.homethermostatStartScheduleStateChange.resources.lambda.functionArn,
    temperatureStateMachineArn: temperatureHeatingChange.ref,
    deviceStateTableName: homethermostatDeviceState.tableName,
    scheduledActivityTableName: homethermostatScheduledActivity.tableName,
    temperatureTableName: homethermostatTemperature.tableName,
  },
});

export function postRefactor() {
  storageHomethermostatDeviceState.postRefactor(homethermostatDeviceState);
  storageHomethermostatScheduledActivity.postRefactor(homethermostatScheduledActivity);
  storageHomethermostatTemperature.postRefactor(homethermostatTemperature);
  Tags.of(backend.stack).add('gen2-migration/post-refactor', 'true');
}

// Must stay uncommented now that the refactor has run. It pins the moved tables to their real
// names; without it the next deployment would replace them.
postRefactor();
