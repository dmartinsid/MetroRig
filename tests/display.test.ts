import { describe, it, expect } from 'vitest';
import { formatClock, formatBarStep, formatLatency, formatSteps, formatTimer, nextDenominator } from '../src/display';

describe('Display rules', () => {
  it('time_01 timer format', () => {
    expect(formatTimer(0)).toBe('00:00:00');
    expect(formatTimer(59)).toBe('00:00:59');
    expect(formatTimer(61)).toBe('00:01:01');
    expect(formatTimer(3600 + 240 + 12)).toBe('01:04:12');
  });

  it('time_05 hours past 99', () => {
    expect(formatTimer(99 * 3600 + 59 * 60 + 59)).toBe('99:59:59');
    expect(formatTimer(100 * 3600)).toBe('100:00:00');
  });

  it('clock label shows the rate and the render quantum', () => {
    expect(formatClock(44100)).toBe('AUDIO CLOCK: 44.1 kHz 128 SPLS (2.9ms)');
    expect(formatClock(48000)).toBe('AUDIO CLOCK: 48.0 kHz 128 SPLS (2.7ms)');
  });

  it('latency label shows a value or a placeholder', () => {
    expect(formatLatency(null)).toBe('LATENCY: --');
    expect(formatLatency(12.34)).toBe('LATENCY: 12.3ms');
    expect(formatLatency(0)).toBe('LATENCY: 0.0ms');
  });

  it('position label pads bar and step', () => {
    expect(formatBarStep(1, 1)).toBe('BAR 01 · STEP 01');
    expect(formatBarStep(12, 32)).toBe('BAR 12 · STEP 32');
    expect(formatBarStep(100, 3)).toBe('BAR 100 · STEP 03');
  });

  it('steps label reads the measure over the engine limit', () => {
    expect(formatSteps(16)).toBe('STEPS: 16/32');
    expect(formatSteps(7)).toBe('STEPS: 7/32');
  });

  it('denominator moves through 4, 8 and 16 and stops at each end', () => {
    expect(nextDenominator(4, 1)).toBe(8);
    expect(nextDenominator(8, 1)).toBe(16);
    expect(nextDenominator(16, 1)).toBe(16);
    expect(nextDenominator(16, -1)).toBe(8);
    expect(nextDenominator(8, -1)).toBe(4);
    expect(nextDenominator(4, -1)).toBe(4);
  });
});
