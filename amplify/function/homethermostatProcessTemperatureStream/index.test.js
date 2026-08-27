import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SFNClient } from '@aws-sdk/client-sfn';

// See homethermostatChangeState/index.test.js for why the client prototypes are spied on rather
// than the modules mocked.
const TABLE = 'homethermostat-scheduled-activity-test';

let dynamoSend;
let sfnSend;
let handler;

beforeEach(async () => {
  dynamoSend = vi.spyOn(DynamoDBClient.prototype, 'send').mockResolvedValue({ Items: [] });
  sfnSend = vi.spyOn(SFNClient.prototype, 'send').mockResolvedValue({});

  vi.resetModules();
  vi.stubEnv('REGION', 'eu-west-1');
  vi.stubEnv('STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME', TABLE);
  handler = (await import('./index.js')).handler;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function temperatureRecord(temperature, eventName = 'INSERT') {
  return {
    eventName,
    dynamodb: {
      NewImage: {
        device: { S: 'ht-dhw-temp' },
        temperature: { N: temperature.toString() },
        timestamp: { N: '1700000000000' },
      },
    },
  };
}

/** An activity is "active" only while it has a token, a target and no until. */
function activeTask({ device = 'ht-main', target = 40, token = 'token-1', until } = {}) {
  const item = {
    device: { S: device },
    since: { N: (Math.floor(Date.now() / 1000) - 60).toString() },
    taskToken: { S: token },
    dhwTargetTemperature: { N: target.toString() },
  };
  if (until) {
    item.until = { N: until.toString() };
  }
  return item;
}

/** The handler queries ht-main then ht-immersion; give the first device the items. */
function respondWithTasks(items) {
  dynamoSend.mockReset();
  dynamoSend.mockResolvedValueOnce({ Items: items }).mockResolvedValue({ Items: [] });
}

describe('homethermostatProcessTemperatureStream', () => {
  it('releases the waiting state machine once the target is reached', async () => {
    respondWithTasks([activeTask({ target: 40 })]);

    await handler({ Records: [temperatureRecord(41)] });

    expect(sfnSend).toHaveBeenCalledOnce();
    const { input } = sfnSend.mock.calls[0][0];
    expect(input.taskToken).toBe('token-1');
    expect(JSON.parse(input.output)).toMatchObject({
      temperature: 41,
      heatingDevice: 'ht-main',
      reason: 'target_temperature_reached',
    });
  });

  it('releases on reaching the target exactly', async () => {
    respondWithTasks([activeTask({ target: 40 })]);

    await handler({ Records: [temperatureRecord(40)] });

    expect(sfnSend).toHaveBeenCalledOnce();
  });

  it('keeps heating while below the target', async () => {
    respondWithTasks([activeTask({ target: 40 })]);

    await handler({ Records: [temperatureRecord(39.5)] });

    expect(sfnSend).not.toHaveBeenCalled();
  });

  it('ignores an activity that has already finished', async () => {
    respondWithTasks([activeTask({ target: 40, until: Math.floor(Date.now() / 1000) })]);

    await handler({ Records: [temperatureRecord(45)] });

    expect(sfnSend).not.toHaveBeenCalled();
  });

  it('ignores an activity with no task token', async () => {
    const task = activeTask({ target: 40 });
    delete task.taskToken;
    respondWithTasks([task]);

    await handler({ Records: [temperatureRecord(45)] });

    expect(sfnSend).not.toHaveBeenCalled();
  });

  it('ignores an activity with no temperature target', async () => {
    const task = activeTask({ target: 40 });
    delete task.dhwTargetTemperature;
    respondWithTasks([task]);

    await handler({ Records: [temperatureRecord(45)] });

    expect(sfnSend).not.toHaveBeenCalled();
  });

  it('ignores removals', async () => {
    respondWithTasks([activeTask({ target: 40 })]);

    await handler({ Records: [temperatureRecord(45, 'REMOVE')] });

    expect(dynamoSend).not.toHaveBeenCalled();
    expect(sfnSend).not.toHaveBeenCalled();
  });

  it('ignores a record with an unreadable temperature', async () => {
    const record = temperatureRecord(45);
    record.dynamodb.NewImage.temperature = { N: 'not-a-number' };
    respondWithTasks([activeTask({ target: 40 })]);

    await handler({ Records: [record] });

    expect(sfnSend).not.toHaveBeenCalled();
  });

  // One device's query failing must not stop the other device being served.
  it('still serves the second device when the first query fails', async () => {
    dynamoSend.mockReset();
    dynamoSend
      .mockRejectedValueOnce(new Error('throttled'))
      .mockResolvedValue({ Items: [activeTask({ device: 'ht-immersion', token: 'token-2' })] });

    await handler({ Records: [temperatureRecord(45)] });

    expect(sfnSend).toHaveBeenCalledOnce();
    expect(sfnSend.mock.calls[0][0].input.taskToken).toBe('token-2');
  });

  // A token that has already been used throws; the handler logs and carries on so that one stale
  // activity cannot block the rest of the batch.
  it('survives a task token that is no longer valid', async () => {
    respondWithTasks([activeTask({ target: 40 })]);
    sfnSend.mockRejectedValue(new Error('TaskDoesNotExist'));

    await expect(handler({ Records: [temperatureRecord(45)] })).resolves.toEqual({ status: 'done' });
  });
});
