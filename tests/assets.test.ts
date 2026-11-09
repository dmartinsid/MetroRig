// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { withBase } from '../src/domain/assets';

describe('withBase', () => {
  it('joins a base to a root path with one slash', () => {
    expect(withBase('/MetroRig/', '/kit/ride.wav')).toBe('/MetroRig/kit/ride.wav');
    expect(withBase('/MetroRig', '/kit/ride.wav')).toBe('/MetroRig/kit/ride.wav');
    expect(withBase('/', '/kit/ride.wav')).toBe('/kit/ride.wav');
    expect(withBase('/', '/pkg/metrorig_audio_bg.wasm')).toBe('/pkg/metrorig_audio_bg.wasm');
    expect(withBase('/MetroRig/', '/pads/choir/C3.flac')).toBe('/MetroRig/pads/choir/C3.flac');
  });
});
