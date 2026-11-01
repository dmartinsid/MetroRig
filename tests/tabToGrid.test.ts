import { describe, it, expect } from 'vitest';
import { barToGrid } from '../scripts/tab_to_grid.js';

const beat = (frets: number[], unit: number, extra: Record<string, unknown> = {}, note: Record<string, unknown> = {}) =>
  ({ duration: [1, unit], notes: frets.map(fret => ({ fret, string: 0, ...note })), ...extra });
const rest = (unit: number) => ({ duration: [1, unit], rest: true, notes: [{ rest: true }] });
const bar = (...beats: unknown[]) => ({ voices: [{ beats }] });

describe('barToGrid', () => {
  it('places eighths and quarters on sixteenth steps', () => {
    const { measureLength, tracks } = barToGrid(bar(beat([36, 42], 8), beat([42], 8), beat([38], 4), rest(2)), [4, 4]);

    expect(measureLength).toBe(16);
    expect(tracks[1].slice(0, 5)).toEqual([1, 0, 0, 0, 0]);
    expect(tracks[3].slice(0, 5)).toEqual([1, 0, 1, 0, 0]);
    expect(tracks[2].slice(0, 5)).toEqual([0, 0, 0, 0, 1]);
  });

  it('maps every piece of the kit', () => {
    const pieces: [number, number][] = [
      [35, 1], [36, 1], [37, 2], [38, 2], [40, 2], [91, 2], [42, 3], [44, 3], [46, 4], [92, 4], [51, 5], [59, 5], [93, 5],
      [53, 6], [49, 7], [55, 7], [57, 7], [52, 8], [47, 9], [48, 9], [50, 9], [41, 10], [43, 10], [45, 10],
    ];
    pieces.forEach(([note, track]) => {
      expect(barToGrid(bar(beat([note], 1)), [4, 4]).tracks[track][0]).toBe(1);
    });
  });

  it('reads the dynamics of a note', () => {
    const { tracks } = barToGrid(bar(beat([38], 4), beat([38], 4, {}, { accentuated: true }), beat([38], 4, {}, { ghost: true }), rest(4)), [4, 4]);
    expect([tracks[2][0], tracks[2][4], tracks[2][8]]).toEqual([1, 2, 3]);
  });

  it('counts dots in the position', () => {
    const { tracks } = barToGrid(bar(beat([36], 4, { dots: 1 }), beat([36], 8), rest(2)), [4, 4]);
    expect(tracks[1].slice(0, 8)).toEqual([1, 0, 0, 0, 0, 0, 1, 0]);
  });

  it('places triplets on a 12/8 grid only when they land on steps', () => {
    const triplet = { tuplet: 3 };
    expect(() => barToGrid(bar(beat([36], 8, triplet), beat([36], 8, triplet), rest(4), rest(2)), [4, 4])).toThrow('between steps');

    const { measureLength, tracks } = barToGrid(bar(beat([36], 8), beat([42], 8), beat([42], 8), rest(1)), [12, 8]);
    expect(measureLength).toBe(24);
    expect(tracks[3].slice(0, 6)).toEqual([0, 0, 1, 0, 1, 0]);
  });

  it('skips grace and tied notes', () => {
    const { tracks } = barToGrid(bar(beat([38], 16, { graceNote: true }), beat([36], 2), beat([36], 2, {}, { tie: true })), [4, 4]);
    expect(tracks[2]).toEqual(new Array(16).fill(0));
    expect(tracks[1].filter(Boolean)).toHaveLength(1);
  });

  it('keeps the stronger of two notes on a step', () => {
    const measure = { voices: [{ beats: [beat([38], 1, {}, { ghost: true })] }, { beats: [beat([38], 1, {}, { accentuated: true })] }] };
    expect(barToGrid(measure, [4, 4]).tracks[2][0]).toBe(2);
  });

  it('refuses a note on no piece', () => {
    expect(() => barToGrid(bar(beat([31], 1)), [4, 4])).toThrow('No piece for note 31');
  });

  it('refuses a bar longer than the grid', () => {
    expect(() => barToGrid(bar(rest(1)), [9, 4])).toThrow('does not fit 32 steps');
  });
});
