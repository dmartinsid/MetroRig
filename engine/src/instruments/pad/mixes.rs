// Each timbre's levels and the constants the Pad, its voices and its slots are built on

pub(super) const MAX_CHORDS: usize = 3;
pub(super) const MAX_NOTES: usize = 7; // 5 of a chord, and the 2 bass notes of a timbre that adds them
pub(super) const TIMBRES: usize = 5; // In the order of PAD_TIMBRES in src/chords.ts, whose index is the timbre's id
pub(super) const SAWS: usize = 7;
pub(super) const FADE_SECONDS: f32 = 1.5;
pub(super) const EVICTION_SECONDS: f32 = 0.02;
pub(super) const VOLUME_SECONDS: f32 = 0.02;
pub(super) const OUTPUT_GAIN: f32 = 2.5119; // AD-022: every timbre 8 dB up, set by ear against the drums
pub(super) const DEFAULT_VOLUME: f32 = 0.7;

// The sound of demo 3
pub(super) const DETUNE: [f32; SAWS] = [-0.19, -0.11, -0.05, 0.0, 0.05, 0.11, 0.19]; // Semitones
pub(super) const CUTOFF_HZ: f32 = 900.0;
pub(super) const CUTOFF_SWING_HZ: f32 = 350.0;
pub(super) const CUTOFF_LFO_HZ: f32 = 0.13;

pub(super) const SILENCE: f32 = 3.2e-5; // -90 dBFS

// Set by ear, within PAD-20 and PAD-27. Their ratio keeps the sample layer about 2 dB above the synth, as in demo 4.
// Before OUTPUT_GAIN, at DEFAULT_VOLUME a rare line-up of three files reaches -12.7 dBFS
pub(super) const SYNTH_GAIN: f32 = 0.0375;
pub(super) const SAMPLE_GAIN: f32 = 0.3375;

// Each timbre's layers, as multiples of the gains above, and the share of its samples that takes the effects.
// New Age's are 1, so its output stays what `chord-pads` shipped. Analog has no samples, and Orchestra no synth
// but Analog's until its files arrive.
// Each timbre sits at New Age's level. Choir and Sweep keep the samples about 2 dB above the synth, as in their demos
pub(super) struct Mix {
    pub(super) synth: f32,
    pub(super) samples: f32,
    pub(super) chorus: f32,
}

pub(super) const MIXES: [Mix; TIMBRES] = [
    Mix { synth: 0.87, samples: 0.60, chorus: 1.0 }, // Choir
    Mix { synth: 1.0, samples: 1.0, chorus: 1.0 }, // New Age
    Mix { synth: 0.0, samples: 2.12, chorus: 0.3 }, // Orchestra
    Mix { synth: 0.93, samples: 0.54, chorus: 1.0 }, // Sweep
    Mix { synth: 1.43, samples: 0.0, chorus: 1.0 }, // Analog
];

// The filter darkens the notes only the 11ths and 13ths reach, so each takes back what it loses. At and under
// HIGHEST_FLAT_NOTE nothing changes, so New Age keeps its output
pub(super) const HIGHEST_FLAT_NOTE: u8 = 70;
pub(super) const TOP_NOTE_RISE: f32 = 0.12;

pub(super) fn top_note_gain(note: u8) -> f32 {
    1.0 + note.saturating_sub(HIGHEST_FLAT_NOTE) as f32 * TOP_NOTE_RISE
}

pub(super) const NO_FILE: usize = usize::MAX;
pub(super) const FALLBACK: usize = 4; // Analog, whose synth stands in for a timbre with none
pub(super) const LOWEST_CHORD_NOTE: u8 = 45; // Below it are the notes a timbre adds, which that synth leaves out: it holds the chord
