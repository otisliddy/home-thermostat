import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane';
import { modes } from 'home-thermostat-common';

// The handler is CommonJS and builds its AWS clients at module load, so vi.mock cannot reach it
// (vi.mock rewrites ESM imports, not require). Spying on the client prototypes works either way:
// the ESM import here and the handler's require resolve to the same class object.
const TABLE = 'homethermostat-device-state-test';

let iotSend;
let dynamoSend;
let handler;

beforeEach(async () => {
  iotSend = vi.spyOn(IoTDataPlaneClient.prototype, 'send').mockResolvedValue({});
  dynamoSend = vi.spyOn(DynamoDBClient.prototype, 'send').mockResolvedValue({});

  vi.resetModules();
  vi.stubEnv('REGION', 'eu-west-1');
  vi.stubEnv('STORAGE_HOMETHERMOSTATDEVICESTATE_NAME', TABLE);
  handler = (await import('./index.js')).handler;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** The desired shadow state is the boiler instruction, so read it back out of the payload. */
function desiredStateOf(command) {
  return JSON.parse(new TextDecoder().decode(command.input.payload)).state.desired;
}

describe('homethermostatChangeState', () => {
  it('turns the device on by setting desired.on true', async () => {
    await handler({ thingName: 'ht-main', mode: 'ON', durationSeconds: 900 });

    expect(iotSend).toHaveBeenCalledOnce();
    const command = iotSend.mock.calls[0][0];
    expect(command.input.thingName).toBe('ht-main');
    expect(command.input.shadowName).toBe('ht-main_shadow');
    expect(desiredStateOf(command)).toEqual({ on: true });
  });

  it('turns the device off by setting desired.on false', async () => {
    await handler({ thingName: 'ht-immersion', mode: 'OFF' });

    expect(desiredStateOf(iotSend.mock.calls[0][0])).toEqual({ on: false });
  });

  it('treats any mode that is not the literal ON as off', async () => {
    await handler({ thingName: 'ht-main', mode: 'on' });

    expect(desiredStateOf(iotSend.mock.calls[0][0])).toEqual({ on: false });
  });

  it('records the new status against the configured table', async () => {
    await handler({ thingName: 'ht-main', mode: 'ON', durationSeconds: 900 });

    expect(dynamoSend).toHaveBeenCalledOnce();
    const { input } = dynamoSend.mock.calls[0][0];
    expect(input.TableName).toBe(TABLE);
    expect(input.Item.device.S).toBe('ht-main');
    expect(input.Item.mode.S).toBe(modes.ON.val);
  });

  it('stores an until when turning on for a duration', async () => {
    await handler({ thingName: 'ht-main', mode: 'ON', durationSeconds: 900 });

    const { Item } = dynamoSend.mock.calls[0][0].input;
    expect(Number(Item.until.N) - Number(Item.since.N)).toBe(900);
  });

  it('stores no until when turning off', async () => {
    await handler({ thingName: 'ht-main', mode: 'OFF', durationSeconds: 900 });

    expect(dynamoSend.mock.calls[0][0].input.Item.until).toBeUndefined();
  });

  it('keeps the execution arn so the schedule can later be cancelled', async () => {
    await handler({ thingName: 'ht-main', mode: 'ON', executionArn: 'arn:aws:states:::execution/x' });

    expect(dynamoSend.mock.calls[0][0].input.Item.executionArn.S).toBe('arn:aws:states:::execution/x');
  });

  it('returns the event with the time the change took effect', async () => {
    const event = { thingName: 'ht-main', mode: 'OFF', recurring: true };

    const result = await handler(event);

    expect(result).toMatchObject(event);
    expect(result.until).toBeCloseTo(Math.floor(Date.now() / 1000), -1);
  });

  it('records why the run ended when turning off', async () => {
    await handler({
      thingName: 'ht-main',
      mode: 'OFF',
      end: { endReason: 'target_temperature_reached', endTemperature: 45.2 },
    });

    const { Item } = dynamoSend.mock.calls[0][0].input;
    expect(Item.endReason.S).toBe('target_temperature_reached');
    expect(Item.endTemperature.N).toBe('45.2');
  });

  it('records a reason with no temperature when the run timed out', async () => {
    await handler({ thingName: 'ht-main', mode: 'OFF', end: { endReason: 'timed_out' } });

    const { Item } = dynamoSend.mock.calls[0][0].input;
    expect(Item.endReason.S).toBe('timed_out');
    expect(Item.endTemperature).toBeUndefined();
  });

  it('ignores an end reason handed to it when turning on', async () => {
    await handler({ thingName: 'ht-main', mode: 'ON', end: { endReason: 'timed_out' } });

    expect(dynamoSend.mock.calls[0][0].input.Item.endReason).toBeUndefined();
  });

  it('records no reason when the state machine supplies none', async () => {
    await handler({ thingName: 'ht-main', mode: 'OFF' });

    expect(dynamoSend.mock.calls[0][0].input.Item.endReason).toBeUndefined();
  });

  // The shadow update is what actually moves the relay. If it fails, recording an ON status
  // would leave the UI claiming the heating is on when it is not.
  it('does not record a status when the shadow update fails', async () => {
    iotSend.mockRejectedValue(new Error('iot unavailable'));

    await expect(handler({ thingName: 'ht-main', mode: 'ON' })).rejects.toThrow('iot unavailable');
    expect(dynamoSend).not.toHaveBeenCalled();
  });

  it('propagates a failure to record the status', async () => {
    dynamoSend.mockRejectedValue(new Error('table throttled'));

    await expect(handler({ thingName: 'ht-main', mode: 'ON' })).rejects.toThrow('table throttled');
  });
});
