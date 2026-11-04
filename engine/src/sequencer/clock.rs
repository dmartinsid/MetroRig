// The tempo, and when each step falls
pub struct Clock {
    sample_rate: f32,
    pub(crate) bpm: f64,
    pub(crate) samples_per_step: f64,
    samples_in_current_step: f64,
    first_hit: bool, // The next hit opens a run, so no measure has finished
}

impl Clock {
    pub fn new(sample_rate: f32) -> Self {
        let mut clock = Clock {
            sample_rate,
            bpm: 120.0,
            samples_per_step: 0.0,
            samples_in_current_step: 0.0,
            first_hit: false,
        };
        clock.recalc_tempo();
        clock
    }

    pub fn bpm(&self) -> f64 {
        self.bpm
    }

    pub fn samples_per_step(&self) -> f64 {
        self.samples_per_step
    }

    pub fn set_bpm(&mut self, bpm: f64) {
        self.bpm = bpm;
        self.recalc_tempo();
    }

    pub fn start(&mut self) {
        self.first_hit = true;
        self.samples_in_current_step = 0.0;
    }

    pub fn is_first_hit(&self) -> bool {
        self.first_hit
    }

    // The hit that opens the run has come: whether this was it
    pub fn end_first_hit(&mut self) -> bool {
        std::mem::take(&mut self.first_hit)
    }

    // One frame: true when a step is due. The first hit is due at once, whatever the tempo
    pub fn advance(&mut self) -> bool {
        if self.first_hit {
            return true;
        }
        self.samples_in_current_step += 1.0;
        if self.samples_in_current_step >= self.samples_per_step {
            self.samples_in_current_step -= self.samples_per_step;
            return true;
        }
        false
    }

    fn recalc_tempo(&mut self) {
        // Assuming 16th notes: 4 steps per beat. 
        // Beats per second = bpm / 60
        // Steps per second = (bpm / 60) * 4
        // Samples per step = sample_rate / steps_per_second
        let steps_per_second = (self.bpm / 60.0) * 4.0;
        self.samples_per_step = self.sample_rate as f64 / steps_per_second;
    }
}
