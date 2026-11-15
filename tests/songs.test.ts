import { execSync } from 'child_process';
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
    ['Times Like These', 'Foo Fighters', 'Rock', 144],
    ['Everlong', 'Foo Fighters', 'Rock', 160],
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

  // The two songs read from Guitar Pro files of Ultimate Guitar (TUP-34); every other song is a Songsterr tab
  const ultimateGuitar = ['song_times_like_these', 'song_everlong'];

  it('song_01 sixteen songs with sources', () => {
    expect(SONGS.map(song => [song.title, song.artist, song.genre, song.bpm])).toEqual(expected);
    SONGS.forEach(song => {
      expect(song.section, song.id).not.toBe('');
      expect(song.timeSignature, song.id).toMatch(/^\d+\/\d+$/);
      if (ultimateGuitar.includes(song.id)) {
        expect(song.source, song.id).toMatchObject({ site: 'Ultimate Guitar' });
      } else {
        expect(song.source.url, song.id).toMatch(/^https:\/\/www\.songsterr\.com\/a\/wsa\/.+-drum-tab-s\d+$/);
        expect(song.source.revisionId, song.id).toBeGreaterThan(0);
      }
    });
    expect(new Set(SONGS.map(song => song.id)).size).toBe(16);
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

  it('bars_01 four bars of the song\'s signature', () => {
    expect(SONGS).toHaveLength(16);
    // Times Like These is in 7/4: 28 steps a bar. Every other song is in 4/4: 16 steps a bar
    SONGS.forEach(song => {
      const signature = song.id === 'song_times_like_these' ? ['7/4', 28, 4] : ['4/4', 16, 4];
      expect([song.timeSignature, song.measureLength, song.bars], song.id).toEqual(signature);
      const preset = songToPreset(song);
      TRACKS.forEach(track => expect(preset.gridData[track.id], `${song.id} ${track.name}`).toHaveLength(song.measureLength * 4));
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

    // Only Battery and Everlong have a tom on Mid or Low Tom, and the ones that had a tom keep it where it was
    expect(SONGS.filter(song => [...tomHits(song.id)[11], ...tomHits(song.id)[12]].length > 0).map(song => song.id).sort())
      .toEqual(['song_battery', 'song_everlong']);
    expect(tomHits('song_highway_to_hell')[10]).not.toEqual([]);

    // Every other song keeps the grid it had before the feature, read from main at 73f2011; the two Foo Fighters
    // songs keep the grid tuplets added them with
    const gridsBefore: Record<string, string> = {
      song_back_in_black: 'dec0fede03df', song_highway_to_hell: '1e19bfe68080', song_the_trooper: '72cba799eacc',
      song_run_to_the_hills: '2b6e37ce3948', song_enter_sandman: '04906cab4485', song_master_of_puppets: '0c20e0832065',
      song_tears_dont_fall: 'db9388aeb013', song_scream_aim_fire: '87fc114e0141', song_dont_need_you: 'b7e6d2cb512a',
      song_cocaine: '6a8b3b216eb0', song_crossroads: 'a8f2ef2fa182', song_thrill_is_gone: 'b570d0730f82',
      song_every_day: 'c6c617bd86f7', song_times_like_these: 'b64a53f1fc48', song_everlong: '29fe2289b6f2',
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
      const expected = new Array(song.measureLength * song.bars).fill(0).map((_, step) => (step % 4 === 0 ? 1 : 0));
      expected[0] = 2;
      expect(click, song.id).toEqual(expected);
    });
  });

  it('filters by genre', () => {
    expect(songsForGenre('All')).toEqual(SONGS);
    expect(songsForGenre('Rock').map(song => song.artist)).toEqual(['AC/DC', 'AC/DC', 'Foo Fighters', 'Foo Fighters']);
  });

  // TUP-32, TUP-33: each song is the 4 measures its Guitar Pro file holds from its first measure, read by
  // scripts/gp_extract.py into the fixture and converted by barsToGrid, every drum track included
  const matchesTab = (id: string) => {
    const song = SONGS.find(entry => entry.id === id)!;
    const tab = tabOf(id);
    const grid = barsToGrid({ measures: tab.measures }, 0);
    expect([grid.measureLength, grid.bars, grid.beatCells]).toEqual([song.measureLength, song.bars, song.beatCells]);
    TRACKS.slice(1).forEach(track => {
      expect(song.gridData[track.id] ?? new Array(song.measureLength * song.bars).fill(0), `${id} ${track.name}`).toEqual(grid.tracks[track.id]);
    });
    expect([song.source.measure, song.bpm]).toEqual([tab.first, tab.tempo]);
    return song;
  };

  it('tup_32 Times Like These plays the 7/4 intro riff', () => {
    const song = matchesTab('song_times_like_these');
    expect(song).toMatchObject({ title: 'Times Like These', artist: 'Foo Fighters', genre: 'Rock', section: 'Intro Riff', bpm: 144, timeSignature: '7/4', measureLength: 28, bars: 4 });
    expect(song.source.measure).toBe(8);
    expect(songsForGenre('Rock')).toContain(song);
    // A 7/4 bar is 28 cells, so the pattern holds 112 and the click marks its 28 beats
    const preset = songToPreset(song);
    expect(preset.gridData[0]).toHaveLength(112);
    expect(preset.gridData[0].filter(Boolean)).toHaveLength(28);
  });

  it('tup_33 Everlong plays the chorus', () => {
    const song = matchesTab('song_everlong');
    expect(song).toMatchObject({ title: 'Everlong', artist: 'Foo Fighters', genre: 'Rock', section: 'Chorus', bpm: 160, timeSignature: '4/4', measureLength: 16, bars: 4 });
    expect(song.source.measure).toBe(64);
    expect(songsForGenre('Rock')).toContain(song);
  });

  it('tup_34 Ultimate Guitar sources name the file and measure', () => {
    const source = (id: string) => SONGS.find(song => song.id === id)!.source;
    expect(source('song_times_like_these')).toEqual({ site: 'Ultimate Guitar', file: 'Foo Fighters - Times Like These (ver 6 by nicholasp248).gpx', measure: 8 });
    expect(source('song_everlong')).toEqual({ site: 'Ultimate Guitar', file: 'Foo Fighters - Everlong (ver 11 by pierrelateur).gp', measure: 64 });
  });

  it('tup_37 no Guitar Pro file is tracked', () => {
    const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n');
    expect(tracked.filter(file => /\.(gp|gpx|gp3|gp4|gp5)$/i.test(file))).toEqual([]);
    // The fixture holds the 4 extracted drum measures of each new song, from its first measure
    expect([tabOf('song_times_like_these').first, tabOf('song_times_like_these').measures.length]).toEqual([8, 4]);
    expect([tabOf('song_everlong').first, tabOf('song_everlong').measures.length]).toEqual([64, 4]);
  });

  it('a song with tuplet beats keeps them in its preset, the click on each beat\'s first cell', () => {
    const song = { ...SONGS[0], bars: 1, beatCells: [[4, 3, 6, 4]], gridData: {} };
    const preset = songToPreset(song);
    expect(preset.beatCells).toEqual([[4, 3, 6, 4]]);
    expect(preset.gridData[0]).toEqual([2, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
    expect(preset.gridData[1]).toHaveLength(17);
    expect('beatCells' in songToPreset(SONGS[0])).toBe(false);
  });
});
