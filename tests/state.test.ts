import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager, FACTORY_PRESETS, SPEED_TRAINER_PRESETS, FIGURES, getBeatsPerMeasure, getBeatForStep, isSustainedStep, applyFigure } from '../src/state';

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
