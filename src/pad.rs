// The chord pad: held chords mixed over the drums. The page says which notes to hold; everything else
// runs here, on the audio thread, so nothing below allocates once `Pad::new` has returned.
use std::f32::consts::TAU;

const MAX_CHORDS: usize = 3;
const MAX_NOTES: usize = 5;
const SAWS: usize = 7;

// The sound of demo 3
const DETUNE: [f32; SAWS] = [-0.19, -0.11, -0.05, 0.0, 0.05, 0.11, 0.19]; // Semitones
const CUTOFF_HZ: f32 = 900.0;
const CUTOFF_SWING_HZ: f32 = 350.0;
const CUTOFF_LFO_HZ: f32 = 0.13;

const SYNTH_GAIN: f32 = 0.1;

#[derive(Clone, Copy)]
struct Voice {
    phases: [f32; SAWS],
    steps: [f32; SAWS], // Phase per frame
}

impl Voice {
    const OFF: Voice = Voice { phases: [0.0; SAWS], steps: [0.0; SAWS] };
}

#[derive(Clone, Copy)]
struct Slot {
    voices: [Voice; MAX_NOTES],
    count: usize,
    gain: f32, // Keeps chords of any size at one level
}

impl Slot {
    const OFF: Slot = Slot { voices: [Voice::OFF; MAX_NOTES], count: 0, gain: 0.0 };
}

pub struct Pad {
    sample_rate: f32,
    slots: [Slot; MAX_CHORDS],
    filter_left: [f32; 2],
    filter_right: [f32; 2],
    cutoff_phase: f32,
    random: u32,
}

impl Pad {
    pub fn new(sample_rate: f32) -> Pad {
        Pad {
            sample_rate,
            slots: [Slot::OFF; MAX_CHORDS],
            filter_left: [0.0; 2],
            filter_right: [0.0; 2],
            cutoff_phase: 0.0,
            random: 12345,
        }
    }

    pub fn play(&mut self, notes: &[u8]) {
        let count = notes.len().min(MAX_NOTES);
        for (index, &note) in notes[..count].iter().enumerate() {
            let voice = self.new_voice(note);
            self.slots[0].voices[index] = voice;
        }
        self.slots[0].count = count;
        self.slots[0].gain = 1.0 / (count.max(1) as f32).sqrt();
    }

    pub fn mix_into(&mut self, left: &mut [f32], right: &mut [f32]) {
        for (out_left, out_right) in left.iter_mut().zip(right.iter_mut()) {
            let (pad_left, pad_right) = self.dry_frame();
            *out_left += pad_left;
            *out_right += pad_right;
        }
    }

    // Saws start at random phases, or a chord would open with a thump
    fn new_voice(&mut self, note: u8) -> Voice {
        let mut voice = Voice::OFF;
        for saw in 0..SAWS {
            self.random = self.random.wrapping_mul(1664525).wrapping_add(1013904223);
            voice.phases[saw] = (self.random >> 8) as f32 / 16777216.0;
            let hz = 440.0 * 2f32.powf((note as f32 + DETUNE[saw] - 69.0) / 12.0);
            voice.steps[saw] = hz / self.sample_rate;
        }
        voice
    }

    // One frame of every chord, before the effects and the volume
    fn dry_frame(&mut self) -> (f32, f32) {
        let (mut left, mut right) = (0.0, 0.0);
        for slot in &mut self.slots {
            for voice in &mut slot.voices[..slot.count] {
                for saw in 0..SAWS {
                    let phase = voice.phases[saw] + voice.steps[saw];
                    let phase = if phase >= 1.0 { phase - 1.0 } else { phase };
                    voice.phases[saw] = phase;
                    let pan = saw as f32 / (SAWS - 1) as f32;
                    let value = (phase * 2.0 - 1.0) * slot.gain;
                    left += value * (1.0 - pan);
                    right += value * pan;
                }
            }
        }

        self.cutoff_phase = (self.cutoff_phase + CUTOFF_LFO_HZ / self.sample_rate).fract();
        let cutoff = CUTOFF_HZ + CUTOFF_SWING_HZ * (TAU * self.cutoff_phase).sin();
        let smoothing = 1.0 - (-TAU * cutoff / self.sample_rate).exp();
        low_pass(&mut self.filter_left, left, smoothing);
        low_pass(&mut self.filter_right, right, smoothing);
        (self.filter_left[1] * SYNTH_GAIN, self.filter_right[1] * SYNTH_GAIN)
    }
}

fn low_pass(poles: &mut [f32; 2], input: f32, smoothing: f32) {
    poles[0] += smoothing * (input - poles[0]);
    poles[1] += smoothing * (poles[0] - poles[1]);
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: f32 = 44100.0;
    const FADE_END: f32 = 2.0; // Past the 1.5 s fade

    fn note_hz(note: f32) -> f32 {
        440.0 * 2f32.powf((note - 69.0) / 12.0)
    }

    fn cents(hz: f32, reference: f32) -> f32 {
        1200.0 * (hz / reference).log2()
    }

    fn db(level: f32) -> f32 {
        20.0 * level.log10()
    }

    fn rms(signal: &[f32]) -> f32 {
        (signal.iter().map(|value| value * value).sum::<f32>() / signal.len() as f32).sqrt()
    }

    fn mono(left: &[f32], right: &[f32]) -> Vec<f32> {
        left.iter().zip(right).map(|(l, r)| l + r).collect()
    }

    // What a listener gets, in the blocks the worklet uses
    fn render(pad: &mut Pad, seconds: f32) -> (Vec<f32>, Vec<f32>) {
        let frames = (seconds * pad.sample_rate) as usize;
        let (mut left, mut right) = (vec![0.0; frames], vec![0.0; frames]);
        for (left, right) in left.chunks_mut(128).zip(right.chunks_mut(128)) {
            pad.mix_into(left, right);
        }
        (left, right)
    }

    // The signal before the effects, for rules on the voices themselves
    fn render_dry(pad: &mut Pad, seconds: f32) -> (Vec<f32>, Vec<f32>) {
        let frames = (seconds * pad.sample_rate) as usize;
        (0..frames).map(|_| pad.dry_frame()).unzip()
    }

    fn after(signal: &[f32], seconds: f32, rate: f32) -> &[f32] {
        &signal[(seconds * rate) as usize..]
    }

    fn hann(signal: &[f32]) -> Vec<f64> {
        let last = (signal.len() - 1) as f64;
        signal.iter().enumerate()
            .map(|(frame, &value)| value as f64 * (0.5 - 0.5 * (std::f64::consts::TAU * frame as f64 / last).cos()))
            .collect()
    }

    // Power of one frequency, by the Goertzel recurrence
    fn power_at(windowed: &[f64], hz: f32, rate: f32) -> f64 {
        let coefficient = 2.0 * (std::f64::consts::TAU * hz as f64 / rate as f64).cos();
        let (mut previous, mut before) = (0f64, 0f64);
        for value in windowed {
            let current = value + coefficient * previous - before;
            before = previous;
            previous = current;
        }
        before * before + previous * previous - coefficient * previous * before
    }

    // Power at each 1/4 cent within `span` cents of a frequency
    fn sweep(windowed: &[f64], hz: f32, span: f32, rate: f32) -> Vec<(f32, f64)> {
        let steps = (span * 4.0) as i32;
        (-steps..=steps)
            .map(|step| {
                let offset = step as f32 / 4.0;
                (offset, power_at(windowed, hz * 2f32.powf(offset / 1200.0), rate))
            })
            .collect()
    }

    // The centre of the 7 saws of a note, as the ear hears a detuned cluster: its weighted mean
    fn cluster_centre_cents(signal: &[f32], note: f32, rate: f32) -> f32 {
        let spectrum = sweep(&hann(signal), note_hz(note), 30.0, rate);
        let total: f64 = spectrum.iter().map(|(_, power)| power).sum();
        (spectrum.iter().map(|(offset, power)| *offset as f64 * power).sum::<f64>() / total) as f32
    }

    fn band_power(signal: &[f32], hz: f32, span: f32, rate: f32) -> f64 {
        sweep(&hann(signal), hz, span, rate).iter().map(|(_, power)| power).sum()
    }

    #[test]
    fn pad_05_held_chord_never_ends() {
        let mut pad = Pad::new(RATE);
        pad.play(&[48, 52, 55, 59, 62]);
        let (left, right) = render(&mut pad, 60.0);
        let frame_after_fade = (FADE_END * RATE) as usize;
        assert!(left.iter().zip(&right).skip(frame_after_fade).all(|(l, r)| *l != 0.0 || *r != 0.0));

        let held = after(&left, FADE_END, RATE);
        let reference = db(rms(held));
        for second in held.chunks(RATE as usize) {
            assert!((db(rms(second)) - reference).abs() < 3.0, "the level moved {} dB", db(rms(second)) - reference);
        }
    }

    #[test]
    fn pad_07_notes_within_5_cents() {
        for chord in [&[45u8][..], &[56], &[63], &[70], &[48, 52, 55, 59, 62]] {
            let mut pad = Pad::new(RATE);
            pad.play(chord);
            let (left, right) = render(&mut pad, 16.0);
            let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
            for &note in chord {
                let centre = cluster_centre_cents(&signal, note as f32, RATE);
                assert!(centre.abs() <= 5.0, "note {note} is {centre} cents off");
            }
        }
    }

    #[test]
    fn pad_18_synth_detunes_and_filters() {
        let mut pad = Pad::new(RATE);
        pad.play(&[69]);
        let (left, right) = render_dry(&mut pad, 16.0);
        let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));

        let spectrum = sweep(&hann(&signal), 440.0, 30.0, RATE);
        let tallest = spectrum.iter().map(|(_, power)| *power).fold(0.0, f64::max);
        let peaks: Vec<f32> = spectrum.windows(3)
            .filter(|side| side[1].1 > side[0].1 && side[1].1 > side[2].1 && side[1].1 > tallest / 8.0)
            .map(|side| side[1].0)
            .collect();
        assert_eq!(peaks.len(), 7, "peaks at {peaks:?} cents");
        for (peak, detune) in peaks.iter().zip([-19.0, -11.0, -5.0, 0.0, 5.0, 11.0, 19.0]) {
            assert!((peak - detune).abs() <= 1.0, "peaks at {peaks:?} cents");
        }

        // Spread across the field: the flattest saw leans left, and the sharpest right
        let flat = 440.0 * 2f32.powf(-19.0 / 1200.0);
        let sharp = 440.0 * 2f32.powf(19.0 / 1200.0);
        let (windowed_left, windowed_right) = (hann(&left), hann(&right));
        assert!(power_at(&windowed_left, flat, RATE) > 10.0 * power_at(&windowed_right, flat, RATE));
        assert!(power_at(&windowed_right, sharp, RATE) > 10.0 * power_at(&windowed_left, sharp, RATE));

        // A sawtooth keeps its harmonics, and the slow filter opens and closes on them. One second around
        // each extreme of the 7.7 s movement, in time from the first frame
        let whole = mono(&left, &right);
        let around = |second: f32| &whole[((second - 0.5) * RATE) as usize..((second + 0.5) * RATE) as usize];
        let fundamental = band_power(around(9.6), 440.0, 30.0, RATE);
        let open = band_power(around(9.6), 2200.0, 30.0, RATE);
        let closed = band_power(around(13.45), 2200.0, 30.0, RATE);
        assert!(open > fundamental / 10000.0, "no harmonics: this is not a sawtooth");
        assert!(10.0 * (open / closed).log10() > 6.0, "open {open} closed {closed}");
    }

    #[test]
    fn pad_48_synth_sounds_without_samples() {
        let chord = [48, 52, 55, 59, 62];
        let mut pad = Pad::new(RATE);
        pad.play(&chord);
        let (left, right) = render(&mut pad, 6.0);
        assert!(db(rms(after(&left, FADE_END, RATE))) > -40.0);

        let signal = hann(&mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE)));
        let powers: Vec<f64> = chord.iter()
            .map(|&note| sweep(&signal, note_hz(note as f32), 25.0, RATE).iter().map(|(_, power)| power).sum())
            .collect();
        let loudest = powers.iter().cloned().fold(0.0, f64::max);
        assert!(powers.iter().all(|power| *power > loudest / 20.0), "a note is missing: {powers:?}");
    }

    #[test]
    fn pad_52_synth_alone() {
        let mut pad = Pad::new(RATE);
        pad.play(&[69]);
        let (left, right) = render(&mut pad, 6.0);
        assert!(db(rms(after(&left, FADE_END, RATE))) > -40.0);
        // Only the harmonics of the note: the bands between them hold nothing
        let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
        let fundamental = band_power(&signal, 440.0, 25.0, RATE);
        let between = band_power(&signal, 660.0, 25.0, RATE);
        assert!(between < fundamental / 1000.0, "between {between} fundamental {fundamental}");
    }

    #[test]
    fn pad_07_cents_helper_measures_a_known_offset() {
        // A sine 4 cents sharp reads as 4 cents, so the checks above can fail
        let hz = 440.0 * 2f32.powf(4.0 / 1200.0);
        let sine: Vec<f32> = (0..(4.0 * RATE) as usize).map(|frame| (TAU * hz * frame as f32 / RATE).sin()).collect();
        let centre = cluster_centre_cents(&sine, 69.0, RATE);
        assert!((cents(hz, 440.0) - centre).abs() < 0.5, "{centre}");
    }
}
