pub struct Sample {
    pub left_channel: Vec<f32>,
    pub right_channel: Vec<f32>,
}

// Starts at the first frame reaching 1% of peak. A silent sample matches at frame 0.
pub fn trim_onset(left: &[f32], right: &[f32]) -> Sample {
    let peak = left.iter().chain(right).fold(0.0f32, |peak, s| peak.max(s.abs()));
    let threshold = peak * 0.01;
    let onset = (0..left.len())
        .find(|&i| left[i].abs() >= threshold || right[i].abs() >= threshold)
        .unwrap_or(0);

    Sample {
        left_channel: left[onset..].to_vec(),
        right_channel: right[onset..].to_vec(),
    }
}
