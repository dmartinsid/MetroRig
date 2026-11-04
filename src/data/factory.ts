import type { Preset } from '../domain/preset';

export const FACTORY_PRESETS: Preset[] = [
  {
    id: 'default',
    name: '4/4 Metronome',
    bpm: 120,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: '3_4',
    name: '3/4 Metronome',
    bpm: 120,
    timeSignature: '3/4',
    measureLength: 12,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: '6_8',
    name: '6/8 Metronome',
    bpm: 120,
    timeSignature: '6/8',
    measureLength: 12,
    gridData: {
      0: [2, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 0, 0, 0, 0],
      1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: '7_8',
    name: '7/8 Metronome',
    bpm: 120,
    timeSignature: '7/8',
    measureLength: 14,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: 'rock',
    name: 'Rock Groove',
    bpm: 120,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      1: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      3: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: 'metal',
    name: 'Metal Groove',
    bpm: 140,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      1: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0],
      2: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      3: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: 'blues',
    name: 'Blues Shuffle',
    bpm: 135,
    timeSignature: '12/8',
    measureLength: 24,
    gridData: {
      0: [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      1: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      3: [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: 'jazz',
    name: 'Jazz Swing',
    bpm: 195,
    timeSignature: '12/8',
    measureLength: 24,
    gridData: {
      0: [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      1: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      3: [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  },
  {
    id: 'metalcore',
    name: 'Metalcore Breakdown',
    bpm: 160,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      1: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      3: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    },
    trainerSettings: { enabled: false, startBpm: 120, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' }
  }
];

// Each factory groove is the drum part of the preset with the same id
export const FACTORY_GROOVES: { id: string; name: string; length: number; tracks: Record<number, number[]> }[] =
  ['rock', 'metal', 'blues', 'jazz', 'metalcore'].map(id => {
    const { name, measureLength, gridData } = FACTORY_PRESETS.find(preset => preset.id === id)!;
    const drumTrack = (trackId: number) => gridData[trackId].slice(0, measureLength);
    return { id, name, length: measureLength, tracks: { 1: drumTrack(1), 2: drumTrack(2), 3: drumTrack(3) } };
  });

// Imported from indiebubbler/metro: kick on 1-2-3, snare on 4, hi-hat on every beat
function speedTrainer(id: string, name: string, startBpm: number, targetBpm: number, increment: number, bars: number): Preset {
  return {
    id,
    name,
    bpm: startBpm,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      1: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      3: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    },
    trainerSettings: { enabled: true, startBpm, targetBpm, increment, stepType: 'measures', stepValue: bars, curve: 'stepped' }
  };
}

export const SPEED_TRAINER_PRESETS: Preset[] = [
  speedTrainer('trainer_69_110', '69 - 110 - 4/4', 67, 110, 2, 1),
  speedTrainer('trainer_110_135', '110-135 - 4/4', 110, 135, 1, 1),
  speedTrainer('trainer_134_180', '134-180- 4/4', 134, 181, 1, 2),
  speedTrainer('trainer_179_220', '179-220 - 4/4', 179, 220, 1, 2),
  speedTrainer('trainer_calvagada_148_190', 'Calvagada - 148 - 190', 148, 190, 2, 3),
  speedTrainer('trainer_calvagada_189_215', 'Calvagada - 189 - 215', 189, 213, 1, 4),
  speedTrainer('trainer_134_162', '134-162 -4/4', 134, 162, 1, 3),
  speedTrainer('trainer_180_195', '180 to 195', 180, 195, 1, 4),
  speedTrainer('trainer_130_140', '130 to 140', 130, 140, 1, 4),
  speedTrainer('trainer_ligados', 'Ligados', 70, 167, 2, 1),
  {
    // The Trooper's gallop (eighth + two sixteenths), 20 BPM around its ~160 BPM tempo
    ...speedTrainer('trainer_gallop', 'Gallop', 140, 180, 1, 2),
    gridData: {
      0: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      1: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
      2: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      3: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    },
  },
];
