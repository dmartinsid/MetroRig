# Precise-Only Metronome Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/precise-only/design.md`
**Status**: Approved
**Approved**: 2026-10-31 - user: "aprovado"
**Build**: `npm run build:wasm; npx vite build`
**Run rust**: `cargo test`
**Run js**: `npx vitest run --reporter=verbose`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Rust engine | unit | All branches; 1:1 to spec ACs; all listed edge cases | `src/lib.rs` `mod tests` | `cargo test` |
| Preset rules and visual sync | unit | All branches; 1:1 to spec ACs; all listed edge cases | `tests/*.test.ts` | `npx vitest run --reporter=verbose` |
| Audio bridge | unit | Every changed message and block path | `tests/*.test.ts` | `npx vitest run --reporter=verbose` |
| Page wiring | integration | Each control in scope, against the real `index.html` | `src/index.test.ts` | `npx vitest run --reporter=verbose` |
| Shipped WASM | integration | Export list of the built file | `tests/wasm.test.ts` | `npx vitest run --reporter=verbose` |
| Build config | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute. `tsc` already fails on missing AudioWorklet types, and the project has no linter, so neither is a gate.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After engine or TypeScript tasks | `cargo test && npx vitest run` |
| Full | After page wiring tasks | `cargo test && npx vitest run && npx vite build` |
| Build | After config tasks and the WASM rebuild | `npm run build:wasm && npx vite build && cargo test && npx vitest run` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Engine timing and sound

```
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 2: Engine Trainer

```
T6 → T7 → T8
```

### Phase 3: Preset and visual rules

```
T8 → T9 → T10 → T11 → T12
```

### Phase 4: Audio bridge

```
T12 → T13 → T14
```

### Phase 5: Page wiring and shipping

```
T14 → T15 → T16 → T17 → T18 → T19 → T20
```

---

## Task Breakdown

### T1: Add an optimized test profile

**What**: Add `[profile.test] opt-level = 3`, so the 1-hour timing tests run in seconds.
**Where**: `Cargo.toml`
**Depends on**: None
**Reuses**: Existing Cargo manifest
**Requirement**: TIME-02

**Done when**:

- [ ] `cargo test` runs all 14 existing tests with the new profile

**Tests**: none
**Gate**: build

**Commit**: `build(test): optimize the test profile for long timing runs`

---

### T2: Prove exact timing

**What**: Add black-box tests that render through the engine exports and compare every hit to the ideal grid.
**Where**: `src/lib.rs`
**Depends on**: T1
**Reuses**: The harness at `/tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/timing/h.rs`
**Requirement**: TIME-01, TIME-02, TIME-03, BPM-01

**Done when**:

- [ ] Tests cover the 40 to 240 BPM range, including 97, 133 and 187
- [ ] 1-hour tests cover all six BPMs from TIME-02
- [ ] Gate passes with 18 Rust tests

**Tests**: unit
**Gate**: quick

**Commit**: `test(engine): prove hits stay within one sample of the grid`

---

### T3: Remove swing from the engine

**What**: Delete the swing field, `get_step_limit`, `engine_set_swing` and `test_swing_timings`.
**Where**: `src/lib.rs`
**Depends on**: T2
**Reuses**: `samples_per_step`
**Requirement**: TIME-03

**Done when**:

- [ ] Every step lasts `samples_per_step`
- [ ] `test_measure_total_duration_no_drift` keeps running without its swing line
- [ ] Gate passes with 17 Rust tests, the only removal being `test_swing_timings`

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(engine): remove swing timing`

---

### T4: Remove the click reverb

**What**: Delete `Reverb`, its mix and its two tests, then add a test that an accented click has no repetition.
**Where**: `src/lib.rs`
**Depends on**: T3
**Reuses**: Impulse sample from T2
**Requirement**: CLICK-01

**Done when**:

- [ ] An accented impulse produces one non-zero output sample before the next step
- [ ] Gate passes with 16 Rust tests, the only removals being the two reverb tests

**Tests**: unit
**Gate**: quick

**Commit**: `feat(engine): remove the click echo`

---

### T5: Start clean after Stop

**What**: Clear playing samples and click state on start.
**Where**: `src/lib.rs`
**Depends on**: T4
**Reuses**: `playback_active`, `active_click_amp`
**Requirement**: PLAY-01, PLAY-02, PLAY-03

**Done when**:

- [ ] A kick stopped halfway leaves no sound in the next run
- [ ] Gate passes with 19 Rust tests

**Tests**: unit
**Gate**: quick

**Commit**: `fix(engine): start each run without leftover sound`

---

### T6: Trim leading silence

**What**: Store each sample from its first frame at or above 1% of peak in either channel.
**Where**: `src/lib.rs`
**Depends on**: T5
**Reuses**: `engine_load_sample`
**Requirement**: ONSET-01, ONSET-02, ONSET-03

**Done when**:

- [ ] `public/woodblock.wav`, parsed in the test, sounds within 1 sample of its step
- [ ] A silent sample loads unchanged
- [ ] Gate passes with 22 Rust tests

**Tests**: unit
**Gate**: quick

**Commit**: `fix(engine): start every sample on its beat`

---

### T7: Move stepped Trainer changes to beat 1

**What**: Apply bar and seconds increments when step 0 fires, and rewrite the two Trainer tests that assert the old timing.
**Where**: `src/lib.rs`
**Depends on**: T6
**Reuses**: `increment_bpm`, `on_measure_complete`
**Requirement**: TRAIN-02, TRAIN-03, TRAIN-04, TRAIN-15, TRAIN-16

**Done when**:

- [ ] The interval into beat 1 keeps the old BPM, and the next uses the new BPM
- [ ] A seconds increment waits for the first beat 1 after the time elapses
- [ ] Smooth still changes between downbeats, and BPM never passes Target
- [ ] Gate passes with 27 Rust tests

**Tests**: unit
**Gate**: quick

**Commit**: `fix(engine): change stepped Trainer tempo on beat 1`

---

### T8: Add Start BPM and pending Trainer settings

**What**: Start at Start BPM, and hold settings received during playback until beat 1.
**Where**: `src/lib.rs`
**Depends on**: T7
**Reuses**: `engine_set_trainer`
**Requirement**: TRAIN-01, TRAIN-05, TRAIN-06, TRAIN-07, TRAIN-08, TRAIN-09, TRAIN-11

**Done when**:

- [ ] Each requirement has its own test
- [ ] Sending unchanged settings during a run leaves the Trainer counters running
- [ ] Gate passes with 35 Rust tests

**Tests**: unit
**Gate**: quick

**Commit**: `feat(engine): honour Start BPM and apply Trainer edits on beat 1`

---

### T9: Correct the meter rules and 12/8 presets

**What**: Add `measureLengthFor`, and correct Blues Shuffle and Jazz Swing.
**Where**: `src/state.ts`
**Depends on**: T8
**Reuses**: `FACTORY_PRESETS`
**Requirement**: BPM-02, BPM-03, BPM-04

**Done when**:

- [ ] Both presets have 24 steps with a click every 6, at 135 and 195 BPM
- [ ] Gate passes with 20 JavaScript tests

**Tests**: unit
**Gate**: quick

**Commit**: `fix(presets): make 12/8 presets match their BPM`

---

### T10: Normalize stored presets

**What**: Add `normalizePreset` to drop swing and expand legacy 12/8, and add `startBpmFor`.
**Where**: `src/state.ts`
**Depends on**: T9
**Reuses**: `Preset`
**Requirement**: SWING-03, BPM-06, BPM-07, BPM-08

**Done when**:

- [ ] 6/8 with 12 steps stays unchanged
- [ ] `startBpmFor` covers the preset-load edge cases
- [ ] Gate passes with 27 JavaScript tests

**Tests**: unit
**Gate**: quick

**Commit**: `feat(presets): normalize stored swing and legacy 12/8 presets`

---

### T11: Move factory grooves to 24 steps

**What**: Export `FACTORY_GROOVES` from `state.ts` with 24-step Blues Shuffle and Jazz Swing, leaving `main.ts` on its local copy until T15.
**Where**: `src/state.ts`
**Depends on**: T10
**Reuses**: The groove data in `src/main.ts:705`
**Requirement**: BPM-05

**Done when**:

- [ ] Both grooves hold 24 steps on all three tracks
- [ ] Gate passes with 28 JavaScript tests

**Tests**: unit
**Gate**: quick

**Commit**: `fix(presets): expand the 12/8 factory grooves`

---

### T12: Create visual sync helpers

**What**: Create `visualDelayMs` and `VisualScheduler`.
**Where**: `src/visualSync.ts`
**Depends on**: T11
**Reuses**: None
**Requirement**: VIS-01, VIS-02, VIS-03

**Done when**:

- [ ] Fake timers prove the delay and the cancel
- [ ] Missing, non-finite and negative values give no delay
- [ ] Gate passes with 33 JavaScript tests

**Tests**: unit
**Gate**: quick

**Commit**: `feat(visual): add latency-based beat scheduling`

---

### T13: Quiet the worklet

**What**: Remove swing and logs from the processor, and reuse heap views until WASM memory changes.
**Where**: `src/audio/metronome-processor.ts`
**Depends on**: T12
**Reuses**: Existing message switch
**Requirement**: RT-01, RT-02

**Done when**:

- [ ] A stubbed processor runs 100 blocks with no logs and one heap view
- [ ] Memory growth rebuilds the views
- [ ] Gate passes with 36 JavaScript tests

**Tests**: unit
**Gate**: quick

**Commit**: `perf(worklet): remove logging and per-block heap views`

---

### T14: Quiet the main-thread bridge

**What**: Remove `setSwing` and message logs from `MetronomeNode`, and add `visualDelayMs()`.
**Where**: `src/audio/MetronomeNode.ts`
**Depends on**: T13
**Reuses**: `visualDelayMs` from T12
**Requirement**: RT-01, SWING-03, VIS-01

**Done when**:

- [ ] `tests/MetronomeNode.test.ts` proves no log on tick and no swing message
- [ ] `setSwing` is gone from the mock in `src/index.test.ts`
- [ ] Gate passes with 39 JavaScript tests

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(audio): remove swing and tick logs from the node`

---

### T15: Remove swing from the page logic

**What**: Remove swing handling and use `measureLengthFor` and `FACTORY_GROOVES`.
**Where**: `src/main.ts`
**Depends on**: T14
**Reuses**: Helpers from T9 and T11
**Requirement**: SWING-03, SWING-04, BPM-02, BPM-05

**Done when**:

- [ ] Saving a loaded preset stores no swing field
- [ ] Gate passes with 40 JavaScript tests

**Tests**: integration
**Gate**: full

**Commit**: `refactor(ui): remove swing from page logic`

---

### T16: Separate tempo sync from settings sync

**What**: Add `syncPlaybackSettings`, and normalize presets as they load.
**Where**: `src/main.ts`
**Depends on**: T15
**Reuses**: `syncAudioSettings`, `normalizePreset`, `startBpmFor`
**Requirement**: TRAIN-05, TRAIN-12, BPM-06

**Done when**:

- [ ] Time signature, groove and Trainer changes send no `setBpm`
- [ ] A preset loaded during playback sends `startBpmFor`
- [ ] Gate passes with 43 JavaScript tests

**Tests**: integration
**Gate**: full

**Commit**: `fix(ui): keep the live BPM when settings change`

---

### T17: Show the live BPM in the Editor

**What**: Show tick BPM during playback, and the preset BPM after Stop.
**Where**: `src/main.ts`
**Depends on**: T16
**Reuses**: `currentBpm` from the tick
**Requirement**: TRAIN-10, TRAIN-13, TRAIN-14

**Done when**:

- [ ] A slider move during a run sends `setBpm` immediately
- [ ] Tick and Stop update the Editor number
- [ ] Gate passes with 46 JavaScript tests

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): show the live BPM during Trainer runs`

---

### T18: Render beats through the scheduler

**What**: Send tick rendering through `VisualScheduler`, and cancel it on Stop.
**Where**: `src/main.ts`
**Depends on**: T17
**Reuses**: `VisualScheduler`, `MetronomeNode.visualDelayMs`
**Requirement**: VIS-01, VIS-03

**Done when**:

- [ ] With 200 ms latency, the clock hand starts 200 ms after the tick
- [ ] Stop cancels a pending render
- [ ] Gate passes with 48 JavaScript tests

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): align beat visuals with reported latency`

---

### T19: Remove the swing control from the page

**What**: Remove the swing control and title the card "Measure".
**Where**: `index.html`
**Depends on**: T18
**Reuses**: Existing card
**Requirement**: SWING-01, SWING-02

**Done when**:

- [ ] `src/index.test.ts` finds no `#swing-slider` and reads the title "Measure"
- [ ] Gate passes with 50 JavaScript tests

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): remove the swing control`

---

### T20: Ship the rebuilt WASM

**What**: Rebuild the shipped WASM and test its export list.
**Where**: `public/pkg/metrorig_audio_bg.wasm`
**Depends on**: T19
**Reuses**: `npm run build:wasm`
**Requirement**: SWING-05

**Done when**:

- [ ] `tests/wasm.test.ts` finds no `engine_set_swing` export
- [ ] Gate passes with 51 JavaScript tests

**Tests**: integration
**Gate**: build

**Commit**: `build(wasm): ship the precise-only engine`

---

## Checks

**C1** - Each hit lands within 1 sample of ideal across 40 to 240 BPM (TIME-01, AC 1)
Proof: run rust | test tests::time_01_hits_within_one_sample ... ok

**C2** - The final hit after 1 hour stays within 1 sample at all six BPMs (TIME-02, AC 2)
Proof: run rust | test tests::time_02_one_hour_no_drift ... ok

**C3** - Every step lasts `sampleRate * 60 / (bpm * 4)` samples (TIME-03, AC 3)
Proof: run rust | test tests::time_03_every_step_same_duration ... ok

**C4** - The Editor has no swing control (SWING-01, AC 1)
Proof: run js | ✓ src/index.test.ts > Precise page > swing_01 no swing control

**C5** - The card title is "Measure" (SWING-02, AC 2)
Proof: run js | ✓ src/index.test.ts > Precise page > swing_02 card title is Measure

**C6** - A stored swing value reaches no engine message (SWING-03, AC 3)
Proof: run js | ✓ src/index.test.ts > Precise page > swing_03 stored swing sends nothing

**C7** - A saved preset stores no swing field (SWING-04, AC 4)
Proof: run js | ✓ src/index.test.ts > Precise page > swing_04 save omits swing

**C8** - The shipped WASM exports no `engine_set_swing` (SWING-05, AC 5)
Proof: run js | ✓ tests/wasm.test.ts > Shipped WASM > swing_05 exports no swing function

**C9** - BPM counts quarter notes in every meter (BPM-01, AC 1)
Proof: run rust | test tests::bpm_01_quarter_note_in_every_meter ... ok

**C10** - Time signatures use 4, 2 and 1 steps per note value (BPM-02, AC 2)
Proof: run js | ✓ tests/state.test.ts > Meter rules > bpm_02 steps per note value

**C11** - Blues Shuffle is 12/8, 24 steps, 135 BPM, click every 6 (BPM-03, AC 3)
Proof: run js | ✓ tests/state.test.ts > Meter rules > bpm_03 blues shuffle preset

**C12** - Jazz Swing is 12/8, 24 steps, 195 BPM, click every 6 (BPM-04, AC 4)
Proof: run js | ✓ tests/state.test.ts > Meter rules > bpm_04 jazz swing preset

**C13** - Both factory grooves hold 24 steps (BPM-05, AC 5)
Proof: run js | ✓ tests/state.test.ts > Meter rules > bpm_05 factory grooves hold 24 steps

**C14** - Legacy 12/8 expands to 24 steps with each step at twice its index (BPM-06, AC 6)
Proof: run js | ✓ tests/state.test.ts > Preset normalization > bpm_06 expands legacy steps

**C15** - Expanded BPM is `bpm * 1.5`, rounded (BPM-07, AC 7)
Proof: run js | ✓ tests/state.test.ts > Preset normalization > bpm_07 rounds expanded bpm

**C16** - Expanded BPM stops at 240 (BPM-08, AC 8)
Proof: run js | ✓ tests/state.test.ts > Preset normalization > bpm_08 caps expanded bpm

**C17** - The first hit plays at Start BPM (TRAIN-01, AC 1)
Proof: run rust | test tests::train_01_first_hit_at_start_bpm ... ok

**C18** - The old BPM holds into beat 1 and the new one follows it (TRAIN-02, AC 2)
Proof: run rust | test tests::train_02_bars_change_on_beat_one ... ok

**C19** - A seconds increment lands on the first beat 1 after the time (TRAIN-03, AC 3)
Proof: run rust | test tests::train_03_seconds_change_on_beat_one ... ok

**C20** - Smooth raises BPM between downbeats (TRAIN-04, AC 4)
Proof: run rust | test tests::train_04_smooth_is_continuous ... ok

**C21** - A Trainer edit keeps the live BPM at that moment (TRAIN-05, AC 5)
Proof: run rust | test tests::train_05_edit_keeps_live_bpm ... ok

**C22** - A Trainer edit applies from the next beat 1 (TRAIN-06, AC 6)
Proof: run rust | test tests::train_06_edit_applies_on_beat_one ... ok

**C23** - Start BPM edits wait for the next Play (TRAIN-07, AC 7)
Proof: run rust | test tests::train_07_start_edit_waits_for_play ... ok

**C24** - Disabling holds the live BPM until Stop (TRAIN-08, AC 8)
Proof: run rust | test tests::train_08_disable_holds_live_bpm ... ok

**C25** - Enabling during playback continues from the live BPM (TRAIN-09, AC 9)
Proof: run rust | test tests::train_09_enable_continues_from_live_bpm ... ok

**C26** - A slider move changes the BPM immediately (TRAIN-10, AC 10)
Proof: run js | ✓ src/index.test.ts > Precise page > train_10 slider sends bpm immediately

**C27** - The Trainer continues from the slider value (TRAIN-11, AC 11)
Proof: run rust | test tests::train_11_continues_from_slider_value ... ok

**C28** - Meter, grid and groove changes keep the live BPM (TRAIN-12, AC 12)
Proof: run js | ✓ src/index.test.ts > Precise page > train_12 settings keep live bpm

**C29** - The Editor shows the live BPM during a run (TRAIN-13, AC 13)
Proof: run js | ✓ src/index.test.ts > Precise page > train_13 editor shows live bpm

**C30** - The Editor shows the preset BPM after Stop (TRAIN-14, AC 14)
Proof: run js | ✓ src/index.test.ts > Precise page > train_14 stop shows preset bpm

**C31** - The Trainer never passes Target BPM (TRAIN-15, AC 15)
Proof: run rust | test tests::train_15_never_passes_target ... ok

**C32** - Start BPM holds when it is at or above Target (TRAIN-16, AC 16)
Proof: run rust | test tests::train_16_holds_start_at_target ... ok

**C33** - Loading discards frames before 1% of peak in either channel (ONSET-01, AC 1)
Proof: run rust | test tests::onset_01_trims_before_one_percent ... ok

**C34** - Woodblock sounds within 1 sample of its step (ONSET-02, AC 2)
Proof: run rust | test tests::onset_02_woodblock_on_the_step ... ok

**C35** - A silent sample loads unchanged (ONSET-03, AC 3)
Proof: run rust | test tests::onset_03_silent_sample_unchanged ... ok

**C36** - An accented click has no delayed repetition (CLICK-01, AC 4)
Proof: run rust | test tests::click_01_accent_has_no_echo ... ok

**C37** - Stop gives silence from the next block (PLAY-01, AC 1)
Proof: run rust | test tests::play_01_stop_is_silent ... ok

**C38** - Play after Stop has no leftover sound (PLAY-02, AC 2)
Proof: run rust | test tests::play_02_restart_has_no_leftovers ... ok

**C39** - Play fires step 0 first (PLAY-03, AC 3)
Proof: run rust | test tests::play_03_fires_step_zero_first ... ok

**C40** - A tick renders after base plus output latency (VIS-01, AC 1)
Proof: run js | ✓ src/index.test.ts > Precise page > vis_01 render waits for latency

**C41** - Invalid latency gives a delay of 0 (VIS-02, AC 2)
Proof: run js | ✓ tests/visualSync.test.ts > Visual sync > vis_02 invalid latency gives zero

**C42** - Stop cancels pending beat animations (VIS-03, AC 3)
Proof: run js | ✓ src/index.test.ts > Precise page > vis_03 stop cancels pending render

**C43** - Messages and ticks write no console log (RT-01, AC 1)
Proof: run js | ✓ tests/metronome-processor.test.ts > Worklet > rt_01 no logs on messages or ticks

**C44** - Heap views are reused while memory size is unchanged (RT-02, AC 2)
Proof: run js | ✓ tests/metronome-processor.test.ts > Worklet > rt_02 reuses heap views

---

## Handoff

**Settled mid-build:** The user approved with "aprovado" after being told batch sub-agents are the default unless they say "inline".
**Dispatched:** batch 1 (phases 1-2, T1-T8) from HEAD of feat/precise-only - sent
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1 → T2 → T3 → T4 → T5 → T6
Phase 2:  T7 → T8
Phase 3:  T9 → T10 → T11 → T12
Phase 4:  T13 → T14
Phase 5:  T15 → T16 → T17 → T18 → T19 → T20
```

Execution is strictly sequential.
