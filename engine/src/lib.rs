#![allow(dead_code)]
mod dsp;
mod pad;
mod sequencer;
#[cfg(test)]
mod golden_tests;
mod instruments;
use dsp::sample::trim_onset;
use instruments::click::Click;
use instruments::drums::{Drums, DYNAMICS, HI_HAT_TRACK, OPEN_HAT_TRACK, TAKES, TRACKS};
use sequencer::clock::Clock;
use sequencer::pattern::{Pattern, STEPS_COUNT};
use sequencer::trainer::{Curve, StepType, Trainer, TrainerSettings};
use std::slice;

// The pattern and the kit count the same tracks, though neither layer may name the other
const _: () = assert!(sequencer::pattern::TRACKS == instruments::drums::TRACKS);

fn step_type_from_ffi(value: u32) -> Option<StepType> {
    match value {
        0 => Some(StepType::Bars),
        1 => Some(StepType::Seconds),
        _ => None,
    }
}

fn curve_from_ffi(value: u32) -> Option<Curve> {
    match value {
        0 => Some(Curve::Stepped),
        1 => Some(Curve::Smooth),
        _ => None,
    }
}

pub struct Engine {
    sample_rate: f32,
    is_playing: bool,
    current_sample_index: u64,
    clock: Clock,

    // Instruments
    click: Click,
    drums: Drums,

    // Sequencer Grid
    pattern: Pattern,

    // Tempo Trainer State
    trainer: Trainer,
    
    // Events queued for Javascript
    last_tick_index: i32, // -1 if no tick in last process
    last_tick_bpm: f64,

    pad: pad::Pad,
}

impl Engine {
    pub fn new(sample_rate: f32) -> Self {
        Engine {
            sample_rate,
            is_playing: false,
            current_sample_index: 0,
            clock: Clock::new(sample_rate),
            click: Click::new(sample_rate),
            drums: Drums::new(sample_rate),
            pattern: Pattern::new(),
            trainer: Trainer::new(),
            last_tick_index: -1,
            last_tick_bpm: 120.0,
            pad: pad::Pad::new(sample_rate),
        }
    }

    pub fn start(&mut self) {
        if let Some(bpm) = self.trainer.on_start(self.is_playing) {
            self.clock.set_bpm(bpm);
        }

        self.drums.reset();
        self.click.reset();

        self.is_playing = true;
        self.pattern.restart();
        self.clock.start();
    }

    pub fn stop(&mut self) {
        self.is_playing = false;
        self.drums.stop();
    }

    fn trigger_step(&mut self) {
        if self.pattern.is_bar_start() {
            let first = self.clock.end_first_hit();
            if let Some(bpm) = self.trainer.on_bar_start(first, self.clock.bpm(), self.sample_rate) {
                self.clock.set_bpm(bpm);
            }
        }

        self.last_tick_index = self.pattern.index() as i32;
        self.last_tick_bpm = self.clock.bpm();

        // Check click track
        self.click.trigger(self.pattern.step(0));

        // A closing hat cuts the open one, as on a real stand
        if self.pattern.step(HI_HAT_TRACK) > 0 {
            self.drums.choke(OPEN_HAT_TRACK);
        }

        // Check the drum tracks
        for i in 1..TRACKS {
            let step = self.pattern.step(i);
            if step > 0 {
                self.drums.trigger(i, step);
            }
        }

        // Update step index
        self.pattern.advance();
    }

    // A preset load: the old Trainer stops now, and its counters go with it.
    fn replace_trainer(&mut self, settings: TrainerSettings) {
        self.trainer.replace(settings, self.is_playing);
    }

    fn set_trainer(&mut self, settings: TrainerSettings) {
        self.trainer.set(settings, self.is_playing);
    }

    fn process_tick_samples(&mut self) {
        let clock = &self.clock;
        let next = self.trainer.on_frame(clock.bpm(), clock.samples_per_step(), self.pattern.measure_length(), self.sample_rate);
        if let Some(bpm) = next {
            self.clock.set_bpm(bpm);
        }
    }

    pub fn fill_buffers(&mut self, out_l: &mut [f32], out_r: &mut [f32]) {
        self.last_tick_index = -1;
        if !self.is_playing {
            out_l.fill(0.0);
            out_r.fill(0.0);
            self.mix_pad(out_l, out_r);
            return;
        }

        let len = out_l.len();
        for i in 0..len {
            // 1. Process timing
            if !self.clock.is_first_hit() {
                self.process_tick_samples();
            }
            if self.clock.advance() {
                self.trigger_step(); // The first hit has no time to wait, whatever the tempo
            }

            // 2. Synthesize Click (decaying sine wave) or Play Sample
            let (click_out_l, click_out_r) = self.click.render();

            // 3. Play Drum Samples
            let (drums_l, drums_r) = self.drums.render();

            // Combine (Left / Right)
            out_l[i] = click_out_l + drums_l;
            out_r[i] = click_out_r + drums_r;
        }
        self.mix_pad(out_l, out_r);
    }

    // The pad runs on after the drums' loop, so it never reaches their timing
    fn mix_pad(&mut self, out_l: &mut [f32], out_r: &mut [f32]) {
        self.pad.mix_into(out_l, out_r);
        for sample in out_l.iter_mut().chain(out_r.iter_mut()) {
            *sample = sample.clamp(-1.0, 1.0);
        }
    }
}

// --- C FFI WASM EXPORTS ---

#[no_mangle]
pub extern "C" fn engine_new(sample_rate: f32) -> *mut Engine {
    Box::into_raw(Box::new(Engine::new(sample_rate)))
}

#[no_mangle]
pub extern "C" fn engine_free(ptr: *mut Engine) {
    if !ptr.is_null() {
        unsafe { let _ = Box::from_raw(ptr); }
    }
}

#[no_mangle]
pub extern "C" fn engine_start(ptr: *mut Engine) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.start();
}

#[no_mangle]
pub extern "C" fn engine_stop(ptr: *mut Engine) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.stop();
}

#[no_mangle]
pub extern "C" fn engine_set_bpm(ptr: *mut Engine, bpm: f64) {
    if ptr.is_null() || bpm <= 0.0 || !bpm.is_finite() { return; }
    let engine = unsafe { &mut *ptr };
    engine.clock.set_bpm(bpm);
}

#[no_mangle]
pub extern "C" fn engine_load_sample(
    ptr: *mut Engine,
    sample_id: u32,
    left_ptr: *const f32,
    right_ptr: *const f32,
    length: usize
) {
    if ptr.is_null() || left_ptr.is_null() || right_ptr.is_null() || sample_id >= TRACKS as u32 { return; }
    let engine = unsafe { &mut *ptr };
    let left_slice = unsafe { slice::from_raw_parts(left_ptr, length) };
    let right_slice = unsafe { slice::from_raw_parts(right_ptr, length) };
    let sample = trim_onset(left_slice, right_slice);
    if sample_id == 0 {
        engine.click.load(sample);
    } else {
        engine.drums.load_sample(sample_id as usize, sample);
    }
}

// Dynamic: 0 Ghost, 1 Normal, 2 Accent
#[no_mangle]
pub extern "C" fn engine_load_take(
    ptr: *mut Engine,
    track: u32,
    dynamic: u32,
    take: u32,
    left_ptr: *const f32,
    right_ptr: *const f32,
    length: usize
) {
    if ptr.is_null() || left_ptr.is_null() || right_ptr.is_null() { return; }
    if track >= TRACKS as u32 || dynamic >= DYNAMICS as u32 || take >= TAKES as u32 { return; }
    let engine = unsafe { &mut *ptr };
    let left_slice = unsafe { slice::from_raw_parts(left_ptr, length) };
    let right_slice = unsafe { slice::from_raw_parts(right_ptr, length) };
    engine.drums.load_take(track as usize, dynamic as usize, take as usize, trim_onset(left_slice, right_slice));
}

#[no_mangle]
pub extern "C" fn engine_update_grid(ptr: *mut Engine, sample_id: u32, steps_ptr: *const u8, length: usize) {
    if ptr.is_null() || steps_ptr.is_null() || sample_id >= TRACKS as u32 || length > STEPS_COUNT { return; }
    let engine = unsafe { &mut *ptr };
    let steps_slice = unsafe { slice::from_raw_parts(steps_ptr, length) };
    engine.pattern.update_grid(sample_id as usize, steps_slice);
}

#[no_mangle]
pub extern "C" fn engine_set_measure_length(ptr: *mut Engine, length: u32) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pattern.set_measure_length(length as usize);
}

// The next step plays bar 1, on the pulse already running: nothing stops or starts
#[no_mangle]
pub extern "C" fn engine_restart_pattern(ptr: *mut Engine) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pattern.restart();
}

#[no_mangle]
pub extern "C" fn engine_set_bars(ptr: *mut Engine, bars: u32) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pattern.set_bars(bars as usize);
}

fn trainer_settings(
    enabled: bool,
    start_bpm: f64,
    target_bpm: f64,
    increment: f64,
    step_type: u32,
    step_value: f64,
    curve_type: u32
) -> Option<TrainerSettings> {
    let (step_type, curve) = (step_type_from_ffi(step_type)?, curve_from_ffi(curve_type)?);
    TrainerSettings::new(enabled, start_bpm, target_bpm, increment, step_type, step_value, curve)
}

// Runs a Trainer update unless the pointer or any setting is invalid.
fn update_trainer(ptr: *mut Engine, settings: Option<TrainerSettings>, update: fn(&mut Engine, TrainerSettings)) {
    if ptr.is_null() { return; }
    let Some(settings) = settings else { return };
    update(unsafe { &mut *ptr }, settings);
}

#[no_mangle]
pub extern "C" fn engine_replace_trainer(
    ptr: *mut Engine,
    enabled: bool,
    start_bpm: f64,
    target_bpm: f64,
    increment: f64,
    step_type: u32,
    step_value: f64,
    curve_type: u32
) {
    let settings = trainer_settings(enabled, start_bpm, target_bpm, increment, step_type, step_value, curve_type);
    update_trainer(ptr, settings, Engine::replace_trainer);
}

#[no_mangle]
pub extern "C" fn engine_set_trainer(
    ptr: *mut Engine,
    enabled: bool,
    start_bpm: f64,
    target_bpm: f64,
    increment: f64,
    step_type: u32,
    step_value: f64,
    curve_type: u32
) {
    let settings = trainer_settings(enabled, start_bpm, target_bpm, increment, step_type, step_value, curve_type);
    update_trainer(ptr, settings, Engine::set_trainer);
}

#[no_mangle]
pub extern "C" fn engine_set_click_mode(ptr: *mut Engine, mode: u32) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.click.set_mode(mode);
}

// Holds the first `count` notes in a timbre. A chord has at most 7, and the rest of the arguments are ignored
#[no_mangle]
pub extern "C" fn engine_pad_play(ptr: *mut Engine, n0: u8, n1: u8, n2: u8, n3: u8, n4: u8, n5: u8, n6: u8, count: usize, timbre: u8) {
    if ptr.is_null() { return; }
    let notes = [n0, n1, n2, n3, n4, n5, n6];
    let Some(notes) = notes.get(..count) else { return };
    let engine = unsafe { &mut *ptr };
    engine.pad.play(notes, timbre);
}

#[no_mangle]
pub extern "C" fn engine_pad_stop(ptr: *mut Engine) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pad.stop();
}

#[no_mangle]
pub extern "C" fn engine_pad_set_volume(ptr: *mut Engine, volume: f32) {
    if ptr.is_null() || !volume.is_finite() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pad.set_volume(volume);
}

#[no_mangle]
pub extern "C" fn engine_pad_load(
    ptr: *mut Engine,
    timbre: u8,
    key: u8,
    loop_start: usize,
    loop_end: usize,
    left_ptr: *const f32,
    right_ptr: *const f32,
    length: usize
) {
    if ptr.is_null() || left_ptr.is_null() || right_ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    let left_slice = unsafe { slice::from_raw_parts(left_ptr, length) };
    let right_slice = unsafe { slice::from_raw_parts(right_ptr, length) };
    engine.pad.load(timbre, key, left_slice, right_slice, loop_start, loop_end);
}

// Brackets the files of one timbre: the notes read none of them until the last has come or failed
#[no_mangle]
pub extern "C" fn engine_pad_load_begin(ptr: *mut Engine, timbre: u8) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pad.load_begin(timbre);
}

#[no_mangle]
pub extern "C" fn engine_pad_load_end(ptr: *mut Engine, timbre: u8) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pad.load_end(timbre);
}

#[no_mangle]
pub extern "C" fn engine_get_tick(ptr: *mut Engine, out_bpm: *mut f64) -> i32 {
    if ptr.is_null() || out_bpm.is_null() { return -1; }
    let engine = unsafe { &mut *ptr };
    unsafe { *out_bpm = engine.last_tick_bpm; }
    engine.last_tick_index
}

#[no_mangle]
pub extern "C" fn engine_process(ptr: *mut Engine, out_l_ptr: *mut f32, out_r_ptr: *mut f32, length: usize) {
    if ptr.is_null() || out_l_ptr.is_null() || out_r_ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    let out_l = unsafe { slice::from_raw_parts_mut(out_l_ptr, length) };
    let out_r = unsafe { slice::from_raw_parts_mut(out_r_ptr, length) };
    engine.fill_buffers(out_l, out_r);
}

#[no_mangle]
pub extern "C" fn engine_alloc(size: usize) -> *mut u8 {
    let mut buf = vec![0u8; size];
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn engine_free_buf(ptr: *mut u8, size: usize) {
    if !ptr.is_null() {
        unsafe { let _ = Vec::from_raw_parts(ptr, size, size); }
    }
}

// --- UNIT TESTS ---
#[cfg(test)]
mod tests {
    use super::*;
    use crate::dsp::sample::Sample;
    use crate::instruments::drums::{GAIN_ACCENT, GAIN_GHOST, GAIN_NORMAL};

    // --- Black-box harness: a one-sample click read back through the exports ---

    const SR: f32 = 44100.0;
    const BLOCK: u64 = 128; // The size the AudioWorklet renders
    const ROUNDING: f64 = 1e-6;

    #[derive(Clone, Copy)]
    struct Hit {
        pos: u64,
        step: i32,
        bpm: f64,
    }

    struct Run {
        ptr: *mut Engine,
        pos: u64,
        hits: Vec<Hit>,
    }

    impl Run {
        fn new(bpm: f64, grid: &[u8]) -> Run {
            Run::at_rate(SR, bpm, grid)
        }

        // A stopped engine with a one-sample click on every grid step that is set.
        // The grid length sets the measure length.
        fn at_rate(sample_rate: f32, bpm: f64, grid: &[u8]) -> Run {
            let ptr = engine_new(sample_rate);
            engine_set_bpm(ptr, bpm);
            engine_set_click_mode(ptr, 1);
            let impulse = [1.0f32];
            engine_load_sample(ptr, 0, impulse.as_ptr(), impulse.as_ptr(), 1);
            engine_set_measure_length(ptr, grid.len() as u32);
            engine_update_grid(ptr, 0, grid.as_ptr(), grid.len());
            Run { ptr, pos: 0, hits: Vec::new() }
        }

        fn play(&mut self) {
            self.pos = 0;
            self.hits.clear();
            engine_start(self.ptr);
        }

        fn render(&mut self, frames: u64) {
            let mut left = [0.0f32; BLOCK as usize];
            let mut right = [0.0f32; BLOCK as usize];
            let mut remaining = frames;
            while remaining > 0 {
                let block = remaining.min(BLOCK) as usize;
                engine_process(self.ptr, left.as_mut_ptr(), right.as_mut_ptr(), block);
                let mut bpm = 0.0f64;
                let step = engine_get_tick(self.ptr, &mut bpm);
                for i in 0..block {
                    if left[i] != 0.0 {
                        self.hits.push(Hit { pos: self.pos + i as u64, step, bpm });
                    }
                }
                self.pos += block as u64;
                remaining -= block as u64;
            }
        }

        fn render_hits(&mut self, count: usize) {
            while self.hits.len() < count {
                self.render(BLOCK);
            }
        }

        // Samples between hit `k` and the next one.
        fn interval(&self, k: usize) -> f64 {
            (self.hits[k + 1].pos - self.hits[k].pos) as f64
        }
    }

    impl Drop for Run {
        fn drop(&mut self) {
            engine_free(self.ptr);
        }
    }

    fn step_samples(sample_rate: f32, bpm: f64) -> f64 {
        sample_rate as f64 * 60.0 / (bpm * 4.0)
    }

    fn assert_within_one_sample(actual: f64, ideal: f64, what: &str) {
        assert!(
            (actual - ideal).abs() <= 1.0 + ROUNDING,
            "{}: got {}, ideal {}",
            what,
            actual,
            ideal
        );
    }

    // Both output channels, block by block as the worklet renders them.
    fn stereo_output(ptr: *mut Engine, frames: usize) -> (Vec<f32>, Vec<f32>) {
        let mut left = vec![0.0f32; frames];
        let mut right = vec![0.0f32; frames];
        for start in (0..frames).step_by(BLOCK as usize) {
            let block = (frames - start).min(BLOCK as usize);
            let l = left[start..].as_mut_ptr();
            let r = right[start..].as_mut_ptr();
            engine_process(ptr, l, r, block);
        }
        (left, right)
    }

    fn sounding_frames(left: &[f32], right: &[f32]) -> Vec<usize> {
        (0..left.len()).filter(|&i| left[i] != 0.0 || right[i] != 0.0).collect()
    }

    fn quarter_grid() -> [u8; 16] {
        let mut grid = [0u8; 16];
        for step in (0..16).step_by(4) {
            grid[step] = 1;
        }
        grid
    }

    #[test]
    fn time_01_hits_within_one_sample() {
        let integer_bpms = (40..=240).map(|bpm| bpm as f64);
        let fractional_bpms = [97.5, 133.3, 187.7].into_iter();
        for bpm in integer_bpms.chain(fractional_bpms) {
            let frames = 30 * SR as u64;
            let mut run = Run::new(bpm, &[1; 16]);
            run.play();
            run.render(frames);

            let ideal = step_samples(SR, bpm);
            for (k, hit) in run.hits.iter().enumerate() {
                let what = format!("{} BPM, hit {}", bpm, k);
                assert_within_one_sample(hit.pos as f64, k as f64 * ideal, &what);
            }
            let expected_hits = frames as f64 / ideal;
            assert_within_one_sample(run.hits.len() as f64, expected_hits, "hit count");
        }
    }

    #[test]
    fn time_02_one_hour_no_drift() {
        for bpm in [40.0, 97.0, 120.0, 133.0, 187.0, 240.0] {
            let mut run = Run::new(bpm, &quarter_grid());
            run.play();
            run.render(3600 * SR as u64);

            let ideal = step_samples(SR, bpm) * 4.0;
            assert_eq!(run.hits.len() as u64, 60 * bpm as u64, "hit count at {} BPM", bpm);
            for (k, hit) in run.hits.iter().enumerate() {
                let what = format!("{} BPM, hit {}", bpm, k);
                assert_within_one_sample(hit.pos as f64, k as f64 * ideal, &what);
            }
            let last = run.hits.len() - 1;
            let what = format!("{} BPM, final hit", bpm);
            assert_within_one_sample(run.hits[last].pos as f64, last as f64 * ideal, &what);
        }
    }

    #[test]
    fn time_03_every_step_same_duration() {
        for sample_rate in [44100.0, 48000.0] {
            for bpm in [40.0, 97.0, 133.3, 187.0, 240.0] {
                for length in [15usize, 16] {
                    let grid = vec![1u8; length];
                    let mut run = Run::at_rate(sample_rate, bpm, &grid);
                    run.play();
                    run.render(20 * sample_rate as u64);

                    let ideal = step_samples(sample_rate, bpm);
                    for k in 0..run.hits.len() - 1 {
                        assert_eq!(run.hits[k].step as usize, k % length);
                        assert_within_one_sample(run.interval(k), ideal, "step duration");
                    }
                }
            }
        }
    }

    #[test]
    fn bpm_01_quarter_note_in_every_meter() {
        // Steps per measure for 2/4, 3/4, 4/4, 5/4, 6/8, 7/8 and 12/8.
        for length in [8usize, 12, 16, 20, 12, 14, 24] {
            for bpm in [60.0, 97.0, 135.0, 195.0] {
                let grid = vec![1u8; length];
                let mut run = Run::new(bpm, &grid);
                run.play();
                run.render(30 * SR as u64);

                let quarter = SR as f64 * 60.0 / bpm;
                for (k, hit) in run.hits.iter().step_by(4).enumerate() {
                    let what = format!("{} steps at {} BPM, quarter {}", length, bpm, k);
                    assert_within_one_sample(hit.pos as f64, k as f64 * quarter, &what);
                }
            }
        }

        // A 12/8 click every 6 steps lands every dotted quarter: 2/3 of the BPM per minute.
        for (bpm, clicks_per_minute) in [(135.0, 90), (195.0, 130)] {
            let mut grid = [0u8; 24];
            for step in (0..24).step_by(6) {
                grid[step] = 1;
            }
            let mut run = Run::new(bpm, &grid);
            run.play();
            run.render(60 * SR as u64);
            assert_eq!(run.hits.len(), clicks_per_minute);
        }
    }

    #[test]
    fn click_01_accent_has_no_echo() {
        let mut grid = [0u8; 16];
        grid[0] = 2; // The next hit is one bar away, at frame 88200
        let bar = 88200;

        // Sample click: one accented impulse stays one sample.
        let run = Run::new(120.0, &grid);
        engine_start(run.ptr);
        let (left, right) = stereo_output(run.ptr, bar);
        assert_eq!(sounding_frames(&left, &right), vec![0]);

        // Synth click: amplitude decays by 0.9995 per frame to the 0.001 floor, about
        // 13812 frames. Nothing may sound after that.
        let run = Run::new(120.0, &grid);
        engine_set_click_mode(run.ptr, 0);
        engine_start(run.ptr);
        let (left, right) = stereo_output(run.ptr, bar);
        let sounding = sounding_frames(&left, &right);
        assert!(*sounding.last().unwrap() < 14000, "sound at {:?}", sounding.last());
    }

    // Sound sources for the Stop and Play tests: (track, click mode). Slot 0 uses mode 1 for
    // its sample and mode 0 for the synth click; slots 1 to 3 are the drums.
    const SOUND_SOURCES: [(u32, u32); 5] = [(0, 0), (0, 1), (1, 1), (2, 1), (3, 1)];
    const LONG_SAMPLE_FRAMES: usize = 50000;

    fn sounding_run(track: u32, click_mode: u32) -> Run {
        let run = Run::new(120.0, &[0; 16]);
        engine_set_click_mode(run.ptr, click_mode);
        let sample = vec![0.5f32; LONG_SAMPLE_FRAMES];
        engine_load_sample(run.ptr, track, sample.as_ptr(), sample.as_ptr(), sample.len());
        let mut grid = [0u8; 16];
        grid[0] = 1;
        engine_update_grid(run.ptr, track, grid.as_ptr(), 16);
        run
    }

    #[test]
    fn play_01_stop_is_silent() {
        for (track, click_mode) in SOUND_SOURCES {
            let run = sounding_run(track, click_mode);
            engine_start(run.ptr);
            let (left, right) = stereo_output(run.ptr, 1000);
            assert!(!sounding_frames(&left, &right).is_empty());

            engine_stop(run.ptr);
            let (left, right) = stereo_output(run.ptr, 1000);
            assert_eq!(sounding_frames(&left, &right), Vec::<usize>::new());
        }
    }

    #[test]
    fn play_02_restart_has_no_leftovers() {
        for (track, click_mode) in SOUND_SOURCES {
            let run = sounding_run(track, click_mode);
            engine_start(run.ptr);
            let (left, right) = stereo_output(run.ptr, 1000);
            assert!(!sounding_frames(&left, &right).is_empty());
            engine_stop(run.ptr);

            // Play again with step 0 empty and the first enabled step at step 4.
            let mut grid = [0u8; 16];
            grid[4] = 1;
            engine_update_grid(run.ptr, track, grid.as_ptr(), 16);
            engine_start(run.ptr);

            let first_enabled = 4.0 * step_samples(SR, 120.0);
            let (left, right) = stereo_output(run.ptr, first_enabled as usize + 10);
            let first_sound = sounding_frames(&left, &right)[0];
            let what = format!("track {} mode {}", track, click_mode);
            assert_within_one_sample(first_sound as f64, first_enabled, &what);
        }
    }

    #[test]
    fn play_03_fires_step_zero_first() {
        let mut run = Run::new(120.0, &[1; 16]);
        run.play();
        run.render(30000);
        assert_ne!(run.hits.last().unwrap().step, 0);
        engine_stop(run.ptr);

        run.play();
        run.render_hits(2);
        assert_eq!(run.hits[0].pos, 0);
        assert_eq!(run.hits[0].step, 0);
        assert_eq!(run.hits[1].step, 1);
        assert_within_one_sample(run.interval(0), step_samples(SR, 120.0), "first step");
    }

    #[test]
    fn play_04_settings_before_first_hit_keep_it_on_sample_zero() {
        // A slower tempo, as a preset load sends it.
        let mut run = Run::new(120.0, &[1; 16]);
        run.play();
        engine_set_bpm(run.ptr, 60.0);
        engine_replace_trainer(run.ptr, false, 60.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.render_hits(2);
        assert_eq!(run.hits[0].pos, 0);
        assert_hits_at(&run, 0..2, 60.0);
        assert_intervals_at(&run, 0..1, 60.0);

        // A faster one.
        let mut run = Run::new(60.0, &[1; 16]);
        run.play();
        engine_set_bpm(run.ptr, 120.0);
        run.render_hits(2);
        assert_eq!(run.hits[0].pos, 0);
        assert_intervals_at(&run, 0..1, 120.0);
    }

    // Interleaved WAV frames as (left, right). Mono files return the same channel twice.
    fn read_wav(path: &str) -> (Vec<f32>, Vec<f32>) {
        let bytes = std::fs::read(path).unwrap();
        let u16_at = |i: usize| u16::from_le_bytes([bytes[i], bytes[i + 1]]);
        let u32_at = |i: usize| u32::from_le_bytes([bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]]);

        let (mut format, mut channels, mut bits) = (0, 0, 0);
        let mut chunk = 12;
        loop {
            let size = u32_at(chunk + 4) as usize;
            let body = chunk + 8;
            if &bytes[chunk..chunk + 4] == b"fmt " {
                format = u16_at(body);
                channels = u16_at(body + 2) as usize;
                bits = u16_at(body + 14) as usize;
            } else if &bytes[chunk..chunk + 4] == b"data" {
                let width = bits / 8;
                let decode = |frame: &[u8]| match (format, bits) {
                    (1, 16) => i16::from_le_bytes([frame[0], frame[1]]) as f32 / 32768.0,
                    (1, 24) => {
                        i32::from_le_bytes([0, frame[0], frame[1], frame[2]]) as f32 / 2147483648.0
                    }
                    (1, 32) => {
                        i32::from_le_bytes([frame[0], frame[1], frame[2], frame[3]]) as f32
                            / 2147483648.0
                    }
                    (3, 32) => f32::from_le_bytes([frame[0], frame[1], frame[2], frame[3]]),
                    other => panic!("unsupported WAV format {:?}", other),
                };
                let frames = bytes[body..body + size].chunks_exact(width * channels);
                let left = frames.clone().map(|f| decode(f)).collect();
                let right = frames.map(|f| decode(&f[(channels - 1) * width..])).collect();
                return (left, right);
            }
            chunk = body + size + (size & 1);
        }
    }

    // Plays a sample on the kick slot, at unity volume, from the first frame of a run.
    fn kick_output(left: &[f32], right: &[f32], frames: usize) -> (Vec<f32>, Vec<f32>) {
        let run = Run::new(120.0, &[0; 16]);
        engine_load_sample(run.ptr, 1, left.as_ptr(), right.as_ptr(), left.len());
        let mut grid = [0u8; 16];
        grid[0] = 2; // An accent is the piece's full level
        engine_update_grid(run.ptr, 1, grid.as_ptr(), 16);
        engine_start(run.ptr);
        stereo_output(run.ptr, frames)
    }

    #[test]
    fn onset_01_trims_before_one_percent() {
        struct Case {
            left: Vec<f32>,
            right: Vec<f32>,
            first_kept: usize,
        }
        let cases = [
            // A frame below 1% goes, the frame exactly at 1% stays, later quiet frames stay.
            Case {
                left: vec![0.0, -0.009, 0.0, 0.01, 0.0, 1.0, 0.2],
                right: vec![0.0; 7],
                first_kept: 3,
            },
            // Either channel can reach 1%, and negative values count.
            Case {
                left: vec![0.0, 0.0, 0.0, 0.0, 0.8, 0.1],
                right: vec![0.0, 0.001, -0.02, 0.0, -0.4, 0.1],
                first_kept: 2,
            },
            // The peak can sit in the other channel.
            Case {
                left: vec![0.002, 0.002, 0.002, 0.002],
                right: vec![0.0, 0.0, 1.0, 0.0],
                first_kept: 2,
            },
            // The threshold is relative to this sample's peak, not to full scale.
            Case {
                left: vec![0.00005, 0.0002, 0.01, 0.0],
                right: vec![0.0; 4],
                first_kept: 1,
            },
            // A sample that starts loud loses nothing.
            Case {
                left: vec![0.5, 0.0, 0.2],
                right: vec![0.5, 0.0, 0.2],
                first_kept: 0,
            },
        ];

        for case in cases {
            let frames = case.left.len() + 5;
            let (out_l, out_r) = kick_output(&case.left, &case.right, frames);

            let mut expected_l = case.left[case.first_kept..].to_vec();
            let mut expected_r = case.right[case.first_kept..].to_vec();
            expected_l.resize(frames, 0.0);
            expected_r.resize(frames, 0.0);
            assert_eq!(out_l, expected_l);
            assert_eq!(out_r, expected_r);
        }
    }

    #[test]
    fn onset_02_woodblock_on_the_step() {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../public/woodblock.wav");
        let (left, right) = read_wav(path);
        let peak = left.iter().chain(&right).fold(0.0f32, |peak, s| peak.max(s.abs()));
        assert!(peak > 0.0);

        for bpm in [97.0, 120.0] {
            let mut grid = [0u8; 16];
            grid[4] = 2; // Accented, so the sample plays at unity volume
            let run = Run::new(bpm, &grid);
            engine_load_sample(run.ptr, 0, left.as_ptr(), right.as_ptr(), left.len());
            engine_start(run.ptr);

            let step_position = 4.0 * step_samples(SR, bpm);
            let (out_l, out_r) = stereo_output(run.ptr, step_position as usize + 20000);
            let audible = 0.01 * peak;
            let first_audible = (0..out_l.len())
                .find(|&i| out_l[i].abs() >= audible || out_r[i].abs() >= audible)
                .unwrap();
            let what = format!("woodblock at {} BPM", bpm);
            assert_within_one_sample(first_audible as f64, step_position, &what);
        }
    }

    #[test]
    fn onset_03_silent_sample_unchanged() {
        let silence = vec![0.0f32; 100];
        let run = Run::new(120.0, &[0; 16]);
        engine_load_sample(run.ptr, 1, silence.as_ptr(), silence.as_ptr(), silence.len());

        let engine = unsafe { &*run.ptr };
        let stored = engine.drums.samples[1].as_ref().unwrap();
        assert_eq!(stored.left_channel, silence);
        assert_eq!(stored.right_channel, silence);
    }

    const STEPPED: u32 = 0;
    const SMOOTH: u32 = 1;
    const BY_BARS: u32 = 0;
    const BY_SECONDS: u32 = 1;

    fn assert_intervals_at(run: &Run, intervals: std::ops::Range<usize>, bpm: f64) {
        let ideal = step_samples(SR, bpm);
        for k in intervals {
            let what = format!("interval after hit {}", k);
            assert_within_one_sample(run.interval(k), ideal, &what);
        }
    }

    fn assert_hits_at(run: &Run, hits: std::ops::Range<usize>, bpm: f64) {
        for k in hits {
            assert_eq!(run.hits[k].bpm, bpm, "hit {}", k);
        }
    }

    #[test]
    fn train_02_bars_change_on_beat_one() {
        // +5 every bar: the interval into each beat 1 keeps the old BPM.
        let mut run = Run::new(80.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 80.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.play();
        run.render_hits(34);

        assert_hits_at(&run, 0..16, 80.0);
        assert_hits_at(&run, 16..32, 85.0);
        assert_hits_at(&run, 32..34, 90.0);
        assert_intervals_at(&run, 0..16, 80.0);
        assert_intervals_at(&run, 16..32, 85.0);
        assert_intervals_at(&run, 32..33, 90.0);

        // +5 every 2 bars: the first beat 1 changes nothing.
        let mut run = Run::new(80.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 80.0, 160.0, 5.0, BY_BARS, 2.0, STEPPED);
        run.play();
        run.render_hits(34);

        assert_hits_at(&run, 0..32, 80.0);
        assert_hits_at(&run, 32..34, 85.0);
        assert_intervals_at(&run, 0..32, 80.0);
        assert_intervals_at(&run, 32..33, 85.0);
    }

    #[test]
    fn train_03_seconds_change_on_beat_one() {
        // A bar lasts 2 s at 120 BPM, so 3 s elapse inside the second bar.
        let mut run = Run::new(120.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 120.0, 160.0, 5.0, BY_SECONDS, 3.0, STEPPED);
        run.play();
        run.render_hits(66);

        assert_hits_at(&run, 0..32, 120.0);
        assert_intervals_at(&run, 0..32, 120.0);
        assert_hits_at(&run, 32..33, 125.0);

        // The time restarts on the increment: a bar lasts 1.92 s at 125 BPM, so the next 3 s
        // end after the beat 1 at hit 48 and before the one at hit 64.
        assert_hits_at(&run, 32..64, 125.0);
        assert_intervals_at(&run, 32..64, 125.0);
        assert_hits_at(&run, 64..66, 130.0);
        assert_intervals_at(&run, 64..65, 130.0);

        // The configured time ending exactly on a beat 1 counts for that beat 1.
        let mut run = Run::new(120.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 120.0, 160.0, 5.0, BY_SECONDS, 2.0, STEPPED);
        run.play();
        run.render_hits(17);
        assert_hits_at(&run, 16..17, 125.0);

        // One sample later it does not, so it waits a whole bar.
        let one_sample_past_the_bar = 2.0 + 1.5 / SR as f64;
        let mut run = Run::new(120.0, &[1; 16]);
        engine_set_trainer(
            run.ptr, true, 120.0, 160.0, 5.0, BY_SECONDS, one_sample_past_the_bar, STEPPED,
        );
        run.play();
        run.render_hits(33);
        assert_hits_at(&run, 0..32, 120.0);
        assert_hits_at(&run, 32..33, 125.0);
    }

    #[test]
    fn train_04_smooth_is_continuous() {
        // +5 per second.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 100.0, 200.0, 5.0, BY_SECONDS, 1.0, SMOOTH);
        run.play();
        run.render_hits(16);
        for k in 1..16 {
            assert!(run.hits[k].bpm > run.hits[k - 1].bpm, "hit {} did not rise", k);
            let elapsed_seconds = run.hits[k].pos as f64 / SR as f64;
            assert!((run.hits[k].bpm - (100.0 + 5.0 * elapsed_seconds)).abs() < 0.1);
        }

        // +4 per bar.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 100.0, 200.0, 4.0, BY_BARS, 1.0, SMOOTH);
        run.play();
        run.render_hits(17);
        for k in 1..16 {
            assert!(run.hits[k].bpm > run.hits[k - 1].bpm, "hit {} did not rise", k);
        }
        assert!((run.hits[16].bpm - 104.0).abs() < 0.1, "got {}", run.hits[16].bpm);
    }

    #[test]
    fn train_15_never_passes_target() {
        let modes = [
            (STEPPED, BY_BARS, 1.0),
            (STEPPED, BY_SECONDS, 0.5),
            (SMOOTH, BY_BARS, 1.0),
            (SMOOTH, BY_SECONDS, 0.5),
        ];
        for (curve, step_type, step_value) in modes {
            let mut run = Run::new(100.0, &[1; 16]);
            engine_set_trainer(run.ptr, true, 100.0, 112.0, 5.0, step_type, step_value, curve);
            run.play();
            run.render_hits(16 * 12);

            for hit in &run.hits {
                assert!(hit.bpm <= 112.0, "curve {} reached {}", curve, hit.bpm);
            }
            let last = run.hits.len() - 1;
            assert_eq!(run.hits[last].bpm, 112.0, "curve {}", curve);
            assert_intervals_at(&run, last - 16..last, 112.0);
        }
    }

    #[test]
    fn train_16_holds_start_at_target() {
        for (start, target) in [(120.0, 120.0), (150.0, 120.0)] {
            for curve in [STEPPED, SMOOTH] {
                let mut run = Run::new(100.0, &[1; 16]);
                engine_set_trainer(run.ptr, true, start, target, 5.0, BY_BARS, 1.0, curve);
                run.play();
                run.render_hits(16 * 4);

                assert_hits_at(&run, 0..16 * 4, start);
                assert_intervals_at(&run, 0..16 * 4 - 1, start);
            }
        }
    }

    // 80 BPM at Start, +5 every bar, stopped at the given hit with live BPM 85 from hit 16 on.
    fn run_to_hit(hit: usize) -> Run {
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 80.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.play();
        run.render_hits(hit + 1);
        run
    }

    #[test]
    fn train_01_first_hit_at_start_bpm() {
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 80.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.play();
        run.render_hits(33);
        assert_eq!(run.hits[0].pos, 0);
        assert_hits_at(&run, 0..16, 80.0);
        assert_hits_at(&run, 16..32, 85.0);
        assert_hits_at(&run, 32..33, 90.0);
        assert_intervals_at(&run, 0..16, 80.0);
        assert_intervals_at(&run, 16..32, 85.0);

        // Each Play starts from Start BPM again, with the bar count back at zero.
        engine_stop(run.ptr);
        run.play();
        run.render_hits(17);
        assert_hits_at(&run, 0..16, 80.0);
        assert_intervals_at(&run, 0..16, 80.0);
        assert_hits_at(&run, 16..17, 85.0);

        // A bar counted before Stop does not carry into the next run.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 80.0, 160.0, 5.0, BY_BARS, 2.0, STEPPED);
        run.play();
        run.render_hits(20);
        engine_stop(run.ptr);
        run.play();
        run.render_hits(33);
        assert_hits_at(&run, 0..32, 80.0);
        assert_hits_at(&run, 32..33, 85.0);

        // A Trainer that is off leaves the BPM alone.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, false, 80.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.play();
        run.render_hits(2);
        assert_hits_at(&run, 0..2, 100.0);
        assert_intervals_at(&run, 0..1, 100.0);

        // Smooth has not started ramping on the first hit.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 80.0, 160.0, 5.0, BY_SECONDS, 1.0, SMOOTH);
        run.play();
        run.render_hits(1);
        assert_eq!(run.hits[0].pos, 0);
        assert_eq!(run.hits[0].bpm, 80.0);
    }

    // Each edit from the running settings: (target, increment, step type, step value, curve).
    const TRAINER_EDITS: [(f64, f64, u32, f64, u32); 5] = [
        (88.0, 5.0, BY_BARS, 1.0, STEPPED),
        (160.0, 10.0, BY_BARS, 1.0, STEPPED),
        (160.0, 5.0, BY_SECONDS, 1.0, STEPPED),
        (160.0, 5.0, BY_BARS, 2.0, STEPPED),
        (160.0, 5.0, BY_BARS, 1.0, SMOOTH),
    ];

    fn run_with_edit_at_hit_20(edit: (f64, f64, u32, f64, u32)) -> Run {
        let (target, increment, step_type, step_value, curve) = edit;
        let run = run_to_hit(20);
        engine_set_trainer(run.ptr, true, 80.0, target, increment, step_type, step_value, curve);
        run
    }

    #[test]
    fn train_05_edit_keeps_live_bpm() {
        for edit in TRAINER_EDITS {
            let mut run = run_with_edit_at_hit_20(edit);
            run.render_hits(32);
            assert_hits_at(&run, 16..32, 85.0);
            assert_intervals_at(&run, 16..31, 85.0);
        }
    }

    #[test]
    fn train_06_edit_applies_on_beat_one() {
        let [target, increment, step_type, step_value, curve] = TRAINER_EDITS;

        // Target 88 stops the +5 from 85 at 88, and it stays there.
        let mut run = run_with_edit_at_hit_20(target);
        run.render_hits(49);
        assert_hits_at(&run, 32..49, 88.0);

        // Increment 10.
        let mut run = run_with_edit_at_hit_20(increment);
        run.render_hits(49);
        assert_hits_at(&run, 32..48, 95.0);
        assert_hits_at(&run, 48..49, 105.0);

        // Bars to seconds: the seconds start on the beat 1 that applies the edit.
        let mut run = run_with_edit_at_hit_20(step_type);
        run.render_hits(49);
        assert_hits_at(&run, 32..48, 85.0);
        assert_hits_at(&run, 48..49, 90.0);

        // Every 2 bars: the two bars count from the beat 1 that applies the edit.
        let mut run = run_with_edit_at_hit_20(step_value);
        run.render_hits(97);
        assert_hits_at(&run, 32..64, 85.0);
        assert_hits_at(&run, 64..96, 90.0);
        assert_hits_at(&run, 96..97, 95.0);

        // Stepped to Smooth: flat up to beat 1, rising after it.
        let mut run = run_with_edit_at_hit_20(curve);
        run.render_hits(36);
        assert_hits_at(&run, 21..33, 85.0);
        assert!(run.hits[33].bpm > 85.0);
        assert!(run.hits[34].bpm > run.hits[33].bpm);
    }

    #[test]
    fn train_07_start_edit_waits_for_play() {
        let mut run = run_to_hit(20);
        engine_set_trainer(run.ptr, true, 70.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.render_hits(33);
        assert_hits_at(&run, 16..32, 85.0);
        assert_hits_at(&run, 32..33, 90.0); // Still counting from the live BPM

        engine_stop(run.ptr);
        run.play();
        run.render_hits(2);
        assert_hits_at(&run, 0..2, 70.0);
        assert_intervals_at(&run, 0..1, 70.0);
    }

    #[test]
    fn train_08_disable_holds_live_bpm() {
        let mut run = run_to_hit(20);
        engine_set_trainer(run.ptr, false, 80.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.render_hits(16 * 5);
        assert_hits_at(&run, 16..16 * 5, 85.0);
        assert_intervals_at(&run, 16..16 * 5 - 1, 85.0);

        // A disable also drops an edit still waiting for beat 1.
        let mut run = run_to_hit(20);
        engine_set_trainer(run.ptr, true, 80.0, 160.0, 20.0, BY_BARS, 1.0, STEPPED);
        engine_set_trainer(run.ptr, false, 80.0, 160.0, 20.0, BY_BARS, 1.0, STEPPED);
        run.render_hits(16 * 3);
        assert_hits_at(&run, 16..16 * 3, 85.0);

        // Smooth stops rising at once, without waiting for beat 1.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 100.0, 200.0, 5.0, BY_SECONDS, 1.0, SMOOTH);
        run.play();
        run.render_hits(5);
        engine_set_trainer(run.ptr, false, 100.0, 200.0, 5.0, BY_SECONDS, 1.0, SMOOTH);
        run.render_hits(7);
        assert!(run.hits[4].bpm > 100.0);
        assert_eq!(run.hits[5].bpm, run.hits[6].bpm);
    }

    #[test]
    fn train_09_enable_continues_from_live_bpm() {
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, false, 80.0, 160.0, 5.0, BY_BARS, 2.0, STEPPED);
        run.play();
        run.render_hits(5);

        engine_set_trainer(run.ptr, true, 80.0, 160.0, 5.0, BY_BARS, 2.0, STEPPED);
        run.render_hits(49);
        assert_hits_at(&run, 0..48, 100.0); // Never Start BPM
        assert_intervals_at(&run, 0..48, 100.0);
        assert_hits_at(&run, 48..49, 105.0); // Two full bars after the settings applied on hit 16
    }

    fn load_preset(run: &Run, start: f64, step_type: u32, curve: u32) {
        engine_replace_trainer(run.ptr, true, start, 160.0, 5.0, step_type, 1.0, curve);
        engine_set_bpm(run.ptr, start);
    }

    #[test]
    fn train_17_preset_load_replaces_trainer() {
        // Loaded one step before beat 1 of a stepped run: 100 must be heard on beat 1.
        let mut run = run_to_hit(14);
        load_preset(&run, 100.0, BY_BARS, STEPPED);
        run.render_hits(17);
        assert_hits_at(&run, 15..17, 100.0);

        // A running Smooth ramp must stop at once.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 90.0, 160.0, 20.0, BY_SECONDS, 1.0, SMOOTH);
        run.play();
        run.render_hits(7);
        load_preset(&run, 100.0, BY_BARS, STEPPED);
        run.render_hits(17);
        assert_hits_at(&run, 7..17, 100.0);

        // Settings still waiting for beat 1 are dropped with the old Trainer.
        let mut run = run_to_hit(5);
        engine_set_trainer(run.ptr, true, 80.0, 160.0, 40.0, BY_BARS, 1.0, STEPPED);
        load_preset(&run, 100.0, BY_BARS, STEPPED);
        run.render_hits(33);
        assert_hits_at(&run, 6..32, 100.0);
        assert_hits_at(&run, 32..33, 105.0);
    }

    #[test]
    fn train_18_preset_counts_a_full_bar() {
        let mut run = run_to_hit(14);
        load_preset(&run, 100.0, BY_BARS, STEPPED);
        run.render_hits(33);
        assert_hits_at(&run, 15..32, 100.0);
        assert_intervals_at(&run, 15..31, 100.0);
        assert_hits_at(&run, 32..33, 105.0);
    }

    fn live_bpm(run: &Run) -> f64 {
        unsafe { (*run.ptr).clock.bpm }
    }

    #[test]
    fn train_19_new_schedule_counts_from_beat_one() {
        // Seconds to bars: the finished bar belongs to the old schedule.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 5.0, BY_SECONDS, 60.0, STEPPED);
        run.play();
        run.render_hits(21);
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.render_hits(49);
        assert_hits_at(&run, 0..48, 100.0);
        assert_hits_at(&run, 48..49, 105.0);

        // Smooth to Stepped: beat 1 must not add a full increment.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 5.0, BY_SECONDS, 3600.0, SMOOTH);
        run.play();
        run.render_hits(21);
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.render_hits(33);
        assert!(live_bpm(&run) < 100.1, "live BPM {}", live_bpm(&run));
        run.render_hits(49);
        assert!(live_bpm(&run) > 104.9 && live_bpm(&run) < 105.1, "live BPM {}", live_bpm(&run));
    }

    #[test]
    fn train_20_value_edit_keeps_interval_progress() {
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 5.0, BY_BARS, 2.0, STEPPED);
        run.play();
        run.render_hits(21);
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 10.0, BY_BARS, 2.0, STEPPED);
        run.render_hits(33);
        assert_hits_at(&run, 0..32, 100.0);
        assert_hits_at(&run, 32..33, 110.0);
    }

    #[test]
    fn train_21_settings_before_first_hit_apply_on_it() {
        // A replacement must not make beat 1 of bar 2 skip the finished first bar.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 5.0, BY_SECONDS, 60.0, STEPPED);
        run.play();
        engine_replace_trainer(run.ptr, true, 100.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.render_hits(33);
        assert_hits_at(&run, 0..16, 100.0);
        assert_hits_at(&run, 16..32, 105.0);
        assert_hits_at(&run, 32..33, 110.0);

        // Pending settings apply on the first hit, not a bar late.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.play();
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 10.0, BY_BARS, 1.0, STEPPED);
        run.render_hits(17);
        assert_hits_at(&run, 0..16, 100.0);
        assert_hits_at(&run, 16..17, 110.0);

        // An enabled Trainer plays that hit at Start BPM, set by a new value or by the enable.
        for was_enabled in [true, false] {
            let mut run = Run::new(100.0, &[1; 16]);
            engine_set_trainer(run.ptr, was_enabled, 100.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
            run.play();
            engine_set_trainer(run.ptr, true, 80.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
            run.render_hits(17);
            assert_eq!(run.hits[0].pos, 0);
            assert_hits_at(&run, 0..16, 80.0);
            assert_intervals_at(&run, 0..16, 80.0);
            assert_hits_at(&run, 16..17, 85.0);
        }

        // A Smooth Trainer on the way out does not ramp before that hit.
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 100.0, 200.0, 5.0, BY_SECONDS, 1.0, SMOOTH);
        run.play();
        engine_set_trainer(run.ptr, true, 100.0, 200.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.render_hits(1);
        assert_eq!(run.hits[0].bpm, 100.0);
    }

    #[test]
    fn train_unknown_mode_keeps_active_settings() {
        let run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        engine_set_trainer(run.ptr, true, 90.0, 150.0, 2.0, 2, 1.0, STEPPED);
        engine_replace_trainer(run.ptr, true, 90.0, 150.0, 2.0, BY_BARS, 1.0, 2);
        let trainer = unsafe { (*run.ptr).trainer.settings };
        assert_eq!(trainer.start_bpm, 100.0);
        assert_eq!(trainer.target_bpm, 160.0);
        assert_eq!(trainer.increment, 5.0);
    }

    #[test]
    fn train_enable_counts_a_full_interval() {
        let mut run = Run::new(100.0, &[1; 16]);
        engine_set_trainer(run.ptr, false, 100.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.play();
        run.render_hits(5);
        engine_set_trainer(run.ptr, true, 100.0, 160.0, 5.0, BY_BARS, 1.0, STEPPED);
        run.render_hits(33);
        assert_hits_at(&run, 0..32, 100.0);
        assert_hits_at(&run, 32..33, 105.0);
    }

    #[test]
    fn train_start_edit_keeps_counters() {
        let mut run = Run::new(120.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 120.0, 160.0, 5.0, BY_BARS, 2.0, STEPPED);
        run.play();
        run.render_hits(21);
        engine_set_trainer(run.ptr, true, 90.0, 160.0, 5.0, BY_BARS, 2.0, STEPPED);
        run.render_hits(33);
        assert_hits_at(&run, 0..32, 120.0);
        assert_hits_at(&run, 32..33, 125.0);
    }

    #[test]
    fn train_11_continues_from_slider_value() {
        let mut run = run_to_hit(8);
        engine_set_bpm(run.ptr, 120.0);
        run.render_hits(33);
        assert_hits_at(&run, 9..16, 120.0);
        assert_intervals_at(&run, 9..16, 120.0);
        assert_hits_at(&run, 16..32, 125.0);
        assert_hits_at(&run, 32..33, 130.0);
    }

    #[test]
    fn train_unchanged_settings_keep_counters() {
        // Sent in bar 2, the same settings must not delay the increment that ends it.
        let mut run = Run::new(120.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 120.0, 160.0, 5.0, BY_BARS, 2.0, STEPPED);
        run.play();
        run.render_hits(21);
        engine_set_trainer(run.ptr, true, 120.0, 160.0, 5.0, BY_BARS, 2.0, STEPPED);
        run.render_hits(33);
        assert_hits_at(&run, 0..32, 120.0);
        assert_hits_at(&run, 32..33, 125.0);

        let mut run = Run::new(120.0, &[1; 16]);
        engine_set_trainer(run.ptr, true, 120.0, 160.0, 5.0, BY_SECONDS, 3.0, STEPPED);
        run.play();
        run.render_hits(21);
        engine_set_trainer(run.ptr, true, 120.0, 160.0, 5.0, BY_SECONDS, 3.0, STEPPED);
        run.render_hits(33);
        assert_hits_at(&run, 0..32, 120.0);
        assert_hits_at(&run, 32..33, 125.0);
    }

    #[test]
    fn test_engine_init() {
        let engine = Engine::new(44100.0);
        assert_eq!(engine.clock.bpm, 120.0);
        assert_eq!(engine.is_playing, false);
        
        // Verify recalc_tempo correctly computes step size
        // At 120 BPM: 2 beats/sec -> 8 steps/sec. At 44100Hz, samples per step = 44100 / 8 = 5512.5
        assert_eq!(engine.clock.samples_per_step, 5512.5);
    }

    #[test]
    fn test_click_synthesis() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        engine.pattern.tracks[0].steps[0] = 2; // Accent click on step 0
        
        let mut buf_l = vec![0.0f32; 100];
        let mut buf_r = vec![0.0f32; 100];
        
        engine.fill_buffers(&mut buf_l, &mut buf_r);
        // Left buffer should contain non-zero synthesized sine samples (sin(0.0) is 0.0, so buf_l[0] is 0.0, but buf_l[1] is non-zero)
        assert!(buf_l[1] != 0.0);
        assert_eq!(buf_l[1], buf_r[1]); // mono click is centered (* 0.5 to both)
    }

    #[test]
    fn test_drum_sample_trigger() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        engine.pattern.tracks[1].steps[0] = 1; // Trigger kick drum on step 0
        
        let left_sample = vec![0.5f32, 1.0f32, 0.5f32];
        let right_sample = vec![-0.5f32, -1.0f32, -0.5f32];
        
        engine.drums.samples[1] = Some(Sample {
            left_channel: left_sample,
            right_channel: right_sample,
        });

        let mut buf_l = vec![0.0f32; 3];
        let mut buf_r = vec![0.0f32; 3];
        
        engine.fill_buffers(&mut buf_l, &mut buf_r);
        
        // At 44100Hz and 120BPM, the step duration is 5512.5 samples.
        // It triggers step 0 immediately since current step starts at 0.0 and triggers.
        // Let's verify that the output contains the sample multiplied by the playback volume (1.0 for kick)
        // and by the normal dynamic
        assert_eq!(buf_l[0], 0.5 * GAIN_NORMAL);
        assert_eq!(buf_r[0], -0.5 * GAIN_NORMAL);
        assert_eq!(buf_l[1], 1.0 * GAIN_NORMAL);
        assert_eq!(buf_r[1], -1.0 * GAIN_NORMAL);
    }

    // The peak a drum track plays one full-scale frame at, on a step of this value
    fn drum_peak(track: u32, value: u8) -> f32 {
        let run = Run::new(120.0, &[0; 16]);
        let sample = [1.0f32, 1.0];
        engine_load_sample(run.ptr, track, sample.as_ptr(), sample.as_ptr(), sample.len());
        let mut grid = [0u8; 16];
        grid[0] = value;
        engine_update_grid(run.ptr, track, grid.as_ptr(), 16);
        engine_start(run.ptr);
        let (left, _) = stereo_output(run.ptr, 2);
        left[0]
    }

    #[test]
    fn kit_02_every_drum_track_plays_its_sample() {
        let levels = [1.0, 0.9, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.9, 0.9];
        for track in 1..=10u32 {
            let expected = levels[track as usize - 1] * GAIN_ACCENT;
            assert_eq!(drum_peak(track, 2), expected, "track {}", track);
        }
    }

    #[test]
    fn kit_02_tracks_11_and_12_play_their_samples() {
        assert_eq!(drum_peak(11, 2), 0.9 * GAIN_ACCENT);
        assert_eq!(drum_peak(12, 2), 0.9 * GAIN_ACCENT);
    }

    #[test]
    fn dyn_01_step_values_set_the_gain() {
        assert_eq!(drum_peak(1, 3), 0.3);
        assert_eq!(drum_peak(1, 1), 0.7);
        assert_eq!(drum_peak(1, 2), 1.0);
        // A level other than the kick's scales with its piece
        assert_eq!(drum_peak(2, 3), 0.9 * 0.3);
        assert_eq!(drum_peak(8, 3), 0.7 * 0.3);
    }

    #[test]
    fn dyn_01_a_voice_keeps_the_gain_of_its_own_step() {
        let run = Run::new(120.0, &[0; 16]);
        let sample = vec![1.0f32; 20000];
        engine_load_sample(run.ptr, 1, sample.as_ptr(), sample.as_ptr(), sample.len());
        let mut grid = [0u8; 16];
        grid[0] = 3;
        grid[1] = 2;
        engine_update_grid(run.ptr, 1, grid.as_ptr(), 16);
        engine_start(run.ptr);
        let frames = step_samples(SR, 120.0) as usize + 100;
        let (left, _) = stereo_output(run.ptr, frames);
        assert_eq!(left[10], 0.3);
        assert_eq!(left[frames - 10], 1.0);
    }

    // Frames that sound in an Open Hat started on step 0, with these Hi-hat steps
    fn open_hat_frames(hi_hat_grid: &[u8; 16]) -> Vec<usize> {
        let run = Run::new(120.0, &[0; 16]);
        let open_hat = vec![1.0f32; 20000];
        engine_load_sample(run.ptr, 4, open_hat.as_ptr(), open_hat.as_ptr(), open_hat.len());
        let mut grid = [0u8; 16];
        grid[0] = 1;
        engine_update_grid(run.ptr, 4, grid.as_ptr(), 16);
        engine_update_grid(run.ptr, 3, hi_hat_grid.as_ptr(), 16); // No Hi-hat sample: only its choke acts
        engine_start(run.ptr);
        let (left, right) = stereo_output(run.ptr, 20000);
        sounding_frames(&left, &right)
    }

    #[test]
    fn kit_04_hi_hat_chokes_open_hat() {
        let mut hi_hat = [0u8; 16];
        hi_hat[2] = 1;
        let cut_at = 2.0 * step_samples(SR, 120.0);
        let sounding = open_hat_frames(&hi_hat);
        assert_within_one_sample(*sounding.last().unwrap() as f64 + 1.0, cut_at, "open hat cut");

        // With no Hi-hat step it rings to its end
        assert_eq!(*open_hat_frames(&[0; 16]).last().unwrap(), 19999);
    }

    #[test]
    fn kit_04_another_piece_does_not_choke_open_hat() {
        let run = Run::new(120.0, &[0; 16]);
        let open_hat = vec![1.0f32; 20000];
        engine_load_sample(run.ptr, 4, open_hat.as_ptr(), open_hat.as_ptr(), open_hat.len());
        let mut grid = [0u8; 16];
        grid[0] = 1;
        engine_update_grid(run.ptr, 4, grid.as_ptr(), 16);
        let mut ride = [0u8; 16];
        ride[2] = 1;
        engine_update_grid(run.ptr, 5, ride.as_ptr(), 16);
        engine_start(run.ptr);
        let (left, right) = stereo_output(run.ptr, 20000);
        assert_eq!(*sounding_frames(&left, &right).last().unwrap(), 19999);
    }

    #[test]
    fn kit_05_output_stays_in_range() {
        for sign in [1.0f32, -1.0] {
            let grid = [2u8; 16];
            let run = Run::new(120.0, &grid);
            let sample = [sign; 64];
            for track in 1..=10u32 {
                engine_load_sample(run.ptr, track, sample.as_ptr(), sample.as_ptr(), sample.len());
                engine_update_grid(run.ptr, track, grid.as_ptr(), 16);
            }
            engine_start(run.ptr);
            let (left, right) = stereo_output(run.ptr, 64);
            assert_eq!(left[0], sign, "every voice at once reaches full scale and stops there");
            assert_eq!(right[0], sign);
            assert!(left.iter().chain(right.iter()).all(|frame| frame.abs() <= 1.0));
        }
    }

    #[test]
    fn kit_07_click_needs_no_drum_samples() {
        let mut click = [0u8; 16];
        click[0] = 2;
        let run = Run::new(120.0, &click); // The harness loads only the click, on slot 0
        for track in 1..=10u32 {
            engine_update_grid(run.ptr, track, click.as_ptr(), 16);
        }
        engine_start(run.ptr);
        let (left, _) = stereo_output(run.ptr, 1);
        assert_eq!(left[0], 1.0);
    }

    #[test]
    fn dyn_01_an_unknown_value_plays_normal() {
        assert_eq!(drum_peak(1, 9), 0.7);
    }

    // --- The take bank: every take holds one level, so the output names the take that played ---

    const TAKE_FRAMES: usize = 64; // Far shorter than a step, so hits never overlap

    fn take_level(dynamic: u32, take: u32) -> f32 {
        0.1 * (dynamic + 1) as f32 + 0.02 * (take + 1) as f32
    }

    fn load_take(run: &Run, track: u32, dynamic: u32, take: u32) {
        let left = [take_level(dynamic, take); TAKE_FRAMES];
        let right = [-take_level(dynamic, take); TAKE_FRAMES];
        engine_load_take(run.ptr, track, dynamic, take, left.as_ptr(), right.as_ptr(), TAKE_FRAMES);
    }

    fn load_bank(run: &Run, track: u32) {
        for dynamic in 0..3 {
            for take in 0..3 {
                load_take(run, track, dynamic, take);
            }
        }
    }

    // What each of the steps played, read a few frames into the step
    fn played_steps(run: &Run, steps: usize) -> Vec<f32> {
        let step = step_samples(SR, 120.0);
        let (left, _) = stereo_output(run.ptr, (steps as f64 * step) as usize + 10);
        (0..steps).map(|k| left[(k as f64 * step).ceil() as usize + 2]).collect()
    }

    fn set_steps(run: &Run, track: u32, steps: &[u8]) {
        engine_update_grid(run.ptr, track, steps.as_ptr(), steps.len());
    }

    #[test]
    fn hk_02_kick_and_toms_map_their_dynamics() {
        const GHOST: u32 = 0;
        const NORMAL: u32 = 1;
        const ACCENT: u32 = 2;
        for track in [1, 9, 10, 11, 12] {
            for (step, dynamic) in [(3u8, GHOST), (1, NORMAL), (2, ACCENT)] {
                let run = Run::new(120.0, &[0; 16]);
                load_bank(&run, track);
                let mut grid = [0u8; 16];
                grid[0] = step;
                set_steps(&run, track, &grid);
                engine_start(run.ptr);
                let (left, right) = stereo_output(run.ptr, 2);
                assert_eq!(left[0], take_level(dynamic, 0), "track {} step {}", track, step);
                assert_eq!(right[0], -take_level(dynamic, 0), "track {} step {}", track, step);
            }
        }
    }

    #[test]
    fn hk_06_bank_hit_has_no_step_gain() {
        // Kick, Snare and a tom: the track's mix level does not touch a bank hit either
        for track in [1, 2, 9, 11] {
            for step in [3u8, 1, 2] {
                let run = Run::new(120.0, &[0; 16]);
                let left = [0.5f32; TAKE_FRAMES];
                let right = [-0.25f32; TAKE_FRAMES];
                for dynamic in 0..3 {
                    engine_load_take(run.ptr, track, dynamic, 0, left.as_ptr(), right.as_ptr(), TAKE_FRAMES);
                }
                let mut grid = [0u8; 16];
                grid[0] = step;
                set_steps(&run, track, &grid);
                engine_start(run.ptr);
                let (out_l, out_r) = stereo_output(run.ptr, 2);
                assert_eq!(out_l[0], 0.5, "track {} step {}", track, step);
                assert_eq!(out_r[0], -0.25, "track {} step {}", track, step);
            }
        }
    }

    #[test]
    fn hk_08_single_sample_keeps_its_gains() {
        // Hi-hat, Open Hat, Ride, Ride Bell, Crash and China, all at the level 0.7
        for track in 3..=8 {
            assert_eq!(drum_peak(track, 3), 0.7 * 0.3, "track {}", track);
            assert_eq!(drum_peak(track, 1), 0.7 * 0.7, "track {}", track);
            assert_eq!(drum_peak(track, 2), 0.7 * 1.0, "track {}", track);
        }

        // A bank on another track changes nothing
        let run = Run::new(120.0, &[0; 16]);
        load_bank(&run, 1);
        let sample = [1.0f32; 2];
        engine_load_sample(run.ptr, 3, sample.as_ptr(), sample.as_ptr(), sample.len());
        let mut grid = [0u8; 16];
        grid[0] = 3;
        set_steps(&run, 3, &grid);
        engine_start(run.ptr);
        let (left, _) = stereo_output(run.ptr, 2);
        assert_eq!(left[0], 0.7 * 0.3);
    }

    #[test]
    fn hk_04_takes_rotate_per_dynamic() {
        let takes = |dynamic: u32, order: [u32; 4]| order.map(|take| take_level(dynamic, take));

        // One dynamic plays 1, 2, 3, 1
        let run = Run::new(120.0, &[0; 16]);
        load_bank(&run, 2);
        set_steps(&run, 2, &[1; 16]);
        engine_start(run.ptr);
        assert_eq!(played_steps(&run, 4), takes(1, [0, 1, 2, 0]));

        // Two dynamics in turn keep a rotation each
        let run = Run::new(120.0, &[0; 16]);
        load_bank(&run, 2);
        let mut grid = [0u8; 16];
        for step in 0..8 {
            grid[step] = if step % 2 == 0 { 3 } else { 2 };
        }
        set_steps(&run, 2, &grid);
        engine_start(run.ptr);
        let played = played_steps(&run, 8);
        let of = |first: usize| [played[first], played[first + 2], played[first + 4], played[first + 6]];
        assert_eq!(of(0), takes(0, [0, 1, 2, 0]));
        assert_eq!(of(1), takes(2, [0, 1, 2, 0]));

        // Two tracks in turn keep a rotation each
        let run = Run::new(120.0, &[0; 16]);
        load_bank(&run, 1);
        load_bank(&run, 2);
        let mut kick = [0u8; 16];
        let mut snare = [0u8; 16];
        for step in 0..8 {
            if step % 2 == 0 { kick[step] = 1 } else { snare[step] = 1 }
        }
        set_steps(&run, 1, &kick);
        set_steps(&run, 2, &snare);
        engine_start(run.ptr);
        assert_eq!(played_steps(&run, 4), [
            take_level(1, 0), take_level(1, 0), take_level(1, 1), take_level(1, 1),
        ]);
    }

    #[test]
    fn hk_05_play_restarts_the_takes() {
        let run = Run::new(120.0, &[0; 16]);
        load_bank(&run, 1);
        load_bank(&run, 2);
        let mut grid = [0u8; 16];
        grid[..4].copy_from_slice(&[3, 1, 2, 1]);
        set_steps(&run, 1, &grid);
        grid[..4].copy_from_slice(&[0, 0, 0, 0]);
        grid[4..8].copy_from_slice(&[3, 1, 2, 1]);
        set_steps(&run, 2, &grid);

        let first_takes = [
            take_level(0, 0), take_level(1, 0), take_level(2, 0), take_level(1, 1),
            take_level(0, 0), take_level(1, 0), take_level(2, 0), take_level(1, 1),
        ];
        engine_start(run.ptr);
        assert_eq!(played_steps(&run, 8), first_takes);
        engine_stop(run.ptr);

        // The same 8 steps, from take 1 on both tracks and all 3 dynamics
        engine_start(run.ptr);
        assert_eq!(played_steps(&run, 8), first_takes);
    }

    #[test]
    fn hk_33_loop_keeps_the_rotation() {
        let run = Run::new(120.0, &[0; 4]); // A bar of 4 steps
        load_bank(&run, 1);
        set_steps(&run, 1, &[1, 0, 0, 1]);
        engine_start(run.ptr);
        let played = played_steps(&run, 12);
        let hits: Vec<f32> = played.into_iter().filter(|&level| level != 0.0).collect();
        assert_eq!(hits, [0, 1, 2, 0, 1, 2].map(|take| take_level(1, take)));
    }

    #[test]
    fn hk_34_changed_dynamic_uses_its_next_take() {
        let run = Run::new(120.0, &[0; 16]);
        load_bank(&run, 2);
        set_steps(&run, 2, &[1; 16]);
        engine_start(run.ptr);
        let step = step_samples(SR, 120.0);
        let (left, _) = stereo_output(run.ptr, (1.5 * step) as usize); // Steps 0 and 1
        assert_eq!(left[2], take_level(1, 0));
        assert_eq!(left[step.ceil() as usize + 2], take_level(1, 1));

        // The step's next hit plays the new dynamic's next take: its first
        set_steps(&run, 2, &[2; 16]);
        let (left, _) = stereo_output(run.ptr, step as usize);
        assert_eq!(left.into_iter().find(|&level| level != 0.0), Some(take_level(2, 0)));

        // Back on the old dynamic, its rotation goes on from where it stopped
        set_steps(&run, 2, &[1; 16]);
        let (left, _) = stereo_output(run.ptr, step as usize);
        assert_eq!(left.into_iter().find(|&level| level != 0.0), Some(take_level(1, 2)));
    }

    // What a track plays when only these (dynamic, take) slots loaded, for steps of one value
    fn played_with(loaded: &[(u32, u32)], step: u8, hits: usize) -> Vec<f32> {
        let run = Run::new(120.0, &[0; 16]);
        for &(dynamic, take) in loaded {
            load_take(&run, 2, dynamic, take);
        }
        set_steps(&run, 2, &[step; 16]);
        engine_start(run.ptr);
        played_steps(&run, hits)
    }

    fn levels(takes: &[(u32, u32)]) -> Vec<f32> {
        takes.iter().map(|&(dynamic, take)| take_level(dynamic, take)).collect()
    }

    #[test]
    fn hk_12_missing_take_is_skipped() {
        // Any one take missing: the next loaded take plays
        assert_eq!(played_with(&[(1, 1), (1, 2)], 1, 4), levels(&[(1, 1), (1, 2), (1, 1), (1, 2)]));
        assert_eq!(played_with(&[(1, 0), (1, 2)], 1, 4), levels(&[(1, 0), (1, 2), (1, 0), (1, 2)]));
        assert_eq!(played_with(&[(1, 0), (1, 1)], 1, 4), levels(&[(1, 0), (1, 1), (1, 0), (1, 1)]));

        // One take left plays every hit
        assert_eq!(played_with(&[(1, 2)], 1, 3), levels(&[(1, 2), (1, 2), (1, 2)]));
    }

    #[test]
    fn hk_13_missing_dynamic_falls_back() {
        let ghost = 3;
        let normal = 1;
        let accent = 2;

        // The other dynamics, in the order Normal, Accent, Ghost
        let all_but = |missing: u32| -> Vec<(u32, u32)> {
            (0..3).filter(|&dynamic| dynamic != missing).map(|dynamic| (dynamic, 0)).collect()
        };
        assert_eq!(played_with(&all_but(0), ghost, 1), levels(&[(1, 0)]));
        assert_eq!(played_with(&all_but(2), accent, 1), levels(&[(1, 0)]));
        assert_eq!(played_with(&all_but(1), normal, 1), levels(&[(2, 0)]));
        assert_eq!(played_with(&all_but(1), ghost, 1), levels(&[(0, 0)])); // Its own takes come first
        assert_eq!(played_with(&[(2, 0)], ghost, 1), levels(&[(2, 0)]));
        assert_eq!(played_with(&[(0, 0)], accent, 1), levels(&[(0, 0)]));

        // The dynamic it falls back to keeps rotating
        let normals = [(1, 0), (1, 1), (1, 2)];
        assert_eq!(played_with(&normals, ghost, 4), levels(&[(1, 0), (1, 1), (1, 2), (1, 0)]));
    }

    #[test]
    fn hk_14_track_with_no_takes_is_silent() {
        // The Snare has a step on every hit and nothing loaded
        assert_eq!(played_with(&[], 1, 3), [0.0, 0.0, 0.0]);

        // The Kick plays on, alone
        let run = Run::new(120.0, &[0; 16]);
        load_bank(&run, 1);
        set_steps(&run, 1, &[1; 16]);
        set_steps(&run, 2, &[1; 16]);
        engine_start(run.ptr);
        assert_eq!(played_steps(&run, 3), levels(&[(1, 0), (1, 1), (1, 2)]));
    }

    // A track on which step 0 starts a 0.5 take of these frames and step 1 replaces it with silence
    fn replaced_take(sample_rate: f32, frames: usize) -> Run {
        let run = Run::at_rate(sample_rate, 120.0, &[0; 16]);
        let left = vec![0.5f32; frames];
        let right = vec![-0.5f32; frames];
        let silence = [0.0f32; TAKE_FRAMES];
        engine_load_take(run.ptr, 2, 1, 0, left.as_ptr(), right.as_ptr(), frames);
        engine_load_take(run.ptr, 2, 1, 1, silence.as_ptr(), silence.as_ptr(), TAKE_FRAMES);
        let mut grid = [0u8; 16];
        grid[..2].fill(1);
        set_steps(&run, 2, &grid);
        run
    }

    #[test]
    fn hk_07_replaced_hit_fades_over_5_ms() {
        for sample_rate in [44100.0, 48000.0] {
            let hit = step_samples(sample_rate, 120.0).ceil() as usize;
            let fade = (sample_rate * 0.005).round() as usize; // HK-07: 5 ms
            let run = replaced_take(sample_rate, 2 * hit);
            engine_start(run.ptr);
            let (left, right) = stereo_output(run.ptr, hit + 2 * fade);

            assert!(left[..hit].iter().all(|&frame| frame == 0.5));
            for frame in 0..fade {
                let ramp = 1.0 - frame as f32 / fade as f32;
                assert!((left[hit + frame] - 0.5 * ramp).abs() < 1e-6, "frame {}", frame);
                assert!((right[hit + frame] + 0.5 * ramp).abs() < 1e-6, "frame {}", frame);
            }
            assert_eq!(*sounding_frames(&left, &right).last().unwrap(), hit + fade - 1);
        }

        // A single sample fades from its own level, under the hit that replaces it
        let run = Run::new(120.0, &[0; 16]);
        let sample = vec![0.5f32; 20000];
        engine_load_sample(run.ptr, 1, sample.as_ptr(), sample.as_ptr(), sample.len());
        let mut grid = [0u8; 16];
        grid[..2].copy_from_slice(&[2, 3]);
        set_steps(&run, 1, &grid);
        engine_start(run.ptr);
        let hit = step_samples(SR, 120.0).ceil() as usize;
        let (left, _) = stereo_output(run.ptr, hit + 1000);
        let (old, new) = (0.5 * GAIN_ACCENT, 0.5 * GAIN_GHOST);
        assert_eq!(left[hit], old + new);
        let fade = (SR * 0.005).round();
        assert!((left[hit + 110] - (old * (1.0 - 110.0 / fade) + new)).abs() < 1e-6);
        assert_eq!(left[hit + 500], new);

        // A hit that ends during the fade stops there
        let hit = step_samples(SR, 120.0).ceil() as usize;
        let run = replaced_take(SR, hit + 50);
        engine_start(run.ptr);
        let (left, right) = stereo_output(run.ptr, hit + 1000);
        assert_eq!(*sounding_frames(&left, &right).last().unwrap(), hit + 49);
    }

    #[test]
    fn hk_36_click_restarts_with_no_fade() {
        let hit = step_samples(SR, 120.0).ceil() as usize;
        let run = Run::new(120.0, &[0; 16]);
        let sample: Vec<f32> = (0..4 * hit).map(|frame| 0.2 + 0.5 * frame as f32 / (4 * hit) as f32).collect();
        engine_load_sample(run.ptr, 0, sample.as_ptr(), sample.as_ptr(), sample.len());
        engine_set_click_mode(run.ptr, 1);
        let mut grid = [0u8; 16];
        grid[..2].fill(1);
        set_steps(&run, 0, &grid);
        engine_start(run.ptr);

        let (left, _) = stereo_output(run.ptr, 2 * hit);
        assert!(left[0] > 0.0);
        assert!(left[hit] < left[hit - 1]); // It starts over on the very frame of the hit
        for frame in 0..hit {
            assert_eq!(left[hit + frame], left[frame], "frame {}", frame); // Nothing of the last one remains
        }
    }

    #[test]
    fn hk_07_a_finished_voice_adds_nothing() {
        let hit = step_samples(SR, 120.0).ceil() as usize;

        // Long gone, and ending on the very frame of the next hit
        for frames in [1000, hit] {
            let run = replaced_take(SR, frames);
            engine_start(run.ptr);
            let (left, right) = stereo_output(run.ptr, hit + 1000);
            assert_eq!(*sounding_frames(&left, &right).last().unwrap(), frames - 1);
            assert!(unsafe { &*run.ptr }.drums.fading.iter().all(Option::is_none));
        }
    }

    #[test]
    fn hk_07_open_hat_cut_stays_hard() {
        // The Hi-hat cuts it on the frame, with no fade after
        let mut hi_hat = [0u8; 16];
        hi_hat[2] = 1;
        let cut_at = (2.0 * step_samples(SR, 120.0)).ceil() as usize;
        assert_eq!(*open_hat_frames(&hi_hat).last().unwrap(), cut_at - 1);

        // A new Open Hat on the Hi-hat's step starts clean, over nothing
        let run = Run::new(120.0, &[0; 16]);
        let open_hat = vec![1.0f32; 20000];
        engine_load_sample(run.ptr, 4, open_hat.as_ptr(), open_hat.as_ptr(), open_hat.len());
        let mut grid = [0u8; 16];
        grid[0] = 1;
        grid[2] = 1;
        set_steps(&run, 4, &grid);
        set_steps(&run, 3, &hi_hat);
        engine_start(run.ptr);
        let (left, _) = stereo_output(run.ptr, cut_at + 1000);
        assert_eq!(left[cut_at], 0.7 * GAIN_NORMAL);
    }

    #[test]
    fn hk_07_stop_and_play_clear_the_fade() {
        let hit = step_samples(SR, 120.0).ceil() as usize;
        let fading_after = |act: extern "C" fn(*mut Engine)| {
            let run = replaced_take(SR, 2 * hit);
            engine_start(run.ptr);
            stereo_output(run.ptr, hit + 10);
            assert!(unsafe { &*run.ptr }.drums.fading[2].is_some());
            act(run.ptr);
            unsafe { &*run.ptr }.drums.fading[2].is_some()
        };
        assert!(!fading_after(engine_stop));
        assert!(!fading_after(engine_start));
    }

    #[test]
    fn a_take_trims_its_onset_like_a_sample() {
        let run = Run::new(120.0, &[0; 16]);
        let take = [0.0f32, 0.001, 0.5, 1.0];
        engine_load_take(run.ptr, 2, 1, 0, take.as_ptr(), take.as_ptr(), take.len());
        let stored = unsafe { &*run.ptr }.drums.bank[2][1][0].as_ref().unwrap();
        assert_eq!(stored.left_channel, vec![0.5, 1.0]);
        assert_eq!(stored.right_channel, vec![0.5, 1.0]);
    }

    #[test]
    fn a_take_outside_the_bank_is_refused() {
        let run = Run::new(120.0, &[0; 16]);
        let take = [1.0f32];
        engine_load_take(run.ptr, 13, 0, 0, take.as_ptr(), take.as_ptr(), 1);
        engine_load_take(run.ptr, 1, 3, 0, take.as_ptr(), take.as_ptr(), 1);
        engine_load_take(run.ptr, 1, 0, 3, take.as_ptr(), take.as_ptr(), 1);
        engine_load_take(std::ptr::null_mut(), 1, 0, 0, take.as_ptr(), take.as_ptr(), 1);
        engine_load_take(run.ptr, 1, 0, 0, std::ptr::null(), take.as_ptr(), 1);
        engine_load_take(run.ptr, 1, 0, 0, take.as_ptr(), std::ptr::null(), 1);
        assert!(unsafe { &*run.ptr }.drums.bank.iter().flatten().flatten().all(Option::is_none));
    }

    #[test]
    fn test_trainer_stepped_measures() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // 120 BPM, target 130 BPM, increment 5.0, stepped curve, measures mode (step_value = 2.0 measures)
        engine.trainer.settings.enabled = true;
        engine.trainer.settings.start_bpm = 120.0;
        engine.trainer.settings.target_bpm = 130.0;
        engine.trainer.settings.increment = 5.0;
        engine.trainer.settings.step_type = StepType::Bars;
        engine.trainer.settings.step_value = 2.0;
        engine.trainer.settings.curve = Curve::Stepped;

        // 1 measure has 16 steps, so 2 measures have 32 steps.
        // The first hit of a run finishes no measure. The next step 0 is trigger 17, and the
        // one after it, trigger 33, is the beat 1 that ends the second measure.
        for _ in 0..32 {
            engine.trigger_step();
            assert_eq!(engine.clock.bpm, 120.0); // Not incremented yet
        }
        
        // Trigger 33 fires beat 1 at the new BPM
        engine.trigger_step();
        assert_eq!(engine.clock.bpm, 125.0); // Incremented by 5.0
        assert_eq!(engine.last_tick_bpm, 125.0);

        // Complete another 2 measures (32 more triggers)
        for _ in 0..31 {
            engine.trigger_step();
            assert_eq!(engine.clock.bpm, 125.0);
        }
        engine.trigger_step();
        assert_eq!(engine.clock.bpm, 130.0); // Incremented to target

        // Complete another 2 measures: should clamp at target (130)
        for _ in 0..32 {
            engine.trigger_step();
        }
        assert_eq!(engine.clock.bpm, 130.0); // Clamped at target
    }

    #[test]
    fn test_trainer_stepped_seconds() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // 120 BPM, target 130 BPM, increment 5.0, stepped curve, seconds mode (step_value = 0.01 seconds -> 441 samples)
        engine.trainer.settings.enabled = true;
        engine.trainer.settings.start_bpm = 120.0;
        engine.trainer.settings.target_bpm = 130.0;
        engine.trainer.settings.increment = 5.0;
        engine.trainer.settings.step_type = StepType::Seconds;
        engine.trainer.settings.step_value = 0.01;
        engine.trainer.settings.curve = Curve::Stepped;

        // The first hit starts the run, so the 441 samples pass with BPM unchanged.
        let mut buf_l = vec![0.0f32; 441];
        let mut buf_r = vec![0.0f32; 441];
        engine.fill_buffers(&mut buf_l, &mut buf_r);
        assert_eq!(engine.clock.bpm, 120.0);

        // The increment still waits for beat 1, 88200 samples in (2 s at 120 BPM).
        let mut rest_l = vec![0.0f32; 88200 - 441];
        let mut rest_r = vec![0.0f32; 88200 - 441];
        engine.fill_buffers(&mut rest_l, &mut rest_r);
        assert_eq!(engine.clock.bpm, 120.0);

        // Process 1 more sample to reach beat 1
        let mut single_l = vec![0.0f32; 1];
        let mut single_r = vec![0.0f32; 1];
        engine.fill_buffers(&mut single_l, &mut single_r);
        assert_eq!(engine.clock.bpm, 125.0); // Incremented by 5.0
        assert_eq!(engine.last_tick_index, 0);
    }

    #[test]
    fn test_trainer_smooth_seconds() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // 120 BPM, target 130 BPM, increment 5.0, smooth curve, seconds mode (step_value = 1.0 second -> 44100 samples)
        engine.trainer.settings.enabled = true;
        engine.trainer.settings.start_bpm = 120.0;
        engine.trainer.settings.target_bpm = 130.0;
        engine.trainer.settings.increment = 5.0;
        engine.trainer.settings.step_type = StepType::Seconds;
        engine.trainer.settings.step_value = 1.0;
        engine.trainer.settings.curve = Curve::Smooth;

        let mut buf_l = vec![0.0f32; 44100];
        let mut buf_r = vec![0.0f32; 44100];

        engine.fill_buffers(&mut buf_l, &mut buf_r);
        // After 1 second (44100 samples), BPM should have increased by approximately 5.0
        // (Since it recalculates samples per step dynamically, the linear increment is very close)
        assert!((engine.clock.bpm - 125.0).abs() < 0.1);
    }

    #[test]
    fn test_raw_ffi() {
        let ptr = engine_new(44100.0);
        assert!(!ptr.is_null());
        
        engine_set_bpm(ptr, 135.0);
        let mut out_bpm = 0.0f64;
        let tick = engine_get_tick(ptr, &mut out_bpm);
        assert_eq!(tick, -1);
        
        // Set trainer
        engine_set_trainer(ptr, true, 135.0, 150.0, 5.0, 0, 4.0, 0);
        
        // Test update grid and load sample
        let steps = [1u8; 32];
        engine_update_grid(ptr, 0, steps.as_ptr(), 32);
        
        let sample_l = vec![0.1f32; 100];
        let sample_r = vec![0.1f32; 100];
        engine_load_sample(ptr, 1, sample_l.as_ptr(), sample_r.as_ptr(), 100);
        
        engine_start(ptr);
        
        let mut out_l = vec![0.0f32; 500];
        let mut out_r = vec![0.0f32; 500];
        engine_process(ptr, out_l.as_mut_ptr(), out_r.as_mut_ptr(), 500);
        
        engine_stop(ptr);
        engine_free(ptr);
    }

    // A 4/4 pattern of 4 bars with the Click on every step
    fn four_bars(bpm: f64) -> Run {
        let run = Run::new(bpm, &[1; 16]);
        let grid = [1u8; 64];
        engine_update_grid(run.ptr, 0, grid.as_ptr(), grid.len());
        engine_set_bars(run.ptr, 4);
        run
    }

    #[test]
    fn pattern_wraps_after_four_bars() {
        let mut run = four_bars(120.0);
        run.play();
        run.render_hits(66);

        let steps: Vec<i32> = run.hits.iter().map(|hit| hit.step).collect();
        let expected: Vec<i32> = (0..66).map(|hit| hit % 64).collect();
        assert_eq!(steps, expected);
        assert_intervals_at(&run, 0..65, 120.0); // No gap at the wrap
    }

    #[test]
    fn restart_returns_to_bar_one_on_the_pulse() {
        let mut run = four_bars(120.0);
        run.play();
        run.render_hits(36);
        engine_restart_pattern(run.ptr);
        engine_restart_pattern(std::ptr::null_mut()); // Must not crash
        run.render_hits(40);

        let last = run.hits.iter().position(|hit| hit.step == 0 && hit.pos > 0).unwrap();
        assert_eq!(run.hits[last - 1].step, last as i32 - 1);
        assert_eq!(run.hits[last + 1].step, 1);
        assert_intervals_at(&run, 0..39, 120.0); // The pulse does not move
    }

    #[test]
    fn one_bar_still_wraps_at_its_length() {
        let mut run = Run::new(120.0, &[1; 16]);
        run.play();
        run.render_hits(18);
        assert_eq!(run.hits[15].step, 15);
        assert_eq!(run.hits[16].step, 0);
    }

    #[test]
    fn bars_outside_1_to_4_are_refused() {
        let run = Run::new(120.0, &[1; 16]);
        for bars in [0, 5, 128] {
            engine_set_bars(run.ptr, bars);
            assert_eq!(unsafe { &*run.ptr }.pattern.bars, 1, "{} bars", bars);
        }
        engine_set_bars(std::ptr::null_mut(), 2); // Must not crash
        for bars in 1..=4 {
            engine_set_bars(run.ptr, bars);
            assert_eq!(unsafe { &*run.ptr }.pattern.bars, bars as usize);
        }
    }

    #[test]
    fn fewer_bars_return_a_late_step_to_the_start() {
        let run = four_bars(120.0);
        let engine = unsafe { &mut *run.ptr };
        engine.pattern.step_index = 40;
        engine_set_bars(run.ptr, 2);
        assert_eq!(engine.pattern.step_index, 0);
    }

    #[test]
    fn holds_128_steps() {
        let run = Run::new(120.0, &[0; 16]);
        let mut grid = [0u8; 128];
        grid[127] = 2;
        engine_update_grid(run.ptr, 1, grid.as_ptr(), grid.len());
        assert_eq!(unsafe { &*run.ptr }.pattern.tracks[1].steps[127], 2);

        // One bar stops at 32 steps, however long the pattern may grow
        engine_set_measure_length(run.ptr, 32);
        assert_eq!(unsafe { &*run.ptr }.pattern.measure_length, 32);
        engine_set_measure_length(run.ptr, 33);
        assert_eq!(unsafe { &*run.ptr }.pattern.measure_length, 32);

        let too_long = [0u8; 129];
        engine_update_grid(run.ptr, 1, too_long.as_ptr(), too_long.len());
        assert_eq!(unsafe { &*run.ptr }.pattern.tracks[1].steps[127], 2);
    }

    #[test]
    fn trainer_counts_each_bar() {
        // +5 every 2 bars: bars 1 and 2 at 80, 3 and 4 at 85, then the pattern wraps to 90.
        let mut run = four_bars(80.0);
        engine_set_trainer(run.ptr, true, 80.0, 160.0, 5.0, BY_BARS, 2.0, STEPPED);
        run.play();
        run.render_hits(66);

        assert_hits_at(&run, 0..32, 80.0);
        assert_hits_at(&run, 32..64, 85.0);
        assert_hits_at(&run, 64..66, 90.0);
    }

    #[test]
    fn smooth_trainer_ignores_bars() {
        let bpm_after = |bars: u32| {
            let mut run = Run::new(100.0, &[1; 16]);
            if bars > 1 {
                let grid = [1u8; 64];
                engine_update_grid(run.ptr, 0, grid.as_ptr(), grid.len());
                engine_set_bars(run.ptr, bars);
            }
            engine_set_trainer(run.ptr, true, 100.0, 200.0, 4.0, BY_BARS, 1.0, SMOOTH);
            run.play();
            run.render_hits(33); // Two bars
            run.hits[32].bpm
        };
        assert_eq!(bpm_after(4), bpm_after(1));
        assert!(bpm_after(4) > 107.0 && bpm_after(4) < 109.0); // +4 per bar, a little under 8 by the ramp's own tempo
    }

    #[test]
    fn test_measure_length_looping() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // Update measure length to 12 steps (3/4 time signature)
        engine_set_measure_length(&mut engine as *mut Engine, 12);
        
        // Manually trigger steps. Triggering 12 times should loop the step_index from 0 to 11 and back to 0.
        for _ in 0..11 {
            engine.trigger_step();
        }
        assert_eq!(engine.pattern.step_index, 11);
        
        // The 12th trigger should wrap step_index back to 0
        engine.trigger_step();
        assert_eq!(engine.pattern.step_index, 0);
    }

    #[test]
    fn test_measure_total_duration_no_drift() {
        // Test both even and odd lengths
        for length in [12, 15, 16, 20] {
            let mut engine = Engine::new(44100.0);
            engine.pattern.measure_length = length;
            engine.start();
            
            let mut total_limit = 0.0;
            for _ in 0..length {
                total_limit += engine.clock.samples_per_step;
                engine.trigger_step();
            }
            
            let expected_total = engine.clock.samples_per_step * (length as f64);
            assert!((total_limit - expected_total).abs() < 1e-5, "Drift detected on length {}: total_limit={}, expected={}", length, total_limit, expected_total);
        }
    }

    #[test]
    fn test_click_mode_switching() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // Default mode is synth (0)
        assert_eq!(engine.click.mode, 0);
        
        // Switch to sample mode (1)
        engine_set_click_mode(&mut engine as *mut Engine, 1);
        assert_eq!(engine.click.mode, 1);
    }

    #[test]
    fn test_click_sample_playback() {
        let mut engine = Engine::new(44100.0);
        engine.start();
        
        // Load dummy click sample (slot 0)
        let sample_l = vec![0.2f32, 0.4f32, 0.6f32];
        let sample_r = vec![-0.2f32, -0.4f32, -0.6f32];
        engine.click.sample = Some(Sample {
            left_channel: sample_l.clone(),
            right_channel: sample_r.clone(),
        });
        
        // Switch to click mode 1 (sample mode)
        engine_set_click_mode(&mut engine as *mut Engine, 1);
        
        // Set accent click on step 0
        engine.pattern.tracks[0].steps[0] = 2; // Accent
        
        let mut buf_l = vec![0.0f32; 3];
        let mut buf_r = vec![0.0f32; 3];
        
        engine.fill_buffers(&mut buf_l, &mut buf_r);
        
        // Accent volume is 1.0, so the output is simply the dry click sample.
        assert_eq!(buf_l[0], 0.2);
        assert_eq!(buf_r[0], -0.2);
        assert_eq!(buf_l[1], 0.4);
        assert_eq!(buf_r[1], -0.4);
        assert_eq!(buf_l[2], 0.6);
        assert_eq!(buf_r[2], -0.6);

        // Now test non-accented click (volume is 0.5)
        engine.pattern.tracks[0].steps[1] = 1; // Normal click
        
        engine.trigger_step(); // Triggers step 1 manually, increments to step 2
        
        let mut buf_l2 = vec![0.0f32; 3];
        let mut buf_r2 = vec![0.0f32; 3];
        
        engine.fill_buffers(&mut buf_l2, &mut buf_r2);
        
        assert_eq!(buf_l2[0], 0.2 * 0.5);
        assert_eq!(buf_r2[0], -0.2 * 0.5);
        assert_eq!(buf_l2[1], 0.4 * 0.5);
        assert_eq!(buf_r2[1], -0.4 * 0.5);
    }

    // --- The pad in the engine ---

    const CHORD: [u8; 5] = [48, 52, 55, 59, 62];
    const OTHER_CHORD: [u8; 3] = [45, 48, 52];
    const NEW_AGE: u8 = 1;
    const TIMBRES: u8 = 5;
    const FADED_IN: usize = 2 * SR as usize; // Past the 1.5 s fade
    // drum_session on the sample click, hashed on the engine of df52c58, before the pad reached it
    const DRUMS_BEFORE_THE_PAD: u64 = 0xe6cb5f9d31ccc6ed;

    fn pad_play(ptr: *mut Engine, notes: &[u8]) {
        let note = |index: usize| notes.get(index).copied().unwrap_or(0);
        engine_pad_play(ptr, note(0), note(1), note(2), note(3), note(4), note(5), note(6), notes.len(), NEW_AGE);
    }

    fn peak(channel: &[f32]) -> f32 {
        channel.iter().fold(0.0, |peak, sample| peak.max(sample.abs()))
    }

    fn bits(channel: &[f32]) -> Vec<u32> {
        channel.iter().map(|sample| sample.to_bits()).collect()
    }

    // A decaying buzz, built with no call to libm, so its bits hold on every platform
    fn buzz(frames: usize, level: f32) -> Vec<f32> {
        (0..frames)
            .map(|i| {
                let sign = if i % 40 < 20 { 1.0 } else { -1.0 };
                sign * level * (1.0 - i as f32 / frames as f32)
            })
            .collect()
    }

    // Every drum path in one run: singles, takes of each dynamic, the hats' cut, replaced hits,
    // a stacked hit past full scale for the clamp, the Trainer, then Stop and Play again.
    fn drum_session(ptr: *mut Engine, click_mode: u32) -> (Vec<f32>, Vec<f32>) {
        engine_set_click_mode(ptr, click_mode);
        let click = buzz(400, 0.5);
        engine_load_sample(ptr, 0, click.as_ptr(), click.as_ptr(), click.len());
        for track in [2, 3, 4, 5] {
            let left = buzz(30000, 0.3);
            let right = buzz(20000 + 1000 * track as usize, 0.25);
            let right: Vec<f32> = (0..left.len()).map(|i| right.get(i).copied().unwrap_or(0.0)).collect();
            engine_load_sample(ptr, track, left.as_ptr(), right.as_ptr(), left.len());
        }
        for dynamic in 0..DYNAMICS as u32 {
            for take in 0..TAKES as u32 {
                let hit = buzz(12000 + 500 * take as usize, 0.3 + 0.35 * dynamic as f32);
                engine_load_take(ptr, 1, dynamic, take, hit.as_ptr(), hit.as_ptr(), hit.len());
            }
        }

        let grids: [[u8; 16]; 5] = [
            [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            [2, 0, 3, 0, 1, 0, 3, 1, 2, 0, 0, 3, 1, 0, 1, 0],
            [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 3],
            [1, 1, 3, 1, 2, 1, 0, 1, 1, 1, 3, 1, 2, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0],
        ];
        for (track, grid) in grids.iter().enumerate() {
            engine_update_grid(ptr, track as u32, grid.as_ptr(), 16);
        }
        engine_set_measure_length(ptr, 16);
        engine_set_bpm(ptr, 133.3);
        engine_set_trainer(ptr, true, 133.3, 170.0, 4.0, 0, 1.0, 0);

        engine_start(ptr);
        let (mut left, mut right) = stereo_output(ptr, 6 * SR as usize);
        engine_stop(ptr);
        let (stopped_left, stopped_right) = stereo_output(ptr, 1000);
        left.extend(stopped_left);
        right.extend(stopped_right);

        engine_set_trainer(ptr, true, 90.0, 120.0, 5.0, 1, 2.0, 1);
        engine_start(ptr);
        let (again_left, again_right) = stereo_output(ptr, 6 * SR as usize);
        left.extend(again_left);
        right.extend(again_right);
        engine_stop(ptr);
        (left, right)
    }

    // FNV-1a over the bits of both channels
    fn session_hash(left: &[f32], right: &[f32]) -> u64 {
        let mut hash = 0xcbf29ce484222325u64;
        for sample in left.iter().chain(right) {
            for byte in sample.to_bits().to_le_bytes() {
                hash = (hash ^ byte as u64).wrapping_mul(0x100000001b3);
            }
        }
        hash
    }

    #[test]
    fn pad_23_sounds_while_stopped() {
        let ptr = engine_new(SR);
        pad_play(ptr, &CHORD);
        let (left, right) = stereo_output(ptr, FADED_IN);

        let held = FADED_IN - SR as usize / 2;
        assert_eq!(sounding_frames(&left[held..], &right[held..]).len(), FADED_IN - held);
        assert!(peak(&left[held..]) > 0.003, "left peak {}", peak(&left[held..]));
        assert!(peak(&right[held..]) > 0.003, "right peak {}", peak(&right[held..]));
        engine_free(ptr);

        // A stopped engine still clears its tick, with the pad sounding
        let run = Run::new(120.0, &[1; 16]);
        pad_play(run.ptr, &CHORD);
        engine_start(run.ptr);
        stereo_output(run.ptr, FADED_IN);
        let mut bpm = 0.0f64;
        while engine_get_tick(run.ptr, &mut bpm) < 0 {
            stereo_output(run.ptr, BLOCK as usize); // Stop on a block that carries a tick
        }
        engine_stop(run.ptr);

        for _ in 0..100 {
            let (left, right) = stereo_output(run.ptr, BLOCK as usize);
            assert_eq!(engine_get_tick(run.ptr, &mut bpm), -1);
            assert_eq!(sounding_frames(&left, &right).len(), BLOCK as usize);
        }
    }

    #[test]
    fn pad_24_play_and_stop_keep_the_pad() {
        let pressed = engine_new(SR);
        let untouched = engine_new(SR);
        for ptr in [pressed, untouched] {
            pad_play(ptr, &CHORD);
        }

        // Halfway through the fade in, then while held
        let presses: [(extern "C" fn(*mut Engine), usize); 5] = [
            (engine_start, 22050),
            (engine_stop, 22050),
            (engine_start, FADED_IN),
            (engine_stop, FADED_IN),
            (engine_start, FADED_IN),
        ];
        for (press, frames) in presses {
            press(pressed);
            let (left, right) = stereo_output(pressed, frames);
            let (quiet_left, quiet_right) = stereo_output(untouched, frames);
            assert_eq!(bits(&left), bits(&quiet_left));
            assert_eq!(bits(&right), bits(&quiet_right));
            assert!(peak(&left) > 0.003, "left peak {}", peak(&left));
        }
        engine_free(pressed);
        engine_free(untouched);
    }

    #[test]
    fn pad_28_hits_keep_their_time() {
        let halves = |ptr: *mut Engine, chords: bool| {
            let (mut left, _) = stereo_output(ptr, 5 * SR as usize);
            if chords {
                pad_play(ptr, &OTHER_CHORD); // A crossfade while the hits fall
            }
            left.extend(stereo_output(ptr, 15 * SR as usize).0);
            left
        };

        for bpm in [60.0, 97.5, 133.3, 187.7, 240.0] {
            let without_pad = Run::new(bpm, &[1; 16]);
            let with_pad = Run::new(bpm, &[1; 16]);
            let pad_alone = Run::new(bpm, &[0; 16]);
            for run in [&with_pad, &pad_alone] {
                pad_play(run.ptr, &CHORD);
            }
            for run in [&without_pad, &with_pad, &pad_alone] {
                engine_start(run.ptr);
            }

            let clicks = halves(without_pad.ptr, false);
            let mixed = halves(with_pad.ptr, true);
            let pad = halves(pad_alone.ptr, true);
            assert!(peak(&pad) > 0.003, "pad peak {}", peak(&pad));

            // The pad is the same in both runs, so a frame differs only where a hit falls
            let plain_hits: Vec<usize> = (0..clicks.len()).filter(|&i| clicks[i] != 0.0).collect();
            let mixed_hits: Vec<usize> = (0..mixed.len()).filter(|&i| mixed[i] != pad[i]).collect();
            let ideal = step_samples(SR, bpm);
            assert_eq!(plain_hits.len(), mixed_hits.len(), "hit count at {} BPM", bpm);
            assert!(mixed_hits.len() as f64 >= 20.0 * SR as f64 / ideal - 1.0, "hits at {} BPM", bpm);
            for (k, (&plain, &mixed)) in plain_hits.iter().zip(&mixed_hits).enumerate() {
                let what = format!("{} BPM, hit {}", bpm, k);
                assert_within_one_sample(mixed as f64, plain as f64, &what);
                assert_within_one_sample(mixed as f64, k as f64 * ideal, &what);
            }
        }
    }

    #[test]
    fn pad_29_silent_pad_changes_nothing() {
        let never_used = engine_new(SR);
        let (left, right) = drum_session(never_used, 1);
        assert_eq!(session_hash(&left, &right), DRUMS_BEFORE_THE_PAD);
        engine_free(never_used);

        // A pad that sounded and fell silent leaves nothing behind, on either click
        for click_mode in [0, 1] {
            let never_used = engine_new(SR);
            let (left, right) = drum_session(never_used, click_mode);
            engine_free(never_used);

            let played = engine_new(SR);
            pad_play(played, &CHORD);
            stereo_output(played, FADED_IN);
            engine_pad_set_volume(played, 1.0);
            engine_pad_stop(played);
            let mut tail_seconds = 0;
            while !unsafe { &*played }.pad.is_silent() {
                stereo_output(played, SR as usize);
                tail_seconds += 1;
                assert!(tail_seconds < 60, "the tail never ended");
            }
            let (quiet_left, quiet_right) = stereo_output(played, 1000);
            assert_eq!(sounding_frames(&quiet_left, &quiet_right), Vec::<usize>::new());

            let (after_left, after_right) = drum_session(played, click_mode);
            assert_eq!(bits(&left), bits(&after_left));
            assert_eq!(bits(&right), bits(&after_right));
            engine_free(played);
        }
    }

    #[test]
    fn tim_45_timbre_leaves_the_drums_alone() {
        let file = buzz(4000, 0.2);
        for click_mode in [0, 1] {
            let never_used = engine_new(SR);
            let (left, right) = drum_session(never_used, click_mode);
            engine_free(never_used);
            if click_mode == 1 {
                assert_eq!(session_hash(&left, &right), DRUMS_BEFORE_THE_PAD);
            }

            for timbre in 0..TIMBRES {
                // Selected and loaded, with no chord
                let selected = engine_new(SR);
                engine_pad_load(selected, timbre, 48, 0, 3999, file.as_ptr(), file.as_ptr(), file.len());
                let (selected_left, selected_right) = drum_session(selected, click_mode);
                assert_eq!(bits(&left), bits(&selected_left), "timbre {timbre}");
                assert_eq!(bits(&right), bits(&selected_right), "timbre {timbre}");
                engine_free(selected);

                // A chord that sounded in it and fell silent leaves nothing behind
                let played = engine_new(SR);
                engine_pad_load(played, timbre, 48, 0, 3999, file.as_ptr(), file.as_ptr(), file.len());
                engine_pad_play(played, 24, 36, 48, 52, 55, 59, 62, 7, timbre);
                assert_eq!(unsafe { &*played }.pad.is_silent(), false);
                stereo_output(played, FADED_IN);
                engine_pad_stop(played);
                let mut tail_seconds = 0;
                while !unsafe { &*played }.pad.is_silent() {
                    stereo_output(played, SR as usize);
                    tail_seconds += 1;
                    assert!(tail_seconds < 60, "the tail never ended");
                }
                let (after_left, after_right) = drum_session(played, click_mode);
                assert_eq!(bits(&left), bits(&after_left), "timbre {timbre}");
                assert_eq!(bits(&right), bits(&after_right), "timbre {timbre}");
                engine_free(played);
            }
        }

        // A timbre outside the list is refused, and leaves the pad as silent as it was
        let ptr = engine_new(SR);
        engine_pad_play(ptr, 48, 52, 55, 0, 0, 0, 0, 3, TIMBRES);
        assert!(unsafe { &*ptr }.pad.is_silent());
        engine_free(ptr);
    }

    #[test]
    fn pad_shares_the_output_clamp() {
        // Far past full scale, so the sum reaches the clamp on both paths
        let hot: Vec<f32> = (0..4000).map(|i| if i % 40 < 20 { 40.0 } else { -40.0 }).collect();
        let ptr = engine_new(SR);
        engine_pad_load(ptr, NEW_AGE, 48, 0, 3999, hot.as_ptr(), hot.as_ptr(), hot.len());
        engine_pad_set_volume(ptr, 1.0);
        pad_play(ptr, &CHORD);

        let (left, right) = stereo_output(ptr, FADED_IN);
        assert_eq!(peak(&left), 1.0);
        assert_eq!(peak(&right), 1.0);

        engine_start(ptr);
        let (left, right) = stereo_output(ptr, FADED_IN);
        assert_eq!(peak(&left), 1.0);
        assert_eq!(peak(&right), 1.0);
        engine_free(ptr);
    }
}
