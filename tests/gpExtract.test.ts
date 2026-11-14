import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { barsToGrid } from '../scripts/tab_to_grid.js';

const SCRIPT = path.resolve(__dirname, '../scripts/gp_extract.py');
const SECTOR = 0x1000;

// A score as Guitar Pro writes it: a guitar track, then the drum track. Measure 0 is 4/4, measures 1 and 2 are 7/4
// at 144 BPM. Measure 1 holds an accented Snare and a Kick on beat 1, a ghost Snare, a tied note and an
// eighth-note triplet; the other measures hold a whole rest
function score(drumNote: (piece: 'kick' | 'snare' | 'hat') => string, drumTrack: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<GPIF>
<MasterTrack><Automations>
  <Automation><Type>Tempo</Type><Bar>0</Bar><Value>120 2</Value></Automation>
  <Automation><Type>Tempo</Type><Bar>1</Bar><Value>144 2</Value></Automation>
  <Automation><Type>Tempo</Type><Bar>3</Bar><Value>90 2</Value></Automation>
</Automations></MasterTrack>
<Tracks>
  <Track id="0"><Name>Guitar</Name><Instrument ref="e-gtr6" /><InstrumentSet><Type>electricGuitar</Type></InstrumentSet></Track>
  ${drumTrack}
</Tracks>
<MasterBars>
  <MasterBar><Time>4/4</Time><Bars>0 1</Bars></MasterBar>
  <MasterBar><Time>7/4</Time><Bars>0 2</Bars></MasterBar>
  <MasterBar><Time>7/4</Time><Bars>0 1</Bars></MasterBar>
  <MasterBar><Time>7/4</Time><Bars>0 1</Bars></MasterBar>
</MasterBars>
<Bars>
  <Bar id="0"><Voices>0 -1 -1 -1</Voices></Bar>
  <Bar id="1"><Voices>0 -1 -1 -1</Voices></Bar>
  <Bar id="2"><Voices>1 2 -1 -1</Voices></Bar>
</Bars>
<Voices>
  <Voice id="0"><Beats>0</Beats></Voice>
  <Voice id="1"><Beats>1 2 3 4 4 4 5</Beats></Voice>
  <Voice id="2"><Beats>6</Beats></Voice>
</Voices>
<Beats>
  <Beat id="0"><Rhythm ref="0" /></Beat>
  <Beat id="1"><Rhythm ref="1" /><Notes>0 1</Notes></Beat>
  <Beat id="2"><Rhythm ref="2" /><Notes>2</Notes></Beat>
  <Beat id="3"><Rhythm ref="3" /><Notes>3</Notes></Beat>
  <Beat id="4"><Rhythm ref="4" /><Notes>4</Notes></Beat>
  <Beat id="5"><Rhythm ref="5" /></Beat>
  <Beat id="6"><GraceNotes>BeforeBeat</GraceNotes><Rhythm ref="3" /><Notes>4</Notes></Beat>
</Beats>
<Notes>
  <Note id="0"><Accent>4</Accent>${drumNote('snare')}</Note>
  <Note id="1">${drumNote('kick')}</Note>
  <Note id="2"><AntiAccent>Normal</AntiAccent>${drumNote('snare')}</Note>
  <Note id="3"><Tie origin="false" destination="true" />${drumNote('snare')}</Note>
  <Note id="4">${drumNote('hat')}</Note>
</Notes>
<Rhythms>
  <Rhythm id="0"><NoteValue>Whole</NoteValue></Rhythm>
  <Rhythm id="1"><NoteValue>Quarter</NoteValue></Rhythm>
  <Rhythm id="2"><NoteValue>Eighth</NoteValue><AugmentationDot count="1" /></Rhythm>
  <Rhythm id="3"><NoteValue>16th</NoteValue></Rhythm>
  <Rhythm id="4"><NoteValue>Eighth</NoteValue><PrimaryTuplet num="3" den="2" /></Rhythm>
  <Rhythm id="5"><NoteValue>Half</NoteValue><AugmentationDot count="1" /></Rhythm>
</Rhythms>
</GPIF>
`;
}

// Guitar Pro 7 and 8 name a drum piece by its MIDI number
const GP7_PIECES = { kick: 35, snare: 38, hat: 42 };
const gp7Score = score(
  piece => `<Properties><Property name="Midi"><Number>${GP7_PIECES[piece]}</Number></Property></Properties>`,
  '<Track id="1"><Name>Drums</Name><InstrumentSet><Type>drumKit</Type></InstrumentSet></Track>',
);
// Guitar Pro 6 names it by Element and Variation: 0 kick, 1 snare, 10 hi-hat
const GP6_PIECES = { kick: 0, snare: 1, hat: 10 };
const gp6Score = score(
  piece => `<Properties><Property name="Element"><Element>${GP6_PIECES[piece]}</Element></Property><Property name="Variation"><Variation>0</Variation></Property></Properties>`,
  '<Track id="1"><Name>Drums</Name><Instrument ref="drmkt" /></Track>',
);

// A zip holding Content/score.gpif, stored without compression
function gpFile(gpif: string): Buffer {
  const name = Buffer.from('Content/score.gpif');
  const data = Buffer.from(gpif);
  const crc = zlib.crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  const centralOffset = local.length + name.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}

// A BCFS file system: a header sector, one entry sector naming score.gpif, then its data sectors
function bcfs(gpif: string): Buffer {
  const data = Buffer.from(gpif);
  const sectors = Math.ceil(data.length / SECTOR);
  const image = Buffer.alloc(SECTOR * (2 + sectors));
  image.writeUInt32LE(2, SECTOR);
  image.write('score.gpif', SECTOR + 4, 'latin1');
  image.writeUInt32LE(data.length, SECTOR + 0x8c);
  for (let sector = 0; sector < sectors; sector++) image.writeUInt32LE(2 + sector, SECTOR + 0x94 + 4 * sector);
  data.copy(image, SECTOR * 2);
  return Buffer.concat([Buffer.from('BCFS'), image]);
}

// BCFZ with literals only: per run a 0 bit, its length (1 to 3) in 2 bits low bit first, then its bytes high bit first
function bcfz(content: Buffer): Buffer {
  const bits: number[] = [];
  const push = (value: number, count: number, lowFirst = false) => {
    for (let i = 0; i < count; i++) bits.push((value >> (lowFirst ? i : count - 1 - i)) & 1);
  };
  for (let at = 0; at < content.length; at += 3) {
    const run = content.subarray(at, at + 3);
    push(0, 1);
    push(run.length, 2, true);
    run.forEach(byte => push(byte, 8));
  }
  const packed = Buffer.alloc(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => { packed[i >> 3] |= bit << (7 - (i & 7)); });
  const header = Buffer.alloc(8);
  header.write('BCFZ', 0, 'latin1');
  header.writeUInt32LE(content.length, 4);
  return Buffer.concat([header, packed]);
}

let folder: string;
beforeAll(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-extract-'));
});
afterAll(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

const write = (name: string, content: Buffer) => {
  const file = path.join(folder, name);
  fs.writeFileSync(file, content);
  return file;
};
const extract = (file: string, first: number, count?: number) =>
  JSON.parse(execFileSync('python3', ['-I', SCRIPT, file, String(first), ...(count ? [String(count)] : [])], { encoding: 'utf8' }));

describe('gp_extract', () => {
  // Measure 1 as Songsterr writes it: two voices, notes as MIDI numbers, with their dynamics
  const measure1 = {
    signature: [7, 4],
    voices: [
      {
        beats: [
          { duration: [1, 4], notes: [{ fret: 38, accentuated: true }, { fret: 35 }] },
          { duration: [1, 8], dots: 1, notes: [{ fret: 38, ghost: true }] },
          { duration: [1, 16], notes: [{ fret: 38, tie: true }] },
          { duration: [1, 8], tuplet: 3, notes: [{ fret: 42 }] },
          { duration: [1, 8], tuplet: 3, notes: [{ fret: 42 }] },
          { duration: [1, 8], tuplet: 3, notes: [{ fret: 42 }] },
          { duration: [1, 2], dots: 1, rest: true, notes: [{ rest: true }] },
        ],
      },
      { beats: [{ duration: [1, 16], graceNote: true, notes: [{ fret: 42 }] }] },
    ],
  };
  const rest = { voices: [{ beats: [{ duration: [1, 1], rest: true, notes: [{ rest: true }] }] }] };

  it('tup_35 reads drum measures from .gp and .gpx', () => {
    const files = [write('score.gp', gpFile(gp7Score)), write('score.gpx', bcfz(bcfs(gp6Score)))];
    for (const file of files) {
      const part = extract(file, 1, 3);
      expect(part, file).toEqual({
        first: 1,
        tempo: 144,
        measures: [measure1, rest, rest],
        automations: { tempo: [{ measure: 0, bpm: 144 }] },
      });
      // 4 measures by default, the first carrying the signature in force
      const fromStart = extract(file, 0);
      expect(fromStart.measures.map((measure: { signature?: number[] }) => measure.signature ?? null), file)
        .toEqual([[4, 4], [7, 4], null, null]);
      expect(fromStart.tempo, file).toBe(120);

      // The converter lays the triplet as a beat of 3 cells: measure 1 is 4 + 4 + 3 + 4 × 4 cells
      const grid = barsToGrid(part, 0, 3);
      expect([grid.measureLength, grid.bpm], file).toEqual([28, 144]);
      expect(grid.beatCells, file).toEqual([[4, 4, 3, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4, 4]]);
      const bar1 = (track: number) => grid.tracks[track].slice(0, 27);
      expect(bar1(2).flatMap((value: number, cell: number) => (value ? [[cell, value]] : [])), file).toEqual([[0, 2], [4, 3]]);
      expect(bar1(1).flatMap((value: number, cell: number) => (value ? [cell] : [])), file).toEqual([0]);
      expect(bar1(3).flatMap((value: number, cell: number) => (value ? [cell] : [])), file).toEqual([8, 9, 10]);
    }
  });

  it('refuses a file with no drum track or too few measures', () => {
    const run = (file: string, first: number) => spawnSync('python3', ['-I', SCRIPT, file, String(first)], { encoding: 'utf8' });

    const ends = run(write('short.gp', gpFile(gp7Score)), 1);
    expect(ends.status).toBe(1);
    expect(ends.stderr).toContain('The file ends before measure 5');

    const noDrums = run(write('guitar.gp', gpFile(gp7Score.replace(/<Track id="1">.*<\/Track>/, ''))), 0);
    expect(noDrums.status).toBe(1);
    expect(noDrums.stderr).toContain('No drum track');
  });
});
