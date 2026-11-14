// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Session } from '../src/app/session';
import { StateManager } from '../src/app/stateManager';
import { keepAwake } from '../src/app/keepAwake';
import type { EnginePort, ScreenLock } from '../src/app/ports';
import type { Database } from '../src/storage/database';
import type { PreferenceKey, PreferenceStore } from '../src/storage/preferences';
import type { CustomGroove, PracticeLog, Preset } from '../src/domain/preset';

// --- Fakes: an engine that records the methods called on it, storage in memory, a wake lock and a page ---

function fakeEngine() {
  const calls: string[] = [];
  const events = new EventTarget();
  const engine = new Proxy({} as EnginePort, {
    get: (_, method) => {
      if (method === 'then') return undefined; // Not a promise
      if (method === 'addEventListener') return events.addEventListener.bind(events);
      if (method === 'sampleRate') return () => 44100;
      if (method === 'visualDelayMs') return () => 0;
      return () => {
        calls.push(String(method));
        return Promise.resolve();
      };
    },
  });
  return { engine, calls };
}

class MemoryDatabase implements Database {
  async savePreset(_: Preset) {}
  async getAllPresets() { return []; }
  async logPracticeSession(_: PracticeLog) {}
  async getPracticeLogs() { return []; }
  async saveGroove(_: CustomGroove) {}
  async getAllGrooves() { return []; }
}

class MemoryPreferences implements PreferenceStore {
  values = new Map<PreferenceKey, string>();
  get(key: PreferenceKey) { return this.values.get(key) ?? null; }
  set(key: PreferenceKey, value: string) { this.values.set(key, value); }
}

// A wake lock that counts what it grants and what the app gives back; `refuse` rejects every request, as a browser on low battery does
function stubLock({ refuse = false } = {}) {
  const active = new Set<object>();
  const lock = {
    requests: 0,
    releases: 0,
    get held() { return active.size; },
    request() {
      lock.requests++;
      if (refuse) return Promise.reject(new DOMException('Wake lock refused', 'NotAllowedError'));
      const sentinel = {
        release() {
          if (active.delete(sentinel)) lock.releases++;
          return Promise.resolve();
        },
      };
      active.add(sentinel);
      return Promise.resolve(sentinel);
    },
    // What the browser does to every lock when the page is hidden
    drop() { active.clear(); },
  };
  return lock;
}

// A page the test hides and shows, as a phone does when the user switches apps
function stubPage() {
  const listeners: (() => void)[] = [];
  const page = {
    shown: true,
    visible: () => page.shown,
    onVisible: (listener: () => void) => { listeners.push(listener); },
    hide() { page.shown = false; },
    show() {
      page.shown = true;
      listeners.forEach(listener => listener());
    },
  };
  return page;
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise(process.nextTick);
};

const cMajor = { root: 0, type: 0 };

function setup(lock: ScreenLock | null) {
  const { engine, calls } = fakeEngine();
  const prefs = new MemoryPreferences();
  const session = new Session({
    engine,
    state: new StateManager(new MemoryDatabase(), prefs),
    prefs,
    dialogs: { confirm: () => true },
    wasmUrl: '/engine.wasm',
    workletUrl: '/worklet.js',
  });
  const page = stubPage();
  keepAwake(session, lock, page);
  return { session, calls, page };
}

describe('Mobile App', () => {
  it('mob_32 sound requests a wake lock', async () => {
    const lock = stubLock();
    const { session } = setup(lock);
    await flush();
    expect(lock.requests).toBe(0);
    session.togglePlay();
    await flush();
    expect(session.isPlaying).toBe(true);
    expect([lock.requests, lock.held]).toEqual([1, 1]);

    // A chord pad with the metronome stopped
    const padLock = stubLock();
    const pad = setup(padLock);
    await pad.session.pressChord(cMajor);
    await flush();
    expect(pad.session.isPlaying).toBe(false);
    expect(pad.session.improv.soundingChord).toEqual(cMajor);
    expect([padLock.requests, padLock.held]).toEqual([1, 1]);
  });

  it('mob_33 silence releases the wake lock', async () => {
    const lock = stubLock();
    const { session } = setup(lock);
    session.togglePlay();
    await flush();
    session.togglePlay();
    await flush();
    expect(session.isPlaying).toBe(false);
    expect([lock.requests, lock.releases, lock.held]).toEqual([1, 1, 0]);

    // Playback stops while a pad sounds: the lock stays until the pad stops too
    session.togglePlay();
    await flush();
    await session.pressChord(cMajor);
    await flush();
    expect(lock.requests).toBe(2);
    session.togglePlay();
    await flush();
    expect([session.isPlaying, lock.held]).toEqual([false, 1]);
    session.stopChord();
    await flush();
    expect([lock.held, lock.releases]).toEqual([0, 2]);

    // The pad stops while playback runs: still held until playback stops
    await session.pressChord(cMajor);
    session.togglePlay();
    await flush();
    session.stopChord();
    await flush();
    expect([session.isPlaying, lock.held]).toEqual([true, 1]);
    session.togglePlay();
    await flush();
    expect(lock.held).toBe(0);
    // Never two at once
    expect(lock.requests).toBe(3);
  });

  it('mob_34 visible again requests the lock', async () => {
    const lock = stubLock();
    const { session, page } = setup(lock);
    session.togglePlay();
    await flush();
    expect(lock.requests).toBe(1);
    // The browser drops the lock while the page is hidden; back on screen it is asked for again
    page.hide();
    lock.drop();
    expect(lock.held).toBe(0);
    page.show();
    await flush();
    expect([lock.requests, lock.held]).toEqual([2, 1]);
    session.togglePlay();
    await flush();
    expect(lock.held).toBe(0);
    // Silent: coming back asks for nothing
    page.hide();
    lock.drop();
    page.show();
    await flush();
    expect([lock.requests, lock.held]).toEqual([2, 0]);
  });

  it('mob_35 missing or refused wake lock plays on', async () => {
    // No Wake Lock API
    const none = setup(null);
    expect(() => none.session.togglePlay()).not.toThrow();
    await flush();
    expect(none.session.isPlaying).toBe(true);
    expect(none.calls).toContain('start');
    await none.session.pressChord(cMajor);
    none.session.togglePlay();
    none.session.stopChord();
    await flush();
    expect(none.calls).toContain('stop');

    // The browser refuses: no rejection escapes, and playback runs on
    const refused = stubLock({ refuse: true });
    const { session, calls, page } = setup(refused);
    session.togglePlay();
    await flush();
    expect(refused.requests).toBe(1);
    expect(session.isPlaying).toBe(true);
    expect(calls).toContain('start');
    page.hide();
    page.show();
    await flush();
    session.togglePlay();
    await flush();
    expect(session.isPlaying).toBe(false);
    expect(calls).toContain('stop');
  });
});
