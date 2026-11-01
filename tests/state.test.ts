import { afterEach, describe, it, expect, beforeEach } from 'vitest';
import { StateManager, FACTORY_PRESETS, FACTORY_GROOVES, SPEED_TRAINER_PRESETS, FIGURES, getBeatsPerMeasure, getBeatForStep, isSustainedStep, applyFigure, measureLengthFor, normalizePreset, completeKit, startBpmFor } from '../src/state';
import type { Preset } from '../src/state';

describe('StateManager Tests', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  it('should initialize with default state settings', () => {
    expect(stateManager.activeViewMode).toBe('editor');
    expect(stateManager.isPlaying).toBe(false);
    expect(stateManager.activePreset.bpm).toBe(120);
  });

  it('should switch view mode and execute subscribers', () => {
    let callCount = 0;
    stateManager.subscribe(() => {
      callCount++;
    });
    stateManager.setViewMode('stadium');
    expect(stateManager.activeViewMode).toBe('stadium');
    expect(callCount).toBe(2); // Initial trigger + update trigger
  });
});

describe('Factory Presets Tests', () => {
  it('should contain default presets with measure lengths', () => {
    expect(FACTORY_PRESETS.length).toBeGreaterThan(0);
    const default44 = FACTORY_PRESETS.find(p => p.id === 'default');
    expect(default44).toBeDefined();
    expect(default44?.measureLength).toBe(16);
    
    const preset34 = FACTORY_PRESETS.find(p => p.id === '3_4');
    expect(preset34).toBeDefined();
    expect(preset34?.measureLength).toBe(12);
  });
});

describe('Beat counter helpers', () => {
  it('should read beats per measure from the time signature', () => {
    expect(getBeatsPerMeasure('4/4', 16)).toBe(4);
    expect(getBeatsPerMeasure('7/8', 14)).toBe(7);
  });

  it('should fall back to the measure length without a time signature', () => {
    expect(getBeatsPerMeasure('', 16)).toBe(4);
  });

  it('should map steps to beats', () => {
    expect([0, 3, 4, 8, 15].map(step => getBeatForStep(step, 16, 4))).toEqual([0, 0, 1, 2, 3]);
    expect([0, 1, 2, 13].map(step => getBeatForStep(step, 14, 7))).toEqual([0, 0, 1, 6]);
  });
});

describe('Speed Trainer Presets', () => {
  it('should have unique ids and rising trainer ranges', () => {
    expect(SPEED_TRAINER_PRESETS.length).toBe(11);
    expect(new Set(SPEED_TRAINER_PRESETS.map(p => p.id)).size).toBe(11);
    SPEED_TRAINER_PRESETS.forEach(p => {
      expect(p.trainerSettings.enabled).toBe(true);
      expect(p.bpm).toBe(p.trainerSettings.startBpm);
      expect(p.trainerSettings.targetBpm).toBeGreaterThan(p.bpm);
    });
  });

  it('should gallop on every beat in the Gallop preset', () => {
    const gallop = SPEED_TRAINER_PRESETS.find(p => p.id === 'trainer_gallop');
    expect(gallop?.bpm).toBe(140);
    expect(gallop?.trainerSettings.targetBpm).toBe(180);
    expect(gallop?.gridData[1].slice(0, 4)).toEqual([1, 0, 1, 1]);
    expect(gallop?.gridData[1].slice(12, 16)).toEqual([1, 0, 1, 1]);
  });

  it('should not share ids with factory presets', () => {
    const factoryIds = FACTORY_PRESETS.map(p => p.id);
    SPEED_TRAINER_PRESETS.forEach(p => expect(factoryIds).not.toContain(p.id));
  });
});

describe('Rhythmic figures', () => {
  const gallop = FIGURES.find(f => f.id === 'gallop')!.pattern;

  it('should stamp a figure over the quarter note containing the step', () => {
    const steps = new Array(16).fill(0);
    applyFigure(steps, 6, gallop, 16);
    expect(steps).toEqual([0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('should clip a figure at the end of the measure', () => {
    const steps = new Array(14).fill(0);
    applyFigure(steps, 13, gallop, 14);
    expect(steps.length).toBe(14);
    expect(steps.slice(12)).toEqual([1, 0]);
  });

  it('should sustain the eighth of a gallop but not a lone quarter', () => {
    const steps = [1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(isSustainedStep(steps, 1, 16, 4)).toBe(true);
    expect(isSustainedStep(steps, 5, 16, 4)).toBe(false);
    expect(isSustainedStep(steps, 2, 16, 4)).toBe(false);
  });
});

const hitsOf = (steps: number[]) => steps.flatMap((value, step) => (value > 0 ? [step] : []));

describe('Meter rules', () => {
  it('bpm_02 steps per note value', () => {
    expect(measureLengthFor(4, 4)).toBe(16);
    expect(measureLengthFor(3, 4)).toBe(12);
    expect(measureLengthFor(6, 8)).toBe(12);
    expect(measureLengthFor(12, 8)).toBe(24);
    expect(measureLengthFor(7, 8)).toBe(14);
    expect(measureLengthFor(16, 16)).toBe(16);
    expect(measureLengthFor(5, 16)).toBe(5);
  });

  it('bpm_03 blues shuffle preset', () => {
    const blues = FACTORY_PRESETS.find(p => p.id === 'blues')!;
    expect(blues.timeSignature).toBe('12/8');
    expect(blues.measureLength).toBe(24);
    expect(blues.bpm).toBe(135);
    [0, 1, 2, 3].forEach(track => expect(blues.gridData[track]).toHaveLength(24));
    expect(hitsOf(blues.gridData[0])).toEqual([0, 6, 12, 18]);
    expect(blues.gridData[0][0]).toBe(2);
    expect(hitsOf(blues.gridData[1])).toEqual([0, 12]);
    expect(hitsOf(blues.gridData[2])).toEqual([6, 18]);
    expect(hitsOf(blues.gridData[3])).toEqual([0, 4, 6, 10, 12, 16, 18, 22]);
    // Four steps per quarter and a click every 6 steps
    expect((blues.bpm * 4) / 6).toBe(90);
  });

  it('bpm_04 jazz swing preset', () => {
    const jazz = FACTORY_PRESETS.find(p => p.id === 'jazz')!;
    expect(jazz.timeSignature).toBe('12/8');
    expect(jazz.measureLength).toBe(24);
    expect(jazz.bpm).toBe(195);
    [0, 1, 2, 3].forEach(track => expect(jazz.gridData[track]).toHaveLength(24));
    expect(hitsOf(jazz.gridData[0])).toEqual([0, 6, 12, 18]);
    expect(jazz.gridData[0][0]).toBe(2);
    expect(hitsOf(jazz.gridData[1])).toEqual([0, 12]);
    expect(hitsOf(jazz.gridData[2])).toEqual([10]);
    expect(hitsOf(jazz.gridData[3])).toEqual([0, 4, 6, 10, 12, 16, 18, 22]);
    expect((jazz.bpm * 4) / 6).toBe(130);
  });

  it('bpm_05 factory grooves hold 24 steps', () => {
    const blues = FACTORY_GROOVES.find(g => g.id === 'blues')!;
    const jazz = FACTORY_GROOVES.find(g => g.id === 'jazz')!;

    [blues, jazz].forEach(groove => {
      expect(groove.length).toBe(24);
      [1, 2, 3].forEach(track => expect(groove.tracks[track]).toHaveLength(24));
      expect(hitsOf(groove.tracks[1])).toEqual([0, 12]);
      expect(hitsOf(groove.tracks[3])).toEqual([0, 4, 6, 10, 12, 16, 18, 22]);
    });
    expect(hitsOf(blues.tracks[2])).toEqual([6, 18]);
    expect(hitsOf(jazz.tracks[2])).toEqual([10]);
  });
});

describe('Preset normalization', () => {
  const stored = (bars: number | undefined, length: number) => ({
    ...FACTORY_PRESETS[0],
    timeSignature: '4/4',
    measureLength: 16,
    bars,
    gridData: { 1: Array.from({ length }, (_, step) => (step % 4 === 0 ? 1 : 0)) },
  });

  it('bars_08 no bar count is one bar', () => {
    const preset = normalizePreset(stored(undefined, 16));
    expect(preset.bars ?? 1).toBe(1);
    expect(preset.gridData[1]).toEqual(stored(undefined, 16).gridData[1]);
  });

  it('keeps 4 bars that fit their steps', () => {
    const preset = normalizePreset(stored(4, 64));
    expect(preset.bars).toBe(4);
    expect(preset.gridData[1]).toHaveLength(64);
  });

  it('expands every bar of a legacy 12/8 pattern', () => {
    const preset = normalizePreset({
      ...stored(4, 48), timeSignature: '12/8', measureLength: 12, gridData: { 1: Array.from({ length: 48 }, (_, step) => (step === 47 ? 2 : 0)) },
    });
    expect(preset.bars).toBe(4);
    expect(preset.measureLength).toBe(24);
    expect(preset.gridData[1]).toHaveLength(96);
    expect(preset.gridData[1][94]).toBe(2);
  });

  it('edge_03 bars that do not fit', () => {
    for (const [bars, length] of [[4, 60], [3, 64], [0, 64], [2.5, 40], [2, 32], [5, 80], [8, 128]]) {
      const preset = normalizePreset(stored(bars, length));
      expect(preset.bars).toBe(1);
      expect(preset.gridData[1]).toEqual(stored(bars, length).gridData[1].slice(0, 16));
    }
  });

  const trainerSettings: Preset['trainerSettings'] = { enabled: false, startBpm: 100, targetBpm: 150, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' };
  const legacy12_8 = () => ({
    id: 'user_1',
    name: 'Old shuffle',
    bpm: 90,
    timeSignature: '12/8',
    measureLength: 12,
    gridData: {
      0: [2, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      1: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1],
      2: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      3: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    trainerSettings: { ...trainerSettings },
  });

  it('bpm_06 expands legacy steps', () => {
    const stored = legacy12_8();
    const original = structuredClone(stored);

    const preset = normalizePreset(stored);

    expect(preset.measureLength).toBe(24);
    expect(preset.gridData[0]).toEqual([2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
    expect(preset.gridData[1]).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
    expect(preset.gridData[2]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(preset.gridData[3]).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(stored).toEqual(original);
  });

  it('bpm_07 rounds expanded bpm', () => {
    expect(normalizePreset({ ...legacy12_8(), bpm: 90 }).bpm).toBe(135);
    expect(normalizePreset({ ...legacy12_8(), bpm: 101 }).bpm).toBe(152);
    expect(normalizePreset({ ...legacy12_8(), bpm: 100 }).bpm).toBe(150);
    expect(normalizePreset({ ...legacy12_8(), bpm: 90 }).trainerSettings).toEqual(trainerSettings);
  });

  it('bpm_08 caps expanded bpm', () => {
    expect(normalizePreset({ ...legacy12_8(), bpm: 160 }).bpm).toBe(240);
    expect(normalizePreset({ ...legacy12_8(), bpm: 200 }).bpm).toBe(240);
  });

  it('drops a stored swing value without changing the record', () => {
    const stored = { ...FACTORY_PRESETS[0], swing: 50 };

    const preset = normalizePreset(stored);

    expect(preset).not.toHaveProperty('swing');
    expect(preset).toEqual(FACTORY_PRESETS[0]);
    expect(stored.swing).toBe(50);
    expect(preset.gridData[0]).not.toBe(stored.gridData[0]);
  });

  it('leaves presets outside legacy 12/8 unchanged', () => {
    const sixEight = { ...legacy12_8(), timeSignature: '6/8' };
    expect(normalizePreset(sixEight)).toEqual(sixEight);

    const corrected = FACTORY_PRESETS.find(p => p.id === 'blues')!;
    expect(normalizePreset(corrected)).toEqual(corrected);
  });

  it('starts at Start BPM when the Trainer is enabled', () => {
    const preset = { ...legacy12_8(), bpm: 120, trainerSettings: { ...trainerSettings, enabled: true, startBpm: 80 } };
    expect(startBpmFor(preset)).toBe(80);
  });

  it('starts at the preset BPM when the Trainer is disabled', () => {
    const preset = { ...legacy12_8(), bpm: 120, trainerSettings: { ...trainerSettings, enabled: false, startBpm: 80 } };
    expect(startBpmFor(preset)).toBe(120);
  });
});

describe('Factory grooves', () => {
  it('edit_23 five named grooves', () => {
    expect(FACTORY_GROOVES.map(groove => groove.name)).toEqual([
      'Rock Groove', 'Metal Groove', 'Blues Shuffle', 'Jazz Swing', 'Metalcore Breakdown',
    ]);

    const metalcore = FACTORY_GROOVES.find(groove => groove.id === 'metalcore')!;
    expect(metalcore.length).toBe(16);
    expect(metalcore.tracks[1]).toEqual([1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0]);
    expect(metalcore.tracks[2]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect(metalcore.tracks[3]).toEqual([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]);
  });
});

describe('completeKit', () => {
  it('fills a missing track to the whole pattern', () => {
    const preset = { ...FACTORY_PRESETS[0], measureLength: 16, bars: 4, gridData: { 1: new Array(64).fill(1) } };
    expect(completeKit(preset).gridData[10]).toEqual(new Array(64).fill(0));
  });

  const trainerSettings: Preset['trainerSettings'] = { enabled: false, startBpm: 100, targetBpm: 150, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' };
  const stored = (gridData: Record<number, number[]>): Preset => ({
    id: 'user_1', name: 'Saved', bpm: 100, timeSignature: '3/4', measureLength: 12, gridData, trainerSettings,
  });

  it('edt_06 fills missing tracks', () => {
    const kick = [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0];
    const preset = completeKit(stored({ 0: new Array(12).fill(0), 1: kick, 2: new Array(12).fill(0), 3: new Array(12).fill(0) }));

    expect(Object.keys(preset.gridData)).toHaveLength(11);
    expect(preset.gridData[1]).toEqual(kick);
    for (let trackId = 4; trackId <= 10; trackId++) {
      expect(preset.gridData[trackId]).toEqual(new Array(12).fill(0));
    }
  });

  it('edge_03 cleans step values', () => {
    const preset = completeKit(stored({ 1: [0, 1, 2, 3, 4, 255, -1, 1.5] }));
    expect(preset.gridData[1]).toEqual([0, 1, 2, 3, 1, 1, 1, 1]);
  });

  it('fills the tracks of every factory preset', () => {
    [...FACTORY_PRESETS, ...SPEED_TRAINER_PRESETS].forEach(factory => {
      expect(completeKit(factory).gridData[10]).toHaveLength(factory.measureLength);
    });
  });
});

describe('StateManager', () => {
  afterEach(() => localStorage.removeItem('metrorig_view_mode'));

  it('nav_07 grooves mode persists', () => {
    new StateManager().setViewMode('grooves');
    expect(new StateManager().activeViewMode).toBe('grooves');
  });

  it('opens the Editor for an unknown stored mode', () => {
    localStorage.setItem('metrorig_view_mode', 'presets');
    expect(new StateManager().activeViewMode).toBe('editor');
  });
});
