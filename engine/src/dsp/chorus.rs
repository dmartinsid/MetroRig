use std::f32::consts::TAU;

// Demo 2's ffmpeg chorus, `0.6:0.9:45|60|75:0.35|0.3|0.3:0.15|0.23|0.31:2|2.5|3`, in opposite phase left and right.
// Each tap's delay swings from its base up by its depth.
// SPEC_DEVIATION: the taps sit at half the demo's level, and COMB_FEEDBACK and REVERB_WET in reverb.rs below demo 3's 0.9 and 0.1
// Reason: at the demos' values both colour some notes more than others, past PAD-14's 3 dB and PAD-07's 5 cents
const CHORUS_TAPS: usize = 3;
const CHORUS_DELAY_MS: [f32; CHORUS_TAPS] = [45.0, 60.0, 75.0];
const CHORUS_DEPTH_MS: [f32; CHORUS_TAPS] = [2.0, 2.5, 3.0];
const CHORUS_RATE_HZ: [f32; CHORUS_TAPS] = [0.15, 0.23, 0.31];
const CHORUS_TAP_GAIN: [f32; CHORUS_TAPS] = [0.175, 0.15, 0.15];
const CHORUS_DRY: f32 = 0.6;
const CHORUS_OUTPUT: f32 = 0.9;

pub struct Chorus {
    left: Vec<f32>,
    right: Vec<f32>,
    write: usize,
    phases: [f32; CHORUS_TAPS],
    steps: [f32; CHORUS_TAPS], // Phase per frame
    delays: [f32; CHORUS_TAPS], // Frames
    depths: [f32; CHORUS_TAPS], // Frames
}

impl Chorus {
    pub fn new(sample_rate: f32) -> Chorus {
        let frames = |ms: f32| ms * sample_rate / 1000.0;
        let length = (frames(CHORUS_DELAY_MS[2] + CHORUS_DEPTH_MS[2]) as usize) + 2;
        Chorus {
            left: vec![0.0; length],
            right: vec![0.0; length],
            write: 0,
            phases: [0.0; CHORUS_TAPS],
            steps: CHORUS_RATE_HZ.map(|hz| hz / sample_rate),
            delays: CHORUS_DELAY_MS.map(frames),
            depths: CHORUS_DEPTH_MS.map(frames),
        }
    }

    pub fn run(&mut self, left: f32, right: f32) -> (f32, f32) {
        self.left[self.write] = left;
        self.right[self.write] = right;
        let (mut wet_left, mut wet_right) = (0.0, 0.0);
        for tap in 0..CHORUS_TAPS {
            self.phases[tap] = (self.phases[tap] + self.steps[tap]).fract();
            let swing = (TAU * self.phases[tap]).sin();
            let delay_left = self.delays[tap] + self.depths[tap] * (1.0 + swing) * 0.5;
            let delay_right = self.delays[tap] + self.depths[tap] * (1.0 - swing) * 0.5;
            wet_left += CHORUS_TAP_GAIN[tap] * read_delayed(&self.left, self.write, delay_left);
            wet_right += CHORUS_TAP_GAIN[tap] * read_delayed(&self.right, self.write, delay_right);
        }
        self.write = (self.write + 1) % self.left.len();
        ((left * CHORUS_DRY + wet_left) * CHORUS_OUTPUT, (right * CHORUS_DRY + wet_right) * CHORUS_OUTPUT)
    }

    pub fn clear(&mut self) {
        self.left.fill(0.0);
        self.right.fill(0.0);
    }
}

fn read_delayed(line: &[f32], write: usize, delay: f32) -> f32 {
    let length = line.len();
    let whole = delay as usize;
    let fraction = delay - whole as f32;
    let nearer = line[(write + length - whole) % length];
    let farther = line[(write + 2 * length - whole - 1) % length];
    nearer + fraction * (farther - nearer)
}
