import * as homethermostatChangeState from './function/homethermostatChangeState/resource';
import * as homethermostatProcessTemperatureStream from './function/homethermostatProcessTemperatureStream/resource';
import * as homethermostatSignUp from './function/homethermostatSignUp/resource';
import * as homethermostatStartScheduleStateChange from './function/homethermostatStartScheduleStateChange/resource';
import * as homethermostatStoreTaskToken from './function/homethermostatStoreTaskToken/resource';
import * as storageHomethermostatDeviceState from './storage/homethermostatDeviceState/resource';
import * as storageHomethermostatScheduledActivity from './storage/homethermostatScheduledActivity/resource';
import * as storageHomethermostatTemperature from './storage/homethermostatTemperature/resource';
import * as stateMachines from './custom/stateMachines/resource';
import * as iot from './custom/iot/resource';
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

iot.defineIotResources(backend, homethermostatTemperature);

/*
 * Flip to true once the ESP8266s have been reflashed onto the branch-suffixed things this stack
 * creates. Until then master has to keep addressing the unsuffixed things the hardware is
 * connected to, while a sandbox addresses its own and cannot reach the real relays.
 */
const DEVICES_REFLASHED_ONTO_BRANCH_THINGS = false;
const branchName = process.env.AWS_BRANCH ?? 'sandbox';

const thingName = (device: string) =>
  DEVICES_REFLASHED_ONTO_BRANCH_THINGS || branchName !== 'master' ? iot.thingNameFor(device) : device;

const oilThingName = thingName('ht-main');
const immersionThingName = thingName('ht-immersion');
const dhwTempThingName = thingName('ht-dhw-temp');

homethermostatProcessTemperatureStream.setRelayDevices(backend, [oilThingName, immersionThingName]);

// The front end reads these from amplify_outputs.json instead of hardcoding Gen 1 ARNs, which
// only resolved in the 'dev' environment.
backend.addOutput({
  custom: {
    startScheduleStateChangeFunctionArn:
      backend.homethermostatStartScheduleStateChange.resources.lambda.functionArn,
    changeStateFunctionArn: backend.homethermostatChangeState.resources.lambda.functionArn,
    temperatureStateMachineArn: temperatureHeatingChange.ref,
    deviceStateTableName: homethermostatDeviceState.tableName,
    scheduledActivityTableName: homethermostatScheduledActivity.tableName,
    temperatureTableName: homethermostatTemperature.tableName,
    oilThingName,
    immersionThingName,
    dhwTempThingName,
  },
});

/*
 * Names the tables explicitly. master keeps the '-dev' names the migration moved, so a deploy does
 * not replace them; every other branch gets its own set. Auto-generated names would also fall
 * outside the 'homethermostat-*' grant the browser's identity pool role is scoped to.
 */
export function postRefactor(suffix: string) {
  storageHomethermostatDeviceState.postRefactor(homethermostatDeviceState, suffix);
  storageHomethermostatScheduledActivity.postRefactor(homethermostatScheduledActivity, suffix);
  storageHomethermostatTemperature.postRefactor(homethermostatTemperature, suffix);
  Tags.of(backend.stack).add('gen2-migration/post-refactor', 'true');
}

postRefactor(branchName === 'master' ? 'dev' : branchName);
