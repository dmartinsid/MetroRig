import { STEP_ACCENT, STEP_GHOST, STEP_NORMAL, TRACKS } from './kit';
import { getBeatsPerMeasure } from './state';
import type { Preset } from './state';

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
  measureLength: number;
  gridData: Record<number, number[]>; // Drum tracks only; a track left out is empty
  source: { url: string; revisionId: number; measure: number }; // The measure counts from 0
}

// One bar as text: . empty, x normal, X accent, g ghost
function steps(bar: string): number[] {
  const values: Record<string, number> = { x: STEP_NORMAL, X: STEP_ACCENT, g: STEP_GHOST };
  return [...bar].map(step => values[step] ?? 0);
}

// Each bar is the song's most repeated bar in its section, read from its Songsterr drum tab
// with scripts/tab_to_grid.js. The BPM is the tab's tempo at that measure.
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
    gridData: {
      1: steps('x.......x.......'),
      2: steps('....x.......x...'),
      3: steps('x.x.x.x.x.x.x.x.'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/ac-dc-back-in-black-drum-tab-s1024', revisionId: 9880696, measure: 3 },
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
    gridData: {
      1: steps('x.......x.....x.'),
      2: steps('....x.......x...'),
      3: steps('..g...g...g...g.'),
      4: steps('x...x...x...x...'),
    },
    source: { url: 'https://www.songsterr.com/a/wsa/ac-dc-highway-to-hell-drum-tab-s289', revisionId: 10066396, measure: 7 },
  },
];

export function songsForGenre(genre: GenreTab): Song[] {
  return genre === 'All' ? SONGS : SONGS.filter(song => song.genre === genre);
}

// A song is an ordinary preset, so every load, save and playback path serves it
export function songToPreset(song: Song): Preset {
  const { id, title, bpm, timeSignature, measureLength } = song;
  const beats = getBeatsPerMeasure(timeSignature, measureLength);
  const stepsPerBeat = measureLength / beats;

  const gridData: Record<number, number[]> = {};
  TRACKS.forEach(track => {
    gridData[track.id] = [...(song.gridData[track.id] ?? new Array(measureLength).fill(0))];
  });
  gridData[0] = Array.from({ length: measureLength }, (_, step) => {
    if (step % stepsPerBeat !== 0) return 0;
    return step === 0 ? STEP_ACCENT : STEP_NORMAL;
  });

  return {
    id,
    name: title,
    bpm,
    timeSignature,
    measureLength,
    gridData,
    trainerSettings: { enabled: false, startBpm: bpm, targetBpm: Math.min(240, bpm + 40), increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' },
  };
}
