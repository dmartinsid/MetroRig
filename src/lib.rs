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

    // Swing and step limit timing
    swing: f64,
    current_step_limit: f64,
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
            swing: 0.0,
            current_step_limit: 0.0,
        };
        eng.recalc_tempo();
        eng
    }

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
        self.current_step_limit = if self.step_index % 2 == 0 {
            self.samples_per_step * (1.0 + self.swing)
        } else {
            self.samples_per_step * (1.0 - self.swing)
        };
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
pub extern "C" fn engine_set_swing(ptr: *mut Engine, swing: f64) {
    if ptr.is_null() || swing < 0.0 || swing > 0.5 || !swing.is_finite() { return; }
    let engine = unsafe { &mut *ptr };
    engine.swing = swing;
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
    if ptr.is_null() || steps_ptr.is_null() || sample_id >= MAX_SAMPLES as u32 || length != STEPS_COUNT { return; }
    let engine = unsafe { &mut *ptr };
    let steps_slice = unsafe { slice::from_raw_parts(steps_ptr, length) };
    engine.tracks[sample_id as usize].steps.copy_from_slice(steps_slice);
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
}
