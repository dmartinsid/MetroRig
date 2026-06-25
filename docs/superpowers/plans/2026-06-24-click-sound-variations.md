# Click Sound Variations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement click sound selection variations (Digital, Mechanical, Woodblock, Stick, Cowbell) for the metronome using high-quality WAV files, with global persistence via LocalStorage and a selector dropdown in the header.

**Architecture:** Extend the Rust WASM engine to play sample 0 for click sounds in sample mode, while retaining the digital sine oscillator as a fallback. Sync settings from LocalStorage to the frontend, loading/decoding the selected WAV file dynamically and sending it to the metronome node.

**Tech Stack:** Rust, WebAssembly, Web Audio API (AudioWorklet), TypeScript, Vite, Python (for sound asset generation).

## Global Constraints

* LocalStorage key `metrorig_click_sound` must be used for persistence.
* Click mode values in Rust: `0` for Digital (Synth), `1` for Sample-based.
* Accented click must play at full volume (`1.0`) and normal click at reduced volume (`0.5`) in sample mode.

---

### Task 1: Generate Click Sound WAV Assets

**Files:**
- Create: `scripts/generate_clicks.py`
- Test: Check that `/public/mechanical.wav`, `/public/woodblock.wav`, `/public/stick.wav`, and `/public/cowbell.wav` are created.

**Interfaces:**
- Consumes: None
- Produces: Sound files in `/public/`

- [ ] **Step 1: Write python generation script**

Create `scripts/generate_clicks.py`:
```python
import wave
import math
import struct
import random
import os

def save_wav(filename, data, sample_rate=44100):
    with wave.open(filename, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        for val in data:
            val = max(-1.0, min(1.0, val))
            sample = int(val * 32767)
            w.writeframes(struct.pack('<h', sample))

def generate_mechanical():
    data = []
    for i in range(int(44100 * 0.03)):
        t = i / 44100
        env = math.exp(-t * 250)
        sine = math.sin(2 * math.pi * 1200 * t)
        noise = random.uniform(-0.3, 0.3)
        data.append((sine + noise) * env * 0.5)
    return data

def generate_woodblock():
    data = []
    for i in range(int(44100 * 0.08)):
        t = i / 44100
        env = math.exp(-t * 90)
        sine1 = math.sin(2 * math.pi * 900 * t)
        sine2 = math.sin(2 * math.pi * 1400 * t)
        data.append((0.6 * sine1 + 0.4 * sine2) * env * 0.7)
    return data

def generate_stick():
    data = []
    for i in range(int(44100 * 0.04)):
        t = i / 44100
        env = math.exp(-t * 180)
        sine = math.sin(2 * math.pi * 2000 * t)
        noise = random.uniform(-1.0, 1.0)
        data.append((0.4 * sine + 0.6 * noise) * env * 0.5)
    return data

def generate_cowbell():
    data = []
    for i in range(int(44100 * 0.2)):
        t = i / 44100
        env = math.exp(-t * 25)
        sq1 = 1.0 if math.sin(2 * math.pi * 540 * t) > 0 else -1.0
        sq2 = 1.0 if math.sin(2 * math.pi * 800 * t) > 0 else -1.0
        data.append((0.5 * sq1 + 0.5 * sq2) * env * 0.25)
    return data

if __name__ == '__main__':
    os.makedirs('public', exist_ok=True)
    save_wav('public/mechanical.wav', generate_mechanical())
    save_wav('public/woodblock.wav', generate_woodblock())
    save_wav('public/stick.wav', generate_stick())
    save_wav('public/cowbell.wav', generate_cowbell())
    print("Click sound samples generated successfully!")
```

- [ ] **Step 2: Run script to generate files**

Run: `python3 scripts/generate_clicks.py`
Expected: Output "Click sound samples generated successfully!" and 4 files exist in `public/`.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate_clicks.py public/mechanical.wav public/woodblock.wav public/stick.wav public/cowbell.wav
git commit -m "feat: generate click sound WAV assets"
```

---

### Task 2: Implement Click Mode Logic in Rust WASM Engine & Bridge

**Files:**
- Modify: `src/lib.rs`
- Modify: `src/audio/metronome-processor.ts`
- Modify: `src/audio/MetronomeNode.ts`
- Test: Add unit test in `src/lib.rs`

**Interfaces:**
- Consumes: None
- Produces: FFI function `engine_set_click_mode(ptr, mode)` and bridge method `setClickMode(mode)`

- [ ] **Step 1: Implement FFI and click playback logic in Rust**

Modify `src/lib.rs`:
Add fields to `Engine` struct around line 59:
```rust
    // Sound selection
    click_mode: u32, // 0 = Synth, 1 = Sample
    click_accent: bool,
```

Initialize them in `Engine::new` around line 100:
```rust
            click_mode: 0,
            click_accent: false,
```

Update `trigger_step` around line 144:
```rust
        // Check click track
        let click_step = self.tracks[0].steps[self.step_index];
        if click_step > 0 {
            self.click_accent = click_step == 2;
            if self.click_mode == 0 {
                self.active_click_freq = if self.click_accent { 880.0 } else { 440.0 };
                self.active_click_amp = 1.0;
                self.click_phase = 0.0;
            } else if self.samples[0].is_some() {
                self.playback_active[0] = true;
                self.playback_offsets[0] = 0;
            }
        }
```

Update `fill_buffers` around line 247:
```rust
            // 2. Synthesize Click (decaying sine wave) or Play Sample
            let mut click_out = 0.0;
            if self.click_mode == 0 {
                if self.active_click_amp > 0.0 {
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
            } else if self.playback_active[0] {
                if let Some(ref sample) = self.samples[0] {
                    let offset = self.playback_offsets[0];
                    if offset < sample.left_channel.len() {
                        let vol = if self.click_accent { 1.0 } else { 0.5 };
                        // Combine stereo channels with volume multiplier
                        click_out = (sample.left_channel[offset] + sample.right_channel[offset]) * 0.5 * vol;
                        self.playback_offsets[0] += 1;
                    } else {
                        self.playback_active[0] = false;
                    }
                }
            }
```

Add the FFI export function at the end of the FFI block:
```rust
#[no_mangle]
pub extern "C" fn engine_set_click_mode(ptr: *mut Engine, mode: u32) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.click_mode = mode;
}
```

- [ ] **Step 2: Add Rust tests for click mode**

Add unit test to `src/lib.rs` tests module around line 695:
```rust
    #[test]
    fn test_click_mode_switching() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // Default mode is synth (0)
        assert_eq!(engine.click_mode, 0);
        
        // Switch to sample mode (1)
        engine_set_click_mode(&mut engine as *mut Engine, 1);
        assert_eq!(engine.click_mode, 1);
    }
```

- [ ] **Step 3: Run Rust tests to verify changes**

Run: `npm run test:rust`
Expected: 11 passed; 0 failed

- [ ] **Step 4: Update AudioWorklet processor**

Modify `src/audio/metronome-processor.ts`:
Add to `WasmEngineExports` FFI interface around line 26:
```typescript
  engine_set_click_mode(ptr: number, mode: number): void;
```

Add case in `processCommand` switch around line 170:
```typescript
      case 'SET_CLICK_MODE':
        exports.engine_set_click_mode(this.enginePtr, msg.mode);
        break;
```

- [ ] **Step 5: Update MetronomeNode JavaScript bridge**

Modify `src/audio/MetronomeNode.ts`:
Add method at the end of class `MetronomeNode`:
```typescript
  setClickMode(mode: number) {
    this.workletNode?.port.postMessage({ type: 'SET_CLICK_MODE', mode });
  }
```

- [ ] **Step 6: Build WASM and run JS tests to verify no regressions**

Run: `npm run build:wasm`
Run: `npm run test:js`
Expected: Build succeeds, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib.rs src/audio/metronome-processor.ts src/audio/MetronomeNode.ts
git commit -m "feat: implement click mode switching in rust wasm engine and js bridge"
```

---

### Task 3: Implement Sound Selector UI & Styles

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`
- Test: Visual check in the browser

**Interfaces:**
- Consumes: None
- Produces: UI element `<select id="click-sound-selector">`

- [ ] **Step 2: Add Sound Selector HTML**

Modify `index.html` around line 22 (inside header `.preset-controls`):
```html
      <div class="preset-controls">
        <select id="click-sound-selector" style="margin-right: 0.5rem;" title="Click Sound">
          <option value="digital">Click: Digital</option>
          <option value="mechanical">Click: Mechanical</option>
          <option value="woodblock">Click: Woodblock</option>
          <option value="stick">Click: Stick Click</option>
          <option value="cowbell">Click: Cowbell</option>
        </select>

        <select id="preset-selector">
```

- [ ] **Step 3: Style the Sound Selector in CSS**

Modify `src/index.css` around line 112 (after `#preset-selector`):
```css
#click-sound-selector {
  background: rgba(8, 8, 16, 0.8);
  color: var(--text);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239CA3AF' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  transition: border-color 0.2s, box-shadow 0.2s;
}

#click-sound-selector:focus {
  border-color: var(--neon-green);
  box-shadow: 0 0 8px rgba(57, 255, 20, 0.3);
}
```

- [ ] **Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "style: add click sound selector in header and style it"
```

---

### Task 4: Integrate Controller, LocalStorage and Sound Loading in Frontend

**Files:**
- Modify: `src/main.ts`
- Test: Run Javascript tests using `npm run test:js`

**Interfaces:**
- Consumes: `MetronomeNode` methods (`setClickMode`, `loadSample`), UI element `#click-sound-selector`
- Produces: Sunk integration with LocalStorage and Audio Context initialization

- [ ] **Step 1: Add frontend logic for click sound selector**

Modify `src/main.ts`:
Add element selector around line 48:
```typescript
const clickSoundSelector = document.getElementById('click-sound-selector') as HTMLSelectElement;
```

Update `initAudio` method around line 117 to sync the active sound selection from localStorage:
```typescript
async function initAudio() {
  if (isAudioInit) return;
  // Compile Wasm and launch worklet using assets loaded through Vite
  await audioNode.init('/pkg/metrorig_audio_bg.wasm', workletUrl);
  
  // Load default empty samples
  await audioNode.loadSample(1, '/kick.wav');
  await audioNode.loadSample(2, '/snare.wav');
  await audioNode.loadSample(3, '/hihat.wav');
  
  isAudioInit = true;
  await syncClickSound(); // Wait for click sound loading
  syncAudioSettings();
}
```

Add sound loading logic and binding around line 558 (near end of `src/main.ts`):
```typescript
// Click Sound logic
async function syncClickSound() {
  if (!isAudioInit) return;
  const sound = clickSoundSelector.value;
  if (sound === 'digital') {
    audioNode.setClickMode(0);
  } else {
    // Load requested WAV sample for slot 0
    await audioNode.loadSample(0, `/${sound}.wav`);
    audioNode.setClickMode(1);
  }
}

clickSoundSelector.onchange = async () => {
  const sound = clickSoundSelector.value;
  localStorage.setItem('metrorig_click_sound', sound);
  if (isAudioInit) {
    await syncClickSound();
  }
};

// Initialize dropdown value from localStorage
const storedClickSound = localStorage.getItem('metrorig_click_sound') || 'digital';
clickSoundSelector.value = storedClickSound;
```

- [ ] **Step 2: Run all tests to verify everything passes**

Run: `npm run test:js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: connect click sound selector with metronome node and localstorage"
```
