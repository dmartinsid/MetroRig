import { describe, it, expect } from 'vitest';
import { completeKit, normalizePreset, type Preset } from '../src/domain/preset';
import { patternCells, stepUnits } from '../src/domain/layout';
import { TRACKS } from '../src/domain/kit';

const trainerSettings: Preset['trainerSettings'] = { enabled: false, startBpm: 100, targetBpm: 150, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' };
const hits = (length: number, seed: number) => Array.from({ length }, (_, step) => ((step + seed) % 5 === 0 ? 1 + ((step + seed) % 3) : 0));

const preset = (fields: Partial<Preset>): Preset => ({
  id: 'user_1', name: 'Saved', bpm: 100, timeSignature: '4/4', measureLength: 16, gridData: {}, trainerSettings, ...fields,
});

// 4 bars of 4/4: bar 2 holds a triplet on beat 2, bar 4 a sextuplet on beat 4
const tupletBars = [[4, 4, 4, 4], [4, 3, 4, 4], [4, 4, 4, 4], [4, 4, 4, 6]];
const tupletPreset = () => preset({ bars: 4, beatCells: structuredClone(tupletBars), gridData: { 1: hits(65, 0), 2: hits(65, 1), 3: hits(65, 2) } });

describe('Preset', () => {
  it('tup_28 an old preset loads straight and unchanged', () => {
    const grid = { 0: hits(64, 0), 1: hits(64, 1), 2: hits(64, 2), 3: hits(64, 3) };
    const old = preset({ bars: 4, gridData: structuredClone(grid) });

    const loaded = completeKit(normalizePreset(old));

    expect(loaded.beatCells).toBeUndefined();
    expect(loaded.bars).toBe(4);
    for (const [trackId, steps] of Object.entries(grid)) expect(loaded.gridData[Number(trackId)]).toEqual(steps);
    expect(patternCells(loaded)).toBe(64);
    expect([...stepUnits(loaded)]).toEqual(new Array(64).fill(12));
  });

  it('a tuplet preset keeps its beats and hits through normalize and the kit', () => {
    const stored = tupletPreset();

    const loaded = completeKit(normalizePreset(stored));

    expect(loaded.beatCells).toEqual(tupletBars);
    expect(loaded.bars).toBe(4);
    expect(loaded.gridData[1]).toEqual(hits(65, 0));
    expect(loaded.gridData[3]).toEqual(hits(65, 2));
    // Tracks the record lacks fill every cell of the pattern
    for (const { id } of TRACKS) expect(loaded.gridData[id], `track ${id}`).toHaveLength(65);
    expect(stored.beatCells).toEqual(tupletBars);
  });

  it('a malformed layout is dropped and the pattern falls back to its first bar', () => {
    const malformed: unknown[] = [
      [[4, 4, 4, 4], [4, 5, 4, 4], [4, 4, 4, 4], [4, 4, 4, 6]], // 5 cells is no kind
      [[4, 4, 4], [4, 3, 4], [4, 4, 4], [4, 4, 6]], // 3 beats in 4/4
      [[4, 3, 4, 4]], // 1 bar of 4
      'triplets',
      [[4, '3', 4, 4], [4, 4, 4, 4], [4, 4, 4, 4], [4, 4, 4, 4]],
    ];
    for (const beatCells of malformed) {
      const loaded = normalizePreset(preset({ bars: 4, beatCells: beatCells as number[][], gridData: { 1: hits(65, 0) } }));
      expect(loaded.beatCells, JSON.stringify(beatCells)).toBeUndefined();
      expect(loaded.bars).toBe(1);
      expect(loaded.gridData[1]).toEqual(hits(65, 0).slice(0, 16));
    }
  });

  it('beat cells in a /8 signature are dropped', () => {
    const loaded = normalizePreset(preset({ timeSignature: '6/8', measureLength: 12, beatCells: [[3, 2, 2, 2, 2, 2]], gridData: { 1: hits(13, 0) } }));
    expect(loaded.beatCells).toBeUndefined();
    expect(loaded.gridData[1]).toEqual(hits(13, 0).slice(0, 12));
  });

  it('a layout of straight beats only is dropped, leaving the hits', () => {
    const loaded = normalizePreset(preset({ bars: 4, beatCells: new Array(4).fill([4, 4, 4, 4]), gridData: { 1: hits(64, 0) } }));
    expect(loaded.beatCells).toBeUndefined();
    expect(loaded.bars).toBe(4);
    expect(loaded.gridData[1]).toEqual(hits(64, 0));
  });

  it('cells that do not fit a valid layout fall back to the first bar and its beats', () => {
    const firstTriplet = [[3, 4, 4, 4], [4, 4, 4, 4], [4, 4, 4, 4], [4, 4, 4, 4]];
    const loaded = normalizePreset(preset({ bars: 4, beatCells: firstTriplet, gridData: { 1: hits(64, 0) } }));
    expect(loaded.bars).toBe(1);
    expect(loaded.beatCells).toEqual([[3, 4, 4, 4]]);
    expect(loaded.gridData[1]).toEqual(hits(64, 0).slice(0, 15));
  });
});
