# Tuplets Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/tuplets/design.md`
**Status**: Approved
**Approved**: 2026-11-13 - user: "aprovo e vamos de subagents"
**Build**: `npm run build`
**Run rust**: `cargo test --manifest-path engine/Cargo.toml`
**Run js**: `npx vitest run --reporter=verbose`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Rust sequencer and engine | unit | All branches; 1:1 to spec ACs | `engine/src/**/*.rs` `#[cfg(test)]`, `engine/src/golden_tests.rs` | `cargo test --manifest-path engine/Cargo.toml` |
| Domain rules (layout, pattern, meter, preset, songs) | unit | All branches; 1:1 to spec ACs; every listed edge case | `tests/*.test.ts` | `npx vitest run --reporter=verbose` |
| Session | unit | Every command in scope, happy and refusal paths | `tests/app/session.test.ts` | `npx vitest run --reporter=verbose` |
| Audio bridge | unit | Every changed message | `tests/metronome-processor.test.ts`, `tests/MetronomeNode.test.ts` | `npx vitest run --reporter=verbose` |
| Engine binary | unit | The new export | `tests/wasm.test.ts` | `npx vitest run --reporter=verbose` |
| Screens and markup | integration | Each control in scope, against the real `index.html` | `tests/app.test.ts` | `npx vitest run --reporter=verbose` |
| Development scripts | unit | Every path and each refusal | `tests/tabToGrid.test.ts`, `tests/gpExtract.test.ts` | `npx vitest run --reporter=verbose` |
| CSS, docs | none | - (happy-dom applies no CSS; the walk proves it) | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute. `tsc` fails on missing AudioWorklet types and the project has no linter, so neither is a gate.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After rule, session and screen tasks | `npx vitest run` |
| Rust | After engine tasks | `cargo test --manifest-path engine/Cargo.toml` |
| Full | After CSS and docs tasks | `npx vitest run && npx vite build` |
| Build | After the WASM rebuild and the last task | `cargo test --manifest-path engine/Cargo.toml && npx vitest run && npm run build` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Domain rules

```
T1 → T2 → T3 → T4 → T5
```

### Phase 2: Engine and audio bridge

```
T6 → T7 → T8 → T9
```

### Phase 3: Session

```
T10 → T11 → T12 → T13 → T14
```

### Phase 4: Screens

```
T15 → T16 → T17 → T18
```

### Phase 5: Songs

```
T19 → T20 → T21 → T22
```

---

## Task Breakdown

### T1: Bar layout rules

**What**: `src/domain/layout.ts` with `barBeatCells`, `barCells`, `barOffset`, `patternCells`, `locateCell`, `cellSpan`, `stepUnits`, `isTupletSignature` and the 48/192 bounds.
**Where**: `src/domain/layout.ts`
**Depends on**: None
**Reuses**: `getBeatsPerMeasure` from `src/domain/meter.ts`
**Requirement**: TUP-12, TUP-13, TUP-17, TUP-23

**Done when**:

- [x] `tests/layout.test.ts` covers a straight bar, a bar with a triplet and a sextuplet, a 4-bar pattern with different bars, /8 and /16 (always straight), and the units 12/16/8
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): lay out a bar as beats of 4, 3 or 6 cells`
**Status**: Done

---

### T2: Re-lay one beat

**What**: `setBeatCells(p, bar, beat, cells)` moves every track's hits by nearest cell start, earlier on a tie, stronger on a clash, triplet k to sextuplet 2k, and keeps `beatCells` absent when all beats are straight.
**Where**: `src/domain/layout.ts` (modify)
**Depends on**: T1
**Reuses**: The strength order of `scripts/tab_to_grid.js`
**Requirement**: TUP-06, TUP-07, TUP-08, TUP-15

**Done when**:

- [x] Tests for straight→triplet, triplet→straight, triplet→sextuplet, sextuplet→triplet, a clash of accent and ghost, the Click hit on the beat start, and other bars untouched
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): move hits to the nearest cell when a beat changes kind`
**Status**: Done

---

### T3: Tuplet figures

**What**: Four figures with `cells`, and `applyFigure` that re-lays the beat when the figure's cells differ and refuses a tuplet figure outside /4.
**Where**: `src/domain/pattern.ts` (modify)
**Depends on**: T2
**Reuses**: `FIGURES`, `applyFigure`
**Requirement**: TUP-01, TUP-02, TUP-03, TUP-04, TUP-05, TUP-11, TUP-39

**Done when**:

- [x] Tests for each of the four figures, a straight figure on a tuplet beat, one bar of four edited, and a tuplet figure in 6/8 changing nothing
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): add triplet and sextuplet figures`
**Status**: Done

---

### T4: Sustain over tuplet beats

**What**: `isSustainedStep` takes the bar's beat cells, so a tuplet beat follows the same rule.
**Where**: `src/domain/meter.ts` (modify)
**Depends on**: T3
**Reuses**: `isSustainedStep`
**Requirement**: TUP-22

**Done when**:

- [x] Tests for a triplet beat with two hits, with one hit, and the existing straight cases unchanged
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): mark sustain inside tuplet beats`
**Status**: Done

---

### T5: Store and restore the layout

**What**: `Preset.beatCells` and `CustomGroove.beatCells`; `normalizePreset` keeps a valid layout, drops an invalid one, and `fitBars` measures with `patternCells`.
**Where**: `src/domain/preset.ts` (modify)
**Depends on**: T4
**Reuses**: `normalizePreset`, `fitBars`, `completeKit`
**Requirement**: TUP-27, TUP-28

**Done when**:

- [x] Tests for a tuplet preset surviving normalize and `completeKit`, an old preset unchanged, and a malformed layout falling back
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): keep a preset's tuplet beats`
**Status**: Done

---

### T6: Engine pattern units

**What**: `STEPS_COUNT` 192, `BAR_STEPS_MAX` 48, per-cell units, bar starts from the running sum, and `set_step_units` with its refusals.
**Where**: `engine/src/sequencer/pattern.rs`
**Depends on**: None (the phase before it is done)
**Reuses**: `Pattern`
**Requirement**: TUP-16, TUP-17

**Done when**:

- [x] Rust tests for bar starts over a tuplet bar, 48 cells in one bar, 192 in four, and each refusal
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml`

**Tests**: unit
**Gate**: rust
**Commit**: `feat(engine): give each cell its own length in the pattern`
**Status**: Done

---

### T7: Clock plays each cell for its length

**What**: `Clock::set_step_units` and `Engine::trigger_step` set the length of the cell that sounded; the golden fingerprints stay as they are.
**Where**: `engine/src/sequencer/clock.rs`
**Depends on**: T6
**Reuses**: `Clock::advance`, `golden_tests.rs`
**Requirement**: TUP-12, TUP-13, TUP-14, TUP-16, TUP-40

**Done when**:

- [x] Rust tests for triplet onsets at k/3 and sextuplet at k/6 within 1 sample, the Trainer counting a tuplet bar once, a change of units taking effect on the next pass, and every golden test unchanged
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml`

**Tests**: unit
**Gate**: rust
**Commit**: `feat(engine): play triplet and sextuplet cells in time`
**Status**: Done

---

### T8: Export the units and rebuild WASM

**What**: `engine_set_step_units` in `ffi.rs`, its FFI test, and the rebuilt `public/pkg/metrorig_audio_bg.wasm`.
**Where**: `engine/src/ffi.rs`
**Depends on**: T7
**Reuses**: `engine_update_grid`
**Requirement**: TUP-12, TUP-17

**Done when**:

- [x] FFI test passes, `npm run build:wasm` runs, and `tests/wasm.test.ts` finds the export
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run && npm run build`

**Tests**: unit
**Gate**: build
**Commit**: `feat(engine): export the cell lengths to the worklet`
**Status**: Done

---

### T9: Worklet and node carry the units

**What**: `SET_STEP_UNITS` in the worklet and `MetronomeNode.setStepUnits`, `PATTERN_STEPS` 192, and the port in `src/app/ports.ts`.
**Where**: `src/audio/metronome-processor.ts`
**Depends on**: T8
**Reuses**: `UPDATE_GRID` handling
**Requirement**: TUP-12, TUP-17

**Done when**:

- [x] Tests for the message reaching `engine_set_step_units` and a 192-cell grid mirrored
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(audio): send the cell lengths to the engine`
**Status**: Done

---

### T10: Transport sends the layout

**What**: `syncMeterAndGrid` sends `stepUnits` after the length and bars, and grids padded by `patternCells`.
**Where**: `src/app/transport.ts`
**Depends on**: None (the phase before it is done)
**Reuses**: `syncMeterAndGrid`, `sendTrack`
**Requirement**: TUP-12, TUP-40

**Done when**:

- [x] Session tests see the units sent on play and after each tuplet edit
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(transport): send each cell's length with the grid`
**Status**: Done

---

### T11: Edit tuplets in the Session

**What**: `editStep` applies figures through the layout, refuses tuplet figures outside /4, and cycles one tuplet cell as a straight one.
**Where**: `src/app/session.ts`
**Depends on**: T10
**Reuses**: `editStep`, `applyFigure`
**Requirement**: TUP-01, TUP-05, TUP-09, TUP-11, TUP-39

**Done when**:

- [x] Session tests for a triplet on bar 2 of 4, a cell click in a triplet beat, and a refused figure in 6/8
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(session): write tuplets from the figures`
**Status**: Done

---

### T12: Keep tuplets through a signature change

**What**: `setTimeSignature` keeps surviving beats' cells in /4 and straightens in /8 and /16.
**Where**: `src/app/session.ts` (modify)
**Depends on**: T11
**Reuses**: `setBeatCells`
**Requirement**: TUP-19, TUP-25, TUP-26

**Done when**:

- [x] Session tests for 4/4 → 5/4, 4/4 → 3/4, 4/4 → 6/8, and the 32-step refusal unchanged
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(session): keep tuplet beats when the signature changes`
**Status**: Done

---

### T13: Ticks over tuplet bars

**What**: `onTick` maps the engine's cell index to bar and cell with `locateCell`.
**Where**: `src/app/session.ts` (modify)
**Depends on**: T12
**Reuses**: `onTick`
**Requirement**: TUP-24

**Done when**:

- [x] Session tests for a tick in bar 2 after a bar with a triplet
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(session): follow ticks across tuplet bars`
**Status**: Done

---

### T14: Grooves keep tuplets

**What**: `saveGroove` stores `beatCells`; `applyGroove` copies beat `n mod B`, and straightens in /8 and /16.
**Where**: `src/app/session.ts` (modify)
**Depends on**: T13
**Reuses**: `saveGroove`, `applyGroove`
**Requirement**: TUP-29, TUP-30, TUP-31

**Done when**:

- [ ] Session tests for saving a tuplet groove, applying it to 5/4, and applying it to 6/8
- [ ] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(session): save and apply grooves with tuplets`

---

### T15: Footer counts cells over 192

**What**: `formatSteps` reads `STEPS: n/192` with n from `patternCells`.
**Where**: `src/ui/format.ts`
**Depends on**: None (the phase before it is done)
**Reuses**: `formatSteps`
**Requirement**: TUP-18

**Done when**:

- [ ] Tests for `STEPS: 48/192` on an 8/4 bar of sextuplets and 64/192 on a straight 4-bar 4/4
- [ ] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): count cells over 192 in the footer`

---

### T16: Editor draws tuplet beats

**What**: The grid lays 12 sub-columns per beat, a cell spans `12 / cells`, a `3` or `6` label sits over tuplet beats, and the four tuplet buttons are disabled outside /4.
**Where**: `src/ui/editor.ts`
**Depends on**: T15
**Reuses**: `drawGrid`, the figure palette
**Requirement**: TUP-10, TUP-20, TUP-21, TUP-22

**Done when**:

- [ ] App tests against `index.html` for cell spans, labels, disabled buttons in 6/8 and enabled in 4/4
- [ ] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick
**Commit**: `feat(editor): draw triplet and sextuplet beats`

---

### T17: Stadium places tuplet slices

**What**: Slices from `cellSpan`, the hand timed by each cell's units, and the lit beat from `locateCell`.
**Where**: `src/ui/stadium.ts`
**Depends on**: T16
**Reuses**: `drawBeatClock`, `highlightBeat`
**Requirement**: TUP-23, TUP-24

**Done when**:

- [ ] App tests for 3 slices sharing a quarter of the ring and beat 2 lit on a triplet cell
- [ ] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick
**Commit**: `feat(stadium): place tuplet hits at their time`

---

### T18: Tuplet styles

**What**: CSS for the tuplet label and the disabled figure buttons.
**Where**: `src/ui/index.css`
**Depends on**: T17
**Reuses**: Existing figure and count-row styles

**Done when**:

- [ ] Gate check passes: `npx vitest run && npx vite build`

**Tests**: none
**Gate**: full
**Commit**: `style(editor): mark tuplet beats and disabled figures`

---

### T19: Guitar Pro extractor

**What**: `scripts/gp_extract.py` reads `.gp` and `.gpx`, maps GP6 and GP7 drum notes to MIDI, and writes the drum measures as Songsterr-shaped JSON.
**Where**: `scripts/gp_extract.py`
**Depends on**: None (the phase before it is done)
**Reuses**: Measure shape of `tests/fixtures/song_tabs.json`
**Requirement**: TUP-35

**Done when**:

- [ ] `tests/gpExtract.test.ts` builds a synthetic `.gp` zip and a literal-only BCFZ `.gpx` in a temp dir and reads both
- [ ] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(scripts): read drum measures from Guitar Pro files`

---

### T20: Tab converter writes tuplet beats

**What**: `barToGrid`/`barsToGrid` lay a beat as 3 or 6 cells when its notes need it, add `beatCells`, and stop on a note between cells naming the measure.
**Where**: `scripts/tab_to_grid.js`
**Depends on**: T19
**Reuses**: `barToGrid`, `writeHit`
**Requirement**: TUP-35, TUP-36

**Done when**:

- [ ] Tests for a triplet beat, a sextuplet beat, a quintuplet refused, and every existing test unchanged
- [ ] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(scripts): convert triplets and sextuplets from tabs`

---

### T21: Times Like These and Everlong

**What**: Two songs in `SONGS`, their extracted measures in `tests/fixtures/song_tabs.json`, the Ultimate Guitar source shape, and `songToPreset` passing `beatCells` and placing the click by layout.
**Where**: `src/domain/songs.ts`
**Depends on**: T20
**Reuses**: `SONGS`, `songToPreset`, `barsToGrid`
**Requirement**: TUP-32, TUP-33, TUP-34, TUP-37

**Done when**:

- [ ] Song tests list 16 songs, match both new grids to the fixture through `barsToGrid`, and find no `.gp` or `.gpx` tracked
- [ ] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(songs): add Times Like These and Everlong`

---

### T22: Docs

**What**: `GLOSSARY.md` defines Cell, Beat cells and Tuplet; `CONTRIBUTING.md` names `gp_extract.py`.
**Where**: `GLOSSARY.md`
**Depends on**: T21
**Reuses**: Existing entries

**Done when**:

- [ ] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run && npm run build`

**Tests**: none
**Gate**: build
**Commit**: `docs: define cells and tuplets`

---

## Checks

**C1** - Applying `Triplet` turns one beat into 3 cells on every track with 3 hits on the clicked track (TUP-01, AC 1)
Proof: run js | ✓ Pattern > tup_01 triplet lays 3 cells and 3 hits

**C2** - `Triplet Rest` lays 3 empty cells on the clicked track (TUP-02, AC 2)
Proof: run js | ✓ Pattern > tup_02 triplet rest lays 3 empty cells

**C3** - `Sextuplet` lays 6 cells and 6 hits (TUP-03, AC 3)
Proof: run js | ✓ Pattern > tup_03 sextuplet lays 6 cells and 6 hits

**C4** - `Sextuplet Rest` lays 6 empty cells (TUP-04, AC 4)
Proof: run js | ✓ Pattern > tup_04 sextuplet rest lays 6 empty cells

**C5** - A straight figure on a tuplet beat returns it to 4 cells with the figure written (TUP-05, AC 5)
Proof: run js | ✓ Pattern > tup_05 straight figure returns a tuplet beat to 4 cells

**C6** - A change of kind moves every other hit to the nearest cell start, the earlier on a tie (TUP-06, AC 6)
Proof: run js | ✓ Layout > tup_06 hits move to the nearest cell, earlier on a tie

**C7** - Triplet cell k becomes sextuplet cell 2k (TUP-07, AC 7)
Proof: run js | ✓ Layout > tup_07 triplet cell k becomes sextuplet cell 2k

**C8** - Two hits on one cell keep the stronger, accent over normal over ghost (TUP-08, AC 8)
Proof: run js | ✓ Layout > tup_08 a clash keeps the stronger hit

**C9** - A click on one tuplet cell with no figure cycles its value (TUP-09, AC 9)
Proof: run js | ✓ Session > tup_09 a tuplet cell cycles like a straight one

**C10** - The four tuplet buttons are disabled in 6/8 and enabled in 4/4 (TUP-10, AC 10)
Proof: run js | ✓ Editor > tup_10 tuplet figures are disabled outside /4

**C11** - A tuplet figure on bar 2 of 4 leaves bars 1, 3 and 4 unchanged (TUP-11, AC 11)
Proof: run js | ✓ Session > tup_11 a tuplet in bar 2 leaves the other bars

**C12** - Triplet cell k starts k/3 of a beat after the beat, within 1 sample (TUP-12, AC 1)
Proof: run rust | tup_12_triplet_cells_start_at_thirds ... ok

**C13** - Sextuplet cell k starts k/6 of a beat after the beat, within 1 sample (TUP-13, AC 2)
Proof: run rust | tup_13_sextuplet_cells_start_at_sixths ... ok

**C14** - A pattern with no tuplet plays sample for sample as before: the drums golden fingerprint is unchanged (TUP-14, AC 3)
Proof: run rust | golden_tests::drums_with_takes_and_dynamics ... ok

**C15** - A change of kind keeps the Click hit on the beat's first cell (TUP-15, AC 4)
Proof: run js | ✓ Layout > tup_15 the click stays on the beat start

**C16** - The Trainer stepping every 2 bars steps after 2 bars that hold a triplet (TUP-16, AC 5)
Proof: run rust | tup_16_trainer_counts_a_tuplet_bar_once ... ok

**C17** - The engine holds 48 cells in a bar and 192 in a pattern, and refuses 49 (TUP-17, AC 1)
Proof: run rust | tup_17_bar_holds_48_cells_and_pattern_192 ... ok

**C18** - The footer reads `STEPS: 48/192` for an 8/4 bar of sextuplets (TUP-18, AC 2)
Proof: run js | ✓ Format > tup_18 steps count cells over 192

**C19** - A signature whose straight bar exceeds 32 steps is refused as today (TUP-19, AC 3)
Proof: run js | ✓ Session > tup_19 the 32-step signature rule stands with tuplets

**C20** - A triplet cell spans 4 of the beat's 12 sub-columns and a sextuplet cell 2 (TUP-20, AC 1)
Proof: run js | ✓ Editor > tup_20 tuplet cells share a straight beat's width

**C21** - The label `3` sits above a triplet beat and `6` above a sextuplet beat (TUP-21, AC 2)
Proof: run js | ✓ Editor > tup_21 tuplet beats carry 3 or 6

**C22** - An empty cell after the first hit of a triplet beat with 2 hits is sustained (TUP-22, AC 3)
Proof: run js | ✓ Meter > tup_22 sustain follows the rule inside a tuplet beat

**C23** - The 3 slices of a triplet beat in 4/4 span 1/4 of the ring at thirds (TUP-23, AC 4)
Proof: run js | ✓ Stadium > tup_23 tuplet slices sit at their time

**C24** - A tick on a triplet cell of beat 2 lights beat 2 (TUP-24, AC 5)
Proof: run js | ✓ Stadium > tup_24 the lit beat follows a tuplet cell

**C25** - 4/4 to 5/4 keeps the triplet on beat 2 and adds a straight beat 5 (TUP-25, AC 1)
Proof: run js | ✓ Session > tup_25 surviving beats keep their kind

**C26** - 4/4 to 6/8 makes every beat straight and moves hits to the nearest cell (TUP-26, AC 2)
Proof: run js | ✓ Session > tup_26 a /8 signature straightens every beat

**C27** - A tuplet preset saved and reloaded keeps its beats and hits (TUP-27, AC 3)
Proof: run js | ✓ Session > tup_27 a saved tuplet preset reloads the same

**C28** - A preset saved before this feature loads with every beat straight and its hits unchanged (TUP-28, AC 4)
Proof: run js | ✓ Preset > tup_28 an old preset loads straight and unchanged

**C29** - A groove saved from a tuplet bar stores each beat's cells (TUP-29, AC 5)
Proof: run js | ✓ Session > tup_29 a saved groove keeps its beat cells

**C30** - A 4-beat groove applied to 5/4 gives beat 5 the kind and hits of groove beat 1 (TUP-30, AC 6)
Proof: run js | ✓ Session > tup_30 a groove repeats beat by beat

**C31** - A tuplet groove applied to 6/8 lands straight (TUP-31, AC 7)
Proof: run js | ✓ Session > tup_31 a tuplet groove lands straight in /8

**C32** - Times Like These is listed under Rock, `Intro Riff`, 144 BPM, 7/4, equal to measures 8-11 of its tab (TUP-32, AC 1)
Proof: run js | ✓ Songs > tup_32 Times Like These plays the 7/4 intro riff

**C33** - Everlong is listed under Rock, `Chorus`, 160 BPM, 4/4, equal to measures 64-67 of its tab (TUP-33, AC 2)
Proof: run js | ✓ Songs > tup_33 Everlong plays the chorus

**C34** - Both new songs record site `Ultimate Guitar`, the file name and the first measure (TUP-34, AC 3)
Proof: run js | ✓ Songs > tup_34 Ultimate Guitar sources name the file and measure

**C35** - The extractor reads a `.gp` and a `.gpx` drum track, and the converter writes tuplet beats (TUP-35, AC 4)
Proof: run js | ✓ gp_extract > tup_35 reads drum measures from .gp and .gpx

**C36** - A note on no cell of 4, 3 or 6 stops with the measure named (TUP-36, AC 5)
Proof: run js | ✓ tab_to_grid > tup_36 a note between cells names its measure

**C37** - No Guitar Pro file is tracked and the fixture holds both songs' 4 measures (TUP-37, AC 6)
Proof: run js | ✓ Songs > tup_37 no Guitar Pro file is tracked

**C38** - The user approves how both songs sound in the running app (TUP-38, AC 7)
Proof: walk - the user plays Times Like These and Everlong from Grooves and approves them

**C39** - A tuplet figure in 6/8 through the Session changes nothing (TUP-39, edge case)
Proof: run js | ✓ Session > tup_39 a tuplet figure outside /4 changes nothing

**C40** - A beat re-laid during playback plays its new cells from the next pass (TUP-40, edge case)
Proof: run rust | tup_40_new_units_play_from_the_next_pass ... ok

---

## Handoff

**Settled mid-build:** Q21, user: "sim, recomendacao". Three tests kept at 591f031 contradict TUP-17 and T8/T9. (a) `holds_128_steps` refuses 193 steps and checks `steps[191]`, keeping its name; (b) the kept WASM export list gains `engine_set_step_units`; (c) the two worklet tests expect `engine_update_grid(..., 192)`; (d) `tests/fixtures/tests_kept.py` lists these rewrites explicitly, citing AD-029. Each change lands in the commit of the task that causes it (T6, T8, T9); no other kept assertion changes.
**Dispatched:** batch 1 (T1-T9, phases 1-2) at 22c3751 - returned blocked at T6 (T1-T5 done, 9126ea1); resumed after Q21 at 9126ea1; returned at 5436650 (T6-T9 done); batch 2 (T10-T14, phase 3) from 7f76d02
**Walked:** none
