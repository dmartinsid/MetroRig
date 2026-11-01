# Interface V2 Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/interface-v2/design.md`
**Status**: Approved
**Approved**: 2026-10-31 - user: "aprovo"
**Build**: `npx vite build`
**Run js**: `npx vitest run --reporter=verbose`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Display and mix rules | unit | All branches; 1:1 to spec ACs; all listed edge cases | `tests/*.test.ts` | `npx vitest run --reporter=verbose` |
| Preset data | unit | Every changed entry | `tests/state.test.ts` | `npx vitest run --reporter=verbose` |
| Audio bridge | unit | Every new accessor | `tests/MetronomeNode.test.ts` | `npx vitest run --reporter=verbose` |
| Page markup and wiring | integration | Each control in scope, against the real `index.html` | `src/index.test.ts` | `npx vitest run --reporter=verbose` |
| CSS | none | - (happy-dom applies no CSS; the walk and the captures prove it) | - | build gate only |
| Docs | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute. `tsc` already fails on missing AudioWorklet types, and the project has no linter, so neither is a gate. `npm run build` is not used because the feature must not rebuild the WASM.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After rule and markup tasks | `npx vitest run` |
| Full | After wiring and CSS tasks | `npx vitest run && npx vite build` |
| Build | After the last task | `cargo test && npx vitest run && npx vite build` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Rules

Pure rules, with no screen.

```
T1 → T2 → T3 → T4
```

### Phase 2: Page

Markup and wiring against the real `index.html`.

```
T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12
```

### Phase 3: Look

CSS held to the captures.

```
T13 → T14 → T15 → T16
```

### Phase 4: Docs

The design document.

```
T17
```

---

## Task Breakdown

### T1: Add display rules

**What**: Pure functions for every new label
**Where**: `src/display.ts`
**Depends on**: None
**Reuses**: Nothing; new module
**Requirement**: TIME-01, TIME-05

**Done when**:

- [x] All 6 functions in `design.md` exported
- [x] `STEPS`, `POS`, clock and latency strings covered, 5 extra tests beside the checks
- [x] The tests of the checks for TIME-01, TIME-05 pass
- [x] Gate check passes: `npx vitest run`
- [x] Test count: 63 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the display rules`

---

### T2: Add the track mix

**What**: Mute and Solo rules
**Where**: `src/trackMix.ts`
**Depends on**: T1
**Reuses**: Nothing; new module
**Requirement**: MUTE-04, MUTE-05, MUTE-06

**Done when**:

- [x] `audibleSteps` returns the input length and never mutates it, 1 extra test beside the checks
- [x] The tests of the checks for MUTE-04, MUTE-05, MUTE-06 pass
- [x] Gate check passes: `npx vitest run`
- [x] Test count: 67 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the track mix rules`

---

### T3: Add the Metalcore groove

**What**: `metalcore` joins `FACTORY_GROOVES`
**Where**: `src/state.ts`
**Depends on**: T2
**Reuses**: `FACTORY_GROOVES`
**Requirement**: EDIT-23

**Done when**:

- [x] Existing groove tests still pass
- [x] The tests of the checks for EDIT-23 pass
- [x] Gate check passes: `npx vitest run`
- [x] Test count: 68 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(grooves): add Metalcore Breakdown to the library`

---

### T4: Expose the sample rate

**What**: `MetronomeNode.sampleRate()` returns the context rate
**Where**: `src/audio/MetronomeNode.ts`
**Depends on**: T3
**Reuses**: Existing context
**Requirement**: Success Criteria

**Done when**:

- [x] 1 test in `tests/MetronomeNode.test.ts` covers the getter
- [x] Gate check passes: `npx vitest run`
- [x] Test count: 69 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(audio): expose the context sample rate`

---

### T5: Rebuild the page markup

**What**: New structure for header, footer, Editor and Stadium, keeping every existing id
**Where**: `index.html`
**Depends on**: None
**Reuses**: Current ids
**Requirement**: SHELL-01, SHELL-02, SHELL-03, SHELL-09, EDIT-16, EDIT-19, EDIT-22, EDIT-02, STAD-03, STAD-04, STAD-05, STAD-09, MUTE-01, TIME-02

**Done when**:

- [x] No Stitch footer value or dead control survives
- [x] All earlier tests still pass
- [x] The tests of the checks for SHELL-01, SHELL-02, SHELL-03, SHELL-09, EDIT-16, EDIT-19, EDIT-22, EDIT-02, STAD-03, STAD-04, STAD-05, STAD-09, MUTE-01, TIME-02 pass
- [x] Gate check passes: `npx vitest run`
- [x] Test count: 83 tests pass (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): rebuild the page markup`

---

### T6: Wire the footer and toggle

**What**: Clock text at load, latency on ticks, toggle copy
**Where**: `src/main.ts`
**Depends on**: T5
**Reuses**: `visualDelayMs`
**Requirement**: SHELL-04, SHELL-05, SHELL-06, SHELL-07, SHELL-08

**Done when**:

- [x] `sampleRate` added to the test mock
- [x] The tests of the checks for SHELL-04, SHELL-05, SHELL-06, SHELL-07, SHELL-08 pass
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 88 tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): wire the footer telemetry`

---

### T7: Wire the shared timer

**What**: Both timers restart on Play and stop on Stop
**Where**: `src/main.ts`
**Depends on**: T6
**Reuses**: `updatePracticeTimer`
**Requirement**: TIME-03, TIME-04, TIME-06

**Done when**:

- [x] `updateTimers` is the only writer of the timer text
- [x] The tests of the checks for TIME-03, TIME-04, TIME-06 pass
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 91 tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): share one timer across both modes`

---

### T8: Redraw the grid

**What**: `BEAT/SUB`, hit and accent marks, spacer and sustain kept
**Where**: `src/main.ts`
**Depends on**: T7
**Reuses**: `drawGrid`
**Requirement**: EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09

**Done when**:

- [x] Accent stays reachable on Click only, as today
- [x] The tests of the checks for EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09 pass
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 96 tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): draw the new step cells`

---

### T9: Wire the pattern bar

**What**: `PAT`, `STEPS`, `RESOLUTION`, `POS`, bar count and the sequencer dot
**Where**: `src/main.ts`
**Depends on**: T8
**Reuses**: `renderTick`, `togglePlay`
**Requirement**: EDIT-03, EDIT-04, EDIT-10, EDIT-11, EDIT-12, EDIT-13, EDIT-14, EDIT-15, EDGE-02, EDGE-03

**Done when**:

- [x] A save refreshes `PAT`
- [x] The tests of the checks for EDIT-03, EDIT-04, EDIT-10, EDIT-11, EDIT-12, EDIT-13, EDIT-14, EDIT-15, EDGE-02, EDGE-03 pass
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 106 tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): show the live pattern bar`

---

### T10: Wire the Editor controls

**What**: Slider scale, steppers, open Trainer card and steady dot
**Where**: `src/main.ts`
**Depends on**: T9
**Reuses**: `updateTimeSignature`
**Requirement**: EDIT-17, EDIT-18, EDIT-20, EDIT-21, EDIT-24, EDIT-25, EDIT-26, EDIT-27, EDIT-28, EDIT-29, EDGE-01

**Done when**:

- [x] Steppers go through `updateTimeSignature`
- [x] Opening Stadium refreshes the Trainer status, because `vis_01` holds the text steady in the Editor until a tick renders
- [x] The tests of the checks for EDIT-17, EDIT-18, EDIT-20, EDIT-21, EDIT-24, EDIT-25, EDIT-26, EDIT-27, EDIT-28, EDIT-29, EDGE-01 pass
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 117 tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): wire the Editor controls`

---

### T11: Wire Mute and Solo

**What**: `sendTrack` and the M and S buttons
**Where**: `src/main.ts`
**Depends on**: T10
**Reuses**: `syncMeterAndGrid`
**Requirement**: MUTE-02, MUTE-03, MUTE-07, MUTE-08, MUTE-09, MUTE-10, MUTE-11, MUTE-12, MUTE-13, EDGE-05, EDGE-06

**Done when**:

- [x] `sendTrack` is the only caller of `updateGrid`
- [x] The tests of the checks for MUTE-02, MUTE-03, MUTE-07, MUTE-08, MUTE-09, MUTE-10, MUTE-11, MUTE-12, MUTE-13, EDGE-05, EDGE-06 pass
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 128 tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): add per-track Mute and Solo`

---

### T12: Redraw the Stadium

**What**: Annular slices, status pill and orbs
**Where**: `src/main.ts`
**Depends on**: T11
**Reuses**: `drawBeatClock`, `updateStadiumStatus`
**Requirement**: STAD-02, STAD-06, STAD-07, STAD-08, STAD-10, STAD-11, STAD-12, EDGE-04

**Done when**:

- [x] A one-step bar still draws
- [x] The tests of the checks for STAD-02, STAD-06, STAD-07, STAD-08, STAD-10, STAD-11, STAD-12, EDGE-04 pass
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 136 tests pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): redraw the Stadium clock and readout`

---

### T13: Style the shell

**What**: Tokens, header and footer
**Where**: `src/index.css`
**Depends on**: None
**Reuses**: Current tokens
**Requirement**: Success Criteria

**Done when**:

- [x] Header and footer match both captures in a browser
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 136 tests pass (no silent deletions)

**Tests**: none
**Gate**: full

**Commit**: `style(ui): style the rack shell`

---

### T14: Style the Editor

**What**: Cells, chips, cards, steppers, switch, track mix
**Where**: `src/index.css`
**Depends on**: T13
**Reuses**: Current tokens
**Requirement**: EDIT-01

**Done when**:

- [x] Build the capture `.specs/features/interface-v2/captures/editor.png`
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 136 tests pass (no silent deletions)

**Tests**: none
**Gate**: full

**Commit**: `style(ui): style the Editor`

---

### T15: Style the Stadium

**What**: Clock, panel, pill and orbs
**Where**: `src/index.css`
**Depends on**: T14
**Reuses**: Current tokens
**Requirement**: STAD-01

**Done when**:

- [x] Build the capture `.specs/features/interface-v2/captures/stadium.png`
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 136 tests pass (no silent deletions)

**Tests**: none
**Gate**: full

**Commit**: `style(ui): style the Stadium`

---

### T16: Add narrow layouts

**What**: Breakpoint at 1024px and the grid scroller
**Where**: `src/index.css`
**Depends on**: T15
**Reuses**: Current layout
**Requirement**: RESP-01, RESP-02, RESP-03, RESP-04, RESP-05, RESP-06, RESP-07

**Done when**:

- [x] Checked at 1440, 1024, 1023 and 390px
- [x] Gate check passes: `npx vitest run && npx vite build`
- [x] Test count: 136 tests pass (no silent deletions)

**Tests**: none
**Gate**: full

**Commit**: `style(ui): add narrow window layouts`

---

### T17: Update the design document

**What**: Describe the shipped interface
**Where**: `.stitch/DESIGN.md`
**Depends on**: None
**Reuses**: Current document
**Requirement**: DOCS-01, DOCS-02

**Done when**:

- [ ] `Known Drift` holds only what remains
- [ ] Gate check passes: `cargo test && npx vitest run && npx vite build`
- [ ] Test count: 136 tests pass (no silent deletions)

**Tests**: none
**Gate**: build

**Commit**: `docs(design): describe the new interface`

---

## Checks

**C1** - The header shows the logo, `PRO`, both selectors and the toggle in both modes (SHELL-01, AC 1)
Proof: run js | ✓ src/index.test.ts > Interface V2 > shell_01 header controls

**C2** - The header has no `Editor`, `Stadium`, `Grooves` or `Presets` links, or `tune` and `settings` icons (SHELL-02, AC 2)
Proof: run js | ✓ src/index.test.ts > Interface V2 > shell_02 no dead controls

**C3** - The preset selector keeps its 4 groups (SHELL-03, AC 3)
Proof: run js | ✓ src/index.test.ts > Interface V2 > shell_03 preset groups

**C4** - Editor mode toggle reads `GO TO STADIUM MODE` (SHELL-04, AC 4)
Proof: run js | ✓ src/index.test.ts > Interface V2 > shell_04 editor toggle text

**C5** - Stadium mode toggle reads `GO TO EDITOR MODE` (SHELL-05, AC 5)
Proof: run js | ✓ src/index.test.ts > Interface V2 > shell_05 stadium toggle text

**C6** - The footer shows `AUDIO CLOCK: 44.1 kHz 128 SPLS (2.9ms)` at 44100 Hz (SHELL-06, AC 6)
Proof: run js | ✓ src/index.test.ts > Interface V2 > shell_06 footer clock

**C7** - After playback starts the footer shows `LATENCY: <value>ms` (SHELL-07, AC 7)
Proof: run js | ✓ src/index.test.ts > Interface V2 > shell_07 footer latency

**C8** - Before the first Play the footer shows `LATENCY: --` (SHELL-08, AC 8)
Proof: run js | ✓ src/index.test.ts > Interface V2 > shell_08 latency placeholder

**C9** - The footer has no engine version, CPU value or `Hardware Parity` (SHELL-09, AC 9)
Proof: run js | ✓ src/index.test.ts > Interface V2 > shell_09 no invented telemetry

**C10** - The Editor with a modified Rock Groove matches `captures/editor.png` (EDIT-01, AC 1)
Proof: browser captures/editor.running.png

**C11** - On open the sequencer header reads `4/4 Metronome  ·  4/4  ·  120 BPM` (EDIT-02, AC 2)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_02 opening header

**C12** - The sequencer dot is lit while playing (EDIT-03, AC 3)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_03 dot lit playing

**C13** - The sequencer dot is unlit when stopped (EDIT-04, AC 4)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_04 dot unlit stopped

**C14** - The count row starts with `BEAT/SUB` (EDIT-05, AC 5)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_05 beat sub label

**C15** - A hit cell shows a dot mark (EDIT-06, AC 6)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_06 hit mark

**C16** - An accent cell shows `▲` (EDIT-07, AC 7)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_07 accent mark

**C17** - The grid keeps a 0.5rem column between beats (EDIT-08, AC 8)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_08 beat spacer

**C18** - A gallop keeps its sustain cell (EDIT-09, AC 9)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_09 sustain kept

**C19** - The pattern bar shows `PAT: Rock Groove` for that preset (EDIT-10, AC 10)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_10 pattern name

**C20** - The pattern bar shows `STEPS: 16/32` in 4/4 (EDIT-11, AC 11)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_11 steps label

**C21** - The pattern bar shows `RESOLUTION: 1/16th` (EDIT-12, AC 12)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_12 resolution label

**C22** - When stopped the pattern bar shows `POS: BAR 01 · STEP 01` (EDIT-13, AC 13)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_13 stopped position

**C23** - A tick at step index 5 shows `STEP 06` (EDIT-14, AC 14)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_14 tick position

**C24** - Wrapping to step 1 shows `BAR 02` (EDIT-15, AC 15)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_15 bar count

**C25** - The BPM card is titled `TEMPO BUS`, with no `MASTER` (EDIT-16, AC 16)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_16 tempo bus title

**C26** - The slider shows `40`, the current BPM and `240` (EDIT-17, AC 17)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_17 slider scale

**C27** - Moving the slider updates the middle label (EDIT-18, AC 18)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_18 slider label follows

**C28** - The Measure card has no `MTR-04` (EDIT-19, AC 19)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_19 no measure code

**C29** - The Numerator stepper changes by 1 within 1 to 16 (EDIT-20, AC 20)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_20 numerator stepper

**C30** - The Denominator stepper walks `/4`, `/8`, `/16` and stops at each end (EDIT-21, AC 21)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_21 denominator stepper

**C31** - The groove selector is labelled `Groove Library` (EDIT-22, AC 22)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_22 groove label

**C32** - The library lists the 5 grooves with no BPM in the name (EDIT-23, AC 23)
Proof: run js | ✓ tests/state.test.ts > Factory grooves > edit_23 five named grooves

**C33** - Applying `Metalcore Breakdown` sets its parts and keeps the BPM (EDIT-24, AC 24)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_24 metalcore applied

**C34** - The Trainer card starts expanded (EDIT-25, AC 25)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_25 trainer starts open

**C35** - The `Trainer Active` switch sends the Trainer on and off (EDIT-26, AC 26)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_26 trainer switch

**C36** - The Trainer dot has no pulsing animation (EDIT-27, AC 27)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_27 steady dot

**C37** - An edit shows the Save Toast (EDIT-28, AC 28)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_28 toast after edit

**C38** - With no edit the Save Toast stays hidden (EDIT-29, AC 29)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edit_29 toast hidden

**C39** - Stadium with a speed trainer matches `captures/stadium.png` (STAD-01, AC 1)
Proof: browser captures/stadium.running.png

**C40** - Rings run outside in as Click, Kick, Snare, Hi-hat (STAD-02, AC 2)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_02 ring order

**C41** - The clock legend shows the 4 track names (STAD-03, AC 3)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_03 legend

**C42** - The selector is labelled `SPEED TRAINER ROUTINE` (STAD-04, AC 4)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_04 selector label

**C43** - The timer is labelled `ELAPSED REHEARSAL` (STAD-05, AC 5)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_05 timer label

**C44** - The tempo shows one decimal with `BPM` (STAD-06, AC 6)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_06 tempo format

**C45** - With the Trainer on the pill shows its values (STAD-07, AC 7)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_07 trainer status

**C46** - With the Trainer off the pill shows `Trainer Off` (STAD-08, AC 8)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_08 trainer off

**C47** - Each orb has a shape, an icon and its track name (STAD-09, AC 9)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_09 orb markup

**C48** - An audible hit scales its orb from 1.15 to 1.0 in 0.2s (STAD-10, AC 10)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_10 orb pulse

**C49** - Clicking an orb changes nothing (STAD-11, AC 11)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_11 orb inert

**C50** - Lit and sustain slices, the active numeral and the hand keep working (STAD-12, AC 12)
Proof: run js | ✓ src/index.test.ts > Interface V2 > stad_12 clock behaviours

**C51** - The timer starts at `00:00:00` (TIME-01, AC 1)
Proof: run js | ✓ tests/display.test.ts > Display rules > time_01 timer format

**C52** - The timer exists in both modes (TIME-02, AC 2)
Proof: run js | ✓ src/index.test.ts > Interface V2 > time_02 timer in both modes

**C53** - Play restarts the timer (TIME-03, AC 3)
Proof: run js | ✓ src/index.test.ts > Interface V2 > time_03 play restarts

**C54** - Stop keeps the last value (TIME-04, AC 4)
Proof: run js | ✓ src/index.test.ts > Interface V2 > time_04 stop keeps value

**C55** - Past 99:59:59 the hours keep counting (TIME-05, AC 5)
Proof: run js | ✓ tests/display.test.ts > Display rules > time_05 hours past 99

**C56** - Both modes show the same time during playback (TIME-06, AC 6)
Proof: run js | ✓ src/index.test.ts > Interface V2 > time_06 same time

**C57** - Each track has `M` and `S` controls (MUTE-01, AC 1)
Proof: run js | ✓ src/index.test.ts > Interface V2 > mute_01 controls

**C58** - `M` silences a track (MUTE-02, AC 2)
Proof: run js | ✓ src/index.test.ts > Interface V2 > mute_02 mute silences

**C59** - A second `M` restores it (MUTE-03, AC 3)
Proof: run js | ✓ src/index.test.ts > Interface V2 > mute_03 unmute restores

**C60** - A solo leaves only soloed tracks audible (MUTE-04, AC 4)
Proof: run js | ✓ tests/trackMix.test.ts > Track mix > mute_04 solo isolates

**C61** - Two solos are both audible (MUTE-05, AC 5)
Proof: run js | ✓ tests/trackMix.test.ts > Track mix > mute_05 solos add

**C62** - Solo wins over Mute (MUTE-06, AC 6)
Proof: run js | ✓ tests/trackMix.test.ts > Track mix > mute_06 solo beats mute

**C63** - A silenced row is dimmed (MUTE-07, AC 7)
Proof: run js | ✓ src/index.test.ts > Interface V2 > mute_07 row dimmed

**C64** - A silenced orb ignores ticks (MUTE-08, AC 8)
Proof: run js | ✓ src/index.test.ts > Interface V2 > mute_08 orb still

**C65** - An edit on a silenced track is kept and stays silent (MUTE-09, AC 9)
Proof: run js | ✓ src/index.test.ts > Interface V2 > mute_09 edit kept silent

**C66** - Saved presets and grooves hold the real steps (MUTE-10, AC 10)
Proof: run js | ✓ src/index.test.ts > Interface V2 > mute_10 saves real grid

**C67** - Mute and Solo survive preset and groove changes (MUTE-11, AC 11)
Proof: run js | ✓ src/index.test.ts > Interface V2 > mute_11 survives load

**C68** - Play sends empty grids for silenced tracks (MUTE-12, AC 12)
Proof: run js | ✓ src/index.test.ts > Interface V2 > mute_12 play sends empty

**C69** - A reload clears Mute and Solo (MUTE-13, AC 13)
Proof: run js | ✓ src/index.test.ts > Interface V2 > mute_13 reload clears

**C70** - At 1440px and 1024px the Editor has two columns (RESP-01, AC 1)
Proof: walk - at 1440 and 1024px the controls sit beside the sequencer

**C71** - At 1023px the controls sit under the sequencer (RESP-02, AC 2)
Proof: walk - at 1023px the controls sit under the sequencer

**C72** - At 390px the page has no horizontal scroll (RESP-03, AC 3)
Proof: walk - at 390px documentElement scrollWidth equals clientWidth in both modes

**C73** - At 390px only the grid scrolls (RESP-04, AC 4)
Proof: walk - at 390px the grid wrapper scrolls and the page stays still

**C74** - At 1023px the Stadium stacks the clock above the readout (RESP-05, AC 5)
Proof: walk - at 1023px the clock sits above the readout

**C75** - At 390px every header control is reachable (RESP-06, AC 6)
Proof: walk - at 390px each header control is on screen and clickable

**C76** - At 1440px a 32-step bar fits with no scrolling (RESP-07, AC 7)
Proof: walk - at 1440px in 8/4 the grid scrollWidth equals clientWidth

**C77** - `.stitch/DESIGN.md` covers the new footer and Mute/Solo (DOCS-01, AC 1)
Proof: `grep -q 'AUDIO CLOCK' .stitch/DESIGN.md && grep -q 'Track Mix' .stitch/DESIGN.md`

**C78** - `.stitch/DESIGN.md` drops the fixed drift items (DOCS-02, AC 2)
Proof: `! grep -q 'groove-settings-card' .stitch/DESIGN.md`

**C79** - Stepping past 32 steps shows the existing message and reverts (EDGE-01, AC 1)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edge_01 stepper limit

**C80** - `STEPS` follows a length change during playback (EDGE-02, AC 2)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edge_02 steps follow

**C81** - Stop returns `POS` to the start (EDGE-03, AC 3)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edge_03 stop resets position

**C82** - A non-trainer preset shows `Choose a speed trainer` (EDGE-04, AC 4)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edge_04 stadium placeholder

**C83** - With every track muted, playback and `POS` continue (EDGE-05, AC 5)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edge_05 all muted continues

**C84** - A groove applied to a silenced track keeps its grid empty (EDGE-06, AC 6)
Proof: run js | ✓ src/index.test.ts > Interface V2 > edge_06 groove stays silent

**C85** - The engine source and WASM binary are unchanged from the feature's starting commit (Success Criteria)
Proof: `git diff --quiet 5481ab6 -- src/lib.rs public/pkg`

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** The user answered "aprovo" and did not choose on sub-agents, so batches run inline, as recommended.
**Dispatched:** none
**Walked:** not yet

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 → T2 → T3 → T4
Phase 2:  T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12
Phase 3:  T13 → T14 → T15 → T16
Phase 4:  T17
```

Execution is strictly sequential.
