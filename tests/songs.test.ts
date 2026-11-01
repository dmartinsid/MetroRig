import { describe, it, expect } from 'vitest';
import { SONGS, songToPreset, songsForGenre } from '../src/songs';
import { TRACKS } from '../src/kit';
import { measureLengthFor } from '../src/state';

describe('Songs', () => {
  // Tempos and artists as the cited tabs state them
  const expected: [string, string, string, number][] = [
    ['Back in Black', 'AC/DC', 'Rock', 94],
    ['Highway to Hell', 'AC/DC', 'Rock', 116],
    ['The Trooper', 'Iron Maiden', 'Metal', 162],
    ['Run to the Hills', 'Iron Maiden', 'Metal', 173],
    ['Enter Sandman', 'Metallica', 'Metal', 123],
    ['Master of Puppets', 'Metallica', 'Metal', 212],
    ['Battery', 'Metallica', 'Metal', 194],
    ["Tears Don't Fall", 'Bullet for My Valentine', 'Metalcore', 162],
    ['Scream Aim Fire', 'Bullet for My Valentine', 'Metalcore', 200],
    ["Don't Need You", 'Bullet for My Valentine', 'Metalcore', 154],
    ['Cocaine', 'Eric Clapton', 'Blues', 105],
    ['Crossroads', 'Cream (Eric Clapton)', 'Blues', 132],
    ['The Thrill Is Gone', 'B.B. King', 'Blues', 91],
    ['Every Day I Have the Blues', 'B.B. King', 'Blues', 200],
  ];

  it('song_01 fourteen songs with sources', () => {
    expect(SONGS.map(song => [song.title, song.artist, song.genre, song.bpm])).toEqual(expected);
    SONGS.forEach(song => {
      expect(song.section, song.id).not.toBe('');
      expect(song.timeSignature, song.id).toMatch(/^\d+\/\d+$/);
      expect(song.source.url, song.id).toMatch(/^https:\/\/www\.songsterr\.com\/a\/wsa\/.+-drum-tab-s\d+$/);
      expect(song.source.revisionId, song.id).toBeGreaterThan(0);
    });
    expect(new Set(SONGS.map(song => song.id)).size).toBe(14);
  });

  it('song_02 named versions', () => {
    const song = (title: string) => SONGS.find(entry => entry.title === title)!;
    expect(song('Crossroads').artist).toBe('Cream (Eric Clapton)');
    expect(song('Crossroads').source.url).toContain('live');
    expect(song('Every Day I Have the Blues').source.url).toContain('cook-county');
    expect(song('Every Day I Have the Blues').source.url).toMatch(/s3882248$/);
  });

  it('song_03 bounds', () => {
    SONGS.forEach(song => {
      expect(song.measureLength, song.id).toBeLessThanOrEqual(32);
      const [numerator, denominator] = song.timeSignature.split('/').map(Number);
      expect(song.measureLength, song.id).toBe(measureLengthFor(numerator, denominator)); // Exactly 1 bar
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
