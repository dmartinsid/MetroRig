# Custom Time Signatures & Custom Grooves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand MetroRig to support custom time signatures, custom grooves saving/loading (via IndexedDB), and precise swing timing implemented directly in the WASM audio engine.

**Architecture:** 
- Increase steps capacity in Rust to 32 steps. Add swing ratio parameter and timing modification on step limits.
- Update TS AudioBridge and AudioWorklet processor to support 32 steps with padding, and handle set swing events.
- Update StateManager with DB updates for custom grooves, and interface changes to edit time signatures, apply grooves, and slide swing.

**Tech Stack:** Rust (WASM, FFI), TypeScript, IndexedDB, Vite, HTML5 Web Audio (AudioWorklet), GSAP.

## Global Constraints
- Target maximum steps is 32 steps.
- Maintain compatibility with old 16-step presets.
- Swing is calculated in Rust engine (from 0.0 to 0.5 where 0.5 is maximum shift).

---

### Task 1: Rust Engine Modifications for 32 Steps and Swing Timing

**Files:**
- Modify: `src/lib.rs`
- Test: Rust Unit Tests inside `src/lib.rs`

**Interfaces:**
- Produces FFI: `engine_set_swing(ptr: *mut Engine, swing: f64)`
- Produces constant: `STEPS_COUNT = 32`

- [ ] **Step 1: Modify steps count and add swing fields in Engine struct**

Modify `src/lib.rs` at the top:
```rust
const STEPS_COUNT: usize = 32;
```
Modify `Engine` struct to add `swing` and `current_step_limit`:
```rust
pub struct Engine {
    // ... other fields ...
    // Dynamic measure length looping
    measure_length: usize,

    // Swing and step limit timing
    swing: f64,
    current_step_limit: f64,
}
```

- [ ] **Step 2: Update Engine initialization and recalculation logic**

Update `Engine::new`:
```rust
        let mut eng = Engine {
            sample_rate,
            bpm: 120.0,
            is_playing: false,
            current_sample_index: 0,
            samples_per_step: 0.0,
            step_index: 0,
            samples_in_current_step: 0.0,
            click_phase: 0.0,
            active_click_freq: 0.0,
            active_click_amp: 0.0,
            samples: [None, None, None, None],
            playback_offsets: [0; MAX_SAMPLES],
            playback_active: [false; MAX_SAMPLES],
            playback_volume: [0.8, 1.0, 0.9, 0.7],
            tracks: [
                SequencerTrack { steps: [0; STEPS_COUNT] },
                SequencerTrack { steps: [0; STEPS_COUNT] },
                SequencerTrack { steps: [0; STEPS_COUNT] },
                SequencerTrack { steps: [0; STEPS_COUNT] },
            ],
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
            measure_length: 16,
            swing: 0.0,
            current_step_limit: 0.0,
        };
        eng.recalc_tempo();
        eng
```

Update `Engine::start`:
```rust
    pub fn start(&mut self) {
        self.is_playing = true;
        self.step_index = 0;
        self.current_step_limit = if self.step_index % 2 == 0 {
            self.samples_per_step * (1.0 + self.swing)
        } else {
            self.samples_per_step * (1.0 - self.swing)
        };
        self.samples_in_current_step = self.current_step_limit - 1.0; // Trigger first beat immediately
    }
```

Update `recalc_tempo`:
```rust
    fn recalc_tempo(&mut self) {
        let steps_per_second = (self.bpm / 60.0) * 4.0;
        self.samples_per_step = self.sample_rate as f64 / steps_per_second;
        self.current_step_limit = if self.step_index % 2 == 0 {
            self.samples_per_step * (1.0 + self.swing)
        } else {
            self.samples_per_step * (1.0 - self.swing)
        };
    }
```

Update `trigger_step`:
```rust
    fn trigger_step(&mut self) {
        self.last_tick_index = self.step_index as i32;
        self.last_tick_bpm = self.bpm;

        // Check click track
        let click_step = self.tracks[0].steps[self.step_index];
        if click_step > 0 {
            self.active_click_freq = if click_step == 2 { 880.0 } else { 440.0 };
            self.active_click_amp = 1.0;
            self.click_phase = 0.0;
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
        self.step_index = (self.step_index + 1) % self.measure_length;
        if self.step_index == 0 {
            // End of a measure
            self.on_measure_complete();
        }

        // Recalculate limit for new step_index
        self.current_step_limit = if self.step_index % 2 == 0 {
            self.samples_per_step * (1.0 + self.swing)
        } else {
            self.samples_per_step * (1.0 - self.swing)
        };
    }
```

Update `fill_buffers`:
```rust
            self.samples_in_current_step += 1.0;
            if self.samples_in_current_step >= self.current_step_limit {
                self.samples_in_current_step -= self.current_step_limit;
                self.trigger_step();
            }
```

- [ ] **Step 3: Add swing FFI setter export**

At the bottom of `src/lib.rs` FFI exports:
```rust
#[no_mangle]
pub extern "C" fn engine_set_swing(ptr: *mut Engine, swing: f64) {
    if ptr.is_null() || swing < 0.0 || swing > 0.5 || !swing.is_finite() { return; }
    let engine = unsafe { &mut *ptr };
    engine.swing = swing;
    engine.recalc_tempo();
}
```

- [ ] **Step 4: Update Unit Tests in `src/lib.rs` and add Swing verification test**

In `src/lib.rs` module `tests`:
Update `test_raw_ffi` mock steps array size to `32`:
```rust
        let steps = [1u8; 32];
        engine_update_grid(ptr, 0, steps.as_ptr(), 32);
```
Add new test:
```rust
    #[test]
    fn test_swing_timings() {
        let mut engine = Engine::new(44100.0);
        engine.swing = 0.2; // 20% swing
        engine.start();
        assert_eq!(engine.step_index, 0);
        assert_eq!(engine.current_step_limit, engine.samples_per_step * 1.2);

        engine.trigger_step();
        assert_eq!(engine.step_index, 1);
        assert_eq!(engine.current_step_limit, engine.samples_per_step * 0.8);
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:rust` (or `cargo test`)
Expected: All tests pass.

- [ ] **Step 6: Commit**

Run:
```bash
git add src/lib.rs
git commit -m "feat(rust): support 32 steps capacity and implement swing timing"
```

---

### Task 2: Update TypeScript Audio Bridge and Compile WASM

**Files:**
- Modify: `src/audio/MetronomeNode.ts`
- Modify: `src/audio/metronome-processor.ts`

**Interfaces:**
- Consumes: FFI `engine_set_swing`
- Produces: `MetronomeNode.setSwing(swing: number)`

- [ ] **Step 1: Add Swing to Wasm Engine Exports in `metronome-processor.ts`**

In `src/audio/metronome-processor.ts`:
Modify `WasmEngineExports` interface to add:
```typescript
  engine_set_swing(ptr: number, swing: number): void;
```

Modify case `'SET_SWING'` inside `processCommand(msg)`:
```typescript
      case 'SET_SWING': {
        exports.engine_set_swing(this.enginePtr, msg.swing);
        break;
      }
```

Update case `'UPDATE_GRID'` to pad incoming arrays to 32 elements:
```typescript
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
```

- [ ] **Step 2: Add `setSwing` in `MetronomeNode.ts`**

In `src/audio/MetronomeNode.ts`:
Add the following method:
```typescript
  setSwing(swing: number) {
    const factor = (swing / 100) * 0.5;
    this.workletNode?.port.postMessage({ type: 'SET_SWING', swing: factor });
  }
```

- [ ] **Step 3: Compile WASM and test compilation**

Run: `npm run build:wasm`
Expected: Successfully builds WASM and copies it to public folder.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/audio/MetronomeNode.ts src/audio/metronome-processor.ts public/pkg/
git commit -m "feat(audio): bridge swing and update grid steps with 32 padding"
```

---

### Task 3: StateManager Updates for Custom Signatures, Swing, and Grooves

**Files:**
- Modify: `src/state.ts`
- Modify: `src/index.test.ts`

**Interfaces:**
- Produces: `Preset.swing`, `CustomGroove` structure and functions: `saveGroove`, `getAllGrooves`

- [ ] **Step 1: Update State interfaces and database version**

In `src/state.ts`:
Update `Preset`:
```typescript
export interface Preset {
  id: string;
  name: string;
  bpm: number;
  timeSignature: string;
  measureLength: number;
  gridData: Record<number, number[]>; // trackId -> up to 32 steps
  swing?: number;
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
```

Add `CustomGroove` interface:
```typescript
export interface CustomGroove {
  id: string;
  name: string;
  gridData: Record<number, number[]>; // tracks 1 (Kick), 2 (Snare), 3 (Hi-hat)
  measureLength: number;
}
```

- [ ] **Step 2: Upgrade IndexedDB to Version 2 and add grooves store**

Update `initDB()` to upgrade database version to `2` and add `'grooves'` store:
```typescript
  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve({} as IDBDatabase);
        return;
      }
      const request = indexedDB.open('metrorig_db', 2);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('presets')) {
          db.createObjectStore('presets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('practice_logs')) {
          db.createObjectStore('practice_logs', { autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('grooves')) {
          db.createObjectStore('grooves', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
```

- [ ] **Step 3: Implement Groove saving and loading methods**

Add methods to `StateManager` class:
```typescript
  async saveGroove(groove: CustomGroove): Promise<void> {
    const db = await this.dbPromise;
    if (!db.transaction) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('grooves', 'readwrite');
      const store = transaction.objectStore('grooves');
      const request = store.put(groove);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllGrooves(): Promise<CustomGroove[]> {
    const db = await this.dbPromise;
    if (!db.transaction) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('grooves', 'readonly');
      const store = transaction.objectStore('grooves');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
```

- [ ] **Step 4: Write test verifying custom grooves database functionality**

Add verification tests in `src/index.test.ts`:
```typescript
import { StateManager } from './state';

describe('StateManager IndexedDB Upgrade', () => {
  it('should initialize StateManager and allow saving custom grooves', async () => {
    const manager = new StateManager();
    expect(manager).toBeDefined();
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm run test:js`
Expected: Tests pass.

- [ ] **Step 6: Commit**

Run:
```bash
git add src/state.ts src/index.test.ts
git commit -m "feat(state): add IndexedDB upgrade for custom grooves and state methods"
```

---

### Task 4: Custom Time Signature & Swing UI Controls

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`
- Modify: `src/main.ts`

- [ ] **Step 1: Add HTML controls for custom time signature and swing**

In `index.html`, inside `<aside class="controls-container">` (just above the trainer collapsible):
```html
        <!-- Compasso & Swing Controls -->
        <div class="groove-settings-card card">
          <div class="card-section-title">Compasso &amp; Swing</div>
          
          <div class="ui-row">
            <div class="form-group-inline">
              <label for="time-sig-num">Numerador</label>
              <input type="number" id="time-sig-num" min="1" max="16" value="4">
            </div>
            <div class="form-group-inline">
              <label for="time-sig-den">Denominador</label>
              <select id="time-sig-den">
                <option value="4">/4</option>
                <option value="8">/8</option>
                <option value="16">/16</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <div class="slider-label-row">
              <label for="swing-slider">Swing / Balanço</label>
              <span id="swing-display">0%</span>
            </div>
            <input type="range" id="swing-slider" min="0" max="100" value="0">
          </div>
        </div>
```

- [ ] **Step 2: Add CSS styling for the new settings card**

Add stylesheet updates to `src/index.css`:
```css
.groove-settings-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.groove-settings-card .card-section-title {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 0.5rem;
}
.ui-row {
  display: flex;
  gap: 1rem;
}
.form-group-inline {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.form-group-inline label {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.form-group-inline input, .form-group-inline select {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  padding: 0.4rem 0.6rem;
  font-family: inherit;
  font-size: 0.9rem;
}
.slider-label-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}
#swing-display {
  color: var(--primary);
  font-weight: 600;
}
```

- [ ] **Step 3: Connect UI elements and logic in `main.ts`**

In `src/main.ts`:
Define elements:
```typescript
const timeSigNum = document.getElementById('time-sig-num') as HTMLInputElement;
const timeSigDen = document.getElementById('time-sig-den') as HTMLSelectElement;
const swingSlider = document.getElementById('swing-slider') as HTMLInputElement;
const swingDisplay = document.getElementById('swing-display') as HTMLElement;
```

Update `measureLengthToTimeSig` helper:
```typescript
function measureLengthToTimeSig(len: number): string {
  // Try to parse from state.activePreset.timeSignature first
  if (state.activePreset.timeSignature && state.activePreset.timeSignature.includes('/')) {
    return state.activePreset.timeSignature;
  }
  const map: Record<number, string> = { 12: '3/4', 14: '7/8', 16: '4/4' };
  return map[len] ?? `${len} steps`;
}
```

Add event handlers:
```typescript
function updateTimeSignature() {
  const num = Number(timeSigNum.value);
  const den = Number(timeSigDen.value);
  const sigStr = `${num}/${den}`;
  
  // Calculate measure length
  let measureLength = num;
  if (den === 4) measureLength = num * 4;
  else if (den === 8) measureLength = num * 2;
  
  // Clamp to 32 steps max
  if (measureLength > 32) {
    alert("Fórmula de compasso excede o limite máximo de 32 passos!");
    return;
  }

  state.activePreset.timeSignature = sigStr;
  state.activePreset.measureLength = measureLength;

  // Resize gridData tracks to match the new length
  for (let trackId = 0; trackId < 4; trackId++) {
    const oldSteps = state.activePreset.gridData[trackId] || [];
    const newSteps = new Array(measureLength).fill(0);
    for (let i = 0; i < Math.min(oldSteps.length, measureLength); i++) {
      newSteps[i] = oldSteps[i];
    }
    state.activePreset.gridData[trackId] = newSteps;
  }

  drawGrid();
  syncAudioSettings();
  markPresetAsModified();

  const bpm = state.activePreset.bpm;
  panelHeaderText.textContent = `${state.activePreset.name}  ·  ${sigStr}  ·  ${bpm} BPM`;
}

timeSigNum.onchange = updateTimeSignature;
timeSigDen.onchange = updateTimeSignature;

swingSlider.oninput = () => {
  const val = Number(swingSlider.value);
  swingDisplay.innerText = `${val}%`;
  state.activePreset.swing = val;
  if (isAudioInit) {
    audioNode.setSwing(val);
  }
  markPresetAsModified();
};
```

Update `loadPresetIntoUI` and `syncAudioSettings` to load time signature and swing values from preset details:
```typescript
// inside syncAudioSettings():
audioNode.setSwing(state.activePreset.swing || 0);

// inside loadPresetIntoUI(preset):
swingSlider.value = String(state.activePreset.swing || 0);
swingDisplay.innerText = `${state.activePreset.swing || 0}%`;

// parse timeSignature
if (preset.timeSignature && preset.timeSignature.includes('/')) {
  const parts = preset.timeSignature.split('/');
  timeSigNum.value = parts[0];
  timeSigDen.value = parts[1];
} else {
  // Fallback map
  const map: Record<number, {num: string, den: string}> = {
    12: { num: '3', den: '4' },
    14: { num: '7', den: '8' },
    16: { num: '4', den: '4' }
  };
  const parsed = map[preset.measureLength] || { num: String(preset.measureLength), den: '16' };
  timeSigNum.value = parsed.num;
  timeSigDen.value = parsed.den;
}
```

Update `btnSave.onclick` to include `swing`:
```typescript
    swing: state.activePreset.swing || 0,
```

- [ ] **Step 4: Commit**

Run:
```bash
git add index.html src/index.css src/main.ts
git commit -m "feat(ui): add controls for custom time signature and swing"
```

---

### Task 5: Implement Custom Groove Library & Application Logic

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`
- Modify: `src/main.ts`

- [ ] **Step 1: Add Groove selector and save button HTML**

In `index.html`, inside the new `groove-settings-card` (under the Swing container):
```html
          <div class="groove-library-group">
            <div class="slider-label-row">
              <label for="groove-selector">Grooves de Bateria</label>
            </div>
            <div class="groove-actions">
              <select id="groove-selector">
                <option value="">-- Escolha um Groove --</option>
              </select>
              <button id="btn-save-groove" class="btn-subtle">Salvar Ritmo</button>
            </div>
          </div>
```

- [ ] **Step 2: Add styles for groove library controls**

In `src/index.css`:
```css
.groove-library-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.groove-actions {
  display: flex;
  gap: 0.5rem;
}
.groove-actions select {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  padding: 0.4rem;
  font-family: inherit;
}
.btn-subtle {
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 4px;
  color: #00d4ff;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-subtle:hover {
  background: rgba(0, 212, 255, 0.2);
}
```

- [ ] **Step 3: Implement Groove apply & save events in `main.ts`**

In `src/main.ts`:
Define elements:
```typescript
const grooveSelector = document.getElementById('groove-selector') as HTMLSelectElement;
const btnSaveGroove = document.getElementById('btn-save-groove') as HTMLButtonElement;
```

Define Factory Grooves structure and update logic:
```typescript
const FACTORY_GROOVES = [
  { id: 'rock', name: 'Rock Groove', length: 16, tracks: { 1: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], 2: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] } },
  { id: 'metal', name: 'Metal Groove', length: 16, tracks: { 1: [1,0,1,0,0,0,1,0,1,0,1,0,0,0,1,0], 2: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] } },
  { id: 'blues', name: 'Blues Shuffle', length: 12, tracks: { 1: [1,0,0,0,0,0,1,0,0,0,0,0], 2: [0,0,0,1,0,0,0,0,0,1,0,0], 3: [1,0,1,1,0,1,1,0,1,1,0,1] } },
  { id: 'jazz', name: 'Jazz Swing', length: 12, tracks: { 1: [1,0,0,0,0,0,1,0,0,0,0,0], 2: [0,0,0,0,0,1,0,0,0,0,0,0], 3: [1,0,1,1,0,1,1,0,1,1,0,1] } }
];

function populateGroovesDropdown() {
  grooveSelector.innerHTML = '<option value="">-- Escolha um Groove --</option>';
  
  const factoryGroup = document.createElement('optgroup');
  factoryGroup.label = "Factory Grooves";
  FACTORY_GROOVES.forEach(g => {
    const opt = document.createElement('option');
    opt.value = `factory:${g.id}`;
    opt.innerText = g.name;
    factoryGroup.appendChild(opt);
  });
  grooveSelector.appendChild(factoryGroup);

  state.getAllGrooves().then(userGrooves => {
    if (userGrooves.length > 0) {
      const userGroup = document.createElement('optgroup');
      userGroup.label = "User Grooves";
      userGrooves.forEach(g => {
        const opt = document.createElement('option');
        opt.value = `user:${g.id}`;
        opt.innerText = g.name;
        userGroup.appendChild(opt);
      });
      grooveSelector.appendChild(userGroup);
    }
  });
}
```

Implement Apply Groove:
```typescript
grooveSelector.onchange = () => {
  const val = grooveSelector.value;
  if (!val) return;

  const activeLen = state.activePreset.measureLength || 16;

  const applyPattern = (length: number, tracks: Record<number, number[]>) => {
    for (let trackId = 1; trackId < 4; trackId++) {
      const srcPattern = tracks[trackId] || [];
      const destPattern = new Array(activeLen).fill(0);
      for (let i = 0; i < activeLen; i++) {
        destPattern[i] = srcPattern[i % length] || 0;
      }
      state.activePreset.gridData[trackId] = destPattern;
    }
    drawGrid();
    syncAudioSettings();
    markPresetAsModified();
  };

  if (val.startsWith('factory:')) {
    const gid = val.replace('factory:', '');
    const g = FACTORY_GROOVES.find(fg => fg.id === gid);
    if (g) applyPattern(g.length, g.tracks);
  } else if (val.startsWith('user:')) {
    const gid = val.replace('user:', '');
    state.getAllGrooves().then(grooves => {
      const g = grooves.find(ug => ug.id === gid);
      if (g) applyPattern(g.measureLength, g.gridData);
    });
  }
};
```

Implement Save Groove:
```typescript
btnSaveGroove.onclick = () => {
  const name = prompt("Digite um nome para o seu Groove de Bateria:");
  if (!name) return;

  const activeLen = state.activePreset.measureLength || 16;
  const gridData: Record<number, number[]> = {};
  for (let trackId = 1; trackId < 4; trackId++) {
    gridData[trackId] = [...(state.activePreset.gridData[trackId] || new Array(activeLen).fill(0))];
  }

  const id = 'groove_' + Date.now();
  const newGroove = { id, name, gridData, measureLength: activeLen };

  state.saveGroove(newGroove).then(() => {
    populateGroovesDropdown();
    alert(`Groove "${name}" salvo com sucesso!`);
  });
};
```

Call `populateGroovesDropdown()` on load:
```typescript
// At the bottom of main.ts:
populateGroovesDropdown();
```

- [ ] **Step 4: Commit and verify all files compile and run successfully**

Run: `npm run build`
Expected: Everything compiles without warnings or errors.

Run:
```bash
git add index.html src/index.css src/main.ts
git commit -m "feat(grooves): add custom groove saving and apply mechanics"
```
