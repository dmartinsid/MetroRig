// Every track of the kit, in grid order. Ids 0 to 3 predate the expanded kit, so saved presets keep them.
export const TRACKS: { id: number; name: string; label: string; sample: string | null }[] = [
  { id: 0, name: 'Click', label: 'CLICK', sample: null },
  { id: 1, name: 'Kick', label: 'KICK', sample: '/kit/kick.wav' },
  { id: 2, name: 'Snare', label: 'SNARE', sample: '/kit/snare.wav' },
  { id: 3, name: 'Hi-hat', label: 'HI-HAT', sample: '/kit/hihat.wav' },
  { id: 4, name: 'Open Hat', label: 'OPEN HAT', sample: '/kit/open-hat.wav' },
  { id: 5, name: 'Ride', label: 'RIDE', sample: '/kit/ride.wav' },
  { id: 6, name: 'Ride Bell', label: 'RIDE BELL', sample: '/kit/ride-bell.wav' },
  { id: 7, name: 'Crash', label: 'CRASH', sample: '/kit/crash.wav' },
  { id: 8, name: 'China', label: 'CHINA', sample: '/kit/china.wav' },
  { id: 9, name: 'High Tom', label: 'HIGH TOM', sample: '/kit/high-tom.wav' },
  { id: 10, name: 'Floor Tom', label: 'FLOOR TOM', sample: '/kit/floor-tom.wav' },
];

export const CLICK_TRACK = 0;

// The Stadium reads from a distance, so its rings and orbs show areas of the kit
export const STADIUM_GROUPS: { label: string; trackIds: number[] }[] = [
  { label: 'CLICK', trackIds: [0] },
  { label: 'KICK', trackIds: [1] },
  { label: 'SNARE/TOMS', trackIds: [2, 9, 10] },
  { label: 'CYMBALS', trackIds: [3, 4, 5, 6, 7, 8] },
];

export const STEP_EMPTY = 0;
export const STEP_NORMAL = 1;
export const STEP_ACCENT = 2;
export const STEP_GHOST = 3;

const DRUM_CYCLE = [STEP_EMPTY, STEP_NORMAL, STEP_ACCENT, STEP_GHOST];
const CLICK_CYCLE = [STEP_EMPTY, STEP_NORMAL, STEP_ACCENT];

// The value a step takes when its grid cell is clicked
export function nextStepValue(trackId: number, value: number): number {
  const cycle = trackId === CLICK_TRACK ? CLICK_CYCLE : DRUM_CYCLE;
  return cycle[(cycle.indexOf(value) + 1) % cycle.length];
}

export function groupHit(trackIds: number[], gridData: Record<number, number[]>, step: number): boolean {
  return trackIds.some(trackId => (gridData[trackId]?.[step] ?? 0) > 0);
}
