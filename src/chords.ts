// 12 roots × 34 types, in Brazilian notation
export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const LOWEST_ROOT = 45; // A2; roots run up to G#3
const LETTERS = 'CDEFGAB';
const LETTER_PITCHES = [0, 2, 4, 5, 7, 9, 11];
const DEFAULT_VOLUME = 70;

export const CHORD_FAMILIES = ['Triads', 'Sevenths', 'Ninths', 'Elevenths', 'Thirteenths', 'Altered'];

// At most 5 notes each, so a chord of 6 or 7 leaves one out: 11ths and 13ths drop the 5th or the 3rd
export const CHORD_TYPES: { family: string; suffix: string; semitones: number[]; degrees: number[] }[] = [
  { family: 'Triads', suffix: '', semitones: [0, 4, 7], degrees: [1, 3, 5] },
  { family: 'Triads', suffix: 'm', semitones: [0, 3, 7], degrees: [1, 3, 5] },
  { family: 'Triads', suffix: 'dim', semitones: [0, 3, 6], degrees: [1, 3, 5] },
  { family: 'Triads', suffix: 'aug', semitones: [0, 4, 8], degrees: [1, 3, 5] },
  { family: 'Triads', suffix: 'sus2', semitones: [0, 2, 7], degrees: [1, 2, 5] },
  { family: 'Triads', suffix: 'sus4', semitones: [0, 5, 7], degrees: [1, 4, 5] },
  { family: 'Sevenths', suffix: '6', semitones: [0, 4, 7, 9], degrees: [1, 3, 5, 6] },
  { family: 'Sevenths', suffix: 'm6', semitones: [0, 3, 7, 9], degrees: [1, 3, 5, 6] },
  { family: 'Sevenths', suffix: '7', semitones: [0, 4, 7, 10], degrees: [1, 3, 5, 7] },
  { family: 'Sevenths', suffix: '7M', semitones: [0, 4, 7, 11], degrees: [1, 3, 5, 7] },
  { family: 'Sevenths', suffix: 'm7', semitones: [0, 3, 7, 10], degrees: [1, 3, 5, 7] },
  { family: 'Sevenths', suffix: 'm7M', semitones: [0, 3, 7, 11], degrees: [1, 3, 5, 7] },
  { family: 'Sevenths', suffix: 'm7(b5)', semitones: [0, 3, 6, 10], degrees: [1, 3, 5, 7] },
  { family: 'Sevenths', suffix: 'dim7', semitones: [0, 3, 6, 9], degrees: [1, 3, 5, 7] },
  { family: 'Sevenths', suffix: '7sus4', semitones: [0, 5, 7, 10], degrees: [1, 4, 5, 7] },
  { family: 'Ninths', suffix: 'add9', semitones: [0, 4, 7, 14], degrees: [1, 3, 5, 9] },
  { family: 'Ninths', suffix: 'madd9', semitones: [0, 3, 7, 14], degrees: [1, 3, 5, 9] },
  { family: 'Ninths', suffix: '9', semitones: [0, 4, 7, 10, 14], degrees: [1, 3, 5, 7, 9] },
  { family: 'Ninths', suffix: 'm9', semitones: [0, 3, 7, 10, 14], degrees: [1, 3, 5, 7, 9] },
  { family: 'Ninths', suffix: '7M(9)', semitones: [0, 4, 7, 11, 14], degrees: [1, 3, 5, 7, 9] },
  { family: 'Ninths', suffix: '9sus4', semitones: [0, 5, 7, 10, 14], degrees: [1, 4, 5, 7, 9] },
  { family: 'Ninths', suffix: '6/9', semitones: [0, 4, 7, 9, 14], degrees: [1, 3, 5, 6, 9] },
  { family: 'Elevenths', suffix: 'add11', semitones: [0, 4, 7, 17], degrees: [1, 3, 5, 11] },
  { family: 'Elevenths', suffix: '11', semitones: [0, 7, 10, 14, 17], degrees: [1, 5, 7, 9, 11] },
  { family: 'Elevenths', suffix: 'm11', semitones: [0, 3, 10, 14, 17], degrees: [1, 3, 7, 9, 11] },
  { family: 'Elevenths', suffix: '7(#11)', semitones: [0, 4, 10, 14, 18], degrees: [1, 3, 7, 9, 11] },
  { family: 'Elevenths', suffix: '7M(#11)', semitones: [0, 4, 11, 14, 18], degrees: [1, 3, 7, 9, 11] },
  { family: 'Thirteenths', suffix: '13', semitones: [0, 4, 10, 14, 21], degrees: [1, 3, 7, 9, 13] },
  { family: 'Thirteenths', suffix: 'm13', semitones: [0, 3, 10, 14, 21], degrees: [1, 3, 7, 9, 13] },
  { family: 'Altered', suffix: '7(b9)', semitones: [0, 4, 7, 10, 13], degrees: [1, 3, 5, 7, 9] },
  { family: 'Altered', suffix: '7(#9)', semitones: [0, 4, 7, 10, 15], degrees: [1, 3, 5, 7, 9] },
  { family: 'Altered', suffix: '7(#5)', semitones: [0, 4, 8, 10], degrees: [1, 3, 5, 7] },
  { family: 'Altered', suffix: '7(b5)', semitones: [0, 4, 6, 10], degrees: [1, 3, 5, 7] },
  { family: 'Altered', suffix: '7(b13)', semitones: [0, 4, 7, 10, 20], degrees: [1, 3, 5, 7, 13] },
];

// Indexes into ROOTS and CHORD_TYPES
export interface ChordId { root: number; type: number }

export interface PadFile { key: number; url: string; loopStart: number; loopEnd: number }

// FreePats New Age: mono 44.1 kHz FLAC, `G#` written `Gs` because `#` breaks URLs. Loop points are in
// frames, and loopEnd is inclusive: its sample equals loopStart's, so a wrap is seamless.
const NEW_AGE_FILES: PadFile[] = [
  { key: 44, url: '/pads/new-age/Gs2.flac', loopStart: 164330, loopEnd: 388482 },
  { key: 48, url: '/pads/new-age/C3.flac', loopStart: 165283, loopEnd: 395775 },
  { key: 52, url: '/pads/new-age/E3.flac', loopStart: 147455, loopEnd: 374783 },
  { key: 56, url: '/pads/new-age/Gs3.flac', loopStart: 145307, loopEnd: 345079 },
  { key: 60, url: '/pads/new-age/C4.flac', loopStart: 112173, loopEnd: 330803 },
  { key: 64, url: '/pads/new-age/E4.flac', loopStart: 115725, loopEnd: 303615 },
  { key: 68, url: '/pads/new-age/Gs4.flac', loopStart: 103656, loopEnd: 257543 },
  { key: 72, url: '/pads/new-age/C5.flac', loopStart: 104269, loopEnd: 265523 },
  { key: 76, url: '/pads/new-age/E5.flac', loopStart: 106254, loopEnd: 252287 },
];

// FreePats Synth Pad Choir: stereo 44.1 kHz FLAC, `F#` written `Fs`, loop points as the New Age bank has them
const CHOIR_FILES: PadFile[] = [
  { key: 48, url: '/pads/choir/C3.flac', loopStart: 119520, loopEnd: 299519 },
  { key: 54, url: '/pads/choir/Fs3.flac', loopStart: 119520, loopEnd: 299519 },
  { key: 60, url: '/pads/choir/C4.flac', loopStart: 119520, loopEnd: 299519 },
  { key: 66, url: '/pads/choir/Fs4.flac', loopStart: 119520, loopEnd: 299519 },
  { key: 72, url: '/pads/choir/C5.flac', loopStart: 119520, loopEnd: 299519 },
];

// FreePats Sweep Pad: mono 44.1 kHz FLAC, written like the New Age bank
const SWEEP_FILES: PadFile[] = [
  { key: 44, url: '/pads/sweep/Gs2.flac', loopStart: 27903, loopEnd: 329471 },
  { key: 48, url: '/pads/sweep/C3.flac', loopStart: 34720, loopEnd: 357321 },
  { key: 52, url: '/pads/sweep/E3.flac', loopStart: 34303, loopEnd: 321535 },
  { key: 56, url: '/pads/sweep/Gs3.flac', loopStart: 36760, loopEnd: 291327 },
  { key: 60, url: '/pads/sweep/C4.flac', loopStart: 21167, loopEnd: 352511 },
  { key: 64, url: '/pads/sweep/E4.flac', loopStart: 33791, loopEnd: 346623 },
  { key: 68, url: '/pads/sweep/Gs4.flac', loopStart: 31207, loopEnd: 309247 },
  { key: 72, url: '/pads/sweep/C5.flac', loopStart: 17382, loopEnd: 302079 },
  { key: 76, url: '/pads/sweep/E5.flac', loopStart: 46591, loopEnd: 329727 },
];

// VSCO 2 string sections, built by scripts/build_orchestra_bank.py: stereo 44.1 kHz FLAC with a 4 s loop
const ORCHESTRA_FILES: PadFile[] = [
  { key: 23, url: '/pads/orchestra/B0.flac', loopStart: 0, loopEnd: 176400 },
  { key: 27, url: '/pads/orchestra/Ds1.flac', loopStart: 0, loopEnd: 176400 },
  { key: 31, url: '/pads/orchestra/G1.flac', loopStart: 0, loopEnd: 176400 },
  { key: 35, url: '/pads/orchestra/B1.flac', loopStart: 0, loopEnd: 176400 },
  { key: 39, url: '/pads/orchestra/Ds2.flac', loopStart: 0, loopEnd: 176400 },
  { key: 43, url: '/pads/orchestra/G2.flac', loopStart: 0, loopEnd: 176400 },
  { key: 47, url: '/pads/orchestra/B2.flac', loopStart: 0, loopEnd: 176400 },
  { key: 51, url: '/pads/orchestra/Ds3.flac', loopStart: 0, loopEnd: 176400 },
  { key: 55, url: '/pads/orchestra/G3.flac', loopStart: 0, loopEnd: 176400 },
  { key: 59, url: '/pads/orchestra/B3.flac', loopStart: 0, loopEnd: 176400 },
  { key: 63, url: '/pads/orchestra/Ds4.flac', loopStart: 0, loopEnd: 176400 },
  { key: 67, url: '/pads/orchestra/G4.flac', loopStart: 0, loopEnd: 176400 },
  { key: 71, url: '/pads/orchestra/B4.flac', loopStart: 0, loopEnd: 176400 },
  { key: 75, url: '/pads/orchestra/Ds5.flac', loopStart: 0, loopEnd: 176400 },
];

// In select order, and the index is the timbre's id in the engine. Storage keeps the name, so a reorder saves nothing wrong
export const PAD_TIMBRES: { name: string; files: PadFile[]; bass: boolean }[] = [
  { name: 'Choir', files: CHOIR_FILES, bass: false },
  { name: 'New Age', files: NEW_AGE_FILES, bass: false },
  { name: 'Orchestra', files: ORCHESTRA_FILES, bass: true },
  { name: 'Sweep', files: SWEEP_FILES, bass: false },
  { name: 'Analog', files: [], bass: false },
];
export const DEFAULT_TIMBRE = 0;

export function chordName(root: number, type: number): string {
  return ROOTS[root] + CHORD_TYPES[type].suffix;
}

export function chordMidi(root: number, type: number): number[] {
  const bass = LOWEST_ROOT + (root + 12 - (LOWEST_ROOT % 12)) % 12;
  return CHORD_TYPES[type].semitones.map(semitone => bass + semitone);
}

// A timbre with a bass adds the root an octave and two octaves down, from low to high
export function timbreNotes(root: number, type: number, timbre: number): number[] {
  const notes = chordMidi(root, type);
  return PAD_TIMBRES[timbre].bass ? [notes[0] - 24, notes[0] - 12, ...notes] : notes;
}

// Each degree takes its own letter; a double accidental becomes the natural note of its pitch (AD-018)
export function chordNotes(root: number, type: number): string[] {
  const rootLetter = LETTERS.indexOf(ROOTS[root][0]);
  const { semitones, degrees } = CHORD_TYPES[type];
  return semitones.map((semitone, index) => {
    const pitch = (root + semitone) % 12;
    const letter = (rootLetter + degrees[index] - 1) % LETTERS.length;
    const accidental = (pitch - LETTER_PITCHES[letter] + 18) % 12 - 6;
    return Math.abs(accidental) > 1 ? ROOTS[pitch] : LETTERS[letter] + ['b', '', '#'][accidental + 1];
  });
}

// The sounding chord after a click: the same chord stops, another replaces it
export function nextChord(current: ChordId | null, clicked: ChordId): ChordId | null {
  return current?.root === clicked.root && current.type === clicked.type ? null : clicked;
}

export function parseVolume(stored: string | null): number {
  const volume = stored?.trim() ? Number(stored) : NaN;
  return volume >= 0 && volume <= 100 ? volume : DEFAULT_VOLUME;
}

export function parseTimbre(stored: string | null): number {
  const timbre = PAD_TIMBRES.findIndex(({ name }) => name === stored);
  return timbre < 0 ? DEFAULT_TIMBRE : timbre;
}
