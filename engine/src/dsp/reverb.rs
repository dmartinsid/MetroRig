// Demo 3's reverb, its lengths in frames at 44.1 kHz
const COMB_FRAMES: [[usize; 4]; 2] = [[3114, 3234, 2982, 2844], [3160, 3280, 3028, 2890]];
const ALL_PASS_FRAMES: [[usize; 2]; 2] = [[556, 441], [579, 464]];
const COMB_FEEDBACK: f32 = 0.87;
const COMB_DAMPING: f32 = 0.4;
pub const REVERB_DRY: f32 = 0.7;
const REVERB_WET: f32 = 0.08;

struct Comb {
    line: Vec<f32>,
    index: usize,
    damped: f32,
}

impl Comb {
    fn run(&mut self, input: f32) -> f32 {
        let output = self.line[self.index];
        self.damped = output * (1.0 - COMB_DAMPING) + self.damped * COMB_DAMPING;
        self.line[self.index] = input + self.damped * COMB_FEEDBACK;
        self.index = (self.index + 1) % self.line.len();
        output
    }
}

struct AllPass {
    line: Vec<f32>,
    index: usize,
}

impl AllPass {
    fn run(&mut self, input: f32) -> f32 {
        let delayed = self.line[self.index];
        self.line[self.index] = input + delayed * 0.5;
        self.index = (self.index + 1) % self.line.len();
        delayed - input
    }
}

pub struct Reverb {
    combs: [[Comb; 4]; 2], // Left, right
    all_passes: [[AllPass; 2]; 2],
}

impl Reverb {
    pub fn new(sample_rate: f32) -> Reverb {
        let scaled = |frames: usize| (frames as f32 * sample_rate / 44100.0) as usize;
        Reverb {
            combs: COMB_FRAMES.map(|lengths| lengths.map(|length| Comb { line: vec![0.0; scaled(length)], index: 0, damped: 0.0 })),
            all_passes: ALL_PASS_FRAMES.map(|lengths| lengths.map(|length| AllPass { line: vec![0.0; scaled(length)], index: 0 })),
        }
    }

    pub fn run(&mut self, left: f32, right: f32) -> (f32, f32) {
        let input = (left + right) * 0.5;
        let mut channel = |side: usize| {
            let wet: f32 = self.combs[side].iter_mut().map(|comb| comb.run(input)).sum();
            self.all_passes[side].iter_mut().fold(wet, |signal, all_pass| all_pass.run(signal))
        };
        let (wet_left, wet_right) = (channel(0), channel(1));
        (left * REVERB_DRY + wet_left * REVERB_WET, right * REVERB_DRY + wet_right * REVERB_WET)
    }

    pub fn clear(&mut self) {
        for comb in self.combs.iter_mut().flatten() {
            comb.line.fill(0.0);
            comb.damped = 0.0;
        }
        for all_pass in self.all_passes.iter_mut().flatten() {
            all_pass.line.fill(0.0);
        }
    }
}
