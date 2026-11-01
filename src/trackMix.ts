// Which tracks sound this session. Never part of a preset.
export interface TrackMix {
  muted: Set<number>;
  soloed: Set<number>;
}

export function createTrackMix(): TrackMix {
  return { muted: new Set(), soloed: new Set() };
}

function toggle(tracks: Set<number>, trackId: number): void {
  if (!tracks.delete(trackId)) tracks.add(trackId);
}

export function toggleMute(mix: TrackMix, trackId: number): void {
  toggle(mix.muted, trackId);
}

export function toggleSolo(mix: TrackMix, trackId: number): void {
  toggle(mix.soloed, trackId);
}

export function isAudible(mix: TrackMix, trackId: number): boolean {
  return mix.soloed.size > 0 ? mix.soloed.has(trackId) : !mix.muted.has(trackId);
}

// What the engine plays: the real steps, or silence of the same length
export function audibleSteps(mix: TrackMix, trackId: number, steps: number[]): Uint8Array {
  return isAudible(mix, trackId) ? new Uint8Array(steps) : new Uint8Array(steps.length);
}
