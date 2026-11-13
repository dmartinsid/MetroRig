import { describe, it, expect } from 'vitest';
import {
  MAX_BAR_CELLS, MAX_PATTERN_CELLS, barBeatCells, barCells, barOffset, cellSpan, isTupletSignature, locateCell, patternCells, setBeatCells, stepUnits,
} from '../src/domain/layout';

const KICK = 1;
const SNARE = 2;
const HI_HAT = 3;
const [EMPTY, NORMAL, ACCENT, GHOST] = [0, 1, 2, 3];

// A pattern whose tracks hold the given steps
const patternOf = (timeSignature: string, measureLength: number, gridData: Record<number, number[]>, bars = 1) =>
  ({ timeSignature, measureLength, bars, gridData } as { timeSignature: string; measureLength: number; bars: number; beatCells?: number[][]; gridData: Record<number, number[]> });
const beatOne = (values: number[]) => [...values, ...new Array(12).fill(0)]; // Beat 1 of a 4/4 bar, the rest empty

const straight44 = { timeSignature: '4/4', measureLength: 16 };
// Beat 2 a triplet, beat 3 a sextuplet: 4 + 3 + 6 + 4 cells
const mixed44 = { timeSignature: '4/4', measureLength: 16, beatCells: [[4, 3, 6, 4]] };

describe('Layout', () => {
  it('a straight 4/4 bar holds 4 beats of 4 cells, each a sixteenth', () => {
    expect(barBeatCells(straight44, 0)).toEqual([4, 4, 4, 4]);
    expect(barCells(straight44, 0)).toBe(16);
    expect(patternCells(straight44)).toBe(16);
    expect([...stepUnits(straight44)]).toEqual(new Array(16).fill(12));
    expect(cellSpan(straight44, 0, 5)).toEqual([5 / 16, 6 / 16]);
  });

  it('a triplet beat holds 3 cells of 16 units and a sextuplet beat 6 cells of 8', () => {
    expect(barBeatCells(mixed44, 0)).toEqual([4, 3, 6, 4]);
    expect(barCells(mixed44, 0)).toBe(17);
    expect([...stepUnits(mixed44)]).toEqual([12, 12, 12, 12, 16, 16, 16, 8, 8, 8, 8, 8, 8, 12, 12, 12, 12]);
  });

  it('places each cell of a tuplet beat at its fraction of the bar', () => {
    // Triplet cells start at 1/4, 1/4 + 1/12 and 1/4 + 2/12
    const triplet = [4, 5, 6].map(cell => cellSpan(mixed44, 0, cell));
    triplet.forEach(([start, end], k) => {
      expect(start).toBeCloseTo(0.25 + k / 12, 12);
      expect(end).toBeCloseTo(0.25 + (k + 1) / 12, 12);
    });
    // Sextuplet cells start at 1/2 + k/24
    [7, 8, 9, 10, 11, 12].forEach((cell, k) => expect(cellSpan(mixed44, 0, cell)[0]).toBeCloseTo(0.5 + k / 24, 12));
    expect(cellSpan(mixed44, 0, 13)[0]).toBeCloseTo(0.75, 12);
    expect(cellSpan(mixed44, 0, 16)[1]).toBeCloseTo(1, 12);
  });

  it('locates a cell by bar, beat and place in its beat', () => {
    expect(locateCell(mixed44, 0)).toEqual({ bar: 0, beat: 0, index: 0, cells: 4, inBar: 0 });
    expect(locateCell(mixed44, 6)).toEqual({ bar: 0, beat: 1, index: 2, cells: 3, inBar: 6 });
    expect(locateCell(mixed44, 7)).toEqual({ bar: 0, beat: 2, index: 0, cells: 6, inBar: 7 });
    expect(locateCell(mixed44, 16)).toEqual({ bar: 0, beat: 3, index: 3, cells: 4, inBar: 16 });
    expect(locateCell(mixed44, 17)).toBeNull();
  });

  it('a 4-bar pattern lays out each bar on its own', () => {
    const pattern = { timeSignature: '4/4', measureLength: 16, bars: 4, beatCells: [[4, 4, 4, 4], [3, 4, 4, 4], [4, 4, 4, 4], [6, 6, 6, 6]] };
    expect([0, 1, 2, 3].map(bar => barCells(pattern, bar))).toEqual([16, 15, 16, 24]);
    expect([0, 1, 2, 3].map(bar => barOffset(pattern, bar))).toEqual([0, 16, 31, 47]);
    expect(patternCells(pattern)).toBe(71);
    expect(locateCell(pattern, 16)).toEqual({ bar: 1, beat: 0, index: 0, cells: 3, inBar: 0 });
    expect(locateCell(pattern, 31)).toEqual({ bar: 2, beat: 0, index: 0, cells: 4, inBar: 0 });
    expect(locateCell(pattern, 70)).toEqual({ bar: 3, beat: 3, index: 5, cells: 6, inBar: 23 });
    const units = stepUnits(pattern);
    expect(units.length).toBe(71);
    expect([...units.slice(16, 19)]).toEqual([16, 16, 16]);
    expect([...units.slice(47)]).toEqual(new Array(24).fill(8));
  });

  it('a 4-bar pattern with no beat cells is bars times its straight bar', () => {
    const pattern = { timeSignature: '3/4', measureLength: 12, bars: 4 };
    expect(patternCells(pattern)).toBe(48);
    expect(barOffset(pattern, 3)).toBe(36);
    expect(locateCell(pattern, 13)).toEqual({ bar: 1, beat: 0, index: 1, cells: 4, inBar: 1 });
  });

  it('/8 and /16 bars stay straight, whatever beat cells they carry', () => {
    expect(isTupletSignature('4/4')).toBe(true);
    expect(isTupletSignature('7/4')).toBe(true);
    expect(isTupletSignature('6/8')).toBe(false);
    expect(isTupletSignature('5/16')).toBe(false);

    const sixEight = { timeSignature: '6/8', measureLength: 12, beatCells: [[3, 3, 3, 3, 3, 3]] };
    expect(barBeatCells(sixEight, 0)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(patternCells(sixEight)).toBe(12);
    expect([...stepUnits(sixEight)]).toEqual(new Array(12).fill(12));
    expect(cellSpan(sixEight, 0, 3)).toEqual([3 / 12, 4 / 12]);

    const fiveSixteen = { timeSignature: '5/16', measureLength: 5, beatCells: [[6, 6, 6, 6, 6]] };
    expect(barBeatCells(fiveSixteen, 0)).toEqual([1, 1, 1, 1, 1]);
    expect([...stepUnits(fiveSixteen)]).toEqual([12, 12, 12, 12, 12]);
  });

  it('a bar holds up to 48 cells and a pattern 192', () => {
    expect(MAX_BAR_CELLS).toBe(48);
    expect(MAX_PATTERN_CELLS).toBe(192);
    const allSextuplets = { timeSignature: '8/4', measureLength: 32, bars: 4, beatCells: new Array(4).fill(new Array(8).fill(6)) };
    expect(barCells(allSextuplets, 0)).toBe(MAX_BAR_CELLS);
    expect(patternCells(allSextuplets)).toBe(MAX_PATTERN_CELLS);
    expect(stepUnits(allSextuplets).reduce((sum, u) => sum + u, 0)).toBe(4 * 32 * 12);
  });
});

describe('Layout', () => {
  it('tup_06 hits move to the nearest cell, earlier on a tie', () => {
    // Straight cells start at 0, 1/4, 1/2 and 3/4 of the beat; triplet cells at 0, 1/3 and 2/3
    const toTriplet = patternOf('4/4', 16, { [KICK]: beatOne([0, 1, 0, 0]), [SNARE]: beatOne([0, 0, 1, 0]), [HI_HAT]: beatOne([1, 0, 0, 1]) });
    setBeatCells(toTriplet, 0, 0, 3);
    expect(toTriplet.gridData[KICK].slice(0, 3)).toEqual([0, 1, 0]); // 1/4 is nearest 1/3
    expect(toTriplet.gridData[SNARE].slice(0, 3)).toEqual([0, 1, 0]); // 1/2 ties 1/3 and 2/3: the earlier
    expect(toTriplet.gridData[HI_HAT].slice(0, 3)).toEqual([1, 0, 1]); // 0 stays, 3/4 is nearest 2/3
    expect(toTriplet.gridData[KICK]).toHaveLength(15);

    // Triplet back to straight: 1/3 is nearest 1/4, 2/3 nearest 3/4
    const toStraight = patternOf('4/4', 16, { [KICK]: [0, 1, 0, ...new Array(12).fill(0)], [SNARE]: [0, 0, 1, ...new Array(12).fill(0)] });
    toStraight.beatCells = [[3, 4, 4, 4]];
    setBeatCells(toStraight, 0, 0, 4);
    expect(toStraight.gridData[KICK].slice(0, 4)).toEqual([0, 1, 0, 0]);
    expect(toStraight.gridData[SNARE].slice(0, 4)).toEqual([0, 0, 0, 1]);

    // Sextuplet to triplet: 1/6 ties 0 and 1/3, 3/6 ties 1/3 and 2/3, 5/6 is nearest 2/3
    const sixToThree = patternOf('4/4', 16, { [KICK]: [0, 1, 0, 0, 0, 0, ...new Array(12).fill(0)], [SNARE]: [0, 0, 0, 1, 0, 0, ...new Array(12).fill(0)], [HI_HAT]: [0, 0, 0, 0, 0, 1, ...new Array(12).fill(0)] });
    sixToThree.beatCells = [[6, 4, 4, 4]];
    setBeatCells(sixToThree, 0, 0, 3);
    expect(sixToThree.gridData[KICK].slice(0, 3)).toEqual([1, 0, 0]);
    expect(sixToThree.gridData[SNARE].slice(0, 3)).toEqual([0, 1, 0]);
    expect(sixToThree.gridData[HI_HAT].slice(0, 3)).toEqual([0, 0, 1]);
    expect(sixToThree.beatCells).toEqual([[3, 4, 4, 4]]);

    // Straight to sextuplet: 1/4 ties 1/6 and 2/6, 3/4 ties 4/6 and 5/6
    const toSextuplet = patternOf('4/4', 16, { [KICK]: beatOne([0, 1, 0, 0]), [SNARE]: beatOne([0, 0, 0, 1]) });
    setBeatCells(toSextuplet, 0, 0, 6);
    expect(toSextuplet.gridData[KICK].slice(0, 6)).toEqual([0, 1, 0, 0, 0, 0]);
    expect(toSextuplet.gridData[SNARE].slice(0, 6)).toEqual([0, 0, 0, 0, 1, 0]);
    expect(toSextuplet.gridData[KICK]).toHaveLength(18);
  });

  it('tup_07 triplet cell k becomes sextuplet cell 2k', () => {
    const pattern = patternOf('4/4', 16, { [SNARE]: [NORMAL, ACCENT, GHOST, ...new Array(12).fill(0)] });
    pattern.beatCells = [[3, 4, 4, 4]];
    setBeatCells(pattern, 0, 0, 6);
    expect(pattern.gridData[SNARE].slice(0, 6)).toEqual([NORMAL, EMPTY, ACCENT, EMPTY, GHOST, EMPTY]);
    expect(pattern.beatCells).toEqual([[6, 4, 4, 4]]);
  });

  it('tup_08 a clash keeps the stronger hit', () => {
    // Straight cells 1 and 2 both land on triplet cell 1
    const cases: [number, number, number][] = [
      [GHOST, ACCENT, ACCENT], [ACCENT, GHOST, ACCENT],
      [NORMAL, GHOST, NORMAL], [GHOST, NORMAL, NORMAL],
      [ACCENT, NORMAL, ACCENT], [NORMAL, ACCENT, ACCENT],
    ];
    for (const [first, second, kept] of cases) {
      const pattern = patternOf('4/4', 16, { [SNARE]: beatOne([0, first, second, 0]) });
      setBeatCells(pattern, 0, 0, 3);
      expect(pattern.gridData[SNARE].slice(0, 3), `${first} and ${second}`).toEqual([0, kept, 0]);
    }
  });

  it('tup_15 the click stays on the beat start', () => {
    const click = [ACCENT, 0, 0, 0, NORMAL, 0, 0, 0, NORMAL, 0, 0, 0, NORMAL, 0, 0, 0];
    const pattern = patternOf('4/4', 16, { 0: [...click] });
    setBeatCells(pattern, 0, 1, 3);
    expect(pattern.gridData[0]).toEqual([ACCENT, 0, 0, 0, NORMAL, 0, 0, NORMAL, 0, 0, 0, NORMAL, 0, 0, 0]);
    setBeatCells(pattern, 0, 1, 6);
    expect(pattern.gridData[0].slice(4, 10)).toEqual([NORMAL, 0, 0, 0, 0, 0]);
    setBeatCells(pattern, 0, 1, 4);
    expect(pattern.gridData[0]).toEqual(click);
  });

  it('a change of kind leaves the other bars and beats as they were', () => {
    const bar = (seed: number) => Array.from({ length: 16 }, (_, step) => ((step + seed) % 4 === 0 ? NORMAL : EMPTY));
    const kick = [...bar(0), ...bar(1), ...bar(2), ...bar(3)];
    const pattern = patternOf('4/4', 16, { [KICK]: [...kick] }, 4);
    setBeatCells(pattern, 1, 2, 3);
    expect(pattern.beatCells).toEqual([[4, 4, 4, 4], [4, 4, 3, 4], [4, 4, 4, 4], [4, 4, 4, 4]]);
    expect(pattern.gridData[KICK]).toHaveLength(63);
    expect(pattern.gridData[KICK].slice(0, 16)).toEqual(bar(0));
    expect(pattern.gridData[KICK].slice(16, 24)).toEqual(bar(1).slice(0, 8));
    expect(pattern.gridData[KICK].slice(27, 31)).toEqual(bar(1).slice(12));
    expect(pattern.gridData[KICK].slice(31)).toEqual([...bar(2), ...bar(3)]);
  });

  it('beat cells are dropped once every beat is straight again', () => {
    const pattern = patternOf('4/4', 16, { [KICK]: beatOne([1, 0, 0, 0]) }, 1);
    setBeatCells(pattern, 0, 3, 6);
    expect(pattern.beatCells).toEqual([[4, 4, 4, 6]]);
    setBeatCells(pattern, 0, 3, 4);
    expect(pattern.beatCells).toBeUndefined();
    expect(pattern.gridData[KICK]).toEqual(beatOne([1, 0, 0, 0]));
  });

  it('a /8 bar keeps its cells', () => {
    const steps = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
    const pattern = patternOf('6/8', 12, { [KICK]: [...steps] });
    setBeatCells(pattern, 0, 0, 3);
    expect(pattern.gridData[KICK]).toEqual(steps);
    expect(pattern.beatCells).toBeUndefined();
  });
});
