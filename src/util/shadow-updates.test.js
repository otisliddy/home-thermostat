import { describe, expect, it } from 'vitest';
import { shadowStateOf } from './shadow-updates';

describe('shadowStateOf', () => {
  it('reads the reported half of an accepted update', () => {
    const state = shadowStateOf({ state: { reported: { on: true } } });

    expect(state.reported).toEqual({ on: true });
    expect(state.desired).toBe(null);
  });

  it('reads it out of a value wrapper', () => {
    expect(shadowStateOf({ value: { state: { reported: { on: false } } } }).reported)
      .toEqual({ on: false });
  });

  it('falls back to the current document when the delta carries one', () => {
    const message = { current: { state: { reported: { on: true, connected: true } } } };

    expect(shadowStateOf(message).reported).toEqual({ on: true, connected: true });
  });

  // This app's own instruction on its way to the device. It still means something changed.
  it('reports a desired-only update rather than discarding it', () => {
    const state = shadowStateOf({ state: { desired: { on: true } } });

    expect(state.desired).toEqual({ on: true });
    expect(state.reported).toBe(null);
  });

  it('survives a message with no payload', () => {
    expect(shadowStateOf(undefined)).toBe(null);
    expect(shadowStateOf({})).toBe(null);
  });
});
