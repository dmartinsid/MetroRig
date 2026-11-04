// A chord in one of the Pad's slots, and the fade that brings it in or out
use super::mixes::MAX_NOTES;
use super::voice::Voice;
use std::f32::consts::FRAC_PI_2;

#[derive(Clone, Copy)]
pub(super) struct Slot {
    pub(super) timbre: u8, // Part of what a slot holds, so the same notes in another timbre are another chord to fade to
    pub(super) notes: [u8; MAX_NOTES],
    pub(super) voices: [Voice; MAX_NOTES],
    pub(super) count: usize, // 0 while the slot is free
    pub(super) gain: f32, // Keeps chords of any size at one level
    pub(super) level: f32, // Linear, from 0 to 1, so a fade continues from wherever it stands
    pub(super) target: f32,
    pub(super) fade_step: f32, // Level per frame
    pub(super) evicting: bool, // Its 20 ms already run, so a later click must not restart them
    pub(super) order: u64, // Higher is newer
}

impl Slot {
    pub(super) const OFF: Slot = Slot {
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

    pub(super) fn holds(&self, notes: &[u8], timbre: u8) -> bool {
        self.count > 0 && self.timbre == timbre && &self.notes[..self.count] == notes
    }

    // Equal power, because two chords are unrelated: a crossfade keeps its loudness
    pub(super) fn fade_gain(&mut self) -> f32 {
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
