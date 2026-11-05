# Layered Architecture Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/layered-architecture/design.md`
**Status**: Approved
**Approved**: 2026-11-04 - user: "aprovo, vamos de sub agents"
**Build**: `npm run build`
**Run rust**: `cargo test --manifest-path engine/Cargo.toml`
**Run js**: `npx vitest run --reporter=verbose`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply. The feature changes no behaviour, so existing tests are the floor and are never edited beyond import paths and field paths.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Rust engine output | unit | Golden fingerprint per scenario; every existing test kept | `engine/src/golden_tests.rs`, `engine/src/**/*.rs` `mod tests` | `cargo test --manifest-path engine/Cargo.toml` |
| Rust Trainer | unit | Every Trainer rule 1:1 to ARCH-13, without an `Engine` | `engine/src/sequencer/trainer.rs` `mod tests` | `cargo test --manifest-path engine/Cargo.toml` |
| Layer structure (both trees) | unit | Every structural AC: ARCH-01..05, 11, 12, 14..17, 20, 21 | `tests/layers.test.ts` | `npx vitest run --reporter=verbose` |
| Session (app layer) | unit | Each command of ARCH-19 with fakes, no DOM | `tests/app/session.test.ts` | `npx vitest run --reporter=verbose` |
| Domain, data, storage, audio | unit | Existing tests kept; only import paths change | `tests/*.test.ts` | `npx vitest run --reporter=verbose` |
| UI screens and page wiring | integration | Existing DOM suite kept, against the real `index.html` | `tests/app.test.ts` | `npx vitest run --reporter=verbose` |
| Shipped WASM | integration | Export names equal those at `591f031` | `tests/wasm.test.ts` | `npx vitest run --reporter=verbose` |
| Build scripts and docs | unit | Missing-build path; docs name real paths | `tests/copyWasm.test.ts`, `tests/docs.test.ts` | `npx vitest run --reporter=verbose` |

## Gate Check Commands

> Generated from codebase - confirm before Execute. `tsc --noEmit` already fails on AudioWorklet globals and the `?url` import, and the project has no linter, so neither is a gate.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After a Rust task | `cargo test --manifest-path engine/Cargo.toml` (before T2: `cargo test`) |
| Full | After a TypeScript task | `cargo test --manifest-path engine/Cargo.toml && npx vitest run` |
| Build | After T2, T10, T22, T24 | `npm run build && cargo test --manifest-path engine/Cargo.toml && npx vitest run` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Safety net and the move

```
T1 → T2
```

### Phase 2: Rust layers

```
T2 → T3 → T4 → T5 → T6 → T7 → T8
```

### Phase 3: Rust composition

```
T8 → T9 → T10
```

### Phase 4: TypeScript lower layers

```
T10 → T11 → T12 → T13 → T14
```

### Phase 5: Session

```
T14 → T15 → T16
```

### Phase 6: Screens

```
T16 → T17 → T18 → T19 → T20 → T21 → T22 → T23
```

### Phase 7: Docs

```
T23 → T24
```

---

## Task Breakdown

### T1: Record the golden output and the kept-test lists at 591f031

**What**: Add the golden test (six scenarios and the one-bit check) on today's code, record the FNV-1a hashes it prints, and record the Rust test names, the vitest test names and the WASM export names as fixtures, with the scripts that compare them.
**Where**: `src/golden_tests.rs` (new; also `src/lib.rs` one `mod` line, `tests/fixtures/tests_kept.py`, `tests/fixtures/golden_first.py`, `tests/fixtures/kept_591f031.json`)
**Depends on**: None
**Reuses**: The `extern "C"` functions; the LCG idea of the FFI harness
**Requirement**: ARCH-08, ARCH-09, ARCH-10, ARCH-07, ARCH-22, ARCH-06

**Done when**:

- [x] `cargo test golden_tests` passes on code otherwise identical to `591f031`
- [x] `kept_591f031.json` lists 136 Rust test names, every vitest test name, and the export names of `public/pkg/metrorig_audio_bg.wasm`
- [x] `python3 -I tests/fixtures/tests_kept.py rust` and `... js` exit 0
- [x] Gate check passes: `cargo test && npx vitest run`
- [x] Test count: 143 Rust tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `test(engine): record the golden output and the kept tests at 591f031`

**Status**: ✅ Complete

---

### T2: Move the crate to engine/

**What**: `git mv` `Cargo.toml`, `Cargo.lock`, `src/lib.rs`, `src/pad.rs`, `src/golden_tests.rs` into `engine/`; point `build:wasm`, `test:rust` and `scripts/copy_wasm.js` at it; add `tests/copyWasm.test.ts` for the missing-build exit.
**Where**: `engine/Cargo.toml` (moved; also `package.json`, `scripts/copy_wasm.js`, `tests/copyWasm.test.ts`)
**Depends on**: T1
**Reuses**: `scripts/copy_wasm.js` error path
**Requirement**: ARCH-01, ARCH-28

**Done when**:

- [x] No `.rs` file under `src/`
- [x] `npm run build` exits 0 and `tests/wasm.test.ts` passes on the rebuilt file
- [x] `copy_wasm` test passes: exit 1 with the path printed
- [x] Gate check passes: `npm run build && cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: 143 Rust tests pass

**Tests**: unit
**Gate**: build

**Commit**: `refactor(engine): move the crate to engine/`

**Status**: ✅ Complete

---

### T3: Extract dsp/

**What**: Move `Sample`, `trim_onset`, `Chorus`, `Reverb` (with `Comb`, `AllPass`), `read_delayed` and `low_pass` into `dsp/`, with the tests that assert them.
**Where**: `engine/src/dsp/mod.rs` (also `sample.rs`, `chorus.rs`, `reverb.rs`, `filter.rs`)
**Depends on**: T2
**Reuses**: `pad.rs:233-353, 621`, `lib.rs:21-24, 185-197`
**Requirement**: ARCH-02, ARCH-04

**Done when**:

- [x] `dsp` uses no other crate module
- [x] Golden and kept-test proofs pass
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml`
- [x] Test count: 143 Rust tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(engine): extract the dsp layer`

**Status**: ✅ Complete

---

### T4: Extract the Trainer

**What**: Move `TrainerSettings`, `StepType`, `Curve` and the Trainer state and rules into `sequencer/trainer.rs` behind `set`, `replace`, `on_start`, `on_bar_start`, `on_frame`, returning the new BPM; `Engine` holds one `trainer: Trainer`; add the six Trainer tests without an `Engine`.
**Where**: `engine/src/sequencer/trainer.rs`
**Depends on**: T3
**Reuses**: `lib.rs:41-113, 393-492`
**Requirement**: ARCH-11, ARCH-12, ARCH-13

**Done when**:

- [x] Tests `stepped_curve_steps_at_the_bar_count`, `smooth_curve_ramps_each_frame`, `steps_by_bars`, `steps_by_seconds_wait_for_beat_one`, `settings_wait_for_beat_one`, `a_changed_schedule_restarts` pass
- [x] Golden proof passes
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml`
- [x] Test count: 149 Rust tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(engine): give the Speed Trainer its own module`

**Status**: ✅ Complete

---

### T5: Extract the clock and the pattern

**What**: Move tempo, step timing and `first_hit` into `sequencer/clock.rs`, and the grid, measure length, bars and step index into `sequencer/pattern.rs`.
**Where**: `engine/src/sequencer/clock.rs` (also `pattern.rs`, `mod.rs`)
**Depends on**: T4
**Reuses**: `lib.rs:17-19, 41-44, 279-286, 389-391, 668-704`
**Requirement**: ARCH-02, ARCH-04

**Done when**:

- [x] `sequencer` uses no other crate module
- [x] Golden proof passes
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml`
- [x] Test count: 149 Rust tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(engine): extract the clock and the pattern`

**Status**: ✅ Complete

---

### T6: Extract the click

**What**: Move the synth and sample click into `instruments/click.rs`.
**Where**: `engine/src/instruments/click.rs`
**Depends on**: T5
**Reuses**: `lib.rs:313-324, 518-549`
**Requirement**: ARCH-02, ARCH-04

**Done when**:

- [x] Golden `synth_click` and `sample_click` pass
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml`
- [x] Test count: 149 Rust tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(engine): extract the click instrument`

**Status**: ✅ Complete

---

### T7: Extract the drums

**What**: Move the sample bank, takes, dynamics, voices, the hi-hat choke and the fades into `instruments/drums.rs`.
**Where**: `engine/src/instruments/drums.rs`
**Depends on**: T6
**Reuses**: `lib.rs:5-16, 26-39, 168-183, 326-387, 551-580`
**Requirement**: ARCH-02, ARCH-04

**Done when**:

- [x] Golden `drums_with_takes_and_dynamics` passes
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml`
- [x] Test count: 149 Rust tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(engine): extract the drum instrument`

**Status**: ✅ Complete

---

### T8: Split the Pad into instruments/pad/

**What**: Move `pad.rs` into `instruments/pad/` as `mod.rs` (Pad), `voice.rs` (Voice, PadSample, read), `slot.rs` (Slot) and `mixes.rs` (constants and `MIXES`), using `dsp` for the effects.
**Where**: `engine/src/instruments/pad/mod.rs` (also `voice.rs`, `slot.rs`, `mixes.rs`)
**Depends on**: T7
**Reuses**: `pad.rs` whole, AD-017
**Requirement**: ARCH-02, ARCH-04, ARCH-05

**Done when**:

- [x] Golden `pad_changes_chord_and_timbre` passes
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml`
- [x] Test count: 149 Rust tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(engine): split the pad into its own instrument folder`

**Status**: ✅ Complete

---

### T9: Compose engine.rs and ffi.rs

**What**: `engine.rs` composes clock, pattern, Trainer, click, drums and Pad and mixes the block; `ffi.rs` holds the 25 exports and their tests in `ffi_tests.rs`; `lib.rs` holds only `mod` lines.
**Where**: `engine/src/engine.rs` (also `ffi.rs`, `ffi_tests.rs`, `lib.rs`)
**Depends on**: T8
**Reuses**: `lib.rs:114-166, 198-837`
**Requirement**: ARCH-02, ARCH-03, ARCH-05

**Done when**:

- [x] Every golden scenario passes
- [x] `python3 -I tests/fixtures/tests_kept.py rust` exits 0
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml`
- [x] Test count: 149 Rust tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(engine): compose the engine and confine the FFI`

**Status**: ✅ Complete

---

### T10: Guard the Rust layers and ship the rebuilt WASM

**What**: Add the Rust checks of `tests/layers.test.ts` (crate location, modules, `unsafe`/`extern` only in `ffi.rs`, downward `use`, 400-line limit, one Trainer field, Trainer holds no tempo) and the export-name test in `tests/wasm.test.ts`; rebuild and commit `public/pkg/metrorig_audio_bg.wasm`.
**Where**: `tests/layers.test.ts` (new; also `tests/wasm.test.ts`, `public/pkg/metrorig_audio_bg.wasm`)
**Depends on**: T9
**Reuses**: `kept_591f031.json` export list
**Requirement**: ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06, ARCH-11, ARCH-12

**Done when**:

- [x] Every Rust check of the layer test passes
- [x] `tests/wasm.test.ts` passes on the rebuilt file
- [x] Gate check passes: `npm run build && cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: unit
**Gate**: build

**Commit**: `test(engine): guard the engine layers and ship the rebuilt wasm`

**Status**: ✅ Complete

---

### T11: Move the pure rules into domain/

**What**: Move `bars`, `kit`, `chords`, `songs`, `trackMix` and the pure parts of `state.ts` into `src/domain/{meter,pattern,preset,kit,chords,songs,mix}.ts`; move `src/index.test.ts` to `tests/app.test.ts`; update every import, and `tests/fixtures/pad_files.py`.
**Where**: `src/domain/` (one folder of moved files; also test imports)
**Depends on**: T10
**Reuses**: The files as they are
**Requirement**: ARCH-14, ARCH-22, ARCH-27

**Done when**:

- [x] `python3 -I tests/fixtures/pad_bank_check.py` exits 0
- [x] `python3 -I tests/fixtures/tests_kept.py js` exits 0
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 passes

**Tests**: unit
**Gate**: full

**Commit**: `refactor(web): move the pure rules into domain/`

**Status**: ✅ Complete

---

### T12: Move factory content into data/

**What**: Move `FACTORY_PRESETS`, `FACTORY_GROOVES` and `SPEED_TRAINER_PRESETS` into `src/data/factory.ts`.
**Where**: `src/data/factory.ts`
**Depends on**: T11
**Reuses**: `state.ts:303-479`
**Requirement**: ARCH-14, ARCH-15

**Done when**:

- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 passes

**Tests**: unit
**Gate**: full

**Commit**: `refactor(web): move factory content into data/`

**Status**: ✅ Complete

---

### T13: Split persistence into storage/ and StateManager into app/

**What**: Move IndexedDB access into `src/storage/database.ts` and `localStorage` keys into `src/storage/preferences.ts`; `StateManager` keeps its interface in `src/app/stateManager.ts` and delegates to them.
**Where**: `src/app/stateManager.ts` (also `src/storage/database.ts`, `src/storage/preferences.ts`)
**Depends on**: T12
**Reuses**: `state.ts:139-301`, `main.ts:1082-1094, 1326-1383`
**Requirement**: ARCH-14, ARCH-15

**Done when**:

- [x] `tests/state.test.ts` passes with only its import paths changed
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 passes

**Tests**: unit
**Gate**: full

**Commit**: `refactor(web): split persistence from the state manager`

**Status**: ✅ Complete

---

### T14: Settle audio/

**What**: Move `visualSync.ts` into `src/audio/`, move `display.ts` to `src/ui/format.ts`, delete `src/index.ts`.
**Where**: `src/audio/visualSync.ts` (also `src/ui/format.ts`)
**Depends on**: T13
**Reuses**: The files as they are
**Requirement**: ARCH-14, ARCH-15

**Done when**:

- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 passes

**Tests**: unit
**Gate**: full

**Commit**: `refactor(web): settle the audio adapter folder`

**Status**: ✅ Complete

---

### T15: Create the Session for transport, editing and library

**What**: `src/app/session.ts` with `ports.ts`, `transport.ts` and `library.ts`: engine start-up, kit and click sound, sync, play and stop, delayed ticks, bar and position, BPM, meter, steps, figures, mute and solo, Trainer, presets, songs and grooves; `main.ts` calls it for these rules; add `tests/app/session.test.ts` with a fake engine and in-memory storage.
**Where**: `src/app/session.ts` (also `ports.ts`, `transport.ts`, `library.ts`, `tests/app/session.test.ts`)
**Depends on**: T14
**Reuses**: `main.ts:99-280, 519-1053, 1180-1198`
**Requirement**: ARCH-18, ARCH-19

**Done when**:

- [x] Session tests for play and stop, loading a preset, saving a preset, loading a song, editing a step and setting the Trainer pass, with no DOM
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: unit
**Gate**: full

**Commit**: `refactor(web): run the transport and editing rules in a Session`

**Status**: ✅ Complete

---

### T16: Add Improv to the Session

**What**: `src/app/improv.ts`: chord state, timbre load queue, pad volume and the notice, reached through the Session.
**Where**: `src/app/improv.ts`
**Depends on**: T15
**Reuses**: `main.ts:1214-1335`
**Requirement**: ARCH-18, ARCH-19

**Done when**:

- [x] Session tests for pressing a chord, changing the timbre and changing the pad volume pass, with no DOM
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: unit
**Gate**: full

**Commit**: `refactor(web): run the Improv rules in the Session`

**Status**: ✅ Complete

---

### T17: Extract the header

**What**: `src/ui/header.ts` and `src/ui/dom.ts`: view links, BPM, preset selectors, play buttons, footer, save toast.
**Where**: `src/ui/header.ts` (also `src/ui/dom.ts`)
**Depends on**: T16
**Reuses**: `main.ts:19-180, 583-613, 700-701, 811-847, 932-968`
**Requirement**: ARCH-20

**Done when**:

- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: integration
**Gate**: full

**Commit**: `refactor(web): extract the header`

**Status**: ✅ Complete

---

### T18: Extract the Editor screen

**What**: `src/ui/editor.ts`: grid, figure palette, bar selector, time signature, Trainer form, mix cards, grooves dropdown.
**Where**: `src/ui/editor.ts`
**Depends on**: T17
**Reuses**: `main.ts:282-431, 615-733, 970-1053, 1096-1125`
**Requirement**: ARCH-20

**Done when**:

- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: integration
**Gate**: full

**Commit**: `refactor(web): extract the Editor screen`

**Status**: ✅ Complete

---

### T19: Extract the Stadium screen

**What**: `src/ui/stadium.ts`: beat clock, orbs, status, timers, live BPM.
**Where**: `src/ui/stadium.ts`
**Depends on**: T18
**Reuses**: `main.ts:437-517, 735-803`
**Requirement**: ARCH-20

**Done when**:

- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: integration
**Gate**: full

**Commit**: `refactor(web): extract the Stadium screen`

**Status**: ✅ Complete

---

### T20: Extract the Grooves screen

**What**: `src/ui/grooves.ts`: genre tabs and song cards.
**Where**: `src/ui/grooves.ts`
**Depends on**: T19
**Reuses**: `main.ts:1127-1212`
**Requirement**: ARCH-20

**Done when**:

- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: integration
**Gate**: full

**Commit**: `refactor(web): extract the Grooves screen`

**Status**: ✅ Complete

---

### T21: Extract the Improv screen

**What**: `src/ui/improv.ts`: chord selector, timbre select, volume slider, status and notice.
**Where**: `src/ui/improv.ts`
**Depends on**: T20
**Reuses**: `main.ts:1302-1371`
**Requirement**: ARCH-20

**Done when**:

- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: integration
**Gate**: full

**Commit**: `refactor(web): extract the Improv screen`

**Status**: ✅ Complete

---

### T22: Reduce main.ts to the composition root

**What**: `main.ts` builds the adapters and the Session and mounts the screens, in at most 150 lines.
**Where**: `src/main.ts`
**Depends on**: T21
**Reuses**: `main.ts:12-17, 1373-1386`
**Requirement**: ARCH-21, ARCH-23

**Done when**:

- [x] `python3 -I tests/fixtures/tests_kept.py js` exits 0
- [x] Gate check passes: `npm run build && cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: integration
**Gate**: build

**Commit**: `refactor(web): reduce main.ts to the composition root`

**Status**: ✅ Complete

---

### T23: Guard the TypeScript layers

**What**: Add the TypeScript checks of `tests/layers.test.ts`: the six folders and `main.ts` alone, downward imports, no cycle, a crossing import named in the failure, one module per screen, `main.ts` at most 150 lines.
**Where**: `tests/layers.test.ts`
**Depends on**: T22
**Reuses**: The Rust half of the same test
**Requirement**: ARCH-14, ARCH-15, ARCH-16, ARCH-17, ARCH-20, ARCH-21

**Done when**:

- [x] Every TypeScript check of the layer test passes
- [x] Gate check passes: `cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: unit
**Gate**: full

**Commit**: `test(web): guard the TypeScript layers`

**Status**: ✅ Complete

---

### T24: Write the layers down

**What**: Update `CONTRIBUTING.md` (both stacks, the rule, the paths), create `GLOSSARY.md` (Session, Trainer, Instrument, each layer), append AD-028 to `.specs/STATE.md`, and add `tests/docs.test.ts`.
**Where**: `CONTRIBUTING.md` (also `GLOSSARY.md`, `.specs/STATE.md`, `tests/docs.test.ts`)
**Depends on**: T23
**Reuses**: The design's diagram
**Requirement**: ARCH-24, ARCH-25, ARCH-26

**Done when**:

- [x] Docs tests pass
- [x] Gate check passes: `npm run build && cargo test --manifest-path engine/Cargo.toml && npx vitest run`
- [x] Test count: every vitest test of T1 plus the new ones pass

**Tests**: unit
**Gate**: build

**Commit**: `docs: describe the layers of the engine and the app`

**Status**: ✅ Complete

---

## Checks

**C1** - `engine/Cargo.toml` holds the crate and `src/` has no `.rs` file (ARCH-01, AC 1)
Proof: run js | ✓ Layers > the engine crate lives in engine/ and src/ holds no .rs file

**C2** - The crate has the modules ffi, engine, sequencer::{clock,pattern,trainer}, instruments::{click,drums,pad} and dsp (ARCH-02, AC 2)
Proof: run js | ✓ Layers > the engine crate has every layered module

**C3** - `extern "C"` and `unsafe` outside test code appear only in `engine/src/ffi.rs` (ARCH-03, AC 3)
Proof: run js | ✓ Layers > extern C and unsafe live only in ffi.rs

**C4** - Every `use crate::` in the crate points to a lower layer (ARCH-04, AC 4)
Proof: run js | ✓ Layers > engine modules depend downward only

**C5** - No `.rs` file holds over 400 production lines (ARCH-05, AC 5)
Proof: run js | ✓ Layers > no engine file holds over 400 lines of production code

**C6** - The rebuilt WASM exports exactly the names of `591f031` (ARCH-06, AC 6)
Proof: run js | ✓ Shipped WASM > exports the same names as at 591f031

**C7** - Every Rust test name of `591f031` runs and passes (ARCH-07, AC 7)
Proof: `python3 -I tests/fixtures/tests_kept.py rust`

**C8** - The golden test's commit precedes every commit that moves engine code (ARCH-08, AC 1)
Proof: `python3 -I tests/fixtures/golden_first.py`

**C9** - Drums with takes and all dynamics render the `591f031` fingerprint (ARCH-09, AC 2)
Proof: run rust | test golden_tests::drums_with_takes_and_dynamics ... ok

**C10** - The synth click renders the `591f031` fingerprint (ARCH-09, AC 2)
Proof: run rust | test golden_tests::synth_click ... ok

**C11** - The sample click renders the `591f031` fingerprint (ARCH-09, AC 2)
Proof: run rust | test golden_tests::sample_click ... ok

**C12** - The Trainer stepped by bars renders the `591f031` fingerprint (ARCH-09, AC 2)
Proof: run rust | test golden_tests::trainer_stepped_by_bars ... ok

**C13** - The Trainer smooth by seconds renders the `591f031` fingerprint (ARCH-09, AC 2)
Proof: run rust | test golden_tests::trainer_smooth_by_seconds ... ok

**C14** - The Pad changing chords and timbre renders the `591f031` fingerprint (ARCH-09, AC 2)
Proof: run rust | test golden_tests::pad_changes_chord_and_timbre ... ok

**C15** - A one-bit change fails the golden comparison with the scenario's name (ARCH-10, AC 3)
Proof: run rust | test golden_tests::a_one_bit_change_fails_naming_its_scenario ... ok

**C16** - The `Engine` holds the Trainer in one `Trainer` field and no other trainer field (ARCH-11, AC 1)
Proof: run js | ✓ Layers > the Engine holds the Trainer in one field

**C17** - The Trainer holds no BPM field and takes no `Engine`; it returns the new BPM (ARCH-12, AC 2)
Proof: run js | ✓ Layers > the Trainer holds no tempo and no Engine

**C18** - The stepped curve raises the BPM by the increment once the bar count is reached (ARCH-13, AC 3)
Proof: run rust | test sequencer::trainer::tests::stepped_curve_steps_at_the_bar_count ... ok

**C19** - The smooth curve raises the BPM each frame toward the target (ARCH-13, AC 3)
Proof: run rust | test sequencer::trainer::tests::smooth_curve_ramps_each_frame ... ok

**C20** - Steps by bars count completed bars (ARCH-13, AC 3)
Proof: run rust | test sequencer::trainer::tests::steps_by_bars ... ok

**C21** - Stepped steps by seconds apply on the next beat 1 (ARCH-13, AC 3)
Proof: run rust | test sequencer::trainer::tests::steps_by_seconds_wait_for_beat_one ... ok

**C22** - Settings set during playback wait for beat 1 (ARCH-13, AC 3)
Proof: run rust | test sequencer::trainer::tests::settings_wait_for_beat_one ... ok

**C23** - A changed schedule restarts the count (ARCH-13, AC 3)
Proof: run rust | test sequencer::trainer::tests::a_changed_schedule_restarts ... ok

**C24** - `src/` holds domain, data, storage, audio, app, ui and `main.ts` alone at its root (ARCH-14, AC 1)
Proof: run js | ✓ Layers > src holds the six layers and main.ts alone at its root

**C25** - Every import in `src/` points to an allowed layer (ARCH-15, AC 2)
Proof: run js | ✓ Layers > src imports downward only

**C26** - The import graph of `src/` has no cycle (ARCH-16, AC 3)
Proof: run js | ✓ Layers > src has no import cycle

**C27** - A crossing import fails the checker with the file and the import named (ARCH-17, AC 4)
Proof: run js | ✓ Layers > a crossing import fails naming the file and the import

**C28** - The Session sends engine and storage calls only to the adapters it receives (ARCH-18, AC 5)
Proof: run js | ✓ Session > sends every engine and storage call through the adapters it receives

**C29** - With fakes and no DOM, play then stop starts and stops the engine (ARCH-19, AC 6)
Proof: run js | ✓ Session > plays and stops

**C30** - With fakes, loading a preset sends its tempo, meter, bars, tracks and Trainer (ARCH-19, AC 6)
Proof: run js | ✓ Session > loads a preset

**C31** - With fakes, saving a preset stores a copy and makes it active (ARCH-19, AC 6)
Proof: run js | ✓ Session > saves a preset

**C32** - With fakes, loading a song replaces BPM, meter and tracks (ARCH-19, AC 6)
Proof: run js | ✓ Session > loads a song

**C33** - With fakes, pressing a chord plays its notes in the selected timbre (ARCH-19, AC 6)
Proof: run js | ✓ Session > presses a chord

**C34** - With fakes, changing the timbre replays the sounding chord in it and loads its files (ARCH-19, AC 6)
Proof: run js | ✓ Session > changes the timbre

**C35** - With fakes, the pad volume 0-100 reaches the engine as 0-1 and is stored (ARCH-19, AC 6)
Proof: run js | ✓ Session > changes the pad volume

**C36** - With fakes, editing a step sends that track's audible steps (ARCH-19, AC 6)
Proof: run js | ✓ Session > edits a step

**C37** - With fakes, setting the Trainer during playback sends it as a held setting (ARCH-19, AC 6)
Proof: run js | ✓ Session > sets the Trainer

**C38** - `src/ui/` holds editor, stadium, grooves, improv and header modules (ARCH-20, AC 7)
Proof: run js | ✓ Layers > ui holds one module per screen and the header

**C39** - `src/main.ts` holds at most 150 lines (ARCH-21, AC 8)
Proof: run js | ✓ Layers > main.ts holds at most 150 lines

**C40** - Every vitest test name of `591f031` runs and passes, the DOM suite from `tests/app.test.ts` (ARCH-22, AC 9)
Proof: `python3 -I tests/fixtures/tests_kept.py js`

**C41** - `npm run build` exits 0 (ARCH-23, AC 10)
Proof: `npm run build`

**C42** - `CONTRIBUTING.md` describes both stacks and the rule, and every path it names exists (ARCH-24, AC 1)
Proof: run js | ✓ Docs > CONTRIBUTING names the layers and only paths that exist

**C43** - `GLOSSARY.md` defines Session, Trainer, Instrument and each layer (ARCH-25, AC 2)
Proof: run js | ✓ Docs > GLOSSARY defines Session, Trainer, Instrument and each layer

**C44** - `.specs/STATE.md` records the layer rule as AD-028 (ARCH-26, AC 3)
Proof: run js | ✓ Docs > STATE records the layer rule as AD-028

**C45** - The pad bank fixture reads `src/domain/chords.ts` and passes (ARCH-27, edge case 1)
Proof: `python3 -I tests/fixtures/pad_bank_check.py`

**C46** - `copy_wasm.js` with no build exits 1 printing the path it looked for (ARCH-28, edge case 2)
Proof: run js | ✓ copy_wasm > exits 1 naming the path when the build is missing

---

## Handoff

**Settled mid-build:** Execution by batch sub-agents - user: "aprovo, vamos de sub agents"; 2026-11-04, after the batch 1 worker stopped mid-T7 and T7-T8 finished inline: the remaining tasks also by sub-agents - user: "Pode seguir todas as proximas tasks com subagents"
**Dispatched:** batch 1 (Phases 1-2, T1-T8) at e6c9c7c - stopped mid-T7 without a report; T7 and T8 finished inline; batch 2 (Phases 3-5, T9-T16) at f704fe3 - returned, T9-T16 done; batch 3 (Phases 6-7, T17-T24) at db75884 - returned, T17-T24 done
**Walked:** none - every story's Independent Test is a command (cargo test, vitest, reading CONTRIBUTING.md), run by check_proofs.py; no criterion cites a capture, so no pictures
