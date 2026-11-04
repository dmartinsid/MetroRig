import type { CustomGroove, PracticeLog, Preset } from '../domain/preset';

// What survives a reload in IndexedDB `metrorig_db` v2: user presets, practice logs and user grooves
export interface Database {
  savePreset(preset: Preset): Promise<void>;
  getAllPresets(): Promise<Preset[]>;
  logPracticeSession(log: PracticeLog): Promise<void>;
  getPracticeLogs(): Promise<PracticeLog[]>;
  saveGroove(groove: CustomGroove): Promise<void>;
  getAllGrooves(): Promise<CustomGroove[]>;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve({} as IDBDatabase);
      return;
    }
    const request = indexedDB.open('metrorig_db', 2);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('presets')) {
        db.createObjectStore('presets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('practice_logs')) {
        db.createObjectStore('practice_logs', { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('grooves')) {
        db.createObjectStore('grooves', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Without IndexedDB nothing is stored and every list is empty
export function openDatabase(): Database {
  const dbPromise = open();

  const write = async (storeName: string, write: (store: IDBObjectStore) => IDBRequest): Promise<void> => {
    const db = await dbPromise;
    if (!db.transaction) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = write(store);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  const readAll = async <T>(storeName: string): Promise<T[]> => {
    const db = await dbPromise;
    if (!db.transaction) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  return {
    savePreset: preset => write('presets', store => store.put(preset)),
    getAllPresets: () => readAll<Preset>('presets'),
    logPracticeSession: log => write('practice_logs', store => store.add(log)),
    getPracticeLogs: () => readAll<PracticeLog>('practice_logs'),
    saveGroove: groove => write('grooves', store => store.put(groove)),
    getAllGrooves: () => readAll<CustomGroove>('grooves'),
  };
}
