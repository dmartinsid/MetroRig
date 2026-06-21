import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../src/state';

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
