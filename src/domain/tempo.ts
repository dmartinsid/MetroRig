// The tempo range the header slider and the Stadium steps share
export const MIN_BPM = 40;
export const MAX_BPM = 240;

export type TempoStep = 1 | -1;

// One whole BPM in the step's direction, so a fractional tempo lands on the next whole one, held to the range
export function steppedBpm(bpm: number, step: TempoStep): number {
  const next = step > 0 ? Math.floor(bpm) + 1 : Math.ceil(bpm) - 1;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, next));
}

// `+` sits on the `=` key without Shift; the numpad sends `+` and `-` too. Ctrl or Cmd belongs to the browser
export function tempoKeyStep(key: string, modifier: boolean): TempoStep | null {
  if (modifier) return null;
  if (key === '+' || key === '=') return 1;
  if (key === '-') return -1;
  return null;
}
