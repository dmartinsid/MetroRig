// Interfaces for exports inside WASM
interface WasmEngineExports {
  memory: WebAssembly.Memory;
  engine_new(sampleRate: number): number;
  engine_free(ptr: number): void;
  engine_start(ptr: number): void;
  engine_stop(ptr: number): void;
  engine_set_bpm(ptr: number, bpm: number): void;
  engine_set_measure_length(ptr: number, length: number): void;
  engine_load_sample(ptr: number, sampleId: number, leftPtr: number, rightPtr: number, length: number): void;
  engine_update_grid(ptr: number, sampleId: number, stepsPtr: number, length: number): void;
  engine_set_trainer(
    ptr: number,
    enabled: number,
    startBpm: number,
    targetBpm: number,
    increment: number,
    stepType: number,
    stepValue: number,
    curveType: number
  ): void;
  engine_replace_trainer: WasmEngineExports['engine_set_trainer'];
  engine_get_tick(ptr: number, bpmPtr: number): number;
  engine_process(ptr: number, outL: number, outR: number, length: number): void;
  engine_alloc(size: number): number;
  engine_free_buf(ptr: number, size: number): void;
  engine_set_click_mode(ptr: number, mode: number): void;
}

class MetronomeProcessor extends AudioWorkletProcessor {
  private enginePtr: number = 0;
  private wasmExports?: WasmEngineExports;
  
  // Shared heap memory pointers
  private outLBufferPtr: number = 0;
  private outRBufferPtr: number = 0;
  private bpmPtr: number = 0;
  private bufferLength: number = 128; // Standard AudioWorklet block size

  // Heap views reused across audio blocks, valid while heapBuffer is the WASM buffer
  private heapBuffer?: ArrayBufferLike;
  private outLView = new Float32Array(0);
  private outRView = new Float32Array(0);
  private heapDouble = new Float64Array(0);

  // Local mirror of the grid data for computing activeTrackIds on tick
  private gridMirror: number[][] = [
    new Array(32).fill(0),
    new Array(32).fill(0),
    new Array(32).fill(0),
    new Array(32).fill(0),
  ];

  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
    this.port.start();
  }

  private handleMessage(event: MessageEvent) {
    const msg = event.data;
    if (msg.type === 'INIT_WASM') {
      WebAssembly.instantiate(msg.wasmBuffer, {})
        .then((result) => {
          this.wasmExports = result.instance.exports as unknown as WasmEngineExports;
          this.initializeEngine();
        })
        .catch((err) => {
          console.error("MetronomeProcessor: WebAssembly instantiation FAILED:", err);
          this.port.postMessage({ type: 'WASM_ERROR', error: err.toString() });
        });
    } else if (this.wasmExports && this.enginePtr !== 0) {
      this.processCommand(msg);
    }
  }

  private initializeEngine() {
    if (!this.wasmExports) {
      console.error("MetronomeProcessor: cannot initializeEngine, wasmExports is missing");
      return;
    }
    
    // Instantiate engine in Rust
    this.enginePtr = this.wasmExports.engine_new(sampleRate);
    
    // Allocate outputs and state buffers
    const floatSize = 4;
    const bytesNeeded = this.bufferLength * floatSize;
    this.outLBufferPtr = this.wasmExports.engine_alloc(bytesNeeded);
    this.outRBufferPtr = this.wasmExports.engine_alloc(bytesNeeded);
    this.bpmPtr = this.wasmExports.engine_alloc(8); // f64 is 8 bytes

    // Notify main thread that engine is initialized
    this.port.postMessage({ type: 'WASM_READY' });
  }

  private processCommand(msg: any) {
    if (!this.wasmExports || this.enginePtr === 0) return;

    const exports = this.wasmExports;
    switch (msg.type) {
      case 'START':
        exports.engine_start(this.enginePtr);
        break;
      case 'STOP':
        exports.engine_stop(this.enginePtr);
        break;
      case 'SET_BPM':
        exports.engine_set_bpm(this.enginePtr, msg.bpm);
        break;
      case 'SET_MEASURE_LENGTH':
        exports.engine_set_measure_length(this.enginePtr, msg.length);
        break;
      case 'UPDATE_GRID': {
        const { trackId, steps } = msg;
        const length = 32;
        
        // Padded to 32 steps for Rust engine compatibility
        const paddedSteps = new Uint8Array(32);
        paddedSteps.set(steps.subarray(0, Math.min(steps.length, 32)));

        this.gridMirror[trackId] = Array.from(paddedSteps);

        const ptr = exports.engine_alloc(length);
        const heap = new Uint8Array(exports.memory.buffer);
        heap.set(paddedSteps, ptr);
        
        exports.engine_update_grid(this.enginePtr, trackId, ptr, length);
        exports.engine_free_buf(ptr, length);
        break;
      }
      case 'LOAD_SAMPLE': {
        const { sampleId, leftChannel, rightChannel } = msg;
        const length = leftChannel.length;
        const floatSize = 4;
        const byteLength = length * floatSize;
        
        // Allocate transfer buffers
        const ptrL = exports.engine_alloc(byteLength);
        const ptrR = exports.engine_alloc(byteLength);
        
        const heapFloat = new Float32Array(exports.memory.buffer);
        heapFloat.set(leftChannel, ptrL / floatSize);
        heapFloat.set(rightChannel, ptrR / floatSize);

        exports.engine_load_sample(this.enginePtr, sampleId, ptrL, ptrR, length);
        
        // Free transfer buffers immediately
        exports.engine_free_buf(ptrL, byteLength);
        exports.engine_free_buf(ptrR, byteLength);
        break;
      }
      case 'SET_TRAINER':
        this.sendTrainer(exports.engine_set_trainer, msg);
        break;
      case 'REPLACE_TRAINER':
        this.sendTrainer(exports.engine_replace_trainer, msg);
        break;
      case 'SET_CLICK_MODE':
        exports.engine_set_click_mode(this.enginePtr, msg.mode);
        break;
    }
  }

  private sendTrainer(update: WasmEngineExports['engine_set_trainer'], msg: any) {
    update(
      this.enginePtr,
      msg.enabled ? 1 : 0,
      msg.startBpm,
      msg.targetBpm,
      msg.increment,
      msg.stepType === 'measures' ? 0 : 1,
      msg.stepValue,
      msg.curve === 'stepped' ? 0 : 1
    );
  }

  private rebuildHeapViews(buffer: ArrayBufferLike) {
    this.heapBuffer = buffer;
    const heapFloat = new Float32Array(buffer);
    this.outLView = heapFloat.subarray(this.outLBufferPtr / 4, (this.outLBufferPtr / 4) + this.bufferLength);
    this.outRView = heapFloat.subarray(this.outRBufferPtr / 4, (this.outRBufferPtr / 4) + this.bufferLength);
    this.heapDouble = new Float64Array(buffer);
  }

  override process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    if (!this.wasmExports || this.enginePtr === 0) return true;

    const exports = this.wasmExports;
    
    // Process audio through Rust engine
    exports.engine_process(this.enginePtr, this.outLBufferPtr, this.outRBufferPtr, this.bufferLength);

    // Read audio data from WASM heap. Growing the memory replaces its buffer
    if (exports.memory.buffer !== this.heapBuffer) {
      this.rebuildHeapViews(exports.memory.buffer);
    }

    // Copy outputs to the browser sound card channel outputs
    const output = outputs[0];
    if (output && output[0] && output[1]) {
      output[0].set(this.outLView);
      output[1].set(this.outRView);
    }

    // Check for timing tick event
    const tickIndex = exports.engine_get_tick(this.enginePtr, this.bpmPtr);
    if (tickIndex >= 0) {
      const bpm = this.heapDouble[this.bpmPtr / 8];

      // Determine which tracks have a step active at this beat
      const activeTrackIds: number[] = [];
      for (let t = 0; t < 4; t++) {
        if ((this.gridMirror[t][tickIndex] ?? 0) > 0) {
          activeTrackIds.push(t);
        }
      }

      this.port.postMessage({
        type: 'TICK',
        beatIndex: tickIndex,
        currentBpm: bpm,
        activeTrackIds,
      });
    }

    return true;
  }
}

registerProcessor('metronome-processor', MetronomeProcessor);
