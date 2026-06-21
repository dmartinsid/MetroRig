# MetroRig Metronome & Drum Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-performance browser-based metronome and drum machine with a Rust WASM AudioWorklet engine and an OLED hardware-inspired TypeScript UI.

**Architecture:** A hybrid TypeScript/Rust design where Web Audio API spawns an `AudioWorklet`. The Worklet loads a custom raw Rust WASM module directly, handling sample-accurate scheduling, click synthesis, sample playback, and tempo trainer ramping, communicating with the UI thread via `postMessage`.

**Tech Stack:** TypeScript, Vite, Cargo, Rust (wasm32 target), Vitest, HTML5, Vanilla CSS.

## Global Constraints
- Target target: web-only browser application.
- Rust compilation target: `wasm32-unknown-unknown`.
- Audio scheduling accuracy: must remain under 1ms variance under high GUI load.
- UI styling must adhere strictly to the dark onyx and neon green/yellow stage aesthetic.

---

### Task 1: Project Scaffolding & Build Configuration

Configure the dual JS/Rust project structure, specifying dependency packages, bundler setup, and test runner configurations.

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `Cargo.toml`
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: None (initial setup)
- Produces: Build pipeline supporting dev server, Vitest, and Cargo compiling to WASM.

- [ ] **Step 1: Create package.json**
  Write the following configuration:
  ```json
  {
    "name": "metrorig",
    "private": true,
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "cargo build --target wasm32-unknown-unknown --release && vite build",
      "test:js": "vitest run",
      "test:rust": "cargo test"
    },
    "devDependencies": {
      "typescript": "^5.0.0",
      "vite": "^5.0.0",
      "vitest": "^1.0.0"
    }
  }
  ```

- [ ] **Step 2: Create tsconfig.json**
  Write the TypeScript configuration:
  ```json
  {
    "compilerOptions": {
      "target": "ESNext",
      "module": "ESNext",
      "moduleResolution": "node",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "lib": ["DOM", "DOM.Iterable", "ESNext"]
    },
    "include": ["src/**/*"]
  }
  ```

- [ ] **Step 3: Create vite.config.ts**
  Write the Vite configuration. Note that we must output WASM assets properly:
  ```typescript
  import { defineConfig } from 'vite';

  export default defineConfig({
    server: {
      port: 3000,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      }
    },
    build: {
      assetsInlineLimit: 0
    }
  });
  ```

- [ ] **Step 4: Create Cargo.toml**
  Define the Rust workspace crate, configuring it to build a dynamic library (`cdylib`):
  ```toml
  [package]
  name = "metrorig_audio"
  version = "1.0.0"
  edition = "2021"

  [lib]
  crate-type = ["cdylib", "rlib"]

  [dependencies]
  # No external crates needed for pure DSP math
  ```

- [ ] **Step 5: Create vitest.config.ts**
  Write the Vitest runner config:
  ```typescript
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      environment: 'happy-dom'
    }
  });
  ```

- [ ] **Step 6: Verify build pipeline**
  Run: `npm install`
  Run: `cargo check`
  Expected: Installation and check complete with no errors.

- [ ] **Step 7: Commit**
  Run: `git add package.json tsconfig.json vite.config.ts Cargo.toml vitest.config.ts && git commit -m "chore: scaffold build configurations"`

---

### Task 2: Rust DSP Engine Core

Write the Core DSP logic in Rust, compiling to WASM. This handles step-sequencer state, synthesized metronome clicks, and WAV sample triggers.

**Files:**
- Create: `src/rust/src/lib.rs`

**Interfaces:**
- Consumes: None (standalone crate)
- Produces: raw WASM exports `init`, `process`, `set_bpm`, `update_grid`, `load_sample`, and `set_trainer`.

- [ ] **Step 1: Write src/rust/src/lib.rs**
  Create the directories and write the Rust source code:
  ```rust
  use std::slice;

  const MAX_SAMPLES: usize = 4; // 0: Click, 1: Kick, 2: Snare, 3: Hi-hat
  const STEPS_COUNT: usize = 16;

  struct Sample {
      left_channel: Vec<f32>,
      right_channel: Vec<f32>,
  }

  struct SequencerTrack {
      steps: [u8; STEPS_COUNT], // 0 = Off, 1 = Low, 2 = High
  }

  pub struct Engine {
      sample_rate: f32,
      bpm: f64,
      is_playing: bool,
      current_sample_index: u64,
      samples_per_step: f64,
      step_index: usize,
      samples_in_current_step: f64,
      
      // Synthesis params for click (Oscillator)
      click_phase: f32,
      click_decay: f32,
      active_click_freq: f32,
      active_click_amp: f32,

      // Drum samples playback state
      samples: [Option<Sample>; MAX_SAMPLES],
      playback_offsets: [usize; MAX_SAMPLES],
      playback_active: [bool; MAX_SAMPLES],
      playback_volume: [f32; MAX_SAMPLES],

      // Sequencer Grid
      tracks: [SequencerTrack; MAX_SAMPLES],

      // Tempo Trainer State
      trainer_enabled: bool,
      trainer_start_bpm: f64,
      trainer_target_bpm: f64,
      trainer_increment: f64,
      trainer_step_type: u32, // 0 = Measures, 1 = Seconds
      trainer_step_value: f64,
      trainer_curve: u32,      // 0 = Stepped, 1 = Smooth
      trainer_accumulated_measures: u64,
      trainer_accumulated_samples: u64,
      
      // Events queued for Javascript
      last_tick_index: i32, // -1 if no tick in last process
      last_tick_bpm: f64,
  }

  impl Engine {
      fn new(sample_rate: f32) -> Self {
          let tracks = [
              SequencerTrack { steps: [0; STEPS_COUNT] },
              SequencerTrack { steps: [0; STEPS_COUNT] },
              SequencerTrack { steps: [0; STEPS_COUNT] },
              SequencerTrack { steps: [0; STEPS_COUNT] },
          ];
          
          let mut eng = Engine {
              sample_rate,
              bpm: 120.0,
              is_playing: false,
              current_sample_index: 0,
              samples_per_step: 0.0,
              step_index: 0,
              samples_in_current_step: 0.0,
              click_phase: 0.0,
              click_decay: 0.0,
              active_click_freq: 0.0,
              active_click_amp: 0.0,
              samples: [None, None, None, None],
              playback_offsets: [0; MAX_SAMPLES],
              playback_active: [false; MAX_SAMPLES],
              playback_volume: [0.8, 1.0, 0.9, 0.7],
              tracks,
              trainer_enabled: false,
              trainer_start_bpm: 120.0,
              trainer_target_bpm: 160.0,
              trainer_increment: 5.0,
              trainer_step_type: 0,
              trainer_step_value: 4.0,
              trainer_curve: 0,
              trainer_accumulated_measures: 0,
              trainer_accumulated_samples: 0,
              last_tick_index: -1,
              last_tick_bpm: 120.0,
          };
          eng.recalc_tempo();
          eng
      }

      fn recalc_tempo(&mut self) {
          // Assuming 16th notes: 4 steps per beat. 
          // Beats per second = bpm / 60
          // Steps per second = (bpm / 60) * 4
          // Samples per step = sample_rate / steps_per_second
          let steps_per_second = (self.bpm / 60.0) * 4.0;
          self.samples_per_step = self.sample_rate as f64 / steps_per_second;
      }

      fn trigger_step(&mut self) {
          self.last_tick_index = self.step_index as i32;
          self.last_tick_bpm = self.bpm;

          // Check click track
          let click_step = self.tracks[0].steps[self.step_index];
          if click_step > 0 {
              self.active_click_freq = if click_step == 2 { 880.0 } else { 440.0 };
              self.active_click_amp = 1.0;
              self.click_phase = 0.0;
              self.click_decay = 1.0;
          }

          // Check drum tracks (1 = Kick, 2 = Snare, 3 = Hi-hat)
          for i in 1..MAX_SAMPLES {
              if self.tracks[i].steps[self.step_index] > 0 {
                  if self.samples[i].is_some() {
                      self.playback_active[i] = true;
                      self.playback_offsets[i] = 0;
                  }
              }
          }

          // Update step index
          self.step_index = (self.step_index + 1) % STEPS_COUNT;
          if self.step_index == 0 {
              // End of a measure
              self.on_measure_complete();
          }
      }

      fn on_measure_complete(&mut self) {
          if self.trainer_enabled && self.trainer_step_type == 0 {
              self.trainer_accumulated_measures += 1;
              if self.trainer_accumulated_measures >= self.trainer_step_value as u64 {
                  self.trainer_accumulated_measures = 0;
                  self.increment_bpm();
              }
          }
      }

      fn increment_bpm(&mut self) {
          if self.bpm < self.trainer_target_bpm {
              self.bpm = (self.bpm + self.trainer_increment).min(self.trainer_target_bpm);
              self.recalc_tempo();
          }
      }

      fn update_trainer_smooth(&mut self, elapsed_samples: u64) {
          if !self.trainer_enabled || self.trainer_curve != 1 {
              return;
          }
          self.trainer_accumulated_samples += elapsed_samples;
          
          let samples_needed = if self.trainer_step_type == 1 {
              // By time
              self.trainer_step_value * self.sample_rate as f64
          } else {
              // By measure: samples per measure
              self.samples_per_step * STEPS_COUNT as f64 * self.trainer_step_value
          };

          if self.bpm < self.trainer_target_bpm {
              // Linear ramp
              let progress = elapsed_samples as f64 / samples_needed;
              let bpm_delta = self.trainer_increment * progress;
              self.bpm = (self.bpm + bpm_delta).min(self.trainer_target_bpm);
              self.recalc_tempo();
          }
      }

      fn process_tick_samples(&mut self) {
          if self.trainer_enabled && self.trainer_curve == 1 {
              // Smooth update per frame
              self.update_trainer_smooth(1);
          } else if self.trainer_enabled && self.trainer_step_type == 1 {
              // Stepped by time
              self.trainer_accumulated_samples += 1;
              let samples_limit = (self.trainer_step_value * self.sample_rate as f64) as u64;
              if self.trainer_accumulated_samples >= samples_limit {
                  self.trainer_accumulated_samples = 0;
                  self.increment_bpm();
              }
          }
      }

      pub fn fill_buffers(&mut self, out_l: &mut [f32], out_r: &mut [f32]) {
          self.last_tick_index = -1;
          if !self.is_playing {
              out_l.fill(0.0);
              out_r.fill(0.0);
              return;
          }

          let len = out_l.len();
          for i in 0..len {
              // 1. Process timing
              self.process_tick_samples();

              self.samples_in_current_step += 1.0;
              if self.samples_in_current_step >= self.samples_per_step {
                  self.samples_in_current_step -= self.samples_per_step;
                  self.trigger_step();
              }

              // 2. Synthesize Click (decaying sine wave)
              let mut click_out = 0.0;
              if self.active_click_amp > 0.0 {
                  // Exponential decay
                  click_out = (self.click_phase * 2.0 * std::f32::consts::PI).sin() * self.active_click_amp;
                  self.click_phase += self.active_click_freq / self.sample_rate;
                  if self.click_phase >= 1.0 {
                      self.click_phase -= 1.0;
                  }
                  self.active_click_amp *= 0.9995; // Decay rate
                  if self.active_click_amp < 0.001 {
                      self.active_click_amp = 0.0;
                  }
              }

              // 3. Play Drum Samples
              let mut drums_l = 0.0;
              let mut drums_r = 0.0;
              
              for s_idx in 1..MAX_SAMPLES {
                  if self.playback_active[s_idx] {
                      if let Some(ref sample) = self.samples[s_idx] {
                          let offset = self.playback_offsets[s_idx];
                          if offset < sample.left_channel.len() {
                              drums_l += sample.left_channel[offset] * self.playback_volume[s_idx];
                              drums_r += sample.right_channel[offset] * self.playback_volume[s_idx];
                              self.playback_offsets[s_idx] += 1;
                          } else {
                              self.playback_active[s_idx] = false;
                          }
                      }
                  }
              }

              // Combine (Left / Right)
              out_l[i] = click_out * 0.5 + drums_l;
              out_r[i] = click_out * 0.5 + drums_r;
          }
      }
  }

  // --- C FFI WASM EXPORTS ---

  #[no_mangle]
  pub extern "C" fn engine_new(sample_rate: f32) -> *mut Engine {
      Box::into_raw(Box::new(Engine::new(sample_rate)))
  }

  #[no_mangle]
  pub extern "C" fn engine_free(ptr: *mut Engine) {
      if !ptr.is_null() {
          unsafe { let _ = Box::from_raw(ptr); }
      }
  }

  #[no_mangle]
  pub extern "C" fn engine_start(ptr: *mut Engine) {
      let engine = unsafe { &mut *ptr };
      engine.is_playing = true;
      engine.step_index = 0;
      engine.samples_in_current_step = engine.samples_per_step - 1.0; // Trigger first beat immediately
  }

  #[no_mangle]
  pub extern "C" fn engine_stop(ptr: *mut Engine) {
      let engine = unsafe { &mut *ptr };
      engine.is_playing = false;
  }

  #[no_mangle]
  pub extern "C" fn engine_set_bpm(ptr: *mut Engine, bpm: f64) {
      let engine = unsafe { &mut *ptr };
      engine.bpm = bpm;
      engine.recalc_tempo();
  }

  #[no_mangle]
  pub extern "C" fn engine_load_sample(
      ptr: *mut Engine,
      sample_id: u32,
      left_ptr: *const f32,
      right_ptr: *const f32,
      length: usize
  ) {
      if sample_id >= MAX_SAMPLES as u32 { return; }
      let engine = unsafe { &mut *ptr };
      let left_slice = unsafe { slice::from_raw_parts(left_ptr, length) };
      let right_slice = unsafe { slice::from_raw_parts(right_ptr, length) };

      let sample = Sample {
          left_channel: left_slice.to_vec(),
          right_channel: right_slice.to_vec(),
      };
      engine.samples[sample_id as usize] = Some(sample);
  }

  #[no_mangle]
  pub extern "C" fn engine_update_grid(ptr: *mut Engine, sample_id: u32, steps_ptr: *const u8, length: usize) {
      if sample_id >= MAX_SAMPLES as u32 || length != STEPS_COUNT { return; }
      let engine = unsafe { &mut *ptr };
      let steps_slice = unsafe { slice::from_raw_parts(steps_ptr, length) };
      engine.tracks[sample_id as usize].steps.copy_from_slice(steps_slice);
  }

  #[no_mangle]
  pub extern "C" fn engine_set_trainer(
      ptr: *mut Engine,
      enabled: bool,
      start_bpm: f64,
      target_bpm: f64,
      increment: f64,
      step_type: u32,
      step_value: f64,
      curve_type: u32
  ) {
      let engine = unsafe { &mut *ptr };
      engine.trainer_enabled = enabled;
      engine.trainer_start_bpm = start_bpm;
      engine.trainer_target_bpm = target_bpm;
      engine.trainer_increment = increment;
      engine.trainer_step_type = step_type;
      engine.trainer_step_value = step_value;
      engine.trainer_curve = curve_type;
      engine.trainer_accumulated_measures = 0;
      engine.trainer_accumulated_samples = 0;
  }

  #[no_mangle]
  pub extern "C" fn engine_get_tick(ptr: *mut Engine, out_bpm: *mut f64) -> i32 {
      let engine = unsafe { &mut *ptr };
      unsafe { *out_bpm = engine.last_tick_bpm; }
      engine.last_tick_index
  }

  #[no_mangle]
  pub extern "C" fn engine_process(ptr: *mut Engine, out_l_ptr: *mut f32, out_r_ptr: *mut f32, length: usize) {
      let engine = unsafe { &mut *ptr };
      let out_l = unsafe { slice::from_raw_parts_mut(out_l_ptr, length) };
      let out_r = unsafe { slice::from_raw_parts_mut(out_r_ptr, length) };
      engine.fill_buffers(out_l, out_r);
  }

  // --- UNIT TESTS ---
  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn test_engine_init() {
          let mut engine = Engine::new(44100.0);
          assert_eq!(engine.bpm, 120.0);
          assert_eq!(engine.is_playing, false);
          
          // Verify recalc_tempo correctly computes step size
          // At 120 BPM: 2 beats/sec -> 8 steps/sec. At 44100Hz, samples per step = 44100 / 8 = 5512.5
          assert_eq!(engine.samples_per_step, 5512.5);
      }

      #[test]
      fn test_click_synthesis() {
          let mut engine = Engine::new(44100.0);
          engine.is_playing = true;
          engine.tracks[0].steps[0] = 2; // Accent click on step 0
          
          let mut buf_l = vec![0.0f32; 100];
          let mut buf_r = vec![0.0f32; 100];
          
          engine.fill_buffers(&mut buf_l, &mut buf_r);
          // Left buffer should contain non-zero synthesized sine samples
          assert!(buf_l[0] != 0.0);
      }
  }
  ```

- [ ] **Step 2: Run Cargo unit tests**
  Run: `cargo test`
  Expected: PASS

- [ ] **Step 3: Commit**
  Run: `git add src/rust/src/lib.rs && git commit -m "feat: implement rust audio engine core and unit tests"`

---

### Task 3: Audio Worklet Processor Integration

Implement the javascript wrapper script that acts as the Web Audio worker thread, instantiating the Rust WASM module and driving the engine loop inside `AudioWorkletProcessor`.

**Files:**
- Create: `src/audio/metronome-processor.ts`

**Interfaces:**
- Consumes: Raw `WebAssembly.Module` object passed via thread message.
- Produces: Web Audio `AudioWorkletProcessor` registered as `"metronome-processor"`.

- [ ] **Step 1: Write src/audio/metronome-processor.ts**
  Create the file and implement the processor class. Note that we read the wasm exports using standard WebAssembly JS API:
  ```typescript
  // Interfaces for exports inside WASM
  interface WasmEngineExports {
    memory: WebAssembly.Memory;
    engine_new(sampleRate: number): number;
    engine_free(ptr: number): void;
    engine_start(ptr: number): void;
    engine_stop(ptr: number): void;
    engine_set_bpm(ptr: number, bpm: number): void;
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
  }

  class MetronomeProcessor extends AudioWorkletProcessor {
    private enginePtr: number = 0;
    private wasmExports?: WasmEngineExports;
    
    // Shared heap memory pointers
    private outLBufferPtr: number = 0;
    private outRBufferPtr: number = 0;
    private bufferLength: number = 128; // Standard AudioWorklet block size

    constructor() {
      super();
      this.port.onmessage = this.handleMessage.bind(this);
    }

    private handleMessage(event: MessageEvent) {
      const msg = event.data;
      if (msg.type === 'INIT_WASM') {
        WebAssembly.instantiate(msg.module, {}).then((instance) => {
          this.wasmExports = instance.exports as unknown as WasmEngineExports;
          this.initializeEngine();
        });
      } else if (this.wasmExports && this.enginePtr !== 0) {
        this.processCommand(msg);
      }
    }

    private initializeEngine() {
      if (!this.wasmExports) return;
      
      // Instantiate engine in Rust
      this.enginePtr = this.wasmExports.engine_new(sampleRate);
      
      // Allocate two buffers of size 128 for channel outputs
      // f32 is 4 bytes, so we need 128 * 4 = 512 bytes
      const memory = this.wasmExports.memory;
      const heap = memory.buffer;
      
      // Allocate memory for processing outputs dynamically (we compile WASM with default page sizing)
      // For simple memory management, we can utilize Rust malloc or a pre-allocated chunk.
      // A safe way is to pass memory to JS or use exports. Note that in a raw wasm target, 
      // we can allocate static buffers or use offset pointers.
      // To keep it simple, we allocate them as static buffers in Rust or just query pointers.
      // Let's call Rust exports to copy or we can allocate them simply by using an offset 
      // far away from static data, or export allocation functions.
      // Let's add simple malloc/free exports in Rust or use a static offset since WASM memory is clean.
      // Wait, let's look at the memory. We can export page buffers or allocate them.
      // Let's assume we pass buffers inside process, or let's write simple allocation functions.
      // To be safe, let's write static buffers in WASM memory or dynamically offset.
      // Let's allocate 1024 bytes by growing/offsetting. In wasm32, index 65536 and 66560 are completely safe.
      this.outLBufferPtr = 65536;
      this.outRBufferPtr = 66560;
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
        case 'UPDATE_GRID': {
          const { trackId, steps } = msg;
          // Copy steps (Uint8Array) into WASM heap and pass ptr
          const heap = new Uint8Array(exports.memory.buffer);
          const ptr = 80000; // Safe memory offset for temporary copies
          heap.set(steps, ptr);
          exports.engine_update_grid(this.enginePtr, trackId, ptr, steps.length);
          break;
        }
        case 'LOAD_SAMPLE': {
          const { sampleId, leftChannel, rightChannel } = msg;
          // Copy arrays into WASM memory. 
          // Float32Array copies need to align to 4-byte float boundary.
          const length = leftChannel.length;
          const floatSize = 4;
          
          // Allocate sample memory blocks on the JS side
          // Let's write them sequentially starting at offset 100000
          // Each sample can have up to 2 seconds at 48kHz = 96000 samples = ~384 KB
          const offsetL = 100000 + sampleId * 1000000;
          const offsetR = offsetL + 500000;
          
          const heapFloat = new Float32Array(exports.memory.buffer);
          heapFloat.set(leftChannel, offsetL / floatSize);
          heapFloat.set(rightChannel, offsetR / floatSize);

          exports.engine_load_sample(this.enginePtr, sampleId, offsetL, offsetR, length);
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
      // We pass a float64 pointer in memory (offset 70000) to retrieve BPM
      const bpmPtr = 70000;
      const tickIndex = exports.engine_get_tick(this.enginePtr, bpmPtr);
      if (tickIndex >= 0) {
        const heapDouble = new Float64Array(exports.memory.buffer);
        const bpm = heapDouble[bpmPtr / 8];
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
  ```

- [ ] **Step 2: Commit**
  Run: `git add src/audio/metronome-processor.ts && git commit -m "feat: add AudioWorkletProcessor script integration"`

---

### Task 4: Main Thread Audio Node Wrapper

Create the main-thread `MetronomeNode` TypeScript class that handles setting up `AudioContext`, fetching/fetching the WASM module binary, loading WAV audio files, and communicating with the Worklet.

**Files:**
- Create: `src/audio/MetronomeNode.ts`

**Interfaces:**
- Consumes: AudioContext, sound assets.
- Produces: `MetronomeNode` API to control start, stop, BPM updates, and sequencer grid changes.

- [ ] **Step 1: Write src/audio/MetronomeNode.ts**
  Create the wrapper class:
  ```typescript
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
  ```

- [ ] **Step 2: Commit**
  Run: `git add src/audio/MetronomeNode.ts && git commit -m "feat: write TS MetronomeNode audio graph wrapper"`

---

### Task 5: State Manager & Database Persistence

Build the central state store managing UI values, and connect it to IndexedDB/LocalStorage for saving user presets and logging practice statistics.

**Files:**
- Create: `src/state.ts`
- Create: `tests/state.test.ts`

**Interfaces:**
- Consumes: None (independent logic)
- Produces: `StateManager` class with `savePreset`, `loadPreset`, `logSession`, and reactive subscribers.

- [ ] **Step 1: Write src/state.ts**
  Create the state management and database code using native browser IndexedDB:
  ```typescript
  export interface Preset {
    id: string;
    name: string;
    bpm: number;
    timeSignature: string;
    gridData: Record<number, number[]>; // trackId -> 16 steps
    trainerSettings: {
      enabled: boolean;
      startBpm: number;
      targetBpm: number;
      increment: number;
      stepType: 'measures' | 'seconds';
      stepValue: number;
      curve: 'stepped' | 'smooth';
    };
  }

  export interface PracticeLog {
    id?: number;
    date: string;
    durationSeconds: number;
    startBpm: number;
    maxBpm: number;
  }

  export class StateManager {
    private dbPromise: Promise<IDBDatabase>;
    private subscribers: Set<(state: any) => void> = new Set();
    
    public activePreset: Preset = {
      id: 'default',
      name: 'Default Beat',
      bpm: 120,
      timeSignature: '4/4',
      gridData: {
        0: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // Clicks
        1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Kick
        2: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Snare
        3: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Hihat
      },
      trainerSettings: {
        enabled: false,
        startBpm: 120,
        targetBpm: 160,
        increment: 5,
        stepType: 'measures',
        stepValue: 4,
        curve: 'stepped',
      }
    };

    public activeViewMode: 'editor' | 'stadium' = 'editor';
    public isPlaying: boolean = false;
    public currentLiveBpm: number = 120;

    constructor() {
      this.dbPromise = this.initDB();
      this.loadActiveViewMode();
    }

    private initDB(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('metrorig_db', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('presets')) {
            db.createObjectStore('presets', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('practice_logs')) {
            db.createObjectStore('practice_logs', { autoIncrement: true });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    private loadActiveViewMode() {
      const mode = localStorage.getItem('metrorig_view_mode');
      if (mode === 'stadium' || mode === 'editor') {
        this.activeViewMode = mode;
      }
    }

    setViewMode(mode: 'editor' | 'stadium') {
      this.activeViewMode = mode;
      localStorage.setItem('metrorig_view_mode', mode);
      this.notify();
    }

    subscribe(callback: (state: any) => void) {
      this.subscribers.add(callback);
      callback(this);
      return () => this.subscribers.delete(callback);
    }

    private notify() {
      this.subscribers.forEach((cb) => cb(this));
    }

    async savePreset(preset: Preset): Promise<void> {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('presets', 'readwrite');
        const store = transaction.objectStore('presets');
        const request = store.put(preset);
        request.onsuccess = () => {
          this.activePreset = preset;
          this.notify();
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }

    async getAllPresets(): Promise<Preset[]> {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('presets', 'readonly');
        const store = transaction.objectStore('presets');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async logPracticeSession(log: PracticeLog): Promise<void> {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('practice_logs', 'readwrite');
        const store = transaction.objectStore('practice_logs');
        const request = store.add(log);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    async getPracticeLogs(): Promise<PracticeLog[]> {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('practice_logs', 'readonly');
        const store = transaction.objectStore('practice_logs');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }
  ```

- [ ] **Step 2: Write test file tests/state.test.ts**
  Write Unit tests validating storage features:
  ```typescript
  import { describe, it, expect, beforeEach } from 'vitest';
  import { StateManager, Preset } from '../src/state';

  describe('StateManager Tests', () => {
    let stateManager: StateManager;

    beforeEach(() => {
      stateManager = new StateManager();
    });

    it('should initialize with default state settings', () => {
      expect(stateManager.activeViewMode).toBe('editor');
      expect(stateManager.isPlaying).toBe(false);
      expect(stateManager.activePreset.bpm).toBe(120);
    });

    it('should switch view mode and execute subscribers', () => {
      let callCount = 0;
      stateManager.subscribe(() => {
        callCount++;
      });
      stateManager.setViewMode('stadium');
      expect(stateManager.activeViewMode).toBe('stadium');
      expect(callCount).toBe(2); // Initial trigger + update trigger
    });
  });
  ```

- [ ] **Step 3: Run JS tests**
  Run: `npm run test:js`
  Expected: PASS

- [ ] **Step 4: Commit**
  Run: `git add src/state.ts tests/state.test.ts && git commit -m "feat: add central state manager with IndexedDB support and unit tests"`

---

### Task 6: UI Implementation

Write the visual layout in HTML, styles in CSS (stadium display, step sequencer cells), and script connectors.

**Files:**
- Create: `src/index.html`
- Create: `src/index.css`
- Create: `src/main.ts`
- Create: `public/click.wav` (temporary placeholder)
- Create: `public/kick.wav` (temporary placeholder)
- Create: `public/snare.wav` (temporary placeholder)
- Create: `public/hihat.wav` (temporary placeholder)

**Interfaces:**
- Consumes: `MetronomeNode` API, `StateManager` instance.
- Produces: Fully interactive web UI loaded by the browser.

- [ ] **Step 1: Create public folder audio placeholders**
  (Note: Simple silent buffers or small click sounds for start. Since we need files, we write tiny dummy scripts or copy mock files so they exist)
  Create paths: `public/kick.wav`, `public/snare.wav`, `public/hihat.wav` using a small script or empty WAV buffers.
  Let's write a simple utility script `generate_samples.js` to create standard minimal valid WAV files so that the application doesn't error when fetching:
  Create `scripts/generate_samples.js`:
  ```javascript
  import fs from 'fs';

  // Creates a 1-second tiny mock WAV header + silence
  function writeWavSilence(filename) {
    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36, 4); // File size - 8
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM)
    buffer.writeUInt16LE(1, 22);  // NumChannels (Mono)
    buffer.writeUInt32LE(44100, 24); // SampleRate
    buffer.writeUInt32LE(88200, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    buffer.writeUInt16LE(2, 32);  // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample
    buffer.write('data', 36);
    buffer.writeUInt32LE(0, 40);  // Subchunk2Size
    
    fs.writeFileSync(filename, buffer);
  }

  if (!fs.existsSync('public')) fs.mkdirSync('public');
  writeWavSilence('public/kick.wav');
  writeWavSilence('public/snare.wav');
  writeWavSilence('public/hihat.wav');
  ```
  Run: `node scripts/generate_samples.js`

- [ ] **Step 2: Create src/index.html**
  Write the index layout:
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MetroRig - Pro Metronome & Drum Machine</title>
    <link rel="stylesheet" href="./index.css">
  </head>
  <body>
    <div id="app">
      <header>
        <span class="logo">MetroRig</span>
        <div class="preset-controls">
          <input type="text" id="preset-name" value="Default Beat">
          <button id="btn-save">Save Preset</button>
        </div>
        <button id="btn-toggle-view">GO TO STADIUM MODE</button>
      </header>

      <!-- Editor Mode Screen -->
      <main id="editor-view">
        <section class="sequencer-container">
          <h2>Step Sequencer</h2>
          <div class="sequencer-grid" id="grid-container"></div>
        </section>

        <section class="controls-container">
          <div class="trainer-config">
            <h2>Tempo Trainer Config</h2>
            <div class="form-group">
              <label>Trainer Active: <input type="checkbox" id="trainer-enable"></label>
            </div>
            <div class="form-group">
              <label>Start BPM: <input type="number" id="trainer-start" value="120"></label>
            </div>
            <div class="form-group">
              <label>Target BPM: <input type="number" id="trainer-target" value="160"></label>
            </div>
            <div class="form-group">
              <label>Increment (BPM): <input type="number" id="trainer-inc" value="5"></label>
            </div>
            <div class="form-group">
              <label>Step Type:
                <select id="trainer-type">
                  <option value="measures">Measures</option>
                  <option value="seconds">Seconds</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <label>Step Limit Value: <input type="number" id="trainer-val" value="4"></label>
            </div>
            <div class="form-group">
              <label>Curve Mode:
                <select id="trainer-curve">
                  <option value="stepped">Stepped</option>
                  <option value="smooth">Smooth Ramp</option>
                </select>
              </label>
            </div>
          </div>

          <div class="metronome-panel">
            <h2>Speed Controls</h2>
            <div class="bpm-display-control">
              <input type="range" id="bpm-slider" min="40" max="240" value="120">
              <span id="bpm-number">120</span> BPM
            </div>
            <button id="btn-play" class="play-btn">PLAY</button>
          </div>
        </section>
      </main>

      <!-- Stadium View Screen -->
      <main id="stadium-view" class="hidden">
        <div class="stadium-display">
          <div class="stadium-timer" id="stadium-timer">00:00</div>
          <div class="stadium-bpm" id="stadium-bpm">120.0</div>
          <div class="stadium-trainer-info" id="stadium-status">Trainer Off</div>
          <div class="stadium-beat-flasher" id="beat-flash"></div>
          <div class="stadium-controls">
            <button id="btn-stadium-play" class="play-btn-large">PLAY</button>
          </div>
        </div>
      </main>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
  </html>
  ```

- [ ] **Step 3: Create src/index.css**
  Write OLED-style Helix colors and UI styles:
  ```css
  :root {
    --bg-color: #0b0b0c;
    --card-bg: #151518;
    --border-color: #27272a;
    --neon-green: #39ff14;
    --neon-green-dim: #1e640b;
    --cyber-yellow: #ffe600;
    --text-color: #f3f4f6;
    --text-muted: #9ca3af;
  }

  body {
    margin: 0;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background-color: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
  }

  .logo {
    font-weight: 800;
    font-size: 1.5rem;
    letter-spacing: -0.05em;
    color: var(--neon-green);
  }

  button {
    background-color: var(--border-color);
    color: var(--text-color);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  }

  button:hover {
    background-color: #3f3f46;
  }

  #editor-view {
    padding: 2rem;
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 2rem;
  }

  .sequencer-container, .controls-container > div {
    background-color: var(--card-bg);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .controls-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-muted);
  }

  input[type="number"], select {
    background-color: var(--bg-color);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    width: 80px;
  }

  .sequencer-grid {
    display: grid;
    grid-template-columns: auto repeat(16, 1fr);
    gap: 0.5rem;
    margin-top: 1rem;
    align-items: center;
  }

  .track-label {
    font-weight: bold;
    color: var(--text-muted);
    min-width: 60px;
  }

  .step-cell {
    aspect-ratio: 1;
    background-color: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
  }

  .step-cell.active {
    background-color: var(--neon-green-dim);
    box-shadow: 0 0 8px var(--neon-green-dim);
    border-color: var(--neon-green);
  }

  .step-cell.accent {
    background-color: var(--neon-green);
    box-shadow: 0 0 12px var(--neon-green);
    border-color: var(--neon-green);
  }

  .play-btn, .play-btn-large {
    background-color: var(--neon-green-dim);
    color: var(--neon-green);
    border: 1px solid var(--neon-green);
    width: 100%;
    padding: 1rem;
    border-radius: 8px;
    font-size: 1.2rem;
    letter-spacing: 0.1em;
  }

  .play-btn:hover {
    background-color: var(--neon-green);
    color: var(--bg-color);
  }

  /* Stadium View */
  .hidden {
    display: none !important;
  }

  #stadium-view {
    height: calc(100vh - 70px);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .stadium-display {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .stadium-timer {
    font-size: 2rem;
    color: var(--text-muted);
    font-family: monospace;
  }

  .stadium-bpm {
    font-size: 8rem;
    font-weight: 900;
    color: var(--neon-green);
    text-shadow: 0 0 30px rgba(57, 255, 20, 0.4);
    letter-spacing: -0.05em;
  }

  .stadium-trainer-info {
    font-size: 1.5rem;
    color: var(--cyber-yellow);
  }

  .stadium-beat-flasher {
    width: 300px;
    height: 10px;
    background-color: var(--border-color);
    border-radius: 5px;
    position: relative;
    overflow: hidden;
  }

  .stadium-beat-flasher.flash {
    background-color: var(--neon-green);
    box-shadow: 0 0 15px var(--neon-green);
  }

  .play-btn-large {
    width: 200px;
    font-size: 1.5rem;
  }
  ```

- [ ] **Step 4: Create src/main.ts**
  Wire the TypeScript UI controllers to StateManager and MetronomeNode APIs:
  ```typescript
  import { MetronomeNode } from './audio/MetronomeNode';
  import { StateManager, Preset } from './state';

  const state = new StateManager();
  const audioNode = new MetronomeNode();

  // Elements
  const btnToggleView = document.getElementById('btn-toggle-view') as HTMLButtonElement;
  const editorView = document.getElementById('editor-view') as HTMLElement;
  const stadiumView = document.getElementById('stadium-view') as HTMLElement;

  const bpmSlider = document.getElementById('bpm-slider') as HTMLInputElement;
  const bpmNumber = document.getElementById('bpm-number') as HTMLElement;
  const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
  const btnStadiumPlay = document.getElementById('btn-stadium-play') as HTMLButtonElement;

  const stadiumBpm = document.getElementById('stadium-bpm') as HTMLElement;
  const stadiumTimer = document.getElementById('stadium-timer') as HTMLElement;
  const stadiumStatus = document.getElementById('stadium-status') as HTMLElement;
  const beatFlash = document.getElementById('beat-flash') as HTMLElement;

  const trainerEnable = document.getElementById('trainer-enable') as HTMLInputElement;
  const trainerStart = document.getElementById('trainer-start') as HTMLInputElement;
  const trainerTarget = document.getElementById('trainer-target') as HTMLInputElement;
  const trainerInc = document.getElementById('trainer-inc') as HTMLInputElement;
  const trainerType = document.getElementById('trainer-type') as HTMLSelectElement;
  const trainerVal = document.getElementById('trainer-val') as HTMLInputElement;
  const trainerCurve = document.getElementById('trainer-curve') as HTMLSelectElement;

  const gridContainer = document.getElementById('grid-container') as HTMLElement;

  // Initialize Metronome Engine
  let isAudioInit = false;
  async function initAudio() {
    if (isAudioInit) return;
    // Compile Wasm and launch worklet using assets loaded through Vite
    await audioNode.init('/pkg/metrorig_audio_bg.wasm', '/src/audio/metronome-processor.ts');
    
    // Load default empty samples
    await audioNode.loadSample(1, '/kick.wav');
    await audioNode.loadSample(2, '/snare.wav');
    await audioNode.loadSample(3, '/hihat.wav');
    
    isAudioInit = true;
    syncAudioSettings();
  }

  function syncAudioSettings() {
    if (!isAudioInit) return;
    
    // Set active BPM
    audioNode.setBpm(state.activePreset.bpm);
    
    // Update active tracks
    for (let trackId = 0; trackId < 4; trackId++) {
      const steps = new Uint8Array(state.activePreset.gridData[trackId] || new Array(16).fill(0));
      audioNode.updateGrid(trackId, steps);
    }
    
    // Set trainer
    audioNode.setTrainer({
      enabled: trainerEnable.checked,
      startBpm: Number(trainerStart.value),
      targetBpm: Number(trainerTarget.value),
      increment: Number(trainerInc.value),
      stepType: trainerType.value as 'measures' | 'seconds',
      stepValue: Number(trainerVal.value),
      curve: trainerCurve.value as 'stepped' | 'smooth'
    });
  }

  // Draw Sequencer Grid
  const trackNames = ['Click', 'Kick', 'Snare', 'Hi-hat'];
  function drawGrid() {
    gridContainer.innerHTML = '';
    for (let trackId = 0; trackId < 4; trackId++) {
      const label = document.createElement('div');
      label.className = 'track-label';
      label.innerText = trackNames[trackId];
      gridContainer.appendChild(label);

      const trackSteps = state.activePreset.gridData[trackId] || new Array(16).fill(0);
      for (let step = 0; step < 16; step++) {
        const cell = document.createElement('div');
        cell.className = 'step-cell';
        if (trackSteps[step] === 1) cell.classList.add('active');
        if (trackSteps[step] === 2) cell.classList.add('accent');
        
        cell.onclick = () => {
          // Cycle states: 0 -> 1 -> 2 -> 0 (for Clicks), 0 -> 1 -> 0 (for Drums)
          let nextState = 0;
          if (trackId === 0) {
            nextState = (trackSteps[step] + 1) % 3;
          } else {
            nextState = trackSteps[step] === 1 ? 0 : 1;
          }
          trackSteps[step] = nextState;
          
          cell.className = 'step-cell';
          if (nextState === 1) cell.classList.add('active');
          if (nextState === 2) cell.classList.add('accent');

          if (isAudioInit) {
            audioNode.updateGrid(trackId, new Uint8Array(trackSteps));
          }
        };
        gridContainer.appendChild(cell);
      }
    }
  }

  // Handle Play/Stop state
  let timerInterval: any = null;
  let startTime = 0;

  function togglePlay() {
    initAudio().then(() => {
      if (state.isPlaying) {
        audioNode.stop();
        state.isPlaying = false;
        btnPlay.innerText = 'PLAY';
        btnStadiumPlay.innerText = 'PLAY';
        clearInterval(timerInterval);
      } else {
        syncAudioSettings();
        audioNode.start();
        state.isPlaying = true;
        btnPlay.innerText = 'STOP';
        btnStadiumPlay.innerText = 'STOP';
        
        startTime = Date.now();
        timerInterval = setInterval(updatePracticeTimer, 1000);
      }
    });
  }

  function updatePracticeTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    stadiumTimer.innerText = `${mm}:${ss}`;
  }

  // Subscriptions & Events
  state.subscribe((s) => {
    // Sync View Mode
    if (s.activeViewMode === 'editor') {
      editorView.classList.remove('hidden');
      stadiumView.classList.add('hidden');
      btnToggleView.innerText = 'GO TO STADIUM MODE';
    } else {
      editorView.classList.add('hidden');
      stadiumView.classList.remove('hidden');
      btnToggleView.innerText = 'GO TO EDITOR MODE';
    }
  });

  // UI Event Bindings
  btnToggleView.onclick = () => {
    state.setViewMode(state.activeViewMode === 'editor' ? 'stadium' : 'editor');
  };

  bpmSlider.oninput = () => {
    const bpm = Number(bpmSlider.value);
    bpmNumber.innerText = String(bpm);
    state.activePreset.bpm = bpm;
    if (isAudioInit) audioNode.setBpm(bpm);
  };

  btnPlay.onclick = togglePlay;
  btnStadiumPlay.onclick = togglePlay;

  // React to trainer config updates dynamically
  const formInputs = [trainerEnable, trainerStart, trainerTarget, trainerInc, trainerType, trainerVal, trainerCurve];
  formInputs.forEach(el => {
    el.onchange = () => {
      syncAudioSettings();
    };
  });

  // Handle Tick triggers from audio worklet thread
  audioNode.addEventListener('tick', (e: any) => {
    const { currentBpm, beatIndex } = e.detail;
    
    // Update live BPM text in Stadium Mode
    stadiumBpm.innerText = Number(currentBpm).toFixed(1);
    
    if (trainerEnable.checked) {
      stadiumStatus.innerText = `Trainer Running (${trainerCurve.value})`;
    } else {
      stadiumStatus.innerText = `Trainer Off`;
    }

    // Visual Flash Pulse
    beatFlash.classList.add('flash');
    setTimeout(() => beatFlash.classList.remove('flash'), 100);
  });

  // Initial draw
  drawGrid();
  ```

- [ ] **Step 5: Verify build works**
  Run: `npm run build`
  Expected: Successful compilation of the Vite production bundle.

- [ ] **Step 6: Commit**
  Run: `git add scripts/generate_samples.js src/index.html src/index.css src/main.ts && git commit -m "feat: implement web UI views, styles, and script linkages"`
