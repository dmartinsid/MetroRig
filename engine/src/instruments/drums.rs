// The kit: a single sample or a bank of takes per track, played at the step's dynamic
use crate::dsp::sample::Sample;

pub const TRACKS: usize = 13; // 0: Click, then the kit in src/kit.ts
pub const DYNAMICS: usize = 3;
pub const TAKES: usize = 3;
const DYNAMIC_GHOST: usize = 0;
const DYNAMIC_NORMAL: usize = 1;
const DYNAMIC_ACCENT: usize = 2;
pub const HI_HAT_TRACK: usize = 3;
pub const OPEN_HAT_TRACK: usize = 4;
const FADE_SECONDS: f32 = 0.005;
pub const GAIN_NORMAL: f32 = 0.7;
pub const GAIN_ACCENT: f32 = 1.0;
pub const GAIN_GHOST: f32 = 0.3;

#[derive(Clone, Copy)]
enum Source {
    Single,
    Take(usize, usize), // Dynamic, take
}

// A replaced hit, ringing out under the hit that replaced it
#[derive(Clone, Copy)]
pub struct FadingVoice {
    source: Source,
    offset: usize,
    level: f32,
    elapsed: usize, // Frames of the fade already played
}

// A step's value is its dynamic: 1 normal, 2 accent, 3 ghost
fn step_gain(step: u8) -> f32 {
    match step {
        2 => GAIN_ACCENT,
        3 => GAIN_GHOST,
        _ => GAIN_NORMAL,
    }
}

fn step_dynamic(step: u8) -> usize {
    match step {
        2 => DYNAMIC_ACCENT,
        3 => DYNAMIC_GHOST,
        _ => DYNAMIC_NORMAL,
    }
}

pub struct Drums {
    pub(crate) samples: [Option<Sample>; TRACKS],
    pub(crate) bank: [[[Option<Sample>; TAKES]; DYNAMICS]; TRACKS],
    next_take: [[usize; DYNAMICS]; TRACKS],
    playback_source: [Source; TRACKS],
    playback_offsets: [usize; TRACKS],
    playback_active: [bool; TRACKS],
    playback_volume: [f32; TRACKS],
    playback_gain: [f32; TRACKS], // The dynamic of the step that started each voice
    pub(crate) fading: [Option<FadingVoice>; TRACKS],
    fade_frames: usize,
}

impl Drums {
    pub fn new(sample_rate: f32) -> Self {
        Drums {
            samples: std::array::from_fn(|_| None),
            bank: std::array::from_fn(|_| std::array::from_fn(|_| std::array::from_fn(|_| None))),
            next_take: [[0; DYNAMICS]; TRACKS],
            playback_source: [Source::Single; TRACKS],
            playback_offsets: [0; TRACKS],
            playback_active: [false; TRACKS],
            playback_volume: [0.8, 1.0, 0.9, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.9, 0.9, 0.9, 0.9],
            playback_gain: [GAIN_NORMAL; TRACKS],
            fading: [None; TRACKS],
            fade_frames: (sample_rate * FADE_SECONDS).round() as usize,
        }
    }

    pub fn load_sample(&mut self, track: usize, sample: Sample) {
        self.samples[track] = Some(sample);
    }

    // Dynamic: 0 Ghost, 1 Normal, 2 Accent
    pub fn load_take(&mut self, track: usize, dynamic: usize, take: usize, sample: Sample) {
        self.bank[track][dynamic][take] = Some(sample);
    }

    pub fn trigger(&mut self, track: usize, step: u8) {
        if let Some(source) = self.next_source(track, step) {
            if self.playback_active[track] {
                let replaced = self.playback_source[track];
                self.fading[track] = Some(FadingVoice {
                    source: replaced,
                    offset: self.playback_offsets[track],
                    level: self.voice_level(track, replaced),
                    elapsed: 0,
                });
            }
            self.playback_source[track] = source;
            self.playback_active[track] = true;
            self.playback_offsets[track] = 0;
            self.playback_gain[track] = step_gain(step);
        }
    }

    // A hard cut, with no fade
    pub fn choke(&mut self, track: usize) {
        self.playback_active[track] = false;
    }

    // Play: the takes start over and nothing rings on
    pub fn reset(&mut self) {
        self.next_take = [[0; DYNAMICS]; TRACKS];
        self.playback_active = [false; TRACKS];
        self.playback_offsets = [0; TRACKS];
        self.fading = [None; TRACKS];
    }

    pub fn stop(&mut self) {
        self.fading = [None; TRACKS];
    }

    // One frame of every drum voice
    pub fn render(&mut self) -> (f32, f32) {
        let mut drums_l = 0.0;
        let mut drums_r = 0.0;
        
        for s_idx in 1..TRACKS {
            if self.playback_active[s_idx] {
                let source = self.playback_source[s_idx];
                match self.voice_frame(s_idx, source, self.playback_offsets[s_idx]) {
                    Some((left, right)) => {
                        let level = self.voice_level(s_idx, source);
                        drums_l += left * level;
                        drums_r += right * level;
                        self.playback_offsets[s_idx] += 1;
                    }
                    None => self.playback_active[s_idx] = false,
                }
            }

            if let Some(voice) = self.fading[s_idx] {
                let frame = self.voice_frame(s_idx, voice.source, voice.offset);
                if let Some((left, right)) = frame {
                    let ramp = 1.0 - voice.elapsed as f32 / self.fade_frames as f32;
                    drums_l += left * voice.level * ramp;
                    drums_r += right * voice.level * ramp;
                }
                let elapsed = voice.elapsed + 1;
                self.fading[s_idx] = (frame.is_some() && elapsed < self.fade_frames)
                    .then_some(FadingVoice { offset: voice.offset + 1, elapsed, ..voice });
            }
        }
        (drums_l, drums_r)
    }

    // A track with a bank plays it. Only a track without one plays its single sample.
    fn next_source(&mut self, track: usize, step: u8) -> Option<Source> {
        for dynamic in [step_dynamic(step), DYNAMIC_NORMAL, DYNAMIC_ACCENT, DYNAMIC_GHOST] {
            let first = self.next_take[track][dynamic];
            for offset in 0..TAKES {
                let take = (first + offset) % TAKES;
                if self.bank[track][dynamic][take].is_some() {
                    self.next_take[track][dynamic] = (take + 1) % TAKES;
                    return Some(Source::Take(dynamic, take));
                }
            }
        }
        self.samples[track].is_some().then_some(Source::Single)
    }

    // A voice's frame, or None past the end of its recording
    fn voice_frame(&self, track: usize, source: Source, offset: usize) -> Option<(f32, f32)> {
        let sample = match source {
            Source::Single => self.samples[track].as_ref(),
            Source::Take(dynamic, take) => self.bank[track][dynamic][take].as_ref(),
        }?;
        Some((*sample.left_channel.get(offset)?, sample.right_channel[offset]))
    }

    // A take plays at its recorded level, with its trim already in the sample
    fn voice_level(&self, track: usize, source: Source) -> f32 {
        match source {
            Source::Single => self.playback_volume[track] * self.playback_gain[track],
            Source::Take(..) => 1.0,
        }
    }
}
