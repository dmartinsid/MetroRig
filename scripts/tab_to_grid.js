// Turns 4 bars of a Songsterr drum part into MetroRig's grid. A development tool: the app never calls it.
// Usage: node scripts/tab_to_grid.js <part.json> <first measure index>
import fs from 'fs';
import { fileURLToPath } from 'url';

const KICK = 1, SNARE = 2, HI_HAT = 3, OPEN_HAT = 4, RIDE = 5, RIDE_BELL = 6, CRASH = 7, CHINA = 8, HIGH_TOM = 9, FLOOR_TOM = 10, MID_TOM = 11, LOW_TOM = 12;
const TRACK_COUNT = 13;
const STEPS_MAX = 32;
const STEPS_PER_WHOLE = 16;

// General MIDI notes, plus the articulations tabs write above them: 91 rim shot, 92 half-open hat, 93 ride edge
const PIECES = {
  35: KICK, 36: KICK,
  37: SNARE, 38: SNARE, 40: SNARE, 91: SNARE,
  42: HI_HAT, 44: HI_HAT,
  46: OPEN_HAT, 92: OPEN_HAT,
  51: RIDE, 59: RIDE, 93: RIDE,
  53: RIDE_BELL,
  49: CRASH, 55: CRASH, 57: CRASH,
  52: CHINA,
  50: HIGH_TOM,
  47: MID_TOM, 48: MID_TOM,
  45: LOW_TOM,
  41: FLOOR_TOM, 43: FLOOR_TOM,
};

const NORMAL = 1, ACCENT = 2, GHOST = 3;

function measureLengthFor([numerator, denominator]) {
  return (numerator * STEPS_PER_WHOLE) / denominator;
}

function beatLength(beat) {
  const [count, unit] = beat.duration;
  const dotted = beat.dots ? 2 - 1 / 2 ** beat.dots : 1;
  // A triplet fits 3 notes in the space of 2, a quintuplet 5 in 4
  const tuplet = beat.tuplet ? 2 ** Math.floor(Math.log2(beat.tuplet)) / beat.tuplet : 1;
  return (count / unit) * dotted * tuplet * STEPS_PER_WHOLE;
}

function hitValue(note) {
  if (note.ghost) return GHOST;
  return note.accentuated ? ACCENT : NORMAL;
}

// Two notes of one piece on a step keep the stronger: a ghost is the weakest, whatever its number
const STRENGTH = { 0: 0, [GHOST]: 1, [NORMAL]: 2, [ACCENT]: 3 };

function writeHit(tracks, note, step) {
  const track = PIECES[note.fret];
  if (track === undefined) throw new Error(`No piece for note ${note.fret}`);
  const value = hitValue(note);
  if (STRENGTH[value] > STRENGTH[tracks[track][step]]) tracks[track][step] = value;
}

export function barToGrid(measure, timeSignature) {
  const measureLength = measureLengthFor(timeSignature);
  if (!Number.isInteger(measureLength) || measureLength > STEPS_MAX) {
    throw new Error(`${timeSignature.join('/')} does not fit ${STEPS_MAX} steps`);
  }

  const tracks = {};
  for (let track = 1; track < TRACK_COUNT; track++) tracks[track] = new Array(measureLength).fill(0);

  for (const voice of measure.voices) {
    let position = 0;
    for (const beat of voice.beats) {
      if (beat.graceNote) continue; // It takes no time, and the grid has no place for it
      const step = Math.round(position * 1e6) / 1e6;
      const notes = beat.rest ? [] : (beat.notes ?? []).filter(note => !note.rest && !note.tie);
      if (notes.length > 0) {
        if (!Number.isInteger(step)) throw new Error(`A note at ${step} falls between steps`);
        notes.forEach(note => writeHit(tracks, note, step));
      }
      position += beatLength(beat);
    }
  }
  return { measureLength, tracks };
}

// The time signature in force at a measure: a tab writes it only where it changes
function signatureAt(part, index) {
  let signature = [4, 4];
  part.measures.slice(0, index + 1).forEach(measure => { signature = measure.signature ?? signature; });
  return signature;
}

export function tempoAt(part, index) {
  const changes = (part.automations?.tempo ?? []).filter(change => change.measure <= index);
  return changes.at(-1)?.bpm;
}

export function barsToGrid(part, first, count = 4) {
  const signature = signatureAt(part, first);
  const measures = part.measures.slice(first, first + count);
  if (measures.length < count) throw new Error(`The tab ends before measure ${first + count}`);

  const grids = measures.map((measure, offset) => {
    const own = signatureAt(part, first + offset);
    if (own.join('/') !== signature.join('/')) throw new Error(`Measure ${first + offset} changes the time signature`);
    return barToGrid(measure, signature);
  });
  const tempoChange = (part.automations?.tempo ?? []).some(change => change.measure > first && change.measure < first + count);
  if (tempoChange) throw new Error(`The tempo changes inside measures ${first} to ${first + count - 1}`);

  const tracks = {};
  for (let track = 1; track < TRACK_COUNT; track++) tracks[track] = grids.flatMap(grid => grid.tracks[track]);
  return { measureLength: grids[0].measureLength, bars: count, bpm: tempoAt(part, first), tracks };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [partPath, index] = process.argv.slice(2);
  const part = JSON.parse(fs.readFileSync(partPath, 'utf8'));
  console.log(JSON.stringify(barsToGrid(part, Number(index))));
}
