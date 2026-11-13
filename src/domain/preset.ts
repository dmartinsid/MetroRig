import { patternLength } from './pattern';
import { MAX_BAR_CELLS, barCells, isTupletSignature, patternCells } from './layout';
import { getBeatsPerMeasure } from './meter';
import { STEP_ACCENT, STEP_EMPTY, STEP_GHOST, STEP_NORMAL, TRACKS } from './kit';

export interface Preset {
  id: string;
  name: string;
  bpm: number;
  timeSignature: string;
  measureLength: number; // The steps of one bar, up to 32
  bars?: number; // 1 when absent
  beatCells?: number[][]; // Per bar, per beat: 4, 3 or 6 cells in /4 (AD-029). Absent: every beat straight
  gridData: Record<number, number[]>; // trackId -> one list of every bar's cells
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
  beatCells?: number[]; // One bar's cells per beat. Absent: every beat straight
}

// Drops stored swing and moves legacy 12-step 12/8 presets onto the 24-step grid
export function normalizePreset(preset: StoredPreset): Preset {
  const { swing: _swing, ...stored } = structuredClone(preset);
  const normalized = fitBars(fitLayout(stored));
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

// A layout that is not a /4 bar list of 4, 3 or 6 cells per beat is dropped, and the pattern falls back to
// its first bar, straight. A valid layout of straight beats only is dropped, as it changes nothing
function fitLayout(preset: Preset): Preset {
  const { beatCells, ...straight } = preset;
  if (beatCells === undefined) return preset;
  const beats = getBeatsPerMeasure(preset.timeSignature, preset.measureLength);
  const valid = isTupletSignature(preset.timeSignature) && Array.isArray(beatCells) && beatCells.length === (preset.bars ?? 1)
    && beatCells.every((bar, index) => Array.isArray(bar) && bar.length === beats && bar.every(cells => [3, 4, 6].includes(cells))
      && barCells(preset, index) <= MAX_BAR_CELLS);
  if (valid) return beatCells.flat().every(cells => cells === 4) ? straight : preset;

  const gridData: Record<number, number[]> = {};
  for (const [trackId, steps] of Object.entries(preset.gridData)) gridData[Number(trackId)] = steps.slice(0, preset.measureLength);
  return { ...straight, bars: 1, gridData };
}

// A bar count the stored cells do not hold falls back to the first bar
function fitBars(preset: Preset): Preset {
  if (preset.bars === undefined) return preset;
  const length = patternCells(preset);
  const fits = (preset.bars === 1 || preset.bars === 4) && Object.values(preset.gridData).every(steps => steps.length === length);
  if (fits) return preset;

  const { beatCells, ...straight } = preset;
  const first = beatCells?.[0];
  const gridData: Record<number, number[]> = {};
  for (const [trackId, steps] of Object.entries(preset.gridData)) gridData[Number(trackId)] = steps.slice(0, barCells(preset, 0));
  const kept = first && !first.every(cells => cells === 4) ? { beatCells: [first] } : {};
  return { ...straight, ...kept, bars: 1, gridData };
}

// Presets saved before the expanded kit lack the new tracks, and a stored step can hold anything
export function completeKit(preset: Preset): Preset {
  const gridData: Record<number, number[]> = {};
  for (const { id } of TRACKS) {
    const steps = preset.gridData[id] ?? new Array(patternCells(preset)).fill(0);
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
