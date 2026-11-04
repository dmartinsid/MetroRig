import { createHash } from 'crypto';
import { describe, it, expect } from 'vitest';
import { SONGS, songToPreset, songsForGenre } from '../src/domain/songs';
import { TRACKS } from '../src/domain/kit';
import { measureLengthFor } from '../src/domain/meter';
import { barsToGrid } from '../scripts/tab_to_grid.js';
import tabs from './fixtures/song_tabs.json';

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
      tracks.forEach(steps => expect(steps, song.id).toHaveLength(song.measureLength * song.bars));
      tracks.forEach(steps => expect(steps.every(value => [0, 1, 2, 3].includes(value)), song.id).toBe(true));
      expect(tracks.flat().some(value => value > 0), song.id).toBe(true);
      expect(song.gridData[0], song.id).toBeUndefined(); // Click comes from the time signature
    });
  });

  it('song_04 click marks the beats', () => {
    const song = SONGS[0];
    expect(songToPreset({ ...song, bars: 1 }).gridData[0]).toEqual([2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect(songToPreset({ ...song, bars: 1, timeSignature: '3/4', measureLength: 12 }).gridData[0]).toEqual([2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect(songToPreset({ ...song, bars: 1, timeSignature: '12/8', measureLength: 24 }).gridData[0].filter(Boolean)).toHaveLength(12);
  });

  it('turns a song into a preset with every track and no Trainer', () => {
    const song = SONGS[0];
    const preset = songToPreset(song);

    expect(preset).toMatchObject({ id: song.id, name: song.title, bpm: song.bpm, timeSignature: song.timeSignature, measureLength: song.measureLength, bars: 4 });
    expect(preset.trainerSettings.enabled).toBe(false);
    expect(Object.keys(preset.gridData)).toHaveLength(TRACKS.length);
    expect(preset.gridData[1]).toEqual(song.gridData[1]);
    expect(preset.gridData[10]).toEqual(new Array(64).fill(0));
  });

  it('copies steps so editing a preset leaves the catalog alone', () => {
    const song = SONGS[0];
    songToPreset(song).gridData[1][0] = 3;
    expect(song.gridData[1][0]).not.toBe(3);
  });

  const tabOf = (id: string) => (tabs as Record<string, { first: number; tempo: number; measures: object[] }>)[id];

  it('bars_01 four bars of sixteen', () => {
    expect(SONGS).toHaveLength(14);
    SONGS.forEach(song => {
      expect([song.timeSignature, song.measureLength, song.bars], song.id).toEqual(['4/4', 16, 4]);
      const preset = songToPreset(song);
      TRACKS.forEach(track => expect(preset.gridData[track.id], `${song.id} ${track.name}`).toHaveLength(64));
    });
  });

  it('bars_02 consecutive measures', () => {
    SONGS.forEach(song => {
      const tab = tabOf(song.id);
      const { tracks } = barsToGrid({ measures: tab.measures }, 0);
      TRACKS.slice(1).forEach(track => {
        expect(song.gridData[track.id] ?? new Array(64).fill(0), `${song.id} ${track.name}`).toEqual(tracks[track.id]);
      });
    });
  });

  it('hk_23 toms on four tracks', () => {
    const tomHits = (id: string) => {
      const song = SONGS.find(entry => entry.id === id)!;
      return Object.fromEntries([9, 10, 11, 12].map(track => [track, (song.gridData[track] ?? []).flatMap((value, step) => (value ? [step] : []))]));
    };
    // Battery's two hits are the Low Tom, on the last bar's steps 10 and 14
    expect(tomHits('song_battery')).toEqual({ 9: [], 10: [], 11: [], 12: [58, 62] });

    // No other song has a tom on Mid or Low Tom, and the ones that had a tom keep it where it was
    SONGS.filter(song => song.id !== 'song_battery').forEach(song => {
      expect(tomHits(song.id)[11], song.id).toEqual([]);
      expect(tomHits(song.id)[12], song.id).toEqual([]);
    });
    expect(tomHits('song_highway_to_hell')[10]).not.toEqual([]);

    // Every other song keeps the grid it had before the feature, read from main at 73f2011
    const gridsBefore: Record<string, string> = {
      song_back_in_black: 'dec0fede03df', song_highway_to_hell: '1e19bfe68080', song_the_trooper: '72cba799eacc',
      song_run_to_the_hills: '2b6e37ce3948', song_enter_sandman: '04906cab4485', song_master_of_puppets: '0c20e0832065',
      song_tears_dont_fall: 'db9388aeb013', song_scream_aim_fire: '87fc114e0141', song_dont_need_you: 'b7e6d2cb512a',
      song_cocaine: '6a8b3b216eb0', song_crossroads: 'a8f2ef2fa182', song_thrill_is_gone: 'b570d0730f82',
      song_every_day: 'c6c617bd86f7',
    };
    const others = SONGS.filter(song => song.id !== 'song_battery');
    expect(others.map(song => song.id).sort()).toEqual(Object.keys(gridsBefore).sort());
    others.forEach(song => {
      const grid = createHash('sha1').update(JSON.stringify(song.gridData)).digest('hex').slice(0, 12);
      expect(grid, song.id).toBe(gridsBefore[song.id]);
    });
  });

  it('bars_03 two different bars', () => {
    SONGS.forEach(song => {
      const bar = (index: number) => JSON.stringify(TRACKS.slice(1).map(track => song.gridData[track.id]?.slice(index * 16, (index + 1) * 16)));
      expect(new Set([0, 1, 2, 3].map(bar)).size, song.id).toBeGreaterThanOrEqual(2);
    });
  });

  it('bars_04 first measure and tempo', () => {
    SONGS.forEach(song => {
      const tab = tabOf(song.id);
      expect(song.source.measure, song.id).toBe(tab.first);
      expect(song.bpm, song.id).toBe(tab.tempo);
    });
  });

  it('bars_05 click marks every beat', () => {
    SONGS.forEach(song => {
      const click = songToPreset(song).gridData[0];
      const expected = new Array(64).fill(0).map((_, step) => (step % 4 === 0 ? 1 : 0));
      expected[0] = 2;
      expect(click, song.id).toEqual(expected);
    });
  });

  it('filters by genre', () => {
    expect(songsForGenre('All')).toEqual(SONGS);
    expect(songsForGenre('Rock').map(song => song.artist)).toEqual(['AC/DC', 'AC/DC']);
  });
});
