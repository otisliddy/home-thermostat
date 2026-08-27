import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SFNClient } from '@aws-sdk/client-sfn';

// See homethermostatChangeState/index.test.js for why the client prototypes are spied on rather
// than the modules mocked.
const TABLE = 'homethermostat-scheduled-activity-test';
const STATE_MACHINE_ARN = 'arn:aws:states:eu-west-1:000000000000:stateMachine:schedule-test';
const EXECUTION_ARN = 'arn:aws:states:eu-west-1:000000000000:execution:schedule-test:abc';

let dynamoSend;
let sfnSend;
let handler;

beforeEach(async () => {
  dynamoSend = vi.spyOn(DynamoDBClient.prototype, 'send').mockResolvedValue({});
  sfnSend = vi.spyOn(SFNClient.prototype, 'send').mockResolvedValue({ executionArn: EXECUTION_ARN });

  vi.resetModules();
  vi.stubEnv('REGION', 'eu-west-1');
  vi.stubEnv('STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME', TABLE);
  vi.stubEnv('SCHEDULE_STATE_MACHINE_ARN', STATE_MACHINE_ARN);
  handler = (await import('./index.js')).handler;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const stateMachineInput = () => JSON.parse(sfnSend.mock.calls[0][0].input.input);

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe('homethermostatStartScheduleStateChange', () => {
  it('starts the branch state machine named in the environment', async () => {
    await handler({ thingName: 'ht-main', startTime: 0, durationSeconds: 900 });

    expect(sfnSend).toHaveBeenCalledOnce();
    expect(sfnSend.mock.calls[0][0].input.stateMachineArn).toBe(STATE_MACHINE_ARN);
  });

  it('starts immediately when startTime is zero', async () => {
    await handler({ thingName: 'ht-main', startTime: 0, durationSeconds: 900 });

    expect(stateMachineInput()).toMatchObject({
      thingName: 'ht-main',
      startWaitSeconds: 0,
      durationSeconds: 900,
    });
  });

  it('accepts a zero startTime sent as a string', async () => {
    await handler({ thingName: 'ht-main', startTime: '0', durationSeconds: 900 });

    expect(stateMachineInput().startWaitSeconds).toBe(0);
  });

  // An immediate change is already recorded by changeState; writing it here too would double it up.
  it('does not record scheduled activity for an immediate change', async () => {
    await handler({ thingName: 'ht-main', startTime: 0, durationSeconds: 900 });

    expect(dynamoSend).not.toHaveBeenCalled();
  });

  it('waits until the requested time for a future change', async () => {
    await handler({ thingName: 'ht-main', startTime: inOneHour(), durationSeconds: 900 });

    expect(stateMachineInput().startWaitSeconds).toBeCloseTo(3600, -2);
  });

  it('records the scheduled activity for a future change', async () => {
    await handler({ thingName: 'ht-main', startTime: inOneHour(), durationSeconds: 900 });

    expect(dynamoSend).toHaveBeenCalledOnce();
    const { input } = dynamoSend.mock.calls[0][0];
    expect(input.TableName).toBe(TABLE);
    expect(input.Item.device.S).toBe('ht-main');
    expect(input.Item.executionArn.S).toBe(EXECUTION_ARN);
  });

  // The state machine re-invokes this on each cycle; the next occurrence is a day later.
  it('moves a recurring schedule on by a day when it re-runs', async () => {
    const startTime = inOneHour();

    await handler({ thingName: 'ht-main', startTime, recurring: true, durationSeconds: 900 });

    const dayInSeconds = 24 * 60 * 60;
    expect(stateMachineInput().startWaitSeconds).toBeCloseTo(3600 + dayInSeconds, -2);
  });

  it('does not move the first run of a recurring schedule', async () => {
    const startTime = inOneHour();

    await handler({
      thingName: 'ht-main',
      startTime,
      recurring: true,
      isInitialInvocation: true,
      durationSeconds: 900,
    });

    expect(stateMachineInput().startWaitSeconds).toBeCloseTo(3600, -2);
  });

  it('returns the new execution arn when re-running a recurring schedule', async () => {
    const result = await handler({
      thingName: 'ht-main',
      startTime: inOneHour(),
      recurring: true,
      durationSeconds: 900,
    });

    expect(result).toBe(EXECUTION_ARN);
  });

  it('rejects a startTime it cannot interpret', async () => {
    await expect(handler({ thingName: 'ht-main', startTime: 12345 })).rejects.toThrow(
      'Invalid startTime format'
    );
    expect(sfnSend).not.toHaveBeenCalled();
  });

  it('does not record activity when the state machine fails to start', async () => {
    sfnSend.mockRejectedValue(new Error('states unavailable'));

    await expect(
      handler({ thingName: 'ht-main', startTime: inOneHour(), durationSeconds: 900 })
    ).rejects.toThrow('states unavailable');
    expect(dynamoSend).not.toHaveBeenCalled();
  });
});
