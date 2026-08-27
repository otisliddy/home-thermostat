import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// See homethermostatChangeState/index.test.js for why the client prototype is spied on rather
// than the module mocked.
const TABLE = 'homethermostat-scheduled-activity-test';

let dynamoSend;
let handler;

beforeEach(async () => {
  dynamoSend = vi.spyOn(DynamoDBClient.prototype, 'send').mockResolvedValue({});

  vi.resetModules();
  vi.stubEnv('REGION', 'eu-west-1');
  vi.stubEnv('STORAGE_HOMETHERMOSTATSCHEDULEDACTIVITY_NAME', TABLE);
  handler = (await import('./index.js')).handler;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const validEvent = () => ({ taskToken: 'token-1', thingName: 'ht-main', since: 1000 });

describe('homethermostatStoreTaskToken', () => {
  it('stores the token against the scheduled activity', async () => {
    await handler(validEvent());

    expect(dynamoSend).toHaveBeenCalledOnce();
    const { input } = dynamoSend.mock.calls[0][0];
    expect(input.TableName).toBe(TABLE);
    expect(input.Key).toEqual({ device: { S: 'ht-main' }, since: { N: '1000' } });
    expect(input.ExpressionAttributeValues[':taskToken']).toEqual({ S: 'token-1' });
  });

  it('does not write a temperature target when none was given', async () => {
    await handler(validEvent());

    const { input } = dynamoSend.mock.calls[0][0];
    expect(input.UpdateExpression).toBe('SET taskToken = :taskToken');
    expect(input.ExpressionAttributeValues[':dhwTargetTemperature']).toBeUndefined();
  });

  it('writes the temperature target when one was given', async () => {
    await handler({ ...validEvent(), dhwTargetTemperature: 41.5 });

    const { input } = dynamoSend.mock.calls[0][0];
    expect(input.UpdateExpression).toContain('dhwTargetTemperature = :dhwTargetTemperature');
    expect(input.ExpressionAttributeValues[':dhwTargetTemperature']).toEqual({ N: '41.5' });
  });

  // A target of zero is a real value; treating it as absent would drop the caller's instruction.
  it('writes a temperature target of zero rather than discarding it', async () => {
    await handler({ ...validEvent(), dhwTargetTemperature: 0 });

    expect(dynamoSend.mock.calls[0][0].input.ExpressionAttributeValues[':dhwTargetTemperature'])
      .toEqual({ N: '0' });
  });

  it.each(['taskToken', 'thingName', 'since'])('rejects an event with no %s', async (field) => {
    const event = validEvent();
    delete event[field];

    await expect(handler(event)).rejects.toThrow('Missing required parameters');
    expect(dynamoSend).not.toHaveBeenCalled();
  });

  it('reports success once the token is stored', async () => {
    await expect(handler(validEvent())).resolves.toMatchObject({ statusCode: 200 });
  });

  it('propagates a write failure so the state machine does not wait on a token that was never saved', async () => {
    dynamoSend.mockRejectedValue(new Error('table throttled'));

    await expect(handler(validEvent())).rejects.toThrow('table throttled');
  });
});
