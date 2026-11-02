// The chord pad: held chords mixed over the drums. The page says which notes to hold; everything else
// runs here, on the audio thread, where only `load` may allocate: a chord starts, changes and stops on fixed arrays.
use std::f32::consts::{FRAC_PI_2, TAU};

const MAX_CHORDS: usize = 3;
const MAX_NOTES: usize = 5;
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
    note: u8,
    phases: [f32; SAWS],
    steps: [f32; SAWS], // Phase per frame
    file: usize, // Index into `samples`, or NO_FILE
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

    fn holds(&self, notes: &[u8]) -> bool {
        self.count > 0 && &self.notes[..self.count] == notes
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
    order: u64,
    samples: Vec<PadSample>,
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
            order: 0,
            samples: Vec::new(),
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

    pub fn play(&mut self, notes: &[u8]) {
        let notes = &notes[..notes.len().min(MAX_NOTES)];
        self.silent = false;
        self.pending_count = 0;
        let returning = self.slots.iter().position(|slot| slot.holds(notes));
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
            self.start(free, notes);
        } else {
            self.pending[..notes.len()].copy_from_slice(notes);
            self.pending_count = notes.len();
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

    pub fn load(&mut self, key: u8, left: &[f32], right: &[f32], loop_start: usize, loop_end: usize) {
        let frames = left.len().min(right.len());
        let loop_end = loop_end.min(frames.saturating_sub(1));
        if loop_start >= loop_end {
            return; // A rounded loop point must not reach the audio thread as an out-of-bounds read
        }
        let sample = PadSample { key, left: left[..frames].to_vec(), right: right[..frames].to_vec(), loop_start, loop_end };
        self.samples.push(sample);
        for slot in 0..MAX_CHORDS {
            for voice in 0..self.slots[slot].count {
                self.slots[slot].voices[voice].next_file = self.nearest_file(self.slots[slot].voices[voice].note);
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
            let ((synth_left, synth_right), (file_left, file_right)) = self.layers();
            // SPEC_DEVIATION: the chorus takes the sample layer alone, where PAD-19 says the pad
            // Reason: as in demo 4. Over the synth too, its comb puts 6 dB between chords, against PAD-14's 3 dB
            let (file_left, file_right) = self.chorus.run(file_left, file_right);
            let (pad_left, pad_right) = self.reverb.run(synth_left + file_left, synth_right + file_right);
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

    fn start(&mut self, index: usize, notes: &[u8]) {
        for (voice, &note) in notes.iter().enumerate() {
            self.slots[index].voices[voice] = self.new_voice(note);
        }
        self.order += 1;
        let slot = &mut self.slots[index];
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
    fn new_voice(&mut self, note: u8) -> Voice {
        let mut voice = Voice { note, ..Voice::OFF };
        for saw in 0..SAWS {
            self.random = self.random.wrapping_mul(1664525).wrapping_add(1013904223);
            voice.phases[saw] = (self.random >> 8) as f32 / 16777216.0;
            let hz = 440.0 * 2f32.powf((note as f32 + DETUNE[saw] - 69.0) / 12.0);
            voice.steps[saw] = hz / self.sample_rate;
        }
        voice.use_file(self.nearest_file(note), &self.samples);
        voice.file_gain = if voice.file == NO_FILE { 0.0 } else { 1.0 };
        voice
    }

    // A tie goes to the higher file, as FreePats maps its keys
    fn nearest_file(&self, note: u8) -> usize {
        (0..self.samples.len())
            .min_by_key(|&file| (self.samples[file].key.abs_diff(note), u8::MAX - self.samples[file].key))
            .unwrap_or(NO_FILE)
    }

    // One frame of every chord, before the effects and the volume: the synth layer, then the sample layer
    fn layers(&mut self) -> ((f32, f32), (f32, f32)) {
        let (mut left, mut right) = (0.0, 0.0);
        let (mut file_left, mut file_right) = (0.0, 0.0);
        let file_rise = 1.0 / (FADE_SECONDS * self.sample_rate);
        let file_fall = 1.0 / (EVICTION_SECONDS * self.sample_rate);
        for slot in &mut self.slots {
            let gain = slot.fade_gain();
            for voice in &mut slot.voices[..slot.count] {
                for saw in 0..SAWS {
                    let phase = voice.phases[saw] + voice.steps[saw];
                    let phase = if phase >= 1.0 { phase - 1.0 } else { phase };
                    voice.phases[saw] = phase;
                    let pan = saw as f32 / (SAWS - 1) as f32;
                    let value = (phase * 2.0 - 1.0) * gain;
                    left += value * (1.0 - pan);
                    right += value * pan;
                }
                voice.approach_file(&self.samples, file_rise, file_fall);
                if let Some(sample) = self.samples.get(voice.file) {
                    let file_gain = if voice.file_gain < 1.0 { (voice.file_gain * FRAC_PI_2).sin() } else { 1.0 };
                    let (sample_left, sample_right) = voice.read(sample);
                    file_left += sample_left * gain * file_gain;
                    file_right += sample_right * gain * file_gain;
                }
            }
        }

        if self.pending_count > 0 {
            if let Some(free) = self.slots.iter().position(|slot| slot.count == 0) {
                let (pending, count) = (self.pending, self.pending_count);
                self.pending_count = 0;
                self.start(free, &pending[..count]);
            }
        }

        self.cutoff_phase = (self.cutoff_phase + CUTOFF_LFO_HZ / self.sample_rate).fract();
        let cutoff = CUTOFF_HZ + CUTOFF_SWING_HZ * (TAU * self.cutoff_phase).sin();
        let smoothing = 1.0 - (-TAU * cutoff / self.sample_rate).exp();
        low_pass(&mut self.filter_left, left, smoothing);
        low_pass(&mut self.filter_right, right, smoothing);
        (
            (self.filter_left[1] * SYNTH_GAIN, self.filter_right[1] * SYNTH_GAIN),
            (file_left * SAMPLE_GAIN, file_right * SAMPLE_GAIN),
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
            let ((synth_left, synth_right), (file_left, file_right)) = self.layers();
            (synth_left + file_left, synth_right + file_right)
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
                        if notes.is_empty() { pad.stop() } else { pad.play(notes) }
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
        pad.play(&C7M9);
        let (left, _) = render_dry(&mut pad, 3.0);
        let level = |second: f32| db(rms(&left[(second * RATE) as usize..((second + 0.2) * RATE) as usize]));
        assert!(level(0.0) < level(2.5) - 12.0);
        assert!(level(0.0) < level(0.4) && level(0.4) < level(0.8) && level(0.8) < level(1.2));
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
        pad.play(&C7M9);
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
            pad.play(&chord);
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
            pad.play(chord);
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
        pad.play(chords[0]); // Starts
        blocks(&mut pad, 100);
        pad.play(chords[1]); // Changes
        blocks(&mut pad, 10);
        pad.play(chords[2]);
        pad.play(chords[3]); // Waits for a slot
        pad.play(chords[4]); // Replaces the one waiting
        blocks(&mut pad, 100);
        pad.play(chords[3]);
        pad.play(chords[4]); // Returns while fading
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
        pad.play(&C7M9);
        let (left, right) = render(&mut pad, 12.0);
        let similarity = correlation(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
        assert!(similarity < 0.95, "left and right correlate at {similarity}");

        // The files are mono, so what differs in the sample layer comes from the effects
        let (left, right) = sample_layer(load_bank, RATE, |pad| { pad.play(&C7M9); render(pad, 12.0) });
        let similarity = correlation(after(&left, FADE_END, RATE), after(&right, FADE_END, RATE));
        assert!(similarity < 0.95, "the sample layer correlates at {similarity}");

        // A lone impulse shows the chorus: each channel repeats it about 45 ms later, at its own moment
        for rate in [RATE, 48000.0] {
            let impulse_at = (2.0 * rate) as usize;
            let mut file = vec![0.0; 3 * impulse_at];
            file[impulse_at] = 1.0;
            let (left, right) = sample_layer(
                |pad| pad.load(60, &file, &file, 0, file.len() - 1),
                rate,
                |pad| { pad.play(&[60]); render(pad, 2.3) },
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
        pad.play(&C7M9);
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
            pad.play(&C7M9);
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
            pad.play(&C7M9);
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
            pad.play(chord);
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
                |pad| { pad.play(chord); render(pad, 16.0) },
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
            pad.play(&chord);
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
            pad.play(chord);
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
            pad.play(&[45]);
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
                pad.play(&CHORD_A);
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
            pad.play(&[50]);
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
        pad.load(note, &tone, &tone, 0, tone.len() - 1);
        pad.play(&[note]);
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
            pad.play(&CHORD_A);
            render(&mut pad, 2.0);
            pad.play(&CHORD_B);
            render(&mut pad, fading * 2.0 / 3.0);
            pad.play(&CHORD_C);
            render(&mut pad, fading / 3.0);
            pad.play(&CHORD_D);
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
                let held = |pad: &mut Pad| { pad.play(&notes); render(pad, 16.0) };
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
        pad.load(69, &tone, &tone, 1000, tone.len() + 500);
        assert_eq!(pad.samples[0].loop_end, tone.len() - 1);
        pad.play(&[69]);
        render(&mut pad, 3.0); // Reading past the file would panic
    }

    #[test]
    fn pad_61_load_refuses_an_empty_loop() {
        let tone = sine(440.0, 1.0, RATE);
        let mut pad = Pad::new(RATE);
        for (start, end) in [(1000, 1000), (2000, 1000), (tone.len(), tone.len() + 500)] {
            pad.load(69, &tone, &tone, start, end);
        }
        pad.load(69, &[], &[], 0, 0);
        assert!(pad.samples.is_empty());
        pad.play(&[69]);
        render(&mut pad, 3.0);
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
