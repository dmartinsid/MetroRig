# Tuplets Specification

**Approved**: 2026-11-13 - user: "approved"

## Problem Statement

MetroRig's grid knows one subdivision: every step is a sixteenth, in the app and in the engine's clock. A drummer cannot write a triplet fill, a shuffle or a sextuplet roll, so the grooves they practise lose the figures they most need to drill. The song list also lacks two Foo Fighters parts the user wants to train: the 7/4 riff of Times Like These and the chorus of Everlong.

## Goals

- [ ] Any beat of a /4 bar can hold a triplet or a sextuplet, written with one click and heard at its exact place in time.
- [ ] Times Like These (7/4 Intro Riff) and Everlong (Chorus) play from the Grooves screen like the other 14 songs.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Tuplets in /8 and /16 signatures | Q3: a tuplet fills one quarter note |
| Quintuplets, septuplets and nested tuplets | Q2 chose triplets and sextuplets only |
| A factory groove or song that shows tuplets | Q19: tuplets stay an Editor tool |
| Fetching tabs from Songsterr | Songsterr declines automated access (Q6) |
| Guitar Pro files in the repository | Q17: third-party content; only extracted measures go in |
| Swing or shuffle feel as a setting | Not asked; a shuffle is written with triplets |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Each bar of a 4-bar pattern has its own tuplet beats | A tuplet belongs to one beat of one bar | Q1: "cada tempo do compasso", and songs hold different bars | y |
| Nearest cell when two cells are equally near | The earlier cell | Q5 settled "nearest"; a hit never moves later than a tie demands | y - delegated by Q5's rule, stated with the spec |
| Clicking one cell of a tuplet beat with no figure selected | Cycles its value as a straight cell does today | Q4 changed only the figures | y |
| A groove applied to a bar of another length | Beat n of the bar takes beat n mod B of the groove, its kind included | Today's rule repeats the groove; beats keep a tuplet whole | y - follows Q13 |
| Tuplet hits in the Stadium | Each cell takes its slice at its real place in the bar | Q8 | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Write tuplets in the Editor ⭐ MVP

**User Story**: As a drummer, I want to turn a beat into a triplet or a sextuplet so that I can practise fills and shuffles the sixteenth grid cannot hold.

**Why P1**: It is the feature the user asked for.

**Acceptance Criteria**:

1. WHEN the user applies `Triplet` to a beat of a /4 bar THEN the system SHALL turn that beat of that bar into 3 cells on every track and write a normal hit on each of the 3 cells of the clicked track (TUP-01)
2. WHEN the user applies `Triplet Rest` to a beat of a /4 bar THEN the system SHALL turn that beat into 3 cells on every track and leave the clicked track's 3 cells empty (TUP-02)
3. WHEN the user applies `Sextuplet` to a beat of a /4 bar THEN the system SHALL turn that beat into 6 cells on every track and write a normal hit on each of the 6 cells of the clicked track (TUP-03)
4. WHEN the user applies `Sextuplet Rest` to a beat of a /4 bar THEN the system SHALL turn that beat into 6 cells on every track and leave the clicked track's 6 cells empty (TUP-04)
5. WHEN the user applies a straight figure to a tuplet beat THEN the system SHALL turn that beat into 4 cells on every track and write the figure on the clicked track (TUP-05)
6. WHEN a beat changes kind THEN the system SHALL move each hit of every other track to the cell whose start lies nearest the hit's start, the earlier cell on a tie (TUP-06)
7. WHEN a triplet beat becomes a sextuplet THEN the system SHALL move the hit of triplet cell k to sextuplet cell 2k (TUP-07)
8. WHEN two hits land on one cell in a change of kind THEN the system SHALL keep the stronger, accent over normal over ghost (TUP-08)
9. WHEN the user clicks one cell of a tuplet beat with no figure selected THEN the system SHALL cycle that cell's value as it cycles a straight cell (TUP-09)
10. WHILE the bar on view is in /8 or /16 the system SHALL disable `Triplet`, `Triplet Rest`, `Sextuplet` and `Sextuplet Rest` (TUP-10)
11. WHEN a tuplet figure is applied in one bar of a 4-bar pattern THEN the system SHALL leave the other 3 bars unchanged (TUP-11)

**Independent Test**: Apply `Triplet` to beat 4 of a 4/4 bar on the Snare and see 3 Snare hits in that beat, with every other track showing 3 cells there.

---

### P1: Hear tuplets in time ⭐ MVP

**User Story**: As a drummer, I want each tuplet hit to sound at its exact place in the beat so that the figure I practise is the real one.

**Why P1**: A tuplet drawn but played on the sixteenth grid teaches the wrong rhythm.

**Acceptance Criteria**:

1. WHILE playing the system SHALL start cell k of a triplet beat k/3 of a beat after the beat's start, within 1 sample (TUP-12)
2. WHILE playing the system SHALL start cell k of a sextuplet beat k/6 of a beat after the beat's start, within 1 sample (TUP-13)
3. WHILE playing a pattern with no tuplet beat the system SHALL produce the same output, sample for sample, as before this feature (TUP-14)
4. WHEN a beat changes kind THEN the system SHALL keep the Click hit at the beat's start on the beat's first cell (TUP-15)
5. WHILE the Trainer steps every N bars the system SHALL count a bar holding tuplet beats as one bar (TUP-16)

**Independent Test**: Render a 4/4 bar with a Snare triplet on beat 2 at 120 BPM and measure the onsets at 0.5 s, 0.6667 s and 0.8333 s.

---

### P1: Room for sextuplets

**User Story**: As a drummer, I want a 7/4 or 8/4 bar of sextuplets to fit so that the length limit does not stop a figure the Editor offers.

**Why P1**: Q9: sextuplets push a bar past 32 cells.

**Acceptance Criteria**:

1. The system SHALL hold up to 48 cells in one bar and 192 cells in a pattern (TUP-17)
2. The system SHALL show `STEPS: n/192` in the footer, n being the pattern's cell count over all its bars (TUP-18)
3. IF the user picks a time signature whose straight bar exceeds 32 steps THEN the system SHALL refuse it as it does today (TUP-19)

**Independent Test**: In 8/4, apply `Sextuplet` to all 8 beats, play, and read `STEPS: 48/192`.

---

### P1: Read tuplets in the Editor and the Stadium

**User Story**: As a drummer, I want to see where a tuplet sits so that I read the bar as written music.

**Why P1**: A tuplet the eye cannot place is not practised.

**Acceptance Criteria**:

1. The system SHALL draw a triplet beat's 3 cells, and a sextuplet beat's 6 cells, across the width of a straight beat's 4 cells (TUP-20)
2. The system SHALL show the label `3` above every triplet beat and `6` above every sextuplet beat (TUP-21)
3. The system SHALL mark an empty cell of a tuplet beat as sustained by the same rule as a straight beat: it follows the beat's first hit and the beat holds more than one hit (TUP-22)
4. The system SHALL draw each Stadium slice from the cell's start to its end as fractions of the bar (TUP-23)
5. WHILE playing the system SHALL light, in the Stadium, the beat that holds the cell playing (TUP-24)

**Independent Test**: Open a bar with a triplet on beat 2 in the Editor and the Stadium and see `3` above 3 equal cells, and 3 slices sharing a quarter of the ring.

---

### P2: Keep tuplets through edits and storage

**User Story**: As a drummer, I want my tuplets to survive a signature change, a save and a groove so that I do not write them twice.

**Why P2**: Writing and hearing them works without it, but losing them hurts.

**Acceptance Criteria**:

1. WHEN the time signature changes between /4 signatures THEN the system SHALL keep the kind of every beat that still exists and make every new beat straight (TUP-25)
2. WHEN the time signature changes to /8 or /16 THEN the system SHALL make every beat straight, moving hits by TUP-06 and TUP-08 (TUP-26)
3. WHEN a preset holding tuplets is saved and the page reloads THEN the system SHALL load it with the same beats and hits (TUP-27)
4. WHEN a preset saved before this feature loads THEN the system SHALL load it with every beat straight and its hits unchanged (TUP-28)
5. WHEN the user saves a groove from a bar holding tuplets THEN the system SHALL store each beat's kind with its hits (TUP-29)
6. WHEN a groove of B beats is applied to a /4 bar THEN the system SHALL give beat n of the bar the kind and hits of beat n mod B of the groove (TUP-30)
7. WHEN a groove holding tuplets is applied to a /8 or /16 bar THEN the system SHALL make its beats straight by TUP-06 and TUP-08, then apply it as today (TUP-31)

**Independent Test**: Write a triplet, save the preset, reload, and see the triplet; change 4/4 to 5/4 and see it still there.

---

### P1: Train Times Like These and Everlong

**User Story**: As a drummer, I want the Times Like These riff and the Everlong chorus among the songs so that I practise them at their tempo.

**Why P1**: The user asked for both.

**Acceptance Criteria**:

1. The system SHALL list `Times Like These` by `Foo Fighters` under `Rock`, section `Intro Riff`, at 144 BPM in 7/4, holding 4 bars equal to measures 8 to 11 (from 0) of the drum track of `Foo Fighters - Times Like These (ver 6 by nicholasp248).gpx` (TUP-32)
2. The system SHALL list `Everlong` by `Foo Fighters` under `Rock`, section `Chorus`, at 160 BPM in 4/4, holding 4 bars equal to measures 64 to 67 (from 0) of the drum track of `Foo Fighters - Everlong (ver 11 by pierrelateur).gp` (TUP-33)
3. The system SHALL record each new song's source as site `Ultimate Guitar`, the file name and the first measure (TUP-34)
4. WHEN the development reader is given a `.gp` or `.gpx` file and a first measure THEN the system SHALL print 4 bars of its drum track as MetroRig grid, tuplet beats included (TUP-35)
5. IF a drum note falls on no cell of its beat THEN the reader SHALL stop with an error naming the measure (TUP-36)
6. The repository SHALL hold no Guitar Pro file, and its test fixture SHALL hold the 4 extracted drum measures of each new song (TUP-37)
7. WHEN the user plays both songs in the running app THEN the user SHALL approve how they sound (TUP-38)

**Independent Test**: On Grooves, pick `Rock`, play `Times Like These`, and hear 4 bars of 7/4 at 144 BPM.

---

## Edge Cases

- IF a tuplet figure is applied in /8 or /16 by keyboard or any path other than its button THEN the system SHALL leave the bar unchanged (TUP-39)
- WHEN the user changes a beat's kind during playback THEN the system SHALL play the new cells from the next pass over that beat (TUP-40)
- WHEN a bar's beats are all sextuplets in 8/4 THEN the system SHALL hold the bar's 48 cells (covered by TUP-17)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TUP-01 | P1: Write tuplets | Design | Implementing |
| TUP-02 | P1: Write tuplets | Design | Implementing |
| TUP-03 | P1: Write tuplets | Design | Implementing |
| TUP-04 | P1: Write tuplets | Design | Implementing |
| TUP-05 | P1: Write tuplets | Design | Implementing |
| TUP-06 | P1: Write tuplets | Design | Implementing |
| TUP-07 | P1: Write tuplets | Design | Implementing |
| TUP-08 | P1: Write tuplets | Design | Implementing |
| TUP-09 | P1: Write tuplets | Design | Pending |
| TUP-10 | P1: Write tuplets | Design | Pending |
| TUP-11 | P1: Write tuplets | Design | Implementing |
| TUP-12 | P1: Hear tuplets | Design | Implementing |
| TUP-13 | P1: Hear tuplets | Design | Implementing |
| TUP-14 | P1: Hear tuplets | Design | Pending |
| TUP-15 | P1: Hear tuplets | Design | Implementing |
| TUP-16 | P1: Hear tuplets | Design | Pending |
| TUP-17 | P1: Room for sextuplets | Design | Implementing |
| TUP-18 | P1: Room for sextuplets | Design | Pending |
| TUP-19 | P1: Room for sextuplets | Design | Pending |
| TUP-20 | P1: Read tuplets | Design | Pending |
| TUP-21 | P1: Read tuplets | Design | Pending |
| TUP-22 | P1: Read tuplets | Design | Pending |
| TUP-23 | P1: Read tuplets | Design | Implementing |
| TUP-24 | P1: Read tuplets | Design | Pending |
| TUP-25 | P2: Keep tuplets | Design | Pending |
| TUP-26 | P2: Keep tuplets | Design | Pending |
| TUP-27 | P2: Keep tuplets | Design | Pending |
| TUP-28 | P2: Keep tuplets | Design | Pending |
| TUP-29 | P2: Keep tuplets | Design | Pending |
| TUP-30 | P2: Keep tuplets | Design | Pending |
| TUP-31 | P2: Keep tuplets | Design | Pending |
| TUP-32 | P1: Train songs | Design | Pending |
| TUP-33 | P1: Train songs | Design | Pending |
| TUP-34 | P1: Train songs | Design | Pending |
| TUP-35 | P1: Train songs | Design | Pending |
| TUP-36 | P1: Train songs | Design | Pending |
| TUP-37 | P1: Train songs | Design | Pending |
| TUP-38 | P1: Train songs | Design | Pending |
| TUP-39 | Edge cases | Design | Implementing |
| TUP-40 | Edge cases | Design | Pending |

**Coverage:** 40 total, 0 mapped to tasks, 40 unmapped ⚠️ (tasks not yet written)

---

## Sources

- `.specs/features/tuplets/context.md` - the 19 answers that settle this spec
- `~/Downloads/Foo Fighters - Times Like These (ver 6 by nicholasp248).gpx` - Ultimate Guitar, GP6: 144 BPM, 7/4 at measures 8-15
- `~/Downloads/Foo Fighters - Everlong (ver 11 by pierrelateur).gp` - Ultimate Guitar, GP8: 160 BPM, Chorus at measures 64-77

---

## Success Criteria

- [ ] A triplet fill on beat 4 of a 4/4 bar is written with one click and heard at 1/3 and 2/3 of the beat.
- [ ] Both Foo Fighters songs play from the Grooves screen, approved by the user's ear.
- [ ] Every pattern saved before this feature plays sample for sample as before.
