export interface Preset {
  id: string;
  name: string;
  bpm: number;
  timeSignature: string;
  gridData: Record<number, number[]>; // trackId -> 16 steps
  trainerSettings: {
    enabled: boolean;
    startBpm: number;
    targetBpm: number;
    increment: number;
    stepType: 'measures' | 'seconds';
    stepValue: number;
    curve: 'stepped' | 'smooth';
  };
}

export interface PracticeLog {
  id?: number;
  date: string;
  durationSeconds: number;
  startBpm: number;
  maxBpm: number;
}

export class StateManager {
  private dbPromise: Promise<IDBDatabase>;
  private subscribers: Set<(state: any) => void> = new Set();
  
  public activePreset: Preset = {
    id: 'default',
    name: 'Default Beat',
    bpm: 120,
    timeSignature: '4/4',
    gridData: {
      0: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // Clicks
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

  public activeViewMode: 'editor' | 'stadium' = 'editor';
  public isPlaying: boolean = false;
  public currentLiveBpm: number = 120;

  constructor() {
    this.dbPromise = this.initDB();
    this.loadActiveViewMode();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve({} as IDBDatabase);
        return;
      }
      const request = indexedDB.open('metrorig_db', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('presets')) {
          db.createObjectStore('presets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('practice_logs')) {
          db.createObjectStore('practice_logs', { autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private loadActiveViewMode() {
    const mode = localStorage.getItem('metrorig_view_mode');
    if (mode === 'stadium' || mode === 'editor') {
      this.activeViewMode = mode;
    }
  }

  setViewMode(mode: 'editor' | 'stadium') {
    this.activeViewMode = mode;
    localStorage.setItem('metrorig_view_mode', mode);
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
    const db = await this.dbPromise;
    if (!db.transaction) {
      this.activePreset = preset;
      this.notify();
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('presets', 'readwrite');
      const store = transaction.objectStore('presets');
      const request = store.put(preset);
      request.onsuccess = () => {
        this.activePreset = preset;
        this.notify();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPresets(): Promise<Preset[]> {
    const db = await this.dbPromise;
    if (!db.transaction) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('presets', 'readonly');
      const store = transaction.objectStore('presets');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async logPracticeSession(log: PracticeLog): Promise<void> {
    const db = await this.dbPromise;
    if (!db.transaction) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('practice_logs', 'readwrite');
      const store = transaction.objectStore('practice_logs');
      const request = store.add(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPracticeLogs(): Promise<PracticeLog[]> {
    const db = await this.dbPromise;
    if (!db.transaction) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('practice_logs', 'readonly');
      const store = transaction.objectStore('practice_logs');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
