import { withBase } from '../domain/assets';
import type { ChordId } from '../domain/chords';
import { TRACKS, nextStepValue } from '../domain/kit';
import { measureLengthFor, timeSignatureOf } from '../domain/meter';
import { createTrackMix, toggleMute, toggleSolo, type TrackMix } from '../domain/mix';
import { FIGURES, applyFigure, barCount, barOfStep, barSteps, fitBar, patternLength, stepInBar, writeBar } from '../domain/pattern';
import { completeKit, normalizePreset, startBpmFor, type CustomGroove, type Preset, type StoredPreset, type TrainerSettings, type ViewMode } from '../domain/preset';
import { songToPreset, type Song } from '../domain/songs';
import { steppedBpm, tempoKeyStep, typesText, type KeyTarget, type TempoStep } from '../domain/tempo';
import { FACTORY_GROOVES, GENRE_PRESETS, SIGNATURE_PRESETS, SPEED_TRAINER_PRESETS } from '../data/factory';
import type { TickDetail } from '../audio/MetronomeNode';
import { VisualScheduler } from '../audio/visualSync';
import { Improv } from './improv';
import { factoryGroove, factoryPreset, parseSource, song as findSong } from './library';
import type { Dialogs, EnginePort, Preferences, SessionChange } from './ports';
import type { StateManager } from './stateManager';
import { Transport } from './transport';

export type Figure = typeof FIGURES[number];

// The Trainer form's fields as the user typed them: the Stadium prints this text, not the numbers
export interface TrainerFields {
  enabled: boolean;
  startBpm: string;
  targetBpm: string;
  increment: string;
  stepType: string;
  stepValue: string;
}

export function trainerFieldsOf(ts: TrainerSettings): TrainerFields {
  return {
    enabled: ts.enabled,
    startBpm: String(ts.startBpm),
    targetBpm: String(ts.targetBpm),
    increment: String(ts.increment),
    stepType: ts.stepType,
    stepValue: String(ts.stepValue),
  };
}

export type TimeSignatureResult = 'changed' | 'too-long' | 'declined' | 'unchanged';

export interface SessionOptions {
  engine: EnginePort;
  state: StateManager;
  prefs: Preferences;
  dialogs: Dialogs;
  wasmUrl: string; // From the site root, placed under assetBase
  workletUrl: string; // Used as given: Vite's ?url import already carries the base
  assetBase?: string; // Where the site is served from, `/` by default
}

// Every rule the page runs, behind the commands the screens call. The engine and the storage come in as arguments
export class Session {
  private engine: EnginePort;
  private state: StateManager;
  private prefs: Preferences;
  private dialogs: Dialogs;
  private transport: Transport;
  readonly improv: Improv;
  private visualScheduler = new VisualScheduler();
  private listeners = new Set<(change: SessionChange) => void>();

  readonly mix: TrackMix = createTrackMix();
  figure: Figure | null = null; // Stamped by grid clicks; null toggles single steps
  // The bar the Editor shows, and the bar in play, which is the first one when stopped
  viewBar = 0;
  playBar = 0;
  // The bar count since Play and the step last drawn
  position = { bar: 1, step: -1 };
  // The first Play waits for the kit to load, and a song pressed meanwhile must not stop it
  isStarting = false;
  hasUnsavedEdits = false;
  selectedPresetValue = 'factory:default'; // Where the selector returns when a load is declined
  private selectorValue = 'factory:default'; // What the preset selector asks for last
  lastTick: TickDetail | null = null;
  // The tempo a Trainer turned off during playback left in the engine, until Stop, a preset load or a step replaces it
  private rampedBpm: number | null = null;
  // Whole seconds since the last Play; a stop holds the count until the next Play
  practiceSeconds = 0;
  private practiceStart = 0;
  private practiceInterval: ReturnType<typeof setInterval> | null = null;
  private typedTrainer: TrainerFields | null = null; // Null while the form shows the preset's settings
  clickSound: string;
  // What the selectors list
  readonly signaturePresets = SIGNATURE_PRESETS;
  readonly genrePresets = GENRE_PRESETS;
  readonly trainerPresets = SPEED_TRAINER_PRESETS;
  readonly factoryGrooves = FACTORY_GROOVES;

  constructor({ engine, state, prefs, dialogs, wasmUrl, workletUrl, assetBase = '/' }: SessionOptions) {
    this.engine = engine;
    this.state = state;
    this.prefs = prefs;
    this.dialogs = dialogs;
    this.clickSound = prefs.get('clickSound') || 'digital';
    const asset = (path: string) => withBase(assetBase, path);
    this.transport = new Transport(engine, { wasmUrl: asset(wasmUrl), workletUrl }, {
      asset,
      preset: () => this.state.activePreset,
      mix: this.mix,
      clickSound: () => this.clickSound,
      padVolume: () => this.improv.padVolume,
    });
    this.improv = new Improv(engine, prefs, {
      asset,
      startEngine: () => this.transport.startEngine(),
      sendPadVolume: () => this.transport.sendPadVolume(),
      changed: () => this.emit('improv'),
    });
    engine.addEventListener('tick', (e) => {
      const detail = (e as CustomEvent<TickDetail>).detail;
      this.visualScheduler.schedule(() => this.onTick(detail), this.engine.visualDelayMs());
    });
  }

  get preset(): Preset {
    return this.state.activePreset;
  }

  get isPlaying(): boolean {
    return this.state.isPlaying;
  }

  get view(): ViewMode {
    return this.state.activeViewMode;
  }

  get isAudioInit(): boolean {
    return this.transport.isAudioInit;
  }

  subscribe(listener: (change: SessionChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(change: SessionChange) {
    this.listeners.forEach(listener => listener(change));
  }

  private markEdited() {
    this.hasUnsavedEdits = true;
    this.emit('edits');
  }

  sampleRate(): number {
    return this.engine.sampleRate();
  }

  latencyMs(): number {
    return this.engine.visualDelayMs();
  }

  startEngine(): Promise<void> {
    return this.transport.startEngine();
  }

  // --- Transport ---

  togglePlay(): void {
    this.isStarting = !this.state.isPlaying;
    this.transport.initAudio().then(() => {
      if (this.state.isPlaying) {
        this.engine.stop();
        this.state.isPlaying = false;
        this.rampedBpm = null; // The next Play starts from the preset
        this.visualScheduler.cancelAll();
        this.viewBar = 0;
        this.playBar = 0;
        this.position = { bar: 1, step: -1 };
        this.stopPracticeTimer();
      } else {
        this.viewBar = 0; // A bar pressed while stopped gives way to the first bar in play
        this.transport.syncAudioSettings();
        this.engine.start();
        this.state.isPlaying = true;
      }
      this.emit('playback');
      if (this.state.isPlaying) this.startPracticeTimer();
    }).finally(() => {
      this.isStarting = false;
    });
  }

  private startPracticeTimer() {
    this.stopPracticeTimer();
    this.practiceStart = Date.now();
    this.practiceSeconds = 0;
    this.emit('timer');
    this.practiceInterval = setInterval(() => {
      this.practiceSeconds = Math.floor((Date.now() - this.practiceStart) / 1000);
      this.emit('timer');
    }, 1000);
  }

  private stopPracticeTimer() {
    if (this.practiceInterval !== null) clearInterval(this.practiceInterval);
    this.practiceInterval = null;
  }

  // Draws one tick once its sound has left the device
  private onTick(detail: TickDetail) {
    // Ticks still in flight after stop must not restart anything
    if (!this.state.isPlaying) return;
    // The engine may not have taken a shorter pattern yet
    if (detail.beatIndex >= patternLength(this.preset)) return;

    this.lastTick = detail;
    const measureLength = this.preset.measureLength || 16;
    const step = stepInBar(detail.beatIndex, measureLength);

    // A bar pressed during playback holds until here
    const bar = barOfStep(detail.beatIndex, measureLength);
    if (bar !== this.playBar) {
      this.playBar = bar;
      this.viewBar = bar;
      this.emit('grid');
    }

    // Steps only rise within a bar, so anything else is a wrap to the next one
    if (step <= this.position.step) this.position.bar++;
    this.position.step = step;
    this.emit('tick');
  }

  setBpm(bpm: number) {
    this.preset.bpm = bpm;
    this.rampedBpm = null; // The engine now plays this tempo
    if (this.transport.isAudioInit) this.engine.setBpm(bpm);
    this.emit('tempo');
    this.markEdited();
  }

  // The tempo a step starts from: the one a ramp left in the engine, or the preset's
  private get steppingBpm(): number {
    return this.rampedBpm ?? this.preset.bpm;
  }

  // A running Trainer owns the tempo, and a bound stops the step
  canStepBpm(step: TempoStep): boolean {
    return !this.preset.trainerSettings.enabled && steppedBpm(this.steppingBpm, step) !== this.steppingBpm;
  }

  // True when the tempo moved
  stepBpm(step: TempoStep): boolean {
    if (!this.canStepBpm(step)) return false;
    this.setBpm(steppedBpm(this.steppingBpm, step));
    return true;
  }

  // True when the key stepped the tempo, so the page keeps it from the browser. A refused key stays the browser's
  pressTempoKey(key: string, { modifier, target }: { modifier: boolean; target: KeyTarget | null }): boolean {
    if (this.view !== 'stadium' || (target && typesText(target))) return false;
    const step = tempoKeyStep(key, modifier);
    return step !== null && this.stepBpm(step);
  }

  async setClickSound(sound: string) {
    this.clickSound = sound;
    this.prefs.set('clickSound', sound);
    if (this.transport.isAudioInit) {
      try {
        await this.transport.syncClickSound();
      } catch (err) {
        console.error("Failed to sync click sound on selector change:", err);
      }
    }
  }

  setView(mode: ViewMode) {
    this.state.setViewMode(mode);
    this.emit('view');
    if (mode === 'improv') this.improv.loadSelectedTimbre();
  }

  // --- Improv ---

  pressChord(chord: ChordId): Promise<void> {
    return this.improv.pressChord(chord);
  }

  stopChord() {
    this.improv.stopChord();
  }

  setTimbre(name: string) {
    this.improv.setTimbre(name);
  }

  setPadVolume(volume: number) {
    this.improv.setPadVolume(volume);
  }

  // Readies the selected timbre, as opening Improv does
  loadSelectedTimbre(): Promise<void> {
    return this.improv.loadSelectedTimbre();
  }

  // --- Editing ---

  setTimeSignature(num: number, den: number): TimeSignatureResult {
    const sigStr = `${num}/${den}`;
    const measureLength = measureLengthFor(num, den);
    const preset = this.preset;

    // Clamp to 32 steps max
    if (measureLength > 32) return 'too-long';

    if (barCount(preset) > 1) {
      if (sigStr === preset.timeSignature) return 'unchanged';
      if (!this.dialogs.confirm('Changing the time signature keeps only bar 1. Continue?')) return 'declined';
    }

    this.visualScheduler.cancelAll(); // Ticks of the old bar length must not draw on the new one
    const oldLength = preset.measureLength || 16;
    preset.timeSignature = sigStr;
    preset.measureLength = measureLength;
    preset.bars = 1;
    this.viewBar = 0;
    this.playBar = 0;

    // Resize gridData tracks to match the new length
    for (const { id: trackId } of TRACKS) {
      preset.gridData[trackId] = fitBar(preset.gridData[trackId] || [], 0, oldLength, measureLength);
    }

    this.emit('grid');
    this.transport.syncPlaybackSettings();
    this.markEdited();
    return 'changed';
  }

  // Changes one step of the bar on view, or stamps the selected figure over its quarter note
  editStep(trackId: number, step: number) {
    const preset = this.preset;
    const measureLength = preset.measureLength || 16;
    const allSteps = preset.gridData[trackId] ??= new Array(patternLength(preset)).fill(0);
    const trackSteps = barSteps(allSteps, this.viewBar, measureLength);
    if (this.figure) {
      applyFigure(trackSteps, step, this.figure.pattern, measureLength);
    } else {
      trackSteps[step] = nextStepValue(trackId, trackSteps[step]);
    }
    writeBar(allSteps, this.viewBar, measureLength, trackSteps);

    if (this.transport.isAudioInit) this.transport.sendTrack(trackId);
    this.emit('grid');
    this.markEdited();
  }

  selectFigure(figure: Figure | null) {
    this.figure = figure;
  }

  showBar(bar: number) {
    this.viewBar = bar;
    this.emit('grid');
  }

  toggleMute(trackId: number) {
    toggleMute(this.mix, trackId);
    this.sendMix();
  }

  toggleSolo(trackId: number) {
    toggleSolo(this.mix, trackId);
    this.sendMix();
  }

  private sendMix() {
    if (this.transport.isAudioInit) TRACKS.forEach(({ id }) => this.transport.sendTrack(id));
    this.emit('mix');
  }

  // The Trainer form as the user left it, typed or not yet committed
  get trainerFields(): TrainerFields {
    return this.typedTrainer ?? trainerFieldsOf(this.preset.trainerSettings);
  }

  setTrainerFields(fields: TrainerFields) {
    this.typedTrainer = fields;
  }

  // During playback a running Trainer takes the change on beat 1
  setTrainer(settings: TrainerSettings) {
    // A disable keeps the engine's live tempo (syncPlaybackSettings sends no BPM), so steps start from where the ramp got to
    const ramping = this.state.isPlaying && this.preset.trainerSettings.enabled;
    if (settings.enabled) this.rampedBpm = null;
    else if (ramping) this.rampedBpm = this.lastTick ? Number(this.lastTick.currentBpm) : startBpmFor(this.preset);
    this.preset.trainerSettings = settings;
    this.transport.syncPlaybackSettings();
    this.markEdited();
    this.emit('trainer');
  }

  // --- Library ---

  // Loads what the preset selector names. False when a song is declined, so the selector goes back
  loadPreset(value: string): boolean {
    this.selectorValue = value;
    const source = parseSource(value);
    if (source?.kind === 'factory') {
      const preset = factoryPreset(source.id);
      if (preset) this.applyPreset(preset);
    } else if (source?.kind === 'song') {
      const song = findSong(source.id);
      if (song && !this.useSong(song)) {
        this.selectorValue = this.selectedPresetValue;
        return false;
      }
    } else if (source?.kind === 'user') {
      this.state.getAllPresets().then(userPresets => {
        const p = userPresets.find(up => up.id === source.id);
        if (p) this.applyPreset(p);
      });
    }
    return true;
  }

  private applyPreset(storedPreset: StoredPreset) {
    this.visualScheduler.cancelAll(); // Ticks of the previous preset must not overwrite this one
    const preset = completeKit(normalizePreset(storedPreset));
    this.state.activePreset = preset;
    this.rampedBpm = null;
    this.viewBar = 0;
    this.playBar = 0;

    preset.timeSignature = timeSignatureOf(preset);

    this.transport.syncAudioSettings();
    // A pattern of 4 bars starts from its first bar, without touching the pulse
    if (this.transport.isAudioInit && this.state.isPlaying && barCount(preset) > 1) this.engine.restartPattern();

    this.hasUnsavedEdits = false;
    this.selectedPresetValue = this.selectorValue;
    this.typedTrainer = null; // The form now shows this preset's settings
    this.emit('preset');
  }

  // Stores a copy of the pattern under a new name and makes it the active preset
  savePreset(name: string): Promise<void> {
    const id = 'user_' + Date.now();
    const preset = this.preset;
    const newPreset: Preset = {
      id,
      name: name.trim() || 'Custom Preset',
      bpm: preset.bpm,
      timeSignature: preset.timeSignature,
      measureLength: preset.measureLength || 16,
      bars: barCount(preset),
      gridData: JSON.parse(JSON.stringify(preset.gridData)),
      trainerSettings: JSON.parse(JSON.stringify(preset.trainerSettings))
    };

    return this.state.savePreset(newPreset).then(() => {
      this.state.activePreset = newPreset;
      this.hasUnsavedEdits = false;
      this.selectedPresetValue = `user:${id}`;
      this.selectorValue = this.selectedPresetValue;
      this.emit('library');
    });
  }

  userPresets(): Promise<Preset[]> {
    return this.state.getAllPresets();
  }

  isSongLoaded(song: Song): boolean {
    return this.preset.id === song.id;
  }

  // Loads a song unless the user keeps the edits it would replace
  useSong(song: Song): boolean {
    if (this.isSongLoaded(song)) return true;
    if (this.hasUnsavedEdits && !this.dialogs.confirm(`Discard your unsaved changes and load ${song.title}?`)) return false;
    this.selectorValue = `song:${song.id}`;
    this.applyPreset(songToPreset(song));
    return true;
  }

  playSong(song: Song) {
    const loaded = this.isSongLoaded(song);
    if (!this.useSong(song)) return;
    if (loaded || !(this.state.isPlaying || this.isStarting)) this.togglePlay(); // Playing another song carries on at its tempo
  }

  // Writes a groove's drum tracks over the bar on view
  applyGroove(value: string) {
    const source = parseSource(value);
    const activeLen = this.preset.measureLength || 16;

    const applyPattern = (length: number, tracks: Record<number, number[]>) => {
      for (const { id: trackId } of TRACKS.slice(1)) {
        const srcPattern = tracks[trackId] || [];
        const destPattern = new Array(activeLen).fill(0);
        for (let i = 0; i < activeLen; i++) {
          destPattern[i] = srcPattern[i % length] || 0;
        }
        writeBar(this.preset.gridData[trackId] ??= [], this.viewBar, activeLen, destPattern);
      }
      this.emit('grid');
      this.transport.syncPlaybackSettings();
      this.markEdited();
    };

    if (source?.kind === 'factory') {
      const g = factoryGroove(source.id);
      if (g) applyPattern(g.length, g.tracks);
    } else if (source?.kind === 'user') {
      this.state.getAllGrooves().then(grooves => {
        const g = grooves.find(ug => ug.id === source.id);
        if (g) applyPattern(g.measureLength, g.gridData);
      });
    }
  }

  // Stores the drum tracks of the bar on view as a groove
  saveGroove(name: string): Promise<void> {
    const activeLen = this.preset.measureLength || 16;
    const gridData: Record<number, number[]> = {};
    for (const { id: trackId } of TRACKS.slice(1)) {
      gridData[trackId] = fitBar(this.preset.gridData[trackId] || [], this.viewBar, activeLen, activeLen);
    }

    const id = 'groove_' + Date.now();
    const newGroove: CustomGroove = { id, name, gridData, measureLength: activeLen };
    return this.state.saveGroove(newGroove);
  }

  userGrooves(): Promise<CustomGroove[]> {
    return this.state.getAllGrooves();
  }
}
