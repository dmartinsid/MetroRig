import { barBeatCells, barOffset, isTupletSignature, patternCells, setBeatCells, type Layout } from './layout';

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

// A copy of one bar, cut or padded with rests to length steps
export function fitBar(steps: number[], bar: number, measureLength: number, length: number): number[] {
  const source = barSteps(steps, bar, measureLength);
  return Array.from({ length }, (_, step) => source[step] ?? 0);
}

export function writeBar(steps: number[], bar: number, measureLength: number, values: number[]): void {
  for (let step = 0; step < measureLength; step++) steps[bar * measureLength + step] = values[step] ?? 0;
}

// Rhythmic figures one quarter note long, stamped onto the grid in one click. cells: the beat's cells the figure fills
export const FIGURES = [
  { id: 'quarter', name: 'Quarter', pattern: [1, 0, 0, 0], cells: 4 },
  { id: 'eighths', name: 'Eighths', pattern: [1, 0, 1, 0], cells: 4 },
  { id: 'gallop', name: 'Gallop', pattern: [1, 0, 1, 1], cells: 4 },
  { id: 'reverse_gallop', name: 'Rev. Gallop', pattern: [1, 1, 0, 1], cells: 4 },
  { id: 'sixteenths', name: '16ths', pattern: [1, 1, 1, 1], cells: 4 },
  { id: 'rest', name: 'Rest', pattern: [0, 0, 0, 0], cells: 4 },
  { id: 'triplet', name: 'Triplet', pattern: [1, 1, 1], cells: 3 },
  { id: 'triplet_rest', name: 'Triplet Rest', pattern: [0, 0, 0], cells: 3 },
  { id: 'sextuplet', name: 'Sextuplet', pattern: [1, 1, 1, 1, 1, 1], cells: 6 },
  { id: 'sextuplet_rest', name: 'Sextuplet Rest', pattern: [0, 0, 0, 0, 0, 0], cells: 6 },
];

// Writes a figure over the quarter note containing step, clipped to the measure
export function applyFigure(steps: number[], step: number, pattern: number[], measureLength: number): void {
  const start = step - (step % pattern.length);
  pattern.forEach((value, i) => {
    if (start + i < measureLength) steps[start + i] = value;
  });
}

// Stamps a figure over the beat holding cell `cell` of a bar, on one track. In /4 a figure of other cells
// first re-lays that beat on every track. Outside /4 a tuplet figure changes nothing, and a straight one
// stamps its quarter note as applyFigure does
export function applyFigureAt(
  p: Layout & { gridData: Record<number, number[]> },
  trackId: number,
  bar: number,
  cell: number,
  figure: { pattern: number[]; cells: number },
): void {
  if (!isTupletSignature(p.timeSignature)) {
    if (figure.cells !== 4) return;
    const steps = p.gridData[trackId] ??= new Array(patternCells(p)).fill(0);
    const values = barSteps(steps, bar, p.measureLength);
    applyFigure(values, cell, figure.pattern, p.measureLength);
    writeBar(steps, bar, p.measureLength, values);
    return;
  }

  const beats = barBeatCells(p, bar);
  let beat = 0;
  let start = 0;
  while (beat < beats.length - 1 && cell >= start + beats[beat]) start += beats[beat++];
  setBeatCells(p, bar, beat, figure.cells);
  const steps = p.gridData[trackId] ??= new Array(patternCells(p)).fill(0);
  const offset = barOffset(p, bar) + start;
  figure.pattern.forEach((value, i) => { steps[offset + i] = value; });
}
