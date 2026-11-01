# Song Bars Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/song-bars/design.md`
**Status**: In Progress
**Approved**: 2026-11-01 - user: "aprovado"
**Build**: `npm run build`
**Run js**: `npx vitest run --reporter=verbose`
**Run rust**: `cargo test`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Rust engine | unit | All branches; 1:1 to spec ACs | `src/lib.rs` | `cargo test` |
| Bar, song and state rules | unit | All branches; 1:1 to spec ACs; all listed edge cases | `tests/*.test.ts` | `npx vitest run --reporter=verbose` |
| Tab converter | unit | Every path and each refusal | `tests/tabToGrid.test.ts` | `npx vitest run --reporter=verbose` |
| Audio bridge | unit | Every changed message | `tests/metronome-processor.test.ts`, `tests/MetronomeNode.test.ts` | `npx vitest run --reporter=verbose` |
| Engine binary | unit | The new export | `tests/wasm.test.ts` | `npx vitest run --reporter=verbose` |
| Page markup and wiring | integration | Each control in scope, against the real `index.html` | `src/index.test.ts` | `npx vitest run --reporter=verbose` |
| CSS | none | - (happy-dom applies no CSS; the walk proves it) | - | build gate only |
| Docs | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute. `tsc` fails on missing AudioWorklet types and the project has no linter, so neither is a gate.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After rule and wiring tasks | `npx vitest run` |
| Rust | After engine tasks | `cargo test` |
| Full | After CSS and docs tasks | `npx vitest run && npx vite build` |
| Build | After the WASM rebuild and the last task | `cargo test && npx vitest run && npx vite build` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Engine and audio

Nothing shows yet.

```
T1 → T2 → T3 → T4
```

### Phase 2: Rules and data

Pure rules, then the songs.

```
T5 → T6 → T7 → T8 → T9
```

### Phase 3: Editor

The page plays and edits 4 bars.

```
T10 → T11 → T12 → T13 → T14 → T15
```

### Phase 4: Stadium, style and docs

The rest of what a user sees.

```
T16 → T17 → T18 → T19
```

---

## Task Breakdown

### T1: Make the engine loop 4 bars

**What**: Make the engine loop 4 bars.
**Where**: `src/lib.rs`
**Depends on**: None
**Reuses**: see design.md
**Requirement**: CNT-01

**Done when**:

- [x] `STEPS_COUNT` is 128 and one bar still stops at 32 steps
- [x] `engine_set_bars` accepts 1 to 4 and refuses anything else
- [x] The step wraps at bars × measure length with no gap
- [x] `on_measure_complete` runs at every bar, so stepped Trainer counts real bars
- [x] Rust tests cover 1-bar behaviour unchanged, the wrap, each refusal and both Trainer curves
- [x] Gate check passes: `cargo test`

**Tests**: unit
**Gate**: rust

**Commit**: `feat(audio): loop patterns of several bars`

---

### T2: Carry 128 steps and the bar count through the worklet

**What**: Carry 128 steps and the bar count through the worklet.
**Where**: `src/audio/metronome-processor.ts`
**Depends on**: T1
**Reuses**: see design.md
**Requirement**: CNT-01

**Done when**:

- [x] `UPDATE_GRID` pads to 128 and `gridMirror` follows
- [x] `SET_BARS` calls `engine_set_bars`
- [x] `activeTrackIds` reads a step past 32 correctly
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(audio): carry 4 bars through the worklet`

---

### T3: Add `setBars` to the audio node

**What**: Add `setBars` to the audio node.
**Where**: `src/audio/MetronomeNode.ts`
**Depends on**: T2
**Reuses**: see design.md
**Requirement**: CNT-01

**Done when**:

- [x] `setBars` posts `SET_BARS`
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(audio): send the bar count from the node`

---

### T4: Rebuild the WASM binary

**What**: Rebuild the WASM binary.
**Where**: `public/pkg/metrorig_audio_bg.wasm`
**Depends on**: T3
**Reuses**: see design.md
**Requirement**: CNT-01

**Done when**:

- [x] `npm run build:wasm` output is committed
- [x] `tests/wasm.test.ts` asserts `engine_set_bars` is exported
- [x] Gate check passes: `cargo test && npx vitest run && npx vite build`

**Tests**: unit
**Gate**: build

**Commit**: `build(audio): rebuild the engine with bars`

---

### T5: Add the pure bar rules

**What**: Add the pure bar rules.
**Where**: `src/bars.ts`
**Depends on**: None
**Reuses**: see design.md
**Requirement**: BAR-01

**Done when**:

- [x] Each function in the design exists
- [x] Tests cover 1 bar, 4 bars and every bar boundary
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the bar rules`

---

### T6: Add `bars` to presets and clean it on load

**What**: Add `bars` to presets and clean it on load.
**Where**: `src/state.ts`
**Depends on**: T5
**Reuses**: see design.md
**Requirement**: SNG-01

**Done when**:

- [x] `Preset.bars` is optional
- [x] A preset with no `bars` keeps its steps as 1 bar
- [x] `bars` that do not fit the steps fall to 1
- [x] `completeKit` fills missing tracks to the whole pattern
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): store the bar count in presets`

---

### T7: Show `STEPS` over 128

**What**: Show `STEPS` over 128.
**Where**: `src/display.ts`
**Depends on**: T6
**Reuses**: see design.md
**Requirement**: CNT-01

**Done when**:

- [x] `formatSteps` shows the total over 128
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): count steps over the new limit`

---

### T8: Convert 4 consecutive bars from a tab

**What**: Convert 4 consecutive bars from a tab.
**Where**: `scripts/tab_to_grid.js`
**Depends on**: T7
**Reuses**: see design.md
**Requirement**: DOC-02

**Done when**:

- [x] `barsToGrid` returns 4 bars joined per track
- [x] It refuses a stretch with another time signature or a tempo change
- [x] The command line takes the first measure
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(songs): convert 4 bars from a tab`

---

### T9: Store 4 bars for the 14 songs

**What**: Store 4 bars for the 14 songs.
**Where**: `src/songs.ts`
**Depends on**: T8
**Reuses**: see design.md
**Requirement**: SNG-01

**Done when**:

- [x] Each song holds 4 consecutive bars from its tab, at its revision
- [x] Each song holds at least 2 different bars, Highway to Hell and Crossroads from another stretch
- [x] `source.measure` is the first bar and `bpm` the tab's tempo there
- [x] `section` names the stretch
- [x] `songToPreset` marks every beat of the 4 bars in `Click`, with one accent on beat 1 of bar 1
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(songs): store 4 bars of each song`

---

### T10: Send the bar count and count position by bar

**What**: Send the bar count and count position by bar.
**Where**: `src/main.ts`
**Depends on**: None
**Reuses**: see design.md
**Requirement**: CNT-01

**Done when**:

- [x] `syncMeterAndGrid` sends the bars
- [x] `POS` and `STEPS` read the real bar and step
- [x] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): count position by real bars`

---

### T11: Add the bar selector markup

**What**: Add the bar selector markup.
**Where**: `index.html`
**Depends on**: T10
**Reuses**: see design.md
**Requirement**: BAR-01

**Done when**:

- [x] Buttons `1` to `4` sit above the grid, hidden by default
- [x] `src/index.test.ts` finds them in the real page
- [x] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): add the bar selector`

---

### T12: Show and edit the bar on screen

**What**: Show and edit the bar on screen.
**Where**: `src/main.ts`
**Depends on**: T11
**Reuses**: see design.md
**Requirement**: BAR-01

**Done when**:

- [x] The selector shows on 4 bars only and marks the current bar
- [x] `drawGrid` draws the bar on screen
- [x] A cell and a figure change only that bar
- [x] A song loads on bar 1
- [x] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): edit one bar at a time`

---

### T13: Follow playback in the Editor

**What**: Follow playback in the Editor.
**Where**: `src/main.ts`
**Depends on**: T12
**Reuses**: see design.md
**Requirement**: BAR-01

**Done when**:

- [x] The grid follows the bar in play
- [x] Pressing a bar during playback holds until the next bar, with no change in sound
- [x] Stop returns to bar 1
- [x] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): follow the bar in play`

---

### T14: Write grooves into the bar on screen

**What**: Write grooves into the bar on screen.
**Where**: `src/main.ts`
**Depends on**: T13
**Reuses**: see design.md
**Requirement**: BAR-01

**Done when**:

- [x] A Groove Library pick writes only the bar on screen and leaves `Click`
- [x] `Save Groove` stores the bar on screen as 1 bar
- [x] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): keep grooves to the bar on screen`

---

### T15: Confirm a time signature change on 4 bars

**What**: Confirm a time signature change on 4 bars.
**Where**: `src/main.ts`
**Depends on**: T14
**Reuses**: see design.md
**Requirement**: BAR-05

**Done when**:

- [x] The native confirm comes before any change, on both inputs and both steppers
- [x] Accepting keeps bar 1 resized and hides the selector
- [x] Declining restores the inputs and keeps the 4 bars
- [x] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): confirm before dropping bars`

---

### T16: Draw the bar in play on the Stadium clock

**What**: Draw the bar in play on the Stadium clock.
**Where**: `src/main.ts`
**Depends on**: None
**Reuses**: see design.md
**Requirement**: STD-02

**Done when**:

- [x] The clock draws 16 slices of the bar in play
- [x] It changes with the step that starts the bar
- [x] Stopped, it shows bar 1
- [x] Orbs pulse as on 1 bar
- [x] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): show the bar in play on the clock`

---

### T17: Style the bar selector

**What**: Style the bar selector.
**Where**: `src/index.css`
**Depends on**: T16
**Reuses**: see design.md
**Requirement**: BAR-01

**Done when**:

- [x] The selector matches the figure chips, with the current bar lit
- [x] No sideways page scroll at 1024px and 390px
- [x] Gate check passes: `npx vitest run && npx vite build`

**Tests**: none
**Gate**: full

**Commit**: `style(ui): style the bar selector`

---

### T18: Describe 4 bars in the README

**What**: Describe 4 bars in the README.
**Where**: `README.md`
**Depends on**: T17
**Reuses**: see design.md
**Requirement**: DOC-02

**Done when**:

- [x] The Grooves description says songs play 4 bars
- [x] Gate check passes: `npx vitest run && npx vite build`

**Tests**: none
**Gate**: full

**Commit**: `docs: describe the 4 bars of a song`

---

### T19: Describe bars in the design doc

**What**: Describe bars in the design doc.
**Where**: `.stitch/DESIGN.md`
**Depends on**: T18
**Reuses**: see design.md
**Requirement**: DOC-02

**Done when**:

- [x] The bar selector, the clock's current bar and `STEPS: 16/128` are described
- [x] Gate check passes: `npx vitest run && npx vite build`

**Tests**: none
**Gate**: full

**Commit**: `docs(design): describe bars`

---

## Checks

**C1** - Each of the 14 songs holds 4 bars of 16 steps in 4/4, 64 steps in all (SNG-01, AC 1)
Proof: run js | ✓ tests/songs.test.ts > Songs > bars_01 four bars of sixteen

**C2** - Each song's bars are the 4 consecutive measures its first measure names (SNG-01, AC 2)
Proof: run js | ✓ tests/songs.test.ts > Songs > bars_02 consecutive measures

**C3** - Each song holds at least 2 different bars (SNG-01, AC 3)
Proof: run js | ✓ tests/songs.test.ts > Songs > bars_03 two different bars

**C4** - Each song cites its first measure and that measure's tempo (SNG-01, AC 4)
Proof: run js | ✓ tests/songs.test.ts > Songs > bars_04 first measure and tempo

**C5** - `Click` marks all 16 beats with an accent only on beat 1 of bar 1 (SNG-01, AC 5)
Proof: run js | ✓ tests/songs.test.ts > Songs > bars_05 click marks every beat

**C6** - Past step 64 the engine returns to step 1 with no gap (SNG-01, AC 6)
Proof: run rust | test tests::pattern_wraps_after_four_bars ... ok

**C7** - A song saved as a preset loads back with 4 bars (SNG-01, AC 7)
Proof: run js | ✓ src/index.test.ts > Song Bars > bars_07 saved song keeps four bars

**C8** - A stored preset with no `bars` loads as 1 bar with its steps (SNG-01, AC 8)
Proof: run js | ✓ tests/state.test.ts > Preset normalization > bars_08 no bar count is one bar

**C9** - A 4-bar pattern shows the selector `1 2 3 4` (BAR-01, AC 1)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_01 selector on four bars

**C10** - A 1-bar pattern shows no selector (BAR-01, AC 2)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_02 no selector on one bar

**C11** - Pressing a bar shows its 16 steps and marks it (BAR-01, AC 3)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_03 press shows the bar

**C12** - A song loads on bar 1 (BAR-01, AC 4)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_04 song loads on bar one

**C13** - During playback the Editor shows the bar in play (BAR-01, AC 5)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_05 follows the bar in play

**C14** - A press during playback holds to the next bar and sends nothing to the engine (BAR-01, AC 6)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_06 press during playback

**C15** - A cell edit changes only that step of the bar on screen (BAR-01, AC 7)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_07 cell changes one bar

**C16** - A `Figure` writes only in the bar on screen (BAR-01, AC 8)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_08 figure stays in the bar

**C17** - A Groove Library pick writes only in the bar on screen (BAR-01, AC 9)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_09 groove stays in the bar

**C18** - `Save Groove` stores the bar on screen as 1 bar (BAR-01, AC 10)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_10 save groove takes the bar

**C19** - Stop returns the Editor to bar 1 (BAR-01, AC 11)
Proof: run js | ✓ src/index.test.ts > Song Bars > edit_11 stop returns to bar one

**C20** - At 1024px and 390px pressing a bar shows it and the page does not scroll sideways (BAR-01, AC 12)
Proof: walk - at 1024px and 390px pressing a bar shows it and the page does not scroll sideways

**C21** - Stepped Trainer on 4 bars counts each bar of 16 steps (CNT-01, AC 1)
Proof: run rust | test tests::trainer_counts_each_bar ... ok

**C22** - Smooth Trainer takes the same time on 4 bars as on 1 (CNT-01, AC 2)
Proof: run rust | test tests::smooth_trainer_ignores_bars ... ok

**C23** - `POS` shows bars since Play and the step inside the bar (CNT-01, AC 3)
Proof: run js | ✓ src/index.test.ts > Song Bars > count_03 position by bar

**C24** - `STEPS` reads `64/128` on 4 bars and `16/128` on 1 bar (CNT-01, AC 4)
Proof: run js | ✓ src/index.test.ts > Song Bars > count_04 steps over the limit

**C25** - The engine holds 128 steps per track and a bar past 32 is refused (CNT-01, AC 5)
Proof: run rust | test tests::holds_128_steps ... ok

**C26** - A time signature over 32 steps keeps the alert and the old value (CNT-01, AC 6)
Proof: run js | ✓ src/index.test.ts > Song Bars > count_06 limit of one bar

**C27** - The clock draws 16 slices per ring and the numbers 1 to 4 on 4 bars (STD-02, AC 1)
Proof: run js | ✓ src/index.test.ts > Song Bars > clock_01 sixteen slices

**C28** - During playback the clock shows the hits of the bar in play (STD-02, AC 2)
Proof: run js | ✓ src/index.test.ts > Song Bars > clock_02 bar in play

**C29** - The clock changes on the tick that starts the bar (STD-02, AC 3)
Proof: run js | ✓ src/index.test.ts > Song Bars > clock_03 changes on the first step

**C30** - Stopped, the clock shows bar 1 whatever the Editor shows (STD-02, AC 4)
Proof: run js | ✓ src/index.test.ts > Song Bars > clock_04 stopped shows bar one

**C31** - An orb pulses on a hit of any bar (STD-02, AC 5)
Proof: run js | ✓ src/index.test.ts > Song Bars > clock_05 orb pulses

**C32** - A time signature change on 4 bars asks before changing anything (BAR-05, AC 1)
Proof: run js | ✓ src/index.test.ts > Song Bars > meter_01 asks first

**C33** - Accepting keeps bar 1 resized and drops bars 2 to 4 (BAR-05, AC 2)
Proof: run js | ✓ src/index.test.ts > Song Bars > meter_02 accept keeps bar one

**C34** - Declining keeps the 4 bars and the old time signature (BAR-05, AC 3)
Proof: run js | ✓ src/index.test.ts > Song Bars > meter_03 decline changes nothing

**C35** - Returning to 1 bar hides the selector (BAR-05, AC 4)
Proof: run js | ✓ src/index.test.ts > Song Bars > meter_04 selector hides

**C36** - `tab_to_grid.js` turns a first measure into 4 bars (DOC-02, AC 1)
Proof: run js | ✓ tests/tabToGrid.test.ts > tab_to_grid > bars_doc four bars from one measure

**C37** - `README.md` says songs play 4 bars (DOC-02, AC 2)
Proof: `grep -q '4 bars' README.md`

**C38** - `.stitch/DESIGN.md` describes the bar selector (DOC-02, AC 3)
Proof: `grep -q 'bar selector' .stitch/DESIGN.md`

**C39** - A 1-bar preset loaded during a song's bar 3 keeps `POS` counting (Edge Cases, 1)
Proof: run js | ✓ src/index.test.ts > Song Bars > edge_01 load during bar three

**C40** - Edits in any bar ask before a card replaces the song (Edge Cases, 2)
Proof: run js | ✓ src/index.test.ts > Song Bars > edge_02 edits in any bar ask

**C41** - Stored `bars` that do not fit the steps load as 1 bar (Edge Cases, 3)
Proof: run js | ✓ tests/state.test.ts > Preset normalization > edge_03 bars that do not fit

**C42** - The user approves all 14 songs by ear, with the Every Day I Have the Blues tempo decided (Success Criteria, item 1)
Proof: walk - the user played all 14 songs and approved each one, recorded in Handoff

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** no batch worker: the tasks run in the main session, stated before approval and approved with "aprovado".
**Dispatched:** Verifier at the HEAD of this commit. No screens sub-agent: no criterion cites a capture.
**Walked:** Run `npx vite --port 4317`, open `http://localhost:4317/`. Songs: Grooves, `Open in Editor` on `Back in Black` opened bar 1, `STEPS: 64/128`, 94 BPM, Kick `x.......x.......`; bar 4 showed the fill, Kick `x....x..x..x....`. Widths: at 1024px and 390px pressing `3` showed bar 3 with `document.scrollWidth` equal to the window width. Playback at 1440px: the selector walked 4, 1, 2, 3, 4, 1, 2 while `POS` counted `BAR 04` to `BAR 10`, with no console error but the missing `favicon.ico`. Stadium during playback: the Kick and Snare rings changed at each bar, 2/2 lit in the plain bars and 4/5 in the fill. Stop returned to bar 1 and `BAR 01 · STEP 01`. A plain preset shows no selector. The sound itself was not heard: approval by ear: pending, the user has not heard the 14 songs yet.

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 → T2 → T3 → T4
Phase 2:  T5 → T6 → T7 → T8 → T9
Phase 3:  T10 → T11 → T12 → T13 → T14 → T15
Phase 4:  T16 → T17 → T18 → T19
```
