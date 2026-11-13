import { describe, it, expect } from 'vitest';
import { FIGURES, applyFigureAt } from '../src/domain/pattern';
import { barBeatCells, patternCells } from '../src/domain/layout';

const CLICK = 0;
const KICK = 1;
const SNARE = 2;
const HI_HAT = 3;

const figure = (id: string) => FIGURES.find(f => f.id === id)!;
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

type Bars = { timeSignature: string; measureLength: number; bars: number; beatCells?: number[][]; gridData: Record<number, number[]> };

// A 4/4 bar: click on each beat, kick on 1 and 3, snare on 2 and 4, hi-hat eighths
function rockBar(): Bars {
  const steps = (hits: number[]) => range(0, 16).map(step => (hits.includes(step) ? 1 : 0));
  return {
    timeSignature: '4/4', measureLength: 16, bars: 1,
    gridData: { [CLICK]: steps([0, 4, 8, 12]), [KICK]: steps([0, 8]), [SNARE]: steps([4, 12]), [HI_HAT]: steps([0, 2, 4, 6, 8, 10, 12, 14]) },
  };
}

describe('Pattern', () => {
  it('tup_01 triplet lays 3 cells and 3 hits', () => {
    const pattern = rockBar();
    applyFigureAt(pattern, SNARE, 0, 13, figure('triplet'));
    expect(pattern.beatCells).toEqual([[4, 4, 4, 3]]);
    for (const steps of Object.values(pattern.gridData)) expect(steps).toHaveLength(15);
    expect(pattern.gridData[SNARE].slice(12)).toEqual([1, 1, 1]);
    expect(pattern.gridData[SNARE].slice(0, 12)).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
    // The other tracks' beat 4 holds 3 cells: the hi-hat's eighths land on 0 and 1/3, the click stays on the beat
    expect(pattern.gridData[HI_HAT].slice(12)).toEqual([1, 1, 0]);
    expect(pattern.gridData[CLICK].slice(12)).toEqual([1, 0, 0]);
    expect(pattern.gridData[KICK].slice(12)).toEqual([0, 0, 0]);
  });

  it('tup_02 triplet rest lays 3 empty cells', () => {
    const pattern = rockBar();
    applyFigureAt(pattern, SNARE, 0, 12, figure('triplet_rest'));
    expect(pattern.beatCells).toEqual([[4, 4, 4, 3]]);
    for (const steps of Object.values(pattern.gridData)) expect(steps).toHaveLength(15);
    expect(pattern.gridData[SNARE].slice(12)).toEqual([0, 0, 0]);
    expect(pattern.gridData[HI_HAT].slice(12)).toEqual([1, 1, 0]);
  });

  it('tup_03 sextuplet lays 6 cells and 6 hits', () => {
    const pattern = rockBar();
    applyFigureAt(pattern, SNARE, 0, 5, figure('sextuplet'));
    expect(pattern.beatCells).toEqual([[4, 6, 4, 4]]);
    for (const steps of Object.values(pattern.gridData)) expect(steps).toHaveLength(18);
    expect(pattern.gridData[SNARE].slice(4, 10)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(pattern.gridData[SNARE].slice(10)).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
    // Eighths at 0 and 1/2 of the beat land on sextuplet cells 0 and 3
    expect(pattern.gridData[HI_HAT].slice(4, 10)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('tup_04 sextuplet rest lays 6 empty cells', () => {
    const pattern = rockBar();
    applyFigureAt(pattern, SNARE, 0, 4, figure('sextuplet_rest'));
    expect(pattern.beatCells).toEqual([[4, 6, 4, 4]]);
    for (const steps of Object.values(pattern.gridData)) expect(steps).toHaveLength(18);
    expect(pattern.gridData[SNARE].slice(4, 10)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(pattern.gridData[CLICK].slice(4, 10)).toEqual([1, 0, 0, 0, 0, 0]);
  });

  it('tup_05 straight figure returns a tuplet beat to 4 cells', () => {
    const pattern = rockBar();
    applyFigureAt(pattern, SNARE, 0, 4, figure('triplet'));
    applyFigureAt(pattern, SNARE, 0, 6, figure('eighths'));
    expect(pattern.beatCells).toBeUndefined();
    for (const steps of Object.values(pattern.gridData)) expect(steps).toHaveLength(16);
    expect(pattern.gridData[SNARE].slice(4, 8)).toEqual([1, 0, 1, 0]);
    expect(pattern.gridData[SNARE].slice(12, 16)).toEqual([1, 0, 0, 0]);

    // A straight figure after a tuplet beat lands on that beat's own cells
    const mixed = rockBar();
    applyFigureAt(mixed, SNARE, 0, 0, figure('sextuplet'));
    applyFigureAt(mixed, KICK, 0, 6 + 4, figure('gallop'));
    expect(mixed.gridData[KICK].slice(10, 14)).toEqual([1, 0, 1, 1]);
    expect(barBeatCells(mixed, 0)).toEqual([6, 4, 4, 4]);
  });

  it('a tuplet figure in one bar of four leaves the other bars', () => {
    const pattern = rockBar();
    pattern.bars = 4;
    for (const id of Object.keys(pattern.gridData)) {
      const bar = pattern.gridData[Number(id)];
      pattern.gridData[Number(id)] = [...bar, ...bar, ...bar, ...bar];
    }
    const before = structuredClone(pattern.gridData);
    applyFigureAt(pattern, SNARE, 1, 9, figure('triplet'));
    expect(pattern.beatCells).toEqual([[4, 4, 4, 4], [4, 4, 3, 4], [4, 4, 4, 4], [4, 4, 4, 4]]);
    expect(patternCells(pattern)).toBe(63);
    for (const [id, steps] of Object.entries(pattern.gridData)) {
      expect(steps.slice(0, 16)).toEqual(before[Number(id)].slice(0, 16));
      expect(steps.slice(31)).toEqual(before[Number(id)].slice(32));
    }
    expect(pattern.gridData[SNARE].slice(24, 27)).toEqual([1, 1, 1]);
  });

  it('a tuplet figure in 6/8 changes nothing', () => {
    const pattern: Bars = { timeSignature: '6/8', measureLength: 12, bars: 1, gridData: { [SNARE]: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0] } };
    const before = structuredClone(pattern);
    for (const id of ['triplet', 'triplet_rest', 'sextuplet', 'sextuplet_rest']) applyFigureAt(pattern, SNARE, 0, 3, figure(id));
    expect(pattern).toEqual(before);

    // A straight figure there stamps its quarter note as before
    applyFigureAt(pattern, SNARE, 0, 5, figure('sixteenths'));
    expect(pattern.gridData[SNARE]).toEqual([1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0]);
  });

  it('the four tuplet figures fill 3 or 6 cells, the straight ones 4', () => {
    expect(['triplet', 'triplet_rest', 'sextuplet', 'sextuplet_rest'].map(id => [figure(id).name, figure(id).pattern, figure(id).cells])).toEqual([
      ['Triplet', [1, 1, 1], 3], ['Triplet Rest', [0, 0, 0], 3], ['Sextuplet', [1, 1, 1, 1, 1, 1], 6], ['Sextuplet Rest', [0, 0, 0, 0, 0, 0], 6],
    ]);
    for (const id of ['quarter', 'eighths', 'gallop', 'reverse_gallop', 'sixteenths', 'rest']) expect(figure(id).cells).toBe(4);
  });
});
