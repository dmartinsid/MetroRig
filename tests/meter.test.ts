import { describe, it, expect } from 'vitest';
import { isSustainedStep } from '../src/domain/meter';

// A 4/4 bar with a triplet on beat 2: cells 0-3 beat 1, 4-6 beat 2, 7-10 beat 3, 11-14 beat 4
const TRIPLET_ON_TWO = [4, 3, 4, 4];

describe('Meter', () => {
  it('tup_22 sustain follows the rule inside a tuplet beat', () => {
    // Two hits in the triplet: the empty cell after the first is sustained
    const twoHits = [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(isSustainedStep(twoHits, 5, TRIPLET_ON_TWO)).toBe(true);
    expect(isSustainedStep(twoHits, 4, TRIPLET_ON_TWO)).toBe(false); // A hit is never sustained
    expect(isSustainedStep(twoHits, 7, TRIPLET_ON_TWO)).toBe(false); // Beat 3 holds no hit
    expect(isSustainedStep(twoHits, 1, TRIPLET_ON_TWO)).toBe(false); // Beat 1 holds one hit

    // Hits on cells 1 and 2: cell 0 comes before the first hit, so it is not sustained
    const late = [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(isSustainedStep(late, 4, TRIPLET_ON_TWO)).toBe(false);
  });

  it('a tuplet beat with one hit sustains nothing', () => {
    const oneHit = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect([5, 6].map(cell => isSustainedStep(oneHit, cell, TRIPLET_ON_TWO))).toEqual([false, false]);
  });

  it('a sextuplet beat follows the same rule', () => {
    const sextuplet = [4, 4, 6, 4];
    const steps = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0];
    expect([9, 10, 12, 13].map(cell => isSustainedStep(steps, cell, sextuplet))).toEqual([true, true, true, true]);
    expect(isSustainedStep(steps, 14, sextuplet)).toBe(false); // Beat 4
  });

  it('straight beat cells give the same answers as the bar length and beats', () => {
    const gallop = [1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let step = 0; step < 16; step++) {
      expect(isSustainedStep(gallop, step, [4, 4, 4, 4]), `step ${step}`).toBe(isSustainedStep(gallop, step, 16, 4));
    }
    const sevenEight = [1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    for (let step = 0; step < 14; step++) {
      expect(isSustainedStep(sevenEight, step, [2, 2, 2, 2, 2, 2, 2]), `step ${step}`).toBe(isSustainedStep(sevenEight, step, 14, 7));
    }
  });
});
