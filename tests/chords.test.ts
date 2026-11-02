import { createHash } from 'crypto';
import { describe, it, expect } from 'vitest';
import { CHORD_FAMILIES, CHORD_TYPES, chordOfRoot, chordOfType, DEFAULT_TIMBRE, PAD_TIMBRES, ROOTS, chordMidi, chordName, chordNotes, nextChord, parseTimbre, parseVolume, timbreNotes } from '../src/chords';

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

// CHD-02's table: family, suffix, semitones, degrees
const LIBRARY: [string, string, number[], number[]][] = [
  ['Triads', '', [0, 4, 7], [1, 3, 5]],
  ['Triads', 'm', [0, 3, 7], [1, 3, 5]],
  ['Triads', 'dim', [0, 3, 6], [1, 3, 5]],
  ['Triads', 'aug', [0, 4, 8], [1, 3, 5]],
  ['Triads', 'sus2', [0, 2, 7], [1, 2, 5]],
  ['Triads', 'sus4', [0, 5, 7], [1, 4, 5]],
  ['Sevenths', '6', [0, 4, 7, 9], [1, 3, 5, 6]],
  ['Sevenths', 'm6', [0, 3, 7, 9], [1, 3, 5, 6]],
  ['Sevenths', '7', [0, 4, 7, 10], [1, 3, 5, 7]],
  ['Sevenths', '7M', [0, 4, 7, 11], [1, 3, 5, 7]],
  ['Sevenths', 'm7', [0, 3, 7, 10], [1, 3, 5, 7]],
  ['Sevenths', 'm7M', [0, 3, 7, 11], [1, 3, 5, 7]],
  ['Sevenths', 'm7(b5)', [0, 3, 6, 10], [1, 3, 5, 7]],
  ['Sevenths', 'dim7', [0, 3, 6, 9], [1, 3, 5, 7]],
  ['Sevenths', '7sus4', [0, 5, 7, 10], [1, 4, 5, 7]],
  ['Ninths', 'add9', [0, 4, 7, 14], [1, 3, 5, 9]],
  ['Ninths', 'madd9', [0, 3, 7, 14], [1, 3, 5, 9]],
  ['Ninths', '9', [0, 4, 7, 10, 14], [1, 3, 5, 7, 9]],
  ['Ninths', 'm9', [0, 3, 7, 10, 14], [1, 3, 5, 7, 9]],
  ['Ninths', '7M(9)', [0, 4, 7, 11, 14], [1, 3, 5, 7, 9]],
  ['Ninths', '9sus4', [0, 5, 7, 10, 14], [1, 4, 5, 7, 9]],
  ['Ninths', '6/9', [0, 4, 7, 9, 14], [1, 3, 5, 6, 9]],
  ['Elevenths', 'add11', [0, 4, 7, 17], [1, 3, 5, 11]],
  ['Elevenths', '11', [0, 7, 10, 14, 17], [1, 5, 7, 9, 11]],
  ['Elevenths', 'm11', [0, 3, 10, 14, 17], [1, 3, 7, 9, 11]],
  ['Elevenths', '7(#11)', [0, 4, 10, 14, 18], [1, 3, 7, 9, 11]],
  ['Elevenths', '7M(#11)', [0, 4, 11, 14, 18], [1, 3, 7, 9, 11]],
  ['Thirteenths', '13', [0, 4, 10, 14, 21], [1, 3, 7, 9, 13]],
  ['Thirteenths', 'm13', [0, 3, 10, 14, 21], [1, 3, 7, 9, 13]],
  ['Altered', '7(b9)', [0, 4, 7, 10, 13], [1, 3, 5, 7, 9]],
  ['Altered', '7(#9)', [0, 4, 7, 10, 15], [1, 3, 5, 7, 9]],
  ['Altered', '7(#5)', [0, 4, 8, 10], [1, 3, 5, 7]],
  ['Altered', '7(b5)', [0, 4, 6, 10], [1, 3, 5, 7]],
  ['Altered', '7(b13)', [0, 4, 7, 10, 20], [1, 3, 5, 7, 13]],
];

describe('Chord library', () => {
  it('chd_01 offers 408 chords', () => {
    expect(ROOTS).toHaveLength(12);
    expect(CHORD_TYPES).toHaveLength(34);
    const names = ROOTS.flatMap((_, root) => CHORD_TYPES.map((_, type) => chordName(root, type)));
    expect(names).toHaveLength(408);
    expect(new Set(names).size).toBe(408);
    expect(chordName(ROOTS.indexOf('B'), typeIndex('m7(b5)'))).toBe('Bm7(b5)');
    expect(chordName(ROOTS.indexOf('G'), typeIndex('7(b13)'))).toBe('G7(b13)');
  });

  it('chd_02 semitones of each type', () => {
    expect(CHORD_TYPES.map(({ family, suffix, semitones, degrees }) => [family, suffix, semitones, degrees])).toEqual(LIBRARY);
    expect(CHORD_FAMILIES).toEqual(['Triads', 'Sevenths', 'Ninths', 'Elevenths', 'Thirteenths', 'Altered']);
    CHORD_TYPES.forEach(({ semitones, degrees }) => {
      expect(semitones.length).toBeLessThanOrEqual(5);
      expect(degrees).toHaveLength(semitones.length);
    });
  });

  it('chd_03 voices every root', () => {
    for (const [, suffix, semitones] of LIBRARY) {
      ROOTS.forEach((name, root) => {
        expect(chordMidi(root, typeIndex(suffix))).toEqual(semitones.map(semitone => SPEC_ROOT_MIDI[name] + semitone));
      });
    }
    expect(Math.max(...ROOTS.flatMap((_, root) => CHORD_TYPES.flatMap((_, type) => chordMidi(root, type))))).toBe(77);
  });

  it('chd_04 spells the new chords', () => {
    expect(notesOf('C', '11')).toBe('C G Bb D F');
    expect(notesOf('C', '7(b13)')).toBe('C E G Bb Ab');
    expect(notesOf('C', 'dim7')).toBe('C Eb Gb A');
    expect(notesOf('C', 'm11')).toBe('C Eb Bb D F');
    expect(notesOf('C', '7(#11)')).toBe('C E Bb D F#');
    expect(notesOf('C', '7M(#11)')).toBe('C E B D F#');
    expect(notesOf('C', '13')).toBe('C E Bb D A');
    expect(notesOf('C', '7(b9)')).toBe('C E G Bb Db');
    expect(notesOf('C', '7(#9)')).toBe('C E G Bb D#');
    expect(notesOf('C', '7(#5)')).toBe('C E G# Bb');
    expect(notesOf('C', '7(b5)')).toBe('C E Gb Bb');
    expect(notesOf('B', 'm7(b5)')).toBe('B D F A');
    expect(notesOf('C', '6/9')).toBe('C E G A D');
    expect(notesOf('Ab', '13')).toBe('Ab C Gb Bb F');
    expect(notesOf('F#', '7(#9)')).toBe('F# A# C# E A');
    expect(notesOf('Bb', '11')).toBe('Bb F Ab C Eb');
    expect(notesOf('Eb', '7(b13)')).toBe('Eb G Bb Db Cb');
    expect(notesOf('B', '7(#11)')).toBe('B D# A C# E#');
    // In all 408: each note carries the pitch it plays, on the letter of its degree, but for AD-018's natural notes
    const letters = 'CDEFGAB';
    ROOTS.forEach((rootName, root) => CHORD_TYPES.forEach(({ degrees }, type) => {
      const midi = chordMidi(root, type);
      const notes = chordNotes(root, type);
      expect(notes.map(note => pitchOf(note) % 12)).toEqual(midi.map(note => note % 12));
      notes.forEach((note, index) => {
        const letter = letters[(letters.indexOf(rootName[0]) + degrees[index] - 1) % 7];
        const away = Math.abs((pitchOf(letter) - pitchOf(note) + 18) % 12 - 6);
        if (away <= 1) expect(note[0]).toBe(letter);
        else expect(ROOTS).toContain(note);
      });
    }));
  });

  it('chd_05 keeps the old types', () => {
    for (const [suffix, semitones] of SPEC_TYPES) {
      expect(CHORD_TYPES[typeIndex(suffix)].semitones).toEqual(semitones);
    }
    expect(notesOf('Eb', 'm')).toBe('Eb Gb Bb');
    expect(notesOf('Ab', 'm')).toBe('Ab Cb Eb');
    expect(notesOf('Eb', 'dim')).toBe('Eb Gb A');
    expect(notesOf('C', '7M(9)')).toBe('C E G B D');
    // Name, spelling and notes of the 168 chords as `chord-pads` shipped them, at 7e3ce19
    const rows = ROOTS.flatMap((_, root) => SPEC_TYPES.map(([suffix]) => {
      const type = typeIndex(suffix);
      return [chordName(root, type), chordNotes(root, type).join(' '), chordMidi(root, type).join(' ')].join('|');
    }));
    expect(rows).toHaveLength(168);
    expect(createHash('sha256').update(rows.join('\n')).digest('hex')).toBe('6f45f0584f0abd3d8bf2d68b9cca02e6ef269edc6451b6a93bd10b06b1c1a89b');
  });
});

describe('Chord clicks', () => {
  const Am7 = { root: ROOTS.indexOf('A'), type: typeIndex('m7') };
  const D = ROOTS.indexOf('D');
  const m9 = typeIndex('m9');

  it('chd_19 a root keeps the selected type', () => {
    expect(chordOfRoot(Am7, D)).toEqual({ root: D, type: Am7.type });
    expect(nextChord(null, chordOfRoot(Am7, D))).toEqual({ root: D, type: Am7.type });
  });

  it('chd_20 a type keeps the selected root', () => {
    expect(chordOfType(Am7, m9)).toEqual({ root: Am7.root, type: m9 });
    expect(nextChord(null, chordOfType(Am7, m9))).toEqual({ root: Am7.root, type: m9 });
  });

  it('chd_21 another root changes the sounding chord', () => {
    expect(nextChord(Am7, chordOfRoot(Am7, D))).toEqual({ root: D, type: Am7.type });
  });

  it('chd_22 another type changes the sounding chord', () => {
    expect(nextChord(Am7, chordOfType(Am7, m9))).toEqual({ root: Am7.root, type: m9 });
  });

  it('chd_23 the sounding root or type stops it', () => {
    expect(nextChord(Am7, chordOfRoot(Am7, Am7.root))).toBeNull();
    expect(nextChord(Am7, chordOfType(Am7, Am7.type))).toBeNull();
  });
});

describe('Chords', () => {
  it('pad_01 names the chords', () => {
    expect(ROOTS).toEqual(SPEC_ROOTS);
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

describe('Timbres', () => {
  const TIMBRE_NAMES = ['Choir', 'New Age', 'Orchestra', 'Sweep', 'Analog'];
  const ORCHESTRA = TIMBRE_NAMES.indexOf('Orchestra');

  it('tim_07 parses the stored timbre', () => {
    expect(PAD_TIMBRES.map(timbre => timbre.name)).toEqual(TIMBRE_NAMES);
    expect(PAD_TIMBRES[DEFAULT_TIMBRE].name).toBe('Choir');

    // The name is what is stored, so its place in the select can change
    TIMBRE_NAMES.forEach((name, index) => expect(parseTimbre(name)).toBe(index));
    for (const bad of [null, '', ' ', 'Bowed', 'choir', '0', '2', 'NaN', 'constructor']) {
      expect(parseTimbre(bad)).toBe(DEFAULT_TIMBRE);
    }
  });

  it('tim_14 orchestra bass', () => {
    ROOTS.forEach((_, root) => CHORD_TYPES.forEach((_, type) => {
      const bass = chordMidi(root, type)[0];
      TIMBRE_NAMES.forEach((_, timbre) => {
        const notes = timbreNotes(root, type, timbre);
        const added = timbre === ORCHESTRA ? [bass - 24, bass - 12] : [];
        expect(notes).toEqual([...added, ...chordMidi(root, type)]);
        expect(notes.length).toBeLessThanOrEqual(7);
      });
    }));
    expect(timbreNotes(ROOTS.indexOf('A'), 0, ORCHESTRA)).toEqual([21, 33, 45, 49, 52]);
    expect(timbreNotes(ROOTS.indexOf('Ab'), CHORD_TYPES.findIndex(type => type.suffix === '9'), ORCHESTRA))
      .toEqual([32, 44, 56, 60, 63, 66, 70]);
  });
});
