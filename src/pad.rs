// The chord pad: held chords mixed over the drums. The page says which notes to hold; everything else
// runs here, on the audio thread, where only `load` may allocate: a chord starts, changes and stops on fixed arrays.
use std::f32::consts::{FRAC_PI_2, TAU};

const MAX_CHORDS: usize = 3;
const MAX_NOTES: usize = 7; // 5 of a chord, and the 2 bass notes of a timbre that adds them
const TIMBRES: usize = 5; // In the order of PAD_TIMBRES in src/chords.ts, whose index is the timbre's id
const SAWS: usize = 7;
const FADE_SECONDS: f32 = 1.5;
const EVICTION_SECONDS: f32 = 0.02;
const VOLUME_SECONDS: f32 = 0.02;
const DEFAULT_VOLUME: f32 = 0.7;

// The sound of demo 3
const DETUNE: [f32; SAWS] = [-0.19, -0.11, -0.05, 0.0, 0.05, 0.11, 0.19]; // Semitones
const CUTOFF_HZ: f32 = 900.0;
const CUTOFF_SWING_HZ: f32 = 350.0;
const CUTOFF_LFO_HZ: f32 = 0.13;

// Demo 2's ffmpeg chorus, `0.6:0.9:45|60|75:0.35|0.3|0.3:0.15|0.23|0.31:2|2.5|3`, in opposite phase left and right.
// Each tap's delay swings from its base up by its depth.
// SPEC_DEVIATION: the taps sit at half the demo's level, and COMB_FEEDBACK and REVERB_WET below demo 3's 0.9 and 0.1
// Reason: at the demos' values both colour some notes more than others, past PAD-14's 3 dB and PAD-07's 5 cents
const CHORUS_TAPS: usize = 3;
const CHORUS_DELAY_MS: [f32; CHORUS_TAPS] = [45.0, 60.0, 75.0];
const CHORUS_DEPTH_MS: [f32; CHORUS_TAPS] = [2.0, 2.5, 3.0];
const CHORUS_RATE_HZ: [f32; CHORUS_TAPS] = [0.15, 0.23, 0.31];
const CHORUS_TAP_GAIN: [f32; CHORUS_TAPS] = [0.175, 0.15, 0.15];
const CHORUS_DRY: f32 = 0.6;
const CHORUS_OUTPUT: f32 = 0.9;

// Demo 3's reverb, its lengths in frames at 44.1 kHz
const COMB_FRAMES: [[usize; 4]; 2] = [[3114, 3234, 2982, 2844], [3160, 3280, 3028, 2890]];
const ALL_PASS_FRAMES: [[usize; 2]; 2] = [[556, 441], [579, 464]];
const COMB_FEEDBACK: f32 = 0.87;
const COMB_DAMPING: f32 = 0.4;
const REVERB_DRY: f32 = 0.7;
const REVERB_WET: f32 = 0.08;

const SILENCE: f32 = 3.2e-5; // -90 dBFS

// Set by ear, within PAD-20 and PAD-27. Their ratio keeps the sample layer about 2 dB above the synth, as in demo 4.
// Their level answers to the worst peak: at DEFAULT_VOLUME a rare line-up of three files reaches -12.7 dBFS
const SYNTH_GAIN: f32 = 0.0375;
const SAMPLE_GAIN: f32 = 0.3375;

// Each timbre's layers, as multiples of the gains above, and the share of its samples that takes the effects.
// New Age's are 1, so its output stays what `chord-pads` shipped. Analog has no samples, and Orchestra no synth
// but Analog's until its files arrive.
// Each timbre sits at New Age's level. Choir and Sweep keep the samples about 2 dB above the synth, as in their demos
struct Mix {
    synth: f32,
    samples: f32,
    chorus: f32,
}

const MIXES: [Mix; TIMBRES] = [
    Mix { synth: 0.87, samples: 0.60, chorus: 1.0 }, // Choir
    Mix { synth: 1.0, samples: 1.0, chorus: 1.0 }, // New Age
    Mix { synth: 0.0, samples: 2.12, chorus: 0.3 }, // Orchestra
    Mix { synth: 0.93, samples: 0.54, chorus: 1.0 }, // Sweep
    Mix { synth: 1.40, samples: 0.0, chorus: 1.0 }, // Analog
];

const NO_FILE: usize = usize::MAX;
const FALLBACK: usize = 4; // Analog, whose synth stands in for a timbre with none
const OWN_FILE_SEMITONES: u8 = 2; // Orchestra's keys stand 4 apart, so every note it plays has a file this close
const LOWEST_CHORD_NOTE: u8 = 45; // Below it are the notes a timbre adds, which that synth leaves out: it holds the chord

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
    note: u8,
    phases: [f32; SAWS],
    steps: [f32; SAWS], // Phase per frame
    file: usize, // Index into the bank of its slot's timbre, or NO_FILE
    next_file: usize, // A nearer file that came in while the voice sounds
    // SPEC_DEVIATION: on the voice, where the design keeps one sample gain per slot
    // Reason: files arrive one by one, and a held note must move to the nearer file without a click
    file_gain: f32, // Linear, from 0 to 1
    // SPEC_DEVIATION: f64, where the design says f32
    // Reason: past 262,144 frames f32 moves in steps of 1/32 of a frame, which rounds a ratio of 1.059 to 1.0625, 5 cents sharp
    position: f64,
    speed: f64, // Frames of the file per output frame
}

impl Voice {
    const OFF: Voice = Voice {
        note: 0,
        phases: [0.0; SAWS],
        steps: [0.0; SAWS],
        file: NO_FILE,
        next_file: NO_FILE,
        file_gain: 0.0,
        position: 0.0,
        speed: 1.0,
    };

    fn use_file(&mut self, file: usize, samples: &[PadSample]) {
        self.file = file;
        self.next_file = file;
        self.position = 0.0;
        if let Some(sample) = samples.get(file) {
            self.speed = 2f64.powf((self.note as f64 - sample.key as f64) / 12.0);
        }
    }

    // Leaves the file it has, if a nearer one came in, and fades that one in
    fn approach_file(&mut self, samples: &[PadSample], rise: f32, fall: f32) {
        if self.next_file != self.file {
            self.file_gain = (self.file_gain - fall).max(0.0);
            if self.file_gain == 0.0 {
                self.use_file(self.next_file, samples);
            }
        } else if self.file != NO_FILE {
            self.file_gain = (self.file_gain + rise).min(1.0);
        }
    }

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
    timbre: u8, // Part of what a slot holds, so the same notes in another timbre are another chord to fade to
    notes: [u8; MAX_NOTES],
    voices: [Voice; MAX_NOTES],
    count: usize, // 0 while the slot is free
    gain: f32, // Keeps chords of any size at one level
    level: f32, // Linear, from 0 to 1, so a fade continues from wherever it stands
    target: f32,
    fade_step: f32, // Level per frame
    evicting: bool, // Its 20 ms already run, so a later click must not restart them
    order: u64, // Higher is newer
}

impl Slot {
    const OFF: Slot = Slot {
        timbre: 0,
        notes: [0; MAX_NOTES],
        voices: [Voice::OFF; MAX_NOTES],
        count: 0,
        gain: 0.0,
        level: 0.0,
        target: 0.0,
        fade_step: 0.0,
        evicting: false,
        order: 0,
    };

    fn holds(&self, notes: &[u8], timbre: u8) -> bool {
        self.count > 0 && self.timbre == timbre && &self.notes[..self.count] == notes
    }

    // Equal power, because two chords are unrelated: a crossfade keeps its loudness
    fn fade_gain(&mut self) -> f32 {
        self.level = if self.level < self.target {
            (self.level + self.fade_step).min(self.target)
        } else {
            (self.level - self.fade_step).max(self.target)
        };
        if self.level == 0.0 && self.target == 0.0 {
            self.count = 0;
        }
        self.gain * (self.level * FRAC_PI_2).sin()
    }
}

struct Chorus {
    left: Vec<f32>,
    right: Vec<f32>,
    write: usize,
    phases: [f32; CHORUS_TAPS],
    steps: [f32; CHORUS_TAPS], // Phase per frame
    delays: [f32; CHORUS_TAPS], // Frames
    depths: [f32; CHORUS_TAPS], // Frames
}

impl Chorus {
    fn new(sample_rate: f32) -> Chorus {
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

    fn run(&mut self, left: f32, right: f32) -> (f32, f32) {
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

    fn clear(&mut self) {
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

struct Reverb {
    combs: [[Comb; 4]; 2], // Left, right
    all_passes: [[AllPass; 2]; 2],
}

impl Reverb {
    fn new(sample_rate: f32) -> Reverb {
        let scaled = |frames: usize| (frames as f32 * sample_rate / 44100.0) as usize;
        Reverb {
            combs: COMB_FRAMES.map(|lengths| lengths.map(|length| Comb { line: vec![0.0; scaled(length)], index: 0, damped: 0.0 })),
            all_passes: ALL_PASS_FRAMES.map(|lengths| lengths.map(|length| AllPass { line: vec![0.0; scaled(length)], index: 0 })),
        }
    }

    fn run(&mut self, left: f32, right: f32) -> (f32, f32) {
        let input = (left + right) * 0.5;
        let mut channel = |side: usize| {
            let wet: f32 = self.combs[side].iter_mut().map(|comb| comb.run(input)).sum();
            self.all_passes[side].iter_mut().fold(wet, |signal, all_pass| all_pass.run(signal))
        };
        let (wet_left, wet_right) = (channel(0), channel(1));
        (left * REVERB_DRY + wet_left * REVERB_WET, right * REVERB_DRY + wet_right * REVERB_WET)
    }

    fn clear(&mut self) {
        for comb in self.combs.iter_mut().flatten() {
            comb.line.fill(0.0);
            comb.damped = 0.0;
        }
        for all_pass in self.all_passes.iter_mut().flatten() {
            all_pass.line.fill(0.0);
        }
    }
}

pub struct Pad {
    sample_rate: f32,
    slots: [Slot; MAX_CHORDS],
    pending: [u8; MAX_NOTES], // The newest click, waiting for a free slot
    pending_count: usize,
    pending_timbre: u8,
    order: u64,
    banks: [Vec<PadSample>; TIMBRES],
    volume: f32,
    volume_target: f32,
    filter_left: [f32; 2],
    filter_right: [f32; 2],
    cutoff_phase: f32,
    chorus: Chorus,
    reverb: Reverb,
    random: u32,
    silent: bool,
}

impl Pad {
    pub fn new(sample_rate: f32) -> Pad {
        Pad {
            sample_rate,
            slots: [Slot::OFF; MAX_CHORDS],
            pending: [0; MAX_NOTES],
            pending_count: 0,
            pending_timbre: 0,
            order: 0,
            banks: std::array::from_fn(|_| Vec::new()),
            volume: DEFAULT_VOLUME,
            volume_target: DEFAULT_VOLUME,
            filter_left: [0.0; 2],
            filter_right: [0.0; 2],
            cutoff_phase: 0.0,
            chorus: Chorus::new(sample_rate),
            reverb: Reverb::new(sample_rate),
            random: 12345,
            silent: true,
        }
    }

    pub fn play(&mut self, notes: &[u8], timbre: u8) {
        if timbre as usize >= TIMBRES {
            return;
        }
        let notes = &notes[..notes.len().min(MAX_NOTES)];
        self.silent = false;
        self.pending_count = 0;
        let returning = self.slots.iter().position(|slot| slot.holds(notes, timbre));
        for slot in &mut self.slots {
            slot.target = 0.0;
        }
        if let Some(index) = returning {
            self.order += 1;
            let slot = &mut self.slots[index];
            slot.target = 1.0;
            slot.fade_step = 1.0 / (FADE_SECONDS * self.sample_rate);
            slot.evicting = false;
            slot.order = self.order; // It stopped being the oldest, so the next eviction must not cut it
        } else if let Some(free) = self.slots.iter().position(|slot| slot.count == 0) {
            self.start(free, notes, timbre);
        } else {
            self.pending[..notes.len()].copy_from_slice(notes);
            self.pending_count = notes.len();
            self.pending_timbre = timbre;
            let oldest = (0..MAX_CHORDS).min_by_key(|&index| self.slots[index].order).unwrap_or(0);
            // From any level, so the slot is free 20 ms from now however far its fade has gone
            if !self.slots[oldest].evicting {
                self.slots[oldest].evicting = true;
                self.slots[oldest].fade_step = self.slots[oldest].level / (EVICTION_SECONDS * self.sample_rate);
            }
        }
    }

    pub fn stop(&mut self) {
        self.pending_count = 0;
        for slot in &mut self.slots {
            slot.target = 0.0;
        }
    }

    pub fn load(&mut self, timbre: u8, key: u8, left: &[f32], right: &[f32], loop_start: usize, loop_end: usize) {
        let frames = left.len().min(right.len());
        let loop_end = loop_end.min(frames.saturating_sub(1));
        if loop_start >= loop_end || timbre as usize >= TIMBRES {
            return; // A rounded loop point must not reach the audio thread as an out-of-bounds read
        }
        if MIXES[timbre as usize].samples == 0.0 {
            return;
        }
        let sample = PadSample { key, left: left[..frames].to_vec(), right: right[..frames].to_vec(), loop_start, loop_end };
        self.banks[timbre as usize].push(sample);
        for slot in 0..MAX_CHORDS {
            if self.slots[slot].timbre != timbre {
                continue;
            }
            for voice in 0..self.slots[slot].count {
                self.slots[slot].voices[voice].next_file = self.nearest_file(timbre, self.slots[slot].voices[voice].note);
            }
        }
    }

    pub fn set_volume(&mut self, volume: f32) {
        self.volume_target = volume.clamp(0.0, 1.0);
    }

    pub fn is_silent(&self) -> bool {
        self.silent
    }

    pub fn mix_into(&mut self, left: &mut [f32], right: &mut [f32]) {
        if self.silent {
            return;
        }
        let mut peak = 0f32;
        let volume_step = 1.0 / (VOLUME_SECONDS * self.sample_rate);
        for (out_left, out_right) in left.iter_mut().zip(right.iter_mut()) {
            let ((synth_left, synth_right), (bus_left, bus_right), (past_left, past_right)) = self.layers();
            // SPEC_DEVIATION: the chorus takes the sample layer alone, where PAD-19 says the pad
            // Reason: as in demo 4. Over the synth too, its comb puts 6 dB between chords, against PAD-14's 3 dB
            let (file_left, file_right) = self.chorus.run(bus_left, bus_right);
            let (pad_left, pad_right) = self.reverb.run(synth_left + file_left, synth_right + file_right);
            // SPEC_DEVIATION: the samples past the chorus also pass the reverb by, where the design sends them through it
            // Reason: its combs ring on the tuned low notes of the Orchestra, which put 6 dB between chords against TIM-18's 3 dB
            let (pad_left, pad_right) = (pad_left + past_left * REVERB_DRY, pad_right + past_right * REVERB_DRY);
            peak = peak.max(pad_left.abs()).max(pad_right.abs());
            self.volume += (self.volume_target - self.volume).clamp(-volume_step, volume_step);
            *out_left += pad_left * self.volume;
            *out_right += pad_right * self.volume;
        }
        if peak < SILENCE && self.slots.iter().all(|slot| slot.count == 0) {
            self.silent = true;
            self.chorus.clear();
            self.reverb.clear();
            self.filter_left = [0.0; 2];
            self.filter_right = [0.0; 2];
        }
    }

    fn start(&mut self, index: usize, notes: &[u8], timbre: u8) {
        for (voice, &note) in notes.iter().enumerate() {
            self.slots[index].voices[voice] = self.new_voice(note, timbre);
        }
        self.order += 1;
        let slot = &mut self.slots[index];
        slot.timbre = timbre;
        slot.notes[..notes.len()].copy_from_slice(notes);
        slot.count = notes.len();
        slot.gain = 1.0 / (notes.len().max(1) as f32).sqrt();
        slot.level = 0.0;
        slot.target = 1.0;
        slot.fade_step = 1.0 / (FADE_SECONDS * self.sample_rate);
        slot.evicting = false;
        slot.order = self.order;
    }

    // Saws start at random phases, or a chord would open with a thump
    fn new_voice(&mut self, note: u8, timbre: u8) -> Voice {
        let mut voice = Voice { note, ..Voice::OFF };
        for saw in 0..SAWS {
            self.random = self.random.wrapping_mul(1664525).wrapping_add(1013904223);
            voice.phases[saw] = (self.random >> 8) as f32 / 16777216.0;
            let hz = 440.0 * 2f32.powf((note as f32 + DETUNE[saw] - 69.0) / 12.0);
            voice.steps[saw] = hz / self.sample_rate;
        }
        voice.use_file(self.nearest_file(timbre, note), &self.banks[timbre as usize]);
        voice.file_gain = if voice.file == NO_FILE { 0.0 } else { 1.0 };
        voice
    }

    // A tie goes to the higher file, as FreePats maps its keys. A timbre with no synth waits for a file of its own
    // note: while its bank loads, a far file would play the note at any speed where the fallback synth holds it
    fn nearest_file(&self, timbre: u8, note: u8) -> usize {
        let bank = &self.banks[timbre as usize];
        let reach = if MIXES[timbre as usize].synth == 0.0 { OWN_FILE_SEMITONES } else { u8::MAX };
        (0..bank.len())
            .filter(|&file| bank[file].key.abs_diff(note) <= reach)
            .min_by_key(|&file| (bank[file].key.abs_diff(note), u8::MAX - bank[file].key))
            .unwrap_or(NO_FILE)
    }

    // One frame of every chord, before the effects and the volume: the synth layer, the samples for the effects,
    // and the samples that pass them by
    fn layers(&mut self) -> ((f32, f32), (f32, f32), (f32, f32)) {
        let (mut left, mut right) = (0.0, 0.0);
        let (mut bus_left, mut bus_right) = (0.0, 0.0);
        let (mut past_left, mut past_right) = (0.0, 0.0);
        let file_rise = 1.0 / (FADE_SECONDS * self.sample_rate);
        let file_fall = 1.0 / (EVICTION_SECONDS * self.sample_rate);
        for slot in &mut self.slots {
            let gain = slot.fade_gain();
            let bank = &self.banks[slot.timbre as usize];
            let mix = &MIXES[slot.timbre as usize];
            for voice in &mut slot.voices[..slot.count] {
                // SPEC_DEVIATION: a cosine, where the design says 1 - file_gain
                // Reason: it mirrors the sine the files rise on, so the swap keeps its level, as every other crossfade here does
                let synth_gain = if mix.synth == 0.0 && voice.file_gain < 1.0 && voice.note >= LOWEST_CHORD_NOTE {
                    MIXES[FALLBACK].synth * (voice.file_gain * FRAC_PI_2).cos()
                } else {
                    mix.synth
                };
                for saw in 0..SAWS {
                    let phase = voice.phases[saw] + voice.steps[saw];
                    let phase = if phase >= 1.0 { phase - 1.0 } else { phase };
                    voice.phases[saw] = phase;
                    let pan = saw as f32 / (SAWS - 1) as f32;
                    let value = (phase * 2.0 - 1.0) * gain * synth_gain;
                    left += value * (1.0 - pan);
                    right += value * pan;
                }
                voice.approach_file(bank, file_rise, file_fall);
                if let Some(sample) = bank.get(voice.file) {
                    let file_gain = if voice.file_gain < 1.0 { (voice.file_gain * FRAC_PI_2).sin() } else { 1.0 };
                    let (sample_left, sample_right) = voice.read(sample);
                    let file_left = sample_left * gain * file_gain * mix.samples;
                    let file_right = sample_right * gain * file_gain * mix.samples;
                    bus_left += file_left * mix.chorus;
                    bus_right += file_right * mix.chorus;
                    past_left += file_left * (1.0 - mix.chorus);
                    past_right += file_right * (1.0 - mix.chorus);
                }
            }
        }

        if self.pending_count > 0 {
            if let Some(free) = self.slots.iter().position(|slot| slot.count == 0) {
                let (pending, count) = (self.pending, self.pending_count);
                self.pending_count = 0;
                self.start(free, &pending[..count], self.pending_timbre);
            }
        }

        self.cutoff_phase = (self.cutoff_phase + CUTOFF_LFO_HZ / self.sample_rate).fract();
        let cutoff = CUTOFF_HZ + CUTOFF_SWING_HZ * (TAU * self.cutoff_phase).sin();
        let smoothing = 1.0 - (-TAU * cutoff / self.sample_rate).exp();
        low_pass(&mut self.filter_left, left, smoothing);
        low_pass(&mut self.filter_right, right, smoothing);
        (
            (self.filter_left[1] * SYNTH_GAIN, self.filter_right[1] * SYNTH_GAIN),
            (bus_left * SAMPLE_GAIN, bus_right * SAMPLE_GAIN),
            (past_left * SAMPLE_GAIN, past_right * SAMPLE_GAIN),
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
    use std::alloc::{GlobalAlloc, Layout, System};
    use std::cell::Cell;
    use std::process::Command;
    use std::sync::OnceLock;

    const RATE: f32 = 44100.0;
    const FADE_END: f32 = 2.0; // Past the 1.5 s fade
    const C7M9: [u8; 5] = [48, 52, 55, 59, 62]; // The chord of the demos
    const CHOIR: u8 = 0;
    const NEW_AGE: u8 = 1;
    const ORCHESTRA: u8 = 2;
    const SWEEP: u8 = 3;
    const ANALOG: u8 = 4;
    // `new_age_hash`, taken on the engine of 65319e9, before any timbre reached it
    const NEW_AGE_BEFORE_TIMBRES: u64 = 0x6dc4d4d93e118ee4;

    // Per thread, so tests running beside this one cannot disturb its count
    thread_local! {
        static ALLOCATIONS: Cell<usize> = const { Cell::new(0) };
    }

    struct CountingAllocator;

    fn count_allocation() {
        let _ = ALLOCATIONS.try_with(|count| count.set(count.get() + 1));
    }

    unsafe impl GlobalAlloc for CountingAllocator {
        unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
            count_allocation();
            unsafe { System.alloc(layout) }
        }

        unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
            unsafe { System.dealloc(pointer, layout) }
        }

        unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, size: usize) -> *mut u8 {
            count_allocation();
            unsafe { System.realloc(pointer, layout, size) }
        }
    }

    #[global_allocator]
    static ALLOCATOR: CountingAllocator = CountingAllocator;

    impl Pad {
        // Both layers before the effects
        fn dry_frame(&mut self) -> (f32, f32) {
            let ((synth_left, synth_right), (bus_left, bus_right), (past_left, past_right)) = self.layers();
            (synth_left + bus_left + past_left, synth_right + bus_right + past_right)
        }

        // The sample layer alone, before the effects
        fn file_frame(&mut self) -> (f32, f32) {
            let (_, (bus_left, bus_right), (past_left, past_right)) = self.layers();
            (bus_left + past_left, bus_right + past_right)
        }
    }

    type Stereo = (Vec<f32>, Vec<f32>);

    // One-note chords, each marked by a file holding its own tone, so that one signal shows every chord's level
    const CHORD_A: [u8; 1] = [50];
    const CHORD_B: [u8; 1] = [57];
    const CHORD_C: [u8; 1] = [64];
    const CHORD_D: [u8; 1] = [71];
    const CHORD_E: [u8; 1] = [45];
    const TONES: [(u8, f32); 5] = [(50, 700.0), (57, 1500.0), (64, 2300.0), (71, 3100.0), (45, 3900.0)];

    fn tone_of(chord: [u8; 1]) -> f32 {
        TONES.iter().find(|(key, _)| *key == chord[0]).unwrap().1
    }

    // The sample layer before the effects, calling each cue at its time. A cue with no notes is a stop
    fn cued_tones(cues: &[(f32, &[u8])], seconds: f32) -> Vec<f32> {
        let (left, _) = sample_layer(
            |pad| for (key, hz) in TONES { load_tone(pad, key, hz) },
            RATE,
            |pad| {
                let mut signal: Stereo = (Vec::new(), Vec::new());
                for frame in 0..(seconds * RATE) as usize {
                    for (_, notes) in cues.iter().filter(|(second, _)| (second * RATE) as usize == frame) {
                        if notes.is_empty() { pad.stop() } else { pad.play(notes, NEW_AGE) }
                    }
                    let (left, right) = pad.dry_frame();
                    signal.0.push(left);
                    signal.1.push(right);
                }
                signal
            },
        );
        left
    }

    // A chord's level around a moment, read from its tone: 1 is a chord alone at full level
    fn level_at(signal: &[f32], chord: [u8; 1], second: f32) -> f32 {
        let half = (0.01 * RATE) as usize;
        let centre = (second * RATE) as usize;
        let windowed = hann(&signal[centre - half..centre + half]);
        let weight = (half as f32) * 2.0 * 0.5;
        let amplitude = 2.0 * (power_at(&windowed, tone_of(chord), RATE).sqrt() as f32) / weight;
        amplitude / (0.5 * SAMPLE_GAIN)
    }

    fn equal_power(seconds_of_fade: f32) -> f32 {
        (seconds_of_fade / FADE_SECONDS * FRAC_PI_2).sin()
    }

    fn assert_level(signal: &[f32], chord: [u8; 1], second: f32, expected: f32) {
        let level = level_at(signal, chord, second);
        assert!((level - expected).abs() < 0.02, "at {second} s: level {level}, expected {expected}");
    }

    struct BankFile {
        key: u8,
        audio: Vec<f32>,
        loop_start: usize,
        loop_end: usize,
    }

    fn numbers(text: &str) -> Vec<usize> {
        text.split(|c: char| !c.is_ascii_digit()).filter(|word| !word.is_empty()).map(|word| word.parse().unwrap()).collect()
    }

    // The shipped New Age files, as src/chords.ts lists them. The level of real audio is what PAD-14, PAD-20 and PAD-27 are about
    fn bank() -> &'static [BankFile] {
        static BANK: OnceLock<Vec<BankFile>> = OnceLock::new();
        BANK.get_or_init(|| {
            let root = env!("CARGO_MANIFEST_DIR");
            let source = std::fs::read_to_string(format!("{root}/src/chords.ts")).unwrap();
            let files: Vec<BankFile> = source.lines().filter(|line| line.contains("url: '/pads/new-age/")).map(|line| {
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

    struct TimbreFile {
        key: u8,
        left: Vec<f32>,
        right: Vec<f32>,
        loop_start: usize,
        loop_end: usize,
    }

    // Every bank's real files, as PAD_TIMBRES lists them and the worklet receives them
    fn timbre_banks() -> &'static [Vec<TimbreFile>; TIMBRES] {
        static BANKS: OnceLock<[Vec<TimbreFile>; TIMBRES]> = OnceLock::new();
        BANKS.get_or_init(|| {
            let root = env!("CARGO_MANIFEST_DIR");
            let source = std::fs::read_to_string(format!("{root}/src/chords.ts")).unwrap();
            let folders = ["/pads/choir/", "/pads/new-age/", "/pads/orchestra/", "/pads/sweep/"];
            let banks = std::array::from_fn(|timbre| {
                let Some(folder) = folders.get(timbre) else { return Vec::new() };
                let lines = source.lines().filter(|line| line.contains(&format!("url: '{folder}")));
                lines.map(|line| {
                    let parts: Vec<&str> = line.split('\'').collect();
                    let (key, loops) = (numbers(parts[0]), numbers(parts[2]));
                    let path = format!("{root}/public{}", parts[1]);
                    let output = Command::new("ffmpeg")
                        .args(["-v", "error", "-i", &path, "-f", "f32le", "-"])
                        .output()
                        .expect("ffmpeg decodes the bank");
                    assert!(output.status.success());
                    let audio: Vec<f32> = output.stdout.chunks_exact(4).map(|bytes| f32::from_le_bytes(bytes.try_into().unwrap())).collect();
                    // A mono file plays on both sides at its own level, as decodeResponse hands it to the worklet.
                    // ffmpeg's -ac 2 would scale it 3 dB down
                    let probe = Command::new("ffprobe")
                        .args(["-v", "error", "-show_entries", "stream=channels", "-of", "csv=p=0", &path])
                        .output()
                        .expect("ffprobe reads the bank");
                    let channels = numbers(&String::from_utf8_lossy(&probe.stdout))[0];
                    let channel = |side: usize| audio.iter().skip(side % channels).step_by(channels).copied().collect();
                    TimbreFile { key: key[0] as u8, left: channel(0), right: channel(1), loop_start: loops[0], loop_end: loops[1] }
                }).collect()
            });
            let counts = [5, 8, 13, 8];
            for (bank, count) in banks.iter().zip(counts) {
                let bank: &Vec<TimbreFile> = bank;
                assert_eq!(bank.len(), count);
            }
            banks
        })
    }

    fn load_timbre(pad: &mut Pad, timbre: u8) {
        for file in &timbre_banks()[timbre as usize] {
            pad.load(timbre, file.key, &file.left, &file.right, file.loop_start, file.loop_end);
        }
    }

    // What a timbre plays for a chord, as timbreNotes in src/chords.ts says
    fn timbre_notes(chord: &[u8], timbre: u8) -> Vec<u8> {
        let bass = if timbre == ORCHESTRA { vec![chord[0] - 24, chord[0] - 12] } else { Vec::new() };
        [&bass[..], chord].concat()
    }

    fn load_bank(pad: &mut Pad) {
        for file in bank() {
            pad.load(NEW_AGE, file.key, &file.audio, &file.audio, file.loop_start, file.loop_end);
        }
    }

    fn sine(hz: f32, seconds: f32, rate: f32) -> Vec<f32> {
        (0..(seconds * rate) as usize).map(|frame| 0.5 * (std::f64::consts::TAU * hz as f64 * frame as f64 / rate as f64).sin() as f32).collect()
    }

    // A file that holds one tone and is too long to reach its loop in these tests
    fn load_tone(pad: &mut Pad, key: u8, hz: f32) {
        let tone = sine(hz, 40.0, pad.sample_rate);
        pad.load(NEW_AGE, key, &tone, &tone, 0, tone.len() - 1);
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
    fn pad_04_first_chord_fades_in_over_1_5_s() {
        let signal = cued_tones(&[(0.0, &CHORD_A)], 3.0);
        assert_level(&signal, CHORD_A, 0.02, equal_power(0.02));
        assert_level(&signal, CHORD_A, 0.75, equal_power(0.75));
        assert_level(&signal, CHORD_A, 1.2, equal_power(1.2));
        assert!(level_at(&signal, CHORD_A, 1.3) < 0.985, "full level came before 1.5 s");
        assert_level(&signal, CHORD_A, 1.52, 1.0);
        assert_level(&signal, CHORD_A, 2.5, 1.0);

        // The synth layer follows the same fade
        let mut pad = Pad::new(RATE);
        pad.play(&C7M9, NEW_AGE);
        let (left, _) = render_dry(&mut pad, 3.0);
        let level = |second: f32| db(rms(&left[(second * RATE) as usize..((second + 0.2) * RATE) as usize]));
        assert!(level(0.0) < level(2.5) - 12.0);
        assert!(level(0.0) < level(0.4) && level(0.4) < level(0.8) && level(0.8) < level(1.2));
    }

    #[test]
    fn pad_05_held_chord_never_ends() {
        let mut pad = Pad::new(RATE);
        pad.play(&C7M9, NEW_AGE);
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
        pad.play(&C7M9, NEW_AGE);
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
                    pad.play(&[note], NEW_AGE);
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
            pad.play(chord, NEW_AGE);
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
                |pad| { pad.play(chord, NEW_AGE); render(pad, 16.0) },
            );
            let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
            for &note in chord {
                let peak = peak_cents(&signal, note as f32, RATE);
                assert!(peak.abs() <= 5.0, "note {note} is {peak} cents off");
            }
        }
    }

    #[test]
    fn pad_08_crossfades_over_1_5_s() {
        let signal = cued_tones(&[(0.0, &CHORD_A), (2.0, &CHORD_B)], 4.0);
        assert_level(&signal, CHORD_A, 1.98, 1.0);
        assert_level(&signal, CHORD_B, 1.98, 0.0);
        for into_fade in [0.3, 0.75, 1.2] {
            let second = 2.0 + into_fade;
            assert_level(&signal, CHORD_B, second, equal_power(into_fade));
            assert_level(&signal, CHORD_A, second, equal_power(FADE_SECONDS - into_fade));
            let power = level_at(&signal, CHORD_A, second).powi(2) + level_at(&signal, CHORD_B, second).powi(2);
            assert!((power - 1.0).abs() < 0.05, "the crossfade dips or swells: {power}");
        }
        assert_level(&signal, CHORD_A, 3.52, 0.0);
        assert_level(&signal, CHORD_B, 3.52, 1.0);
    }

    #[test]
    fn pad_09_stop_fades_over_1_5_s() {
        let signal = cued_tones(&[(0.0, &CHORD_A), (2.0, &[])], 4.0);
        assert_level(&signal, CHORD_A, 1.98, 1.0);
        assert_level(&signal, CHORD_A, 2.75, equal_power(0.75));
        assert_level(&signal, CHORD_A, 3.2, equal_power(0.3));
        assert_level(&signal, CHORD_A, 3.52, 0.0);

        // Both layers reach silence once the filter has rung out
        let mut pad = Pad::new(RATE);
        load_tone(&mut pad, 50, 700.0);
        pad.play(&C7M9, NEW_AGE);
        render_dry(&mut pad, 2.0);
        pad.stop();
        let (left, right) = render_dry(&mut pad, 2.0);
        assert!(rms(&left[..(0.5 * RATE) as usize]) > 0.0);
        assert!(db(rms(after(&left, 1.6, RATE)).max(rms(after(&right, 1.6, RATE)))) < -100.0);
    }

    #[test]
    fn pad_10_settles_on_the_last_chord() {
        let clicks: [(f32, &[u8]); 5] = [(0.0, &CHORD_A), (0.3, &CHORD_B), (0.6, &CHORD_C), (0.9, &CHORD_D), (1.2, &CHORD_E)];
        let signal = cued_tones(&clicks, 3.5);
        assert_level(&signal, CHORD_E, 3.0, 1.0);
        for chord in [CHORD_A, CHORD_B, CHORD_C, CHORD_D] {
            assert_level(&signal, chord, 3.0, 0.0);
        }
    }

    #[test]
    fn pad_11_fade_continues_from_its_level() {
        // Replaced at 0.5 s while rising, then replaced again at 0.75 s
        let signal = cued_tones(&[(0.0, &CHORD_A), (0.5, &CHORD_B), (0.75, &CHORD_C)], 2.5);
        let level_of_a_at = |second: f32| 1.0 / 3.0 - (second - 0.5) / FADE_SECONDS;
        assert_level(&signal, CHORD_A, 0.48, equal_power(0.48));
        assert_level(&signal, CHORD_A, 0.52, (level_of_a_at(0.52) * FRAC_PI_2).sin());
        assert_level(&signal, CHORD_A, 0.77, (level_of_a_at(0.77) * FRAC_PI_2).sin());
        assert_level(&signal, CHORD_A, 1.02, 0.0);

        let level_of_b_at = |second: f32| 1.0 / 6.0 - (second - 0.75) / FADE_SECONDS;
        assert_level(&signal, CHORD_B, 0.73, equal_power(0.23));
        assert_level(&signal, CHORD_B, 0.77, (level_of_b_at(0.77) * FRAC_PI_2).sin());
        assert_level(&signal, CHORD_C, 1.5, equal_power(0.75));

        // A click leaves no step in the signal itself
        let step = |range: std::ops::Range<f32>| {
            let (start, end) = ((range.start * RATE) as usize, (range.end * RATE) as usize);
            signal[start..end].windows(2).map(|pair| (pair[1] - pair[0]).abs()).fold(0.0, f32::max)
        };
        for click in [0.5, 0.75] {
            assert!(step(click - 0.002..click + 0.002) <= 1.2 * step(click - 0.02..click - 0.002));
        }
    }

    #[test]
    fn pad_12_at_most_3_chords() {
        let clicks: [(f32, &[u8]); 5] = [(0.0, &CHORD_A), (1.2, &CHORD_B), (1.3, &CHORD_C), (1.35, &CHORD_D), (1.36, &CHORD_E)];
        let signal = cued_tones(&clicks, 3.5);

        // The oldest is still well up when the fourth click comes, and has left 20 ms later
        assert!(level_at(&signal, CHORD_A, 1.335) > 0.5);
        assert_level(&signal, CHORD_A, 1.385, 0.0);

        // A newer click took the place of the fourth, which never sounds
        for tenth_of_ms in (13000..16000).step_by(25) {
            assert_level(&signal, CHORD_D, tenth_of_ms as f32 / 10000.0, 0.0);
        }
        // It starts as soon as the slot is free, on its 1.5 s fade
        assert!(level_at(&signal, CHORD_E, 1.335) < 0.01);
        assert_level(&signal, CHORD_E, 1.75, equal_power(1.75 - 1.37));

        let audible = |second: f32| {
            [CHORD_A, CHORD_B, CHORD_C, CHORD_D, CHORD_E].iter().filter(|chord| level_at(&signal, **chord, second) > 0.0005).count()
        };
        // The meter spans 20 ms, so it blurs the instant the new chord takes the old one's slot
        let swap = 13600..13800;
        let most = (11000..30000).step_by(25).filter(|tenth_of_ms| !swap.contains(tenth_of_ms))
            .map(|tenth_of_ms| audible(tenth_of_ms as f32 / 10000.0)).max();
        assert_eq!(most, Some(3));
    }

    #[test]
    fn pad_13_one_chord_after_fades() {
        let all = [CHORD_A, CHORD_B, CHORD_C, CHORD_D, CHORD_E];
        let sounding = |signal: &[f32], second: f32| all.iter().filter(|chord| level_at(signal, **chord, second) > 0.005).count();

        let signal = cued_tones(&[(0.0, &CHORD_A), (2.0, &CHORD_B), (2.5, &CHORD_C)], 5.0);
        assert_eq!(sounding(&signal, 1.8), 1);
        assert_eq!(sounding(&signal, 2.2), 2);
        assert_eq!(sounding(&signal, 4.2), 1);

        let signal = cued_tones(&[(0.0, &CHORD_A), (2.0, &CHORD_B), (2.5, &[])], 5.0);
        assert_eq!(sounding(&signal, 4.2), 0);
    }

    #[test]
    fn pad_14_chords_match_within_3_db() {
        let mut levels: Vec<(f32, Vec<u8>)> = all_chords().into_iter().map(|chord| {
            let mut pad = Pad::new(RATE);
            load_bank(&mut pad);
            pad.play(&chord, NEW_AGE);
            let (left, right) = render(&mut pad, 12.0);
            let held = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
            (db(rms(&held)), chord)
        }).collect();
        levels.sort_by(|a, b| a.0.total_cmp(&b.0));
        let (quietest, loudest) = (&levels[0], &levels[levels.len() - 1]);
        assert!(loudest.0 - quietest.0 <= 3.0, "{quietest:?} against {loudest:?}");
        // Without files too, as during loading
        let synth_level = |chord: &[u8]| {
            let mut pad = Pad::new(RATE);
            pad.play(chord, NEW_AGE);
            let (left, _) = render(&mut pad, 12.0);
            db(rms(after(&left, FADE_END, RATE)))
        };
        let triad = synth_level(&[56, 60, 63]);
        let five_notes = synth_level(&[45, 49, 52, 55, 59]);
        assert!((triad - five_notes).abs() <= 3.0, "triad {triad} dB, 5 notes {five_notes} dB");
    }

    #[test]
    fn pad_39_fading_chord_returns() {
        // Halfway down its fade it comes back from there, on the same voices
        let signal = cued_tones(&[(0.0, &CHORD_A), (2.0, &[]), (2.75, &CHORD_A)], 5.0);
        assert_level(&signal, CHORD_A, 2.73, equal_power(0.77));
        assert_level(&signal, CHORD_A, 2.77, equal_power(0.77));
        assert_level(&signal, CHORD_A, 3.0, equal_power(1.0));
        assert!(level_at(&signal, CHORD_A, 3.3) < 0.985, "full level came too soon");
        assert_level(&signal, CHORD_A, 3.52, 1.0);
        assert_level(&signal, CHORD_A, 4.5, 1.0);

        // Back from under a crossfade: the chord that replaced it leaves again
        let signal = cued_tones(&[(0.0, &CHORD_A), (2.0, &CHORD_B), (2.75, &CHORD_A)], 5.0);
        assert_level(&signal, CHORD_A, 2.77, equal_power(0.77));
        assert_level(&signal, CHORD_A, 3.6, 1.0);
        assert_level(&signal, CHORD_B, 3.6, 0.0);
    }

    #[test]
    fn pad_59_no_allocation() {
        let allocations = || ALLOCATIONS.with(Cell::get);

        // The meter works
        let before = allocations();
        std::hint::black_box(vec![0u8; 16]);
        assert!(allocations() > before);

        let mut pad = Pad::new(RATE);
        load_bank(&mut pad);
        let (mut left, mut right) = ([0.0f32; 128], [0.0f32; 128]);
        let chords: [&[u8]; 5] = [&C7M9, &[45, 49, 52], &[56, 60, 63, 67, 70], &[46, 50, 53, 57], &[47, 50, 54]];

        let before = allocations();
        let mut blocks = |pad: &mut Pad, count: usize| {
            for _ in 0..count {
                pad.mix_into(&mut left, &mut right);
            }
        };
        pad.play(chords[0], NEW_AGE); // Starts
        blocks(&mut pad, 100);
        pad.play(chords[1], NEW_AGE); // Changes
        blocks(&mut pad, 10);
        pad.play(chords[2], NEW_AGE);
        pad.play(chords[3], NEW_AGE); // Waits for a slot
        pad.play(chords[4], NEW_AGE); // Replaces the one waiting
        blocks(&mut pad, 100);
        pad.play(chords[3], NEW_AGE);
        pad.play(chords[4], NEW_AGE); // Returns while fading
        blocks(&mut pad, 10);
        pad.stop(); // Stops
        blocks(&mut pad, 1000);
        assert_eq!(allocations(), before);
    }

    #[test]
    fn pad_19_output_is_stereo() {
        let correlation = |left: &[f32], right: &[f32]| {
            let dot = |a: &[f32], b: &[f32]| a.iter().zip(b).map(|(x, y)| (x * y) as f64).sum::<f64>();
            dot(left, right) / (dot(left, left) * dot(right, right)).sqrt()
        };
        let mut pad = Pad::new(RATE);
        load_bank(&mut pad);
        pad.play(&C7M9, NEW_AGE);
        let (left, right) = render(&mut pad, 12.0);
        let similarity = correlation(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
        assert!(similarity < 0.95, "left and right correlate at {similarity}");

        // The files are mono, so what differs in the sample layer comes from the effects
        let (left, right) = sample_layer(load_bank, RATE, |pad| { pad.play(&C7M9, NEW_AGE); render(pad, 12.0) });
        let similarity = correlation(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
        assert!(similarity < 0.95, "the sample layer correlates at {similarity}");

        // A lone impulse shows the chorus: each channel repeats it about 45 ms later, at its own moment
        for rate in [RATE, 48000.0] {
            let impulse_at = (2.0 * rate) as usize;
            let mut file = vec![0.0; 3 * impulse_at];
            file[impulse_at] = 1.0;
            let (left, right) = sample_layer(
                |pad| pad.load(NEW_AGE, 60, &file, &file, 0, file.len() - 1),
                rate,
                |pad| { pad.play(&[60], NEW_AGE); render(pad, 2.3) },
            );
            let echo = |signal: &[f32]| {
                let frame = |ms: f32| impulse_at + (ms * rate / 1000.0) as usize;
                let tallest = (frame(44.0)..frame(48.0)).max_by(|a, b| signal[*a].abs().total_cmp(&signal[*b].abs())).unwrap();
                ((tallest - impulse_at) as f32 * 1000.0 / rate, signal[tallest].abs() / signal[impulse_at].abs())
            };
            let (time_left, height_left) = echo(&left);
            let (time_right, height_right) = echo(&right);
            assert!(height_left > 0.2 && height_right > 0.2, "echoes of {height_left} and {height_right}");
            assert!((time_left - time_right).abs() > 0.5, "echoes at {time_left} and {time_right} ms");

            // The reverb answers at 64.5 ms at any rate: after the gap between the first two taps, not inside it
            let frame = |ms: f32| impulse_at + (ms * rate / 1000.0) as usize;
            let tallest_in = |from: f32, to: f32| left[frame(from)..frame(to)].iter().fold(0f32, |peak, value| peak.max(value.abs()));
            assert!(tallest_in(49.0, 59.8) < 1e-3 * left[impulse_at].abs(), "something answers between the taps");
            assert!(tallest_in(63.5, 65.5) > 1e-3 * left[impulse_at].abs(), "the reverb does not answer");
        }

        // After the fade the reverb still rings, where the voices have stopped
        let mut pad = Pad::new(RATE);
        pad.play(&C7M9, NEW_AGE);
        render(&mut pad, 3.0);
        pad.stop();
        let (left, _) = render(&mut pad, 2.0);
        assert!(db(rms(after(&left, 1.6, RATE))) > -70.0, "no reverb tail");
    }

    #[test]
    fn pad_tail_ends_in_silence() {
        let tail_seconds = |rate: f32| {
            let mut pad = Pad::new(rate);
            assert!(pad.is_silent());
            pad.play(&C7M9, NEW_AGE);
            assert!(!pad.is_silent());
            render(&mut pad, 3.0);
            pad.stop();
            let mut seconds = 0.0;
            while !pad.is_silent() {
                render(&mut pad, 0.1);
                seconds += 0.1;
                assert!(seconds < 30.0, "the tail never ended");
            }
            assert!(seconds > FADE_SECONDS, "silent after {seconds} s, before the fade ended");

            // Silent, it leaves the buffers alone, and a new chord sounds again
            let (mut left, mut right) = ([0.25f32; 128], [-0.25f32; 128]);
            pad.mix_into(&mut left, &mut right);
            assert!(left.iter().all(|value| *value == 0.25) && right.iter().all(|value| *value == -0.25));
            pad.play(&C7M9, NEW_AGE);
            assert!(!pad.is_silent());
            let (left, _) = render(&mut pad, 3.0);
            assert!(db(rms(after(&left, FADE_END, rate))) > -40.0);
            seconds
        };
        // About the same tail in seconds at either rate
        let (at_44100, at_48000) = (tail_seconds(RATE), tail_seconds(48000.0));
        assert!((at_44100 - at_48000).abs() < 0.1 * at_44100, "{at_44100} s against {at_48000} s");
    }

    #[test]
    fn pad_58_pitch_holds_at_48_khz() {
        let rate = 48000.0;
        for chord in [&[45u8][..], &[70], &C7M9] {
            let mut pad = Pad::new(rate);
            pad.play(chord, NEW_AGE);
            let (left, right) = render(&mut pad, 16.0);
            let signal = mono(after(&left, FADE_END, rate), after(&right, FADE_END, rate));
            for &note in chord {
                let centre = cluster_centre_cents(&signal, note as f32, rate);
                assert!(centre.abs() <= 5.0, "note {note} is {centre} cents off");
            }

            // decodeAudioData hands the engine files at its own rate
            let (left, right) = sample_layer(
                |pad| for key in [44, 48, 52, 56, 60, 64, 68, 72] { load_tone(pad, key, note_hz(key as f32)) },
                rate,
                |pad| { pad.play(chord, NEW_AGE); render(pad, 16.0) },
            );
            let signal = mono(after(&left, FADE_END, rate), after(&right, FADE_END, rate));
            for &note in chord {
                let peak = peak_cents(&signal, note as f32, rate);
                assert!(peak.abs() <= 5.0, "note {note} is {peak} cents off");
            }
        }
    }

    fn all_chords() -> Vec<Vec<u8>> {
        const TYPES: [&[u8]; 14] = [
            &[0, 4, 7], &[0, 3, 7], &[0, 4, 7, 10], &[0, 4, 7, 11], &[0, 3, 7, 10], &[0, 5, 7], &[0, 2, 7],
            &[0, 4, 7, 14], &[0, 4, 7, 10, 14], &[0, 3, 7, 10, 14], &[0, 4, 7, 11, 14], &[0, 4, 7, 9], &[0, 3, 6], &[0, 4, 8],
        ];
        (45..=56u8).flat_map(|root| TYPES.iter().map(move |semitones| semitones.iter().map(|semitone| root + semitone).collect())).collect()
    }

    fn peak(signal: &[f32]) -> f32 {
        signal.iter().fold(0.0, |peak, value| peak.max(value.abs()))
    }

    #[test]
    fn pad_27_default_peak() {
        // The app sends 70 from a slider going to 100, and a fresh engine must already sit there
        let mut held_peaks: Vec<(f32, Vec<u8>)> = all_chords().into_iter().map(|chord| {
            let mut pad = Pad::new(RATE);
            load_bank(&mut pad);
            pad.play(&chord, NEW_AGE);
            let (left, right) = render(&mut pad, 16.0);
            (peak(&left).max(peak(&right)), chord)
        }).collect();
        held_peaks.sort_by(|a, b| a.0.total_cmp(&b.0));
        let (loudest, chord) = held_peaks.last().unwrap();
        assert!(db(*loudest) <= -12.0, "{chord:?} peaks at {} dBFS", db(*loudest));

        // Two chords overlap through every crossfade, each opening on the hot start of its files
        let mut pad = Pad::new(RATE);
        load_bank(&mut pad);
        pad.set_volume(0.7);
        let (mut left, mut right) = ([0.0f32; 128], [0.0f32; 128]);
        let mut crossfade_peak = 0f32;
        for (_, chord) in held_peaks.iter().rev().take(40) {
            pad.play(chord, NEW_AGE);
            for _ in 0..(2.0 * RATE / 128.0) as usize {
                left.fill(0.0);
                right.fill(0.0);
                pad.mix_into(&mut left, &mut right);
                crossfade_peak = crossfade_peak.max(peak(&left)).max(peak(&right));
            }
        }
        assert!(db(crossfade_peak) <= -12.0, "a crossfade peaks at {} dBFS", db(crossfade_peak));
    }

    #[test]
    fn pad_42_volume_has_no_click() {
        // A slow tone has small steps of its own, so a jump in gain would stand out
        let held = || {
            let mut pad = Pad::new(RATE);
            load_tone(&mut pad, 45, 110.0);
            pad.play(&[45], NEW_AGE);
            render(&mut pad, 3.0);
            pad
        };
        let largest_step = |signal: &[f32]| signal.windows(2).map(|pair| (pair[1] - pair[0]).abs()).fold(0.0, f32::max);

        let mut pad = held();
        pad.set_volume(1.0);
        render(&mut pad, 0.1);
        let (full, _) = render(&mut pad, 2.0);
        let (full_level, full_step) = (rms(&full), largest_step(&full));

        for (from, to) in [(1.0, 0.0), (0.0, 1.0), (0.2, 0.9)] {
            // A jump is only as tall as the signal at that moment, so the change comes all across the tone's 9 ms
            for moment in 0..9 {
                let mut pad = held();
                pad.set_volume(from);
                let (before, _) = render(&mut pad, 0.1 + moment as f32 * 0.001);
                pad.set_volume(to);
                let (signal, _) = render(&mut pad, 2.0);
                // From the last frame before the change, or a jump would fall between the two renders
                let across = [&before[before.len() - 1..], &signal[..]].concat();
                assert!(largest_step(&across) <= 1.25 * full_step, "from {from} to {to}: step {} after {full_step}", largest_step(&across));
                let settled = after(&signal, 0.1, RATE);
                assert!((rms(settled) - to * full_level).abs() <= 0.1 * full_level, "from {from} to {to}: level {}", rms(settled));
            }
        }

        // Down to nothing
        let mut pad = held();
        pad.set_volume(0.0);
        render(&mut pad, 0.1);
        let (signal, _) = render(&mut pad, 0.5);
        assert_eq!(peak(&signal), 0.0);

        // It leaves the buffers' drums alone, whatever the volume
        let mut pad = held();
        pad.set_volume(0.0);
        render(&mut pad, 0.1);
        let (mut left, mut right) = ([0.5f32; 128], [-0.5f32; 128]);
        pad.mix_into(&mut left, &mut right);
        assert!(left.iter().all(|value| *value == 0.5) && right.iter().all(|value| *value == -0.5));
    }

    #[test]
    fn pad_49_late_samples_fade_in() {
        let loaded_at = 2.0;
        let late = |load: fn(&mut Pad)| {
            let run = |with_files: bool| {
                let mut pad = Pad::new(RATE);
                pad.play(&CHORD_A, NEW_AGE);
                let (mut left, _) = render_dry(&mut pad, loaded_at);
                if with_files {
                    load(&mut pad);
                }
                left.extend(render_dry(&mut pad, 3.0).0);
                left
            };
            let (loaded, bare) = (run(true), run(false));
            loaded.iter().zip(&bare).map(|(a, b)| a - b).collect::<Vec<f32>>()
        };

        // The first file reaches the held note from nothing, over 1.5 s
        let signal = late(|pad| load_tone(pad, 50, tone_of(CHORD_A)));
        assert_level(&signal, CHORD_A, loaded_at - 0.02, 0.0);
        assert_level(&signal, CHORD_A, loaded_at + 0.02, equal_power(0.02));
        assert_level(&signal, CHORD_A, loaded_at + 0.75, equal_power(0.75));
        assert!(level_at(&signal, CHORD_A, loaded_at + 1.3) < 0.985, "full level came before 1.5 s");
        assert_level(&signal, CHORD_A, loaded_at + 1.2, equal_power(1.2));
        assert_level(&signal, CHORD_A, loaded_at + 1.52, 1.0);
        assert_level(&signal, CHORD_A, loaded_at + 2.5, 1.0);

        // A nearer file takes over with no click: the first leaves in 20 ms, and the second rises
        let run = || {
            let mut pad = Pad::new(RATE);
            load_tone(&mut pad, 44, 110.0);
            pad.play(&[50], NEW_AGE);
            let (before, _) = render_dry(&mut pad, 3.0);
            (pad, before[before.len() - 1])
        };
        let ((mut bare, _), (mut loaded, last_before)) = (run(), run());
        load_tone(&mut loaded, 52, 200.0);
        // From the last frame before the load, or a jump would fall between the two renders
        let signal = [&[last_before][..], &render_dry(&mut loaded, 3.0).0].concat();
        let bare_signal = render_dry(&mut bare, 3.0).0;
        let moved = 2f32.powf(6.0 / 12.0);
        let nearer_tone = 200.0 * 2f32.powf(-2.0 / 12.0);
        let heard = |signal: &[f32], hz: f32, second: f32| {
            let window = &signal[(second * RATE) as usize..((second + 0.2) * RATE) as usize];
            band_power(window, hz, 40.0, RATE)
        };
        assert!(heard(&signal, nearer_tone, 2.5) > 1000.0 * heard(&signal, 110.0 * moved, 2.5), "the first file stayed");
        let step = |signal: &[f32], from: usize, to: usize| signal[from..to].windows(2).map(|pair| (pair[1] - pair[0]).abs()).fold(0.0, f32::max);
        let swap_end = (0.05 * RATE) as usize;
        let last = (2.9 * RATE) as usize;
        assert!(step(&signal, 0, swap_end) <= 1.25 * step(&bare_signal, last - swap_end, last), "the swap clicks");
    }

    #[test]
    fn pad_17_note_mixes_both_layers() {
        // A tone no harmonic of the note can reach marks the sample layer, at the -16 dBFS RMS of the real loops
        let (marker, note) = (700.0, 69);
        let tone: Vec<f32> = sine(marker, 40.0, RATE).iter().map(|value| value * 0.45).collect();
        let mut pad = Pad::new(RATE);
        pad.load(NEW_AGE, note, &tone, &tone, 0, tone.len() - 1);
        pad.play(&[note], NEW_AGE);
        let (left, right) = render(&mut pad, 6.0);
        let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
        let sample = band_power(&signal, marker, 15.0, RATE);
        let synth = band_power(&signal, 440.0, 25.0, RATE);
        assert!(10.0 * (sample / synth).log10() > -12.0, "the sample layer is missing: {sample} against {synth}");
        assert!(10.0 * (sample / synth).log10() < 12.0, "the synth layer is missing: {sample} against {synth}");
    }

    #[test]
    fn pad_12_eviction_takes_20_ms() {
        // The oldest chord is at about 0.9, 0.7 and 0.13 when the fourth click comes, with all 3 slots held
        for fading in [0.15, 0.45, 1.3] {
            let mut pad = Pad::new(RATE);
            pad.play(&CHORD_A, NEW_AGE);
            render(&mut pad, 2.0);
            pad.play(&CHORD_B, NEW_AGE);
            render(&mut pad, fading * 2.0 / 3.0);
            pad.play(&CHORD_C, NEW_AGE);
            render(&mut pad, fading / 3.0);
            pad.play(&CHORD_D, NEW_AGE);
            assert!(pad.slots.iter().all(|slot| slot.count > 0), "a free slot means no eviction, from {fading} s of fade");
            render(&mut pad, 0.019);
            assert_eq!(pad.slots[0].voices[0].note, CHORD_A[0], "gone before 19 ms, from {fading} s of fade");
            assert!(pad.slots[0].level > 0.0, "silent before 19 ms, from {fading} s of fade");
            render(&mut pad, 0.002);
            assert_eq!(pad.slots[0].voices[0].note, CHORD_D[0], "still held at 21 ms, from {fading} s of fade");
        }
    }

    #[test]
    fn pad_60_balance_across_every_chord() {
        const SEMITONES: [&[u8]; 14] = [
            &[0, 4, 7], &[0, 3, 7], &[0, 4, 7, 10], &[0, 4, 7, 11], &[0, 3, 7, 10], &[0, 5, 7], &[0, 2, 7],
            &[0, 4, 7, 14], &[0, 4, 7, 10, 14], &[0, 3, 7, 10, 14], &[0, 4, 7, 11, 14], &[0, 4, 7, 9], &[0, 3, 6], &[0, 4, 8],
        ];
        let (mut lowest, mut highest) = (f32::MAX, f32::MIN);
        for root in 45..=56u8 {
            for semitones in SEMITONES {
                let notes: Vec<u8> = semitones.iter().map(|semitone| root + semitone).collect();
                let held = |pad: &mut Pad| { pad.play(&notes, NEW_AGE); render(pad, 16.0) };
                let mut with_samples = Pad::new(RATE);
                load_bank(&mut with_samples);
                let (left, _) = held(&mut with_samples);
                let (synth, _) = held(&mut Pad::new(RATE));
                let sample: Vec<f32> = left.iter().zip(&synth).map(|(a, b)| a - b).collect();
                let difference = db(rms(after(&sample, 4.0, RATE))) - db(rms(after(&synth, 4.0, RATE)));
                lowest = lowest.min(difference);
                highest = highest.max(difference);
            }
        }
        assert!(lowest >= -2.5 && highest <= 4.5, "from {lowest} to {highest} dB");
    }

    #[test]
    fn pad_61_load_clamps_a_loop_end_past_the_file() {
        let tone = sine(440.0, 1.0, RATE);
        let mut pad = Pad::new(RATE);
        pad.load(NEW_AGE, 69, &tone, &tone, 1000, tone.len() + 500);
        assert_eq!(pad.banks[NEW_AGE as usize][0].loop_end, tone.len() - 1);
        pad.play(&[69], NEW_AGE);
        render(&mut pad, 3.0); // Reading past the file would panic
    }

    #[test]
    fn pad_61_load_refuses_an_empty_loop() {
        let tone = sine(440.0, 1.0, RATE);
        let mut pad = Pad::new(RATE);
        for (start, end) in [(1000, 1000), (2000, 1000), (tone.len(), tone.len() + 500)] {
            pad.load(NEW_AGE, 69, &tone, &tone, start, end);
        }
        pad.load(NEW_AGE, 69, &[], &[], 0, 0);
        assert!(pad.banks[NEW_AGE as usize].is_empty());
        pad.play(&[69], NEW_AGE);
        render(&mut pad, 3.0);
    }

    #[test]
    fn pad_20_layer_balance() {
        let held = |pad: &mut Pad| { pad.play(&C7M9, NEW_AGE); render(pad, 24.0) };
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
            pad.play(&[note], NEW_AGE);
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
        pad.play(&[69], NEW_AGE);
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
        pad.play(&chord, NEW_AGE);
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
        pad.play(&[69], NEW_AGE);
        let (left, right) = render(&mut pad, 6.0);
        assert!(db(rms(after(&left, FADE_END, RATE))) > -40.0);
        // Only the harmonics of the note: the bands between them hold nothing
        let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
        let fundamental = band_power(&signal, 440.0, 25.0, RATE);
        let between = band_power(&signal, 660.0, 25.0, RATE);
        assert!(between < fundamental / 1000.0, "between {between} fundamental {fundamental}");
    }

    // The real bank through a start, a crossfade, a replaced chord and a stop, rounded to 1/1024 and hashed with
    // FNV-1a. So coarse a grid leaves the last bits of a platform's libm out of the hash, and over a million
    // values any change a listener could hear still moves many samples across it
    fn new_age_hash(play: impl Fn(&mut Pad, &[u8]), load: impl Fn(&mut Pad)) -> u64 {
        let mut pad = Pad::new(RATE);
        load(&mut pad);
        play(&mut pad, &C7M9);
        let (mut left, mut right) = render(&mut pad, 5.0);
        let mut hold = |pad: &mut Pad, seconds: f32| {
            let (more_left, more_right) = render(pad, seconds);
            left.extend(more_left);
            right.extend(more_right);
        };
        play(&mut pad, &[45, 49, 52]);
        hold(&mut pad, 4.0);
        play(&mut pad, &[56, 60, 63, 67, 70]);
        hold(&mut pad, 0.7);
        play(&mut pad, &[46, 50, 53, 57]);
        hold(&mut pad, 2.5);
        pad.stop();
        hold(&mut pad, 3.0);
        left.iter().chain(&right).flat_map(|value| ((value * 1024.0).round() as i32).to_le_bytes())
            .fold(0xcbf29ce484222325u64, |hash, byte| (hash ^ byte as u64).wrapping_mul(0x100000001b3))
    }

    #[test]
    fn tim_10_new_age_is_unchanged() {
        assert_eq!(new_age_hash(|pad, notes| pad.play(notes, NEW_AGE), load_bank), NEW_AGE_BEFORE_TIMBRES);
    }

    // One note in each timbre, each marked by a tone in its own file
    const TIMBRE_NOTE: [u8; 1] = [50];
    const TIMBRE_TONES: [(u8, f32); 4] = [(CHOIR, 700.0), (NEW_AGE, 1500.0), (ORCHESTRA, 2300.0), (SWEEP, 3100.0)];

    fn tone_of_timbre(timbre: u8) -> f32 {
        TIMBRE_TONES.iter().find(|(id, _)| *id == timbre).unwrap().1
    }

    // The sample layer before the effects, picking a timbre at each cue. Files show each timbre's own level
    fn cued_timbres(cues: &[(f32, u8)], seconds: f32) -> Vec<f32> {
        let mut pad = Pad::new(RATE);
        for (timbre, hz) in TIMBRE_TONES {
            let tone = sine(hz, 40.0, RATE);
            pad.load(timbre, TIMBRE_NOTE[0], &tone, &tone, 0, tone.len() - 1);
        }
        (0..(seconds * RATE) as usize).map(|frame| {
            for (_, timbre) in cues.iter().filter(|(second, _)| (second * RATE) as usize == frame) {
                pad.play(&TIMBRE_NOTE, *timbre);
            }
            pad.file_frame().0
        }).collect()
    }

    fn tone_level(signal: &[f32], hz: f32, second: f32) -> f32 {
        let half = (0.01 * RATE) as usize;
        let centre = (second * RATE) as usize;
        power_at(&hann(&signal[centre - half..centre + half]), hz, RATE).sqrt() as f32
    }

    #[test]
    fn tim_03_timbre_change_crossfades_the_chord() {
        for (from, to) in [(CHOIR, NEW_AGE), (NEW_AGE, ORCHESTRA), (ORCHESTRA, SWEEP), (SWEEP, CHOIR), (NEW_AGE, CHOIR)] {
            let signal = cued_timbres(&[(0.0, from), (2.0, to)], 4.0);
            let (hz_from, hz_to) = (tone_of_timbre(from), tone_of_timbre(to));
            let full_from = tone_level(&signal, hz_from, 1.98);
            let full_to = tone_level(&signal, hz_to, 3.8);
            assert!(tone_level(&signal, hz_to, 1.98) < 0.01 * full_to, "{to} sounds before its pick");
            for into_fade in [0.3, 0.75, 1.2] {
                let second = 2.0 + into_fade;
                let (gone, come) = (tone_level(&signal, hz_from, second) / full_from, tone_level(&signal, hz_to, second) / full_to);
                assert!((come - equal_power(into_fade)).abs() < 0.02, "{from} to {to}: {come} at {into_fade} s");
                assert!((gone - equal_power(FADE_SECONDS - into_fade)).abs() < 0.02, "{from} to {to}: {gone} at {into_fade} s");
                assert!((gone * gone + come * come - 1.0).abs() < 0.05, "the crossfade dips or swells");
            }
            assert!(tone_level(&signal, hz_to, 3.3) / full_to < 0.985, "full level came before 1.5 s");
            assert!(tone_level(&signal, hz_from, 3.52) < 0.01 * full_from, "{from} stayed past 1.5 s");
        }

        // Into the timbre with no file: the files leave on the same fade
        let signal = cued_timbres(&[(0.0, CHOIR), (2.0, ANALOG)], 4.0);
        let (hz, full) = (tone_of_timbre(CHOIR), tone_level(&signal, tone_of_timbre(CHOIR), 1.98));
        assert!((tone_level(&signal, hz, 2.75) / full - equal_power(0.75)).abs() < 0.02);
        assert!(tone_level(&signal, hz, 3.52) < 0.01 * full);

        // The same chord, so a second slot holds it, with its own timbre
        let mut pad = Pad::new(RATE);
        pad.play(&C7M9, CHOIR);
        render(&mut pad, 2.0);
        pad.play(&C7M9, SWEEP);
        let held: Vec<(u8, f32)> = pad.slots.iter().filter(|slot| slot.count > 0).map(|slot| (slot.timbre, slot.target)).collect();
        assert_eq!(held, [(CHOIR, 0.0), (SWEEP, 1.0)]);
    }

    #[test]
    fn tim_05_settles_on_the_last_timbre() {
        let picks: [&[(f32, u8)]; 3] = [
            &[(0.0, CHOIR), (0.3, NEW_AGE), (0.6, ORCHESTRA), (0.9, SWEEP), (1.2, NEW_AGE)],
            &[(0.0, CHOIR), (0.2, SWEEP), (0.4, ORCHESTRA), (0.6, CHOIR), (0.8, SWEEP)],
            &[(0.0, NEW_AGE), (0.01, CHOIR), (0.02, ORCHESTRA), (0.03, SWEEP), (0.04, ORCHESTRA)],
        ];
        for cues in picks {
            let signal = cued_timbres(cues, 4.0);
            let last = cues[cues.len() - 1].1;
            let full = tone_level(&signal, tone_of_timbre(last), 3.9);
            assert!(full > 0.0);
            assert!((tone_level(&signal, tone_of_timbre(last), 3.5) / full - 1.0).abs() < 0.02, "{last} did not settle");
            for (timbre, hz) in TIMBRE_TONES.iter().filter(|(timbre, _)| *timbre != last) {
                assert!(tone_level(&signal, *hz, 3.5) < 0.01 * full, "timbre {timbre} is still heard");
            }
        }
    }

    #[test]
    fn tim_15_seven_notes_keep_the_rules() {
        const SEVEN: [u8; 7] = [33, 45, 57, 61, 64, 67, 71];
        const OTHER_SEVEN: [u8; 7] = [30, 42, 54, 58, 61, 64, 68];
        let tone_of_note = |index: usize| 500.0 + 700.0 * index as f32;
        let tuned = |pad: &mut Pad| {
            for (index, key) in SEVEN.into_iter().enumerate() {
                let tone = sine(tone_of_note(index), 40.0, pad.sample_rate);
                pad.load(ORCHESTRA, key, &tone, &tone, 0, tone.len() - 1);
            }
        };

        // Every note sounds, at the level that keeps a chord of 7 with a chord of 1
        let mut pad = Pad::new(RATE);
        tuned(&mut pad);
        pad.play(&SEVEN, ORCHESTRA);
        assert_eq!(pad.slots[0].count, 7);
        let frames = (5.0 * RATE) as usize;
        let signal: Vec<f32> = (0..frames).map(|_| pad.file_frame().0).collect();
        let mut one_note = Pad::new(RATE);
        tuned(&mut one_note);
        one_note.play(&SEVEN[..1], ORCHESTRA);
        let lone: Vec<f32> = (0..frames).map(|_| one_note.file_frame().0).collect();
        let full_lone = tone_level(&lone, tone_of_note(0), 4.0);
        let notes_level = |second: f32| -> Vec<f32> { (0..7).map(|index| tone_level(&signal, tone_of_note(index), second)).collect() };
        for level in notes_level(4.0) {
            assert!((level / full_lone - 1.0 / 7f32.sqrt()).abs() < 0.01, "a note sits at {level} against {full_lone}");
        }
        // Their fade is the fade of any chord
        for (level, full) in notes_level(0.75).iter().zip(notes_level(4.0)) {
            assert!((level / full - equal_power(0.75)).abs() < 0.02, "the fade reads {}", level / full);
        }

        // Crossfade, stop and return run on 7 notes as on 5
        let mut pad = Pad::new(RATE);
        pad.play(&SEVEN, ORCHESTRA);
        render(&mut pad, 2.0);
        pad.play(&OTHER_SEVEN, ORCHESTRA);
        render(&mut pad, 0.75);
        assert_eq!(pad.slots[0].target, 0.0);
        assert!((pad.slots[0].level - 0.5).abs() < 0.01 && (pad.slots[1].level - 0.5).abs() < 0.01);
        pad.play(&SEVEN, ORCHESTRA); // Back from its own fade, on the same voices
        assert_eq!((pad.slots[0].target, pad.slots[1].target), (1.0, 0.0));
        render(&mut pad, 1.6);
        assert_eq!(pad.slots[1].count, 0);
        pad.stop();
        render(&mut pad, 1.6);
        assert!(pad.slots.iter().all(|slot| slot.count == 0));

        // At most 3 chords of 7, the oldest leaving in 20 ms, and the newest click wins
        let mut pad = Pad::new(RATE);
        pad.play(&SEVEN, ORCHESTRA);
        render(&mut pad, 2.0);
        pad.play(&OTHER_SEVEN, ORCHESTRA);
        render(&mut pad, 0.6);
        pad.play(&SEVEN, CHOIR);
        render(&mut pad, 0.3);
        pad.play(&OTHER_SEVEN, CHOIR);
        pad.play(&OTHER_SEVEN, SWEEP);
        assert!(pad.slots.iter().all(|slot| slot.count == 7));
        render(&mut pad, 0.019);
        assert_eq!(pad.slots[0].timbre, ORCHESTRA, "gone before 19 ms");
        render(&mut pad, 0.002);
        assert_eq!((pad.slots[0].timbre, pad.slots[0].notes, pad.slots[0].count), (SWEEP, OTHER_SEVEN, 7));

        // An eighth note finds no room
        let mut pad = Pad::new(RATE);
        pad.play(&[33, 45, 57, 61, 64, 67, 71, 74], ORCHESTRA);
        assert_eq!(&pad.slots[0].notes[..pad.slots[0].count], SEVEN);
    }

    #[test]
    fn tim_23_no_allocation() {
        let allocations = || ALLOCATIONS.with(Cell::get);

        // The meter works
        let before = allocations();
        std::hint::black_box(vec![0u8; 16]);
        assert!(allocations() > before);

        let mut pad = Pad::new(RATE);
        for timbre in [CHOIR, NEW_AGE, ORCHESTRA, SWEEP] {
            for file in bank() {
                pad.load(timbre, file.key, &file.audio, &file.audio, file.loop_start, file.loop_end);
            }
        }
        let (mut left, mut right) = ([0.0f32; 128], [0.0f32; 128]);
        const SEVEN: [u8; 7] = [33, 45, 57, 61, 64, 67, 71];

        let before = allocations();
        let mut blocks = |pad: &mut Pad, count: usize| {
            for _ in 0..count {
                pad.mix_into(&mut left, &mut right);
            }
        };
        pad.play(&SEVEN, CHOIR); // Starts
        blocks(&mut pad, 100);
        pad.play(&SEVEN, ORCHESTRA); // Changes timbre
        blocks(&mut pad, 10);
        pad.play(&C7M9, ORCHESTRA); // Changes chord
        pad.play(&C7M9, ANALOG); // Waits for a slot
        pad.play(&C7M9, SWEEP); // Replaces the one waiting
        blocks(&mut pad, 100);
        pad.play(&SEVEN, ORCHESTRA);
        pad.play(&C7M9, SWEEP); // Returns while fading
        blocks(&mut pad, 10);
        pad.stop(); // Stops
        blocks(&mut pad, 1000);
        assert_eq!(allocations(), before);
    }

    #[test]
    fn tim_33_other_timbre_load_changes_nothing() {
        let run = |loaded: Option<u8>| {
            let mut pad = Pad::new(RATE);
            load_tone(&mut pad, 48, 700.0);
            let tone = sine(700.0, 40.0, RATE);
            pad.load(CHOIR, 48, &tone, &tone, 0, tone.len() - 1);
            pad.play(&C7M9, CHOIR);
            render(&mut pad, 2.0);
            if let Some(timbre) = loaded {
                let other = sine(900.0, 40.0, RATE);
                pad.load(timbre, 52, &other, &other, 0, other.len() - 1);
            }
            render(&mut pad, 3.0)
        };
        let bits = |signal: &[f32]| signal.iter().map(|value| value.to_bits()).collect::<Vec<u32>>();
        let (left, right) = run(None);
        for timbre in [NEW_AGE, ORCHESTRA, SWEEP] {
            let (other_left, other_right) = run(Some(timbre));
            assert_eq!(bits(&left), bits(&other_left), "a load for timbre {timbre} moved the sound");
            assert_eq!(bits(&right), bits(&other_right), "a load for timbre {timbre} moved the sound");
        }
        // Its own timbre's load does reach it, so the run above can tell
        assert_ne!(bits(&left), bits(&run(Some(CHOIR)).0));

        // With two timbres fading, each voice looks only in the bank of its own slot
        let mut pad = Pad::new(RATE);
        pad.play(&[48], CHOIR);
        render(&mut pad, 0.5);
        pad.play(&[48], SWEEP);
        let tone = sine(700.0, 40.0, RATE);
        pad.load(SWEEP, 48, &tone, &tone, 0, tone.len() - 1);
        assert_eq!(pad.slots[0].voices[0].next_file, NO_FILE);
        assert_eq!(pad.slots[1].voices[0].next_file, 0);
    }

    #[test]
    fn tim_44_pitch_holds_at_48_khz() {
        let rate = 48000.0;
        for timbre in [CHOIR, NEW_AGE, SWEEP, ANALOG] {
            let mut pad = Pad::new(rate);
            pad.play(&C7M9, timbre);
            let (left, right) = render(&mut pad, 16.0);
            let signal = mono(after(&left, FADE_END, rate), after(&right, FADE_END, rate));
            for &note in &C7M9 {
                let centre = cluster_centre_cents(&signal, note as f32, rate);
                assert!(centre.abs() <= 5.0, "timbre {timbre}, note {note} is {centre} cents off");
            }
        }

        // decodeAudioData hands the engine files at its own rate, stereo or mono, whatever the bank's keys
        for timbre in [CHOIR, NEW_AGE, ORCHESTRA, SWEEP] {
            let mut pad = Pad::new(rate);
            for key in [46, 50, 53, 57, 60, 65] {
                let tone = sine(note_hz(key as f32), 40.0, rate);
                pad.load(timbre, key, &tone, &tone, 0, tone.len() - 1);
            }
            pad.play(&C7M9, timbre);
            let frames = (16.0 * rate) as usize;
            let (left, right): Stereo = (0..frames).map(|_| pad.file_frame()).unzip();
            let signal = mono(after(&left, FADE_END, rate), after(&right, FADE_END, rate));
            for &note in &C7M9 {
                let peak = peak_cents(&signal, note as f32, rate);
                assert!(peak.abs() <= 5.0, "timbre {timbre}, note {note} is {peak} cents off");
            }
        }
    }

    struct Held {
        chord: Vec<u8>,
        power: f32, // Of both channels, in dB, as a listener hears a stereo pad
        summed: f32, // Of left plus right, in dB, as PAD-14 measures
        peak: f32,
    }

    // Each of the 168 chords held in each timbre, with its real files, at the default volume
    fn held_chords() -> &'static [Vec<Held>; TIMBRES] {
        static HELD: OnceLock<[Vec<Held>; TIMBRES]> = OnceLock::new();
        HELD.get_or_init(|| {
            std::thread::scope(|scope| {
                let renders: Vec<_> = (0..TIMBRES as u8).map(|timbre| scope.spawn(move || {
                    all_chords().into_iter().map(|chord| {
                        let mut pad = Pad::new(RATE);
                        load_timbre(&mut pad, timbre);
                        pad.play(&timbre_notes(&chord, timbre), timbre);
                        let (left, right) = render(&mut pad, 16.0);
                        let (held_left, held_right) = (after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
                        Held {
                            power: db(((rms(held_left).powi(2) + rms(held_right).powi(2)) / 2.0).sqrt()),
                            summed: db(rms(&mono(held_left, held_right))),
                            peak: peak(&left).max(peak(&right)),
                            chord,
                        }
                    }).collect::<Vec<Held>>()
                })).collect();
                let held: Vec<Vec<Held>> = renders.into_iter().map(|render| render.join().unwrap()).collect();
                held.try_into().unwrap_or_else(|_| unreachable!())
            })
        })
    }

    #[test]
    fn tim_09_choir_balance() {
        let held = |pad: &mut Pad| { pad.play(&C7M9, CHOIR); render(pad, 24.0) };
        let (sample_left, _) = sample_layer(|pad| load_timbre(pad, CHOIR), RATE, held);
        let (synth_left, _) = held(&mut Pad::new(RATE));
        let difference = db(rms(after(&sample_left, 4.0, RATE))) - db(rms(after(&synth_left, 4.0, RATE)));
        assert!((1.0..=3.0).contains(&difference), "the samples sit {difference} dB above the synth");
    }

    #[test]
    fn tim_11_sweep_mixes_both_layers() {
        let held = |pad: &mut Pad| { pad.play(&C7M9, SWEEP); render(pad, 24.0) };
        let (sample_left, _) = sample_layer(|pad| load_timbre(pad, SWEEP), RATE, held);
        let (synth_left, _) = held(&mut Pad::new(RATE));
        let (sample, synth) = (db(rms(after(&sample_left, 4.0, RATE))), db(rms(after(&synth_left, 4.0, RATE))));
        assert!(sample > -60.0 && synth > -60.0, "a layer is missing: samples {sample} dB, synth {synth} dB");
        assert!((1.0..=3.0).contains(&(sample - synth)), "the samples sit {} dB above the synth", sample - synth);
    }

    #[test]
    fn tim_12_analog_reads_no_file() {
        let bits = |signal: &[f32]| signal.iter().map(|value| value.to_bits()).collect::<Vec<u32>>();
        let run = |with_files: bool| {
            let mut pad = Pad::new(RATE);
            if with_files {
                for bank in timbre_banks().iter().take(2) {
                    for file in bank {
                        pad.load(ANALOG, file.key, &file.left, &file.right, file.loop_start, file.loop_end);
                    }
                }
                assert!(pad.banks[ANALOG as usize].is_empty(), "Analog took a file");
            }
            pad.play(&C7M9, ANALOG);
            render(&mut pad, 4.0)
        };
        let ((bare_left, bare_right), (left, right)) = (run(false), run(true));
        assert_eq!(bits(&bare_left), bits(&left));
        assert_eq!(bits(&bare_right), bits(&right));
        assert!(db(rms(after(&left, FADE_END, RATE))) > -40.0, "the synth is missing");
    }

    #[test]
    fn tim_13_orchestra_has_no_synth() {
        let mut pad = Pad::new(RATE);
        load_timbre(&mut pad, ORCHESTRA);
        pad.play(&timbre_notes(&C7M9, ORCHESTRA), ORCHESTRA);
        let frames = (5.0 * RATE) as usize;
        let layers: Vec<_> = (0..frames).map(|_| pad.layers()).collect();
        assert!(layers.iter().all(|((left, right), _, _)| *left == 0.0 && *right == 0.0), "the synth sounds");
        let files: Vec<f32> = layers.iter().map(|(_, (bus, _), (past, _))| bus + past).collect();
        assert!(db(rms(after(&files, FADE_END, RATE))) > -40.0, "the sections are missing");
    }

    // Where a listener puts a note: the mean of the centres of its first harmonics, each counted once, so that a
    // comb favouring one saw of one harmonic does not stand for the whole note
    fn heard_centre_cents(signal: &[f32], note: f32, rate: f32) -> f32 {
        const HARMONICS: usize = 6;
        let windowed = hann(signal);
        (1..=HARMONICS).map(|harmonic| {
            let spectrum = sweep(&windowed, note_hz(note) * harmonic as f32, 30.0, rate);
            let total: f64 = spectrum.iter().map(|(_, power)| power).sum();
            spectrum.iter().map(|(offset, power)| *offset as f64 * power).sum::<f64>() / total
        }).sum::<f64>() as f32 / HARMONICS as f32
    }

    #[test]
    fn tim_16_notes_within_5_cents() {
        // The meter: a tone 4 cents sharp on 6 harmonics reads as 4 cents, so the checks below can fail
        let hz = note_hz(60.0) * 2f32.powf(4.0 / 1200.0);
        let tone: Vec<f32> = (0..(8.0 * RATE) as usize).map(|frame| {
            (1..=6).map(|harmonic| (TAU * ((hz * harmonic as f32 / RATE * frame as f32) % 1.0)).sin() / harmonic as f32).sum()
        }).collect();
        let reading = heard_centre_cents(&tone, 60.0, RATE);
        assert!((reading - 4.0).abs() < 0.5, "a tone 4 cents sharp reads {reading}");

        std::thread::scope(|scope| {
            for timbre in [CHOIR, NEW_AGE, SWEEP, ANALOG] {
                scope.spawn(move || {
                    for note in 45..=70u8 {
                        let held = || {
                            let mut pad = Pad::new(RATE);
                            load_timbre(&mut pad, timbre);
                            pad.play(&[note], timbre);
                            pad
                        };
                        // Each voice as it leaves the note, before the effects
                        let (left, right) = render_dry(&mut held(), 16.0);
                        let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
                        let centre = cluster_centre_cents(&signal, note as f32, RATE);
                        assert!(centre.abs() <= 5.0, "timbre {timbre}, note {note} leaves {centre} cents off");

                        // What is heard. The reverb's combs lean a lone harmonic's centre up to 9.5 cents, New Age's too,
                        // though they move no frequency. Heard over the harmonics the note stays where it left
                        let (left, right) = render(&mut held(), 16.0);
                        let signal = mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
                        let centre = heard_centre_cents(&signal, note as f32, RATE);
                        assert!(centre.abs() <= 5.0, "timbre {timbre}, note {note} is heard {centre} cents off");
                    }
                });
            }
        });
    }

    #[test]
    fn tim_18_chords_match_within_3_db() {
        for (timbre, held) in held_chords().iter().enumerate() {
            assert_eq!(held.len(), 168);
            for (name, level) in [("power", (|chord: &Held| chord.power) as fn(&Held) -> f32), ("sum", |chord| chord.summed)] {
                let lowest = held.iter().min_by(|a, b| level(a).total_cmp(&level(b))).unwrap();
                let highest = held.iter().max_by(|a, b| level(a).total_cmp(&level(b))).unwrap();
                assert!(level(highest) - level(lowest) <= 3.0, "timbre {timbre}, {name}: {:?} at {} against {:?} at {}",
                    lowest.chord, level(lowest), highest.chord, level(highest));
            }
        }
    }

    #[test]
    fn tim_19_timbres_match_within_3_db() {
        let held = held_chords();
        for chord in 0..168 {
            let levels: Vec<f32> = held.iter().map(|timbre| timbre[chord].power).collect();
            let (lowest, highest) = (levels.iter().cloned().fold(f32::MAX, f32::min), levels.iter().cloned().fold(f32::MIN, f32::max));
            assert!(highest - lowest <= 3.0, "{:?}: {levels:?}", held[0][chord].chord);
        }
    }

    #[test]
    fn tim_20_default_peak() {
        let held = held_chords();
        for (timbre, chords) in held.iter().enumerate() {
            let loudest = chords.iter().max_by(|a, b| a.peak.total_cmp(&b.peak)).unwrap();
            assert!(db(loudest.peak) <= -12.0, "timbre {timbre}: {:?} peaks at {} dBFS", loudest.chord, db(loudest.peak));
        }

        // Every crossfade doubles the chords sounding, each on the hot start of its files, within a timbre and across them
        let loudest_of = |timbre: usize| {
            let mut chords: Vec<&Held> = held[timbre].iter().collect();
            chords.sort_by(|a, b| b.peak.total_cmp(&a.peak));
            chords
        };
        let crossfade_peak = |picks: &[(Vec<u8>, u8)]| {
            let mut pad = Pad::new(RATE);
            for timbre in [CHOIR, NEW_AGE, ORCHESTRA, SWEEP] {
                load_timbre(&mut pad, timbre);
            }
            let (mut left, mut right) = ([0.0f32; 128], [0.0f32; 128]);
            let mut highest = 0f32;
            for (notes, timbre) in picks {
                pad.play(notes, *timbre);
                for _ in 0..(2.0 * RATE / 128.0) as usize {
                    left.fill(0.0);
                    right.fill(0.0);
                    pad.mix_into(&mut left, &mut right);
                    highest = highest.max(peak(&left)).max(peak(&right));
                }
            }
            highest
        };
        let across: Vec<(Vec<u8>, u8)> = (0..TIMBRES).flat_map(|from| {
            loudest_of(from).into_iter().take(6).flat_map(move |chord| (0..TIMBRES as u8).map(move |timbre| (timbre_notes(&chord.chord, timbre), timbre)))
        }).collect();
        let within = (0..TIMBRES as u8).map(|timbre| {
            loudest_of(timbre as usize).into_iter().take(40).map(|chord| (timbre_notes(&chord.chord, timbre), timbre)).collect::<Vec<_>>()
        });
        for picks in within.chain([across]) {
            let highest = crossfade_peak(&picks);
            assert!(db(highest) <= -12.0, "a crossfade peaks at {} dBFS", db(highest));
        }
    }

    #[test]
    fn tim_30_synth_holds_while_loading() {
        // With no file every timbre sounds, whatever it plays once loaded
        for timbre in 0..TIMBRES as u8 {
            let notes = timbre_notes(&C7M9, timbre);
            let mut pad = Pad::new(RATE);
            pad.play(&notes, timbre);
            let (left, right) = render(&mut pad, 6.0);
            assert!(db(rms(after(&left, FADE_END, RATE))) > -45.0, "timbre {timbre} is silent");
            let signal = hann(&mono(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE)));
            let powers: Vec<f64> = C7M9.iter().map(|&note| sweep(&signal, note_hz(note as f32), 25.0, RATE).iter().map(|(_, power)| power).sum()).collect();
            let loudest = powers.iter().cloned().fold(0.0, f64::max);
            assert!(powers.iter().all(|power| *power > loudest / 20.0), "timbre {timbre} misses a note: {powers:?}");
        }

        // A chord that starts on a part-loaded Orchestra holds on the synth, and reads no other note's file
        let orchestra = &timbre_banks()[ORCHESTRA as usize];
        let chord = [45u8, 48, 52, 55]; // Am7
        let notes = timbre_notes(&chord, ORCHESTRA);
        let frames = (6.0 * RATE) as usize;
        let bare = {
            let mut pad = Pad::new(RATE);
            pad.play(&notes, ORCHESTRA);
            let synth: Vec<f32> = (0..frames).map(|_| pad.layers().0.0).collect();
            db(rms(after(&synth, FADE_END, RATE)))
        };
        for loaded in [1, 3] {
            let mut pad = Pad::new(RATE);
            for file in &orchestra[..loaded] {
                pad.load(ORCHESTRA, file.key, &file.left, &file.right, file.loop_start, file.loop_end);
            }
            pad.play(&notes, ORCHESTRA);
            let synth: Vec<f32> = (0..frames).map(|_| pad.layers().0.0).collect();
            let slot = pad.slots.iter().find(|slot| slot.count > 0).unwrap();
            for voice in slot.voices[..slot.count].iter() {
                if let Some(file) = pad.banks[ORCHESTRA as usize].get(voice.file) {
                    assert!(file.key.abs_diff(voice.note) <= 2, "{loaded} files: note {} reads key {}", voice.note, file.key);
                }
            }
            let chord_voices = slot.voices[..slot.count].iter().filter(|voice| chord.contains(&voice.note));
            assert_eq!(chord_voices.filter(|voice| voice.file == NO_FILE).count(), chord.len(), "{loaded} files");
            let level = db(rms(after(&synth, FADE_END, RATE)));
            assert!((level - bare).abs() < 1.0, "{loaded} files: the synth stands at {level} dB against {bare} dB");
        }

        // With the whole bank every note Orchestra plays has its file
        let mut pad = Pad::new(RATE);
        load_timbre(&mut pad, ORCHESTRA);
        for note in all_chords().iter().flat_map(|chord| timbre_notes(chord, ORCHESTRA)) {
            assert_ne!(pad.nearest_file(ORCHESTRA, note), NO_FILE, "note {note} has no file");
        }

        // Each timbre keeps its own synth layer, so Orchestra's is the Analog synth, to the bit
        let bits = |signal: &[f32]| signal.iter().map(|value| value.to_bits()).collect::<Vec<u32>>();
        let held = |timbre: u8| {
            let mut pad = Pad::new(RATE);
            pad.play(&C7M9, timbre);
            render(&mut pad, 4.0)
        };
        assert_eq!(bits(&held(ORCHESTRA).0), bits(&held(ANALOG).0));
        assert_ne!(bits(&held(CHOIR).0), bits(&held(ANALOG).0));

        // It holds the chord alone, at the level and under the peak of every timbre: the saws of a bass would ring the reverb
        let held: Vec<Held> = all_chords().into_iter().map(|chord| {
            let mut pad = Pad::new(RATE);
            pad.play(&timbre_notes(&chord, ORCHESTRA), ORCHESTRA);
            let (left, right) = render(&mut pad, 16.0);
            let (held_left, held_right) = (after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
            Held {
                power: db(((rms(held_left).powi(2) + rms(held_right).powi(2)) / 2.0).sqrt()),
                summed: db(rms(&mono(held_left, held_right))),
                peak: peak(&left).max(peak(&right)),
                chord,
            }
        }).collect();
        for level in [(|chord: &Held| chord.power) as fn(&Held) -> f32, |chord| chord.summed] {
            let levels = || held.iter().map(level);
            let (lowest, highest) = (levels().fold(f32::MAX, f32::min), levels().fold(f32::MIN, f32::max));
            assert!(highest - lowest <= 3.0, "chords sit from {lowest} to {highest} dB on the synth");
        }
        let loudest = held.iter().max_by(|a, b| a.peak.total_cmp(&b.peak)).unwrap();
        assert!(db(loudest.peak) <= -12.0, "{:?} peaks at {} dBFS on the synth", loudest.chord, db(loudest.peak));
    }

    #[test]
    fn tim_31_late_files_fade_in() {
        let loaded_at = 2.0;
        for (timbre, hz) in [(CHOIR, 700.0), (SWEEP, 700.0), (NEW_AGE, 700.0)] {
            let run = |with_file: bool| {
                let mut pad = Pad::new(RATE);
                pad.play(&TIMBRE_NOTE, timbre);
                let frames = |seconds: f32| (seconds * RATE) as usize;
                let mut layers: Vec<_> = (0..frames(loaded_at)).map(|_| pad.layers()).collect();
                if with_file {
                    let tone = sine(hz, 40.0, RATE);
                    pad.load(timbre, TIMBRE_NOTE[0], &tone, &tone, 0, tone.len() - 1);
                }
                layers.extend((0..frames(3.0)).map(|_| pad.layers()));
                layers
            };
            let (loaded, bare) = (run(true), run(false));
            let files: Vec<f32> = loaded.iter().map(|(_, (bus, _), (past, _))| bus + past).collect();
            let full = tone_level(&files, hz, loaded_at + 2.5);
            assert!(full > 0.0);
            assert_eq!(tone_level(&files, hz, loaded_at - 0.02), 0.0);
            for into_fade in [0.02, 0.75, 1.2] {
                let level = tone_level(&files, hz, loaded_at + into_fade) / full;
                assert!((level - equal_power(into_fade)).abs() < 0.02, "timbre {timbre}: {level} at {into_fade} s");
            }
            assert!(tone_level(&files, hz, loaded_at + 1.3) / full < 0.985, "full level came before 1.5 s");
            assert!((tone_level(&files, hz, loaded_at + 1.52) / full - 1.0).abs() < 0.02);

            // The synth carries on, untouched
            let synth = |layers: &[((f32, f32), (f32, f32), (f32, f32))]| layers.iter().map(|((left, _), _, _)| left.to_bits()).collect::<Vec<u32>>();
            assert_eq!(synth(&loaded), synth(&bare), "timbre {timbre}: the files moved the synth");
        }
    }

    #[test]
    fn tim_32_orchestra_replaces_the_synth() {
        let (loaded_at, hz) = (2.0, 700.0);
        let run = |with_file: bool| {
            let mut pad = Pad::new(RATE);
            pad.play(&TIMBRE_NOTE, ORCHESTRA);
            let frames = |seconds: f32| (seconds * RATE) as usize;
            let mut layers: Vec<_> = (0..frames(loaded_at)).map(|_| pad.layers()).collect();
            if with_file {
                let tone = sine(hz, 40.0, RATE);
                pad.load(ORCHESTRA, TIMBRE_NOTE[0], &tone, &tone, 0, tone.len() - 1);
            }
            layers.extend((0..frames(3.0)).map(|_| pad.layers()));
            layers
        };
        let (loaded, bare) = (run(true), run(false));
        let synth: Vec<f32> = loaded.iter().map(|((left, _), _, _)| *left).collect();
        let bare_synth: Vec<f32> = bare.iter().map(|((left, _), _, _)| *left).collect();
        let files: Vec<f32> = loaded.iter().map(|(_, (bus, _), (past, _))| bus + past).collect();

        // The synth's level against the same synth left alone, so the filter's slow swing does not count
        let synth_level = |second: f32| {
            let (start, end) = (((second - 0.02) * RATE) as usize, ((second + 0.02) * RATE) as usize);
            rms(&synth[start..end]) / rms(&bare_synth[start..end])
        };
        let full_files = tone_level(&files, hz, loaded_at + 2.5);
        assert_eq!(synth_level(loaded_at - 0.03), 1.0);
        assert_eq!(tone_level(&files, hz, loaded_at - 0.02), 0.0);
        for into_fade in [0.3, 0.75, 1.2] {
            let (leaving, rising) = (synth_level(loaded_at + into_fade), tone_level(&files, hz, loaded_at + into_fade) / full_files);
            assert!((rising - equal_power(into_fade)).abs() < 0.02, "the sections stand at {rising} after {into_fade} s");
            assert!((leaving - equal_power(FADE_SECONDS - into_fade)).abs() < 0.03, "the synth stands at {leaving} after {into_fade} s");
            assert!((leaving * leaving + rising * rising - 1.0).abs() < 0.06, "the swap dips or swells");
        }
        assert!(synth_level(loaded_at + 1.3) > 0.1, "the synth left before 1.5 s");

        // Nothing of the synth stays, past what the filter still rings with
        let past_fade = ((loaded_at + 1.6) * RATE) as usize;
        assert!(synth[past_fade..].iter().all(|value| *value == 0.0 || value.abs() < 1e-30));
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
