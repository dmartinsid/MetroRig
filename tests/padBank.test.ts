import { createHash } from 'crypto';
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CHORD_TYPES, PAD_BANK, ROOTS, chordMidi } from '../src/chords';

const padsDir = path.resolve(__dirname, '../public/pads');

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

describe('Pad bank', () => {
  it('pad_21 files and license', () => {
    expect(PAD_BANK).toEqual(NEW_AGE.map(([key, name, , loopStart, loopEnd]) =>
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

    // Every chord note reads a file at most 2 semitones away, which is what the design's interpolation relies on
    const keys = PAD_BANK.map(entry => entry.key);
    for (const note of ROOTS.flatMap((_, root) => CHORD_TYPES.flatMap((_, type) => chordMidi(root, type)))) {
      expect(Math.min(...keys.map(key => Math.abs(key - note)))).toBeLessThanOrEqual(2);
    }
  });

  it('pad_22 size limit', () => {
    expect(sizeOf(padsDir)).toBeGreaterThan(0);
    expect(sizeOf(padsDir)).toBeLessThanOrEqual(10 * 1000 * 1000);
  });
});
