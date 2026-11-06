import { describe, it, expect } from 'vitest';
import { formatClock, formatBarStep, formatLatency, formatLiveBpm, formatSteps, formatTimer, formatTrainerStatus, nextDenominator } from '../src/ui/format';

describe('Display rules', () => {
  it('prints the Trainer fields as typed', () => {
    const typed = { enabled: true, startBpm: '080', targetBpm: '160', increment: '', stepType: 'measures', stepValue: '1.0' };
    expect(formatTrainerStatus(typed)).toBe('Trainer 080 → 160 BPM · + every 1.0 bars');
    expect(formatTrainerStatus({ ...typed, startBpm: '148', targetBpm: '190', increment: '2', stepValue: '3' })).toBe('Trainer 148 → 190 BPM · +2 every 3 bars');
    expect(formatTrainerStatus({ ...typed, stepValue: '1' })).toBe('Trainer 080 → 160 BPM · + every 1 bar');
    expect(formatTrainerStatus({ ...typed, stepType: 'seconds' })).toBe('Trainer 080 → 160 BPM · + every 1.0 s');
    expect(formatTrainerStatus({ ...typed, enabled: false })).toBe('Trainer Off');
  });

  it('prints a stepped tempo as an integer and a smooth one with a decimal', () => {
    expect(formatLiveBpm(120)).toBe('120');
    expect(formatLiveBpm(121.37)).toBe('121.4');
  });

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

  it('steps label reads the pattern over the engine limit', () => {
    expect(formatSteps(16)).toBe('STEPS: 16/128');
    expect(formatSteps(7)).toBe('STEPS: 7/128');
    expect(formatSteps(64)).toBe('STEPS: 64/128');
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
