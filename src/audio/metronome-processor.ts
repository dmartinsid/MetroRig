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
  engine_get_tick(ptr: number, bpmPtr: number): number;
  engine_process(ptr: number, outL: number, outR: number, length: number): void;
  engine_alloc(size: number): number;
  engine_free_buf(ptr: number, size: number): void;
}

class MetronomeProcessor extends AudioWorkletProcessor {
  private enginePtr: number = 0;
  private wasmExports?: WasmEngineExports;
  
  // Shared heap memory pointers
  private outLBufferPtr: number = 0;
  private outRBufferPtr: number = 0;
  private bpmPtr: number = 0;
  private bufferLength: number = 128; // Standard AudioWorklet block size

  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
    this.port.start();
  }

  private handleMessage(event: MessageEvent) {
    const msg = event.data;
    console.log("MetronomeProcessor: handleMessage received type:", msg.type);
    if (msg.type === 'INIT_WASM') {
      console.log("MetronomeProcessor: starting WebAssembly.instantiate with ArrayBuffer...");
      WebAssembly.instantiate(msg.wasmBuffer, {})
        .then((result) => {
          console.log("MetronomeProcessor: WebAssembly instantiated successfully!");
          this.wasmExports = result.instance.exports as unknown as WasmEngineExports;
          this.initializeEngine();
        })
        .catch((err) => {
          console.error("MetronomeProcessor: WebAssembly instantiation FAILED:", err);
          this.port.postMessage({ type: 'WASM_ERROR', error: err.toString() });
        });
    } else if (this.wasmExports && this.enginePtr !== 0) {
      this.processCommand(msg);
    } else {
      console.log("MetronomeProcessor: message ignored because engine is not initialized yet:", msg.type);
    }
  }

  private initializeEngine() {
    if (!this.wasmExports) {
      console.error("MetronomeProcessor: cannot initializeEngine, wasmExports is missing");
      return;
    }
    
    console.log("MetronomeProcessor: initializing Rust engine...");
    // Instantiate engine in Rust
    this.enginePtr = this.wasmExports.engine_new(sampleRate);
    console.log("MetronomeProcessor: Rust engine created at pointer:", this.enginePtr);
    
    // Allocate outputs and state buffers
    const floatSize = 4;
    const bytesNeeded = this.bufferLength * floatSize;
    this.outLBufferPtr = this.wasmExports.engine_alloc(bytesNeeded);
    this.outRBufferPtr = this.wasmExports.engine_alloc(bytesNeeded);
    this.bpmPtr = this.wasmExports.engine_alloc(8); // f64 is 8 bytes
    console.log("MetronomeProcessor: engine buffers allocated.");

    // Notify main thread that engine is initialized
    console.log("MetronomeProcessor: sending WASM_READY...");
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
        const length = steps.length;
        
        // Allocate buffer, copy data, and update grid
        const ptr = exports.engine_alloc(length);
        const heap = new Uint8Array(exports.memory.buffer);
        heap.set(steps, ptr);
        
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
      case 'SET_TRAINER': {
        exports.engine_set_trainer(
          this.enginePtr,
          msg.enabled ? 1 : 0,
          msg.startBpm,
          msg.targetBpm,
          msg.increment,
          msg.stepType === 'measures' ? 0 : 1,
          msg.stepValue,
          msg.curve === 'stepped' ? 0 : 1
        );
        break;
      }
    }
  }

  override process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    if (!this.wasmExports || this.enginePtr === 0) return true;

    const exports = this.wasmExports;
    
    // Process audio through Rust engine
    exports.engine_process(this.enginePtr, this.outLBufferPtr, this.outRBufferPtr, this.bufferLength);

    // Read audio data from WASM heap
    const heapFloat = new Float32Array(exports.memory.buffer);
    const outL = heapFloat.subarray(this.outLBufferPtr / 4, (this.outLBufferPtr / 4) + this.bufferLength);
    const outR = heapFloat.subarray(this.outRBufferPtr / 4, (this.outRBufferPtr / 4) + this.bufferLength);

    // Copy outputs to the browser sound card channel outputs
    const output = outputs[0];
    if (output && output[0] && output[1]) {
      output[0].set(outL);
      output[1].set(outR);
    }

    // Check for timing tick event
    const tickIndex = exports.engine_get_tick(this.enginePtr, this.bpmPtr);
    if (tickIndex >= 0) {
      const heapDouble = new Float64Array(exports.memory.buffer);
      const bpm = heapDouble[this.bpmPtr / 8];
      this.port.postMessage({
        type: 'TICK',
        beatIndex: tickIndex,
        currentBpm: bpm
      });
    }

    return true;
  }
}

registerProcessor('metronome-processor', MetronomeProcessor);
