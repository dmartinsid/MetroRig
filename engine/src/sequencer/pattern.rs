// What each step of each track holds, and which step plays next
pub const TRACKS: usize = 13; // 0: Click, then the kit in src/domain/kit.ts
pub const STEPS_COUNT: usize = 128; // 4 bars of the longest bar
pub const BAR_STEPS_MAX: usize = 32;
pub const BARS_MAX: usize = 4;

pub struct SequencerTrack {
    pub(crate) steps: [u8; STEPS_COUNT], // 0 = Off, 1 = Low, 2 = High
}

pub struct Pattern {
    pub(crate) tracks: [SequencerTrack; TRACKS],
    pub(crate) step_index: usize,
    pub(crate) measure_length: usize, // The steps of one bar
    pub(crate) bars: usize,
}

impl Pattern {
    pub fn new() -> Self {
        Pattern {
            tracks: std::array::from_fn(|_| SequencerTrack { steps: [0; STEPS_COUNT] }),
            step_index: 0,
            measure_length: 16,
            bars: 1,
        }
    }

    // The steps past the given ones are cleared
    pub fn update_grid(&mut self, track: usize, steps: &[u8]) -> bool {
        if track >= TRACKS || steps.len() > STEPS_COUNT {
            return false;
        }
        let track_steps = &mut self.tracks[track].steps;
        track_steps[..steps.len()].copy_from_slice(steps);
        track_steps[steps.len()..].fill(0);
        true
    }

    pub fn set_measure_length(&mut self, length: usize) -> bool {
        if length == 0 || length > BAR_STEPS_MAX {
            return false;
        }
        self.measure_length = length;
        if self.step_index >= self.length() {
            self.step_index = 0;
        }
        true
    }

    pub fn set_bars(&mut self, bars: usize) -> bool {
        if bars == 0 || bars > BARS_MAX {
            return false;
        }
        self.bars = bars;
        if self.step_index >= self.length() {
            self.step_index = 0;
        }
        true
    }

    // The next step plays bar 1
    pub fn restart(&mut self) {
        self.step_index = 0;
    }

    pub fn step(&self, track: usize) -> u8 {
        self.tracks[track].steps[self.step_index]
    }

    pub fn is_bar_start(&self) -> bool {
        self.step_index % self.measure_length == 0
    }

    pub fn advance(&mut self) {
        self.step_index = (self.step_index + 1) % self.length();
    }

    pub fn index(&self) -> usize {
        self.step_index
    }

    pub fn measure_length(&self) -> usize {
        self.measure_length
    }

    fn length(&self) -> usize {
        self.measure_length * self.bars
    }
}
