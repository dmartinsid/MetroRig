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
