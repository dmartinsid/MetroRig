// The golden output: each scenario renders 4 s at 44100 Hz through the `extern "C"` functions alone, in the
// worklet's 128-frame blocks, and its fingerprint must equal the one taken on the engine of commit 591f031.
// A refactor that moves engine code must leave every sample bit for bit where it was.
use crate::*;
use std::panic;

const SR: f32 = 44100.0;
const BLOCK: usize = 128;
const FRAMES: usize = 4 * 44100;

// Fingerprints taken at commit 591f031
const DRUMS_WITH_TAKES_AND_DYNAMICS: u64 = 0x314d6c9e8b34c532;
const SYNTH_CLICK: u64 = 0x25c697939a9c4e29;
const SAMPLE_CLICK: u64 = 0x2bd614db32596a65;
const TRAINER_STEPPED_BY_BARS: u64 = 0x47d9d50da595d7e1;
const TRAINER_SMOOTH_BY_SECONDS: u64 = 0x60f0c14b8d36fffd;
const PAD_CHANGES_CHORD_AND_TIMBRE: u64 = 0x50d0d0846d817cc0;

// A fixed linear congruential generator, so every synthetic sample is the same on every run
struct Lcg(u32);

impl Lcg {
    fn next(&mut self) -> f32 {
        self.0 = self.0.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.0 >> 8) as f32 / 16777216.0 * 2.0 - 1.0
    }

    // Noise under a linear decay, built with no call to libm
    fn hit(&mut self, frames: usize, level: f32) -> Vec<f32> {
        (0..frames).map(|i| self.next() * level * (1.0 - i as f32 / frames as f32)).collect()
    }

    // Smoothed noise at a steady level, for a pad file that loops
    fn tone(&mut self, frames: usize, level: f32) -> Vec<f32> {
        let mut held = 0.0f32;
        (0..frames)
            .map(|_| {
                held += 0.2 * (self.next() - held);
                held * level
            })
            .collect()
    }
}

// The output of one scenario, both channels, frame by frame
struct Output {
    left: Vec<f32>,
    right: Vec<f32>,
}

impl Output {
    fn new() -> Output {
        Output { left: Vec::with_capacity(FRAMES), right: Vec::with_capacity(FRAMES) }
    }

    // Renders `frames` more frames in blocks of at most 128, as the worklet does
    fn render(&mut self, ptr: *mut Engine, frames: usize) {
        let mut left = [0.0f32; BLOCK];
        let mut right = [0.0f32; BLOCK];
        let mut remaining = frames.min(FRAMES - self.left.len());
        while remaining > 0 {
            let block = remaining.min(BLOCK);
            engine_process(ptr, left.as_mut_ptr(), right.as_mut_ptr(), block);
            self.left.extend_from_slice(&left[..block]);
            self.right.extend_from_slice(&right[..block]);
            remaining -= block;
        }
    }
}

// FNV-1a 64 over the bits of left then right of every frame
fn fingerprint(output: &Output) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for (left, right) in output.left.iter().zip(&output.right) {
        for byte in left.to_bits().to_le_bytes().into_iter().chain(right.to_bits().to_le_bytes()) {
            hash = (hash ^ byte as u64).wrapping_mul(0x100000001b3);
        }
    }
    hash
}

fn compare(scenario: &str, actual: u64, expected: u64) {
    if actual != expected {
        panic!("golden scenario {scenario}: fingerprint {actual:#018x}, expected {expected:#018x}");
    }
}

fn seconds(value: f32) -> usize {
    (value * SR) as usize
}

fn grid(ptr: *mut Engine, track: u32, steps: &[u8]) {
    engine_update_grid(ptr, track, steps.as_ptr(), steps.len());
}

fn load_sample(ptr: *mut Engine, track: u32, left: &[f32], right: &[f32]) {
    engine_load_sample(ptr, track, left.as_ptr(), right.as_ptr(), left.len());
}

fn pad_play(ptr: *mut Engine, notes: &[u8], timbre: u8) {
    let note = |index: usize| notes.get(index).copied().unwrap_or(0);
    engine_pad_play(ptr, note(0), note(1), note(2), note(3), note(4), note(5), note(6), notes.len(), timbre);
}

// Renders a whole scenario: `setup` before the first frame, then each cue at its frame, then the rest
fn run(setup: impl FnOnce(*mut Engine), cues: &[(usize, &dyn Fn(*mut Engine))]) -> Output {
    let ptr = engine_new(SR);
    setup(ptr);
    let mut output = Output::new();
    for (frame, cue) in cues {
        output.render(ptr, frame - output.left.len());
        cue(ptr);
    }
    output.render(ptr, FRAMES);
    engine_free(ptr);
    output
}

// A click on the quarters with accents on beat 1, read back in the given mode
fn click_scenario(mode: u32) -> Output {
    run(
        |ptr| {
            engine_set_click_mode(ptr, mode);
            let mut random = Lcg(7);
            let left = random.hit(3000, 0.8);
            let right = random.hit(3000, 0.7);
            load_sample(ptr, 0, &left, &right);
            grid(ptr, 0, &[2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1]);
            engine_set_measure_length(ptr, 16);
            engine_set_bpm(ptr, 137.0);
            engine_start(ptr);
        },
        &[(seconds(2.5), &|ptr: *mut Engine| engine_set_bpm(ptr, 91.5))],
    )
}

fn drums_output() -> Output {
    run(
        |ptr| {
            let mut random = Lcg(42);
            for track in 1..13u32 {
                let left = random.hit(9000 + 700 * track as usize, 0.4);
                let right = random.hit(9000 + 700 * track as usize, 0.35);
                load_sample(ptr, track, &left, &right);
            }
            for track in [1u32, 2] {
                for dynamic in 0..3u32 {
                    for take in 0..3u32 {
                        let frames = 8000 + 400 * take as usize;
                        let mut hit = vec![0.0f32; 150]; // A lead-in the onset trim removes
                        hit.extend(random.hit(frames, 0.25 + 0.3 * dynamic as f32));
                        let right = random.hit(hit.len(), 0.3);
                        engine_load_take(ptr, track, dynamic, take, hit.as_ptr(), right.as_ptr(), hit.len());
                    }
                }
            }
            engine_load_take(ptr, 2, 1, 2, std::ptr::null(), std::ptr::null(), 0); // Refused: null pointers
            grid(ptr, 1, &[2, 0, 0, 1, 0, 0, 3, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 0, 0, 1, 0, 3, 0]);
            grid(ptr, 2, &[0, 0, 0, 0, 2, 0, 3, 0, 0, 0, 0, 0, 1, 3, 3, 3, 0, 0, 0, 0, 2, 0, 0, 1]);
            grid(ptr, 3, &[1, 1, 3, 1, 2, 1, 0, 1, 1, 3, 1, 1, 2, 1, 0, 0, 1, 1, 3, 1, 2, 1, 0, 1]);
            grid(ptr, 4, &[0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
            grid(ptr, 7, &[3, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]);
            grid(ptr, 12, &[0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0]);
            engine_set_measure_length(ptr, 12);
            engine_set_bars(ptr, 2);
            engine_set_bpm(ptr, 151.0);
            engine_start(ptr);
        },
        &[
            (seconds(1.7), &|ptr: *mut Engine| engine_restart_pattern(ptr)),
            (seconds(2.4), &|ptr: *mut Engine| engine_stop(ptr)),
            (seconds(2.6), &|ptr: *mut Engine| engine_start(ptr)),
        ],
    )
}

fn trainer_output(setup: fn(*mut Engine), cue: fn(*mut Engine)) -> Output {
    run(
        |ptr| {
            engine_set_click_mode(ptr, 0);
            grid(ptr, 0, &[2, 0, 1, 0, 1, 0]);
            grid(ptr, 1, &[1, 0, 0, 0, 0, 0]);
            let mut random = Lcg(99);
            let kick = random.hit(4000, 0.6);
            load_sample(ptr, 1, &kick, &kick);
            engine_set_measure_length(ptr, 6);
            setup(ptr);
            engine_start(ptr);
        },
        &[(seconds(2.0), &move |ptr: *mut Engine| cue(ptr))],
    )
}

fn trainer_stepped_output() -> Output {
    trainer_output(
        |ptr| engine_set_trainer(ptr, true, 97.0, 180.0, 6.5, 0, 1.0, 0),
        |ptr| engine_set_trainer(ptr, true, 97.0, 180.0, 4.0, 0, 2.0, 0), // Held until beat 1
    )
}

fn trainer_smooth_output() -> Output {
    trainer_output(
        |ptr| engine_replace_trainer(ptr, true, 88.0, 200.0, 9.0, 1, 0.5, 1),
        |ptr| engine_set_trainer(ptr, true, 88.0, 200.0, 3.0, 1, 0.25, 1),
    )
}

fn pad_output() -> Output {
    run(
        |ptr| {
            let mut random = Lcg(2024);
            for (timbre, keys) in [(1u8, [48u8, 60, 72]), (0, [45, 57, 69])] {
                engine_pad_load_begin(ptr, timbre);
                for key in keys {
                    let frames = 20000 + key as usize * 10;
                    let left = random.tone(frames, 0.5);
                    let right = random.tone(frames, 0.5);
                    engine_pad_load(ptr, timbre, key, 1000, frames - 2000, left.as_ptr(), right.as_ptr(), frames);
                }
                engine_pad_load_end(ptr, timbre);
            }
            engine_set_click_mode(ptr, 0);
            grid(ptr, 0, &[1, 0, 0, 0]);
            engine_set_measure_length(ptr, 4);
            engine_set_bpm(ptr, 110.0);
            engine_pad_set_volume(ptr, 0.85);
            pad_play(ptr, &[48, 52, 55, 59, 62], 1);
            engine_start(ptr);
        },
        &[
            (seconds(0.9), &|ptr: *mut Engine| pad_play(ptr, &[50, 53, 57, 60], 1)),
            (seconds(1.6), &|ptr: *mut Engine| pad_play(ptr, &[50, 53, 57, 60], 0)),
            (seconds(2.1), &|ptr: *mut Engine| engine_pad_set_volume(ptr, 0.4)),
            (seconds(2.3), &|ptr: *mut Engine| pad_play(ptr, &[45, 48, 52, 55, 59, 62, 64], 4)),
            (seconds(2.6), &|ptr: *mut Engine| pad_play(ptr, &[43, 47, 50], 2)),
            (seconds(2.9), &|ptr: *mut Engine| engine_stop(ptr)),
            (seconds(3.2), &|ptr: *mut Engine| engine_pad_stop(ptr)),
        ],
    )
}

#[test]
fn drums_with_takes_and_dynamics() {
    compare("drums_with_takes_and_dynamics", fingerprint(&drums_output()), DRUMS_WITH_TAKES_AND_DYNAMICS);
}

#[test]
fn synth_click() {
    compare("synth_click", fingerprint(&click_scenario(0)), SYNTH_CLICK);
}

#[test]
fn sample_click() {
    compare("sample_click", fingerprint(&click_scenario(1)), SAMPLE_CLICK);
}

#[test]
fn trainer_stepped_by_bars() {
    compare("trainer_stepped_by_bars", fingerprint(&trainer_stepped_output()), TRAINER_STEPPED_BY_BARS);
}

#[test]
fn trainer_smooth_by_seconds() {
    compare("trainer_smooth_by_seconds", fingerprint(&trainer_smooth_output()), TRAINER_SMOOTH_BY_SECONDS);
}

#[test]
fn pad_changes_chord_and_timbre() {
    compare("pad_changes_chord_and_timbre", fingerprint(&pad_output()), PAD_CHANGES_CHORD_AND_TIMBRE);
}

#[test]
fn a_one_bit_change_fails_naming_its_scenario() {
    let mut output = click_scenario(0);
    compare("synth_click", fingerprint(&output), SYNTH_CLICK);
    output.right[FRAMES / 2] = f32::from_bits(output.right[FRAMES / 2].to_bits() ^ 1);

    let failure = panic::catch_unwind(|| compare("synth_click", fingerprint(&output), SYNTH_CLICK));

    let message = failure.expect_err("a one-bit change must fail").downcast::<String>().unwrap();
    assert!(message.contains("golden scenario synth_click"), "{message}");
}
