const RENDER_QUANTUM = 128; // Frames in every AudioWorklet block
const MAX_STEPS = 32; // STEPS_COUNT in src/lib.rs
const DENOMINATORS = [4, 8, 16];

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatTimer(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`;
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

export function formatSteps(measureLength: number): string {
  return `STEPS: ${measureLength}/${MAX_STEPS}`;
}

// Stops at /4 and /16 instead of wrapping
export function nextDenominator(current: number, direction: 1 | -1): number {
  const index = DENOMINATORS.indexOf(current) + direction;
  return DENOMINATORS[Math.min(DENOMINATORS.length - 1, Math.max(0, index))];
}
