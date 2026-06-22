# Design Spec: Custom Time Signatures & Custom Grooves in MetroRig

* **Date:** 2026-06-22
* **Status:** Draft (Approved by User, awaiting implementation plan)
* **Author:** Antigravity

---

## 1. Overview & Context

MetroRig is a modern, high-fidelity Web-based 16-step sequencer, metronome, and practice tool. It uses a low-latency Rust DSP audio engine compiled to WebAssembly (WASM) running inside an AudioWorklet thread.

This document specifies the architecture and implementation details for adding two major features:
1. **Custom Time Signatures**: Simple numerator/denominator controls that dynamically resize the sequencer grid (up to 32 steps).
2. **Custom Grooves**:
   - A **Groove Library** allowing users to save only the drum patterns (Kick, Snare, Hi-hat) and apply them to any active time signature/BPM.
   - A **Swing Control** implemented directly inside the Rust DSP engine for precise micro-timing balanço (shuffle feel).

---

## 2. Requirements & Scope

### 2.1 Custom Time Signatures
- **User Interface**: Inputs for Numerator ($1$ to $16$) and Denominator ($/4$, $/8$, or $/16$).
- **Dynamic Steps Calculation**:
  - Denominator $/4$: `steps = numerator * 4` (sixteenth-note steps).
  - Denominator $/8$: `steps = numerator * 2`.
  - Denominator $/16$: `steps = numerator`.
- **Sequencer Resize**: The grid redraws dynamically. Step values wrap or crop as appropriate.
- **Maximum Step Limit**: Expanded to 32 steps (previously 16) in both Rust DSP and TypeScript.

### 2.2 Custom Grooves & Swing
- **Pattern Portability**: Ability to save the sequencer pattern of only the drum tracks (Kick, Snare, Hi-hat) as a named "Groove".
- **Groove Library**:
  - Save custom grooves to IndexedDB.
  - Dropdown menu containing Factory Grooves (extracted from current presets: Rock, Metal, Blues, Jazz) and User Grooves.
  - Applying a groove overlays the saved pattern onto the active grid, adjusting loop repetition or cropping to match the active time signature.
- **WASM-Based Swing**:
  - Slider from `0%` to `100%` (mapping to $0.0 \dots 0.5$ in WASM).
  - Delay even-indexed steps (off-beats) by `swing * step_duration` and shorten odd-indexed steps to maintain downbeat alignment.
  - Instant trigger for step 0 when playback starts.

---

## 3. Architecture & Technical Design

### 3.1 Rust DSP Audio Engine (`src/lib.rs`)

We will update the Rust DSP engine to support up to 32 steps and handle the swing delay math.

#### Modifications:
1. **Steps Capacity**:
   - Change `const STEPS_COUNT: usize = 32;` (was 16).
   - In `engine_update_grid`, verify the input buffer has size 32.
2. **Swing Integration**:
   - Add fields to `Engine` struct:
     ```rust
     swing: f64,
     current_step_limit: f64,
     ```
   - In `fill_buffers`, instead of comparing to `self.samples_per_step` directly, use `self.current_step_limit`.
   - In `trigger_step()` and `recalc_tempo()`, calculate the next step's sample limit:
     ```rust
     self.current_step_limit = if self.step_index % 2 == 0 {
         self.samples_per_step * (1.0 + self.swing)
     } else {
         self.samples_per_step * (1.0 - self.swing)
     };
     ```
   - Add FFI export:
     ```rust
     #[no_mangle]
     pub extern "C" fn engine_set_swing(ptr: *mut Engine, swing: f64) {
         if ptr.is_null() || swing < 0.0 || swing > 0.5 || !swing.is_finite() { return; }
         let engine = unsafe { &mut *ptr };
         engine.swing = swing;
         engine.recalc_tempo();
     }
     ```

### 3.2 AudioWorklet & TypeScript Bridge (`src/audio/`)

#### `src/audio/metronome-processor.ts`:
- Declare `engine_set_swing(ptr: number, swing: number): void` in `WasmEngineExports`.
- Add case `'SET_SWING'` to `processCommand(msg)` which calls FFI `engine_set_swing(this.enginePtr, msg.swing)`.
- In `UPDATE_GRID` command, pad incoming steps array to 32 elements to match Rust expectations:
  ```typescript
  const paddedSteps = new Uint8Array(32);
  paddedSteps.set(steps.subarray(0, Math.min(steps.length, 32)));
  ```

#### `src/audio/MetronomeNode.ts`:
- Add method:
  ```typescript
  setSwing(swing: number) {
    // Maps 0-100% UI value to 0.0-0.5 WASM swing factor
    const factor = (swing / 100) * 0.5;
    this.workletNode?.port.postMessage({ type: 'SET_SWING', swing: factor });
  }
  ```

### 3.3 TypeScript State Management (`src/state.ts`)

1. **Preset Schema Update**:
   - Add optional property `swing?: number` to `Preset`.
   - Preset `gridData` will support arrays of length up to 32.
2. **Groove Database & Schema**:
   - Add database store `'grooves'` in `initDB()` if it doesn't exist.
   - Define interface:
     ```typescript
     export interface CustomGroove {
       id: string;
       name: string;
       gridData: Record<number, number[]>; // drum tracks: 1 (Kick), 2 (Snare), 3 (Hi-hat)
       measureLength: number;
     }
     ```
   - Implement `saveGroove(groove: CustomGroove)` and `getAllGrooves()`.

### 3.4 User Interface Changes (`index.html` & `src/index.css`)

We will insert a new controls panel card in the sidebar:

```html
<div class="groove-settings-card card">
  <div class="card-section-title">Measure &amp; Groove Settings</div>
  
  <!-- Custom Time Signature -->
  <div class="ui-row">
    <div class="form-group-inline">
      <label for="time-sig-num">Beats</label>
      <input type="number" id="time-sig-num" min="1" max="16" value="4">
    </div>
    <div class="form-group-inline">
      <label for="time-sig-den">Unit</label>
      <select id="time-sig-den">
        <option value="4">/4 (Quarter)</option>
        <option value="8">/8 (Eighth)</option>
        <option value="16">/16 (Sixteenth)</option>
      </select>
    </div>
  </div>

  <!-- Swing Slider -->
  <div class="form-group">
    <div class="slider-label-row">
      <label for="swing-slider">Swing / Balanço</label>
      <span id="swing-display">0%</span>
    </div>
    <input type="range" id="swing-slider" min="0" max="100" value="0">
  </div>

  <!-- Groove Library -->
  <div class="groove-library-group">
    <label for="groove-selector">Apply Groove</label>
    <div class="groove-actions">
      <select id="groove-selector">
        <option value="">-- Select a Groove --</option>
        <!-- Factory and saved grooves inserted here -->
      </select>
      <button id="btn-save-groove" class="btn-subtle">Save Current Pattern as Groove</button>
    </div>
  </div>
</div>
```

---

## 4. Testing & Verification

1. **Unit Tests (Rust)**:
   - Update `test_measure_length_looping` and check FFI update with sizes up to 32.
   - Write a unit test verifying swing timings (odd steps vs even steps duration).
2. **Integration Tests (TypeScript)**:
   - Test step grid generation for various custom signatures (e.g. 5/4, 7/8, 13/16).
   - Test IndexedDB saves/loads of custom grooves.
3. **Manual Audio Check**:
   - Verify that adding Swing delays the upbeat clicks/drums correctly.
   - Verify that changing time signatures doesn't drift timing.
