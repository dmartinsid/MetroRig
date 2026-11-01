import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { STADIUM_GROUPS, TRACKS, groupHit, nextStepValue, takesOf } from '../src/kit';

const namesOf = (trackIds: number[]) => trackIds.map(id => TRACKS.find(track => track.id === id)!.name);
const group = (label: string) => STADIUM_GROUPS.find(g => g.label === label)!;

const publicDir = path.resolve(__dirname, '../public');
const houseDir = path.join(publicDir, 'kit/house');
const RECORDINGS: Record<string, string[]> = {
  kick: ['soft', 'med', 'hard'],
  snare: ['soft', 'hard', 'crack'],
  'tom-10': ['soft', 'med', 'hard'],
  'tom-12': ['soft', 'med', 'hard'],
  'tom-14': ['soft', 'med', 'hard'],
  'tom-16': ['soft', 'med', 'hard'],
};
const houseFiles = Object.entries(RECORDINGS).flatMap(([piece, recordings]) =>
  recordings.flatMap(recording => [1, 2, 3].map(take => `${piece}/${recording}-${take}.wav`)));

const TAIL_LEVEL = 32768 * 10 ** (-60 / 20); // -60 dBFS in 16-bit steps
const FADE_FRAMES = 220; // 5 ms at 44.1 kHz

const toDb = (level: number) => 20 * Math.log10(level / 32768);

// Walks the RIFF chunks of a WAV file, reading the fields of its fmt chunk and its samples.
function readWav(file: string) {
  const bytes = fs.readFileSync(path.join(houseDir, file));
  expect(bytes.toString('latin1', 0, 4)).toBe('RIFF');
  expect(bytes.toString('latin1', 8, 12)).toBe('WAVE');

  let format = { encoding: 0, channels: 0, sampleRate: 0, bits: 0 };
  for (let chunk = 12; chunk + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(chunk + 4);
    const body = chunk + 8;
    if (bytes.toString('latin1', chunk, chunk + 4) === 'fmt ') {
      format = {
        encoding: bytes.readUInt16LE(body),
        channels: bytes.readUInt16LE(body + 2),
        sampleRate: bytes.readUInt32LE(body + 4),
        bits: bytes.readUInt16LE(body + 14),
      };
    } else if (bytes.toString('latin1', chunk, chunk + 4) === 'data') {
      const samples = Array.from({ length: size / 2 }, (_, i) => bytes.readInt16LE(body + 2 * i));
      return { ...format, samples, frames: samples.length / 2 };
    }
    chunk = body + size + (size & 1);
  }
  throw new Error(`${file} has no data chunk`);
}

const peakOf = (file: string) => readWav(file).samples.reduce((peak, s) => Math.max(peak, Math.abs(s)), 0);
const meanPeakDb = (piece: string, recording: string) =>
  [1, 2, 3].reduce((sum, take) => sum + toDb(peakOf(`${piece}/${recording}-${take}.wav`)), 0) / 3;

describe('Kit', () => {
  it('kit_01 thirteen tracks in order', () => {
    expect(TRACKS.map(track => track.name)).toEqual([
      'Click', 'Kick', 'Snare', 'Hi-hat', 'Open Hat', 'Ride', 'Ride Bell', 'Crash', 'China',
      'High Tom', 'Mid Tom', 'Low Tom', 'Floor Tom',
    ]);
    expect(TRACKS.map(track => track.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 10]);
    // The pieces of The House Kit load as banks, so only the hi-hat and cymbals keep a single sample
    expect(TRACKS.map(track => track.sample)).toEqual([
      null, null, null, '/hihat.wav', '/kit/open-hat.wav', '/kit/ride.wav',
      '/kit/ride-bell.wav', '/kit/crash.wav', '/kit/china.wav', null, null, null, null,
    ]);
  });

  it('kit_03 samples exist with a license', () => {
    const publicDir = path.resolve(__dirname, '../public');
    const license = fs.readFileSync(path.join(publicDir, 'kit/LICENSE.md'), 'utf8');
    const samples = TRACKS.flatMap(track => (track.sample ? [track.sample] : []));
    expect(samples).toHaveLength(6);

    const bytes = samples.map(sample => {
      expect(license).toContain(path.basename(sample));
      return fs.statSync(path.join(publicDir, sample)).size;
    });
    expect(license).toContain('The Open Source Drum Kit');
    expect(license).toContain('SM Drums'); // Why the first-choice kit is not the one shipped
    expect(license).toContain('CC0');
    expect(bytes.reduce((total, size) => total + size)).toBeLessThanOrEqual(20 * 1024 * 1024);
  });

  it('std_02 snare and toms group', () => {
    expect(namesOf(group('SNARE/TOMS').trackIds)).toEqual(['Snare', 'High Tom', 'Mid Tom', 'Low Tom', 'Floor Tom']);
  });

  it('std_03 cymbals group', () => {
    expect(namesOf(group('CYMBALS').trackIds)).toEqual(['Hi-hat', 'Open Hat', 'Ride', 'Ride Bell', 'Crash', 'China']);
  });

  it('holds every track in exactly one group', () => {
    expect(STADIUM_GROUPS.map(g => g.label)).toEqual(['CLICK', 'KICK', 'SNARE/TOMS', 'CYMBALS']);
    expect(STADIUM_GROUPS.flatMap(g => g.trackIds).sort((a, b) => a - b)).toEqual(TRACKS.map(track => track.id).sort((a, b) => a - b));
  });

  it('std_04 group hit', () => {
    const { trackIds } = group('CYMBALS');
    const gridData = { 2: [1, 0, 0], 8: [0, 3, 0] };
    expect(groupHit(trackIds, gridData, 1)).toBe(true); // A ghost on China counts
    expect(groupHit(trackIds, gridData, 0)).toBe(false); // Snare belongs to another group
    expect(groupHit(trackIds, gridData, 2)).toBe(false);

    // Any track of the group counts, whatever its place in it
    trackIds.forEach(trackId => {
      expect(groupHit(trackIds, { [trackId]: [1] }, 0)).toBe(true);
    });
  });

  it('cycles a drum step through every dynamic', () => {
    const seen = [0];
    for (let i = 0; i < 4; i++) seen.push(nextStepValue(1, seen[i]));
    expect(seen).toEqual([0, 1, 2, 3, 0]);
  });

  it('cycles a click step without a ghost', () => {
    const seen = [0];
    for (let i = 0; i < 3; i++) seen.push(nextStepValue(0, seen[i]));
    expect(seen).toEqual([0, 1, 2, 0]);
  });
});

describe('House Kit', () => {
  it('hk_01 nine takes of each piece', () => {
    expect(fs.readdirSync(houseDir).sort()).toEqual(Object.keys(RECORDINGS).sort());
    expect(houseFiles).toHaveLength(54);
    Object.keys(RECORDINGS).forEach(piece => {
      const expected = houseFiles.filter(file => file.startsWith(`${piece}/`)).map(file => path.basename(file));
      expect(fs.readdirSync(path.join(houseDir, piece)).sort()).toEqual(expected.sort());
    });

    // takesOf names those files: 9 per piece, and each one exists
    const pieces = TRACKS.filter(track => track.bank);
    expect(pieces.map(track => track.bank!.folder)).toEqual(['kick', 'snare', 'tom-10', 'tom-12', 'tom-14', 'tom-16']);
    pieces.forEach(track => {
      const takes = takesOf(track);
      expect(takes, track.name).toHaveLength(9);
      expect(takes.map(({ dynamic, take }) => [dynamic, take]), track.name).toEqual(
        [0, 1, 2].flatMap(dynamic => [0, 1, 2].map(take => [dynamic, take])));
      takes.forEach(({ url }) => expect(fs.existsSync(path.join(publicDir, url)), url).toBe(true));
    });
    expect(takesOf(TRACKS.find(track => track.name === 'Hi-hat')!)).toEqual([]);
  });

  it('hk_03 snare recordings', () => {
    const snare = TRACKS.find(track => track.name === 'Snare')!;
    const dynamics = [0, 1, 2].map(dynamic => takesOf(snare).filter(take => take.dynamic === dynamic).map(take => take.url));
    expect(dynamics).toEqual([
      ['/kit/house/snare/soft-1.wav', '/kit/house/snare/soft-2.wav', '/kit/house/snare/soft-3.wav'],
      ['/kit/house/snare/hard-1.wav', '/kit/house/snare/hard-2.wav', '/kit/house/snare/hard-3.wav'],
      ['/kit/house/snare/crack-1.wav', '/kit/house/snare/crack-2.wav', '/kit/house/snare/crack-3.wav'],
    ]);
  });

  it('kick and toms recordings by dynamic', () => {
    ['Kick', 'High Tom', 'Mid Tom', 'Low Tom', 'Floor Tom'].forEach(name => {
      const track = TRACKS.find(piece => piece.name === name)!;
      const recordings = [0, 1, 2].map(dynamic => path.basename(takesOf(track).find(take => take.dynamic === dynamic)!.url, '-1.wav'));
      expect(recordings, name).toEqual(['soft', 'med', 'hard']);
    });
  });

  it('hk_15 thirteen tracks in order', () => {
    expect(TRACKS).toHaveLength(13);
    expect(TRACKS.map(track => track.name)).toEqual([
      'Click', 'Kick', 'Snare', 'Hi-hat', 'Open Hat', 'Ride', 'Ride Bell', 'Crash', 'China',
      'High Tom', 'Mid Tom', 'Low Tom', 'Floor Tom',
    ]);
    expect(TRACKS.map(track => track.label)).toEqual([
      'CLICK', 'KICK', 'SNARE', 'HI-HAT', 'OPEN HAT', 'RIDE', 'RIDE BELL', 'CRASH', 'CHINA',
      'HIGH TOM', 'MID TOM', 'LOW TOM', 'FLOOR TOM',
    ]);
  });

  it('hk_16 ids stay', () => {
    const idOf = (name: string) => TRACKS.find(track => track.name === name)!.id;
    const before = ['Click', 'Kick', 'Snare', 'Hi-hat', 'Open Hat', 'Ride', 'Ride Bell', 'Crash', 'China', 'High Tom', 'Floor Tom'];
    expect(before.map(idOf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(idOf('Mid Tom')).toBe(11);
    expect(idOf('Low Tom')).toBe(12);
  });

  it('hk_21 the toms group lights all four toms and the snare', () => {
    expect(group('SNARE/TOMS').trackIds).toEqual([2, 9, 11, 12, 10]);
  });

  it('hk_09 format and tail', () => {
    houseFiles.forEach(file => {
      const { encoding, channels, sampleRate, bits, samples, frames } = readWav(file);
      expect({ file, encoding, channels, sampleRate, bits }).toEqual({
        file, encoding: 1, channels: 2, sampleRate: 44100, bits: 16,
      });

      const reachesTail = (frame: number) =>
        Math.max(Math.abs(samples[2 * frame]), Math.abs(samples[2 * frame + 1])) >= TAIL_LEVEL;
      let framesAfterSound = 0;
      while (!reachesTail(frames - 1 - framesAfterSound)) framesAfterSound++;

      // The cut frame sits at -60 dBFS, and the fade pulls the last ones under it. So only about
      // the fade stays under -60 dBFS: more is a late cut or padding, less is a cut above -60.
      expect(framesAfterSound, file).toBeGreaterThanOrEqual(FADE_FRAMES * 0.9);
      expect(framesAfterSound, file).toBeLessThanOrEqual(4410); // 100 ms: a low tom's last swings

      // The fade lands on 0, on the last frames only: no silence was padded after it
      let silentFrames = 0;
      while (samples[2 * (frames - 1 - silentFrames)] === 0 && samples[2 * (frames - 1 - silentFrames) + 1] === 0) {
        silentFrames++;
      }
      expect(silentFrames, file).toBeGreaterThanOrEqual(1);
      expect(silentFrames, file).toBeLessThan(FADE_FRAMES / 2);
    });
  });

  it('hk_10 recorded levels', () => {
    // Soft takes stay under the hard hits, so nothing evened out the recordings
    expect(toDb(peakOf('snare/hard-1.wav')) - toDb(peakOf('snare/soft-1.wav'))).toBeGreaterThanOrEqual(6);
    expect(toDb(peakOf('kick/hard-1.wav')) - toDb(peakOf('kick/soft-1.wav'))).toBeGreaterThanOrEqual(2);
    expect(meanPeakDb('snare', 'hard') - meanPeakDb('snare', 'soft')).toBeGreaterThanOrEqual(6);
    expect(meanPeakDb('kick', 'hard') - meanPeakDb('kick', 'soft')).toBeGreaterThanOrEqual(2);
    ['tom-10', 'tom-12', 'tom-14', 'tom-16'].forEach(tom => {
      expect(meanPeakDb(tom, 'hard') - meanPeakDb(tom, 'soft'), tom).toBeGreaterThanOrEqual(1);
    });

    // The loudest take of each piece still hits full scale, so no gain went down
    Object.keys(RECORDINGS).forEach(piece => {
      const peaks = houseFiles.filter(file => file.startsWith(`${piece}/`)).map(peakOf);
      expect(toDb(Math.max(...peaks)), piece).toBeGreaterThanOrEqual(-1);
    });
  });

  it('hk_35 kick and snare layers', () => {
    const builder = fs.readFileSync(path.resolve(__dirname, '../scripts/build_house_kit.py'), 'utf8');
    const layers = builder.slice(builder.indexOf('LAYERS = {'), builder.indexOf('\n}\n', builder.indexOf('LAYERS = {')));
    expect(layers).toContain("'kick': (('Kick/Close', 1.0, 'highpass=f=2000:poles=2', False), ('Kick/Room', 0.5, None, False))");
    expect(layers).toContain("'snare': (('Snare/Close', 1.0, None, True), ('Snare/Room', 0.5, None, False))");
    expect(layers.match(/^    '/gm)).toHaveLength(2); // Toms have no layers

    ['kick', 'snare'].forEach(piece => {
      const peaks = houseFiles.filter(file => file.startsWith(`${piece}/`)).map(peakOf);
      expect(toDb(Math.max(...peaks)), piece).toBeGreaterThanOrEqual(-0.1);
    });

    const license = fs.readFileSync(path.join(publicDir, 'kit/LICENSE.md'), 'utf8');
    ['`Kick/Close`', '`Kick/Room`', '`Snare/Close`', '`Snare/Room`'].forEach(source => expect(license).toContain(source));
  });

  it('hk_11 size limit', () => {
    const kitFiles = (fs.readdirSync(path.join(publicDir, 'kit'), { recursive: true }) as string[])
      .filter(file => file.endsWith('.wav'))
      .map(file => path.join('kit', file));
    expect(kitFiles.length).toBeGreaterThanOrEqual(54 + 5);

    const samples = [...kitFiles, 'hihat.wav'];
    const bytes = samples.map(sample => fs.statSync(path.join(publicDir, sample)).size);
    expect(bytes.reduce((total, size) => total + size)).toBeLessThanOrEqual(20 * 1024 * 1024);
  });

  it('hk_28 license facts', () => {
    const license = fs.readFileSync(path.join(publicDir, 'kit/LICENSE.md'), 'utf8');
    const section = license.slice(license.indexOf('## The House Kit'));
    expect(section.startsWith('## The House Kit')).toBe(true);
    ['The House Kit', 'Better Mixes', 'https://www.youtube.com/@BetterMixes', 'https://www.bettermixes.com/drumsamples',
      'No written terms were found', '`Blend`', 'no gain', 'Thank you'].forEach(fact => expect(section, fact).toContain(fact));

    // Every shipped file has its source: its piece, recording and take, in the kit's folder
    const sources: Record<string, string> = {
      kick: 'Kick/Blend', snare: 'Snare/Blend', 'tom-10': 'Toms/10/Blend', 'tom-12': 'Toms/12/Blend',
      'tom-14': 'Toms/14/Blend', 'tom-16': 'Toms/16/Blend',
    };
    expect(Object.keys(sources).sort()).toEqual(Object.keys(RECORDINGS).sort());
    Object.entries(RECORDINGS).forEach(([piece, recordings]) => recordings.forEach(recording => {
      const recorded = recording[0].toUpperCase() + recording.slice(1);
      expect(section, `${piece}/${recording}`).toContain(
        `| \`house/${piece}/${recording}-<take>.wav\` | \`${sources[piece]}/${recorded} <take>.wav\` |`);
    }));
    expect(section).toContain('`<take>` is 1, 2 or 3');
    expect(license).not.toMatch(/^Each file in this folder .*peak-normalized to -1 dBFS, at 44\.1/);
  });

  it('hk_29 release is the user account', () => {
    const license = fs.readFileSync(path.join(publicDir, 'kit/LICENSE.md'), 'utf8');
    const section = license.slice(license.indexOf('## The House Kit'));
    expect(section).toContain("The release for general use is the user's account of the video https://www.youtube.com/watch?v=WFS0_5Qsc1w");
  });

  it('hk_30 readme credit', () => {
    const readme = fs.readFileSync(path.resolve(__dirname, '../README.md'), 'utf8');
    expect(readme).toContain('[Better Mixes](https://www.youtube.com/@BetterMixes)');
    expect(readme).toMatch(/Thank you, Better Mixes/);
    expect(readme).toContain('13 tracks');
  });
});
