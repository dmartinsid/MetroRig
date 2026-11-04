import { patternLength } from './pattern';
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
