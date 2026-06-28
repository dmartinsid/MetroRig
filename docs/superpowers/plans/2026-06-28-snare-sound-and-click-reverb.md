# Snare Sound Replacement & Click Reverb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve MetroRig's audio kit by replacing the synthetic sounds with real acoustic WAV samples (custom snare/kick provided by the user, hihat/clicks fetched automatically) and implementing a sample-accurate room reverb for accented metronome clicks inside the Rust audio processor.

**Architecture:** 
1. A Node.js downloader script will retrieve the remaining audio assets (`hihat.wav`, `mechanical.wav`, `click.wav`, `stick.wav`, `cowbell.wav`, `woodblock.wav`) from stable open-source repositories and write them to the `public/` directory.
2. A lightweight stereo comb-filter `Reverb` struct is implemented in Rust (`src/lib.rs`).
3. Accented clicks (when `self.click_accent == true`) feed the reverb, and the wet/dry outputs are mixed inside `fill_buffers`. Normal clicks remain dry but are mixed with any decaying reverb tail from previous accented beats.

**Tech Stack:** Node.js, Rust, WebAssembly, Web Audio API (AudioWorklet)

## Global Constraints
* Keep lines short: Keep bullet points concise to avoid wrapped lines.
* Maintain all existing comments and docstrings.
* Run both JS unit tests (`npm run test:js`) and Rust unit tests (`npm run test:rust`) at every stage.

---

### Task 1: Sound Assets Downloader Script

**Files:**
* Create: `scripts/download_sounds.js`
* Modify: `package.json`

**Interfaces:**
* Produces: WAV files `public/hihat.wav`, `public/mechanical.wav`, `public/click.wav`, `public/stick.wav`, `public/cowbell.wav`, `public/woodblock.wav`

- [ ] **Step 1: Create the downloader script**
  Create `scripts/download_sounds.js`:
  ```javascript
  import fs from 'fs';
  import https from 'https';
  import path from 'path';

  const assets = {
    'hihat.wav': 'https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/sounds/hihat-close.wav',
    'mechanical.wav': 'https://raw.githubusercontent.com/rfauver/metronome/master/click.wav',
    'click.wav': 'https://raw.githubusercontent.com/rfauver/metronome/master/click.wav',
    'stick.wav': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/tink.wav',
    'cowbell.wav': 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/drumtraks/002_DT%20Cowbell.wav',
    'woodblock.wav': 'https://raw.githubusercontent.com/Manza12/MMM/main/data/audio/woodblock.wav'
  };

  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  function download(filename, url) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(path.join(publicDir, filename));
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${filename}: Status code ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded: ${filename}`);
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(path.join(publicDir, filename), () => {});
        reject(err);
      });
    });
  }

  async function main() {
    console.log("Downloading audio assets...");
    for (const [filename, url] of Object.entries(assets)) {
      try {
        await download(filename, url);
      } catch (err) {
        console.error(`Error downloading ${filename}:`, err.message);
        process.exit(1);
      }
    }
    console.log("All audio assets downloaded successfully!");
  }

  main();
  ```

- [ ] **Step 2: Add script command to package.json**
  Update `package.json` to include `"download:sounds": "node scripts/download_sounds.js"` in the `"scripts"` section:
  ```json
  "scripts": {
    "dev": "vite",
    "download:sounds": "node scripts/download_sounds.js",
    "build:wasm": "cargo build --target wasm32-unknown-unknown --release && node scripts/copy_wasm.js",
    "build": "npm run build:wasm && vite build",
    "test:js": "vitest run",
    "test:rust": "cargo test"
  }
  ```

- [ ] **Step 3: Run the downloader script**
  Run: `npm run download:sounds`
  Expected: Successful exit and confirmation messages for all 6 downloads. Verify that the files exist in `public/` and are non-empty.

- [ ] **Step 4: Verify JS/TS tests still compile and run**
  Run: `npm run test:js`
  Expected: All JS tests pass.

- [ ] **Step 5: Commit changes**
  Run:
  ```bash
  git add scripts/download_sounds.js package.json
  git commit -m "feat(audio): add sound downloader script and integrate into package.json"
  ```

---

### Task 2: Implement Rust DSP Reverb Comb Filter

**Files:**
* Modify: `src/lib.rs`

**Interfaces:**
* Produces: `struct Reverb` with `Reverb::new(sample_rate: f32) -> Self` and `Reverb::process(&mut self, in_l: f32, in_r: f32) -> (f32, f32)`

- [ ] **Step 1: Write a failing Rust unit test for Reverb**
  Add a unit test in the `mod tests` block at the end of `src/lib.rs`:
  ```rust
  #[test]
  fn test_reverb_decay() {
      let mut reverb = Reverb::new(44100.0);
      let (out_l, out_r) = reverb.process(1.0, 1.0);
      
      // Initially, delayed buffer contains 0, so wet component is 0.
      // Dry component is 1.0 * (1.0 - wet) = 0.65
      assert_eq!(out_l, 0.65);
      assert_eq!(out_r, 0.65);

      // Process silence for enough steps to ring out the delay lines (approx 50ms = 2205 samples)
      let mut active_output_detected = false;
      for _ in 0..2500 {
          let (o_l, o_r) = reverb.process(0.0, 0.0);
          if o_l > 0.0 {
              active_output_detected = true;
          }
      }
      // Reverb tail must have triggered and output non-zero values after input ceased
      assert!(active_output_detected);
  }
  ```

- [ ] **Step 2: Verify the test fails to compile**
  Run: `npm run test:rust`
  Expected: Compile failure indicating `Reverb` is not defined.

- [ ] **Step 3: Implement Reverb in src/lib.rs**
  Add the `Reverb` struct and its implementation to `src/lib.rs` (above `pub struct Engine`):
  ```rust
  struct Reverb {
      buffer_l: Vec<f32>,
      buffer_r: Vec<f32>,
      write_idx_l: usize,
      write_idx_r: usize,
      feedback: f32,
      wet: f32,
  }

  impl Reverb {
      pub fn new(sample_rate: f32) -> Self {
          let len_l = (sample_rate * 0.038) as usize; // ~38ms delay
          let len_r = (sample_rate * 0.045) as usize; // ~45ms delay
          Reverb {
              buffer_l: vec![0.0; len_l],
              buffer_r: vec![0.0; len_r],
              write_idx_l: 0,
              write_idx_r: 0,
              feedback: 0.45,
              wet: 0.35,
          }
      }

      pub fn process(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
          let delayed_l = self.buffer_l[self.write_idx_l];
          let delayed_r = self.buffer_r[self.write_idx_r];

          self.buffer_l[self.write_idx_l] = in_l + delayed_l * self.feedback;
          self.buffer_r[self.write_idx_r] = in_r + delayed_r * self.feedback;

          self.write_idx_l = (self.write_idx_l + 1) % self.buffer_l.len();
          self.write_idx_r = (self.write_idx_r + 1) % self.buffer_r.len();

          let out_l = in_l * (1.0 - self.wet) + delayed_l * self.wet;
          let out_r = in_r * (1.0 - self.wet) + delayed_r * self.wet;
          (out_l, out_r)
      }
  }
  ```

- [ ] **Step 4: Run tests to verify the Reverb unit test passes**
  Run: `npm run test:rust`
  Expected: Compile succeeds and `test_reverb_decay` passes.

- [ ] **Step 5: Commit changes**
  Run:
  ```bash
  git add src/lib.rs
  git commit -m "feat(audio): implement stereo comb-filter Reverb struct in Rust"
  ```

---

### Task 3: Integrate Reverb into Rust Metronome Engine

**Files:**
* Modify: `src/lib.rs`

**Interfaces:**
* Consumes: `struct Reverb` methods
* Produces: `Engine` mixing outputs in `fill_buffers` using reverb

- [ ] **Step 1: Write a failing Rust unit test for Engine Reverb integration**
  Add a unit test in the `mod tests` block at the end of `src/lib.rs` to verify that an accented click step triggers reverb, but a normal click step does not feed the reverb:
  ```rust
  #[test]
  fn test_engine_click_reverb() {
      let mut engine = Engine::new(44100.0);
      engine.start();

      // Trigger an accented click on step 0
      engine.tracks[0].steps[0] = 2; // Accent
      let mut buf_l_accent = vec![0.0f32; 100];
      let mut buf_r_accent = vec![0.0f32; 100];
      engine.fill_buffers(&mut buf_l_accent, &mut buf_r_accent);

      // Verify some signal was processed (accented beep)
      assert!(buf_l_accent[1] != 0.0);

      // Now set step 0 to normal click (value 1) and reset engine to trigger it
      engine.stop();
      engine.start();
      engine.tracks[0].steps[0] = 1; // Normal click (non-accented)

      let mut buf_l_normal = vec![0.0f32; 100];
      let mut buf_r_normal = vec![0.0f32; 100];
      engine.fill_buffers(&mut buf_l_normal, &mut buf_r_normal);

      // Output should differ from the accented one because the accented version goes through reverb (attenuated dry component + delayed wet)
      // Whereas normal click goes dry directly
      assert_ne!(buf_l_accent[1], buf_l_normal[1]);
  }
  ```

- [ ] **Step 2: Verify the compilation fails**
  Run: `npm run test:rust`
  Expected: Compile failure indicating `reverb` field is missing from `Engine`.

- [ ] **Step 3: Modify Engine struct and fill_buffers to integrate Reverb**
  1. Add `reverb: Reverb,` to `Engine` struct in `src/lib.rs`.
  2. Initialize `reverb: Reverb::new(sample_rate),` in `Engine::new` inside `src/lib.rs`.
  3. Modify the click synthesis/sample section in `fill_buffers` of `src/lib.rs` (lines 259–315):
     ```rust
            // 2. Synthesize Click (decaying sine wave) or Play Sample
            let mut click_out_l = 0.0;
            let mut click_out_r = 0.0;
            if self.click_mode == 0 {
                if self.active_click_amp > 0.0 {
                    let click_out = (self.click_phase * 2.0 * std::f32::consts::PI).sin() * self.active_click_amp;
                    self.click_phase += self.active_click_freq / self.sample_rate;
                    if self.click_phase >= 1.0 {
                        self.click_phase -= 1.0;
                    }
                    self.active_click_amp *= 0.9995; // Decay rate
                    if self.active_click_amp < 0.001 {
                        self.active_click_amp = 0.0;
                    }
                    click_out_l = click_out * 0.5;
                    click_out_r = click_out * 0.5;
                }
            } else if self.playback_active[0] {
                if let Some(ref sample) = self.samples[0] {
                    let offset = self.playback_offsets[0];
                    if offset < sample.left_channel.len() {
                        let vol = if self.click_accent { 1.0 } else { 0.5 };
                        click_out_l = sample.left_channel[offset] * vol;
                        click_out_r = sample.right_channel[offset] * vol;
                        self.playback_offsets[0] += 1;
                    } else {
                        self.playback_active[0] = false;
                    }
                } else {
                    self.playback_active[0] = false;
                }
            }

            // 3. Process Click Reverb
            let (rev_out_l, rev_out_r) = if self.click_accent {
                self.reverb.process(click_out_l, click_out_r)
            } else {
                self.reverb.process(0.0, 0.0)
            };

            // Mix dry click + reverb tail
            let final_click_l = if self.click_accent { rev_out_l } else { click_out_l + rev_out_l };
            let final_click_r = if self.click_accent { rev_out_r } else { click_out_r + rev_out_r };

            // 4. Play Drum Samples
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
            out_l[i] = final_click_l + drums_l;
            out_r[i] = final_click_r + drums_r;
     ```

- [ ] **Step 4: Run Rust tests to verify they pass**
  Run: `npm run test:rust`
  Expected: All Rust tests pass successfully.

- [ ] **Step 5: Compile Wasm and verify JS tests**
  Run: `npm run build && npm run test:js`
  Expected: Successful WASM compilation, copying, and all JS integration/unit tests pass.

- [ ] **Step 6: Commit changes**
  Run:
  ```bash
  git add src/lib.rs
  git commit -m "feat(audio): integrate stereo Reverb into Engine and fill_buffers sample loop"
  ```
