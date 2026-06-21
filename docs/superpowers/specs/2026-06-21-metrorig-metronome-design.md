# Design Specification: MetroRig Metronome & Drum Machine

MetroRig is a highly visual, professional-grade browser metronome and drum machine designed primarily for guitarists' practice sessions. It combines a high-contrast hardware-style UI (inspired by Line 6 Helix Stadium mode and Neural DSP QuadCortex) with a low-latency audio engine built in Rust and WebAssembly, running inside a dedicated `AudioWorklet`.

---

## 1. Architecture Overview

MetroRig splits execution between the browser's main thread and a low-latency audio thread.

```mermaid
graph TD
    subgraph UI Thread (Main Thread - TypeScript)
        UI[Editor / Stadium Views]
        State[State Manager]
        Storage[IndexedDB / LocalStorage]
        WavLoader[WAV File Loader]
        
        UI -->|Events/Inputs| State
        State -->|Persist Presets/Stats| Storage
        WavLoader -->|Decode Audio Buffer| State
    end

    subgraph Audio Thread (AudioWorkletGlobalScope)
        AWN[AudioWorkletNode Wrapper]
        AWP[AudioWorkletProcessor]
        WasmModule[(Rust WASM Engine)]
        
        AWP -->|Calls process()| WasmModule
    end

    State -->|postMessage: Config, WASM Module, PCM Buffers| AWN
    AWN -->|Transfer Channels| AWP
    WasmModule -->|postMessage: Tick Events & dynamic BPM| State
    State -->|Animate LED & BPM| UI
```

### 1.1 UI Thread (TypeScript + Vite)
- **Vite Bundler:** Manages compilation, assets, and Wasm bundling.
- **Views:**
  - **Editor Mode:** Full step-sequencer grid, pattern presets loader, synth parameter knobs, and tempo trainer config.
  - **Stadium Mode:** High-contrast display with a giant BPM counter, pulsing beat indicators, and trainer speed-up progress bar.
- **Audio Setup:** Downloads drum WAV samples, decodes them to raw float PCM channels, loads the `AudioWorklet` script, and posts the compiled Wasm module to the audio thread.

### 1.2 Audio Thread (AudioWorklet + Rust WASM)
- **AudioWorkletProcessor:** Instantiates the Rust WASM module using memory passed from the main thread.
- **Rust WASM Engine:**
  - **Scheduler:** Resolves subdivisions and tracks exact sample-rate cycles (`currentTime` / sample counts).
  - **Synth Clicks:** Generates metronome click sounds via mathematical formulas (oscillator + exponential decay envelope).
  - **Sample Player:** Mixes raw PCM buffers of drums (kick, snare, hi-hat) into the final stereo channels at precise sample indexes.
  - **Tempo Trainer Engine:** Manages linear/stepped BPM ramps and calculates timing adjustments directly on the audio thread.

---

## 2. Core Functional Specifications

### 2.1 Metronome & Time Signatures
- **Common & Odd Time Signatures:** Supports `4/4`, `3/4`, `6/8`, `5/4`, and `7/8`.
- **Subdivisions:** Tracks quarter notes, eighth notes, triplets, and sixteenth notes.
- **Accent Management:** Step sequencer supports three states per step: Off, Low (normal click), High (accented click).

### 2.2 Drum Machine / Step Sequencer
- **Grid Layout:** 4 lanes (Click, Kick, Snare, Hi-hat). Columns adjust depending on the time signature and selected subdivision (typically 8, 12, or 16 steps).
- **Sample Loaders:** Built-in high-quality samples for Kick, Snare, and Hi-hat. Loaded dynamically, converted to `Float32Array` buffers, and transferred to Rust.

### 2.3 Tempo Trainer (Practice Assistant)
- **Increment Rules:**
  - By Measures: Increase tempo by $N$ BPM every $X$ measures.
  - By Time: Increase tempo by $N$ BPM every $Y$ seconds.
- **Target BPM:** Stops training or holds constant when the player reaches their target BPM limit.
- **Acceleration Curves:**
  - **Stepped:** Instant jumps in BPM (e.g. +5 BPM on measure boundary).
  - **Smooth (Linear):** Gradual acceleration calculated per-sample:
    $$\text{BPM}_{\text{current}} = \text{BPM}_{\text{start}} + \left(\frac{\Delta\text{BPM}}{\Delta\text{Time}}\right) \times t_{\text{elapsed}}$$
- **Session Stats:** Logs practice date, elapsed duration, starting BPM, and peak BPM.

---

## 3. Detailed Data Flow & Messaging API

All communication between the main thread and the `AudioWorklet` goes through `postMessage`.

### 3.1 Main Thread to Audio Worklet Messages
```typescript
interface StartMessage { type: 'START' }
interface StopMessage { type: 'STOP' }
interface SetBpmMessage { type: 'SET_BPM'; bpm: number }
interface LoadSampleMessage { type: 'LOAD_SAMPLE'; id: number; leftChannel: Float32Array; rightChannel: Float32Array }
interface UpdateGridMessage { type: 'UPDATE_GRID'; tracks: Array<{ id: number; steps: Uint8Array }> }
interface SetTrainerMessage {
  type: 'SET_TRAINER';
  enabled: boolean;
  startBpm: number;
  targetBpm: number;
  increment: number;
  stepType: 'measures' | 'seconds';
  stepValue: number;
  curve: 'stepped' | 'smooth';
}
```

### 3.2 Audio Worklet to Main Thread Messages
```typescript
interface TickMessage {
  type: 'TICK';
  beatIndex: number;      // Current step in the measure
  currentBpm: number;     // Active BPM (fractional if smooth)
  totalSamples: number;   // Absolute sample count for sync
}
interface TrainerDoneMessage {
  type: 'TRAINER_DONE';
  peakBpm: number;
}
```

---

## 4. UI & Visual Theme Specifications

```
+-------------------------------------------------------------+
|  MetroRig [Preset: Metal Riff 1]          [GO TO STADIUM]   |
+-------------------------------------------------------------+
| SEQUENCER                                                   |
| Click  [x] [ ] [ ] [x]  [x] [ ] [ ] [x]  [x] [ ] [ ] [x]    |
| Kick   [x] [ ] [ ] [ ]  [ ] [ ] [ ] [ ]  [x] [ ] [ ] [ ]    |
| Snare  [ ] [ ] [ ] [ ]  [x] [ ] [ ] [ ]  [ ] [ ] [ ] [ ]    |
| Hi-hat [x] [x] [x] [x]  [x] [x] [x] [x]  [x] [x] [x] [x]    |
+-------------------------------------------------------------+
| TEMPO TRAINER                                               |
| Start BPM: [100]  Target BPM: [140]  Increment: [+5]        |
| Trigger: (o) Measures [ 4 ]  ( ) Seconds [   ]              |
| Curve:   (o) Stepped  ( ) Smooth                            |
+-------------------------------------------------------------+
```

### 4.1 Theme Tokens
- **Background:** Dark slate / Onyx `#121214` (reduces eye strain, looks like rack unit gear).
- **Accents:** Neon Green `#39FF14` (active state / pulse) and Cyber Yellow `#FFE600`.
- **Text:** Crisp White `#F3F4F6` and Muted Gray `#9CA3AF`.

### 4.2 Interactive Elements
- **Knobs:** CSS/JS rotary drag controllers for Click Volume, Drum Mix, and Click Pitch.
- **Beat Pulser:** Radial glow animation that uses the `TICK` event timestamp to match high-frametime requestAnimationFrame calls without visual drift.

---

## 5. Storage Specs (Client-Side)

### 5.1 LocalStorage Schema
Used for basic preferences:
- `metrorig_active_preset_id`: UUID
- `metrorig_view_mode`: `'editor' | 'stadium'`

### 5.2 IndexedDB Database: `metrorig_db`
- **Presets Store (`presets`):**
  - Key: `id` (UUID)
  - Fields: `name`, `bpm`, `timeSignature`, `subdivision`, `gridData` (serialized tracks), `trainerSettings`.
- **Practice Logs Store (`practice_logs`):**
  - Key: `id` (Auto-increment)
  - Fields: `date` (ISO string), `durationSeconds`, `startBpm`, `maxBpm`, `completed`.

---

## 6. Implementation Stages & Verification Plan

```mermaid
gantt
    title MetroRig Development Stages
    dateFormat  YYYY-MM-DD
    section Stage 1: Build & Rust Setup
    Vite + Cargo + WASM Project Config      :a1, 2026-06-21, 2d
    section Stage 2: Audio Engine (Rust)
    Click Synthesizer & WAV Player          :a2, after a1, 3d
    AudioWorklet & Rust Integration         :a3, after a2, 2d
    section Stage 3: UI & Sequencer
    TypeScript Grid Editor & Preset Store   :a4, after a3, 3d
    Stadium Mode Pulsar View                :a5, after a4, 2d
    section Stage 4: Tempo Trainer
    BPM Increment Loop & Gradual curves     :a6, after a5, 2d
    Testing & Verification                  :a7, after a6, 1d
```

### 6.1 Verification Tests
1. **Clock Jitter Test:** Ensure timing deviations between consecutive ticks under simulated UI load (heavy CPU rendering) are below 1ms.
2. **Dynamic Speed Ramping Check:** Verify fractional mathematical calculations of BPM increment linear steps to prevent glitches/crackle.
3. **Database Import/Export Integrity:** Validate that exported JSON files can be fully loaded back on a fresh client.
