import type { CustomGroove, PracticeLog, Preset, ViewMode } from '../domain/preset';
import { openDatabase, type Database } from '../storage/database';
import { browserPreferences, type PreferenceStore } from '../storage/preferences';

export class StateManager {
  private subscribers: Set<(state: any) => void> = new Set();
  
  public activePreset: Preset = {
    id: 'default',
    name: '4/4 Metronome',
    bpm: 120,
    timeSignature: '4/4',
    measureLength: 16,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // Clicks
      1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Kick
      2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Snare
      3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Hihat
    },
    trainerSettings: {
      enabled: false,
      startBpm: 120,
      targetBpm: 160,
      increment: 5,
      stepType: 'measures',
      stepValue: 4,
      curve: 'stepped',
    }
  };

  public activeViewMode: ViewMode = 'editor';
  public isPlaying: boolean = false;
  public currentLiveBpm: number = 120;

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

  logPracticeSession(log: PracticeLog): Promise<void> {
    return this.database.logPracticeSession(log);
  }

  getPracticeLogs(): Promise<PracticeLog[]> {
    return this.database.getPracticeLogs();
  }

  saveGroove(groove: CustomGroove): Promise<void> {
    return this.database.saveGroove(groove);
  }

  getAllGrooves(): Promise<CustomGroove[]> {
    return this.database.getAllGrooves();
  }
}
