import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager, FACTORY_PRESETS } from '../src/state';

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
