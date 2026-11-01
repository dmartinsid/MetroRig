import type { Preset } from './state';

type Pattern = Pick<Preset, 'measureLength' | 'bars'>;

export function barCount(pattern: Pattern): number {
  return pattern.bars ?? 1;
}

export function patternLength(pattern: Pattern): number {
  return pattern.measureLength * barCount(pattern);
}

export function barOfStep(step: number, measureLength: number): number {
  return Math.floor(step / measureLength);
}

export function stepInBar(step: number, measureLength: number): number {
  return step % measureLength;
}

export function barSteps(steps: number[], bar: number, measureLength: number): number[] {
  return steps.slice(bar * measureLength, (bar + 1) * measureLength);
}

export function writeBar(steps: number[], bar: number, measureLength: number, values: number[]): void {
  for (let step = 0; step < measureLength; step++) steps[bar * measureLength + step] = values[step] ?? 0;
}
