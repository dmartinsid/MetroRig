// The WASM seam: raw pointers in, Engine calls out. The only file with `unsafe` outside tests.
use crate::engine::{Curve, Engine, StepType, TrainerSettings, STEPS_COUNT};
use std::slice;

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
    engine.set_bpm(bpm);
}

#[no_mangle]
pub extern "C" fn engine_load_sample(
    ptr: *mut Engine,
    sample_id: u32,
    left_ptr: *const f32,
    right_ptr: *const f32,
    length: usize
) {
    if ptr.is_null() || left_ptr.is_null() || right_ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    let left_slice = unsafe { slice::from_raw_parts(left_ptr, length) };
    let right_slice = unsafe { slice::from_raw_parts(right_ptr, length) };
    engine.load_sample(sample_id as usize, left_slice, right_slice);
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
    let engine = unsafe { &mut *ptr };
    let left_slice = unsafe { slice::from_raw_parts(left_ptr, length) };
    let right_slice = unsafe { slice::from_raw_parts(right_ptr, length) };
    engine.load_take(track as usize, dynamic as usize, take as usize, left_slice, right_slice);
}

#[no_mangle]
pub extern "C" fn engine_update_grid(ptr: *mut Engine, sample_id: u32, steps_ptr: *const u8, length: usize) {
    if ptr.is_null() || steps_ptr.is_null() || length > STEPS_COUNT { return; }
    let engine = unsafe { &mut *ptr };
    let steps_slice = unsafe { slice::from_raw_parts(steps_ptr, length) };
    engine.update_grid(sample_id as usize, steps_slice);
}

#[no_mangle]
pub extern "C" fn engine_set_measure_length(ptr: *mut Engine, length: u32) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.set_measure_length(length as usize);
}

// The next step plays bar 1, on the pulse already running: nothing stops or starts
#[no_mangle]
pub extern "C" fn engine_restart_pattern(ptr: *mut Engine) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.restart_pattern();
}

#[no_mangle]
pub extern "C" fn engine_set_bars(ptr: *mut Engine, bars: u32) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.set_bars(bars as usize);
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
    engine.set_click_mode(mode);
}

// Holds the first `count` notes in a timbre. A chord has at most 7, and the rest of the arguments are ignored
#[no_mangle]
pub extern "C" fn engine_pad_play(ptr: *mut Engine, n0: u8, n1: u8, n2: u8, n3: u8, n4: u8, n5: u8, n6: u8, count: usize, timbre: u8) {
    if ptr.is_null() { return; }
    let notes = [n0, n1, n2, n3, n4, n5, n6];
    let Some(notes) = notes.get(..count) else { return };
    let engine = unsafe { &mut *ptr };
    engine.pad_mut().play(notes, timbre);
}

#[no_mangle]
pub extern "C" fn engine_pad_stop(ptr: *mut Engine) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pad_mut().stop();
}

#[no_mangle]
pub extern "C" fn engine_pad_set_volume(ptr: *mut Engine, volume: f32) {
    if ptr.is_null() || !volume.is_finite() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pad_mut().set_volume(volume);
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
    engine.pad_mut().load(timbre, key, left_slice, right_slice, loop_start, loop_end);
}

// Brackets the files of one timbre: the notes read none of them until the last has come or failed
#[no_mangle]
pub extern "C" fn engine_pad_load_begin(ptr: *mut Engine, timbre: u8) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pad_mut().load_begin(timbre);
}

#[no_mangle]
pub extern "C" fn engine_pad_load_end(ptr: *mut Engine, timbre: u8) {
    if ptr.is_null() { return; }
    let engine = unsafe { &mut *ptr };
    engine.pad_mut().load_end(timbre);
}

#[no_mangle]
pub extern "C" fn engine_get_tick(ptr: *mut Engine, out_bpm: *mut f64) -> i32 {
    if ptr.is_null() || out_bpm.is_null() { return -1; }
    let engine = unsafe { &mut *ptr };
    let (index, bpm) = engine.tick();
    unsafe { *out_bpm = bpm; }
    index
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

#[cfg(test)]
#[path = "ffi_tests.rs"]
mod tests;
