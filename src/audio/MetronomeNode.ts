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

  updateGrid(trackId: number, steps: Uint8Array) {
    this.workletNode?.port.postMessage({ type: 'UPDATE_GRID', trackId, steps });
  }

  setTrainer(settings: TrainerSettings) {
    this.workletNode?.port.postMessage({ type: 'SET_TRAINER', ...settings });
  }

  replaceTrainer(settings: TrainerSettings) {
    this.workletNode?.port.postMessage({ type: 'REPLACE_TRAINER', ...settings });
  }

  async loadSample(sampleId: number, audioUrl: string) {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.numberOfChannels > 1 
      ? audioBuffer.getChannelData(1) 
      : leftChannel; // Fallback to mono

    this.workletNode?.port.postMessage({
      type: 'LOAD_SAMPLE',
      sampleId,
      leftChannel,
      rightChannel
    });
  }

  setClickMode(mode: number) {
    this.workletNode?.port.postMessage({ type: 'SET_CLICK_MODE', mode });
  }

  visualDelayMs(): number {
    return visualDelayMs(this.ctx.baseLatency, this.ctx.outputLatency);
  }
}
