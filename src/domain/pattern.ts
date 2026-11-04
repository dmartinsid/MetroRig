type Pattern = { measureLength: number; bars?: number }; // A Preset, or anything shaped like its pattern

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

// Rhythmic figures one quarter note long, stamped onto the grid in one click
export const FIGURES = [
  { id: 'quarter', name: 'Quarter', pattern: [1, 0, 0, 0] },
  { id: 'eighths', name: 'Eighths', pattern: [1, 0, 1, 0] },
  { id: 'gallop', name: 'Gallop', pattern: [1, 0, 1, 1] },
  { id: 'reverse_gallop', name: 'Rev. Gallop', pattern: [1, 1, 0, 1] },
  { id: 'sixteenths', name: '16ths', pattern: [1, 1, 1, 1] },
  { id: 'rest', name: 'Rest', pattern: [0, 0, 0, 0] },
];

// Writes a figure over the quarter note containing step, clipped to the measure
export function applyFigure(steps: number[], step: number, pattern: number[], measureLength: number): void {
  const start = step - (step % pattern.length);
  pattern.forEach((value, i) => {
    if (start + i < measureLength) steps[start + i] = value;
  });
}
