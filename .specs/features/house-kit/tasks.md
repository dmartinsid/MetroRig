# House Kit Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/house-kit/design.md`
**Status**: Approved
**Approved**: 2026-11-01 - user: "aprovo e vamos de subagents"
**Build**: `npm run build`
**Run js**: `npx vitest run --reporter=verbose`
**Run rust**: `cargo test`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Rust engine | unit | All branches; 1:1 to spec ACs; listed edge cases | `src/lib.rs` | `cargo test` |
| Shipped samples | unit | Format, tail, levels and size of the real files | `tests/kit.test.ts` | `npx vitest run --reporter=verbose` |
| Kit, song and state rules | unit | All branches; 1:1 to spec ACs | `tests/*.test.ts` | `npx vitest run --reporter=verbose` |
| Tab converter | unit | Every tom note | `tests/tabToGrid.test.ts` | `npx vitest run --reporter=verbose` |
| Audio bridge | unit | Every changed message | `tests/metronome-processor.test.ts`, `tests/MetronomeNode.test.ts` | `npx vitest run --reporter=verbose` |
| Engine binary | unit | The new export and track 12 | `tests/wasm.test.ts` | `npx vitest run --reporter=verbose` |
| Page markup and wiring | integration | Each control in scope, against the real `index.html` | `src/index.test.ts` | `npx vitest run --reporter=verbose` |
| CSS | none | - (happy-dom applies no CSS; the walk proves it) | - | build gate only |
| Docs | none | - (build gate only) | - | build gate only |
| Ear-tuned trims | none | - (the user's ear decides; the walk records it) | - | build gate only |

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

### Phase 1: Samples

The 54 files, checked, with nothing playing them yet.

```
T1
```

### Phase 2: Engine

The bank, its rules and the binary.

```
T2 → T3 → T4 → T5 → T6 → T7
```

### Phase 3: Audio bridge

Takes reach the engine.

```
T8 → T9
```

### Phase 4: Kit and songs

13 tracks, and the kit plays.

```
T10 → T11 → T12 → T13
```

### Phase 5: Screens and docs

Colours, credit and records.

```
T14 → T15 → T16 → T17 → T18
```

### Phase 6: Ear approval

The user decides.

```
T19 → T20
```

---

## Task Breakdown

### T1: Build the House Kit samples

**What**: Write the builder, generate the 54 files into `public/kit/house`, and test them.
**Where**: `scripts/build_house_kit.py`
**Depends on**: None
**Reuses**: `scripts/generate_clicks.py`
**Requirement**: HK-01, HK-09, HK-10, HK-11

**Done when**:

- [x] 54 files exist: 6 pieces × 3 recordings × 3 takes
- [x] Tests in `tests/kit.test.ts` read the real files for format, tail, levels and total size
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(kit): build the House Kit samples`

---

### T2: Grow the engine to 13 tracks

**What**: Set `MAX_SAMPLES` to 13.
**Where**: `src/lib.rs`
**Depends on**: None - the phase before it
**Reuses**: `MAX_SAMPLES`
**Requirement**: HK-15

**Done when**:

- [x] A test plays a sample on track 12
- [x] Gate check passes: `cargo test`

**Tests**: unit
**Gate**: rust

**Commit**: `feat(audio): carry 13 tracks in the engine`

---

### T3: Add the take bank

**What**: Add `engine_load_take` and play the take of the step's dynamic at gain 1.0, leaving single-sample tracks on their gains.
**Where**: `src/lib.rs`
**Depends on**: T2
**Reuses**: `engine_load_sample` onset trim, `step_gain`
**Requirement**: HK-02, HK-03, HK-06, HK-08

**Done when**:

- [x] Ghost, Normal and Accent each play their own take
- [x] A bank hit plays at its recorded level
- [x] A single-sample track keeps 0.3, 0.7 and 1.0
- [x] Gate check passes: `cargo test`

**Tests**: unit
**Gate**: rust

**Commit**: `feat(audio): play one recording per dynamic`

---

### T4: Rotate the takes

**What**: Rotate takes per track and dynamic, restarting at Play.
**Where**: `src/lib.rs`
**Depends on**: T3
**Reuses**: `Engine::start`
**Requirement**: HK-04, HK-05, HK-33, HK-34

**Done when**:

- [x] Takes play 1, 2, 3, 1
- [x] Play restarts on take 1
- [x] The loop keeps the rotation
- [x] A dynamic changed mid-play takes that dynamic's next take
- [x] Gate check passes: `cargo test`

**Tests**: unit
**Gate**: rust

**Commit**: `feat(audio): alternate the takes`

---

### T5: Fall back over missing takes

**What**: Skip missing takes, then missing dynamics.
**Where**: `src/lib.rs`
**Depends on**: T4
**Reuses**: `next_source`
**Requirement**: HK-12, HK-13, HK-14

**Done when**:

- [x] Each of the 3 levels of fallback has a test
- [x] Gate check passes: `cargo test`

**Tests**: unit
**Gate**: rust

**Commit**: `feat(audio): skip takes that failed to load`

---

### T6: Fade a replaced hit

**What**: Add the 5 ms fading voice.
**Where**: `src/lib.rs`
**Depends on**: T5
**Reuses**: the drum loop
**Requirement**: HK-07

**Done when**:

- [x] A retrigger sounds the old hit for 5 ms, falling to silence
- [x] A retrigger on a finished voice adds nothing
- [x] The open hat cut stays hard
- [x] Gate check passes: `cargo test`

**Tests**: unit
**Gate**: rust

**Commit**: `feat(audio): fade a replaced hit`

---

### T7: Rebuild the engine

**What**: Rebuild the tracked binary and test the export and track 12.
**Where**: `tests/wasm.test.ts`
**Depends on**: T6
**Reuses**: `npm run build:wasm`
**Requirement**: HK-15, HK-02

**Done when**:

- [x] `public/pkg/metrorig_audio_bg.wasm` holds `engine_load_take`
- [x] A test plays a take on track 12 through the binary
- [x] Gate check passes: `cargo test && npx vitest run && npx vite build`

**Tests**: unit
**Gate**: build

**Commit**: `build(audio): rebuild the engine with takes`

---

### T8: Carry takes through the worklet

**What**: Add `LOAD_TAKE`, and set `TRACK_COUNT` to 13.
**Where**: `src/audio/metronome-processor.ts`
**Depends on**: None - the phase before it
**Reuses**: `LOAD_SAMPLE`
**Requirement**: HK-01, HK-21

**Done when**:

- [x] `LOAD_TAKE` reaches `engine_load_take`
- [x] A tick reports tracks 11 and 12
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(audio): carry takes through the worklet`

---

### T9: Load a take from the node

**What**: Add `loadTake`, multiplying by the trim.
**Where**: `src/audio/MetronomeNode.ts`
**Depends on**: T8
**Reuses**: `loadSample`
**Requirement**: HK-06, HK-27

**Done when**:

- [x] The message holds the channels × trim
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(audio): load a take at its trim`

---

### T10: Declare 13 tracks

**What**: Add Mid Tom and Low Tom, the banks, `takesOf` and the group.
**Where**: `src/kit.ts`
**Depends on**: None - the phase before it
**Reuses**: `TRACKS`
**Requirement**: HK-01, HK-02, HK-03, HK-15, HK-16, HK-17, HK-18, HK-19, HK-20, HK-21

**Done when**:

- [x] `takesOf` gives 9 URLs per piece, on files that exist
- [x] Track order, ids and groups match the spec
- [x] Existing tests that pin 11 tracks now pin 13, with no assertion loosened
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(kit): declare the House Kit tracks`

---

### T11: Load the banks

**What**: Load each bank in `loadKit`, logging a failed path.
**Where**: `src/main.ts`
**Depends on**: T10
**Reuses**: `loadKit`
**Requirement**: HK-01, HK-12, HK-14

**Done when**:

- [x] Every take is loaded
- [x] A failed take logs its path and the rest still load
- [x] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick

**Commit**: `feat(kit): load the House Kit`

---

### T12: Map 4 toms from tabs

**What**: Write the 6 tom notes to the 4 tracks.
**Where**: `scripts/tab_to_grid.js`
**Depends on**: T11
**Reuses**: `PIECES`
**Requirement**: HK-22

**Done when**:

- [x] Each of the 6 notes lands on its track
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(songs): convert 4 toms from a tab`

---

### T13: Move Battery to the Low Tom

**What**: Move its 2 hits from track 10 to track 12.
**Where**: `src/songs.ts`
**Depends on**: T12
**Reuses**: `bars`
**Requirement**: HK-23

**Done when**:

- [ ] Battery matches its tab
- [ ] The other 13 songs keep their grids
- [ ] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(songs): play Battery on the Low Tom`

---

### T14: Style the new toms

**What**: Add 2 colours, and fit 13 rows and 13 cards.
**Where**: `src/index.css`
**Depends on**: None - the phase before it
**Reuses**: the tom colours
**Requirement**: HK-17

**Done when**:

- [ ] Build passes
- [ ] The walk shows 13 rows at 390, 1024 and 1440 px
- [ ] Gate check passes: `npx vitest run && npx vite build`

**Tests**: none
**Gate**: full

**Commit**: `style(ui): style the 13 tracks`

---

### T15: Credit the kit in the footer

**What**: Add the credit line and link.
**Where**: `index.html`
**Depends on**: T14
**Reuses**: `.status-bar`
**Requirement**: HK-31, HK-32

**Done when**:

- [ ] The line reads as the spec gives it
- [ ] The link opens the channel in a new tab
- [ ] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): credit Better Mixes in the footer`

---

### T16: Record the kit license

**What**: Add The House Kit to the license file, each sample's source included.
**Where**: `public/kit/LICENSE.md`
**Depends on**: T15
**Reuses**: `LICENSE.md`
**Requirement**: HK-28, HK-29

**Done when**:

- [ ] A test reads each required fact
- [ ] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `docs(kit): record the House Kit`

---

### T17: Update the README

**What**: Thank Better Mixes, and describe 13 tracks.
**Where**: `README.md`
**Depends on**: T16
**Reuses**: the Drum Samples section
**Requirement**: HK-30

**Done when**:

- [ ] A test reads the thanks and the link
- [ ] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `docs: thank Better Mixes`

---

### T18: Update the design system

**What**: Describe 13 tracks, the colours and the footer.
**Where**: `.stitch/DESIGN.md`
**Depends on**: T17
**Reuses**: the track table
**Requirement**: HK-15

**Done when**:

- [ ] `grep` finds Mid Tom and Low Tom
- [ ] Gate check passes: `npx vitest run && npx vite build`

**Tests**: none
**Gate**: full

**Commit**: `docs(design): describe the 13 tracks`

---

### T19: Tune and approve by ear

**What**: Run the app; the user judges each piece; set the trims or roll a piece back.
**Where**: `src/kit.ts`
**Depends on**: None - the phase before it
**Reuses**: `bank.trim`
**Requirement**: HK-24, HK-25, HK-26, HK-27

**Done when**:

- [ ] The user approves each of the 6 pieces, in their words, written to Handoff
- [ ] Trims hold the approved values
- [ ] Gate check passes: `cargo test && npx vitest run && npx vite build`

**Tests**: none
**Gate**: build

**Commit**: `feat(kit): set the trims the user approved`

---

### T20: Remove the replaced samples

**What**: Delete each earlier file an approved piece replaced, and its license row.
**Where**: `public/kit/LICENSE.md`
**Depends on**: T19
**Reuses**: `git rm`
**Requirement**: HK-11

**Done when**:

- [ ] `tests/kit.test.ts` passes on the remaining files
- [ ] No code refers to a deleted file
- [ ] Gate check passes: `cargo test && npx vitest run && npx vite build`

**Tests**: unit
**Gate**: build

**Commit**: `chore(kit): remove the replaced samples`

---

## Checks

**C1** - The kit holds 3 takes of 3 dynamics for all 6 pieces (HK-01, AC 1)
Proof: run js | ✓ tests/kit.test.ts > House Kit > hk_01 nine takes of each piece

**C2** - Kick and toms play Soft, Med and Hard for Ghost, Normal and Accent (HK-02, AC 2)
Proof: run rust | test tests::hk_02_kick_and_toms_map_their_dynamics ... ok

**C3** - Snare plays Soft, Hard and Crack for Ghost, Normal and Accent (HK-03, AC 3)
Proof: run js | ✓ tests/kit.test.ts > House Kit > hk_03 snare recordings

**C4** - Takes play in the order 1, 2, 3, 1 (HK-04, AC 4)
Proof: run rust | test tests::hk_04_takes_rotate_per_dynamic ... ok

**C5** - Play restarts every track and dynamic on take 1 (HK-05, AC 5)
Proof: run rust | test tests::hk_05_play_restarts_the_takes ... ok

**C6** - A new piece plays at its recorded level, with no step gain (HK-06, AC 6)
Proof: run rust | test tests::hk_06_bank_hit_has_no_step_gain ... ok

**C7** - A replaced hit falls to silence over 5 ms (HK-07, AC 7)
Proof: run rust | test tests::hk_07_replaced_hit_fades_over_5_ms ... ok

**C8** - Hi-hat and cymbals keep gains 0.3, 0.7 and 1.0 (HK-08, AC 8)
Proof: run rust | test tests::hk_08_single_sample_keeps_its_gains ... ok

**C9** - New samples are 44.1 kHz, 16-bit, stereo, cut at -60 dBFS (HK-09, AC 9)
Proof: run js | ✓ tests/kit.test.ts > House Kit > hk_09 format and tail

**C10** - A piece keeps the level differences of the recordings (HK-10, AC 10)
Proof: run js | ✓ tests/kit.test.ts > House Kit > hk_10 recorded levels

**C11** - All drum samples take at most 20 MB (HK-11, AC 11)
Proof: run js | ✓ tests/kit.test.ts > House Kit > hk_11 size limit

**C12** - A failed take logs its path (HK-12, AC 12)
Proof: run js | ✓ src/index.test.ts > House Kit > hk_12 logs a failed take

**C13** - A missing take plays the next loaded take of its dynamic (HK-12, AC 12)
Proof: run rust | test tests::hk_12_missing_take_is_skipped ... ok

**C14** - A missing dynamic plays the next loaded take of its track (HK-13, AC 13)
Proof: run rust | test tests::hk_13_missing_dynamic_falls_back ... ok

**C15** - A track with no takes stays silent while the others play (HK-14, AC 14)
Proof: run rust | test tests::hk_14_track_with_no_takes_is_silent ... ok

**C16** - The app lists the 13 tracks in the spec's order (HK-15, AC 1)
Proof: run js | ✓ tests/kit.test.ts > House Kit > hk_15 thirteen tracks in order

**C17** - Ids 0 to 10 keep their meaning, with Mid Tom 11 and Low Tom 12 (HK-16, AC 2)
Proof: run js | ✓ tests/kit.test.ts > House Kit > hk_16 ids stay

**C18** - The Editor shows 13 rows and 13 cards (HK-17, AC 3)
Proof: run js | ✓ src/index.test.ts > House Kit > hk_17 thirteen rows and cards

**C19** - A Mid or Low Tom cell cycles its dynamics and reaches the engine (HK-18, AC 4)
Proof: run js | ✓ src/index.test.ts > House Kit > hk_18 new tom cells cycle and play

**C20** - Mute and Solo work on Mid and Low Tom (HK-19, AC 5)
Proof: run js | ✓ src/index.test.ts > House Kit > hk_19 mute and solo the new toms

**C21** - A preset saved with 11 tracks keeps its hits, with the new toms empty (HK-20, AC 6)
Proof: run js | ✓ tests/state.test.ts > Preset normalization > hk_20 eleven track preset

**C22** - Mid and Low Tom light `SNARE/TOMS` (HK-21, AC 7)
Proof: run js | ✓ src/index.test.ts > House Kit > hk_21 new toms light the stadium group

**C23** - Tab notes 50, 47, 48, 45, 41 and 43 reach their toms (HK-22, AC 8)
Proof: run js | ✓ tests/tabToGrid.test.ts > tab_to_grid > hk_22 four toms

**C24** - Battery holds its 2 tom hits on Low Tom, and other songs keep their grids (HK-23, AC 9)
Proof: run js | ✓ tests/songs.test.ts > Songs > hk_23 toms on four tracks

**C25** - The user approves each of the 6 pieces by ear (HK-24, AC 1)
Proof: walk - the user plays the songs and a tom fill and answers per piece, written to Handoff and verification.md

**C26** - A rejected Kick, Snare, High Tom or Floor Tom goes back to its earlier sample (HK-25, AC 2)
Proof: walk - each rejected piece is heard on its earlier sample, or none was rejected, written to Handoff

**C27** - A rejected Mid or Low Tom gets other House Kit recordings until approved (HK-26, AC 3)
Proof: walk - each rejected piece is heard on its new recordings, or none was rejected, written to Handoff

**C28** - Trims hold the values the user approved (HK-27, AC 4)
Proof: walk - the trims in `src/kit.ts` match those the user heard, written to Handoff

**C29** - `LICENSE.md` names the kit, author, links, each source file and the missing terms (HK-28, AC 1)
Proof: run js | ✓ tests/kit.test.ts > House Kit > hk_28 license facts

**C30** - `LICENSE.md` attributes the release to the user's account of the video (HK-29, AC 2)
Proof: run js | ✓ tests/kit.test.ts > House Kit > hk_29 release is the user account

**C31** - The README thanks Better Mixes with its channel link (HK-30, AC 3)
Proof: run js | ✓ tests/kit.test.ts > House Kit > hk_30 readme credit

**C32** - The footer shows the credit line (HK-31, AC 4)
Proof: run js | ✓ src/index.test.ts > House Kit > hk_31 footer credit

**C33** - `Better Mixes` opens the channel in a new tab (HK-32, AC 5)
Proof: run js | ✓ src/index.test.ts > House Kit > hk_32 footer link

**C34** - The loop keeps the take rotation (HK-33, Edge Cases 1)
Proof: run rust | test tests::hk_33_loop_keeps_the_rotation ... ok

**C35** - A dynamic changed in play takes that dynamic's next take (HK-34, Edge Cases 2)
Proof: run rust | test tests::hk_34_changed_dynamic_uses_its_next_take ... ok

**C36** - The Editor fits 13 rows at 390, 1024 and 1440 px (HK-17, AC 3)
Proof: walk - no sideways page scroll at the 3 widths, written to Handoff

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** Sub-agents accepted, user: "aprovo e vamos de subagents". 3 batches. Work happens on branch `house-kit`, with no push.
**Dispatched:** Batch 1 (Phases 1-2, T1-T7) from ef86231, returned at b1e49e0. Batch 2 (Phases 3-4, T8-T13) from b1e49e0.
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
Phase 1:  T1
Phase 2:  T2 -> T3 -> T4 -> T5 -> T6 -> T7
Phase 3:  T8 -> T9
Phase 4:  T10 -> T11 -> T12 -> T13
Phase 5:  T14 -> T15 -> T16 -> T17 -> T18
Phase 6:  T19 -> T20
```

Execution is strictly sequential. 20 tasks pack into 3 batches: Phases 1 and 2, Phases 3 and 4, Phases 5 and 6.
