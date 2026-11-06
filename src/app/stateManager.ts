import type { CustomGroove, Preset, ViewMode } from '../domain/preset';
import { FACTORY_PRESETS } from '../data/factory';
import { openDatabase, type Database } from '../storage/database';
import { browserPreferences, type PreferenceStore } from '../storage/preferences';

export class StateManager {
  private subscribers: Set<(state: any) => void> = new Set();
  
  // A copy of the factory 4/4 Metronome, so edits never reach the factory list
  public activePreset: Preset = structuredClone(FACTORY_PRESETS[0]);

  public activeViewMode: ViewMode = 'editor';
  public isPlaying: boolean = false;

  constructor(private database: Database = openDatabase(), private prefs: PreferenceStore = browserPreferences) {
    this.loadActiveViewMode();
  }

  private loadActiveViewMode() {
    const mode = this.prefs.get('viewMode');
    if (mode === 'stadium' || mode === 'editor' || mode === 'grooves' || mode === 'improv') {
      this.activeViewMode = mode;
    }
  }

  setViewMode(mode: ViewMode) {
    this.activeViewMode = mode;
    this.prefs.set('viewMode', mode);
    this.notify();
  }

  subscribe(callback: (state: any) => void) {
    this.subscribers.add(callback);
    callback(this);
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach((cb) => cb(this));
  }

  async savePreset(preset: Preset): Promise<void> {
    await this.database.savePreset(preset);
    this.activePreset = preset;
    this.notify();
  }

  getAllPresets(): Promise<Preset[]> {
    return this.database.getAllPresets();
  }

  saveGroove(groove: CustomGroove): Promise<void> {
    return this.database.saveGroove(groove);
  }

  getAllGrooves(): Promise<CustomGroove[]> {
    return this.database.getAllGrooves();
  }
}
