import { getBeatForStep, getBeatsPerMeasure } from './meter';

// A pattern's bar layout (AD-029): measureLength counts a bar's straight sixteenths, and beatCells,
// when present, holds each bar's cells per beat: 4 straight, 3 triplet or 6 sextuplet, in /4 only
export type Layout = { timeSignature: string; measureLength: number; bars?: number; beatCells?: number[][] };

export const MAX_BAR_CELLS = 48;
export const MAX_PATTERN_CELLS = 192;

const STRAIGHT_UNITS = 12; // A cell's length in twelfths of a sixteenth: a straight cell is one sixteenth

// Tuplets fill one quarter note, so only /4 signatures hold them
export function isTupletSignature(timeSignature: string | undefined): boolean {
  return timeSignature?.split('/')[1] === '4';
}

function barsOf(p: Layout): number {
  return p.bars ?? 1;
}

// The cells of each beat when every beat is straight: a beat holds the sixteenths that fall in it
function straightBeatCells(p: Layout): number[] {
  const beats = getBeatsPerMeasure(p.timeSignature, p.measureLength);
  const cells = new Array(beats).fill(0);
  for (let step = 0; step < p.measureLength; step++) cells[getBeatForStep(step, p.measureLength, beats)]++;
  return cells;
}

export function barBeatCells(p: Layout, bar: number): number[] {
  const stored = p.beatCells?.[bar];
  return stored && isTupletSignature(p.timeSignature) ? [...stored] : straightBeatCells(p);
}

export function barCells(p: Layout, bar: number): number {
  return barBeatCells(p, bar).reduce((sum, cells) => sum + cells, 0);
}

// The pattern cell where a bar starts
export function barOffset(p: Layout, bar: number): number {
  let offset = 0;
  for (let b = 0; b < bar; b++) offset += barCells(p, b);
  return offset;
}

export function patternCells(p: Layout): number {
  return barOffset(p, barsOf(p));
}

// A pattern cell's bar, beat, place in its beat, its beat's cell count and its place in the bar
export function locateCell(p: Layout, cell: number): { bar: number; beat: number; index: number; cells: number; inBar: number } | null {
  if (cell < 0) return null;
  let start = 0;
  for (let bar = 0; bar < barsOf(p); bar++) {
    const inBar = cell - start;
    const beats = barBeatCells(p, bar);
    const length = beats.reduce((sum, cells) => sum + cells, 0);
    if (inBar < length) {
      let index = inBar;
      for (let beat = 0; beat < beats.length; beat++) {
        if (index < beats[beat]) return { bar, beat, index, cells: beats[beat], inBar };
        index -= beats[beat];
      }
    }
    start += length;
  }
  return null;
}

// Each cell of a bar in twelfths of a sixteenth: a straight beat's cells are sixteenths, a /4 tuplet beat
// shares the quarter's 48 twelfths among its cells
function barUnits(p: Layout, bar: number): number[] {
  const straight = straightBeatCells(p);
  return barBeatCells(p, bar).flatMap((cells, beat) =>
    new Array(cells).fill(cells === straight[beat] ? STRAIGHT_UNITS : (STRAIGHT_UNITS * straight[beat]) / cells));
}

// Where a cell starts and ends, as fractions of its bar
export function cellSpan(p: Layout, bar: number, inBar: number): [number, number] {
  const units = barUnits(p, bar);
  const total = p.measureLength * STRAIGHT_UNITS;
  const start = units.slice(0, inBar).reduce((sum, u) => sum + u, 0);
  return [start / total, (start + units[inBar]) / total];
}

// Every cell's length for the engine: 12 straight, 16 triplet, 8 sextuplet
export function stepUnits(p: Layout): Uint8Array {
  return Uint8Array.from(Array.from({ length: barsOf(p) }, (_, bar) => barUnits(p, bar)).flat());
}
