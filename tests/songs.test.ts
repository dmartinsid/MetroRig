import { describe, it, expect } from 'vitest';
import { SONGS, songToPreset, songsForGenre } from '../src/songs';
import { TRACKS } from '../src/kit';

describe('Songs', () => {
  it('song_03 bounds', () => {
    SONGS.forEach(song => {
      expect(song.measureLength, song.id).toBeLessThanOrEqual(32);
      expect(song.bpm, song.id).toBeGreaterThanOrEqual(40);
      expect(song.bpm, song.id).toBeLessThanOrEqual(240);
      const tracks = Object.values(song.gridData);
      tracks.forEach(steps => expect(steps, song.id).toHaveLength(song.measureLength));
      tracks.forEach(steps => expect(steps.every(value => [0, 1, 2, 3].includes(value)), song.id).toBe(true));
      expect(tracks.flat().some(value => value > 0), song.id).toBe(true);
      expect(song.gridData[0], song.id).toBeUndefined(); // Click comes from the time signature
    });
  });

  it('song_04 click marks the beats', () => {
    const song = SONGS[0];
    expect(songToPreset(song).gridData[0]).toEqual([2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect(songToPreset({ ...song, timeSignature: '3/4', measureLength: 12 }).gridData[0]).toEqual([2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect(songToPreset({ ...song, timeSignature: '12/8', measureLength: 24 }).gridData[0].filter(Boolean)).toHaveLength(12);
  });

  it('turns a song into a preset with every track and no Trainer', () => {
    const song = SONGS[0];
    const preset = songToPreset(song);

    expect(preset).toMatchObject({ id: song.id, name: song.title, bpm: song.bpm, timeSignature: song.timeSignature, measureLength: song.measureLength });
    expect(preset.trainerSettings.enabled).toBe(false);
    expect(Object.keys(preset.gridData)).toHaveLength(TRACKS.length);
    expect(preset.gridData[1]).toEqual(song.gridData[1]);
    expect(preset.gridData[10]).toEqual(new Array(song.measureLength).fill(0));
  });

  it('copies steps so editing a preset leaves the catalog alone', () => {
    const song = SONGS[0];
    songToPreset(song).gridData[1][0] = 3;
    expect(song.gridData[1][0]).not.toBe(3);
  });

  it('filters by genre', () => {
    expect(songsForGenre('All')).toEqual(SONGS);
    expect(songsForGenre('Rock').map(song => song.artist)).toEqual(['AC/DC', 'AC/DC']);
  });
});
