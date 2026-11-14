import type { TrainerFields } from '../app/session';
import { MAX_PATTERN_CELLS } from '../domain/layout';

const RENDER_QUANTUM = 128; // Frames in every AudioWorklet block

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatTimer(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`;
}

// Stepped runs read as integers; Smooth runs show their real value
export function formatLiveBpm(bpm: number): string {
  return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1);
}

// The Trainer as the form shows it, typed text included
export function formatTrainerStatus(fields: TrainerFields): string {
  const bars = fields.stepValue === '1' ? 'bar' : 'bars';
  const unit = fields.stepType === 'measures' ? bars : 's';
  return fields.enabled
    ? `Trainer ${fields.startBpm} → ${fields.targetBpm} BPM · +${fields.increment} every ${fields.stepValue} ${unit}`
    : 'Trainer Off';
}

export function formatClock(sampleRate: number): string {
  const kHz = (sampleRate / 1000).toFixed(1);
  const bufferMs = ((RENDER_QUANTUM / sampleRate) * 1000).toFixed(1);
  return `AUDIO CLOCK: ${kHz} kHz ${RENDER_QUANTUM} SPLS (${bufferMs}ms)`;
}

export function formatLatency(ms: number | null): string {
  return ms === null ? 'LATENCY: --' : `LATENCY: ${ms.toFixed(1)}ms`;
}

export function formatBarStep(bar: number, step: number): string {
  return `BAR ${pad(bar)} · STEP ${pad(step)}`;
}

// A pattern's cells over all its bars, against the engine's limit (STEPS_COUNT in engine/src/sequencer/pattern.rs)
export function formatSteps(cells: number): string {
  return `STEPS: ${cells}/${MAX_PATTERN_CELLS}`;
}
