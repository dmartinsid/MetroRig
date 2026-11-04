import { TRACKS, takesOf } from '../domain/kit';
import { audibleSteps, type TrackMix } from '../domain/mix';
import { barCount, patternLength } from '../domain/pattern';
import { startBpmFor, type Preset } from '../domain/preset';
import type { EnginePort } from './ports';

// What the transport reads from the Session it serves
export interface TransportHost {
  preset(): Preset;
  mix: TrackMix;
  clickSound(): string;
  padVolume(): number; // 0 to 100
}

// Engine start-up, the kit and the click, and every message that keeps the engine in step with the preset
export class Transport {
  // Runs once; a failure clears it, so the next use retries
  private enginePromise: Promise<void> | null = null;
  isAudioInit = false;
  private activeClickLoadId = 0;

  constructor(
    private engine: EnginePort,
    private urls: { wasmUrl: string; workletUrl: string },
    private host: TransportHost,
  ) {}

  startEngine(): Promise<void> {
    this.enginePromise ??= this.launchEngine().catch(err => {
      this.enginePromise = null;
      throw err;
    });
    return this.enginePromise;
  }

  private async launchEngine() {
    await this.engine.init(this.urls.wasmUrl, this.urls.workletUrl);
    this.sendPadVolume();
  }

  // The slider runs from 0 to 100, the engine from 0 to 1
  sendPadVolume() {
    this.engine.padVolume(this.host.padVolume() / 100);
  }

  // A file that fails leaves its hit to the next loaded take, or its track silent, and the rest of the kit playing
  private async loadKit() {
    const loads: { url: string; load: Promise<void> }[] = [];
    for (const track of TRACKS) {
      if (track.sample) loads.push({ url: track.sample, load: this.engine.loadSample(track.id, track.sample) });
      if (track.bank) {
        for (const { dynamic, take, url } of takesOf(track)) {
          loads.push({ url, load: this.engine.loadTake(track.id, dynamic, take, url, track.bank.trim) });
        }
      }
    }
    const results = await Promise.allSettled(loads.map(({ load }) => load));
    results.forEach((result, i) => {
      if (result.status === 'rejected') console.error(`Failed to load ${loads[i].url}:`, result.reason);
    });
  }

  async initAudio() {
    if (this.isAudioInit) return;
    await this.startEngine();

    await this.loadKit();

    this.isAudioInit = true;
    await this.syncClickSound(); // Wait for click sound loading
    this.syncAudioSettings();
  }

  // Sends the start tempo, so it runs only on Play and preset load
  syncAudioSettings() {
    if (!this.isAudioInit) return;

    this.engine.setBpm(startBpmFor(this.host.preset()));
    this.syncMeterAndGrid();
    this.engine.replaceTrainer(this.trainerSettings()); // Applies now
  }

  // Sends everything but BPM, so a change during playback keeps the live tempo.
  // A running Trainer takes the change on beat 1.
  syncPlaybackSettings() {
    if (!this.isAudioInit) return;

    this.syncMeterAndGrid();
    this.engine.setTrainer(this.trainerSettings());
  }

  private trainerSettings() {
    return { ...this.host.preset().trainerSettings };
  }

  private syncMeterAndGrid() {
    const preset = this.host.preset();
    this.engine.setMeasureLength(preset.measureLength || 16);
    this.engine.setBars(barCount(preset));

    TRACKS.forEach(track => this.sendTrack(track.id));
  }

  // The one path to the engine: silenced tracks play an empty grid, the preset keeps its steps
  sendTrack(trackId: number) {
    const preset = this.host.preset();
    const steps = preset.gridData[trackId] || new Array(patternLength(preset)).fill(0);
    this.engine.updateGrid(trackId, audibleSteps(this.host.mix, trackId, steps));
  }

  async syncClickSound() {
    if (!this.isAudioInit) return;
    const sound = this.host.clickSound();
    if (sound === 'digital') {
      this.activeClickLoadId++;
      this.engine.setClickMode(0);
    } else {
      const loadId = ++this.activeClickLoadId;
      try {
        await this.engine.loadSample(0, `/${sound}.wav`);
        if (loadId === this.activeClickLoadId) {
          this.engine.setClickMode(1);
        }
      } catch (err) {
        console.error("Failed to load click sample, falling back to digital synth:", err);
        if (loadId === this.activeClickLoadId) {
          this.engine.setClickMode(0);
        }
      }
    }
  }
}
