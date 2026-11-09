import { PAD_TIMBRES, nextChord, parseTimbre, parseVolume, timbreNotes, type ChordId, type PadFile } from '../domain/chords';
import type { EnginePort, Preferences } from './ports';

// What Improv asks of the Session it serves
export interface ImprovHost {
  asset(path: string): string; // A path from the site root, as the engine must fetch it
  startEngine(): Promise<void>;
  sendPadVolume(): void;
  changed(): void;
}

// The Pad: which chord sounds, in which timbre and how loud, and the timbre files it loads one by one
export class Improv {
  // What the engine holds, which is what the screen shows
  soundingChord: ChordId | null = null;
  // Where the clicks lead, ahead of soundingChord while the engine starts, so the last click wins
  private clickedChord: ChordId | null = null;
  private audioFailed = false;
  selectedChord: ChordId = { root: 0, type: 0 }; // What a click on a root or type keeps the other half of
  timbre: string; // The selected timbre's name
  padVolume: number; // 0 to 100

  // Per timbre: every file at first, then only the ones that failed
  private padLoads = PAD_TIMBRES.map(({ files }) => ({ toLoad: files, failed: 0, isLoading: false }));
  private padLoadQueue = Promise.resolve();

  constructor(private engine: EnginePort, private prefs: Preferences, private host: ImprovHost) {
    this.timbre = PAD_TIMBRES[parseTimbre(prefs.get('padTimbre'))].name;
    this.padVolume = parseVolume(prefs.get('padVolume'));
  }

  private async engineReady(): Promise<boolean> {
    try {
      await this.host.startEngine();
      this.audioFailed = false;
      return true;
    } catch {
      this.audioFailed = true;
      return false;
    }
  }

  private selectedTimbre() {
    return parseTimbre(this.timbre);
  }

  private playChord({ root, type }: ChordId) {
    this.engine.padPlay(timbreNotes(root, type, this.selectedTimbre()), this.selectedTimbre());
  }

  private settleChord() {
    if (this.clickedChord !== this.soundingChord) {
      this.soundingChord = this.clickedChord;
      if (this.soundingChord) this.playChord(this.soundingChord);
      else this.engine.padStop();
    }
    this.host.changed();
  }

  async pressChord(chord: ChordId) {
    this.engine.resumeContext(); // A browser only honours it within the click
    this.selectedChord = chord;
    this.clickedChord = nextChord(this.clickedChord, chord);
    this.host.changed();
    if (!(await this.engineReady())) this.clickedChord = null;
    this.settleChord();
  }

  stopChord() {
    this.clickedChord = null;
    this.settleChord();
  }

  // One file at a time across the timbres, so no audio block carries more than one copy
  private loadTimbre(timbre: number) {
    const load = this.padLoads[timbre];
    if (load.isLoading) return;
    load.isLoading = true;
    this.padLoadQueue = this.padLoadQueue.then(async () => {
      const failed: PadFile[] = [];
      this.engine.padLoadBegin(timbre);
      for (const file of load.toLoad) {
        const url = this.host.asset(file.url);
        try {
          await this.engine.padLoad(timbre, file.key, url, file.loopStart, file.loopEnd);
        } catch (err) {
          console.error(`Failed to load ${url}:`, err);
          failed.push(file);
        }
      }
      this.engine.padLoadEnd(timbre);
      load.toLoad = failed;
      load.failed = failed.length;
      load.isLoading = false;
      this.host.changed();
    });
  }

  // Makes no sound, and leaves the kit to Play
  async loadSelectedTimbre() {
    if (await this.engineReady()) this.loadTimbre(this.selectedTimbre());
    this.host.changed();
  }

  // The engine crossfades to the same chord in the new timbre. With no chord, the next one takes it
  setTimbre(name: string) {
    this.timbre = name;
    this.prefs.set('padTimbre', name);
    if (this.soundingChord) this.playChord(this.soundingChord);
    this.loadSelectedTimbre();
  }

  setPadVolume(volume: number) {
    this.padVolume = volume;
    this.prefs.set('padVolume', String(volume));
    this.host.sendPadVolume();
  }

  notice(): string {
    if (this.audioFailed) return 'Audio unavailable';
    const timbre = this.selectedTimbre();
    const { failed } = this.padLoads[timbre];
    if (failed === 0) return '';
    return failed === PAD_TIMBRES[timbre].files.length ? 'Samples unavailable · synth only' : 'Some samples unavailable';
  }
}
