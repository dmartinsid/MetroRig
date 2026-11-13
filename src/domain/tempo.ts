// The range of a Stadium step. The header slider's `min` and `max` in index.html hold the same numbers
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

// What a key lands on, as the page reports it
export interface KeyTarget {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
}

// Inputs that take no typed text: a key pressed on them is still the Stadium's
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']);

// A field where `+` and `-` are characters the user is typing
export function typesText(target: KeyTarget): boolean {
  if (target.isContentEditable) return true;
  const tag = target.tagName.toUpperCase();
  if (tag === 'TEXTAREA') return true;
  return tag === 'INPUT' && !NON_TEXT_INPUTS.has((target.type ?? 'text').toLowerCase());
}
