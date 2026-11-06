use crate::dsp::sample::trim_onset;
use crate::instruments::click::Click;
use crate::instruments::drums::{Drums, DYNAMICS, HI_HAT_TRACK, OPEN_HAT_TRACK, TAKES, TRACKS};
use crate::instruments::pad::Pad;
use crate::sequencer::clock::Clock;
use crate::sequencer::pattern::Pattern;
use crate::sequencer::trainer::Trainer;
pub use crate::sequencer::pattern::STEPS_COUNT;
pub use crate::sequencer::trainer::{Curve, StepType, TrainerSettings};

// The pattern and the kit count the same tracks, though neither layer may name the other
const _: () = assert!(crate::sequencer::pattern::TRACKS == crate::instruments::drums::TRACKS);

pub struct Engine {
    pub(crate) sample_rate: f32,
    pub(crate) is_playing: bool,
    pub(crate) current_sample_index: u64,
    pub(crate) clock: Clock,

    // Instruments
    pub(crate) click: Click,
    pub(crate) drums: Drums,

    // Sequencer Grid
    pub(crate) pattern: Pattern,

    // Tempo Trainer State
    pub(crate) trainer: Trainer,
    
    // Events queued for Javascript
    pub(crate) last_tick_index: i32, // -1 if no tick in last process
    pub(crate) last_tick_bpm: f64,

    pub(crate) pad: Pad,
}

impl Engine {
    pub fn new(sample_rate: f32) -> Self {
        Engine {
            sample_rate,
            is_playing: false,
            current_sample_index: 0,
            clock: Clock::new(sample_rate),
            click: Click::new(sample_rate),
            drums: Drums::new(sample_rate),
            pattern: Pattern::new(),
            trainer: Trainer::new(),
            last_tick_index: -1,
            last_tick_bpm: 120.0,
            pad: Pad::new(sample_rate),
        }
    }

    pub fn start(&mut self) {
        if let Some(bpm) = self.trainer.on_start(self.is_playing) {
            self.clock.set_bpm(bpm);
        }

        self.drums.reset();
        self.click.reset();

        self.is_playing = true;
        self.pattern.restart();
        self.clock.start();
    }

    pub fn stop(&mut self) {
        self.is_playing = false;
        self.drums.stop();
    }

    pub fn set_bpm(&mut self, bpm: f64) {
        self.clock.set_bpm(bpm);
    }

    // Track 0 is the click; any other track below TRACKS is a drum
    pub fn load_sample(&mut self, track: usize, left: &[f32], right: &[f32]) {
        if track >= TRACKS { return; }
        let sample = trim_onset(left, right);
        if track == 0 {
            self.click.load(sample);
        } else {
            self.drums.load_sample(track, sample);
        }
    }

    // Dynamic: 0 Ghost, 1 Normal, 2 Accent
    pub fn load_take(&mut self, track: usize, dynamic: usize, take: usize, left: &[f32], right: &[f32]) {
        if track >= TRACKS || dynamic >= DYNAMICS || take >= TAKES { return; }
        self.drums.load_take(track, dynamic, take, trim_onset(left, right));
    }

    pub fn update_grid(&mut self, track: usize, steps: &[u8]) {
        if track >= TRACKS || steps.len() > STEPS_COUNT { return; }
        self.pattern.update_grid(track, steps);
    }

    pub fn set_measure_length(&mut self, length: usize) {
        self.pattern.set_measure_length(length);
    }

    // The next step plays bar 1, on the pulse already running: nothing stops or starts
    pub fn restart_pattern(&mut self) {
        self.pattern.restart();
    }

    pub fn set_bars(&mut self, bars: usize) {
        self.pattern.set_bars(bars);
    }

    pub fn set_click_mode(&mut self, mode: u32) {
        self.click.set_mode(mode);
    }

    pub fn pad_mut(&mut self) -> &mut Pad {
        &mut self.pad
    }

    // The step that sounded in the last block (-1 if none) and the tempo it sounded at
    pub fn tick(&self) -> (i32, f64) {
        (self.last_tick_index, self.last_tick_bpm)
    }

    pub(crate) fn trigger_step(&mut self) {
        if self.pattern.is_bar_start() {
            let first = self.clock.end_first_hit();
            if let Some(bpm) = self.trainer.on_bar_start(first, self.clock.bpm(), self.sample_rate) {
                self.clock.set_bpm(bpm);
            }
        }

        self.last_tick_index = self.pattern.index() as i32;
        self.last_tick_bpm = self.clock.bpm();

        // Check click track
        self.click.trigger(self.pattern.step(0));

        // A closing hat cuts the open one, as on a real stand
        if self.pattern.step(HI_HAT_TRACK) > 0 {
            self.drums.choke(OPEN_HAT_TRACK);
        }

        // Check the drum tracks
        for i in 1..TRACKS {
            let step = self.pattern.step(i);
            if step > 0 {
                self.drums.trigger(i, step);
            }
        }

        // Update step index
        self.pattern.advance();
    }

    // A preset load: the old Trainer stops now, and its counters go with it.
    pub fn replace_trainer(&mut self, settings: TrainerSettings) {
        self.trainer.replace(settings, self.is_playing);
    }

    pub fn set_trainer(&mut self, settings: TrainerSettings) {
        self.trainer.set(settings, self.is_playing);
    }

    fn process_tick_samples(&mut self) {
        let clock = &self.clock;
        let next = self.trainer.on_frame(clock.bpm(), clock.samples_per_step(), self.pattern.measure_length(), self.sample_rate);
        if let Some(bpm) = next {
            self.clock.set_bpm(bpm);
        }
    }

    pub fn fill_buffers(&mut self, out_l: &mut [f32], out_r: &mut [f32]) {
        self.last_tick_index = -1;
        if !self.is_playing {
            out_l.fill(0.0);
            out_r.fill(0.0);
            self.mix_pad(out_l, out_r);
            return;
        }

        let len = out_l.len();
        for i in 0..len {
            // 1. Process timing
            if !self.clock.is_first_hit() {
                self.process_tick_samples();
            }
            if self.clock.advance() {
                self.trigger_step(); // The first hit has no time to wait, whatever the tempo
            }

            // 2. Synthesize Click (decaying sine wave) or Play Sample
            let (click_out_l, click_out_r) = self.click.render();

            // 3. Play Drum Samples
            let (drums_l, drums_r) = self.drums.render();

            // Combine (Left / Right)
            out_l[i] = click_out_l + drums_l;
            out_r[i] = click_out_r + drums_r;
        }
        self.mix_pad(out_l, out_r);
    }

    // The pad runs on after the drums' loop, so it never reaches their timing
    fn mix_pad(&mut self, out_l: &mut [f32], out_r: &mut [f32]) {
        self.pad.mix_into(out_l, out_r);
        for sample in out_l.iter_mut().chain(out_r.iter_mut()) {
            *sample = sample.clamp(-1.0, 1.0);
        }
    }
}

// White-box tests of the mix: each builds an Engine and reads its fields. The tests through the exports sit in ffi_tests.rs
#[cfg(test)]
mod tests {
    use super::*;
    use crate::dsp::sample::Sample;
    use crate::instruments::drums::GAIN_NORMAL;

    #[test]
    fn test_engine_init() {
        let engine = Engine::new(44100.0);
        assert_eq!(engine.clock.bpm, 120.0);
        assert_eq!(engine.is_playing, false);

        // Verify recalc_tempo correctly computes step size
        // At 120 BPM: 2 beats/sec -> 8 steps/sec. At 44100Hz, samples per step = 44100 / 8 = 5512.5
        assert_eq!(engine.clock.samples_per_step, 5512.5);
    }

    #[test]
    fn test_click_synthesis() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        engine.pattern.tracks[0].steps[0] = 2; // Accent click on step 0

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
        engine.pattern.tracks[1].steps[0] = 1; // Trigger kick drum on step 0

        let left_sample = vec![0.5f32, 1.0f32, 0.5f32];
        let right_sample = vec![-0.5f32, -1.0f32, -0.5f32];

        engine.drums.samples[1] = Some(Sample {
            left_channel: left_sample,
            right_channel: right_sample,
        });

        let mut buf_l = vec![0.0f32; 3];
        let mut buf_r = vec![0.0f32; 3];

        engine.fill_buffers(&mut buf_l, &mut buf_r);

        // At 44100Hz and 120BPM, the step duration is 5512.5 samples.
        // It triggers step 0 immediately since current step starts at 0.0 and triggers.
        // Let's verify that the output contains the sample multiplied by the playback volume (1.0 for kick)
        // and by the normal dynamic
        assert_eq!(buf_l[0], 0.5 * GAIN_NORMAL);
        assert_eq!(buf_r[0], -0.5 * GAIN_NORMAL);
        assert_eq!(buf_l[1], 1.0 * GAIN_NORMAL);
        assert_eq!(buf_r[1], -1.0 * GAIN_NORMAL);
    }

    #[test]
    fn test_trainer_stepped_measures() {
        let mut engine = Engine::new(44100.0);
        engine.start();

        // 120 BPM, target 130 BPM, increment 5.0, stepped curve, measures mode (step_value = 2.0 measures)
        engine.trainer.settings.enabled = true;
        engine.trainer.settings.start_bpm = 120.0;
        engine.trainer.settings.target_bpm = 130.0;
        engine.trainer.settings.increment = 5.0;
        engine.trainer.settings.step_type = StepType::Bars;
        engine.trainer.settings.step_value = 2.0;
        engine.trainer.settings.curve = Curve::Stepped;

        // 1 measure has 16 steps, so 2 measures have 32 steps.
        // The first hit of a run finishes no measure. The next step 0 is trigger 17, and the
        // one after it, trigger 33, is the beat 1 that ends the second measure.
        for _ in 0..32 {
            engine.trigger_step();
            assert_eq!(engine.clock.bpm, 120.0); // Not incremented yet
        }

        // Trigger 33 fires beat 1 at the new BPM
        engine.trigger_step();
        assert_eq!(engine.clock.bpm, 125.0); // Incremented by 5.0
        assert_eq!(engine.last_tick_bpm, 125.0);

        // Complete another 2 measures (32 more triggers)
        for _ in 0..31 {
            engine.trigger_step();
            assert_eq!(engine.clock.bpm, 125.0);
        }
        engine.trigger_step();
        assert_eq!(engine.clock.bpm, 130.0); // Incremented to target

        // Complete another 2 measures: should clamp at target (130)
        for _ in 0..32 {
            engine.trigger_step();
        }
        assert_eq!(engine.clock.bpm, 130.0); // Clamped at target
    }

    #[test]
    fn test_trainer_stepped_seconds() {
        let mut engine = Engine::new(44100.0);
        engine.start();

        // 120 BPM, target 130 BPM, increment 5.0, stepped curve, seconds mode (step_value = 0.01 seconds -> 441 samples)
        engine.trainer.settings.enabled = true;
        engine.trainer.settings.start_bpm = 120.0;
        engine.trainer.settings.target_bpm = 130.0;
        engine.trainer.settings.increment = 5.0;
        engine.trainer.settings.step_type = StepType::Seconds;
        engine.trainer.settings.step_value = 0.01;
        engine.trainer.settings.curve = Curve::Stepped;

        // The first hit starts the run, so the 441 samples pass with BPM unchanged.
        let mut buf_l = vec![0.0f32; 441];
        let mut buf_r = vec![0.0f32; 441];
        engine.fill_buffers(&mut buf_l, &mut buf_r);
        assert_eq!(engine.clock.bpm, 120.0);

        // The increment still waits for beat 1, 88200 samples in (2 s at 120 BPM).
        let mut rest_l = vec![0.0f32; 88200 - 441];
        let mut rest_r = vec![0.0f32; 88200 - 441];
        engine.fill_buffers(&mut rest_l, &mut rest_r);
        assert_eq!(engine.clock.bpm, 120.0);

        // Process 1 more sample to reach beat 1
        let mut single_l = vec![0.0f32; 1];
        let mut single_r = vec![0.0f32; 1];
        engine.fill_buffers(&mut single_l, &mut single_r);
        assert_eq!(engine.clock.bpm, 125.0); // Incremented by 5.0
        assert_eq!(engine.last_tick_index, 0);
    }

    #[test]
    fn test_trainer_smooth_seconds() {
        let mut engine = Engine::new(44100.0);
        engine.start();

        // 120 BPM, target 130 BPM, increment 5.0, smooth curve, seconds mode (step_value = 1.0 second -> 44100 samples)
        engine.trainer.settings.enabled = true;
        engine.trainer.settings.start_bpm = 120.0;
        engine.trainer.settings.target_bpm = 130.0;
        engine.trainer.settings.increment = 5.0;
        engine.trainer.settings.step_type = StepType::Seconds;
        engine.trainer.settings.step_value = 1.0;
        engine.trainer.settings.curve = Curve::Smooth;

        let mut buf_l = vec![0.0f32; 44100];
        let mut buf_r = vec![0.0f32; 44100];

        engine.fill_buffers(&mut buf_l, &mut buf_r);
        // After 1 second (44100 samples), BPM should have increased by approximately 5.0
        // (Since it recalculates samples per step dynamically, the linear increment is very close)
        assert!((engine.clock.bpm - 125.0).abs() < 0.1);
    }

    #[test]
    fn test_measure_length_looping() {
        let mut engine = Engine::new(44100.0);
        engine.start();

        // Update measure length to 12 steps (3/4 time signature)
        engine.set_measure_length(12);

        // Manually trigger steps. Triggering 12 times should loop the step_index from 0 to 11 and back to 0.
        for _ in 0..11 {
            engine.trigger_step();
        }
        assert_eq!(engine.pattern.step_index, 11);

        // The 12th trigger should wrap step_index back to 0
        engine.trigger_step();
        assert_eq!(engine.pattern.step_index, 0);
    }

    #[test]
    fn test_measure_total_duration_no_drift() {
        // Test both even and odd lengths
        for length in [12, 15, 16, 20] {
            let mut engine = Engine::new(44100.0);
            engine.pattern.measure_length = length;
            engine.start();

            let mut total_limit = 0.0;
            for _ in 0..length {
                total_limit += engine.clock.samples_per_step;
                engine.trigger_step();
            }

            let expected_total = engine.clock.samples_per_step * (length as f64);
            assert!((total_limit - expected_total).abs() < 1e-5, "Drift detected on length {}: total_limit={}, expected={}", length, total_limit, expected_total);
        }
    }

    #[test]
    fn test_click_mode_switching() {
        let mut engine = Engine::new(44100.0);
        engine.start();

        // Default mode is synth (0)
        assert_eq!(engine.click.mode, 0);

        // Switch to sample mode (1)
        engine.set_click_mode(1);
        assert_eq!(engine.click.mode, 1);
    }

    #[test]
    fn test_click_sample_playback() {
        let mut engine = Engine::new(44100.0);
        engine.start();

        // Load dummy click sample (slot 0)
        let sample_l = vec![0.2f32, 0.4f32, 0.6f32];
        let sample_r = vec![-0.2f32, -0.4f32, -0.6f32];
        engine.click.sample = Some(Sample {
            left_channel: sample_l.clone(),
            right_channel: sample_r.clone(),
        });

        // Switch to click mode 1 (sample mode)
        engine.set_click_mode(1);

        // Set accent click on step 0
        engine.pattern.tracks[0].steps[0] = 2; // Accent

        let mut buf_l = vec![0.0f32; 3];
        let mut buf_r = vec![0.0f32; 3];

        engine.fill_buffers(&mut buf_l, &mut buf_r);

        // Accent volume is 1.0, so the output is simply the dry click sample.
        assert_eq!(buf_l[0], 0.2);
        assert_eq!(buf_r[0], -0.2);
        assert_eq!(buf_l[1], 0.4);
        assert_eq!(buf_r[1], -0.4);
        assert_eq!(buf_l[2], 0.6);
        assert_eq!(buf_r[2], -0.6);

        // Now test non-accented click (volume is 0.5)
        engine.pattern.tracks[0].steps[1] = 1; // Normal click

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
