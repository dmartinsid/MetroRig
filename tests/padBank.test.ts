import { createHash } from 'crypto';
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CHORD_TYPES, PAD_TIMBRES, ROOTS, chordMidi, timbreNotes } from '../src/chords';

const padsDir = path.resolve(__dirname, '../public/pads');
const licensePath = path.resolve(__dirname, '../public/kit/LICENSE.md');
const readmePath = path.resolve(__dirname, '../README.md');
const builderPath = path.resolve(__dirname, '../scripts/build_orchestra_bank.py');

// The files as FreePats ships them: MIDI key, name in the repository, SHA-256 and loop points
const NEW_AGE: [number, string, string, number, number][] = [
  [44, 'Gs2', '6e539cd5ec155d1e9087b70b722d96a53a0541c683324e42151dc0e091be44f2', 164330, 388482],
  [48, 'C3', '1414fb61707a6a8367c771777aca9cc46cc6e61d3cc08f9e4f72f7caab65ef0c', 165283, 395775],
  [52, 'E3', '3f8e3dfcbe27157b17a9dde0699cb4c71aba09ef5f72760fe747eaab5c65c560', 147455, 374783],
  [56, 'Gs3', '3899103acc083b7ccafa83d802d4601e9457bee65a950eb6e0674e65b3301206', 145307, 345079],
  [60, 'C4', '4554ac53968c855a62d4b0452eb9351ea5889739bd8a207c63e2307e0120eb2e', 112173, 330803],
  [64, 'E4', '231d2ec4b785d28cc857b19237aabb6e7755d06601fe58cf0251713a5b06593e', 115725, 303615],
  [68, 'Gs4', 'c04b9ecf6c40128edacdbb27f855def03bcb342350fc8d7c4556eb59ef40c4d2', 103656, 257543],
  [72, 'C5', '18d73e6b2ceb8d216e04bcc321d3b081c2ec8de48cc36c63a8b5b9aeb98dad1f', 104269, 265523],
  [76, 'E5', '0a521cf64088dd68651e6b593149d6d0fcf04845d2a80b04e0066527fa2722c6', 106254, 252287],
];

// The STREAMINFO block sits right after the `fLaC` marker and its 4-byte header
function readStreamInfo(bytes: Buffer) {
  expect(bytes.toString('latin1', 0, 4)).toBe('fLaC');
  const packed = bytes.readBigUInt64BE(18);
  return {
    sampleRate: Number(packed >> 44n),
    channels: Number((packed >> 41n) & 0x7n) + 1,
    bits: Number((packed >> 36n) & 0x1fn) + 1,
    frames: Number(packed & 0xfffffffffn),
  };
}

function sizeOf(folder: string): number {
  return fs.readdirSync(folder, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = path.join(folder, entry.name);
    return total + (entry.isDirectory() ? sizeOf(entryPath) : fs.statSync(entryPath).size);
  }, 0);
}

const newAgeFiles = () => PAD_TIMBRES.find(({ name }) => name === 'New Age')!.files;

describe('Pad bank', () => {
  it('pad_21 files and license', () => {
    expect(newAgeFiles()).toEqual(NEW_AGE.map(([key, name, , loopStart, loopEnd]) =>
      ({ key, url: `/pads/new-age/${name}.flac`, loopStart, loopEnd })));
    expect(fs.readdirSync(path.join(padsDir, 'new-age')).sort())
      .toEqual(NEW_AGE.map(([, name]) => `${name}.flac`).sort());

    for (const [, name, sha256, , loopEnd] of NEW_AGE) {
      const bytes = fs.readFileSync(path.join(padsDir, 'new-age', `${name}.flac`));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
      const info = readStreamInfo(bytes);
      expect(info).toMatchObject({ sampleRate: 44100, channels: 1, bits: 16 });
      expect(info.frames).toBeGreaterThan(loopEnd);
    }

    // CC0 is the reason these files may ship, so its record must name the source and the dedication
    const license = fs.readFileSync(licensePath, 'utf8');
    expect(license).toContain('https://github.com/freepats/new-age');
    expect(license).toContain('Creative Commons CC0');

    // Every chord note reads a file at most 2 semitones away, which is what the design's interpolation relies on
    const keys = newAgeFiles().map(entry => entry.key);
    for (const note of ROOTS.flatMap((_, root) => CHORD_TYPES.flatMap((_, type) => chordMidi(root, type)))) {
      expect(Math.min(...keys.map(key => Math.abs(key - note)))).toBeLessThanOrEqual(2);
    }
  });

  it('pad_22 size limit', () => {
    expect(sizeOf(padsDir)).toBeGreaterThan(0);
    expect(sizeOf(padsDir)).toBeLessThanOrEqual(12 * 1000 * 1000);
  });

  it('pad_54 README', () => {
    const readme = fs.readFileSync(readmePath, 'utf8');
    expect(readme).toMatch(/\*\*Improv\*\*:/);
    expect(readme).toContain('New Age by FreePats');
    expect(readme).toContain('https://github.com/freepats/new-age');
  });

  it('pad_55 license lists each file', () => {
    const license = fs.readFileSync(licensePath, 'utf8');
    for (const [, name] of NEW_AGE) {
      expect(license).toContain(`\`pads/new-age/${name}.flac\` | \`samples/${name.replace('Gs', 'G#')}.flac\``);
    }
  });
});

describe('Timbre banks', () => {
  const listed = PAD_TIMBRES.flatMap(timbre => timbre.files.map(file => file.url));
  const orchestra = PAD_TIMBRES[PAD_TIMBRES.findIndex(timbre => timbre.name === 'Orchestra')].files;

  // The file a note reads, as the engine picks it: the nearest key, and on a tie the higher one
  const nearestKey = (note: number) => orchestra.map(file => file.key)
    .reduce((best, key) => {
      const [distance, bestDistance] = [Math.abs(key - note), Math.abs(best - note)];
      return distance < bestDistance || (distance === bestDistance && key > best) ? key : best;
    });

  // The sections each key of the builder's table mixes
  function sectionsOfKeys() {
    const table = fs.readFileSync(builderPath, 'utf8').match(/^BANK = \{\n([\s\S]*?)^\}/m)![1];
    return new Map([...table.matchAll(/^\s+(\d+): (.*)$/gm)].map(([, key, row]) =>
      [Number(key), row.match(/\b(CELLO|VIOLA|VIOLIN|CONTRABASS)\b/g)!] as [number, string[]]));
  }

  it('tim_13 orchestra sections', () => {
    const keys = [23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75];
    expect(orchestra.map(file => file.key)).toEqual(keys);

    const sections = sectionsOfKeys();
    expect([...sections.keys()]).toEqual(keys);
    for (const key of [23, 27, 31]) expect(sections.get(key)).toEqual(['CONTRABASS']);
    for (const key of [35, 39, 43]) expect(sections.get(key)).toEqual(['CELLO', 'CONTRABASS']);
    expect(sections.get(47)).toEqual(['CELLO']);
    for (const key of [51, 55]) expect(sections.get(key)).toEqual(['VIOLA']);
    for (const key of [59, 63, 67, 71, 75]) expect(sections.get(key)).toEqual(['VIOLIN']);

    // Every note of every chord, from low to high: the sections never go back down, and no note reads far from its key
    const order = ['CONTRABASS', 'CELLO', 'VIOLA', 'VIOLIN'];
    const notes = [...new Set(ROOTS.flatMap((_, root) => CHORD_TYPES.flatMap((_, type) =>
      timbreNotes(root, type, PAD_TIMBRES.findIndex(timbre => timbre.name === 'Orchestra')))))].sort((a, b) => a - b);
    expect(notes[0]).toBe(21);
    expect(notes[notes.length - 1]).toBe(77);
    const highestOf = (note: number) => Math.max(...sections.get(nearestKey(note))!.map(name => order.indexOf(name)));
    notes.slice(1).forEach((note, index) => {
      expect(highestOf(note)).toBeGreaterThanOrEqual(highestOf(notes[index]));
      expect(Math.abs(nearestKey(note) - note)).toBeLessThanOrEqual(2);
    });
    // The chord itself sits on cello, viola and violin, and the bass an octave down adds the contrabass
    expect(sections.get(nearestKey(45))).toEqual(['CELLO']);
    expect(sections.get(nearestKey(52))).toEqual(['VIOLA']);
    expect(sections.get(nearestKey(70))).toEqual(['VIOLIN']);
    expect(sections.get(nearestKey(36))).toEqual(['CELLO', 'CONTRABASS']);
    expect(sections.get(nearestKey(24))).toEqual(['CONTRABASS']);
  });

  it('tim_24 orchestra format', () => {
    expect(orchestra).toHaveLength(14);
    for (const file of orchestra) {
      const info = readStreamInfo(fs.readFileSync(path.join(padsDir, '..', file.url)));
      expect(info).toEqual({ sampleRate: 44100, channels: 2, bits: 16, frames: 176401 });
      expect(file.loopStart).toBe(0);
      expect(file.loopEnd).toBe(4 * 44100);
      expect(file.loopEnd).toBe(info.frames - 1);
    }
  });

  it('tim_36 size limit', () => {
    // The limit covers what ships, so every listed file has to be there
    for (const url of listed) {
      expect(fs.statSync(path.join(padsDir, '..', url)).size).toBeGreaterThan(0);
    }
    expect(sizeOf(padsDir)).toBeGreaterThan(0);
    expect(sizeOf(padsDir)).toBeLessThanOrEqual(12 * 1000 * 1000);
  });

  // The recordings each key of the builder's table reads, by their paths in the repository
  function recordingsOfKeys() {
    const builder = fs.readFileSync(builderPath, 'utf8');
    const templates = new Map([...builder.matchAll(/^(CELLO|VIOLA|VIOLIN|CONTRABASS) = '(.*)'$/gm)].map(([, name, template]) => [name, template]));
    const table = builder.match(/^BANK = \{\n([\s\S]*?)^\}/m)![1];
    return new Map([...table.matchAll(/^\s+(\d+): (.*)$/gm)].map(([, key, row]) =>
      [Number(key), [...row.matchAll(/\((CELLO|VIOLA|VIOLIN|CONTRABASS), '([^']+)'/g)]
        .map(([, section, note]) => templates.get(section)!.replace('{}', note))] as [number, string[]]));
  }

  it('tim_40 license lists each file', () => {
    const license = fs.readFileSync(licensePath, 'utf8');
    const row = (url: string) => license.split('\n').find(line => line.startsWith(`| \`${url.replace('/pads/', 'pads/')}\` |`));

    for (const name of ['Choir', 'New Age', 'Sweep']) {
      const { files } = PAD_TIMBRES.find(timbre => timbre.name === name)!;
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const note = path.basename(file.url, '.flac').replace('s', '#');
        expect(row(file.url)).toContain(`\`samples/${note}.flac\``);
      }
    }

    const recordings = recordingsOfKeys();
    expect(orchestra.length).toBe(14);
    for (const file of orchestra) {
      const sources = recordings.get(file.key)!;
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) expect(row(file.url)).toContain(`\`${source}\``);
    }

    for (const heading of ['## Synth Pad Choir', '## Sweep Pad', '## Orchestra pad']) {
      const section = license.slice(license.indexOf(heading)).split(/\n## /)[0];
      expect(license).toContain(heading);
      expect(section).toContain('CC0');
      expect(section).toContain('https://creativecommons.org/publicdomain/zero/1.0/');
    }
    expect(license).toContain('https://github.com/freepats/synth-pad-choir');
    expect(license).toContain('https://github.com/freepats/sweep-pad');
    expect(license).toContain('https://github.com/sgossner/VSCO-2-CE');
  });

  it('pad_54 README states the chords and timbres the app offers', () => {
    const readme = fs.readFileSync(readmePath, 'utf8');
    expect(readme).toContain(`any of ${ROOTS.length * CHORD_TYPES.length} chords`);
    const names = PAD_TIMBRES.map(({ name }) => name);
    expect(readme).toContain(`chosen in a select: ${names.slice(0, -1).join(', ')} and ${names.at(-1)}.`);
  });

  it('tim_41 README', () => {
    const readme = fs.readFileSync(readmePath, 'utf8');
    for (const credit of ['FreePats', 'Versilian Studios', 'https://github.com/freepats/synth-pad-choir',
      'https://github.com/freepats/sweep-pad', 'https://github.com/sgossner/VSCO-2-CE']) {
      expect(readme).toContain(credit);
    }
  });
});
