import { PubSub } from '@aws-amplify/pubsub';

const IOT_WSS_ENDPOINT = 'wss://a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com/mqtt';

const pubsub = new PubSub({ region: 'eu-west-1', endpoint: IOT_WSS_ENDPOINT });

const acceptedTopic = (device) => `$aws/things/${device}/shadow/name/${device}_shadow/update/accepted`;

/*
 * An accepted update reports only what changed, so either half can be absent: a desired-only
 * update is an instruction on its way to the device, a reported one is the device answering.
 */
function shadowStateOf(message) {
  const payload = message?.value ?? message;
  const state = payload?.state ?? payload?.current?.state;

  if (!state) return null;

  return { reported: state.reported ?? null, desired: state.desired ?? null };
}

// An accepted update carries no thing name, so each device needs its own subscription.
export function subscribeToShadowUpdates(devices, onUpdate, onError) {
  const subscriptions = devices.map((device) =>
    pubsub.subscribe({ topics: [acceptedTopic(device)] }).subscribe({
      next: (message) => {
        const state = shadowStateOf(message);
        if (state) {
          onUpdate(device, state);
        }
      },
      error: (error) => onError?.(device, error)
    })
  );

  return () => subscriptions.forEach((subscription) => subscription.unsubscribe());
}

export { shadowStateOf };
