import { patternLength } from './bars';
import { STEP_ACCENT, STEP_EMPTY, STEP_GHOST, STEP_NORMAL, TRACKS } from './kit';

export interface Preset {
  id: string;
  name: string;
  bpm: number;
  timeSignature: string;
  measureLength: number; // The steps of one bar, up to 32
  bars?: number; // 1 when absent
  gridData: Record<number, number[]>; // trackId -> one list of every bar's steps
  trainerSettings: {
    enabled: boolean;
    startBpm: number;
    targetBpm: number;
    increment: number;
    stepType: 'measures' | 'seconds';
    stepValue: number;
    curve: 'stepped' | 'smooth';
  };
}

// What IndexedDB may still return for presets saved before swing was removed
export type StoredPreset = Preset & { swing?: number };

export type TrainerSettings = Preset['trainerSettings'];

export type ViewMode = 'editor' | 'stadium' | 'grooves' | 'improv';

export interface PracticeLog {
  id?: number;
  date: string;
  durationSeconds: number;
  startBpm: number;
  maxBpm: number;
}

export interface CustomGroove {
  id: string;
  name: string;
  gridData: Record<number, number[]>; // the drum tracks, without Click
  measureLength: number;
}

// Beats in a bar come from the time signature numerator, e.g. 3 for 3/4 and 6 for 6/8
export function getBeatsPerMeasure(timeSignature: string | undefined, measureLength: number): number {
  const beats = parseInt(timeSignature ?? '', 10);
  return beats > 0 ? beats : Math.max(1, Math.round(measureLength / 4));
}

// A step is a sixteenth: 4 per quarter, 2 per eighth and 1 per sixteenth
export function measureLengthFor(numerator: number, denominator: number): number {
  if (denominator === 4) return numerator * 4;
  if (denominator === 8) return numerator * 2;
  return numerator;
}

// Drops stored swing and moves legacy 12-step 12/8 presets onto the 24-step grid
export function normalizePreset(preset: StoredPreset): Preset {
  const { swing: _swing, ...stored } = structuredClone(preset);
  const normalized = fitBars(stored);
  if (normalized.timeSignature !== '12/8' || normalized.measureLength !== 12) return normalized;

  const gridData: Record<number, number[]> = {};
  const length = patternLength(normalized);
  for (const [trackId, steps] of Object.entries(normalized.gridData)) {
    const expanded = new Array(length * 2).fill(0);
    for (let step = 0; step < length; step++) expanded[step * 2] = steps[step] ?? 0;
    gridData[Number(trackId)] = expanded;
  }
  return { ...normalized, measureLength: 24, gridData, bpm: Math.min(240, Math.round(normalized.bpm * 1.5)) };
}

// A bar count the stored steps do not hold falls back to the first bar
function fitBars(preset: Preset): Preset {
  if (preset.bars === undefined) return preset;
  const length = patternLength(preset);
  const fits = (preset.bars === 1 || preset.bars === 4) && Object.values(preset.gridData).every(steps => steps.length === length);
  if (fits) return preset;

  const gridData: Record<number, number[]> = {};
  for (const [trackId, steps] of Object.entries(preset.gridData)) gridData[Number(trackId)] = steps.slice(0, preset.measureLength);
  return { ...preset, bars: 1, gridData };
}

// Presets saved before the expanded kit lack the new tracks, and a stored step can hold anything
export function completeKit(preset: Preset): Preset {
  const gridData: Record<number, number[]> = {};
  for (const { id } of TRACKS) {
    const steps = preset.gridData[id] ?? new Array(patternLength(preset)).fill(0);
    gridData[id] = steps.map(value => (isStepValue(value) ? value : STEP_NORMAL));
  }
  return { ...preset, gridData };
}

function isStepValue(value: number): boolean {
  return [STEP_EMPTY, STEP_NORMAL, STEP_ACCENT, STEP_GHOST].includes(value);
}

// The tempo a preset plays its first hit at
export function startBpmFor(preset: Preset): number {
  return preset.trainerSettings.enabled ? preset.trainerSettings.startBpm : preset.bpm;
}

// Maps a sequencer step to its zero-based beat within the bar
export function getBeatForStep(step: number, measureLength: number, beatsPerMeasure: number): number {
  return Math.floor((step * beatsPerMeasure) / measureLength);
}

// True for an empty step that belongs to the previous hit: the eighth in a gallop, say
export function isSustainedStep(steps: number[], step: number, measureLength: number, beatsPerMeasure: number): boolean {
  if (steps[step] > 0) return false;
  const beat = getBeatForStep(step, measureLength, beatsPerMeasure);
  const beatHits: number[] = [];
  for (let i = 0; i < measureLength; i++) {
    if (steps[i] > 0 && getBeatForStep(i, measureLength, beatsPerMeasure) === beat) beatHits.push(i);
  }
  return beatHits.length > 1 && beatHits[0] < step;
}

// Rhythmic figures one quarter note long, stamped onto the grid in one click
export const FIGURES = [
  { id: 'quarter', name: 'Quarter', pattern: [1, 0, 0, 0] },
  { id: 'eighths', name: 'Eighths', pattern: [1, 0, 1, 0] },
  { id: 'gallop', name: 'Gallop', pattern: [1, 0, 1, 1] },
  { id: 'reverse_gallop', name: 'Rev. Gallop', pattern: [1, 1, 0, 1] },
  { id: 'sixteenths', name: '16ths', pattern: [1, 1, 1, 1] },
  { id: 'rest', name: 'Rest', pattern: [0, 0, 0, 0] },
];

// Writes a figure over the quarter note containing step, clipped to the measure
export function applyFigure(steps: number[], step: number, pattern: number[], measureLength: number): void {
  const start = step - (step % pattern.length);
  pattern.forEach((value, i) => {
    if (start + i < measureLength) steps[start + i] = value;
  });
}

export class StateManager {
  private dbPromise: Promise<IDBDatabase>;
  private subscribers: Set<(state: any) => void> = new Set();
  
  public activePreset: Preset = {
    id: 'default',
    name: '4/4 Metronome',
    bpm: 120,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // Clicks
      1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Kick
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Snare
      3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Hihat
    },
    trainerSettings: {
      enabled: false,
      startBpm: 120,
      targetBpm: 160,
      increment: 5,
      stepType: 'measures',
      stepValue: 4,
      curve: 'stepped',
    }
  };

  public activeViewMode: ViewMode = 'editor';
  public isPlaying: boolean = false;
  public currentLiveBpm: number = 120;

  constructor() {
    this.dbPromise = this.initDB();
    this.loadActiveViewMode();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve({} as IDBDatabase);
        return;
      }
      const request = indexedDB.open('metrorig_db', 2);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('presets')) {
          db.createObjectStore('presets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('practice_logs')) {
          db.createObjectStore('practice_logs', { autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('grooves')) {
          db.createObjectStore('grooves', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private loadActiveViewMode() {
    const mode = localStorage.getItem('metrorig_view_mode');
    if (mode === 'stadium' || mode === 'editor' || mode === 'grooves' || mode === 'improv') {
      this.activeViewMode = mode;
    }
  }

  setViewMode(mode: ViewMode) {
    this.activeViewMode = mode;
    localStorage.setItem('metrorig_view_mode', mode);
    this.notify();
  }

  subscribe(callback: (state: any) => void) {
    this.subscribers.add(callback);
    callback(this);
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach((cb) => cb(this));
  }

  async savePreset(preset: Preset): Promise<void> {
    const db = await this.dbPromise;
    if (!db.transaction) {
      this.activePreset = preset;
      this.notify();
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('presets', 'readwrite');
      const store = transaction.objectStore('presets');
      const request = store.put(preset);
      request.onsuccess = () => {
        this.activePreset = preset;
        this.notify();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPresets(): Promise<Preset[]> {
    const db = await this.dbPromise;
    if (!db.transaction) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('presets', 'readonly');
      const store = transaction.objectStore('presets');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async logPracticeSession(log: PracticeLog): Promise<void> {
    const db = await this.dbPromise;
    if (!db.transaction) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('practice_logs', 'readwrite');
      const store = transaction.objectStore('practice_logs');
      const request = store.add(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPracticeLogs(): Promise<PracticeLog[]> {
    const db = await this.dbPromise;
    if (!db.transaction) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('practice_logs', 'readonly');
      const store = transaction.objectStore('practice_logs');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveGroove(groove: CustomGroove): Promise<void> {
    const db = await this.dbPromise;
    if (!db.transaction) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('grooves', 'readwrite');
      const store = transaction.objectStore('grooves');
      const request = store.put(groove);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllGrooves(): Promise<CustomGroove[]> {
    const db = await this.dbPromise;
    if (!db.transaction) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('grooves', 'readonly');
      const store = transaction.objectStore('grooves');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const FACTORY_PRESETS: Preset[] = [
  {
    id: 'default',
    name: '4/4 Metronome',
    bpm: 120,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: '3_4',
    name: '3/4 Metronome',
    bpm: 120,
    timeSignature: '3/4',
    measureLength: 12,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: '6_8',
    name: '6/8 Metronome',
    bpm: 120,
    timeSignature: '6/8',
    measureLength: 12,
    gridData: {
      0: [2, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 0, 0, 0, 0],
      1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: '7_8',
    name: '7/8 Metronome',
    bpm: 120,
    timeSignature: '7/8',
    measureLength: 14,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: 'rock',
    name: 'Rock Groove',
    bpm: 120,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      1: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      3: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: 'metal',
    name: 'Metal Groove',
    bpm: 140,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      1: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0],
      2: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      3: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: 'blues',
    name: 'Blues Shuffle',
    bpm: 135,
    timeSignature: '12/8',
    measureLength: 24,
    gridData: {
      0: [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      1: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      3: [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: 'jazz',
    name: 'Jazz Swing',
    bpm: 195,
    timeSignature: '12/8',
    measureLength: 24,
    gridData: {
      0: [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      1: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      3: [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: 'metalcore',
    name: 'Metalcore Breakdown',
    bpm: 160,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      1: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      3: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  }
];

// Each factory groove is the drum part of the preset with the same id
export const FACTORY_GROOVES: { id: string; name: string; length: number; tracks: Record<number, number[]> }[] =
  ['rock', 'metal', 'blues', 'jazz', 'metalcore'].map(id => {
    const { name, measureLength, gridData } = FACTORY_PRESETS.find(preset => preset.id === id)!;
    const drumTrack = (trackId: number) => gridData[trackId].slice(0, measureLength);
    return { id, name, length: measureLength, tracks: { 1: drumTrack(1), 2: drumTrack(2), 3: drumTrack(3) } };
  });

// Imported from indiebubbler/metro: kick on 1-2-3, snare on 4, hi-hat on every beat
function speedTrainer(id: string, name: string, startBpm: number, targetBpm: number, increment: number, bars: number): Preset {
  return {
    id,
    name,
    bpm: startBpm,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      1: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      3: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    },
    trainerSettings: { enabled: true, startBpm, targetBpm, increment, stepType: 'measures', stepValue: bars, curve: 'stepped' }
  };
}

export const SPEED_TRAINER_PRESETS: Preset[] = [
  speedTrainer('trainer_69_110', '69 - 110 - 4/4', 67, 110, 2, 1),
  speedTrainer('trainer_110_135', '110-135 - 4/4', 110, 135, 1, 1),
  speedTrainer('trainer_134_180', '134-180- 4/4', 134, 181, 1, 2),
  speedTrainer('trainer_179_220', '179-220 - 4/4', 179, 220, 1, 2),
  speedTrainer('trainer_calvagada_148_190', 'Calvagada - 148 - 190', 148, 190, 2, 3),
  speedTrainer('trainer_calvagada_189_215', 'Calvagada - 189 - 215', 189, 213, 1, 4),
  speedTrainer('trainer_134_162', '134-162 -4/4', 134, 162, 1, 3),
  speedTrainer('trainer_180_195', '180 to 195', 180, 195, 1, 4),
  speedTrainer('trainer_130_140', '130 to 140', 130, 140, 1, 4),
  speedTrainer('trainer_ligados', 'Ligados', 70, 167, 2, 1),
  {
    // The Trooper's gallop (eighth + two sixteenths), 20 BPM around its ~160 BPM tempo
    ...speedTrainer('trainer_gallop', 'Gallop', 140, 180, 1, 2),
    gridData: {
      0: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      1: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
      2: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      3: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    },
  },
];
