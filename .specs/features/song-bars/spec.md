# Song Bars Specification

**Approved**: 2026-11-01 - user: "aprovado"

## Problem Statement

Each song in the Grooves library is 1 bar in a loop, which sounds like an exercise and not like the song. A real part changes from bar to bar. The app also treats a whole pattern as one bar, so a longer pattern cannot be played, edited, shown or counted today.

## Goals

- [ ] All 14 songs play 4 consecutive bars from their tab, with at least 2 different bars
- [ ] A 4-bar song can be played, edited, saved and followed on the Editor and the Stadium
- [ ] Every saved preset and groove keeps working as 1 bar
- [x] The user approves all 14 songs by ear: "Aprovei as 14 musicas do jeito que ta"

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Patterns of 4 bars created by the user | Q1: only the songs hold 4 bars |
| A bar count other than 1 or 4 | Q1: the request is 4 bars of each song |
| Adding or removing bars on a pattern | Q1: same reason; a time signature change is the one exception, BAR-05 |
| Swing | Removed by `precise-only`; deferred in `context.md` |
| New songs | The catalog stays at 14 |
| Time signatures other than 4/4 in a song | Every shipped song is 4/4 |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Which patterns hold 4 bars | Only the 14 songs, and presets saved from them | Q1, user: "recomendacoes" | y |
| Which 4 bars | Four consecutive bars as the tab writes them, fills included; a stretch that cuts a phrase gives way to another | Q2, user: "recomendacoes" | y |
| Editor | One bar at a time, with a `1 2 3 4` selector | Q3, user: "recomendacoes" | y |
| Stadium clock | The current bar, with 16 slices and the numbers 1 to 4 | Q4, user: "recomendacoes" | y |
| Time signature change on 4 bars | Warn, then return to 1 bar | Q5, user: "recomendacoes" | y |
| Trainer | Counts real bars | Stated in the same round, user: "recomendacoes" | y |
| `POS: BAR` | Keeps counting bars since Play | Stated in the same round, user: "recomendacoes" | y |
| Groove Library on 4 bars | Enters only the bar on screen | Stated in the same round, user: "recomendacoes" | y |
| `STEPS` | Total steps over the new limit: `STEPS: 64/128`, and `STEPS: 16/128` on 1 bar | Stated in the same round, user: "recomendacoes" | y |
| The Every Day I Have the Blues tempo | The tab's 200 BPM, kept by the user's ear approval | The user has not heard the recording against the app || y - user: "aprovado" |
| Pressing another bar during playback | The grid shows that bar until the next bar starts, then follows the music again | Nobody asked; the music must not jump || y |
| Stop on 4 bars | The Editor returns to bar 1, as `POS` already does | Stop already returns to the start || y |
| `Figure` chips on 4 bars | A figure writes only in the bar on screen | Same rule as the Groove Library || y |
| `Save Groove` on 4 bars | Saves the bar on screen as a 1-bar groove | A groove holds 1 bar || y |
| Limit of one bar | Stays at 32 steps | The time signature alert keeps its meaning || y |
| Declining the time signature warning | Nothing changes: the 4 bars and the old time signature stay | The rule of the existing song confirmation || y |

**Open questions:** none.

---

## User Stories

### P1: Songs of 4 bars ⭐ MVP

**User Story**: As a drummer, I want each song to play 4 real bars so that practice sounds like the song.

**Why P1**: This is the request; everything else follows from it.

**Acceptance Criteria**:

1. Each of the 14 songs SHALL hold exactly 4 bars of 16 steps in 4/4, 64 steps in all.
2. Each song's 4 bars SHALL be 4 consecutive measures of its tab at the revision the song cites.
3. Each song's 4 bars SHALL hold at least 2 different bars.
4. Each song SHALL cite the index of its first measure, and its BPM SHALL be the tab's tempo at that measure.
5. The `Click` track SHALL mark every beat of the 4 bars, with an accent on beat 1 of bar 1 and normal hits on the others.
6. WHEN a song plays past step 64 THEN the engine SHALL return to step 1 with no gap.
7. WHEN a song is saved as a preset and loaded again THEN the system SHALL restore its 4 bars.
8. WHEN a stored preset with no bar count loads THEN the system SHALL treat it as 1 bar and keep its steps.

**Independent Test**: Play one song and hear bars 1 to 4 in order, then bar 1 again; save it and load it back.

---

### P1: Bars in the Editor

**User Story**: As a drummer, I want to see and edit one bar at a time so that a song fits the grid I already know.

**Why P1**: A song that cannot be read or edited breaks the `Open in Editor` path.

**Acceptance Criteria**:

1. WHILE the active pattern holds 4 bars the Editor SHALL show a selector with `1`, `2`, `3` and `4`.
2. WHILE the active pattern holds 1 bar the Editor SHALL show no bar selector.
3. WHEN the user presses a bar in the selector THEN the Editor SHALL show that bar's 16 steps and mark that bar as current.
4. WHEN a song loads THEN the Editor SHALL show bar 1.
5. WHILE a 4-bar pattern plays the Editor SHALL show the bar in play and mark it in the selector.
6. WHEN the user presses another bar during playback THEN the Editor SHALL show that bar until the next bar starts, and the sound SHALL not change.
7. WHEN the user edits a cell THEN the system SHALL change only that step of the bar on screen.
8. WHEN the user applies a `Figure` THEN the system SHALL write only in the bar on screen.
9. WHEN the user applies a groove from the Groove Library THEN the system SHALL write only in the bar on screen.
10. WHEN the user uses `Save Groove` THEN the system SHALL store the bar on screen as a 1-bar groove.
11. WHEN the user stops playback THEN the Editor SHALL show bar 1.
12. WHEN the user presses a bar at 1024px or 390px THEN the Editor SHALL show that bar with no sideways page scroll.

**Independent Test**: Open a song, press bar 3, edit a cell, and find only bar 3 changed.

---

### P1: Counting real bars

**User Story**: As a drummer, I want the Trainer and the position to count bars so that a song trains like any preset.

**Why P1**: Without it "every 4 bars" on a song means 16 bars and the position reads wrong.

**Acceptance Criteria**:

1. WHEN the Trainer steps by measures on a 4-bar pattern THEN the engine SHALL count each bar of 16 steps as one measure.
2. WHEN the Trainer curve is `Smooth` on a 4-bar pattern THEN the engine SHALL reach one increment in the same time as on a 1-bar pattern at that tempo.
3. WHILE a pattern plays `POS` SHALL show the bars elapsed since Play and the step inside the current bar, from `BAR 01 · STEP 01`.
4. `STEPS` SHALL show the pattern's total steps over 128: `STEPS: 64/128` on 4 bars and `STEPS: 16/128` on a 1-bar 4/4 pattern.
5. The engine SHALL hold 128 steps per track.
6. IF a time signature exceeds 32 steps per bar THEN the system SHALL show its existing alert and keep the old time signature.

**Independent Test**: Set the Trainer to +5 every 2 bars on a song and hear the tempo rise at bars 3, 5 and 7.

---

### P2: Bars in the Stadium

**User Story**: As a drummer, I want the clock to show the bar I am playing so that it stays readable from a distance.

**Why P2**: The song still plays without it, but the clock would show the wrong hits.

**Acceptance Criteria**:

1. WHILE a 4-bar pattern is active the clock SHALL draw 16 slices per ring and the numbers 1 to 4.
2. WHILE a 4-bar pattern plays the clock SHALL show the hits of the bar in play.
3. WHEN a new bar starts THEN the clock SHALL show its hits on the same step the sound reaches it.
4. WHILE a 4-bar pattern is stopped the clock SHALL show bar 1.
5. WHEN a step of a track plays THEN that track's group orb SHALL pulse as it does on 1 bar.

**Independent Test**: Play a song on the Stadium and see the rings change at each bar.

---

### P2: Time signature on 4 bars

**User Story**: As a drummer, I want a warning before a time signature change drops bars so that I do not lose a song by accident.

**Why P2**: It guards a rare path.

**Acceptance Criteria**:

1. WHEN the user changes the numerator or the denominator on a 4-bar pattern THEN the system SHALL ask for confirmation with the native dialog before changing anything.
2. WHEN the user accepts THEN the system SHALL keep bar 1, resized as a 1-bar pattern is resized today, and drop bars 2 to 4.
3. WHEN the user declines THEN the system SHALL keep the 4 bars and show the old time signature.
4. WHEN a 4-bar pattern returns to 1 bar THEN the Editor SHALL hide the bar selector.

**Independent Test**: Change `4/4` to `3/4` on a song, decline and see nothing change; repeat, accept and see 1 bar.

---

### P3: Sources and documentation

**User Story**: As a maintainer, I want the docs and the converter to match so that a future song can be added the same way.

**Why P3**: It does not change what a user hears.

**Acceptance Criteria**:

1. `scripts/tab_to_grid.js` SHALL turn a first measure into the 4 bars a song stores.
2. `README.md` SHALL describe that songs play 4 bars.
3. `.stitch/DESIGN.md` SHALL describe the bar selector and the clock's current bar.

---

## Edge Cases

- WHEN the user loads a preset of 1 bar during playback of a song at bar 3 THEN the system SHALL move to that preset by the existing load path, and `POS` SHALL keep counting.
- WHEN the song on screen is replaced from a card with unsaved edits in any bar THEN the system SHALL ask, by the existing confirmation.
- IF a stored pattern's bar count does not divide its steps exactly THEN the system SHALL treat it as 1 bar.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SNG-01 | P1: Songs of 4 bars | Tasks | Verified |
| BAR-01 | P1: Bars in the Editor | Tasks | Verified |
| CNT-01 | P1: Counting real bars | Tasks | Verified |
| STD-02 | P2: Bars in the Stadium | Tasks | Verified |
| BAR-05 | P2: Time signature on 4 bars | Tasks | Verified |
| DOC-02 | P3: Sources and documentation | Tasks | Verified |

**ID format:** one ID per story, with its criteria numbered as above: `BAR-01.3` is the third criterion of BAR-01.

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped.

---

## Sources

- [Songsterr](https://www.songsterr.com/) - the drum tabs and tempos, at the revisions in `src/songs.ts`
- `.specs/features/grooves-library/spec.md` - the songs, and the ear approval this feature takes over

---

## Success Criteria

- [x] The user approves all 14 songs by ear, with the Every Day I Have the Blues tempo decided there: "Aprovei as 14 musicas do jeito que ta", so it stays at 200 BPM
- [ ] `npm run test:js`, `npm run test:rust` and `npm run build` pass
- [ ] Every existing test not changed by this spec still passes
