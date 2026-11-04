pub fn low_pass(poles: &mut [f32; 2], input: f32, smoothing: f32) {
    poles[0] += smoothing * (input - poles[0]);
    poles[1] += smoothing * (poles[0] - poles[1]);
}
