#![allow(dead_code)]
use std::slice;

const MAX_SAMPLES: usize = 4; // 0: Click, 1: Kick, 2: Snare, 3: Hi-hat
const STEPS_COUNT: usize = 32;

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

    // Dynamic measure length looping
    measure_length: usize,

    // Step limit timing
    current_step_limit: f64,

    // Sound selection
    click_mode: u32, // 0 = Synth, 1 = Sample
    click_accent: bool,
}

impl Engine {
    pub fn new(sample_rate: f32) -> Self {
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
            measure_length: 16,
            current_step_limit: 0.0,
            click_mode: 0,
            click_accent: false,
        };
        eng.recalc_tempo();
        eng
    }

    pub fn start(&mut self) {
        self.is_playing = true;
        self.step_index = 0;
        self.samples_in_current_step = self.current_step_limit - 1.0; // Trigger first beat immediately
    }

    pub fn stop(&mut self) {
        self.is_playing = false;
    }

    fn recalc_tempo(&mut self) {
        // Assuming 16th notes: 4 steps per beat. 
        // Beats per second = bpm / 60
        // Steps per second = (bpm / 60) * 4
        // Samples per step = sample_rate / steps_per_second
        let steps_per_second = (self.bpm / 60.0) * 4.0;
        self.samples_per_step = self.sample_rate as f64 / steps_per_second;
        self.current_step_limit = self.samples_per_step;
    }

    fn trigger_step(&mut self) {
        self.last_tick_index = self.step_index as i32;
        self.last_tick_bpm = self.bpm;

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
    }

    fn on_measure_complete(&mut self) {
        if self.trainer_enabled && self.trainer_step_type == 0 && self.trainer_curve == 0 {
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
            self.samples_per_step * self.measure_length as f64 * self.trainer_step_value
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
            if self.samples_in_current_step >= self.current_step_limit {
                self.samples_in_current_step -= self.current_step_limit;
                self.trigger_step();
            }

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
            out_l[i] = click_out_l + drums_l;
            out_r[i] = click_out_r + drums_r;
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
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.start();
}

#[no_mangle]
pub extern "C" fn engine_stop(ptr: *mut Engine) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.stop();
}

#[no_mangle]
pub extern "C" fn engine_set_bpm(ptr: *mut Engine, bpm: f64) {
    if ptr.is_null() || bpm <= 0.0 || !bpm.is_finite() { return; }
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
    if ptr.is_null() || left_ptr.is_null() || right_ptr.is_null() || sample_id >= MAX_SAMPLES as u32 { return; }
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
    if ptr.is_null() || steps_ptr.is_null() || sample_id >= MAX_SAMPLES as u32 || length > STEPS_COUNT { return; }
    let engine = unsafe { &mut *ptr };
    let steps_slice = unsafe { slice::from_raw_parts(steps_ptr, length) };
    let track_steps = &mut engine.tracks[sample_id as usize].steps;
    track_steps[..length].copy_from_slice(steps_slice);
    track_steps[length..].fill(0);
}

#[no_mangle]
pub extern "C" fn engine_set_measure_length(ptr: *mut Engine, length: u32) {
    if ptr.is_null() || length == 0 || length > STEPS_COUNT as u32 { return; }
    let engine = unsafe { &mut *ptr };
    engine.measure_length = length as usize;
    if engine.step_index >= engine.measure_length {
        engine.step_index = 0;
    }
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
    if ptr.is_null() { return; }
    if start_bpm <= 0.0 || !start_bpm.is_finite() { return; }
    if target_bpm <= 0.0 || !target_bpm.is_finite() { return; }
    if increment < 0.0 || !increment.is_finite() { return; }
    if step_value <= 0.0 || !step_value.is_finite() { return; }

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
pub extern "C" fn engine_set_click_mode(ptr: *mut Engine, mode: u32) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.click_mode = mode;
}

#[no_mangle]
pub extern "C" fn engine_get_tick(ptr: *mut Engine, out_bpm: *mut f64) -> i32 {
    if ptr.is_null() || out_bpm.is_null() { return -1; }
    let engine = unsafe { &mut *ptr };
    unsafe { *out_bpm = engine.last_tick_bpm; }
    engine.last_tick_index
}

#[no_mangle]
pub extern "C" fn engine_process(ptr: *mut Engine, out_l_ptr: *mut f32, out_r_ptr: *mut f32, length: usize) {
    if ptr.is_null() || out_l_ptr.is_null() || out_r_ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    let out_l = unsafe { slice::from_raw_parts_mut(out_l_ptr, length) };
    let out_r = unsafe { slice::from_raw_parts_mut(out_r_ptr, length) };
    engine.fill_buffers(out_l, out_r);
}

#[no_mangle]
pub extern "C" fn engine_alloc(size: usize) -> *mut u8 {
    let mut buf = vec![0u8; size];
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn engine_free_buf(ptr: *mut u8, size: usize) {
    if !ptr.is_null() {
        unsafe { let _ = Vec::from_raw_parts(ptr, size, size); }
    }
}

// --- UNIT TESTS ---
#[cfg(test)]
mod tests {
    use super::*;

    // --- Black-box harness: a one-sample click read back through the exports ---

    const SR: f32 = 44100.0;
    const BLOCK: u64 = 128; // The size the AudioWorklet renders
    const ROUNDING: f64 = 1e-6;

    #[derive(Clone, Copy)]
    struct Hit {
        pos: u64,
        step: i32,
        bpm: f64,
    }

    struct Run {
        ptr: *mut Engine,
        pos: u64,
        hits: Vec<Hit>,
    }

    impl Run {
        fn new(bpm: f64, grid: &[u8]) -> Run {
            Run::at_rate(SR, bpm, grid)
        }

        // A stopped engine with a one-sample click on every grid step that is set.
        // The grid length sets the measure length.
        fn at_rate(sample_rate: f32, bpm: f64, grid: &[u8]) -> Run {
            let ptr = engine_new(sample_rate);
            engine_set_bpm(ptr, bpm);
            engine_set_click_mode(ptr, 1);
            let impulse = [1.0f32];
            engine_load_sample(ptr, 0, impulse.as_ptr(), impulse.as_ptr(), 1);
            engine_set_measure_length(ptr, grid.len() as u32);
            engine_update_grid(ptr, 0, grid.as_ptr(), grid.len());
            Run { ptr, pos: 0, hits: Vec::new() }
        }

        fn play(&mut self) {
            self.pos = 0;
            self.hits.clear();
            engine_start(self.ptr);
        }

        fn render(&mut self, frames: u64) {
            let mut left = [0.0f32; BLOCK as usize];
            let mut right = [0.0f32; BLOCK as usize];
            let mut remaining = frames;
            while remaining > 0 {
                let block = remaining.min(BLOCK) as usize;
                engine_process(self.ptr, left.as_mut_ptr(), right.as_mut_ptr(), block);
                let mut bpm = 0.0f64;
                let step = engine_get_tick(self.ptr, &mut bpm);
                for i in 0..block {
                    if left[i] != 0.0 {
                        self.hits.push(Hit { pos: self.pos + i as u64, step, bpm });
                    }
                }
                self.pos += block as u64;
                remaining -= block as u64;
            }
        }

        fn render_hits(&mut self, count: usize) {
            while self.hits.len() < count {
                self.render(BLOCK);
            }
        }

        // Samples between hit `k` and the next one.
        fn interval(&self, k: usize) -> f64 {
            (self.hits[k + 1].pos - self.hits[k].pos) as f64
        }
    }

    impl Drop for Run {
        fn drop(&mut self) {
            engine_free(self.ptr);
        }
    }

    fn step_samples(sample_rate: f32, bpm: f64) -> f64 {
        sample_rate as f64 * 60.0 / (bpm * 4.0)
    }

    fn assert_within_one_sample(actual: f64, ideal: f64, what: &str) {
        assert!(
            (actual - ideal).abs() <= 1.0 + ROUNDING,
            "{}: got {}, ideal {}",
            what,
            actual,
            ideal
        );
    }

    // Both output channels, block by block as the worklet renders them.
    fn stereo_output(ptr: *mut Engine, frames: usize) -> (Vec<f32>, Vec<f32>) {
        let mut left = vec![0.0f32; frames];
        let mut right = vec![0.0f32; frames];
        for start in (0..frames).step_by(BLOCK as usize) {
            let block = (frames - start).min(BLOCK as usize);
            let l = left[start..].as_mut_ptr();
            let r = right[start..].as_mut_ptr();
            engine_process(ptr, l, r, block);
        }
        (left, right)
    }

    fn sounding_frames(left: &[f32], right: &[f32]) -> Vec<usize> {
        (0..left.len()).filter(|&i| left[i] != 0.0 || right[i] != 0.0).collect()
    }

    fn quarter_grid() -> [u8; 16] {
        let mut grid = [0u8; 16];
        for step in (0..16).step_by(4) {
            grid[step] = 1;
        }
        grid
    }

    #[test]
    fn time_01_hits_within_one_sample() {
        let integer_bpms = (40..=240).map(|bpm| bpm as f64);
        let fractional_bpms = [97.5, 133.3, 187.7].into_iter();
        for bpm in integer_bpms.chain(fractional_bpms) {
            let frames = 30 * SR as u64;
            let mut run = Run::new(bpm, &[1; 16]);
            run.play();
            run.render(frames);

            let ideal = step_samples(SR, bpm);
            for (k, hit) in run.hits.iter().enumerate() {
                let what = format!("{} BPM, hit {}", bpm, k);
                assert_within_one_sample(hit.pos as f64, k as f64 * ideal, &what);
            }
            let expected_hits = frames as f64 / ideal;
            assert_within_one_sample(run.hits.len() as f64, expected_hits, "hit count");
        }
    }

    #[test]
    fn time_02_one_hour_no_drift() {
        for bpm in [40.0, 97.0, 120.0, 133.0, 187.0, 240.0] {
            let mut run = Run::new(bpm, &quarter_grid());
            run.play();
            run.render(3600 * SR as u64);

            let ideal = step_samples(SR, bpm) * 4.0;
            assert_eq!(run.hits.len() as u64, 60 * bpm as u64, "hit count at {} BPM", bpm);
            for (k, hit) in run.hits.iter().enumerate() {
                let what = format!("{} BPM, hit {}", bpm, k);
                assert_within_one_sample(hit.pos as f64, k as f64 * ideal, &what);
            }
            let last = run.hits.len() - 1;
            let what = format!("{} BPM, final hit", bpm);
            assert_within_one_sample(run.hits[last].pos as f64, last as f64 * ideal, &what);
        }
    }

    #[test]
    fn time_03_every_step_same_duration() {
        for sample_rate in [44100.0, 48000.0] {
            for bpm in [40.0, 97.0, 133.3, 187.0, 240.0] {
                for length in [15usize, 16] {
                    let grid = vec![1u8; length];
                    let mut run = Run::at_rate(sample_rate, bpm, &grid);
                    run.play();
                    run.render(20 * sample_rate as u64);

                    let ideal = step_samples(sample_rate, bpm);
                    for k in 0..run.hits.len() - 1 {
                        assert_eq!(run.hits[k].step as usize, k % length);
                        assert_within_one_sample(run.interval(k), ideal, "step duration");
                    }
                }
            }
        }
    }

    #[test]
    fn bpm_01_quarter_note_in_every_meter() {
        // Steps per measure for 2/4, 3/4, 4/4, 5/4, 6/8, 7/8 and 12/8.
        for length in [8usize, 12, 16, 20, 12, 14, 24] {
            for bpm in [60.0, 97.0, 135.0, 195.0] {
                let grid = vec![1u8; length];
                let mut run = Run::new(bpm, &grid);
                run.play();
                run.render(30 * SR as u64);

                let quarter = SR as f64 * 60.0 / bpm;
                for (k, hit) in run.hits.iter().step_by(4).enumerate() {
                    let what = format!("{} steps at {} BPM, quarter {}", length, bpm, k);
                    assert_within_one_sample(hit.pos as f64, k as f64 * quarter, &what);
                }
            }
        }

        // A 12/8 click every 6 steps lands every dotted quarter: 2/3 of the BPM per minute.
        for (bpm, clicks_per_minute) in [(135.0, 90), (195.0, 130)] {
            let mut grid = [0u8; 24];
            for step in (0..24).step_by(6) {
                grid[step] = 1;
            }
            let mut run = Run::new(bpm, &grid);
            run.play();
            run.render(60 * SR as u64);
            assert_eq!(run.hits.len(), clicks_per_minute);
        }
    }

    #[test]
    fn click_01_accent_has_no_echo() {
        let mut grid = [0u8; 16];
        grid[0] = 2; // The next hit is one bar away, at frame 88200
        let bar = 88200;

        // Sample click: one accented impulse stays one sample.
        let run = Run::new(120.0, &grid);
        engine_start(run.ptr);
        let (left, right) = stereo_output(run.ptr, bar);
        assert_eq!(sounding_frames(&left, &right), vec![0]);

        // Synth click: amplitude decays by 0.9995 per frame to the 0.001 floor, about
        // 13812 frames. Nothing may sound after that.
        let run = Run::new(120.0, &grid);
        engine_set_click_mode(run.ptr, 0);
        engine_start(run.ptr);
        let (left, right) = stereo_output(run.ptr, bar);
        let sounding = sounding_frames(&left, &right);
        assert!(*sounding.last().unwrap() < 14000, "sound at {:?}", sounding.last());
    }

    #[test]
    fn test_engine_init() {
        let engine = Engine::new(44100.0);
        assert_eq!(engine.bpm, 120.0);
        assert_eq!(engine.is_playing, false);
        
        // Verify recalc_tempo correctly computes step size
        // At 120 BPM: 2 beats/sec -> 8 steps/sec. At 44100Hz, samples per step = 44100 / 8 = 5512.5
        assert_eq!(engine.samples_per_step, 5512.5);
    }

    #[test]
    fn test_click_synthesis() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        engine.tracks[0].steps[0] = 2; // Accent click on step 0
        
        let mut buf_l = vec![0.0f32; 100];
        let mut buf_r = vec![0.0f32; 100];
        
        engine.fill_buffers(&mut buf_l, &mut buf_r);
        // Left buffer should contain non-zero synthesized sine samples (sin(0.0) is 0.0, so buf_l[0] is 0.0, but buf_l[1] is non-zero)
        assert!(buf_l[1] != 0.0);
        assert_eq!(buf_l[1], buf_r[1]); // mono click is centered (* 0.5 to both)
    }

    #[test]
    fn test_drum_sample_trigger() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        engine.tracks[1].steps[0] = 1; // Trigger kick drum on step 0
        
        let left_sample = vec![0.5f32, 1.0f32, 0.5f32];
        let right_sample = vec![-0.5f32, -1.0f32, -0.5f32];
        
        engine.samples[1] = Some(Sample {
            left_channel: left_sample,
            right_channel: right_sample,
        });

        let mut buf_l = vec![0.0f32; 3];
        let mut buf_r = vec![0.0f32; 3];
        
        engine.fill_buffers(&mut buf_l, &mut buf_r);
        
        // At 44100Hz and 120BPM, the step duration is 5512.5 samples.
        // It triggers step 0 immediately since current step starts at 0.0 and triggers.
        // Let's verify that the output contains the sample multiplied by the playback volume (1.0 for kick)
        assert_eq!(buf_l[0], 0.5);
        assert_eq!(buf_r[0], -0.5);
        assert_eq!(buf_l[1], 1.0);
        assert_eq!(buf_r[1], -1.0);
    }

    #[test]
    fn test_trainer_stepped_measures() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // 120 BPM, target 130 BPM, increment 5.0, stepped curve, measures mode (step_value = 2.0 measures)
        engine.trainer_enabled = true;
        engine.trainer_start_bpm = 120.0;
        engine.trainer_target_bpm = 130.0;
        engine.trainer_increment = 5.0;
        engine.trainer_step_type = 0; // Measures
        engine.trainer_step_value = 2.0;
        engine.trainer_curve = 0; // Stepped

        // Let's manually trigger complete measures to check the trainer.
        // 1 measure has 16 steps.
        // 2 measures have 32 steps.
        // Let's call trigger_step 32 times.
        // Note: engine.start() sets step_index to 0, but trigger_step increments it and runs end-of-measure logic.
        // So 32 triggers will cover step_index going 0 -> 15 (end of 1st measure, trigger_step does on_measure_complete, step_index becomes 0)
        // Then step_index goes 0 -> 15 (end of 2nd measure, trigger_step does on_measure_complete, step_index becomes 0)
        for _ in 0..31 {
            engine.trigger_step();
            assert_eq!(engine.bpm, 120.0); // Not incremented yet
        }
        
        // The 32nd trigger completes the second measure
        engine.trigger_step();
        assert_eq!(engine.bpm, 125.0); // Incremented by 5.0

        // Complete another 2 measures (32 more triggers)
        for _ in 0..32 {
            engine.trigger_step();
        }
        assert_eq!(engine.bpm, 130.0); // Incremented to target

        // Complete another 2 measures: should clamp at target (130)
        for _ in 0..32 {
            engine.trigger_step();
        }
        assert_eq!(engine.bpm, 130.0); // Clamped at target
    }

    #[test]
    fn test_trainer_stepped_seconds() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // 120 BPM, target 130 BPM, increment 5.0, stepped curve, seconds mode (step_value = 0.01 seconds -> 441 samples)
        engine.trainer_enabled = true;
        engine.trainer_start_bpm = 120.0;
        engine.trainer_target_bpm = 130.0;
        engine.trainer_increment = 5.0;
        engine.trainer_step_type = 1; // Seconds
        engine.trainer_step_value = 0.01;
        engine.trainer_curve = 0; // Stepped

        let mut buf_l = vec![0.0f32; 440];
        let mut buf_r = vec![0.0f32; 440];

        engine.fill_buffers(&mut buf_l, &mut buf_r);
        assert_eq!(engine.bpm, 120.0); // Not incremented yet (only 440 samples processed)

        // Process 1 more sample to reach 441
        let mut single_l = vec![0.0f32; 1];
        let mut single_r = vec![0.0f32; 1];
        engine.fill_buffers(&mut single_l, &mut single_r);
        assert_eq!(engine.bpm, 125.0); // Incremented by 5.0
    }

    #[test]
    fn test_trainer_smooth_seconds() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // 120 BPM, target 130 BPM, increment 5.0, smooth curve, seconds mode (step_value = 1.0 second -> 44100 samples)
        engine.trainer_enabled = true;
        engine.trainer_start_bpm = 120.0;
        engine.trainer_target_bpm = 130.0;
        engine.trainer_increment = 5.0;
        engine.trainer_step_type = 1; // Seconds
        engine.trainer_step_value = 1.0;
        engine.trainer_curve = 1; // Smooth

        let mut buf_l = vec![0.0f32; 44100];
        let mut buf_r = vec![0.0f32; 44100];

        engine.fill_buffers(&mut buf_l, &mut buf_r);
        // After 1 second (44100 samples), BPM should have increased by approximately 5.0
        // (Since it recalculates samples per step dynamically, the linear increment is very close)
        assert!((engine.bpm - 125.0).abs() < 0.1);
    }

    #[test]
    fn test_raw_ffi() {
        let ptr = engine_new(44100.0);
        assert!(!ptr.is_null());
        
        engine_set_bpm(ptr, 135.0);
        let mut out_bpm = 0.0f64;
        let tick = engine_get_tick(ptr, &mut out_bpm);
        assert_eq!(tick, -1);
        
        // Set trainer
        engine_set_trainer(ptr, true, 135.0, 150.0, 5.0, 0, 4.0, 0);
        
        // Test update grid and load sample
        let steps = [1u8; 32];
        engine_update_grid(ptr, 0, steps.as_ptr(), 32);
        
        let sample_l = vec![0.1f32; 100];
        let sample_r = vec![0.1f32; 100];
        engine_load_sample(ptr, 1, sample_l.as_ptr(), sample_r.as_ptr(), 100);
        
        engine_start(ptr);
        
        let mut out_l = vec![0.0f32; 500];
        let mut out_r = vec![0.0f32; 500];
        engine_process(ptr, out_l.as_mut_ptr(), out_r.as_mut_ptr(), 500);
        
        engine_stop(ptr);
        engine_free(ptr);
    }

    #[test]
    fn test_measure_length_looping() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // Update measure length to 12 steps (3/4 time signature)
        engine_set_measure_length(&mut engine as *mut Engine, 12);
        
        // Manually trigger steps. Triggering 12 times should loop the step_index from 0 to 11 and back to 0.
        for _ in 0..11 {
            engine.trigger_step();
        }
        assert_eq!(engine.step_index, 11);
        
        // The 12th trigger should wrap step_index back to 0
        engine.trigger_step();
        assert_eq!(engine.step_index, 0);
    }

    #[test]
    fn test_measure_total_duration_no_drift() {
        // Test both even and odd lengths
        for length in [12, 15, 16, 20] {
            let mut engine = Engine::new(44100.0);
            engine.measure_length = length;
            engine.start();
            
            let mut total_limit = 0.0;
            for _ in 0..length {
                total_limit += engine.current_step_limit;
                engine.trigger_step();
            }
            
            let expected_total = engine.samples_per_step * (length as f64);
            assert!((total_limit - expected_total).abs() < 1e-5, "Drift detected on length {}: total_limit={}, expected={}", length, total_limit, expected_total);
        }
    }

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

    #[test]
    fn test_click_sample_playback() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // Load dummy click sample (slot 0)
        let sample_l = vec![0.2f32, 0.4f32, 0.6f32];
        let sample_r = vec![-0.2f32, -0.4f32, -0.6f32];
        engine.samples[0] = Some(Sample {
            left_channel: sample_l.clone(),
            right_channel: sample_r.clone(),
        });
        
        // Switch to click mode 1 (sample mode)
        engine_set_click_mode(&mut engine as *mut Engine, 1);
        
        // Set accent click on step 0
        engine.tracks[0].steps[0] = 2; // Accent
        
        let mut buf_l = vec![0.0f32; 3];
        let mut buf_r = vec![0.0f32; 3];
        
        engine.fill_buffers(&mut buf_l, &mut buf_r);
        
        // Accent volume is 1.0, and since reverb only outputs the wet (which is initially 0),
        // the parallel mix output is simply the dry click sample.
        assert_eq!(buf_l[0], 0.2);
        assert_eq!(buf_r[0], -0.2);
        assert_eq!(buf_l[1], 0.4);
        assert_eq!(buf_r[1], -0.4);
        assert_eq!(buf_l[2], 0.6);
        assert_eq!(buf_r[2], -0.6);

        // Now test non-accented click (volume is 0.5)
        engine.tracks[0].steps[1] = 1; // Normal click
        
        engine.trigger_step(); // Triggers step 1 manually, increments to step 2
        
        let mut buf_l2 = vec![0.0f32; 3];
        let mut buf_r2 = vec![0.0f32; 3];
        
        engine.fill_buffers(&mut buf_l2, &mut buf_r2);
        
        assert_eq!(buf_l2[0], 0.2 * 0.5);
        assert_eq!(buf_r2[0], -0.2 * 0.5);
        assert_eq!(buf_l2[1], 0.4 * 0.5);
        assert_eq!(buf_r2[1], -0.4 * 0.5);
    }
}
