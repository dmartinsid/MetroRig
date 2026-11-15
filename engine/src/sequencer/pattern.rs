// What each step of each track holds, and which step plays next
pub const TRACKS: usize = 13; // 0: Click, then the kit in src/domain/kit.ts
pub const STEPS_COUNT: usize = 192; // 4 bars of the longest bar
pub const BAR_STEPS_MAX: usize = 48; // The cells of one bar: 8 beats of sextuplets
pub const MEASURE_LENGTH_MAX: usize = 32; // A bar's straight sixteenths
pub const BARS_MAX: usize = 4;
const STRAIGHT_UNITS: u8 = 12; // A cell's length in twelfths of a sixteenth: 12 straight, 16 triplet, 8 sextuplet
const BEAT_UNITS: usize = 4 * STRAIGHT_UNITS as usize; // A quarter note, the span one tuplet fills

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
    pub(crate) cells: usize,
    // A layout that re-lays the beat now playing waits for that beat to end (TUP-40), and the grids
    // sent for it wait with it, since they count its cells
    pending: Option<usize>, // When it takes over, in twelfths of a sixteenth from the pattern start
    pending_units: [u8; STEPS_COUNT],
    pending_bar_start: [bool; STEPS_COUNT],
    pending_cells: usize,
    pending_steps: [[u8; STEPS_COUNT]; TRACKS],
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
            pending: None,
            pending_units: [STRAIGHT_UNITS; STEPS_COUNT],
            pending_bar_start: [false; STEPS_COUNT],
            pending_cells: 0,
            pending_steps: [[0; STEPS_COUNT]; TRACKS],
        };
        pattern.straighten();
        pattern
    }

    // The steps past the given ones are cleared. While a layout waits, the grid counts its cells and waits too
    pub fn update_grid(&mut self, track: usize, steps: &[u8]) -> bool {
        if track >= TRACKS || steps.len() > STEPS_COUNT {
            return false;
        }
        let track_steps = match self.pending {
            Some(_) => &mut self.pending_steps[track],
            None => &mut self.tracks[track].steps,
        };
        track_steps[..steps.len()].copy_from_slice(steps);
        track_steps[steps.len()..].fill(0);
        true
    }

    // The same length again changes nothing, so the layout and the place in it hold
    pub fn set_measure_length(&mut self, length: usize) -> bool {
        if length == 0 || length > MEASURE_LENGTH_MAX {
            return false;
        }
        if length == self.measure_length {
            return true;
        }
        self.measure_length = length;
        self.straighten();
        true
    }

    pub fn set_bars(&mut self, bars: usize) -> bool {
        if bars == 0 || bars > BARS_MAX {
            return false;
        }
        if bars == self.bars {
            return true;
        }
        self.bars = bars;
        self.straighten();
        true
    }

    // Every cell a sixteenth, as many as the bars hold. A waiting layout no longer fits, so it goes
    fn straighten(&mut self) {
        self.take_pending();
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
        // A layout that changes the beat now playing waits for its end; any other takes over now
        let at = self.next_start();
        let due = (at + BEAT_UNITS - 1) / BEAT_UNITS * BEAT_UNITS;
        if due != at && due <= self.pass() && !self.same_cells(units, at, due) {
            if self.pending.is_none() {
                for (pending, track) in self.pending_steps.iter_mut().zip(&self.tracks) {
                    *pending = track.steps;
                }
            }
            self.pending = Some(due);
            self.pending_units[..units.len()].copy_from_slice(units);
            self.pending_bar_start = bar_start;
            self.pending_cells = units.len();
            return true;
        }
        self.pending = None;
        self.units[..units.len()].copy_from_slice(units);
        self.bar_start = bar_start;
        self.cells = units.len();
        self.move_to(at);
        true
    }

    // Whether `units` holds the same cells as the playing layout from `from` to `to`
    fn same_cells(&self, units: &[u8], from: usize, to: usize) -> bool {
        cells_between(&self.units[..self.cells], from, to).eq(cells_between(units, from, to))
    }

    // The next cell keeps its time from the pattern start: the first cell starting there or after it
    fn move_to(&mut self, at: usize) {
        self.step_index = 0;
        while self.step_index < self.cells && self.next_start() < at {
            self.step_index += 1;
        }
        self.keep_step_in_pattern();
    }

    // The waiting layout and its grids take over, if one waits
    fn take_pending(&mut self) {
        if self.pending.take().is_none() {
            return;
        }
        self.units = self.pending_units;
        self.bar_start = self.pending_bar_start;
        self.cells = self.pending_cells;
        for (track, pending) in self.tracks.iter_mut().zip(&self.pending_steps) {
            track.steps = *pending;
        }
    }

    // One pass over every bar, in twelfths of a sixteenth
    fn pass(&self) -> usize {
        self.measure_length * self.bars * STRAIGHT_UNITS as usize
    }

    // When the next cell starts, in twelfths of a sixteenth from the pattern start
    pub fn next_start(&self) -> usize {
        self.units[..self.step_index].iter().map(|&unit| unit as usize).sum()
    }

    // How long a wait that ended at `at` must go on for the next cell to start, in twelfths of a sixteenth
    pub fn wait_from(&self, at: usize) -> usize {
        let pass = self.pass();
        (self.next_start() + pass - at) % pass
    }

    fn keep_step_in_pattern(&mut self) {
        if self.step_index >= self.length() {
            self.step_index = 0;
        }
    }

    // The next step plays bar 1, in the newest layout
    pub fn restart(&mut self) {
        self.take_pending();
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

    // The playing beat ends where a waiting layout is due, and the next cell is the new layout's
    pub fn advance(&mut self) {
        self.step_index = (self.step_index + 1) % self.length();
        if let Some(due) = self.pending {
            if self.next_start() == due % self.pass() {
                self.take_pending();
                self.move_to(due % self.pass());
            }
        }
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

// Each cell's start and length, for the cells that start from `from` up to `to`
fn cells_between(units: &[u8], from: usize, to: usize) -> impl Iterator<Item = (usize, u8)> + '_ {
    let cells = units.iter().scan(0, |start, &unit| {
        let cell = (*start, unit);
        *start += unit as usize;
        Some(cell)
    });
    cells.filter(move |&(start, _)| start >= from && start < to)
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
    fn new_units_keep_the_next_cell_on_its_time() {
        let mut pattern = Pattern::new();
        // Cell 15 is past the triplets' 12 cells: it plays out its beat, and bar 1 starts the triplets
        pattern.step_index = 15;
        assert!(pattern.set_step_units(&bar_units(&[3, 3, 3, 3])));
        assert_eq!(pattern.index(), 15);
        pattern.advance();
        assert_eq!((pattern.index(), pattern.length()), (0, 12));
        // Cell 10 of the triplets starts at 160 twelfths, in beat 4. A re-lay of beat 1 takes over now,
        // on the cell that starts at 160 in the new layout
        pattern.step_index = 10;
        assert!(pattern.set_step_units(&bar_units(&[6, 3, 3, 3])));
        assert_eq!(pattern.index(), 13);
        assert_eq!(pattern.wait_from(160), 0);
    }

    #[test]
    fn tup_40_a_re_lay_of_the_playing_beat_waits_with_its_grids() {
        let mut pattern = Pattern::new();
        assert!(pattern.set_step_units(&bar_units(&[3, 3, 3, 3])));
        assert!(pattern.update_grid(1, &[1; 12]));
        pattern.step_index = 10; // Beat 4's second triplet cell

        // Beat 4 becomes sixteenths: the triplet and its grid play out, the new ones wait for bar 1
        assert!(pattern.set_step_units(&bar_units(&[4, 4, 4, 4])));
        assert!(pattern.update_grid(1, &[2; 16]));
        assert_eq!((pattern.index(), pattern.units(), pattern.step(1), pattern.length()), (10, 16, 1, 12));
        pattern.advance();
        assert_eq!((pattern.index(), pattern.units(), pattern.step(1)), (11, 16, 1));
        pattern.advance();
        assert_eq!((pattern.index(), pattern.units(), pattern.step(1), pattern.length()), (0, 12, 2, 16));

        // A change of length drops a waiting layout; a restart takes it now
        pattern.step_index = 2;
        assert!(pattern.set_step_units(&bar_units(&[6, 4, 4, 4])));
        assert_eq!(pattern.length(), 16);
        pattern.restart();
        assert_eq!((pattern.index(), pattern.units(), pattern.length()), (0, 8, 18));
        pattern.step_index = 3;
        assert!(pattern.set_step_units(&bar_units(&[4, 4, 4, 4])));
        assert!(pattern.set_measure_length(12));
        assert_eq!((pattern.length(), pattern.units()), (12, 12));
    }

    #[test]
    fn the_same_length_and_bars_keep_the_layout_and_the_place() {
        let mut pattern = Pattern::new();
        assert!(pattern.set_step_units(&bar_units(&[6, 6, 4, 4])));
        pattern.step_index = 10;
        assert!(pattern.set_measure_length(16));
        assert!(pattern.set_bars(1));
        assert_eq!((pattern.index(), pattern.next_start(), pattern.length()), (10, 80, 20));
    }
}
