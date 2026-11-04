import { patternLength } from './pattern';
import { STEP_ACCENT, STEP_GHOST, STEP_NORMAL, TRACKS } from './kit';
import { getBeatsPerMeasure } from './meter';
import type { Preset } from './preset';

export type Genre = 'Rock' | 'Metal' | 'Metalcore' | 'Blues';
export type GenreTab = Genre | 'All';

export const GENRE_TABS: GenreTab[] = ['All', 'Rock', 'Metal', 'Metalcore', 'Blues'];

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  section: string;
  bpm: number;
  timeSignature: string;
  measureLength: number; // The steps of one bar
  bars: number;
  gridData: Record<number, number[]>; // Drum tracks only, every bar in a row; a track left out is empty
  source: { url: string; revisionId: number; measure: number }; // The first bar, counting from 0
}

// Bars as text: . empty, x normal, X accent, g ghost
function bars(...text: string[]): number[] {
  const values: Record<string, number> = { x: STEP_NORMAL, X: STEP_ACCENT, g: STEP_GHOST };
  return [...text.join('')].map(step => values[step] ?? 0);
}

// Four consecutive measures of the song's Songsterr drum tab, fills included, read with
// scripts/tab_to_grid.js. The BPM is the tab's tempo at the first one.
export const SONGS: Song[] = [
  {
    id: 'song_back_in_black',
    title: 'Back in Black',
    artist: 'AC/DC',
    genre: 'Rock',
    section: 'Verse',
    bpm: 94,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('x.......x.......', 'x.......x.......', 'x.......x.......', 'x....x..x..x....'),
      2: bars('....x.......x...', '....x.......x...', '....x.......x...', '....x..x..x..xx.'),
      3: bars('..x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.............'),
      4: bars('................', '................', '................', '.....x..x..x....'),
      7: bars('x...............', '................', '................', '................'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/ac-dc-back-in-black-drum-tab-s1024', revisionId: 9880696, measure: 10 },
  },
  {
    id: 'song_highway_to_hell',
    title: 'Highway to Hell',
    artist: 'AC/DC',
    genre: 'Rock',
    section: 'Verse',
    bpm: 116,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('x.......x.....x.', 'x.......x.....x.', 'x.......x.......', '....x...x...x...'),
      2: bars('....x.......x...', '....x.......x...', '....x.......x...', 'x...x.x.x.x.x.x.'),
      3: bars('..g...g...g...g.', '..g...g...g...g.', '..g...g...g...g.', '................'),
      4: bars('x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...', '................'),
      7: bars('................', '................', '................', 'x...............'),
      10: bars('................', '................', '................', '....x.x.x.x.x.x.'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/ac-dc-highway-to-hell-drum-tab-s289', revisionId: 10066396, measure: 21 },
  },
  {
    id: 'song_the_trooper',
    title: 'The Trooper',
    artist: 'Iron Maiden',
    genre: 'Metal',
    section: 'Verse',
    bpm: 162,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('..x.....x.xx....', 'x.x.....x.x...x.', '..x.....x.x.....', 'x.xx....x.x...x.'),
      2: bars('....x.......x...', '....x.......x...', '....x.......x...', '....x.......x...'),
      3: bars('x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...'),
      5: bars('....x...x...x...', 'x...x...x.x.....', '........x...x...', 'x...x.x.x.g.....'),
      7: bars('................', '..............x.', '................', '..............x.'),
      8: bars('................', '................', '....x...........', '................'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/iron-maiden-the-trooper-drum-tab-s338', revisionId: 8957174, measure: 64 },
  },
  {
    id: 'song_run_to_the_hills',
    title: 'Run to the Hills',
    artist: 'Iron Maiden',
    genre: 'Metal',
    section: 'Verse',
    bpm: 173,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('x.......x.......', 'x.......x.......', 'x.......x.......', 'x.......x.......'),
      2: bars('....x.......x...', '....x.......x...', '....x.......x...', '....x.......x...'),
      3: bars('.xxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx', '.xxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx'),
      7: bars('x...............', '................', 'x...............', '................'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/iron-maiden-run-to-the-hills-drum-tab-s453', revisionId: 9719551, measure: 26 },
  },
  {
    id: 'song_enter_sandman',
    title: 'Enter Sandman',
    artist: 'Metallica',
    genre: 'Metal',
    section: 'Verse',
    bpm: 123,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('........x.......', 'x.......x.......', 'x.......x.......', 'x.......x.....x.'),
      2: bars('....x.......x...', '....x.......x...', '....x.......x...', '....x.......x...'),
      4: bars('..g.X.g.X.g.X.g.', 'X.g.X.g.X.g.X.g.', 'X.g.X.g.X.g.X.g.', 'X.g.X.g.X.g.X...'),
      7: bars('................', '................', '................', '..............x.'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/metallica-enter-sandman-drum-tab-s19', revisionId: 9970441, measure: 37 },
  },
  {
    id: 'song_master_of_puppets',
    title: 'Master of Puppets',
    artist: 'Metallica',
    genre: 'Metal',
    section: 'Main Riff',
    bpm: 212,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('x.........x...x.', '..x...x...x.....', 'x.x...x...x...x.', '..x.......xx....'),
      2: bars('....x.......x...', '....x.......x...', '....x.......x...', '....x.......x...'),
      4: bars('....x...x...x...', 'x...x...x...x...', 'x...x...x...x...', 'x...x...x.......'),
      7: bars('x...............', '................', '................', '............x...'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/metallica-master-of-puppets-drum-tab-s455118', revisionId: 10085272, measure: 27 },
  },
  {
    id: 'song_battery',
    title: 'Battery',
    artist: 'Metallica',
    genre: 'Metal',
    section: 'Verse',
    bpm: 194,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('x...xx..x....x..', 'x...xx..x....x..', 'x...xx..x...xx..', 'x...xx..x...xx..'),
      2: bars('..x...x...x...x.', '..x...x...x...x.', '..x...x...x...x.', '..x...x.........'),
      4: bars('..x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x...x...x.x.x.x.'),
      7: bars('x...............', '................', '................', '..x...x.........'),
      12: bars('................', '................', '................', '..........x...x.'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/metallica-battery-drum-tab-s13313', revisionId: 10083283, measure: 40 },
  },
  {
    id: 'song_tears_dont_fall',
    title: "Tears Don't Fall",
    artist: 'Bullet for My Valentine',
    genre: 'Metalcore',
    section: 'Chorus',
    bpm: 162,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.xxxxxxxx'),
      2: bars('........x.......', '........x.......', '........x.......', '........x.......'),
      7: bars('x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/bullet-for-my-valentine-tears-dont-fall-drum-tab-s23498', revisionId: 9692689, measure: 58 },
  },
  {
    id: 'song_scream_aim_fire',
    title: 'Scream Aim Fire',
    artist: 'Bullet for My Valentine',
    genre: 'Metalcore',
    section: 'Verse',
    bpm: 200,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...'),
      2: bars('..x...x...x...x.', '..x...x...x...x.', '..x...x...x...x.', '..x...x...x...x.'),
      4: bars('....x...x...x...', 'x...x...x...x...', '....x...x...x...', '................'),
      7: bars('x...............', '................', 'x...............', 'x...x...x...x...'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/bullet-for-my-valentine-scream-aim-fire-drum-tab-s23212', revisionId: 9326532, measure: 26 },
  },
  {
    id: 'song_dont_need_you',
    title: "Don't Need You",
    artist: 'Bullet for My Valentine',
    genre: 'Metalcore',
    section: 'Chorus',
    bpm: 154,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('x..x..x...x...x.', 'x..x..x...x...x.', 'x..x..x.xxx...x.', 'x..x..x...x...x.'),
      2: bars('x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...'),
      4: bars('....x...x...x...', 'x...x...x...x...', '....x...x...x...', 'x...x...x...x...'),
      7: bars('x...............', '................', 'x...............', '................'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/bullet-for-my-valentine-dont-need-you-drum-tab-s424443', revisionId: 8488354, measure: 49 },
  },
  {
    id: 'song_cocaine',
    title: 'Cocaine',
    artist: 'Eric Clapton',
    genre: 'Blues',
    section: 'Verse',
    bpm: 105,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('x.....x.x.......', 'x.......x.......', 'x.......x.......', 'x.......x.......'),
      2: bars('....x.......x...', '.g..x....g..xg..', '.g..x....g..x...', '.g..x....g..x..g'),
      3: bars('....x...x.xxx.xx', 'x.xxx.xxx.xxx.xx', 'x.xxx.xxx.xxx.xx', 'x.xxx.xxx.xxx...'),
      4: bars('..x.............', '................', '................', '..............x.'),
      7: bars('x...............', '................', '................', '................'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/eric-clapton-cocaine-drum-tab-s374', revisionId: 8150705, measure: 22 },
  },
  {
    id: 'song_crossroads',
    title: 'Crossroads',
    artist: 'Cream (Eric Clapton)',
    genre: 'Blues',
    section: 'Verse',
    bpm: 132,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('..x...x.......x.', '..x...x.......x.', '..x...x.......x.', '..x...x.........'),
      2: bars('....x...x...x...', '....x...x...x...', '....x...x...x...', '....x...x...xxxx'),
      3: bars('......x.......x.', '......x.......x.', '......x.......x.', '................'),
      10: bars('x...............', 'x...............', 'x...............', 'x...............'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/cream-crossroads-live-drum-tab-s242', revisionId: 7699510, measure: 20 },
  },
  {
    id: 'song_thrill_is_gone',
    title: 'The Thrill Is Gone',
    artist: 'B.B. King',
    genre: 'Blues',
    section: 'Verse',
    bpm: 91,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('X......X..X.....', 'X......X..X.....', 'X......X..X.....', 'X......X..X.....'),
      2: bars('....X.......X...', '....X....g..X...', '....X.......X...', '....X....g..X...'),
      3: bars('x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x...', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x...'),
      4: bars('................', '..............x.', '................', '..............x.'),
      7: bars('g...............', '................', '................', '................'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/b-b-king-the-thrill-is-gone-drum-tab-s2316', revisionId: 9249769, measure: 13 },
  },
  {
    id: 'song_every_day',
    title: 'Every Day I Have the Blues',
    artist: 'B.B. King',
    genre: 'Blues',
    section: 'Main',
    bpm: 200,
    timeSignature: '4/4',
    measureLength: 16,
    bars: 4,
    gridData: {
      1: bars('x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...'),
      2: bars('..x.x.x.x.x.x.x.', '..x.x.x.x.x.x.x.', '..x...x...x...x.', '..x...x...x...x.'),
      5: bars('x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/b-b-king-every-day-i-have-the-blues-cook-county-drum-tab-s3882248', revisionId: 5093818, measure: 14 },
  },
];

export function songsForGenre(genre: GenreTab): Song[] {
  return genre === 'All' ? SONGS : SONGS.filter(song => song.genre === genre);
}

// A song is an ordinary preset, so every load, save and playback path serves it
export function songToPreset(song: Song): Preset {
  const { id, title, bpm, timeSignature, measureLength, bars } = song;
  const length = patternLength(song);
  const beats = getBeatsPerMeasure(timeSignature, measureLength);
  const stepsPerBeat = measureLength / beats;

  const gridData: Record<number, number[]> = {};
  TRACKS.forEach(track => {
    gridData[track.id] = [...(song.gridData[track.id] ?? new Array(length).fill(0))];
  });
  gridData[0] = Array.from({ length }, (_, step) => {
    if (step % stepsPerBeat !== 0) return 0;
    return step === 0 ? STEP_ACCENT : STEP_NORMAL;
  });

  return {
    id,
    name: title,
    bpm,
    timeSignature,
    measureLength,
    bars,
    gridData,
    trainerSettings: { enabled: false, startBpm: bpm, targetBpm: Math.min(240, bpm + 40), increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' },
  };
}
