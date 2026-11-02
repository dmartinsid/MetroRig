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

// Set by ear. Demo 4 keeps the sample layer about 2 dB above the synth
const SYNTH_GAIN: f32 = 0.1;
const SAMPLE_GAIN: f32 = 0.63;

const NO_FILE: usize = usize::MAX;

// A pad sample keeps its onset, so `Sample` and its trimming are not reused: they would shift the loop points
struct PadSample {
    key: u8,
    left: Vec<f32>,
    right: Vec<f32>,
    loop_start: usize,
    loop_end: usize, // Holds the same value as loop_start, so a wrap from one to the other is seamless
}

#[derive(Clone, Copy)]
struct Voice {
    phases: [f32; SAWS],
    steps: [f32; SAWS], // Phase per frame
    file: usize, // Index into `samples`, or NO_FILE
    // SPEC_DEVIATION: f64, where the design says f32
    // Reason: past 262,144 frames f32 moves in steps of 1/32 of a frame, which rounds a ratio of 1.059 to 1.0625, 5 cents sharp
    position: f64,
    speed: f64, // Frames of the file per output frame
}

impl Voice {
    const OFF: Voice = Voice { phases: [0.0; SAWS], steps: [0.0; SAWS], file: NO_FILE, position: 0.0, speed: 1.0 };

    fn read(&mut self, sample: &PadSample) -> (f32, f32) {
        let index = self.position as usize;
        let fraction = (self.position - index as f64) as f32;
        let left = sample.left[index] + fraction * (sample.left[index + 1] - sample.left[index]);
        let right = sample.right[index] + fraction * (sample.right[index + 1] - sample.right[index]);
        self.position += self.speed;
        while self.position >= sample.loop_end as f64 {
            self.position -= (sample.loop_end - sample.loop_start) as f64;
        }
        (left, right)
    }
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
    samples: Vec<PadSample>,
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
            samples: Vec::new(),
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

    pub fn load(&mut self, key: u8, left: &[f32], right: &[f32], loop_start: usize, loop_end: usize) {
        let frames = left.len().min(right.len());
        let loop_end = loop_end.min(frames.saturating_sub(1));
        if loop_start >= loop_end {
            return; // A rounded loop point must not reach the audio thread as an out-of-bounds read
        }
        let sample = PadSample { key, left: left[..frames].to_vec(), right: right[..frames].to_vec(), loop_start, loop_end };
        self.samples.push(sample);
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
        voice.file = self.nearest_file(note);
        if let Some(sample) = self.samples.get(voice.file) {
            voice.speed = 2f64.powf((note as f64 - sample.key as f64) / 12.0);
        }
        voice
    }

    // A tie goes to the higher file, as FreePats maps its keys
    fn nearest_file(&self, note: u8) -> usize {
        (0..self.samples.len())
            .min_by_key(|&file| (self.samples[file].key.abs_diff(note), u8::MAX - self.samples[file].key))
            .unwrap_or(NO_FILE)
    }

    // One frame of every chord, before the effects and the volume
    fn dry_frame(&mut self) -> (f32, f32) {
        let (mut left, mut right) = (0.0, 0.0);
        let (mut file_left, mut file_right) = (0.0, 0.0);
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
                if let Some(sample) = self.samples.get(voice.file) {
                    let (sample_left, sample_right) = voice.read(sample);
                    file_left += sample_left * slot.gain;
                    file_right += sample_right * slot.gain;
                }
            }
        }

        self.cutoff_phase = (self.cutoff_phase + CUTOFF_LFO_HZ / self.sample_rate).fract();
        let cutoff = CUTOFF_HZ + CUTOFF_SWING_HZ * (TAU * self.cutoff_phase).sin();
        let smoothing = 1.0 - (-TAU * cutoff / self.sample_rate).exp();
        low_pass(&mut self.filter_left, left, smoothing);
        low_pass(&mut self.filter_right, right, smoothing);
        (
            self.filter_left[1] * SYNTH_GAIN + file_left * SAMPLE_GAIN,
            self.filter_right[1] * SYNTH_GAIN + file_right * SAMPLE_GAIN,
        )
    }
}

fn low_pass(poles: &mut [f32; 2], input: f32, smoothing: f32) {
    poles[0] += smoothing * (input - poles[0]);
    poles[1] += smoothing * (poles[0] - poles[1]);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use std::sync::OnceLock;

    const RATE: f32 = 44100.0;
    const FADE_END: f32 = 2.0; // Past the 1.5 s fade
    const C7M9: [u8; 5] = [48, 52, 55, 59, 62]; // The chord of the demos

    type Stereo = (Vec<f32>, Vec<f32>);

    struct BankFile {
        key: u8,
        audio: Vec<f32>,
        loop_start: usize,
        loop_end: usize,
    }

    fn numbers(text: &str) -> Vec<usize> {
        text.split(|c: char| !c.is_ascii_digit()).filter(|word| !word.is_empty()).map(|word| word.parse().unwrap()).collect()
    }

    // The shipped files, as PAD_BANK lists them. The level of real audio is what PAD-14, PAD-20 and PAD-27 are about
    fn bank() -> &'static [BankFile] {
        static BANK: OnceLock<Vec<BankFile>> = OnceLock::new();
        BANK.get_or_init(|| {
            let root = env!("CARGO_MANIFEST_DIR");
            let source = std::fs::read_to_string(format!("{root}/src/chords.ts")).unwrap();
            let files: Vec<BankFile> = source.lines().filter(|line| line.contains("url: '/pads/")).map(|line| {
                let parts: Vec<&str> = line.split('\'').collect();
                let (key, loops) = (numbers(parts[0]), numbers(parts[2]));
                let output = Command::new("ffmpeg")
                    .args(["-v", "error", "-i", &format!("{root}/public{}", parts[1]), "-f", "f32le", "-ac", "1", "-"])
                    .output()
                    .expect("ffmpeg decodes the bank");
                assert!(output.status.success());
                let audio = output.stdout.chunks_exact(4).map(|bytes| f32::from_le_bytes(bytes.try_into().unwrap())).collect();
                BankFile { key: key[0] as u8, audio, loop_start: loops[0], loop_end: loops[1] }
            }).collect();
            assert_eq!(files.len(), 8);
            files
        })
    }

    fn load_bank(pad: &mut Pad) {
        for file in bank() {
            pad.load(file.key, &file.audio, &file.audio, file.loop_start, file.loop_end);
        }
    }

    fn sine(hz: f32, seconds: f32, rate: f32) -> Vec<f32> {
        (0..(seconds * rate) as usize).map(|frame| 0.5 * (std::f64::consts::TAU * hz as f64 * frame as f64 / rate as f64).sin() as f32).collect()
    }

    // A file that holds one tone and is too long to reach its loop in these tests
    fn load_tone(pad: &mut Pad, key: u8, hz: f32) {
        let tone = sine(hz, 40.0, pad.sample_rate);
        pad.load(key, &tone, &tone, 0, tone.len() - 1);
    }

    // The mix is linear, so the same calls with and without files differ by the sample layer alone
    fn sample_layer(load: impl Fn(&mut Pad), rate: f32, run: impl Fn(&mut Pad) -> Stereo) -> Stereo {
        let mut bare = Pad::new(rate);
        let (bare_left, bare_right) = run(&mut bare);
        let mut loaded = Pad::new(rate);
        load(&mut loaded);
        let (left, right) = run(&mut loaded);
        let minus = |a: Vec<f32>, b: Vec<f32>| a.iter().zip(&b).map(|(x, y)| x - y).collect();
        (minus(left, bare_left), minus(right, bare_right))
    }

    // Where the file sits at the peak of the note's frequency
    fn peak_cents(signal: &[f32], note: f32, rate: f32) -> f32 {
        let spectrum = sweep(&hann(signal), note_hz(note), 30.0, rate);
        spectrum.iter().fold((0.0, 0.0), |best, &(offset, power)| if power > best.1 { (offset, power) } else { best }).0
    }

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
    fn render(pad: &mut Pad, seconds: f32) -> Stereo {
        let frames = (seconds * pad.sample_rate) as usize;
        let (mut left, mut right) = (vec![0.0; frames], vec![0.0; frames]);
        for (left, right) in left.chunks_mut(128).zip(right.chunks_mut(128)) {
            pad.mix_into(left, right);
        }
        (left, right)
    }

    // The signal before the effects, for rules on the voices themselves
    fn render_dry(pad: &mut Pad, seconds: f32) -> Stereo {
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
        pad.play(&C7M9);
        let (left, right) = render(&mut pad, 60.0);
        let frame_after_fade = (FADE_END * RATE) as usize;
        assert!(left.iter().zip(&right).skip(frame_after_fade).all(|(l, r)| *l != 0.0 || *r != 0.0));

        let held = after(&left, FADE_END, RATE);
        let reference = db(rms(held));
        for second in held.chunks(RATE as usize) {
            assert!((db(rms(second)) - reference).abs() < 3.0, "the level moved {} dB", db(rms(second)) - reference);
        }

        // The files last under 9 s, so the sample layer lives on its loops
        let mut pad = Pad::new(RATE);
        load_bank(&mut pad);
        pad.play(&C7M9);
        let (left, right) = render(&mut pad, 60.0);
        assert!(left.iter().zip(&right).skip(frame_after_fade).all(|(l, r)| *l != 0.0 || *r != 0.0));
        let held = after(&left, FADE_END, RATE);
        let reference = db(rms(held));
        for second in held.chunks(RATE as usize) {
            assert!((db(rms(second)) - reference).abs() < 9.0, "the level moved {} dB", db(rms(second)) - reference);
        }
    }

    #[test]
    fn pad_06_loop_wrap_adds_no_step() {
        for file in bank() {
            for note in [file.key, file.key + 1] {
                let (signal, _) = sample_layer(load_bank, RATE, |pad| {
                    pad.play(&[note]);
                    render_dry(pad, 20.0)
                });
                let speed = 2f64.powf((note as f64 - file.key as f64) / 12.0);
                let round_trip = (file.loop_end - file.loop_start) as f64 / speed;
                let mut wrap = file.loop_end as f64 / speed;
                let mut wraps = 0;
                while (wrap as usize) + 2 < signal.len() {
                    let frame = wrap as usize + 1;
                    let step = |at: usize| (signal[at] - signal[at - 1]).abs();
                    let largest_before = ((frame - 2 - 441)..(frame - 2)).map(step).fold(0.0, f32::max);
                    let largest_at_wrap = ((frame - 1)..=(frame + 1)).map(step).fold(0.0, f32::max);
                    assert!(largest_at_wrap <= largest_before, "key {} note {note}: step {largest_at_wrap} after {largest_before}", file.key);
                    wrap += round_trip;
                    wraps += 1;
                }
                assert!(wraps >= 2, "key {}: only {wraps} wraps", file.key);
            }
        }
    }

    #[test]
    fn pad_07_notes_within_5_cents() {
        for chord in [&[45u8][..], &[56], &[63], &[70], &C7M9] {
            let mut pad = Pad::new(RATE);
            pad.play(chord);
            let (left, right) = render(&mut pad, 16.0);
            let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
            for &note in chord {
                let centre = cluster_centre_cents(&signal, note as f32, RATE);
                assert!(centre.abs() <= 5.0, "note {note} is {centre} cents off");
            }

            // Each file sits at its own pitch, so a note away from its key must be moved there
            let (left, right) = sample_layer(
                |pad| for key in [44, 48, 52, 56, 60, 64, 68, 72] { load_tone(pad, key, note_hz(key as f32)) },
                RATE,
                |pad| { pad.play(chord); render(pad, 16.0) },
            );
            let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
            for &note in chord {
                let peak = peak_cents(&signal, note as f32, RATE);
                assert!(peak.abs() <= 5.0, "note {note} is {peak} cents off");
            }
        }
    }

    #[test]
    fn pad_17_note_mixes_both_layers() {
        // A tone no harmonic of the note can reach marks the sample layer
        let (marker, note) = (700.0, 69);
        let mut pad = Pad::new(RATE);
        load_tone(&mut pad, note, marker);
        pad.play(&[note]);
        let (left, right) = render(&mut pad, 6.0);
        let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
        let sample = band_power(&signal, marker, 15.0, RATE);
        let synth = band_power(&signal, 440.0, 25.0, RATE);
        assert!(10.0 * (sample / synth).log10() > -12.0, "the sample layer is missing: {sample} against {synth}");
        assert!(10.0 * (sample / synth).log10() < 12.0, "the synth layer is missing: {sample} against {synth}");
    }

    #[test]
    fn pad_20_layer_balance() {
        let held = |pad: &mut Pad| { pad.play(&C7M9); render(pad, 24.0) };
        let (sample_left, _) = sample_layer(load_bank, RATE, held);
        let (synth_left, _) = held(&mut Pad::new(RATE));
        let difference = db(rms(after(&sample_left, 4.0, RATE))) - db(rms(after(&synth_left, 4.0, RATE)));
        assert!((1.0..=3.0).contains(&difference), "the sample layer is {difference} dB above the synth");
    }

    #[test]
    fn pad_50_nearest_loaded_file() {
        // Each file holds its own marker, so what sounds tells which file was read
        let run = |loaded: &[(u8, f32)], note: u8, expected: f32, other: f32| {
            let mut pad = Pad::new(RATE);
            for &(key, marker) in loaded {
                load_tone(&mut pad, key, marker);
            }
            pad.play(&[note]);
            let (left, right) = render(&mut pad, 4.0);
            let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
            let (heard, not_heard) = (band_power(&signal, expected, 15.0, RATE), band_power(&signal, other, 15.0, RATE));
            assert!(heard > 100.0 * not_heard, "note {note}: {heard} at {expected} Hz, {not_heard} at {other} Hz");
        };
        let semitones = |hz: f32, count: f32| hz * 2f32.powf(count / 12.0);
        let files = [(48, 1000.0), (72, 3000.0)];
        run(&files, 50, semitones(1000.0, 2.0), semitones(3000.0, -22.0));
        run(&files, 66, semitones(3000.0, -6.0), semitones(1000.0, 18.0));
        run(&[(72, 3000.0), (48, 1000.0)], 50, semitones(1000.0, 2.0), semitones(3000.0, -22.0)); // In either order
        // Halfway between two files, the higher one, as FreePats maps note 46 to its key 48
        run(&[(44, 1000.0), (48, 3000.0)], 46, semitones(3000.0, -2.0), semitones(1000.0, 2.0));
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
        let chord = C7M9;
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
