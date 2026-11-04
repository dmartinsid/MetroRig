// The Speed Trainer: when the tempo rises and by how much. It holds no tempo of its own: each rule takes the
// live BPM and returns the new one, which its caller applies.

#[derive(Clone, Copy, PartialEq)]
pub enum StepType {
    Bars,
    Seconds,
}

#[derive(Clone, Copy, PartialEq)]
pub enum Curve {
    Stepped,
    Smooth,
}

#[derive(Clone, Copy, PartialEq)]
pub struct TrainerSettings {
    pub enabled: bool,
    pub start_bpm: f64,
    pub target_bpm: f64,
    pub increment: f64,
    pub step_type: StepType,
    pub step_value: f64,
    pub curve: Curve,
}

impl TrainerSettings {
    pub fn new(
        enabled: bool,
        start_bpm: f64,
        target_bpm: f64,
        increment: f64,
        step_type: StepType,
        step_value: f64,
        curve: Curve
    ) -> Option<Self> {
        if start_bpm <= 0.0 || !start_bpm.is_finite() { return None; }
        if target_bpm <= 0.0 || !target_bpm.is_finite() { return None; }
        if increment < 0.0 || !increment.is_finite() { return None; }
        if step_value <= 0.0 || !step_value.is_finite() { return None; }
        Some(TrainerSettings {
            enabled,
            start_bpm,
            target_bpm,
            increment,
            step_type,
            step_value,
            curve,
        })
    }
}

pub struct Trainer {
    pub settings: TrainerSettings,
    accumulated_measures: u64,
    accumulated_samples: u64,
    schedule_restarted: bool, // Its first interval counts from the next beat 1
    pending: Option<TrainerSettings>, // Received during playback, waits for beat 1
}

impl Trainer {
    pub fn new() -> Self {
        Trainer {
            settings: TrainerSettings {
                enabled: false,
                start_bpm: 120.0,
                target_bpm: 160.0,
                increment: 5.0,
                step_type: StepType::Bars,
                step_value: 4.0,
                curve: Curve::Stepped,
            },
            accumulated_measures: 0,
            accumulated_samples: 0,
            schedule_restarted: false,
            pending: None,
        }
    }

    pub fn set(&mut self, settings: TrainerSettings, playing: bool) {
        if playing && settings.enabled {
            self.pending = Some(settings);
        } else {
            // Stopped, or a disable: it applies now and replaces anything still waiting.
            self.pending = None;
            self.apply(settings, playing);
        }
    }

    // A preset load: the old Trainer stops now, and its counters go with it.
    pub fn replace(&mut self, settings: TrainerSettings, playing: bool) {
        self.pending = None;
        self.apply(settings, playing);
        self.restart_schedule(playing);
    }

    // Play: the BPM to start from, when the Trainer is on
    pub fn on_start(&mut self, playing: bool) -> Option<f64> {
        self.apply_pending(playing);
        self.accumulated_measures = 0;
        self.accumulated_samples = 0;
        self.schedule_restarted = false;
        self.settings.enabled.then_some(self.settings.start_bpm)
    }

    // A step on beat 1, during playback. `first` is the hit that opens a run, so no measure has finished
    pub fn on_bar_start(&mut self, first: bool, bpm: f64, sample_rate: f32) -> Option<f64> {
        self.apply_pending(true);
        if first {
            self.schedule_restarted = false; // No bar has ended yet
            self.accumulated_samples = 0; // Seconds count from this hit
            return self.settings.enabled.then_some(self.settings.start_bpm); // Settings may have arrived after Play
        }
        // The bar that just ended does not count toward a restarted schedule
        let restarted = std::mem::take(&mut self.schedule_restarted);
        if restarted && self.settings.step_type == StepType::Bars {
            return None;
        }
        self.on_measure_complete(bpm, sample_rate)
    }

    // One frame of playback after the first hit
    pub fn on_frame(&mut self, bpm: f64, samples_per_step: f64, measure_length: usize, sample_rate: f32) -> Option<f64> {
        if self.settings.enabled && self.settings.curve == Curve::Smooth {
            // Smooth update per frame
            self.update_smooth(1, bpm, samples_per_step, measure_length, sample_rate)
        } else if self.settings.enabled && self.settings.step_type == StepType::Seconds {
            // Stepped by time: the increment waits for beat 1
            self.accumulated_samples += 1;
            None
        } else {
            None
        }
    }

    fn apply_pending(&mut self, playing: bool) {
        if let Some(settings) = self.pending.take() {
            self.apply(settings, playing);
        }
    }

    // Enabling the Trainer, or changing when it steps, restarts its schedule. Target,
    // Increment and Start BPM do not, so their edits keep the progress of the interval.
    fn apply(&mut self, settings: TrainerSettings, playing: bool) {
        let active = self.settings;
        let schedule_restarted = (settings.enabled && !active.enabled)
            || settings.step_type != active.step_type
            || settings.step_value != active.step_value
            || settings.curve != active.curve;
        self.settings = settings;
        if schedule_restarted {
            self.restart_schedule(playing);
        }
    }

    fn restart_schedule(&mut self, playing: bool) {
        self.accumulated_measures = 0;
        self.accumulated_samples = 0;
        self.schedule_restarted = playing;
    }

    fn on_measure_complete(&mut self, bpm: f64, sample_rate: f32) -> Option<f64> {
        if !self.settings.enabled || self.settings.curve != Curve::Stepped {
            return None;
        }
        let due = if self.settings.step_type == StepType::Bars {
            self.accumulated_measures += 1;
            self.accumulated_measures >= self.settings.step_value as u64
        } else {
            let samples_limit = (self.settings.step_value * sample_rate as f64) as u64;
            self.accumulated_samples >= samples_limit
        };
        if due {
            self.accumulated_measures = 0;
            self.accumulated_samples = 0;
            return self.increment_bpm(bpm);
        }
        None
    }

    fn increment_bpm(&self, bpm: f64) -> Option<f64> {
        (bpm < self.settings.target_bpm).then(|| (bpm + self.settings.increment).min(self.settings.target_bpm))
    }

    fn update_smooth(
        &mut self,
        elapsed_samples: u64,
        bpm: f64,
        samples_per_step: f64,
        measure_length: usize,
        sample_rate: f32
    ) -> Option<f64> {
        self.accumulated_samples += elapsed_samples;

        let samples_needed = if self.settings.step_type == StepType::Seconds {
            // By time
            self.settings.step_value * sample_rate as f64
        } else {
            // By measure: samples per measure
            samples_per_step * measure_length as f64 * self.settings.step_value
        };

        if bpm < self.settings.target_bpm {
            // Linear ramp
            let progress = elapsed_samples as f64 / samples_needed;
            let bpm_delta = self.settings.increment * progress;
            return Some((bpm + bpm_delta).min(self.settings.target_bpm));
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: f32 = 44100.0;

    fn settings(start: f64, target: f64, increment: f64, step_type: StepType, value: f64, curve: Curve) -> TrainerSettings {
        TrainerSettings::new(true, start, target, increment, step_type, value, curve).unwrap()
    }

    // A Trainer set while stopped, then started: the BPM Play starts from
    fn started(settings: TrainerSettings) -> (Trainer, f64) {
        let mut trainer = Trainer::new();
        trainer.set(settings, false);
        let bpm = trainer.on_start(false).unwrap();
        let bpm = trainer.on_bar_start(true, bpm, RATE).unwrap();
        (trainer, bpm)
    }

    // The BPM after each completed bar, from `bpm`, applying what the Trainer returns
    fn bars(trainer: &mut Trainer, mut bpm: f64, count: usize) -> Vec<f64> {
        (0..count)
            .map(|_| {
                bpm = trainer.on_bar_start(false, bpm, RATE).unwrap_or(bpm);
                bpm
            })
            .collect()
    }

    #[test]
    fn stepped_curve_steps_at_the_bar_count() {
        let (mut trainer, bpm) = started(settings(120.0, 130.0, 5.0, StepType::Bars, 2.0, Curve::Stepped));
        assert_eq!(bpm, 120.0);

        assert_eq!(bars(&mut trainer, bpm, 6), [120.0, 125.0, 125.0, 130.0, 130.0, 130.0]);
    }

    #[test]
    fn smooth_curve_ramps_each_frame() {
        let (mut trainer, mut bpm) = started(settings(100.0, 110.0, 10.0, StepType::Seconds, 1.0, Curve::Smooth));
        let samples_per_step = 6615.0;

        let first = trainer.on_frame(bpm, samples_per_step, 16, RATE).unwrap();
        assert_eq!(first, 100.0 + 10.0 * (1.0 / 44100.0));
        bpm = first;
        for _ in 1..22050 {
            let next = trainer.on_frame(bpm, samples_per_step, 16, RATE).unwrap();
            assert!(next > bpm);
            bpm = next;
        }
        assert!((bpm - 105.0).abs() < 1e-6, "{bpm}");
        assert_eq!(trainer.on_bar_start(false, bpm, RATE), None); // A smooth curve ignores bars

        for _ in 0..44100 {
            bpm = trainer.on_frame(bpm, samples_per_step, 16, RATE).unwrap_or(bpm);
        }
        assert_eq!(bpm, 110.0);
        assert_eq!(trainer.on_frame(bpm, samples_per_step, 16, RATE), None);
    }

    #[test]
    fn steps_by_bars() {
        let (mut trainer, bpm) = started(settings(90.0, 200.0, 4.0, StepType::Bars, 3.0, Curve::Stepped));

        // Frames do not count toward a schedule by bars
        for _ in 0..100_000 {
            assert_eq!(trainer.on_frame(bpm, 7350.0, 16, RATE), None);
        }
        assert_eq!(bars(&mut trainer, bpm, 7), [90.0, 90.0, 94.0, 94.0, 94.0, 98.0, 98.0]);
    }

    #[test]
    fn steps_by_seconds_wait_for_beat_one() {
        let (mut trainer, bpm) = started(settings(120.0, 130.0, 5.0, StepType::Seconds, 0.01, Curve::Stepped));

        for _ in 0..440 {
            assert_eq!(trainer.on_frame(bpm, 5512.5, 16, RATE), None);
        }
        assert_eq!(trainer.on_bar_start(false, bpm, RATE), None); // 440 frames: under 0.01 s
        for _ in 0..1000 {
            assert_eq!(trainer.on_frame(bpm, 5512.5, 16, RATE), None); // Due, but no beat 1 yet
        }
        assert_eq!(trainer.on_bar_start(false, bpm, RATE), Some(125.0));
        assert_eq!(trainer.on_bar_start(false, 125.0, RATE), None); // The interval counts again from there
    }

    #[test]
    fn settings_wait_for_beat_one() {
        let (mut trainer, bpm) = started(settings(120.0, 200.0, 5.0, StepType::Bars, 1.0, Curve::Stepped));
        let edited = settings(120.0, 200.0, 10.0, StepType::Bars, 1.0, Curve::Stepped);

        trainer.set(edited, true);
        assert!(trainer.settings != edited);
        assert_eq!(trainer.on_frame(bpm, 5512.5, 16, RATE), None);
        assert!(trainer.settings != edited);

        assert_eq!(trainer.on_bar_start(false, bpm, RATE), Some(130.0));
        assert!(trainer.settings == edited);

        // A disable applies at once, and drops an edit still waiting
        trainer.set(settings(120.0, 200.0, 20.0, StepType::Bars, 1.0, Curve::Stepped), true);
        trainer.set(TrainerSettings { enabled: false, ..edited }, true);
        assert!(!trainer.settings.enabled);
        assert_eq!(trainer.on_bar_start(false, 130.0, RATE), None);
        assert!(!trainer.settings.enabled);
    }

    #[test]
    fn a_changed_schedule_restarts() {
        let (mut trainer, bpm) = started(settings(100.0, 200.0, 5.0, StepType::Bars, 2.0, Curve::Stepped));
        assert_eq!(bars(&mut trainer, bpm, 1), [100.0]); // One of two bars counted

        trainer.set(settings(100.0, 200.0, 5.0, StepType::Bars, 3.0, Curve::Stepped), true);
        // The bar that applies it does not count, then three full bars do
        assert_eq!(bars(&mut trainer, bpm, 5), [100.0, 100.0, 100.0, 105.0, 105.0]);

        // A preset load restarts the count at once
        let (mut trainer, bpm) = started(settings(100.0, 200.0, 5.0, StepType::Bars, 2.0, Curve::Stepped));
        assert_eq!(bars(&mut trainer, bpm, 1), [100.0]);
        trainer.replace(settings(100.0, 200.0, 5.0, StepType::Bars, 2.0, Curve::Stepped), true);
        assert_eq!(bars(&mut trainer, bpm, 4), [100.0, 100.0, 105.0, 105.0]);
    }
}
