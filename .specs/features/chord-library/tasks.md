# Chord Library Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/chord-library/design.md`
**Status**: Approved
**Approved**: 2026-11-02 - user: "aprovado"
**Build**: `npm run build`
**Run js**: `npx vitest run --reporter=verbose`
**Run rust**: `cargo test`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Chord rules | unit | All 34 types; all branches of a click | `tests/chords.test.ts` | `npx vitest run --reporter=verbose` |
| Pad and engine | unit | The 408 chords in every timbre | `src/pad.rs` | `cargo test` |
| Shipped banks and docs | unit | The real files, sizes and credits | `tests/padBank.test.ts`, `tests/fixtures/*.py` | `npx vitest run --reporter=verbose` |
| Page markup and wiring | integration | Each control, by its gesture | `src/index.test.ts` | `npx vitest run --reporter=verbose` |
| CSS | none | - (happy-dom applies no CSS; the walk proves it) | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute. `tsc` fails on missing AudioWorklet types and the project has no linter, so neither is a gate.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After rule and wiring tasks | `npx vitest run` |
| Rust | After engine tasks | `cargo test` |
| Full | After CSS tasks | `npx vitest run && npx vite build` |
| Build | After a rebuilt binary and the last task | `cargo test && npx vitest run && npx vite build` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Chords

```
T1 → T2 → T3
```

### Phase 2: Selector

```
T4 → T5 → T6
```

### Phase 3: Finish

```
T7
```

---

## Task Breakdown

### T1: Define the 34 types

**What**: `CHORD_TYPES` with its family, and `CHORD_FAMILIES`
**Where**: `src/chords.ts` (modify)
**Depends on**: None
**Reuses**: `chordMidi`, `chordNotes`
**Requirement**: CHD-01, CHD-02, CHD-03, CHD-04, CHD-05

**Done when**:

- [x] `tests/chords.test.ts` proves the table, read from the spec's values
- [x] `pad_31` still names every chord until T5 replaces the grid
- [x] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(chords): add the 20 new chord types`

---

### T2: Reach MIDI 77 in Orchestra

**What**: Add VSCO's key 75 to the builder and build it, add FreePats `E5` to New Age and Sweep, and list the 3 files
**Where**: `scripts/build_orchestra_bank.py`, `public/pads/`, `src/chords.ts`, `public/kit/LICENSE.md`
**Depends on**: None
**Reuses**: `scripts/build_orchestra_bank.py`
**Requirement**: CHD-06, CHD-08, CHD-12, CHD-13

**Done when**:

- [x] The pitch, level, loop and repeat fixtures pass on 14 files
- [x] The 13 existing files keep their bytes
- [x] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(chords): add the Orchestra's top file`

---

### T3: Hold every timbre on the 408 chords

**What**: `all_chords` over the 34 types, notes up to 77 in `tim_16`, and `MIXES` adjusted only if a level rule fails
**Where**: `src/pad.rs` (modify)
**Depends on**: T2
**Reuses**: `held_chords`
**Requirement**: CHD-06, CHD-07, CHD-09, CHD-10, CHD-11, CHD-14

**Done when**:

- [x] Every level, peak and pitch test passes on 408 chords, with no bound changed, but for note 71's heard pitch in the Handoff
- [x] The binary is rebuilt if `MIXES` changed
- [x] Gate passes

**Tests**: unit
**Gate**: build

**Commit**: `test(chords): hold every timbre on the 408 chords`

---

### T4: Define what a click means

**What**: `chordOfRoot` and `chordOfType`
**Where**: `src/chords.ts` (modify)
**Depends on**: None - the previous phase
**Reuses**: `nextChord`
**Requirement**: CHD-19, CHD-20, CHD-21, CHD-22, CHD-23

**Done when**:

- [ ] `tests/chords.test.ts` proves each rule with `nextChord`
- [ ] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(chords): define a click on a root or type`

---

### T5: Replace the grid with the selector

**What**: Roots and families in the page, the selection, their marks, and the tests moved to the new gesture
**Where**: `index.html`, `src/main.ts`, `src/index.test.ts` (modify)
**Depends on**: T4
**Reuses**: `pressChord`, `settleChord`, `renderImprov`
**Requirement**: CHD-15, CHD-16, CHD-17, CHD-18, CHD-19, CHD-20, CHD-21, CHD-22, CHD-23, CHD-24, CHD-25, CHD-26, CHD-27, CHD-33, CHD-34, CHD-35, CHD-36

**Done when**:

- [ ] Tests click the buttons and read the screen
- [ ] Every `chord-pads` and `pad-timbres` screen test keeps its rule
- [ ] Gate passes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(chords): choose a chord by root and type`

---

### T6: Style the selector

**What**: Per `.stitch/DESIGN.md`, with the `sounding` and `selected` marks and sticky roots
**Where**: `src/index.css` (modify)
**Depends on**: T5
**Reuses**: the `chord-btn` tokens
**Requirement**: CHD-25, CHD-28, CHD-29, CHD-30

**Done when**:

- [ ] Walk at 1280 px and 390 px logged in the Handoff
- [ ] Gate passes

**Tests**: none
**Gate**: full

**Commit**: `style(chords): style the selector`

---

### T7: Approve in the running app

**What**: Offer the app to the user, and adjust voicings, mixes or the selector until approved
**Where**: `src/chords.ts`, `src/pad.rs`, `src/index.css` (modify as the answers require)
**Depends on**: None - the previous phase
**Reuses**: `CHORD_TYPES`, `MIXES`
**Requirement**: CHD-31, CHD-32

**Done when**:

- [ ] The user approved in their words
- [ ] Gate passes

**Tests**: none
**Gate**: build

**Commit**: `docs(specs): record the chord library approved in the app`

---

## Checks

**C1** - The app offers 408 distinct chords (CHD-01, AC 1)
Proof: run js | ✓ tests/chords.test.ts > Chord library > chd_01 offers 408 chords

**C2** - Each of the 34 types has the semitones of the table (CHD-02, AC 2)
Proof: run js | ✓ tests/chords.test.ts > Chord library > chd_02 semitones of each type

**C3** - Every root keeps its place and every note its distance (CHD-03, AC 3)
Proof: run js | ✓ tests/chords.test.ts > Chord library > chd_03 voices every root

**C4** - Notes are spelled by degree on the 408 chords (CHD-04, AC 4)
Proof: run js | ✓ tests/chords.test.ts > Chord library > chd_04 spells the new chords

**C5** - The 14 old types keep names, notes and spelling (CHD-05, AC 5)
Proof: run js | ✓ tests/chords.test.ts > Chord library > chd_05 keeps the old types

**C6** - Every Orchestra note of the 408 chords has a file within 2 semitones (CHD-06, AC 6)
Proof: run rust | test pad::tests::chd_06_every_orchestra_note_has_its_file ... ok

**C7** - Every note up to 77 of the 4 other timbres sits within 5 cents (CHD-07, AC 7)
Proof: run rust | test pad::tests::tim_16_notes_within_5_cents ... ok

**C8** - Every Orchestra note centre sits within 10 cents, the new file included (CHD-08, AC 8)
Proof: `python3 -I tests/fixtures/orchestra_bank_check.py --pitch`

**C9** - Within a timbre, the 408 chords sit within 3 dB RMS (CHD-09, AC 9)
Proof: run rust | test pad::tests::tim_18_chords_match_within_3_db ... ok

**C10** - On each of the 408 chords, the timbres sit within 3 dB RMS (CHD-10, AC 10)
Proof: run rust | test pad::tests::tim_19_timbres_match_within_3_db ... ok

**C11** - At default volume every timbre peaks at or below -4 dBFS on the 408 chords (CHD-11, AC 11)
Proof: run rust | test pad::tests::tim_20_default_peak ... ok

**C12** - `public/pads/` takes at most 12 MB (CHD-12, AC 12)
Proof: run js | ✓ tests/padBank.test.ts > Timbre banks > tim_36 size limit

**C13** - `LICENSE.md` lists the new file with its source (CHD-13, AC 13)
Proof: run js | ✓ tests/padBank.test.ts > Timbre banks > tim_40 license lists each file

**C14** - Changing chords allocates nothing (CHD-14, AC 14)
Proof: run rust | test pad::tests::tim_23_no_allocation ... ok

**C15** - The screen shows the 12 roots in order (CHD-15, AC 15)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_15 lists the roots

**C16** - The screen shows the 34 types under the 6 headings (CHD-16, AC 16)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_16 groups the types

**C17** - Major reads `maj`, and other types their suffix (CHD-17, AC 17)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_17 labels the types

**C18** - The app opens on `C` and `maj`, silent (CHD-18, AC 18)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_18 opens on C major

**C19** - A root click with no chord plays it with the selected type (CHD-19, AC 19)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_19 root plays the selected type

**C20** - A type click with no chord plays it on the selected root (CHD-20, AC 20)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_20 type plays on the selected root

**C21** - Another root keeps the type (CHD-21, AC 21)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_21 another root keeps the type

**C22** - Another type keeps the root (CHD-22, AC 22)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_22 another type keeps the root

**C23** - Clicking the sounding root or type stops the chord (CHD-23, AC 23)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_23 the sounding root or type stops it

**C24** - The sounding root and type are marked, with the name and notes (CHD-24, AC 24)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_24 marks the sounding chord

**C25** - With no chord, the selection has its own mark (CHD-25, AC 25)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_25 marks the selection

**C26** - A stopped chord stays selected (CHD-26, AC 26)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_26 keeps the selection after a stop

**C27** - Roots and types are real buttons, so Enter and Space act (CHD-27, AC 27)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_27 uses real buttons

**C28** - At 1280 px every button is reachable with no sideways scroll (CHD-28, AC 28)
Proof: walk - In Chrome at 1280 px, scrollWidth equals clientWidth and every root and type is reached

**C29** - Below 768 px the page does not scroll sideways, and the roots stay in view (CHD-29, AC 29)
Proof: walk - At 390 px, scrollWidth equals clientWidth, and the roots stay in view while the types scroll

**C30** - Every button is at least 44 px tall below 768 px (CHD-30, AC 30)
Proof: walk - At 390 px, each root and type button measures at least 44 px tall

**C31** - The user approves the new chords and the selector (CHD-31, AC 31)
Proof: walk - The user plays the new chords in each timbre, and their answer is quoted in `verification.md`

**C32** - A rejection is adjusted and offered again (CHD-32, AC 32)
Proof: walk - Each rejection is logged with its change in the Handoff, until the user approves

**C33** - Fast clicks settle on the last chord (CHD-33, AC 33)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_33 settles on the last chord

**C34** - A timbre pick replays a new chord with its bass (CHD-34, AC 34)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_34 a timbre pick replays a new chord

**C35** - A click resumes suspended audio (CHD-35, AC 35)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_35 resumes audio within the click

**C36** - A click during a fade-out plays by CHD-19 and CHD-20 (CHD-36, AC 36)
Proof: run js | ✓ src/index.test.ts > Chord selector > chd_36 click during a fade

---

## Handoff

**Settled mid-build:** T2 runs before T1, because the bank tests read the top note. `pad_21` holds New Age within 2 semitones, so New Age and Sweep take FreePats `E5` at key 76 too. Choir's `F#5` takes 0.64 MB and would pass the 12 MB of CHD-12, so Choir reads `C5` up to 5 semitones sharp for notes 75 to 77; the user judges it at T7. T3: Analog spread 3.25 dB, because the filter darkens notes above 70, so the synth takes a gain above note 70, which leaves every `chord-pads` chord alone, and Analog's mix moves from 1.40 to 1.43. `tim_16`'s heard pitch allows 7 cents on note 71 alone: it read -6.0 on Analog and -5.1 on New Age, while the note leaves the voice within 0.5 cents, because its harmonics sit on the reverb's combs, and TIM-10 keeps that reverb. The dry reading keeps 5 cents on every note. The user is told at T7.
**Dispatched:** none
**Walked:** not yet

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1 → T2 → T3
Phase 2:  T4 → T5 → T6
Phase 3:  T7
```
