// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Session, trainerStatusText } from '../../src/app/session';
import { StateManager } from '../../src/app/stateManager';
import type { EnginePort } from '../../src/app/ports';
import type { Database } from '../../src/storage/database';
import type { PreferenceKey, PreferenceStore } from '../../src/storage/preferences';
import type { CustomGroove, PracticeLog, Preset, TrainerSettings } from '../../src/domain/preset';
import { FACTORY_PRESETS } from '../../src/data/factory';
import { SONGS, songToPreset } from '../../src/domain/songs';
import { TRACKS } from '../../src/domain/kit';
import { DEFAULT_TIMBRE, PAD_TIMBRES, timbreNotes } from '../../src/domain/chords';

// --- Fakes: the engine records every call, the storage lives in memory ---

type Call = { method: string; args: any[] };

class FakeEngine extends EventTarget implements EnginePort {
  calls: Call[] = [];
  private record = (method: string, args: any[]) => { this.calls.push({ method, args }); };
  init(wasmUrl: string, workletUrl: string) { this.record('init', [wasmUrl, workletUrl]); return Promise.resolve(); }
  resumeContext() { this.record('resumeContext', []); return Promise.resolve(); }
  start() { this.record('start', []); }
  stop() { this.record('stop', []); }
  setBpm(bpm: number) { this.record('setBpm', [bpm]); }
  setMeasureLength(length: number) { this.record('setMeasureLength', [length]); }
  setBars(bars: number) { this.record('setBars', [bars]); }
  restartPattern() { this.record('restartPattern', []); }
  updateGrid(trackId: number, steps: Uint8Array) { this.record('updateGrid', [trackId, [...steps]]); }
  setTrainer(settings: TrainerSettings) { this.record('setTrainer', [settings]); }
  replaceTrainer(settings: TrainerSettings) { this.record('replaceTrainer', [settings]); }
  loadSample(sampleId: number, url: string) { this.record('loadSample', [sampleId, url]); return Promise.resolve(); }
  loadTake(trackId: number, dynamic: number, take: number, url: string, trim: number) {
    this.record('loadTake', [trackId, dynamic, take, url, trim]);
    return Promise.resolve();
  }
  setClickMode(mode: number) { this.record('setClickMode', [mode]); }
  padPlay(notes: number[], timbre: number) { this.record('padPlay', [notes, timbre]); }
  padStop() { this.record('padStop', []); }
  padVolume(volume: number) { this.record('padVolume', [volume]); }
  padLoadBegin(timbre: number) { this.record('padLoadBegin', [timbre]); }
  padLoadEnd(timbre: number) { this.record('padLoadEnd', [timbre]); }
  padLoad(timbre: number, key: number, url: string, loopStart: number, loopEnd: number) {
    this.record('padLoad', [timbre, key, url, loopStart, loopEnd]);
    return Promise.resolve();
  }
  sampleRate() { return 44100; }
  visualDelayMs() { return 0; }

  sent(method: string) {
    return this.calls.filter(call => call.method === method).map(call => call.args);
  }
  methods() {
    return this.calls.map(call => call.method);
  }
}

class MemoryDatabase implements Database {
  presets = new Map<string, Preset>();
  grooves = new Map<string, CustomGroove>();
  logs: PracticeLog[] = [];
  async savePreset(preset: Preset) { this.presets.set(preset.id, structuredClone(preset)); }
  async getAllPresets() { return [...this.presets.values()].map(preset => structuredClone(preset)); }
  async logPracticeSession(log: PracticeLog) { this.logs.push(log); }
  async getPracticeLogs() { return [...this.logs]; }
  async saveGroove(groove: CustomGroove) { this.grooves.set(groove.id, structuredClone(groove)); }
  async getAllGrooves() { return [...this.grooves.values()]; }
}

class MemoryPreferences implements PreferenceStore {
  values = new Map<PreferenceKey, string>();
  get(key: PreferenceKey) { return this.values.get(key) ?? null; }
  set(key: PreferenceKey, value: string) { this.values.set(key, value); }
}

function setup({ confirm = true }: { confirm?: boolean } = {}) {
  const engine = new FakeEngine();
  const database = new MemoryDatabase();
  const prefs = new MemoryPreferences();
  const questions: string[] = [];
  const session = new Session({
    engine,
    state: new StateManager(database, prefs),
    prefs,
    dialogs: { confirm: message => { questions.push(message); return confirm; } },
    wasmUrl: '/engine.wasm',
    workletUrl: '/worklet.js',
  });
  return { session, engine, database, prefs, questions };
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise(process.nextTick);
};

// Play and stop once, so the engine is running and holds the kit
async function startedEngine(options?: { confirm?: boolean }) {
  const fixture = setup(options);
  fixture.session.togglePlay();
  await flush();
  fixture.session.togglePlay();
  await flush();
  fixture.engine.calls.length = 0;
  return fixture;
}

const trainer: TrainerSettings = {
  enabled: true, startBpm: 90, targetBpm: 140, increment: 4, stepType: 'seconds', stepValue: 30, curve: 'smooth',
};

describe('Session', () => {
  it('plays and stops', async () => {
    const { session, engine } = setup();

    session.togglePlay();
    await flush();
    expect(session.isPlaying).toBe(true);
    expect(engine.sent('init')).toEqual([['/engine.wasm', '/worklet.js']]);
    // The default 4/4 preset's tempo, sent before the start
    expect(engine.sent('setBpm').length).toBeGreaterThan(0);
    expect(engine.sent('setBpm').every(([bpm]) => bpm === 120)).toBe(true);
    expect(engine.sent('start')).toHaveLength(1);
    expect(engine.methods().lastIndexOf('setBpm')).toBeLessThan(engine.methods().indexOf('start'));
    expect(engine.sent('stop')).toEqual([]);

    session.togglePlay();
    await flush();
    expect(session.isPlaying).toBe(false);
    expect(engine.sent('stop')).toHaveLength(1);
    expect(engine.methods().at(-1)).toBe('stop');
    expect(engine.sent('start')).toHaveLength(1);
    expect(engine.sent('init')).toHaveLength(1); // The engine starts once
  });

  it('loads a preset', async () => {
    const { session, engine } = await startedEngine();
    const rock = FACTORY_PRESETS.find(preset => preset.id === 'rock')!;

    session.loadPreset('factory:rock');

    expect(session.preset.name).toBe('Rock Groove');
    expect(engine.sent('setBpm')).toEqual([[rock.bpm]]);
    expect(engine.sent('setMeasureLength')).toEqual([[16]]);
    expect(engine.sent('setBars')).toEqual([[1]]);
    expect(engine.sent('replaceTrainer')).toEqual([[rock.trainerSettings]]);
    const grids = new Map(engine.sent('updateGrid').map(([trackId, steps]) => [trackId, steps]));
    expect([...grids.keys()].sort((a, b) => a - b)).toEqual(TRACKS.map(track => track.id).sort((a, b) => a - b));
    expect(grids.get(1)).toEqual(rock.gridData[1]);
    expect(grids.get(2)).toEqual(rock.gridData[2]);
    expect(session.selectedPresetValue).toBe('factory:rock');
    expect(session.hasUnsavedEdits).toBe(false);
  });

  it('saves a preset', async () => {
    const { session, database } = setup();
    session.loadPreset('factory:rock');
    session.editStep(2, 2); // Snare on the second sixteenth
    const edited = structuredClone(session.preset.gridData);
    expect(session.hasUnsavedEdits).toBe(true);

    await session.savePreset('  My groove  ');

    const stored = [...database.presets.values()];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: 'My groove', bpm: 120, timeSignature: '4/4', measureLength: 16, bars: 1 });
    expect(stored[0].gridData).toEqual(edited);
    expect(stored[0].id).toMatch(/^user_/);
    // The copy is now the active preset, and edits to it leave the stored one alone
    expect(session.preset.id).toBe(stored[0].id);
    expect(session.selectedPresetValue).toBe(`user:${stored[0].id}`);
    expect(session.hasUnsavedEdits).toBe(false);
    session.editStep(1, 1);
    expect(database.presets.get(stored[0].id)!.gridData).toEqual(edited);
  });

  it('loads a song', async () => {
    const { session, engine } = await startedEngine();
    const song = SONGS[0];
    const expected = songToPreset(song);

    expect(session.useSong(song)).toBe(true);

    expect(session.preset.bpm).toBe(song.bpm);
    expect(session.preset.timeSignature).toBe(song.timeSignature);
    expect(session.preset.measureLength).toBe(song.measureLength);
    expect(session.preset.gridData).toEqual(expected.gridData);
    expect(engine.sent('setBpm')).toEqual([[song.bpm]]);
    expect(engine.sent('setMeasureLength')).toEqual([[song.measureLength]]);
    // Every track of the song reaches the engine
    const grids = new Map(engine.sent('updateGrid').map(([trackId, steps]) => [trackId, steps]));
    expect([...grids.keys()].sort((a, b) => a - b)).toEqual(TRACKS.map(track => track.id).sort((a, b) => a - b));
    TRACKS.forEach(({ id }) => expect(grids.get(id), `track ${id}`).toEqual(expected.gridData[id]));
    expect(session.selectedPresetValue).toBe(`song:${song.id}`);
  });

  it('keeps unsaved edits when the user declines a song', async () => {
    const { session, questions } = await startedEngine({ confirm: false });
    session.setBpm(99);
    const song = SONGS[1];

    expect(session.useSong(song)).toBe(false);

    expect(questions).toEqual([`Discard your unsaved changes and load ${song.title}?`]);
    expect(session.preset.bpm).toBe(99);
    expect(session.preset.id).toBe('default');
  });

  it('edits a step', async () => {
    const { session, engine } = await startedEngine();

    session.editStep(1, 0);
    expect(session.preset.gridData[1][0]).toBe(1);
    expect(engine.sent('updateGrid').at(-1)).toEqual([1, [1, ...new Array(15).fill(0)]]);
    expect(session.hasUnsavedEdits).toBe(true);

    // A muted track plays silence; the preset keeps its steps
    session.toggleMute(1);
    session.editStep(1, 4);
    expect(session.preset.gridData[1].slice(0, 5)).toEqual([1, 0, 0, 0, 1]);
    expect(engine.sent('updateGrid').at(-1)).toEqual([1, new Array(16).fill(0)]);
  });

  it('sets the Trainer', async () => {
    const { session, engine } = setup();
    session.togglePlay();
    await flush();
    engine.calls.length = 0;

    session.setTrainer(trainer);

    expect(engine.sent('setTrainer')).toEqual([[trainer]]);
    expect(engine.sent('replaceTrainer')).toEqual([]);
    expect(engine.sent('setBpm')).toEqual([]); // The live tempo carries on
    expect(session.preset.trainerSettings).toEqual(trainer);
    expect(session.hasUnsavedEdits).toBe(true);
  });

  it('shows the Trainer fields as typed', () => {
    const { session } = setup();
    const typed = { enabled: true, startBpm: '080', targetBpm: '160', increment: '', stepType: 'measures', stepValue: '1.0' };

    session.setTrainerFields(typed);
    expect(trainerStatusText(session.trainerFields)).toBe('Trainer 080 → 160 BPM · + every 1.0 bars');

    // A loaded preset puts its own settings in the form
    session.loadPreset('factory:trainer_calvagada_148_190');
    expect(trainerStatusText(session.trainerFields)).toBe('Trainer 148 → 190 BPM · +2 every 3 bars');
    expect(trainerStatusText({ ...typed, stepValue: '1' })).toBe('Trainer 080 → 160 BPM · + every 1 bar');
    expect(trainerStatusText({ ...typed, stepType: 'seconds' })).toBe('Trainer 080 → 160 BPM · + every 1.0 s');
    expect(trainerStatusText({ ...typed, enabled: false })).toBe('Trainer Off');
  });

  it('presses a chord', async () => {
    const { session, engine } = setup();
    const cMajor = { root: 0, type: 0 };
    const sweep = PAD_TIMBRES.findIndex(({ name }) => name === 'Sweep');
    expect(sweep).not.toBe(DEFAULT_TIMBRE);
    session.setTimbre('Sweep');
    await flush();

    await session.pressChord(cMajor);

    expect(engine.sent('padPlay')).toEqual([[timbreNotes(0, 0, sweep), sweep]]);
    expect(session.improv.soundingChord).toEqual(cMajor);

    // The same chord again lets it go
    await session.pressChord(cMajor);
    expect(engine.sent('padStop')).toHaveLength(1);
    expect(session.improv.soundingChord).toBeNull();
  });

  it('changes the timbre', async () => {
    const { session, engine, prefs } = setup();
    const orchestra = PAD_TIMBRES.findIndex(({ name }) => name === 'Orchestra');
    const dMinor = { root: 2, type: 1 };
    await session.pressChord(dMinor);
    engine.calls.length = 0;

    session.setTimbre('Orchestra');
    await flush();

    expect(engine.sent('padPlay')).toEqual([[timbreNotes(2, 1, orchestra), orchestra]]);
    expect(engine.sent('padLoadBegin')).toEqual([[orchestra]]);
    expect(engine.sent('padLoad').map(([timbre, key, url]) => [timbre, key, url]))
      .toEqual(PAD_TIMBRES[orchestra].files.map(({ key, url }) => [orchestra, key, url]));
    expect(engine.sent('padLoadEnd')).toEqual([[orchestra]]);
    expect(prefs.get('padTimbre')).toBe('Orchestra');
    expect(session.improv.timbre).toBe('Orchestra');
  });

  it('changes the pad volume', async () => {
    const { session, engine, prefs } = setup();

    session.setPadVolume(40);

    expect(engine.sent('padVolume')).toEqual([[0.4]]);
    expect(prefs.get('padVolume')).toBe('40');
    expect(session.improv.padVolume).toBe(40);

    // The engine starts at the stored volume
    session.togglePlay();
    await flush();
    expect(engine.sent('padVolume').at(-1)).toEqual([0.4]);
  });

  it('sends every engine and storage call through the adapters it receives', async () => {
    // Without a DOM there is no localStorage or IndexedDB, so a call that went around the adapters would throw
    expect(typeof localStorage).toBe('undefined');
    expect(typeof indexedDB).toBe('undefined');
    const { session, engine, database, prefs } = setup();

    session.togglePlay();
    await flush();
    session.editStep(1, 0);
    session.setTrainer(trainer);
    await session.setClickSound('woodblock');
    session.setView('improv');
    await session.pressChord({ root: 0, type: 0 });
    session.setPadVolume(30);
    await session.savePreset('Kept');
    await session.saveGroove('Beat');
    await flush();

    expect(engine.methods()).toEqual(expect.arrayContaining([
      'init', 'loadSample', 'loadTake', 'setClickMode', 'setBpm', 'setMeasureLength', 'setBars', 'updateGrid',
      'replaceTrainer', 'start', 'setTrainer', 'padPlay', 'padVolume', 'padLoadBegin', 'padLoad', 'padLoadEnd',
    ]));
    expect(engine.sent('loadSample')).toContainEqual([0, '/woodblock.wav']);
    expect([...database.presets.values()].map(preset => preset.name)).toEqual(['Kept']);
    expect([...database.grooves.values()].map(groove => groove.name)).toEqual(['Beat']);
    expect(Object.fromEntries(prefs.values)).toEqual({
      clickSound: 'woodblock', viewMode: 'improv', padVolume: '30',
    });
  });
});
