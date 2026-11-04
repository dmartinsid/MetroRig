// The click: a decaying sine, or a loaded sample, on each step of track 0
use crate::dsp::sample::Sample;

pub struct Click {
    sample_rate: f32,
    pub(crate) mode: u32, // 0 = Synth, 1 = Sample
    accent: bool,

    // Synthesis params for click (Oscillator)
    phase: f32,
    freq: f32,
    amp: f32,

    // Sample playback
    pub(crate) sample: Option<Sample>,
    active: bool,
    offset: usize,
}

impl Click {
    pub fn new(sample_rate: f32) -> Self {
        Click {
            sample_rate,
            mode: 0,
            accent: false,
            phase: 0.0,
            freq: 0.0,
            amp: 0.0,
            sample: None,
            active: false,
            offset: 0,
        }
    }

    pub fn set_mode(&mut self, mode: u32) {
        self.mode = mode;
    }

    pub fn load(&mut self, sample: Sample) {
        self.sample = Some(sample);
    }

    pub fn trigger(&mut self, step: u8) {
        if step > 0 {
            self.accent = step == 2;
            if self.mode == 0 {
                self.freq = if self.accent { 880.0 } else { 440.0 };
                self.amp = 1.0;
                self.phase = 0.0;
            } else if self.sample.is_some() {
                self.active = true;
                self.offset = 0;
            }
        }
    }

    pub fn reset(&mut self) {
        self.active = false;
        self.offset = 0;
        self.amp = 0.0;
        self.phase = 0.0;
        self.accent = false;
    }

    // One frame: synthesize the click (decaying sine wave) or play the sample
    pub fn render(&mut self) -> (f32, f32) {
        let mut click_out_l = 0.0;
        let mut click_out_r = 0.0;
        if self.mode == 0 {
            if self.amp > 0.0 {
                let click_out = (self.phase * 2.0 * std::f32::consts::PI).sin() * self.amp;
                self.phase += self.freq / self.sample_rate;
                if self.phase >= 1.0 {
                    self.phase -= 1.0;
                }
                self.amp *= 0.9995; // Decay rate
                if self.amp < 0.001 {
                    self.amp = 0.0;
                }
                click_out_l = click_out * 0.5;
                click_out_r = click_out * 0.5;
            }
        } else if self.active {
            if let Some(ref sample) = self.sample {
                let offset = self.offset;
                if offset < sample.left_channel.len() {
                    let vol = if self.accent { 1.0 } else { 0.5 };
                    click_out_l = sample.left_channel[offset] * vol;
                    click_out_r = sample.right_channel[offset] * vol;
                    self.offset += 1;
                } else {
                    self.active = false;
                }
            } else {
                self.active = false;
            }
        }
        (click_out_l, click_out_r)
    }
}
