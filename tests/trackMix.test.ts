import { describe, it, expect } from 'vitest';
import { audibleSteps, createTrackMix, isAudible, toggleMute, toggleSolo } from '../src/domain/mix';

const audible = (mix: ReturnType<typeof createTrackMix>) => [0, 1, 2, 3].filter(id => isAudible(mix, id));

describe('Track mix', () => {
  it('mute_04 solo isolates', () => {
    const mix = createTrackMix();
    expect(audible(mix)).toEqual([0, 1, 2, 3]);
    toggleSolo(mix, 2);
    expect(audible(mix)).toEqual([2]);
    toggleSolo(mix, 2);
    expect(audible(mix)).toEqual([0, 1, 2, 3]);
  });

  it('mute_05 solos add', () => {
    const mix = createTrackMix();
    toggleSolo(mix, 1);
    toggleSolo(mix, 3);
    expect(audible(mix)).toEqual([1, 3]);
  });

  it('mute_06 solo beats mute', () => {
    const mix = createTrackMix();
    toggleMute(mix, 1);
    expect(isAudible(mix, 1)).toBe(false);
    toggleSolo(mix, 1);
    expect(isAudible(mix, 1)).toBe(true);
  });

  it('audible steps keep their length and leave the input untouched', () => {
    const mix = createTrackMix();
    const steps = [1, 0, 2, 0];
    expect([...audibleSteps(mix, 1, steps)]).toEqual([1, 0, 2, 0]);

    toggleMute(mix, 1);
    expect([...audibleSteps(mix, 1, steps)]).toEqual([0, 0, 0, 0]);
    expect(steps).toEqual([1, 0, 2, 0]);
  });
});
