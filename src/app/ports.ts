import type { TrainerSettings } from '../domain/preset';
import type { PreferenceStore } from '../storage/preferences';

// What the Session asks of the audio engine: the methods of MetronomeNode it calls, and its ticks
export interface EnginePort {
  init(wasmUrl: string, workletUrl: string): Promise<void>;
  resumeContext(): Promise<void>;
  start(): void;
  stop(): void;
  setBpm(bpm: number): void;
  setMeasureLength(length: number): void;
  setBars(bars: number): void;
  restartPattern(): void;
  updateGrid(trackId: number, steps: Uint8Array): void;
  setTrainer(settings: TrainerSettings): void;
  replaceTrainer(settings: TrainerSettings): void;
  loadSample(sampleId: number, audioUrl: string): Promise<void>;
  loadTake(trackId: number, dynamic: number, take: number, audioUrl: string, trim: number): Promise<void>;
  setClickMode(mode: number): void;
  padPlay(notes: number[], timbre: number): void;
  padStop(): void;
  padVolume(volume: number): void;
  padLoadBegin(timbre: number): void;
  padLoadEnd(timbre: number): void;
  padLoad(timbre: number, key: number, url: string, loopStart: number, loopEnd: number): Promise<void>;
  sampleRate(): number;
  visualDelayMs(): number;
  addEventListener(type: 'tick', listener: (event: Event) => void): void;
}

// The questions a rule asks the user, answered by the page
export interface Dialogs {
  confirm(message: string): boolean;
}

export type Preferences = PreferenceStore;

export type SessionChange = 'preset' | 'tempo' | 'grid' | 'playback' | 'tick' | 'mix' | 'edits' | 'view' | 'improv' | 'library';
