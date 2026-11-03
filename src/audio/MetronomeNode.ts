import { visualDelayMs } from '../visualSync';
import type { TrainerSettings } from '../state';

export interface TickDetail {
  beatIndex: number;
  currentBpm: number;
  activeTrackIds: number[];
}

export class MetronomeNode extends EventTarget {
  private ctx: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private wasmModule: WebAssembly.Module | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    super();
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 44100
    });
  }

  async init(wasmUrl: string, workletUrl: string): Promise<void> {
    if (this.isInitialized) {
      console.log("MetronomeNode: Already initialized");
      return;
    }
    if (this.initPromise) {
      console.log("MetronomeNode: Initialization already in progress, returning promise");
      return this.initPromise;
    }

    console.log("MetronomeNode: Starting initialization. WASM URL:", wasmUrl, "Worklet URL:", workletUrl);
    this.initPromise = new Promise<void>(async (resolve, reject) => {
      try {
        // 1. Fetch WASM binary as ArrayBuffer
        console.log("MetronomeNode: Fetching WASM...");
        const wasmFetch = await fetch(wasmUrl);
        console.log("MetronomeNode: Fetch completed. Status:", wasmFetch.status);
        if (!wasmFetch.ok) {
          throw new Error(`Failed to fetch WASM binary: ${wasmFetch.statusText}`);
        }
        const wasmBuffer = await wasmFetch.arrayBuffer();
        console.log("MetronomeNode: WASM fetched successfully. Bytes:", wasmBuffer.byteLength);

        // 2. Load the AudioWorklet script
        console.log("MetronomeNode: Adding AudioWorklet module...");
        await this.ctx.audioWorklet.addModule(workletUrl);
        console.log("MetronomeNode: AudioWorklet module added.");

        // 3. Create AudioWorkletNode
        this.workletNode = new AudioWorkletNode(this.ctx, 'metronome-processor', {
          outputChannelCount: [2]
        });
        console.log("MetronomeNode: AudioWorkletNode created.");

        // Monitor processor errors
        this.workletNode.onprocessorerror = (event) => {
          console.error("MetronomeNode: Processor error occurred inside AudioWorklet:", event);
        };

        // 4. Connect node to audio output destination
        this.workletNode.connect(this.ctx.destination);
        console.log("MetronomeNode: Connected to AudioContext destination.");

        // 5. Listen for events
        this.workletNode.port.onmessage = (event) => {
          const msg = event.data;
          if (msg.type === 'WASM_READY') {
            this.isInitialized = true;
            resolve();
          } else if (msg.type === 'WASM_ERROR') {
            console.error("MetronomeNode: WASM error reported from worklet:", msg.error);
            this.initPromise = null;
            reject(new Error(msg.error));
          } else if (msg.type === 'TICK') {
            this.dispatchEvent(new CustomEvent('tick', { detail: msg }));
          }
        };
        this.workletNode.port.start();

        // 6. Initialize WASM in the processor thread (transfer ownership of ArrayBuffer)
        this.workletNode.port.postMessage({
          type: 'INIT_WASM',
          wasmBuffer: wasmBuffer
        }, [wasmBuffer]);
      } catch (err) {
        console.error("MetronomeNode: Initialization failed with error:", err);
        this.initPromise = null;
        reject(err);
      }
    });

    return this.initPromise;
  }

  async resumeContext() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  start() {
    this.resumeContext();
    this.workletNode?.port.postMessage({ type: 'START' });
  }

  stop() {
    this.workletNode?.port.postMessage({ type: 'STOP' });
  }

  setBpm(bpm: number) {
    this.workletNode?.port.postMessage({ type: 'SET_BPM', bpm });
  }

  setMeasureLength(length: number) {
    this.workletNode?.port.postMessage({ type: 'SET_MEASURE_LENGTH', length });
  }

  restartPattern() {
    this.workletNode?.port.postMessage({ type: 'RESTART_PATTERN' });
  }

  setBars(bars: number) {
    this.workletNode?.port.postMessage({ type: 'SET_BARS', bars });
  }

  updateGrid(trackId: number, steps: Uint8Array) {
    this.workletNode?.port.postMessage({ type: 'UPDATE_GRID', trackId, steps });
  }

  setTrainer(settings: TrainerSettings) {
    this.workletNode?.port.postMessage({ type: 'SET_TRAINER', ...settings });
  }

  replaceTrainer(settings: TrainerSettings) {
    this.workletNode?.port.postMessage({ type: 'REPLACE_TRAINER', ...settings });
  }

  private async decode(audioUrl: string) {
    return this.decodeResponse(await fetch(audioUrl));
  }

  private async decodeResponse(response: Response) {
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.numberOfChannels > 1 
      ? audioBuffer.getChannelData(1) 
      : leftChannel; // Fallback to mono
    return { leftChannel, rightChannel };
  }

  async loadSample(sampleId: number, audioUrl: string) {
    const { leftChannel, rightChannel } = await this.decode(audioUrl);

    this.workletNode?.port.postMessage({
      type: 'LOAD_SAMPLE',
      sampleId,
      leftChannel,
      rightChannel
    });
  }

  // The engine stores the take as sent, so the trim is multiplied in here
  async loadTake(trackId: number, dynamic: number, take: number, audioUrl: string, trim: number) {
    const decoded = await this.decode(audioUrl);
    const leftChannel = decoded.leftChannel.map(sample => sample * trim);
    const rightChannel = decoded.rightChannel === decoded.leftChannel
      ? leftChannel
      : decoded.rightChannel.map(sample => sample * trim);

    this.workletNode?.port.postMessage({
      type: 'LOAD_TAKE',
      trackId,
      dynamic,
      take,
      leftChannel,
      rightChannel
    });
  }

  setClickMode(mode: number) {
    this.workletNode?.port.postMessage({ type: 'SET_CLICK_MODE', mode });
  }

  padPlay(notes: number[], timbre: number) {
    this.workletNode?.port.postMessage({ type: 'PAD_PLAY', notes, timbre });
  }

  padStop() {
    this.workletNode?.port.postMessage({ type: 'PAD_STOP' });
  }

  padVolume(volume: number) {
    this.workletNode?.port.postMessage({ type: 'PAD_VOLUME', volume });
  }

  // A timbre's files reach its notes only once padLoadEnd follows them, whether or not some failed
  padLoadBegin(timbre: number) {
    this.workletNode?.port.postMessage({ type: 'PAD_LOAD_BEGIN', timbre });
  }

  padLoadEnd(timbre: number) {
    this.workletNode?.port.postMessage({ type: 'PAD_LOAD_END', timbre });
  }

  // Loop points are frames of the 44.1 kHz file, and decoding converts it to the context's rate.
  // Rejects when the file fails, so the caller can log it and use the nearest file.
  async padLoad(timbre: number, key: number, url: string, loopStart: number, loopEnd: number) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    const { leftChannel, rightChannel } = await this.decodeResponse(response);
    const scale = this.ctx.sampleRate / 44100;

    this.workletNode?.port.postMessage({
      type: 'PAD_LOAD',
      timbre,
      key,
      loopStart: Math.round(loopStart * scale),
      loopEnd: Math.round(loopEnd * scale),
      leftChannel,
      rightChannel
    });
  }

  sampleRate(): number {
    return this.ctx.sampleRate;
  }

  visualDelayMs(): number {
    return visualDelayMs(this.ctx.baseLatency, this.ctx.outputLatency);
  }
}
