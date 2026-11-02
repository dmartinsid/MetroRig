# Pad Timbres Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/pad-timbres/design.md`
**Status**: Approved
**Approved**: 2026-11-02 - user: "aprovo e vamos de sugagents"
**Build**: `npm run build`
**Run js**: `npx vitest run --reporter=verbose`
**Run rust**: `cargo test`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Pad and engine | unit | All branches; 1:1 to spec ACs; listed edge cases | `src/pad.rs`, `src/lib.rs` | `cargo test` |
| Timbre rules | unit | All branches; 1:1 to spec ACs | `tests/chords.test.ts` | `npx vitest run --reporter=verbose` |
| Shipped banks and docs | unit | The real files, sizes and credits | `tests/padBank.test.ts`, `tests/fixtures/*.py` | `npx vitest run --reporter=verbose` |
| Bank builder | unit | Output format, tuning, loop level, repeatability | `tests/fixtures/orchestra_bank_check.py` | `python3 -I tests/fixtures/orchestra_bank_check.py` |
| Audio bridge | unit | Every changed message | `tests/metronome-processor.test.ts`, `tests/MetronomeNode.test.ts` | `npx vitest run --reporter=verbose` |
| Engine binary | unit | The changed exports | `tests/wasm.test.ts` | `npx vitest run --reporter=verbose` |
| Page markup and wiring | integration | Each control in scope, against the real `index.html` | `src/index.test.ts` | `npx vitest run --reporter=verbose` |
| CSS | none | - (happy-dom applies no CSS; the walk proves it) | - | build gate only |
| Ear-tuned mixes | none | - (the user's ear decides; the numeric checks still hold) | - | build gate only |

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

### Phase 1: Data

```
T1 → T2 → T3 → T4
```

### Phase 2: Engine

```
T5 → T6 → T7 → T8
```

### Phase 3: Bridge

```
T9 → T10
```

### Phase 4: Screen

```
T11 → T12 → T13
```

### Phase 5: Finish

```
T14 → T15
```

---

## Task Breakdown

### T1: Define the timbres

**What**: `PAD_TIMBRES`, `DEFAULT_TIMBRE`, `timbreNotes` and `parseTimbre`, keeping `PAD_BANK` until T12 removes it
**Where**: `src/chords.ts` (modify)
**Depends on**: None
**Reuses**: `chordMidi`, `parseVolume`
**Requirement**: TIM-07, TIM-14

**Done when**:

- [x] `tests/chords.test.ts` proves both checks
- [x] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(timbres): define the timbres`

---

### T2: Ship Choir and Sweep

**What**: Copy 5 Choir and 8 Sweep files, renaming `G#` and `F#`, and list them
**Where**: `public/pads/` (modify)
**Depends on**: T1
**Reuses**: `pad_bank_check.py`
**Requirement**: TIM-21, TIM-36

**Done when**:

- [x] The fixture reads every bank in `PAD_TIMBRES`
- [x] `pad_22` moves to 12 MB, as AD-019 sets
- [x] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(timbres): add the Choir and Sweep banks`

---

### T3: Build the Orchestra bank tool

**What**: The builder and `tests/fixtures/orchestra_bank_check.py`
**Where**: `scripts/build_orchestra_bank.py`
**Depends on**: T2
**Reuses**: `scripts/build_house_kit.py`
**Requirement**: TIM-24, TIM-25

**Done when**:

- [x] Two runs give the same bytes
- [x] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(timbres): add the Orchestra bank builder`

---

### T4: Ship the Orchestra bank

**What**: Download VSCO into the scratchpad, run the builder and list 13 files
**Where**: `public/pads/orchestra/`
**Depends on**: T3
**Reuses**: `scripts/build_orchestra_bank.py`
**Requirement**: TIM-13, TIM-17, TIM-21, TIM-22, TIM-24, TIM-36

**Done when**:

- [x] Pitch, level and loop fixtures pass on the real files
- [x] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(timbres): add the Orchestra bank`

---

### T5: Give slots a timbre

**What**: Capture the New Age hash, then add banks per timbre, `Slot.timbre`, 7 notes and the new `play` and `load`
**Where**: `src/pad.rs` (modify)
**Depends on**: None - the previous phase
**Reuses**: `Slot`, `holds`, `nearest_file`
**Requirement**: TIM-03, TIM-05, TIM-10, TIM-15, TIM-23, TIM-33, TIM-44

**Done when**:

- [x] Every `chord-pads` Rust test still passes, adapted only to the new signature
- [x] The hash was taken before the first change
- [x] Gate passes

**Tests**: unit
**Gate**: rust

**Commit**: `feat(timbres): give each slot a timbre`

---

### T6: Mix each timbre

**What**: `MIXES`, the chorus fraction, and the gains that hold level and peak
**Where**: `src/pad.rs` (modify)
**Depends on**: T5
**Reuses**: `SYNTH_GAIN`, `SAMPLE_GAIN`
**Requirement**: TIM-09, TIM-11, TIM-12, TIM-13, TIM-16, TIM-18, TIM-19, TIM-20

**Done when**:

- [x] Tests decode the real banks
- [x] `pad_14`, `pad_20`, `pad_27` and `pad_60` still pass unchanged
- [x] Gate passes

**Tests**: unit
**Gate**: rust

**Commit**: `feat(timbres): mix each timbre`

---

### T7: Hold a loading timbre

**What**: The fallback synth and its crossfade to files
**Where**: `src/pad.rs` (modify)
**Depends on**: T6
**Reuses**: `Voice.file_gain`
**Requirement**: TIM-30, TIM-31, TIM-32

**Done when**:

- [ ] The three tests pass
- [ ] Gate passes

**Tests**: unit
**Gate**: rust

**Commit**: `feat(timbres): hold a loading timbre on the synth`

---

### T8: Wire the engine

**What**: New `engine_pad_play` and `engine_pad_load`, and the rebuilt binary
**Where**: `src/lib.rs` (modify)
**Depends on**: T7
**Reuses**: the pad FFI
**Requirement**: TIM-45

**Done when**:

- [ ] `tests/wasm.test.ts` plays a timbre
- [ ] Every drum test passes
- [ ] Gate passes

**Tests**: unit
**Gate**: build

**Commit**: `feat(timbres): carry the timbre through the engine`

---

### T9: Carry the timbre to the worklet

**What**: `PAD_PLAY` and `PAD_LOAD` with the timbre, and up to 7 notes
**Where**: `src/audio/metronome-processor.ts` (modify)
**Depends on**: None - the previous phase
**Reuses**: the pad messages
**Requirement**: TIM-15

**Done when**:

- [ ] `tests/metronome-processor.test.ts` covers both
- [ ] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(timbres): carry the timbre in the worklet`

---

### T10: Expose the timbre on the node

**What**: `padPlay` and `padLoad` with the timbre
**Where**: `src/audio/MetronomeNode.ts` (modify)
**Depends on**: T9
**Reuses**: `padLoad`
**Requirement**: TIM-15

**Done when**:

- [ ] `tests/MetronomeNode.test.ts` covers both
- [ ] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(timbres): expose the timbre on the audio node`

---

### T11: Add the select

**What**: The control, `metrorig_pad_timbre`, and chords played in the chosen timbre
**Where**: `src/main.ts` (modify)
**Depends on**: None - the previous phase
**Reuses**: `renderImprov`, `parseVolume`
**Requirement**: TIM-01, TIM-02, TIM-03, TIM-04, TIM-06, TIM-08, TIM-42

**Done when**:

- [ ] Tests use the gesture
- [ ] Gate passes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(timbres): add the timbre select`

---

### T12: Load per timbre

**What**: Load state, notices and retry per timbre, replacing `PAD_BANK`
**Where**: `src/main.ts` (modify)
**Depends on**: T11
**Reuses**: the first-visit load
**Requirement**: TIM-26, TIM-27, TIM-28, TIM-29, TIM-34, TIM-35, TIM-43

**Done when**:

- [ ] `chord-pads` load tests still hold their rule, on the selected timbre
- [ ] Gate passes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(timbres): load each timbre on demand`

---

### T13: Style the select

**What**: Per `.stitch/DESIGN.md`
**Where**: `src/index.css` (modify)
**Depends on**: T12
**Reuses**: the existing selectors
**Requirement**: TIM-01

**Done when**:

- [ ] Walk at 1280 px and 390 px logged in the Handoff
- [ ] Gate passes

**Tests**: none
**Gate**: full

**Commit**: `style(timbres): style the select`

---

### T14: Credit

**What**: `LICENSE.md` and README
**Where**: `README.md` (modify)
**Depends on**: None - the previous phase
**Reuses**: the `chord-pads` credit
**Requirement**: TIM-40, TIM-41

**Done when**:

- [ ] `tests/padBank.test.ts` proves both
- [ ] Gate passes

**Tests**: unit
**Gate**: full

**Commit**: `docs(timbres): credit FreePats and Versilian Studios`

---

### T15: Tune by ear

**What**: Offer the app to the user, and adjust mixes and loops until approved
**Where**: `src/pad.rs` (modify)
**Depends on**: T14
**Reuses**: `MIXES`
**Requirement**: TIM-37, TIM-38, TIM-39

**Done when**:

- [ ] The user approved in their words
- [ ] The binary is rebuilt, and TIM-18, TIM-19 and TIM-20 still pass
- [ ] Gate passes

**Tests**: none
**Gate**: build

**Commit**: `tune(timbres): set the timbres by ear`

---

## Checks

**C1** - The select lists the 5 timbres in order (TIM-01, AC 1)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_01 select lists the timbres

**C2** - With nothing stored the select shows Choir (TIM-02, AC 2)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_02 starts on Choir

**C3** - Picking a timbre over a chord crossfades the same chord over 1.5 s (TIM-03, AC 3)
Proof: run rust | test pad::tests::tim_03_timbre_change_crossfades_the_chord ... ok

**C4** - Picking a timbre over a chord sends the same notes in that timbre (TIM-03, AC 3)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_03 replays the chord in the new timbre

**C5** - Picking with no chord stays silent, and the next chord uses it (TIM-04, AC 4)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_04 silent until the next chord

**C6** - Fast picks settle on the last timbre (TIM-05, AC 5)
Proof: run rust | test pad::tests::tim_05_settles_on_the_last_timbre ... ok

**C7** - The timbre survives a reload (TIM-06, AC 6)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_06 remembers the timbre

**C8** - A missing or unknown timbre becomes Choir (TIM-07, AC 7)
Proof: run js | ✓ tests/chords.test.ts > Timbres > tim_07 parses the stored timbre

**C9** - Opening on a stored timbre sends no chord (TIM-08, AC 8)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_08 opens silent

**C10** - Choir samples sit about 2 dB above the synth (TIM-09, AC 9)
Proof: run rust | test pad::tests::tim_09_choir_balance ... ok

**C11** - New Age renders the output of `chord-pads`, sample for sample (TIM-10, AC 10)
Proof: run rust | test pad::tests::tim_10_new_age_is_unchanged ... ok

**C12** - Sweep mixes its samples with the synth (TIM-11, AC 11)
Proof: run rust | test pad::tests::tim_11_sweep_mixes_both_layers ... ok

**C13** - Analog renders the synth alone, with files loaded (TIM-12, AC 12)
Proof: run rust | test pad::tests::tim_12_analog_reads_no_file ... ok

**C14** - Orchestra renders files with no synth once loaded (TIM-13, AC 13)
Proof: run rust | test pad::tests::tim_13_orchestra_has_no_synth ... ok

**C15** - The Orchestra bank maps cello, viola and violin from low to high (TIM-13, AC 13)
Proof: run js | ✓ tests/padBank.test.ts > Timbre banks > tim_13 orchestra sections

**C16** - Orchestra adds the root 12 and 24 semitones below, and no other timbre does (TIM-14, AC 14)
Proof: run js | ✓ tests/chords.test.ts > Timbres > tim_14 orchestra bass

**C17** - A chord of 7 notes keeps every fade and limit (TIM-15, AC 15)
Proof: run rust | test pad::tests::tim_15_seven_notes_keep_the_rules ... ok

**C18** - Every note of the 4 other timbres sits within 5 cents (TIM-16, AC 16)
Proof: run rust | test pad::tests::tim_16_notes_within_5_cents ... ok

**C19** - Every Orchestra note centre sits within 10 cents (TIM-17, AC 17)
Proof: `python3 -I tests/fixtures/orchestra_bank_check.py --pitch`

**C20** - Within a timbre, the 168 chords sit within 3 dB RMS (TIM-18, AC 18)
Proof: run rust | test pad::tests::tim_18_chords_match_within_3_db ... ok

**C21** - On one chord, the timbres sit within 3 dB RMS (TIM-19, AC 19)
Proof: run rust | test pad::tests::tim_19_timbres_match_within_3_db ... ok

**C22** - At default volume every timbre peaks at or below -12 dBFS (TIM-20, AC 20)
Proof: run rust | test pad::tests::tim_20_default_peak ... ok

**C23** - Every file of every bank closes its loop cleanly (TIM-21, AC 21)
Proof: `python3 -I tests/fixtures/pad_bank_check.py`

**C24** - Orchestra loops hold their level within 1.5 dB (TIM-22, AC 22)
Proof: `python3 -I tests/fixtures/orchestra_bank_check.py --level`

**C25** - Changing chord or timbre allocates nothing (TIM-23, AC 23)
Proof: run rust | test pad::tests::tim_23_no_allocation ... ok

**C26** - Orchestra files are 44.1 kHz, 16-bit, stereo FLAC with a 4 s loop (TIM-24, AC 24)
Proof: run js | ✓ tests/padBank.test.ts > Timbre banks > tim_24 orchestra format

**C27** - The builder gives the same bytes twice (TIM-25, AC 25)
Proof: `python3 -I tests/fixtures/orchestra_bank_check.py --repeat`

**C28** - Opening Improv loads the selected timbre alone (TIM-26, AC 26)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_26 loads the selected timbre

**C29** - A first pick loads its files (TIM-27, AC 27)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_27 loads on first pick

**C30** - A loaded timbre fetches nothing (TIM-28, AC 28)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_28 fetches nothing again

**C31** - Analog fetches no pad file (TIM-29, AC 29)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_29 Analog fetches nothing

**C32** - With no files a timbre sounds its synth (TIM-30, AC 30)
Proof: run rust | test pad::tests::tim_30_synth_holds_while_loading ... ok

**C33** - Files arriving mid-chord fade in over 1.5 s (TIM-31, AC 31)
Proof: run rust | test pad::tests::tim_31_late_files_fade_in ... ok

**C34** - Orchestra files replace the synth over 1.5 s (TIM-32, AC 32)
Proof: run rust | test pad::tests::tim_32_orchestra_replaces_the_synth ... ok

**C35** - A load for another timbre leaves the sound alone (TIM-33, AC 33)
Proof: run rust | test pad::tests::tim_33_other_timbre_load_changes_nothing ... ok

**C36** - A failed file logs its path and shows the notice (TIM-34, AC 34)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_34 failure notices

**C37** - A later visit or pick retries only failed files (TIM-35, AC 35)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_35 retries failed files

**C38** - `public/pads/` takes at most 12 MB (TIM-36, AC 36)
Proof: run js | ✓ tests/padBank.test.ts > Timbre banks > tim_36 size limit

**C39** - The user approves Choir, Orchestra and Sweep by ear (TIM-37, AC 37)
Proof: walk - The user holds chords in each timbre, alone and with a groove, and their answer is quoted in `verification.md`

**C40** - A rejected timbre is adjusted and offered again (TIM-38, AC 38)
Proof: walk - Each rejection is logged with its change in the Handoff, until the user approves

**C41** - A pulsing Orchestra loop is rebuilt (TIM-39, AC 39)
Proof: walk - Any pulse the user reports is logged with its rebuild in the Handoff, or the user reports none

**C42** - `LICENSE.md` lists each new file with its source (TIM-40, AC 40)
Proof: run js | ✓ tests/padBank.test.ts > Timbre banks > tim_40 license lists each file

**C43** - The README credits FreePats and Versilian Studios (TIM-41, AC 41)
Proof: run js | ✓ tests/padBank.test.ts > Timbre banks > tim_41 README

**C44** - A pick during a fade-out lets it finish, and the next chord uses it (TIM-42, AC 42)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_42 pick during a fade

**C45** - A load finishing after Stop starts no sound (TIM-43, AC 43)
Proof: run js | ✓ src/index.test.ts > Timbres > tim_43 load after stop stays silent

**C46** - Every timbre keeps its pitch at 48 kHz (TIM-44, AC 44)
Proof: run rust | test pad::tests::tim_44_pitch_holds_at_48_khz ... ok

**C47** - With no chord the drums render unchanged, whichever timbre is selected (TIM-45, AC 45)
Proof: run rust | test tests::tim_45_timbre_leaves_the_drums_alone ... ok

---

## Handoff

**Settled mid-build:** none
**Dispatched:** batch 1 (T1 to T8), from the planning commit
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1 → T2 → T3 → T4
Phase 2:  T5 → T6 → T7 → T8
Phase 3:  T9 → T10
Phase 4:  T11 → T12 → T13
Phase 5:  T14 → T15
```
