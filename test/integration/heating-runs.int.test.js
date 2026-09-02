import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  assertNotLiveHardware,
  deleteItem,
  desiredShadowState,
  eventually,
  invokeLambda,
  latestStatus,
  outputs,
  putTemperature,
  stopExecutionQuietly
} from './support.js';

const OIL = outputs.oilThingName;
const DHW_TEMP = outputs.dhwTempThingName;

let started = [];

beforeAll(async () => {
  assertNotLiveHardware();
  // A thing with no shadow yet cannot be read, so establish a known-off one up front.
  await invokeLambda(outputs.changeStateFunctionArn, { thingName: OIL, mode: 'OFF' });
});

afterEach(async () => {
  for (const { executionArn, since } of started) {
    await stopExecutionQuietly(executionArn);
    if (since) {
      await deleteItem(outputs.scheduledActivityTableName, OIL, since);
    }
  }
  started = [];

  await invokeLambda(outputs.changeStateFunctionArn, { thingName: OIL, mode: 'OFF' });
});

const startRun = async (payload) => {
  const result = await invokeLambda(outputs.startScheduleStateChangeFunctionArn, {
    thingName: OIL,
    isInitialInvocation: true,
    ...payload
  });
  started.push(result ?? {});
  return result;
};

describe('turning the heating on', () => {
  // The exact failure that took both circuits down: the lambda's role lost iot:UpdateThingShadow
  // and every run died with a 403 that only showed up in CloudWatch.
  it('changeState reaches IoT and records the change', async () => {
    await invokeLambda(outputs.changeStateFunctionArn, {
      thingName: OIL,
      mode: 'ON',
      durationSeconds: 600
    });

    await eventually(async () => {
      expect(await desiredShadowState(OIL)).toMatchObject({ on: true });
    });
  });

  it('a timed run turns the relay on', async () => {
    await startRun({ startTime: '0', durationSeconds: 900 });

    await eventually(async () => {
      expect(await desiredShadowState(OIL)).toMatchObject({ on: true });
    });
  });
});

describe('a run to a temperature target', () => {
  it('turns on, then off once the water reaches the target', async () => {
    const run = await startRun({ startTime: '0', dhwTargetTemperature: 40 });

    await eventually(async () => {
      expect(await desiredShadowState(OIL)).toMatchObject({ on: true });
    });

    // The task token is written when the machine starts waiting; pushing a reading before then
    // would find no active task.
    await eventually(async () => {
      const item = await latestStatus(outputs.scheduledActivityTableName, OIL, run.since);
      expect(item?.taskToken?.S).toBeTruthy();
    });

    await putTemperature(DHW_TEMP, 41);

    await eventually(
      async () => {
        expect(await desiredShadowState(OIL)).toMatchObject({ on: false });
      },
      { timeoutMs: 90000 }
    );

    const item = await eventually(async () => {
      const current = await latestStatus(outputs.scheduledActivityTableName, OIL, run.since);
      expect(current?.until?.N).toBeTruthy();
      return current;
    });

    expect(item.endReason.S).toBe('target_temperature_reached');
  });

  it('records the target so the run can be labelled before it starts', async () => {
    const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const run = await startRun({ startTime, dhwTargetTemperature: 47.5 });

    const item = await latestStatus(outputs.scheduledActivityTableName, OIL, run.since);
    expect(item.dhwTargetTemperature.N).toBe('47.5');
    expect(item.until).toBeUndefined();
  });

  it('books the run for later without turning anything on yet', async () => {
    const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await startRun({ startTime, dhwTargetTemperature: 47.5 });

    await eventually(async () => {
      expect(await desiredShadowState(OIL)).toMatchObject({ on: false });
    }, { timeoutMs: 15000 });
  });
});
