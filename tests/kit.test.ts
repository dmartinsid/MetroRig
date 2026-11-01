import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { STADIUM_GROUPS, TRACKS, groupHit, nextStepValue } from '../src/kit';

const namesOf = (trackIds: number[]) => trackIds.map(id => TRACKS[id].name);
const group = (label: string) => STADIUM_GROUPS.find(g => g.label === label)!;

describe('Kit', () => {
  it('kit_01 eleven tracks in order', () => {
    expect(TRACKS.map(track => track.name)).toEqual([
      'Click', 'Kick', 'Snare', 'Hi-hat', 'Open Hat', 'Ride', 'Ride Bell', 'Crash', 'China', 'High Tom', 'Floor Tom',
    ]);
    expect(TRACKS.map(track => track.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('kit_03 samples exist with a license', () => {
    const publicDir = path.resolve(__dirname, '../public');
    const license = fs.readFileSync(path.join(publicDir, 'kit/LICENSE.md'), 'utf8');
    const samples = TRACKS.flatMap(track => (track.sample ? [track.sample] : []));
    expect(samples).toHaveLength(10);

    const bytes = samples.map(sample => {
      expect(license).toContain(path.basename(sample));
      return fs.statSync(path.join(publicDir, sample)).size;
    });
    expect(license).toContain('The Open Source Drum Kit');
    expect(license).toContain('CC0');
    expect(bytes.reduce((total, size) => total + size)).toBeLessThanOrEqual(10 * 1024 * 1024);
  });

  it('std_02 snare and toms group', () => {
    expect(namesOf(group('SNARE/TOMS').trackIds)).toEqual(['Snare', 'High Tom', 'Floor Tom']);
  });

  it('std_03 cymbals group', () => {
    expect(namesOf(group('CYMBALS').trackIds)).toEqual(['Hi-hat', 'Open Hat', 'Ride', 'Ride Bell', 'Crash', 'China']);
  });

  it('holds every track in exactly one group', () => {
    expect(STADIUM_GROUPS.map(g => g.label)).toEqual(['CLICK', 'KICK', 'SNARE/TOMS', 'CYMBALS']);
    expect(STADIUM_GROUPS.flatMap(g => g.trackIds).sort((a, b) => a - b)).toEqual(TRACKS.map(track => track.id));
  });

  it('std_04 group hit', () => {
    const { trackIds } = group('CYMBALS');
    const gridData = { 2: [1, 0, 0], 8: [0, 3, 0] };
    expect(groupHit(trackIds, gridData, 1)).toBe(true); // A ghost on China counts
    expect(groupHit(trackIds, gridData, 0)).toBe(false); // Snare belongs to another group
    expect(groupHit(trackIds, gridData, 2)).toBe(false);
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
