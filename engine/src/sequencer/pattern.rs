// What each step of each track holds, and which step plays next
pub const TRACKS: usize = 13; // 0: Click, then the kit in src/domain/kit.ts
pub const STEPS_COUNT: usize = 192; // 4 bars of the longest bar
pub const BAR_STEPS_MAX: usize = 48; // The cells of one bar: 8 beats of sextuplets
pub const MEASURE_LENGTH_MAX: usize = 32; // A bar's straight sixteenths
pub const BARS_MAX: usize = 4;
const STRAIGHT_UNITS: u8 = 12; // A cell's length in twelfths of a sixteenth: 12 straight, 16 triplet, 8 sextuplet

pub struct SequencerTrack {
    pub(crate) steps: [u8; STEPS_COUNT], // 0 = Off, 1 = Low, 2 = High
}

pub struct Pattern {
    pub(crate) tracks: [SequencerTrack; TRACKS],
    pub(crate) step_index: usize,
    pub(crate) measure_length: usize, // The straight sixteenths of one bar
    pub(crate) bars: usize,
    units: [u8; STEPS_COUNT], // Each cell's length
    bar_start: [bool; STEPS_COUNT],
    cells: usize,
}

impl Pattern {
    pub fn new() -> Self {
        let mut pattern = Pattern {
            tracks: std::array::from_fn(|_| SequencerTrack { steps: [0; STEPS_COUNT] }),
            step_index: 0,
            measure_length: 16,
            bars: 1,
            units: [STRAIGHT_UNITS; STEPS_COUNT],
            bar_start: [false; STEPS_COUNT],
            cells: 0,
        };
        pattern.straighten();
        pattern
    }

    // The steps past the given ones are cleared
    pub fn update_grid(&mut self, track: usize, steps: &[u8]) -> bool {
        if track >= TRACKS || steps.len() > STEPS_COUNT {
            return false;
        }
        let track_steps = &mut self.tracks[track].steps;
        track_steps[..steps.len()].copy_from_slice(steps);
        track_steps[steps.len()..].fill(0);
        true
    }

    pub fn set_measure_length(&mut self, length: usize) -> bool {
        if length == 0 || length > MEASURE_LENGTH_MAX {
            return false;
        }
        self.measure_length = length;
        self.straighten();
        true
    }

    pub fn set_bars(&mut self, bars: usize) -> bool {
        if bars == 0 || bars > BARS_MAX {
            return false;
        }
        self.bars = bars;
        self.straighten();
        true
    }

    // Every cell a sixteenth, as many as the bars hold
    fn straighten(&mut self) {
        self.cells = self.measure_length * self.bars;
        self.units[..self.cells].fill(STRAIGHT_UNITS);
        for (cell, start) in self.bar_start[..self.cells].iter_mut().enumerate() {
            *start = cell % self.measure_length == 0;
        }
        self.keep_step_in_pattern();
    }

    // Each cell's length. Refused, keeping the last good layout: more than STEPS_COUNT cells, a length
    // other than 8, 12 or 16, a bar past BAR_STEPS_MAX cells, or lengths that do not fill the bars exactly
    pub fn set_step_units(&mut self, units: &[u8]) -> bool {
        if units.is_empty() || units.len() > STEPS_COUNT {
            return false;
        }
        let bar_units = self.measure_length * STRAIGHT_UNITS as usize;
        let mut bar_start = [false; STEPS_COUNT];
        let (mut filled, mut bar_cells, mut bars) = (0, 0, 0);
        for (cell, &unit) in units.iter().enumerate() {
            if ![8, 12, 16].contains(&unit) {
                return false;
            }
            bar_start[cell] = filled == 0;
            filled += unit as usize;
            bar_cells += 1;
            if filled > bar_units || bar_cells > BAR_STEPS_MAX {
                return false;
            }
            if filled == bar_units {
                (filled, bar_cells, bars) = (0, 0, bars + 1);
            }
        }
        if filled != 0 || bars != self.bars {
            return false;
        }
        self.units[..units.len()].copy_from_slice(units);
        self.bar_start = bar_start;
        self.cells = units.len();
        self.keep_step_in_pattern();
        true
    }

    fn keep_step_in_pattern(&mut self) {
        if self.step_index >= self.length() {
            self.step_index = 0;
        }
    }

    // The next step plays bar 1
    pub fn restart(&mut self) {
        self.step_index = 0;
    }

    pub fn step(&self, track: usize) -> u8 {
        self.tracks[track].steps[self.step_index]
    }

    pub fn is_bar_start(&self) -> bool {
        self.bar_start[self.step_index]
    }

    // The length of the cell about to play, in twelfths of a sixteenth
    pub fn units(&self) -> u8 {
        self.units[self.step_index]
    }

    pub fn advance(&mut self) {
        self.step_index = (self.step_index + 1) % self.length();
    }

    pub fn index(&self) -> usize {
        self.step_index
    }

    pub fn measure_length(&self) -> usize {
        self.measure_length
    }

    fn length(&self) -> usize {
        self.cells
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // A 4/4 bar's units with the given beats as cells: 4 straight, 3 triplet, 6 sextuplet
    fn bar_units(beats: &[usize]) -> Vec<u8> {
        beats.iter().flat_map(|&cells| std::iter::repeat((48 / cells) as u8).take(cells)).collect()
    }

    fn bar_starts(pattern: &mut Pattern) -> Vec<usize> {
        pattern.restart();
        let mut starts = Vec::new();
        for _ in 0..pattern.length() {
            if pattern.is_bar_start() {
                starts.push(pattern.index());
            }
            pattern.advance();
        }
        starts
    }

    #[test]
    fn bar_starts_follow_the_running_sum_of_units() {
        let mut pattern = Pattern::new();
        pattern.set_measure_length(16);
        pattern.set_bars(2);
        let units: Vec<u8> = [bar_units(&[4, 3, 4, 4]), bar_units(&[6, 4, 4, 4])].concat();
        assert!(pattern.set_step_units(&units));
        assert_eq!(pattern.length(), 33);
        assert_eq!(bar_starts(&mut pattern), vec![0, 15]);
        assert_eq!(pattern.index(), 0); // 33 cells wrap to the first
        pattern.step_index = 4;
        assert_eq!(pattern.units(), 16);
        pattern.step_index = 15;
        assert_eq!(pattern.units(), 8);
    }

    #[test]
    fn tup_17_bar_holds_48_cells_and_pattern_192() {
        let mut pattern = Pattern::new();
        pattern.set_measure_length(32);
        let sextuplets = bar_units(&[6; 8]);
        assert_eq!(sextuplets.len(), 48);
        assert!(pattern.set_step_units(&sextuplets));
        assert_eq!(pattern.length(), 48);

        pattern.set_bars(4);
        let four = sextuplets.repeat(4);
        assert!(pattern.set_step_units(&four));
        assert_eq!(pattern.length(), 192);
        assert_eq!(bar_starts(&mut pattern), vec![0, 48, 96, 144]);
        let grid = [1u8; STEPS_COUNT];
        assert!(pattern.update_grid(1, &grid));
        assert_eq!(pattern.tracks[1].steps[191], 1);

        // A 49th cell in one bar is refused, and the layout stays
        pattern.set_bars(1);
        assert!(pattern.set_step_units(&sextuplets));
        assert!(!pattern.set_step_units(&[8; 49]));
        assert_eq!(pattern.length(), 48);
        assert!(!pattern.set_step_units(&[8; STEPS_COUNT + 1]));
        assert!(!pattern.update_grid(1, &[1u8; STEPS_COUNT + 1]));
    }

    #[test]
    fn refused_units_keep_the_last_good_layout() {
        let mut pattern = Pattern::new();
        let good = bar_units(&[4, 3, 4, 4]);
        assert!(pattern.set_step_units(&good));

        let mut wrong_unit = good.clone();
        wrong_unit[0] = 10;
        let short = bar_units(&[4, 3, 4]);
        let long = bar_units(&[4, 3, 4, 4, 4]);
        let two_bars = [good.clone(), good.clone()].concat();
        for (units, what) in [(&wrong_unit, "a unit of 10"), (&short, "a short bar"), (&long, "a long bar"), (&two_bars, "2 bars in a 1-bar pattern"), (&vec![], "no cells")] {
            assert!(!pattern.set_step_units(units), "{}", what);
            assert_eq!(pattern.length(), 15, "{}", what);
            assert_eq!(bar_starts(&mut pattern), vec![0], "{}", what);
        }

        // A cell that crosses the bar line is refused
        pattern.set_bars(2);
        let crossing: Vec<u8> = [vec![12; 15], vec![16], vec![8], vec![12; 15]].concat();
        assert_eq!(crossing.iter().map(|&u| u as usize).sum::<usize>(), 2 * 16 * 12);
        assert!(!pattern.set_step_units(&crossing));
        assert_eq!(pattern.length(), 32);
    }

    #[test]
    fn length_and_bars_reset_the_units_to_straight() {
        let mut pattern = Pattern::new();
        assert!(pattern.set_step_units(&bar_units(&[3, 3, 3, 3])));
        pattern.step_index = 11;
        assert!(pattern.set_measure_length(12));
        assert_eq!(pattern.length(), 12);
        assert_eq!(pattern.index(), 11);
        assert_eq!(pattern.units(), 12);
        assert!(pattern.set_step_units(&bar_units(&[6, 6, 6])));
        assert!(pattern.set_bars(2));
        assert_eq!(pattern.length(), 24);
        assert_eq!(bar_starts(&mut pattern), vec![0, 12]);
        assert!(!pattern.set_measure_length(33)); // The straight bar stops at 32 sixteenths
    }

    #[test]
    fn units_past_the_end_return_the_step_to_the_start() {
        let mut pattern = Pattern::new();
        pattern.step_index = 15;
        assert!(pattern.set_step_units(&bar_units(&[3, 3, 3, 3])));
        assert_eq!(pattern.index(), 0);
        pattern.step_index = 10;
        assert!(pattern.set_step_units(&bar_units(&[6, 4, 4, 4])));
        assert_eq!(pattern.index(), 10);
    }
}
