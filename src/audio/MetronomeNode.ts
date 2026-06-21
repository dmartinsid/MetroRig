export class MetronomeNode extends EventTarget {
  private ctx: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private wasmModule: WebAssembly.Module | null = null;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 44100
    });
  }

  async init(wasmUrl: string, workletUrl: string) {
    if (this.isInitialized) return;

    // 1. Compile WASM binary streaming
    const wasmFetch = await fetch(wasmUrl);
    const wasmBuffer = await wasmFetch.arrayBuffer();
    this.wasmModule = await WebAssembly.compile(wasmBuffer);

    // 2. Load the AudioWorklet script
    await this.ctx.audioWorklet.addModule(workletUrl);

    // 3. Create AudioWorkletNode
    this.workletNode = new AudioWorkletNode(this.ctx, 'metronome-processor', {
      outputChannelCount: [2]
    });

    // 4. Initialize WASM in the processor thread
    this.workletNode.port.postMessage({
      type: 'INIT_WASM',
      module: this.wasmModule
    });

    // 5. Connect node to audio output destination
    this.workletNode.connect(this.ctx.destination);

    // 6. Listen for tick events from processor
    this.workletNode.port.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === 'TICK') {
        this.dispatchEvent(new CustomEvent('tick', { detail: msg }));
      }
    };

    this.isInitialized = true;
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

  updateGrid(trackId: number, steps: Uint8Array) {
    this.workletNode?.port.postMessage({ type: 'UPDATE_GRID', trackId, steps });
  }

  setTrainer(settings: {
    enabled: boolean;
    startBpm: number;
    targetBpm: number;
    increment: number;
    stepType: 'measures' | 'seconds';
    stepValue: number;
    curve: 'stepped' | 'smooth';
  }) {
    this.workletNode?.port.postMessage({
      type: 'SET_TRAINER',
      ...settings
    });
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
}
