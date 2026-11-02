// 12 roots × 14 types, in Brazilian notation
export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const LOWEST_ROOT = 45; // A2; roots run up to G#3
const LETTERS = 'CDEFGAB';
const LETTER_PITCHES = [0, 2, 4, 5, 7, 9, 11];
const DEFAULT_VOLUME = 70;

export const CHORD_TYPES: { suffix: string; semitones: number[]; degrees: number[] }[] = [
  { suffix: '', semitones: [0, 4, 7], degrees: [1, 3, 5] },
  { suffix: 'm', semitones: [0, 3, 7], degrees: [1, 3, 5] },
  { suffix: '7', semitones: [0, 4, 7, 10], degrees: [1, 3, 5, 7] },
  { suffix: '7M', semitones: [0, 4, 7, 11], degrees: [1, 3, 5, 7] },
  { suffix: 'm7', semitones: [0, 3, 7, 10], degrees: [1, 3, 5, 7] },
  { suffix: 'sus4', semitones: [0, 5, 7], degrees: [1, 4, 5] },
  { suffix: 'sus2', semitones: [0, 2, 7], degrees: [1, 2, 5] },
  { suffix: 'add9', semitones: [0, 4, 7, 14], degrees: [1, 3, 5, 9] },
  { suffix: '9', semitones: [0, 4, 7, 10, 14], degrees: [1, 3, 5, 7, 9] },
  { suffix: 'm9', semitones: [0, 3, 7, 10, 14], degrees: [1, 3, 5, 7, 9] },
  { suffix: '7M(9)', semitones: [0, 4, 7, 11, 14], degrees: [1, 3, 5, 7, 9] },
  { suffix: '6', semitones: [0, 4, 7, 9], degrees: [1, 3, 5, 6] },
  { suffix: 'dim', semitones: [0, 3, 6], degrees: [1, 3, 5] },
  { suffix: 'aug', semitones: [0, 4, 8], degrees: [1, 3, 5] },
];

// Indexes into ROOTS and CHORD_TYPES
export interface ChordId { root: number; type: number }

// FreePats New Age: mono 44.1 kHz FLAC, `G#` written `Gs` because `#` breaks URLs. Loop points are in
// frames, and loopEnd is inclusive: its sample equals loopStart's, so a wrap is seamless.
export const PAD_BANK: { key: number; url: string; loopStart: number; loopEnd: number }[] = [
  { key: 44, url: '/pads/new-age/Gs2.flac', loopStart: 164330, loopEnd: 388482 },
  { key: 48, url: '/pads/new-age/C3.flac', loopStart: 165283, loopEnd: 395775 },
  { key: 52, url: '/pads/new-age/E3.flac', loopStart: 147455, loopEnd: 374783 },
  { key: 56, url: '/pads/new-age/Gs3.flac', loopStart: 145307, loopEnd: 345079 },
  { key: 60, url: '/pads/new-age/C4.flac', loopStart: 112173, loopEnd: 330803 },
  { key: 64, url: '/pads/new-age/E4.flac', loopStart: 115725, loopEnd: 303615 },
  { key: 68, url: '/pads/new-age/Gs4.flac', loopStart: 103656, loopEnd: 257543 },
  { key: 72, url: '/pads/new-age/C5.flac', loopStart: 104269, loopEnd: 265523 },
];

export function chordName(root: number, type: number): string {
  return ROOTS[root] + CHORD_TYPES[type].suffix;
}

export function chordMidi(root: number, type: number): number[] {
  const bass = LOWEST_ROOT + (root + 12 - (LOWEST_ROOT % 12)) % 12;
  return CHORD_TYPES[type].semitones.map(semitone => bass + semitone);
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
