// Kick, Snare and the toms play The House Kit: one recording per dynamic, 3 takes of each
interface Bank {
  folder: string; // Under /kit/house, such as 'tom-10'
  recordings: [string, string, string]; // Ghost, Normal, Accent
  trim: number; // Set by ear
}

const BANK_TRIM = 0.7; // Approved by ear for Snare and the toms
const TAKES = 3;
const KICK_TOM_RECORDINGS: Bank['recordings'] = ['soft', 'med', 'hard'];
const KICK_TRIM = 0.85; // Approved by ear; the layers lowered the Kick files by 1.8 dB on average
const bankOf = (folder: string, recordings = KICK_TOM_RECORDINGS, trim = BANK_TRIM): Bank => ({ folder, recordings, trim });

// Every track of the kit, in grid order. Ids 0 to 10 predate the expanded kit, so saved presets keep them,
// which is why Floor Tom (id 10) comes after Mid Tom (11) and Low Tom (12). Look tracks up by id, not by position.
export const TRACKS: { id: number; name: string; label: string; sample: string | null; bank?: Bank }[] = [
  { id: 0, name: 'Click', label: 'CLICK', sample: null },
  { id: 1, name: 'Kick', label: 'KICK', sample: null, bank: bankOf('kick', KICK_TOM_RECORDINGS, KICK_TRIM) },
  { id: 2, name: 'Snare', label: 'SNARE', sample: null, bank: bankOf('snare', ['soft', 'hard', 'crack']) },
  { id: 3, name: 'Hi-hat', label: 'HI-HAT', sample: '/hihat.wav' },
  { id: 4, name: 'Open Hat', label: 'OPEN HAT', sample: '/kit/open-hat.wav' },
  { id: 5, name: 'Ride', label: 'RIDE', sample: '/kit/ride.wav' },
  { id: 6, name: 'Ride Bell', label: 'RIDE BELL', sample: '/kit/ride-bell.wav' },
  { id: 7, name: 'Crash', label: 'CRASH', sample: '/kit/crash.wav' },
  { id: 8, name: 'China', label: 'CHINA', sample: '/kit/china.wav' },
  { id: 9, name: 'High Tom', label: 'HIGH TOM', sample: null, bank: bankOf('tom-10') },
  { id: 11, name: 'Mid Tom', label: 'MID TOM', sample: null, bank: bankOf('tom-12') },
  { id: 12, name: 'Low Tom', label: 'LOW TOM', sample: null, bank: bankOf('tom-14') },
  { id: 10, name: 'Floor Tom', label: 'FLOOR TOM', sample: null, bank: bankOf('tom-16') },
];

// Every take of a bank track: dynamic 0 Ghost, 1 Normal, 2 Accent, take from 0, and the file to load
export function takesOf(track: { bank?: Bank }): { dynamic: number; take: number; url: string }[] {
  const { bank } = track;
  if (!bank) return [];
  return bank.recordings.flatMap((recording, dynamic) =>
    Array.from({ length: TAKES }, (_, take) => ({
      dynamic,
      take,
      url: `/kit/house/${bank.folder}/${recording}-${take + 1}.wav`,
    })));
}

export const CLICK_TRACK = 0;

// The Stadium reads from a distance, so its rings and orbs show areas of the kit
export const STADIUM_GROUPS: { label: string; trackIds: number[] }[] = [
  { label: 'CLICK', trackIds: [0] },
  { label: 'KICK', trackIds: [1] },
  { label: 'SNARE/TOMS', trackIds: [2, 9, 11, 12, 10] },
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
