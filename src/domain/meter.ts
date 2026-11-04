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
