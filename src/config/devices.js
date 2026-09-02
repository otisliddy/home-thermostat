import amplifyOutputs from '../../amplify_outputs.json';

const {oilThingName, immersionThingName, dhwTempThingName} = amplifyOutputs.custom;

// Fallbacks cover outputs generated before the thing names were published.
export const OIL = oilThingName ?? 'ht-main';
export const IMMERSION = immersionThingName ?? 'ht-immersion';
export const DHW_TEMP = dhwTempThingName ?? 'ht-dhw-temp';

export const RELAY_DEVICES = [OIL, IMMERSION];

const LABELS = {[OIL]: 'Oil', [IMMERSION]: 'Immersion'};

export const deviceLabel = (device) => LABELS[device] ?? device;
export const isOil = (device) => device === OIL;
