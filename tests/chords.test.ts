import { describe, it, expect } from 'vitest';
import { CHORD_TYPES, ROOTS, chordMidi, chordName, chordNotes, nextChord, parseVolume } from '../src/chords';

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
const notesOf = (root: string, suffix: string) => chordNotes(ROOTS.indexOf(root), typeIndex(suffix)).join(' ');
const NATURAL_PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pitchOf = (note: string) =>
  NATURAL_PITCH[note[0]] + [...note.slice(1)].reduce((sum, mark) => sum + (mark === '#' ? 1 : -1), 12);

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

  it('pad_34 spelling', () => {
    expect(notesOf('Eb', 'm')).toBe('Eb Gb Bb');
    expect(notesOf('Ab', 'm')).toBe('Ab Cb Eb');
    expect(notesOf('Eb', 'dim')).toBe('Eb Gb A');
    expect(notesOf('C', '7M(9)')).toBe('C E G B D');
    expect(notesOf('C#', '')).toBe('C# E# G#'); // E#, not F: each degree takes its own letter
    expect(notesOf('F#', 'aug')).toBe('F# A# D'); // C## is D
    expect(notesOf('Ab', 'dim')).toBe('Ab Cb D'); // Ebb is D
    expect(notesOf('C', 'sus4')).toBe('C F G');
    expect(notesOf('C', 'sus2')).toBe('C D G');
    expect(notesOf('A', '6')).toBe('A C# E F#');
    ROOTS.forEach((_, root) => CHORD_TYPES.forEach((_, type) => {
      const notes = chordNotes(root, type);
      expect(notes).toHaveLength(CHORD_TYPES[type].semitones.length);
      expect(notes.every(note => /^[A-G][#b]?$/.test(note))).toBe(true);
      expect(notes.map(note => pitchOf(note) % 12)).toEqual(chordMidi(root, type).map(note => note % 12));
    }));
  });

  it('pad_44 parses the volume', () => {
    expect(parseVolume('0')).toBe(0);
    expect(parseVolume('30')).toBe(30);
    expect(parseVolume('100')).toBe(100);
    for (const bad of [null, '', ' ', 'loud', 'NaN', 'Infinity', '-1', '101']) {
      expect(parseVolume(bad)).toBe(70);
    }
  });
});
