// A held note: its saws and the files it reads, crossing from one file to a nearer one
use super::mixes::{NO_FILE, SAWS};
use std::f32::consts::FRAC_PI_2;

// A pad sample keeps its onset, so `Sample` and its trimming are not reused: they would shift the loop points
pub(super) struct PadSample {
    pub(super) key: u8,
    pub(super) left: Vec<f32>,
    pub(super) right: Vec<f32>,
    pub(super) loop_start: usize,
    pub(super) loop_end: usize, // Holds the same value as loop_start, so a wrap from one to the other is seamless
}

#[derive(Clone, Copy)]
pub(super) struct Voice {
    pub(super) note: u8,
    pub(super) phases: [f32; SAWS],
    pub(super) steps: [f32; SAWS], // Phase per frame
    pub(super) file: usize, // Index into the bank of its slot's timbre, or NO_FILE
    pub(super) next_file: usize, // A nearer file that came in while the voice sounds
    // SPEC_DEVIATION: on the voice, where the design keeps one sample gain per slot
    // Reason: files arrive one by one, and a held note must move to the nearer file without a click
    pub(super) file_gain: f32, // Linear, from 0 to 1
    // SPEC_DEVIATION: f64, where the design says f32
    // Reason: past 262,144 frames f32 moves in steps of 1/32 of a frame, which rounds a ratio of 1.059 to 1.0625, 5 cents sharp
    pub(super) position: f64,
    pub(super) speed: f64, // Frames of the file per output frame
    // The file a nearer one replaced, read on while the two cross, so the note keeps its level
    pub(super) past_file: usize,
    pub(super) past_position: f64,
    pub(super) past_speed: f64,
    pub(super) crossing: f32, // Linear, from 0 to 1: how far the voice has moved from past_file to file
}

impl Voice {
    pub(super) const OFF: Voice = Voice {
        note: 0,
        phases: [0.0; SAWS],
        steps: [0.0; SAWS],
        file: NO_FILE,
        next_file: NO_FILE,
        file_gain: 0.0,
        position: 0.0,
        speed: 1.0,
        past_file: NO_FILE,
        past_position: 0.0,
        past_speed: 1.0,
        crossing: 1.0,
    };

    pub(super) fn use_file(&mut self, file: usize, samples: &[PadSample]) {
        self.file = file;
        self.next_file = file;
        self.position = 0.0;
        if let Some(sample) = samples.get(file) {
            self.speed = 2f64.powf((self.note as f64 - sample.key as f64) / 12.0);
        }
    }

    // Takes a nearer file that came in: from no file it fades in, and from another file the two cross, so neither
    // the note's level nor, in Orchestra, the absence of a synth moves. A third file waits for the crossing to end
    pub(super) fn approach_file(&mut self, samples: &[PadSample], rise: f32) {
        if self.next_file != self.file && self.past_file == NO_FILE {
            if self.file != NO_FILE {
                (self.past_file, self.past_position, self.past_speed) = (self.file, self.position, self.speed);
                self.crossing = 0.0;
            }
            self.use_file(self.next_file, samples);
        }
        if self.file != NO_FILE {
            self.file_gain = (self.file_gain + rise).min(1.0);
        }
        if self.past_file != NO_FILE {
            self.crossing = (self.crossing + rise).min(1.0);
            if self.crossing == 1.0 {
                self.past_file = NO_FILE;
            }
        }
    }

    // One frame of the voice's files, the one it leaves and the one it takes on equal-power curves
    pub(super) fn read_files(&mut self, samples: &[PadSample]) -> (f32, f32) {
        let (mut left, mut right) = (0.0, 0.0);
        let (taking, leaving) = if self.past_file == NO_FILE {
            (1.0, 0.0)
        } else {
            ((self.crossing * FRAC_PI_2).sin(), (self.crossing * FRAC_PI_2).cos())
        };
        if let Some(sample) = samples.get(self.file) {
            let (file_left, file_right) = read(sample, &mut self.position, self.speed);
            (left, right) = (file_left * taking, file_right * taking);
        }
        if let Some(sample) = samples.get(self.past_file) {
            let (file_left, file_right) = read(sample, &mut self.past_position, self.past_speed);
            (left, right) = (left + file_left * leaving, right + file_right * leaving);
        }
        (left, right)
    }
}

pub(super) fn read(sample: &PadSample, position: &mut f64, speed: f64) -> (f32, f32) {
    let index = *position as usize;
    let fraction = (*position - index as f64) as f32;
    let left = sample.left[index] + fraction * (sample.left[index + 1] - sample.left[index]);
    let right = sample.right[index] + fraction * (sample.right[index + 1] - sample.right[index]);
    *position += speed;
    while *position >= sample.loop_end as f64 {
        *position -= (sample.loop_end - sample.loop_start) as f64;
    }
    (left, right)
}
