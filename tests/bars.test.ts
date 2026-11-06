import { describe, it, expect } from 'vitest';
import { barCount, barOfStep, barSteps, fitBar, patternLength, stepInBar, writeBar } from '../src/domain/pattern';

describe('Bars', () => {
  it('a pattern with no bar count holds 1 bar', () => {
    expect(barCount({ measureLength: 16 })).toBe(1);
    expect(patternLength({ measureLength: 12 })).toBe(12);
  });

  it('a pattern of 4 bars holds 4 times its bar', () => {
    expect(barCount({ measureLength: 16, bars: 4 })).toBe(4);
    expect(patternLength({ measureLength: 16, bars: 4 })).toBe(64);
    expect(patternLength({ measureLength: 12, bars: 4 })).toBe(48);
  });

  it('places every bar boundary', () => {
    for (const [step, bar, inBar] of [[0, 0, 0], [15, 0, 15], [16, 1, 0], [31, 1, 15], [32, 2, 0], [48, 3, 0], [63, 3, 15]]) {
      expect(barOfStep(step, 16)).toBe(bar);
      expect(stepInBar(step, 16)).toBe(inBar);
    }
  });

  it('reads each bar of a pattern', () => {
    const steps = Array.from({ length: 16 }, (_, step) => step);
    expect(barSteps(steps, 0, 4)).toEqual([0, 1, 2, 3]);
    expect(barSteps(steps, 3, 4)).toEqual([12, 13, 14, 15]);
  });

  it('copies one bar, cut or padded with rests to a length', () => {
    const steps = Array.from({ length: 8 }, (_, step) => step + 1);
    expect(fitBar(steps, 1, 4, 4)).toEqual([5, 6, 7, 8]);
    expect(fitBar(steps, 0, 4, 2)).toEqual([1, 2]);
    expect(fitBar(steps, 1, 4, 6)).toEqual([5, 6, 7, 8, 0, 0]);
    expect(fitBar([], 0, 4, 3)).toEqual([0, 0, 0]);
    const copy = fitBar(steps, 0, 4, 4);
    copy[0] = 9;
    expect(steps[0]).toBe(1);
  });

  it('writes one bar and leaves the others', () => {
    const steps = new Array(16).fill(0);
    writeBar(steps, 2, 4, [1, 2, 3, 1]);
    expect(steps).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 1, 0, 0, 0, 0]);
  });

  it('writes a bar shorter than the measure as empty steps', () => {
    const steps = new Array(8).fill(1);
    writeBar(steps, 1, 4, [2]);
    expect(steps).toEqual([1, 1, 1, 1, 2, 0, 0, 0]);
  });
});
