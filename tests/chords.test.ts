import { describe, it, expect } from 'vitest';
import { CHORD_TYPES, ROOTS, chordMidi, chordName, nextChord } from '../src/chords';

// The roots and types as the spec lists them, in PAD-01 and PAD-02
const SPEC_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SPEC_TYPES: [string, number[]][] = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['7', [0, 4, 7, 10]],
  ['7M', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['sus4', [0, 5, 7]],
  ['sus2', [0, 2, 7]],
  ['add9', [0, 4, 7, 14]],
  ['9', [0, 4, 7, 10, 14]],
  ['m9', [0, 3, 7, 10, 14]],
  ['7M(9)', [0, 4, 7, 11, 14]],
  ['6', [0, 4, 7, 9]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
];
const SPEC_ROOT_MIDI: Record<string, number> = {
  A: 45, Bb: 46, B: 47, C: 48, 'C#': 49, D: 50, Eb: 51, E: 52, F: 53, 'F#': 54, G: 55, Ab: 56,
};

const typeIndex = (suffix: string) => CHORD_TYPES.findIndex(type => type.suffix === suffix);

describe('Chords', () => {
  it('pad_01 offers 168 chords', () => {
    expect(ROOTS).toEqual(SPEC_ROOTS);
    expect(CHORD_TYPES.map(type => type.suffix)).toEqual(SPEC_TYPES.map(([suffix]) => suffix));
    const names = ROOTS.flatMap((_, root) => CHORD_TYPES.map((_, type) => chordName(root, type)));
    expect(names).toHaveLength(168);
    expect(new Set(names).size).toBe(168);
    expect(chordName(ROOTS.indexOf('C'), typeIndex('7M(9)'))).toBe('C7M(9)');
    expect(chordName(ROOTS.indexOf('Eb'), typeIndex('m'))).toBe('Ebm');
    expect(chordName(ROOTS.indexOf('F#'), typeIndex(''))).toBe('F#');
  });

  it('pad_02 semitones of each type', () => {
    for (const [suffix, semitones] of SPEC_TYPES) {
      const type = typeIndex(suffix);
      expect(CHORD_TYPES[type].semitones).toEqual(semitones);
      ROOTS.forEach((name, root) => {
        const midi = chordMidi(root, type);
        expect(midi.map(note => note - midi[0])).toEqual(semitones);
        expect(midi[0]).toBe(SPEC_ROOT_MIDI[name]);
      });
    }
  });

  it('pad_03 voices every root in range', () => {
    const rootNotes = ROOTS.map((_, root) => chordMidi(root, 0)[0]);
    expect([...rootNotes].sort((a, b) => a - b)).toEqual([45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56]);
    expect(rootNotes[ROOTS.indexOf('A')]).toBe(45); // A2
    expect(rootNotes[ROOTS.indexOf('C')]).toBe(48); // C3, since C4 is MIDI 60
    expect(rootNotes[ROOTS.indexOf('Ab')]).toBe(56); // G#3
    ROOTS.forEach((_, root) => CHORD_TYPES.forEach((_, type) => {
      const [bass, ...others] = chordMidi(root, type);
      expect(others.every(note => note > bass)).toBe(true);
      expect(bass).toBeGreaterThanOrEqual(45);
      expect(bass).toBeLessThanOrEqual(56);
    }));
  });

  it('pad_09 the same chord stops', () => {
    const cm7 = { root: ROOTS.indexOf('C'), type: typeIndex('m7') };
    const f7 = { root: ROOTS.indexOf('F'), type: typeIndex('7') };
    const sameRoot = { root: cm7.root, type: typeIndex('m') };
    expect(nextChord(null, cm7)).toEqual(cm7);
    expect(nextChord(cm7, f7)).toEqual(f7);
    expect(nextChord(cm7, sameRoot)).toEqual(sameRoot);
    expect(nextChord(cm7, { ...cm7 })).toBeNull();
  });
});
