// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Session } from '../../src/app/session';
import { StateManager } from '../../src/app/stateManager';
import type { EnginePort } from '../../src/app/ports';
import type { Database } from '../../src/storage/database';
import type { PreferenceKey, PreferenceStore } from '../../src/storage/preferences';
import type { CustomGroove, PracticeLog, Preset, TrainerSettings } from '../../src/domain/preset';
import { FACTORY_PRESETS } from '../../src/data/factory';
import { SONGS, songToPreset } from '../../src/domain/songs';
import { FIGURES } from '../../src/domain/pattern';
import { TRACKS, takesOf } from '../../src/domain/kit';
import { DEFAULT_TIMBRE, PAD_TIMBRES, timbreNotes } from '../../src/domain/chords';
import type { KeyTarget } from '../../src/domain/tempo';

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
  setStepUnits(units: Uint8Array) { this.record('setStepUnits', [[...units]]); }
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

function setup({ confirm = true, assetBase }: { confirm?: boolean; assetBase?: string } = {}) {
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
    ...(assetBase === undefined ? {} : { assetBase }),
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
  afterEach(() => { vi.useRealTimers(); });

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

  it('counts the practice time from Play, holds it at Stop and restarts it at the next Play', async () => {
    vi.useFakeTimers();
    const { session } = setup();
    const timers: number[] = [];
    session.subscribe(change => { if (change === 'timer') timers.push(session.practiceSeconds); });

    session.togglePlay();
    await vi.advanceTimersByTimeAsync(0);
    expect(timers).toEqual([0]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(timers).toEqual([0, 1, 2, 3]);

    session.togglePlay(); // Stop
    await vi.advanceTimersByTimeAsync(5000);
    expect(session.practiceSeconds).toBe(3);
    expect(timers).toEqual([0, 1, 2, 3]);

    session.togglePlay(); // Play again
    await vi.advanceTimersByTimeAsync(0);
    expect(session.practiceSeconds).toBe(0);
    expect(timers.at(-1)).toBe(0);
    session.togglePlay();
    await vi.advanceTimersByTimeAsync(0);
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
    // Every track: the preset's steps, or a silent bar for a track the preset leaves out
    TRACKS.forEach(({ id }) => expect(grids.get(id), `track ${id}`).toEqual(rock.gridData[id] ?? new Array(16).fill(0)));
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
    expect(session.trainerFields).toEqual(typed);

    // A loaded preset puts its own settings in the form
    session.loadPreset('factory:trainer_calvagada_148_190');
    expect(session.trainerFields).toEqual({
      enabled: true, startBpm: '148', targetBpm: '190', increment: '2', stepType: 'measures', stepValue: '3',
    });
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

    session.setPadVolume(0);
    session.setPadVolume(100);
    session.setPadVolume(40);

    expect(engine.sent('padVolume')).toEqual([[0], [1], [0.4]]);
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
  describe('asset base', () => {
    // Play loads the kit, a sampled click loads its file, the Improv screen loads the default timbre,
    // and choosing each other timbre loads its files
    async function loadEverything(assetBase?: string) {
      const fixture = setup({ assetBase });
      fixture.session.togglePlay();
      await flush();
      await fixture.session.setClickSound('woodblock');
      fixture.session.setView('improv');
      await flush();
      for (const { name } of PAD_TIMBRES.filter((_, timbre) => timbre !== DEFAULT_TIMBRE)) {
        fixture.session.setTimbre(name);
        await flush();
      }
      return fixture.engine;
    }
    const urlsOf = (engine: FakeEngine) => ({
      wasm: engine.sent('init').map(([wasmUrl]) => wasmUrl),
      worklet: engine.sent('init').map(([, workletUrl]) => workletUrl),
      samples: engine.sent('loadSample').map(([, url]) => url),
      takes: engine.sent('loadTake').map(([, , , url]) => url),
      pads: engine.sent('padLoad').map(([, , url]) => url),
    });
    const kitSamples = TRACKS.flatMap(track => (track.sample ? [track.sample] : []));
    const kitTakes = TRACKS.flatMap(track => takesOf(track).map(({ url }) => url));
    // In load order: the default timbre first, then the others as they are chosen
    const padFiles = [DEFAULT_TIMBRE, ...PAD_TIMBRES.keys()].filter((timbre, i, all) => all.indexOf(timbre) === i)
      .flatMap(timbre => PAD_TIMBRES[timbre].files.map(({ url }) => url));

    it('fetches every asset under /MetroRig/', async () => {
      const urls = urlsOf(await loadEverything('/MetroRig/'));

      expect(urls.wasm).toEqual(['/MetroRig/engine.wasm']);
      expect(urls.worklet).toEqual(['/worklet.js']); // Vite's ?url import already carries the base
      expect(urls.samples).toEqual([...kitSamples.map(url => '/MetroRig' + url), '/MetroRig/woodblock.wav']);
      expect(urls.takes).toEqual(kitTakes.map(url => '/MetroRig' + url));
      expect(urls.pads).toEqual(padFiles.map(url => '/MetroRig' + url));
      expect(kitTakes.length).toBeGreaterThan(0);
      // Every sampled timbre is among them
      for (const { name, files } of PAD_TIMBRES) {
        expect(files.every(({ url }) => urls.pads.includes('/MetroRig' + url)), name).toBe(true);
      }
      expect(new Set(padFiles.map(url => url.split('/')[2])).size).toBe(4);
    });

    it('fetches every asset under / by default', async () => {
      const urls = urlsOf(await loadEverything());

      expect(urls.wasm).toEqual(['/engine.wasm']);
      expect(urls.samples).toEqual([...kitSamples, '/woodblock.wav']);
      expect(urls.takes).toEqual(kitTakes);
      expect(urls.pads).toEqual(padFiles);
      const all = [...urls.wasm, ...urls.samples, ...urls.takes, ...urls.pads];
      expect(all.every(url => url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/MetroRig/'))).toBe(true);
    });
  });
});

describe('Stadium tempo', () => {
  const onStadium = () => {
    const fixture = setup();
    fixture.session.setView('stadium');
    return fixture;
  };
  const press = (session: Session, key: string, options: { modifier?: boolean; target?: KeyTarget } = {}) =>
    session.pressTempoKey(key, { modifier: options.modifier ?? false, target: options.target ?? { tagName: 'BODY' } });

  it('TMP-03 the raising keys step the tempo up 1 BPM each on the Stadium', () => {
    const { session } = onStadium();
    expect(press(session, '+')).toBe(true);
    expect(session.preset.bpm).toBe(121);
    expect(press(session, '=')).toBe(true);
    expect(session.preset.bpm).toBe(122);
  });

  it('TMP-04 the lowering key steps the tempo down 1 BPM on the Stadium', () => {
    const { session } = onStadium();
    expect(press(session, '-')).toBe(true);
    expect(session.preset.bpm).toBe(119);
  });

  it('TMP-05 a key with Ctrl or Cmd leaves the tempo', () => {
    const { session } = onStadium();
    ['+', '=', '-'].forEach(key => expect(press(session, key, { modifier: true })).toBe(false));
    expect(session.preset.bpm).toBe(120);
    expect(session.hasUnsavedEdits).toBe(false);
  });

  it('TMP-06 the keys leave the tempo on the other screens', () => {
    const { session } = setup();
    (['editor', 'grooves', 'improv'] as const).forEach(view => {
      session.setView(view);
      ['+', '=', '-'].forEach(key => expect(press(session, key)).toBe(false));
    });
    expect(session.preset.bpm).toBe(120);
    expect(session.hasUnsavedEdits).toBe(false);
  });

  it('TMP-07 the keys leave the tempo while a text field has focus', () => {
    const { session } = onStadium();
    const textFields: KeyTarget[] = [
      { tagName: 'INPUT', type: 'text' },
      { tagName: 'INPUT', type: 'number' },
      { tagName: 'INPUT', type: 'search' },
      { tagName: 'TEXTAREA' },
      { tagName: 'DIV', isContentEditable: true },
    ];
    textFields.forEach(target => {
      ['+', '=', '-'].forEach(key => expect(press(session, key, { target })).toBe(false));
    });
    expect(session.preset.bpm).toBe(120);

    // A slider, a checkbox or a selector takes no text, so the keys still step
    const controls: KeyTarget[] = [{ tagName: 'INPUT', type: 'range' }, { tagName: 'INPUT', type: 'checkbox' }, { tagName: 'SELECT' }];
    controls.forEach(target => expect(press(session, '+', { target })).toBe(true));
    expect(session.preset.bpm).toBe(123);
  });

  it('TMP-08 the tempo stops at 240', () => {
    const { session } = onStadium();
    session.setBpm(239);
    expect(session.canStepBpm(1)).toBe(true);
    session.stepBpm(1);
    expect(session.preset.bpm).toBe(240);
    expect(session.canStepBpm(1)).toBe(false);
    session.stepBpm(1);
    expect(press(session, '+')).toBe(false); // Refused, so the browser keeps the key
    expect(session.preset.bpm).toBe(240);
    expect(session.canStepBpm(-1)).toBe(true);
  });

  it('TMP-09 the tempo stops at 40', () => {
    const { session } = onStadium();
    session.setBpm(41);
    session.stepBpm(-1);
    expect(session.preset.bpm).toBe(40);
    expect(session.canStepBpm(-1)).toBe(false);
    session.stepBpm(-1);
    expect(press(session, '-')).toBe(false);
    expect(session.preset.bpm).toBe(40);
    expect(session.canStepBpm(1)).toBe(true);
  });

  it('TMP-10 an enabled Trainer locks the tempo steps', () => {
    const { session } = onStadium();
    const changes: string[] = [];
    session.subscribe(change => changes.push(change));
    session.setTrainer(trainer);
    expect(changes).toContain('trainer');
    expect(session.canStepBpm(1)).toBe(false);
    expect(session.canStepBpm(-1)).toBe(false);
    session.stepBpm(1);
    expect(press(session, '+')).toBe(false);
    expect(press(session, '-')).toBe(false);
    expect(session.preset.bpm).toBe(120);

    session.setTrainer({ ...trainer, enabled: false });
    expect(session.canStepBpm(1)).toBe(true);
    session.stepBpm(1);
    expect(session.preset.bpm).toBe(121);
  });

  it('TMP-11 a step during playback reaches the engine at once', async () => {
    const { session, engine } = setup();
    session.setView('stadium');
    session.togglePlay();
    await flush();
    engine.calls.length = 0;
    session.stepBpm(1);
    expect(engine.sent('setBpm')).toEqual([[121]]);
    press(session, '-');
    expect(engine.sent('setBpm')).toEqual([[121], [120]]);
  });

  it('TMP-12 a step marks the preset edited', () => {
    const { session } = onStadium();
    expect(session.hasUnsavedEdits).toBe(false);
    session.stepBpm(-1);
    expect(session.hasUnsavedEdits).toBe(true);
  });

  it('TMP-15 a step after the Trainer is turned off during playback starts from the ramp\'s tempo', async () => {
    const { session, engine } = setup();
    const live = (bpm: number) =>
      engine.dispatchEvent(new CustomEvent('tick', { detail: { beatIndex: 0, currentBpm: bpm, activeTrackIds: [] } }));
    const play = async () => { session.togglePlay(); await flush(); };
    const rampTo = (bpm: number, settings: TrainerSettings = trainer) => {
      session.setTrainer(settings);
      live(bpm);
      session.setTrainer({ ...settings, enabled: false });
    };
    session.setView('stadium');
    session.setTrainer(trainer); // Starts at 90, the preset holds 120
    await play();

    // Up and down from where the ramp got to
    rampTo(163.4);
    engine.calls.length = 0;
    expect(press(session, '+')).toBe(true);
    expect(session.preset.bpm).toBe(164);
    expect(engine.sent('setBpm')).toEqual([[164]]);
    rampTo(163.4);
    session.stepBpm(-1);
    expect(session.preset.bpm).toBe(163);

    // The bound is judged on the ramp's tempo too
    const toTheTop = { ...trainer, targetBpm: 240 };
    rampTo(240, toTheTop);
    expect(session.canStepBpm(1)).toBe(false);
    expect(press(session, '+')).toBe(false);
    expect(session.preset.bpm).toBe(163);
    expect(session.canStepBpm(-1)).toBe(true);
    session.stepBpm(-1);
    expect(session.preset.bpm).toBe(239);

    // Stop forgets the ramp: the next Play runs the preset's own tempo
    rampTo(163.4);
    await play(); // Stop
    session.stepBpm(1);
    expect(session.preset.bpm).toBe(240);
    session.setBpm(120);
    await play();
    session.stepBpm(1);
    expect(session.preset.bpm).toBe(121);

    // Turned off while stopped, nothing was ramping
    await play(); // Stop
    session.setTrainer(trainer);
    session.setTrainer({ ...trainer, enabled: false });
    session.stepBpm(1);
    expect(session.preset.bpm).toBe(122);

    // A tick from an earlier run is not this run's tempo: the engine restarted at the Trainer's 90
    session.setTrainer(trainer);
    await play();
    live(163.4);
    await play(); // Stop
    await play();
    session.setTrainer({ ...trainer, enabled: false }); // Before this run's first tick
    session.stepBpm(1);
    expect(session.preset.bpm).toBe(91);

    // A preset load moves the engine to its own start tempo, and forgets an earlier ramp
    rampTo(163.4);
    session.loadPreset('factory:trainer_calvagada_148_190');
    session.setTrainer({ ...session.preset.trainerSettings, enabled: false }); // Before its first tick
    session.stepBpm(1);
    expect(session.preset.bpm).toBe(149);
    rampTo(163.4);
    session.loadPreset('factory:rock'); // No Trainer, 120 BPM
    session.stepBpm(1);
    expect(session.preset.bpm).toBe(121);
  });

  it('TMP-14 a step from a fractional tempo rounds in its direction', () => {
    const { session } = onStadium();
    session.setBpm(120.4);
    session.stepBpm(1);
    expect(session.preset.bpm).toBe(121);
    session.setBpm(120.4);
    session.stepBpm(-1);
    expect(session.preset.bpm).toBe(120);
    // Above the half too: the step goes to the next whole BPM, never the nearest one plus 1
    session.setBpm(120.6);
    session.stepBpm(1);
    expect(session.preset.bpm).toBe(121);
    session.setBpm(120.6);
    session.stepBpm(-1);
    expect(session.preset.bpm).toBe(120);
  });
});

// --- Tuplets (AD-029): a beat of a /4 bar holds 4, 3 or 6 cells ---

const STRAIGHT = 12; // A cell's length in twelfths of a sixteenth
const TRIPLET = 16;
const SEXTUPLET = 8;
const units = (...beats: [number, number][]) => beats.flatMap(([count, unit]) => new Array(count).fill(unit));
const figureOf = (id: string) => FIGURES.find(figure => figure.id === id)!;

// Stores a preset and loads it, as the selector does
async function loadStored(fixture: ReturnType<typeof setup>, preset: Omit<Preset, 'id' | 'name' | 'bpm' | 'trainerSettings'>) {
  await fixture.database.savePreset({ id: 'user_stored', name: 'Stored', bpm: 120, trainerSettings: { ...trainer, enabled: false }, ...preset });
  fixture.session.loadPreset('user:user_stored');
  await flush();
}

// A 4/4 bar whose beat 2 is a snare triplet: 15 cells
const TRIPLET_BAR = {
  timeSignature: '4/4', measureLength: 16, bars: 1, beatCells: [[4, 3, 4, 4]],
  gridData: {
    0: [2, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    2: [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    3: [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  },
};

// The calls since the engine last took the bar length, in order
// Each cell-length list the engine got, in order
const unitsSent = (engine: FakeEngine) => engine.sent('setStepUnits').map(([sent]) => sent);

function layoutCalls(engine: FakeEngine) {
  return engine.calls.filter(call => ['setMeasureLength', 'setBars', 'setStepUnits', 'updateGrid'].includes(call.method));
}

describe('Session', () => {
  it('sends each cell\'s length after the bar length and the bars on Play', async () => {
    const { session, engine, database } = setup();
    // A stored 4/4 bar whose beat 2 is a triplet: 15 cells, with the snare on the triplet
    await database.savePreset({
      id: 'user_triplet', name: 'Triplet', bpm: 120, timeSignature: '4/4', measureLength: 16, bars: 1,
      beatCells: [[4, 3, 4, 4]],
      gridData: { 0: [2, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 2: [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
      trainerSettings: { ...trainer, enabled: false },
    });
    session.loadPreset('user:user_triplet');
    await flush();

    session.togglePlay();
    await flush();

    // Play sends the layout each time it syncs the engine, every time with the triplet
    expect(unitsSent(engine).length).toBeGreaterThan(0);
    unitsSent(engine).forEach(sent => expect(sent).toEqual(units([4, STRAIGHT], [3, TRIPLET], [8, STRAIGHT])));
    const calls = layoutCalls(engine).map(call => call.method);
    const unitsAt = calls.lastIndexOf('setStepUnits');
    expect(calls.lastIndexOf('setMeasureLength')).toBeLessThan(unitsAt);
    expect(calls.lastIndexOf('setBars')).toBeLessThan(unitsAt);
    // Every track follows the units, padded to the pattern's 15 cells when the preset leaves it out
    const grids = layoutCalls(engine).slice(unitsAt + 1);
    expect(grids.map(call => call.args[0]).sort((a, b) => a - b)).toEqual(TRACKS.map(track => track.id).sort((a, b) => a - b));
    const sent = new Map(grids.map(call => [call.args[0], call.args[1]]));
    expect(sent.get(2)).toEqual([0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sent.get(1)).toEqual(new Array(15).fill(0));
    TRACKS.forEach(({ id }) => expect(sent.get(id), `track ${id}`).toHaveLength(15));
  });

  it('sends straight cells for a pattern with no tuplet', async () => {
    const { session, engine } = setup();
    session.togglePlay();
    await flush();
    expect(unitsSent(engine).length).toBeGreaterThan(0);
    unitsSent(engine).forEach(sent => expect(sent).toEqual(units([16, STRAIGHT])));
  });

  it('sends the cell lengths and every track after each tuplet edit', async () => {
    const { session, engine } = await startedEngine();
    session.togglePlay();
    await flush();
    engine.calls.length = 0;

    session.selectFigure(figureOf('triplet'));
    session.editStep(2, 4); // Snare triplet on beat 2

    expect(unitsSent(engine)).toEqual([units([4, STRAIGHT], [3, TRIPLET], [8, STRAIGHT])]);
    let calls = layoutCalls(engine);
    expect(calls[0].method).toBe('setStepUnits');
    let sent = new Map(calls.slice(1).map(call => [call.args[0], call.args[1]]));
    expect([...sent.keys()].sort((a, b) => a - b)).toEqual(TRACKS.map(track => track.id).sort((a, b) => a - b));
    expect(sent.get(2)).toEqual([0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sent.get(0)).toEqual([2, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]); // The click stays on each beat

    engine.calls.length = 0;
    session.selectFigure(figureOf('sextuplet'));
    session.editStep(1, 8); // Kick sextuplet on beat 3
    expect(unitsSent(engine)).toEqual([units([4, STRAIGHT], [3, TRIPLET], [6, SEXTUPLET], [4, STRAIGHT])]);
    expect(layoutCalls(engine)[0].method).toBe('setStepUnits');
    expect(engine.sent('updateGrid').every(([, steps]) => steps.length === 17)).toBe(true);

    // Back to straight cells: the beat returns to 4 units of 12
    engine.calls.length = 0;
    session.selectFigure(figureOf('quarter'));
    session.editStep(2, 4);
    session.editStep(1, 8); // Beat 3 starts at cell 8 once beat 2 is straight again
    expect(unitsSent(engine)).toEqual([
      units([8, STRAIGHT], [6, SEXTUPLET], [4, STRAIGHT]),
      units([16, STRAIGHT]),
    ]);
    calls = layoutCalls(engine);
    sent = new Map(calls.slice(calls.map(call => call.method).lastIndexOf('setStepUnits') + 1).map(call => [call.args[0], call.args[1]]));
    expect(sent.get(2)).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sent.get(1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('sends one track and no cell lengths for an edit that keeps every beat\'s kind', async () => {
    const { session, engine } = await startedEngine();
    session.selectFigure(figureOf('eighths'));
    session.editStep(3, 0);
    expect(unitsSent(engine)).toEqual([]);
    expect(engine.sent('updateGrid')).toEqual([[3, [1, 0, 1, 0, ...new Array(12).fill(0)]]]);
  });

  it('tup_09 a tuplet cell cycles like a straight one', async () => {
    const { session, engine } = await startedEngine();
    session.selectFigure(figureOf('triplet_rest'));
    session.editStep(3, 13); // Beat 4 of the 4/4 bar becomes 3 empty hi-hat cells: cells 12, 13, 14
    session.selectFigure(null);
    engine.calls.length = 0;

    // A straight cell's cycle, read from a straight cell of the same track
    const straightCycle: number[] = [];
    for (let i = 0; i < 4; i++) {
      session.editStep(3, 1);
      straightCycle.push(session.preset.gridData[3][1]);
    }
    expect(straightCycle.at(-1)).toBe(0); // The cycle returns to empty
    expect(new Set(straightCycle).size).toBe(4);

    const tupletCycle: number[] = [];
    for (let i = 0; i < 4; i++) {
      session.editStep(3, 13);
      tupletCycle.push(session.preset.gridData[3][13]);
      // Only the clicked cell changes: its neighbours in the triplet and the layout stay
      expect(session.preset.gridData[3][12]).toBe(0);
      expect(session.preset.gridData[3][14]).toBe(0);
      expect(session.preset.beatCells).toEqual([[4, 4, 4, 3]]);
    }
    expect(tupletCycle).toEqual(straightCycle);
    expect(session.preset.gridData[3]).toHaveLength(15);
    // The track reaches the engine at its 15 cells; the layout did not change, so no units are sent
    expect(unitsSent(engine)).toEqual([]);
    session.editStep(3, 14);
    expect(engine.sent('updateGrid').at(-1)).toEqual([3, [...new Array(14).fill(0), straightCycle[0]]]);

    // In a later bar of 4 the click lands on that bar's own cell, past a bar holding a triplet
    session.useSong(SONGS[0]);
    session.showBar(1);
    session.selectFigure(figureOf('triplet_rest'));
    session.editStep(2, 4); // Bar 2: 4 + 3 + 4 + 4 = 15 cells, so bar 3 starts at cell 31
    session.selectFigure(null);
    session.showBar(2);
    const before = session.preset.gridData[2][31 + 1];
    session.editStep(2, 1);
    expect(session.preset.gridData[2][31 + 1]).toBe(before === 0 ? straightCycle[0] : straightCycle[straightCycle.indexOf(before) + 1] ?? 0);
    expect(session.preset.gridData[2]).toHaveLength(63);
  });

  it('tup_11 a tuplet in bar 2 leaves the other bars', () => {
    const { session } = setup();
    session.useSong(SONGS[0]); // 4 straight bars of 4/4: 64 cells
    const before = structuredClone(session.preset.gridData);
    const bar = (steps: number[], from: number, to: number) => steps.slice(from, to);

    session.showBar(1);
    session.selectFigure(figureOf('triplet'));
    session.editStep(2, 5); // Snare triplet on beat 2 of bar 2

    expect(session.preset.beatCells).toEqual([[4, 4, 4, 4], [4, 3, 4, 4], [4, 4, 4, 4], [4, 4, 4, 4]]);
    for (const { id } of TRACKS) {
      const steps = session.preset.gridData[id];
      const old = before[id] ?? new Array(64).fill(0);
      expect(steps, `track ${id}`).toHaveLength(63);
      expect(bar(steps, 0, 16), `bar 1 of track ${id}`).toEqual(bar(old, 0, 16));
      expect(bar(steps, 31, 63), `bars 3 and 4 of track ${id}`).toEqual(bar(old, 32, 64));
      // Bar 2's straight beats keep their hits
      expect(bar(steps, 16, 20), `bar 2 beat 1 of track ${id}`).toEqual(bar(old, 16, 20));
      expect(bar(steps, 23, 31), `bar 2 beats 3-4 of track ${id}`).toEqual(bar(old, 24, 32));
    }
    expect(bar(session.preset.gridData[2], 20, 23)).toEqual([1, 1, 1]);
    expect(session.hasUnsavedEdits).toBe(true);
  });

  it('tup_39 a tuplet figure outside /4 changes nothing', async () => {
    const { session, engine } = await startedEngine();
    expect(session.setTimeSignature(6, 8)).toBe('changed');
    session.editStep(2, 3); // A snare hit, so the bar holds something to lose
    session.hasUnsavedEdits = false;
    const before = structuredClone(session.preset);
    engine.calls.length = 0;
    const changes: string[] = [];
    session.subscribe(change => changes.push(change));

    for (const id of ['triplet', 'triplet_rest', 'sextuplet', 'sextuplet_rest']) {
      session.selectFigure(figureOf(id));
      for (const step of [0, 3, 7, 11]) session.editStep(2, step);
    }

    expect(session.preset).toEqual(before);
    expect(session.preset.beatCells).toBeUndefined();
    expect(session.hasUnsavedEdits).toBe(false);
    expect(engine.calls).toEqual([]);
    expect(changes).toEqual([]);

    // A straight figure still writes in 6/8
    session.selectFigure(figureOf('sixteenths'));
    session.editStep(1, 0);
    expect(session.preset.gridData[1].slice(0, 4)).toEqual([1, 1, 1, 1]);
  });

  it('tup_25 surviving beats keep their kind', async () => {
    const fixture = await startedEngine();
    await loadStored(fixture, structuredClone(TRIPLET_BAR));
    const { session, engine } = fixture;
    engine.calls.length = 0;

    expect(session.setTimeSignature(5, 4)).toBe('changed');

    expect(session.preset.beatCells).toEqual([[4, 3, 4, 4, 4]]);
    for (const [id, steps] of Object.entries(TRIPLET_BAR.gridData)) {
      expect(session.preset.gridData[Number(id)], `track ${id}`).toEqual([...steps, 0, 0, 0, 0]);
    }
    TRACKS.forEach(({ id }) => expect(session.preset.gridData[id], `track ${id}`).toHaveLength(19));
    expect(unitsSent(engine).at(-1)).toEqual(units([4, STRAIGHT], [3, TRIPLET], [12, STRAIGHT]));

  });

  it('keeps the triplet on beat 2 from 4/4 to 3/4', async () => {
    const fixture = setup();
    await loadStored(fixture, structuredClone(TRIPLET_BAR));
    expect(fixture.session.setTimeSignature(3, 4)).toBe('changed');
    expect(fixture.session.preset.measureLength).toBe(12);
    expect(fixture.session.preset.beatCells).toEqual([[4, 3, 4]]);
    for (const [id, steps] of Object.entries(TRIPLET_BAR.gridData)) {
      expect(fixture.session.preset.gridData[Number(id)], `track ${id}`).toEqual(steps.slice(0, 11));
    }
    // A move that drops the only tuplet beat leaves a straight bar with no layout stored
    expect(fixture.session.setTimeSignature(1, 4)).toBe('changed');
    expect(fixture.session.preset.beatCells).toBeUndefined();
    expect(fixture.session.preset.gridData[2]).toEqual([0, 0, 0, 0]);
  });

  it('tup_26 a /8 signature straightens every beat', async () => {
    const fixture = await startedEngine();
    // Beat 2 a snare triplet, beat 3 a kick sextuplet of mixed strengths: 1 normal, 2 accent, 3 ghost
    await loadStored(fixture, {
      timeSignature: '4/4', measureLength: 16, bars: 1, beatCells: [[4, 3, 6, 4]],
      gridData: {
        0: [2, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        1: [1, 0, 0, 0, 0, 0, 0, 1, 3, 2, 1, 2, 3, 0, 0, 0, 0],
        2: [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    });
    const { session, engine } = fixture;
    engine.calls.length = 0;

    expect(session.setTimeSignature(6, 8)).toBe('changed');

    expect(session.preset.beatCells).toBeUndefined();
    expect(session.preset.measureLength).toBe(12);
    // Triplet cells at 0, 1/3, 2/3 of the beat land on sixteenths 0, 1 and 3
    expect(session.preset.gridData[2]).toEqual([0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0]);
    // Sextuplet cells 1 and 2 share sixteenth 1, as do 4 and 5 sixteenth 3: the accent beats the ghost
    expect(session.preset.gridData[1]).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 2]);
    expect(session.preset.gridData[0]).toEqual([2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    TRACKS.forEach(({ id }) => expect(session.preset.gridData[id], `track ${id}`).toHaveLength(12));
    expect(unitsSent(engine).at(-1)).toEqual(units([12, STRAIGHT]));

    // Back in /4 every beat is straight
    expect(session.setTimeSignature(4, 4)).toBe('changed');
    expect(session.preset.beatCells).toBeUndefined();
    expect(session.preset.gridData[2]).toEqual([0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('tup_19 the 32-step signature rule stands with tuplets', async () => {
    const fixture = setup();
    await loadStored(fixture, structuredClone(TRIPLET_BAR));
    const { session } = fixture;
    const before = structuredClone(session.preset);

    // 9/4 holds 36 straight steps: refused, though the triplet bar holds fewer cells
    expect(session.setTimeSignature(9, 4)).toBe('too-long');
    expect(session.setTimeSignature(17, 8)).toBe('too-long');
    expect(session.setTimeSignature(33, 16)).toBe('too-long');
    expect(session.preset).toEqual(before);

    // 8/4 holds 32: allowed, and the triplet stays
    expect(session.setTimeSignature(8, 4)).toBe('changed');
    expect(session.preset.beatCells).toEqual([[4, 3, 4, 4, 4, 4, 4, 4]]);
  });

  it('follows a tick in bar 2 after a bar with a triplet', async () => {
    const fixture = setup();
    // Bar 1 holds a triplet on beat 2 (15 cells), bars 2-4 are straight: 15 + 16 + 16 + 16 = 63 cells
    const straight = new Array(16).fill(0);
    await loadStored(fixture, {
      timeSignature: '4/4', measureLength: 16, bars: 4, beatCells: [[4, 3, 4, 4], [4, 4, 4, 4], [4, 4, 4, 4], [4, 4, 4, 4]],
      gridData: { 0: [...TRIPLET_BAR.gridData[0], ...straight, ...straight, ...straight] },
    });
    const { session, engine } = fixture;
    session.togglePlay();
    await flush();
    const tick = (beatIndex: number) =>
      engine.dispatchEvent(new CustomEvent('tick', { detail: { beatIndex, currentBpm: 120, activeTrackIds: [] } }));
    const grids: number[] = [];
    session.subscribe(change => { if (change === 'grid') grids.push(session.playBar); });

    tick(5); // Bar 1, the triplet's second cell
    expect([session.playBar, session.position]).toEqual([0, { bar: 1, step: 5 }]);
    tick(14); // Bar 1's last cell
    expect([session.playBar, session.position]).toEqual([0, { bar: 1, step: 14 }]);

    tick(15); // Bar 2's first cell
    expect(session.playBar).toBe(1);
    expect(session.viewBar).toBe(1);
    expect(session.position).toEqual({ bar: 2, step: 0 });
    expect(grids).toEqual([1]);

    tick(20); // Bar 2, beat 2's second cell
    expect([session.playBar, session.position]).toEqual([1, { bar: 2, step: 5 }]);
    tick(31); // Bar 3 starts at 15 + 16
    expect([session.playBar, session.position]).toEqual([2, { bar: 3, step: 0 }]);
    tick(47); // Bar 4 starts at 15 + 16 + 16
    expect([session.playBar, session.position]).toEqual([3, { bar: 4, step: 0 }]);
    tick(62); // The pattern's last cell
    expect([session.playBar, session.position]).toEqual([3, { bar: 4, step: 15 }]);
    expect(session.lastTick?.beatIndex).toBe(62);

    // A cell past the pattern's 63 is the engine's old, longer pattern: ignored
    tick(63);
    expect(session.lastTick?.beatIndex).toBe(62);
    expect([session.playBar, session.position]).toEqual([3, { bar: 4, step: 15 }]);
  });

  it('tup_29 a saved groove keeps its beat cells', async () => {
    const fixture = setup();
    await loadStored(fixture, structuredClone(TRIPLET_BAR));
    const { session, database } = fixture;

    await session.saveGroove('Triplet groove');

    const [groove] = [...database.grooves.values()];
    expect(groove).toMatchObject({ name: 'Triplet groove', measureLength: 16, beatCells: [4, 3, 4, 4] });
    // Each drum track holds the bar's 15 cells; the click stays out, as today
    expect(Object.keys(groove.gridData).map(Number).sort((a, b) => a - b)).toEqual(TRACKS.slice(1).map(t => t.id).sort((a, b) => a - b));
    expect(groove.gridData[2]).toEqual(TRIPLET_BAR.gridData[2]);
    expect(groove.gridData[3]).toEqual(TRIPLET_BAR.gridData[3]);
    expect(groove.gridData[1]).toEqual(new Array(15).fill(0));

    // From bar 2 of 4, past a bar of 15 cells, the groove takes bar 2's own cells and layout
    await loadStored(fixture, {
      timeSignature: '4/4', measureLength: 16, bars: 4, beatCells: [[4, 3, 4, 4], [4, 4, 4, 6], [4, 4, 4, 4], [4, 4, 4, 4]],
      gridData: { 2: [...TRIPLET_BAR.gridData[2], 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, ...new Array(32).fill(1)] },
    });
    session.showBar(1);
    database.grooves.clear();
    await session.saveGroove('Bar 2');
    const [second] = [...database.grooves.values()];
    expect(second.beatCells).toEqual([4, 4, 4, 6]);
    expect(second.gridData[2]).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);

    // A straight bar stores no beat cells, as before tuplets
    session.loadPreset('factory:rock');
    database.grooves.clear();
    await session.saveGroove('Straight');
    const [plain] = [...database.grooves.values()];
    expect(plain).not.toHaveProperty('beatCells');
    expect(plain.gridData[2]).toEqual(FACTORY_PRESETS.find(p => p.id === 'rock')!.gridData[2].slice(0, 16));
  });

  it('tup_30 a groove repeats beat by beat', async () => {
    const fixture = setup();
    // A 4-beat groove whose beat 1 is a triplet: kick on beats 1 and 3, snare on the triplet's last 2 cells, beat 2 and beat 4
    await loadStored(fixture, {
      timeSignature: '4/4', measureLength: 16, bars: 1, beatCells: [[3, 4, 4, 4]],
      gridData: {
        1: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        2: [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      },
    });
    const { session, database } = fixture;
    await session.saveGroove('Groove');
    const [groove] = [...database.grooves.values()];

    session.loadPreset('factory:default');
    expect(session.setTimeSignature(5, 4)).toBe('changed');
    session.applyGroove(`user:${groove.id}`);
    await flush();

    // Beats 1-4 take groove beats 1-4, and beat 5 takes groove beat 1: its kind and its hits
    expect(session.preset.beatCells).toEqual([[3, 4, 4, 4, 3]]);
    expect(session.preset.gridData[1]).toEqual([1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
    expect(session.preset.gridData[2]).toEqual([0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1]);
    TRACKS.slice(1).forEach(({ id }) => expect(session.preset.gridData[id], `track ${id}`).toHaveLength(18));
    // The click is no groove track: it keeps its hits, re-laid on beat 1's triplet with its accent on the beat start
    expect(session.preset.gridData[0]).toEqual([2, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);

    // A straight groove makes every beat of the bar straight again
    session.applyGroove('factory:rock');
    expect(session.preset.beatCells).toBeUndefined();
    const rock = FACTORY_PRESETS.find(p => p.id === 'rock')!;
    expect(session.preset.gridData[2]).toEqual([...rock.gridData[2].slice(0, 16), ...rock.gridData[2].slice(0, 4)]);
    expect(session.preset.gridData[0]).toEqual([2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('tup_31 a tuplet groove lands straight in /8', async () => {
    const fixture = setup();
    await loadStored(fixture, structuredClone(TRIPLET_BAR));
    const { session, database } = fixture;
    await session.saveGroove('Triplet groove');
    const [groove] = [...database.grooves.values()];

    session.loadPreset('factory:default');
    expect(session.setTimeSignature(6, 8)).toBe('changed');
    session.applyGroove(`user:${groove.id}`);
    await flush();

    expect(session.preset.beatCells).toBeUndefined();
    // The groove's triplet cells at 0, 1/3 and 2/3 of beat 2 land on its sixteenths 4, 5 and 7, then the 12-step bar takes them
    expect(session.preset.gridData[2]).toEqual([0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0]);
    // Hi-hat triplet cells 4 and 5 (beat 2's 0 and 1/3) land on 4 and 5; beats 1 and 3 keep their eighths
    expect(session.preset.gridData[3]).toEqual([1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0]);
    TRACKS.forEach(({ id }) => expect(session.preset.gridData[id], `track ${id}`).toHaveLength(12));
  });

  it('tup_27 a saved tuplet preset reloads the same', async () => {
    const first = setup();
    first.session.selectFigure(figureOf('triplet'));
    first.session.editStep(2, 4); // Snare triplet on beat 2
    first.session.selectFigure(figureOf('sextuplet'));
    first.session.editStep(1, 12); // Kick sextuplet on beat 4, which starts at cell 4 + 3 + 4 = 11
    const written = structuredClone(first.session.preset);
    expect(written.beatCells).toEqual([[4, 3, 4, 6]]);
    await first.session.savePreset('Tuplets');

    // A page reload: a new Session over the same storage
    const prefs = new MemoryPreferences();
    const reloaded = new Session({
      engine: new FakeEngine(), state: new StateManager(first.database, prefs), prefs,
      dialogs: { confirm: () => true }, wasmUrl: '/engine.wasm', workletUrl: '/worklet.js',
    });
    const [stored] = await reloaded.userPresets();
    reloaded.loadPreset(`user:${stored.id}`);
    await flush();

    expect(reloaded.preset.beatCells).toEqual([[4, 3, 4, 6]]);
    // Every track as written; a track the pattern never held loads as the bar's 17 empty cells
    TRACKS.forEach(({ id }) => expect(reloaded.preset.gridData[id], `track ${id}`).toEqual(written.gridData[id] ?? new Array(17).fill(0)));
    expect(reloaded.preset.gridData[2].slice(4, 7)).toEqual([1, 1, 1]);
    expect(reloaded.preset.gridData[1].slice(11, 17)).toEqual([1, 1, 1, 1, 1, 1]);
  });
});
