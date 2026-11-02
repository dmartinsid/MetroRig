# Chord Pads Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/chord-pads/design.md`
**Status**: Approved
**Approved**: 2026-11-01 - user: "aprovo e vamos de sub agents"
**Build**: `npm run build`
**Run js**: `npx vitest run --reporter=verbose`
**Run rust**: `cargo test`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Pad and engine | unit | All branches; 1:1 to spec ACs; listed edge cases | `src/pad.rs`, `src/lib.rs` | `cargo test` |
| Chord rules | unit | All branches; 1:1 to spec ACs | `tests/chords.test.ts` | `npx vitest run --reporter=verbose` |
| Shipped samples and docs | unit | The real files, sizes and credits | `tests/padBank.test.ts` | `npx vitest run --reporter=verbose` |
| Audio bridge | unit | Every new message | `tests/metronome-processor.test.ts`, `tests/MetronomeNode.test.ts` | `npx vitest run --reporter=verbose` |
| Engine binary | unit | The new exports | `tests/wasm.test.ts` | `npx vitest run --reporter=verbose` |
| Page markup and wiring | integration | Each control in scope, against the real `index.html` | `src/index.test.ts` | `npx vitest run --reporter=verbose` |
| CSS | none | - (happy-dom applies no CSS; the walk proves it) | - | build gate only |
| Ear-tuned gains | none | - (the user's ear decides; the numeric checks still hold) | - | build gate only |

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

### Phase 1: Chord rules

```
T1 → T2 → T3
```

### Phase 2: Pad engine

```
T4 → T5 → T6 → T7 → T8
```

### Phase 3: Engine wiring

```
T9 → T10
```

### Phase 4: Audio bridge

```
T11 → T12
```

### Phase 5: Improv screen

```
T13 → T14 → T15 → T16 → T17 → T18
```

### Phase 6: Finish

```
T19 → T20
```

---

## Task Breakdown

### T1: Define the chords

**What**: `ROOTS`, `CHORD_TYPES`, `chordName`, `chordMidi` and `nextChord`
**Where**: `src/chords.ts`
**Depends on**: None
**Reuses**: the pure-module shape of `src/kit.ts`
**Requirement**: PAD-01, PAD-02, PAD-03, PAD-09

**Done when**:

- [x] `tests/chords.test.ts` proves C1, C2, C3 and the `nextChord` check
- [x] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pads): define the chords and their voicing`

---

### T2: Spell the notes and parse the volume

**What**: `chordNotes` and `parseVolume`
**Where**: `src/chords.ts` (modify)
**Depends on**: T1
**Reuses**: `CHORD_TYPES`
**Requirement**: PAD-34, PAD-44

**Done when**:

- [ ] Tests cover `Ebm`, `Abm`, `Ebdim`, `C#`, `F#aug` and a bad stored volume
- [ ] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pads): spell chord notes by degree`

---

### T3: Ship the bank

**What**: Copy the 8 FreePats files, renaming `G#` to `Gs`, list them in `PAD_BANK`, and add `tests/fixtures/pad_bank_check.py`
**Where**: `public/pads/new-age/`
**Depends on**: T2
**Reuses**: `tests/fixtures/build_house_kit_check.py`
**Requirement**: PAD-06, PAD-21, PAD-22

**Done when**:

- [ ] `tests/padBank.test.ts` proves the files and the size
- [ ] The fixture proves a step of 0 on each loop
- [ ] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pads): add the New Age sample bank`

---

### T4: Render the synth layer

**What**: `Pad`, `Slot`, `Voice`, `play` and `mix_into` with 7 detuned saws and the low-pass, with no fades
**Where**: `src/pad.rs`
**Depends on**: None - the previous phase
**Reuses**: `Engine` fixed-array style
**Requirement**: PAD-05, PAD-07, PAD-18, PAD-48, PAD-52

**Done when**:

- [ ] Pitch, endurance and synth-only tests pass
- [ ] Gate passes

**Tests**: unit
**Gate**: rust

**Commit**: `feat(pads): render the synth layer`

---

### T5: Render the sample layer

**What**: `load`, the looping read, the nearest file, and the mix of both layers
**Where**: `src/pad.rs` (modify)
**Depends on**: T4
**Reuses**: `Voice`
**Requirement**: PAD-06, PAD-07, PAD-17, PAD-20, PAD-50

**Done when**:

- [ ] Loop, nearest-file, pitch and balance tests pass
- [ ] Gate passes

**Tests**: unit
**Gate**: rust

**Commit**: `feat(pads): layer the samples over the synth`

---

### T6: Fade the chords

**What**: Slot levels, equal-power fades, `stop`, `pending` and the 3-slot limit
**Where**: `src/pad.rs` (modify)
**Depends on**: T5
**Reuses**: `Slot`
**Requirement**: PAD-04, PAD-08, PAD-09, PAD-10, PAD-11, PAD-12, PAD-13, PAD-14, PAD-39, PAD-59

**Done when**:

- [ ] Each fade test passes
- [ ] The allocation test counts allocations with a test allocator
- [ ] Gate passes

**Tests**: unit
**Gate**: rust

**Commit**: `feat(pads): crossfade chords`

---

### T7: Add chorus and reverb

**What**: Stereo chorus, reverb and `is_silent`, all scaled by sample rate
**Where**: `src/pad.rs` (modify)
**Depends on**: T6
**Reuses**: the network of demo 3
**Requirement**: PAD-19, PAD-58

**Done when**:

- [ ] Stereo and 48 kHz tests pass
- [ ] `is_silent` turns true after the tail
- [ ] Gate passes

**Tests**: unit
**Gate**: rust

**Commit**: `feat(pads): add chorus and reverb`

---

### T8: Smooth the volume and late samples

**What**: `set_volume` with its smoother, the default level, and the late sample fade
**Where**: `src/pad.rs` (modify)
**Depends on**: T7
**Reuses**: `Slot`
**Requirement**: PAD-27, PAD-42, PAD-49

**Done when**:

- [ ] Peak, click and late-sample tests pass
- [ ] Gate passes

**Tests**: unit
**Gate**: rust

**Commit**: `feat(pads): smooth the volume and late samples`

---

### T9: Mix the pad into the engine

**What**: `Engine.pad`, the mix on both paths of `fill_buffers`, and the `engine_pad_*` exports
**Where**: `src/lib.rs` (modify)
**Depends on**: None - the previous phase
**Reuses**: `engine_load_take`
**Requirement**: PAD-23, PAD-24, PAD-28, PAD-29

**Done when**:

- [ ] Every existing Rust test still passes
- [ ] The 4 new tests pass
- [ ] Gate passes

**Tests**: unit
**Gate**: rust

**Commit**: `feat(pads): mix the pad into the engine`

---

### T10: Rebuild the binary

**What**: Run `npm run build:wasm` and test the new exports
**Where**: `public/pkg/metrorig_audio_bg.wasm`
**Depends on**: T9
**Reuses**: `tests/wasm.test.ts`
**Requirement**: PAD-23

**Done when**:

- [ ] `tests/wasm.test.ts` proves `engine_pad_play` renders sound while stopped
- [ ] Gate passes

**Tests**: unit
**Gate**: build

**Commit**: `build(wasm): ship the pad`

---

### T11: Carry pad messages in the worklet

**What**: `PAD_PLAY`, `PAD_STOP`, `PAD_VOLUME` and `PAD_LOAD`
**Where**: `src/audio/metronome-processor.ts` (modify)
**Depends on**: None - the previous phase
**Reuses**: `loadIntoEngine`
**Requirement**: PAD-23, PAD-42

**Done when**:

- [ ] `tests/metronome-processor.test.ts` covers each message
- [ ] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pads): carry pad messages in the worklet`

---

### T12: Expose the pad on the node

**What**: `padPlay`, `padStop`, `padVolume` and `padLoad`
**Where**: `src/audio/MetronomeNode.ts` (modify)
**Depends on**: T11
**Reuses**: `decode`
**Requirement**: PAD-50

**Done when**:

- [ ] `tests/MetronomeNode.test.ts` covers each method and a failed fetch
- [ ] Gate passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pads): expose the pad on the audio node`

---

### T13: Add the view

**What**: `improv` in `ViewMode`, the header link and the screen shell
**Where**: `index.html` (modify)
**Depends on**: None - the previous phase
**Reuses**: `.view-link`, `setViewMode`
**Requirement**: PAD-30, PAD-57

**Done when**:

- [ ] `src/index.test.ts` proves the link, title and saved screen
- [ ] Gate passes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(pads): add the Improv screen`

---

### T14: Start the engine without the kit

**What**: Split `startEngine` out of `initAudio`, and start it when `Improv` opens
**Where**: `src/main.ts` (modify)
**Depends on**: T13
**Reuses**: `initAudio`
**Requirement**: PAD-15, PAD-16, PAD-56

**Done when**:

- [ ] A chord does not wait for the kit
- [ ] Engine failure and a resume are covered
- [ ] Gate passes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(pads): start the engine without the kit`

---

### T15: Render the grid and play

**What**: `renderImprov`, chord clicks, the sounding text, Stop and the link dot
**Where**: `src/main.ts` (modify)
**Depends on**: T14
**Reuses**: `chords.ts`
**Requirement**: PAD-31, PAD-32, PAD-33, PAD-35, PAD-36, PAD-40, PAD-24, PAD-25, PAD-26, PAD-45

**Done when**:

- [ ] Each listed check passes
- [ ] Gate passes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(pads): play chords from the grid`

---

### T16: Wire the volume

**What**: The slider, `metrorig_pad_volume` and the sent value
**Where**: `src/main.ts` (modify)
**Depends on**: T15
**Reuses**: `metrorig_click_sound`
**Requirement**: PAD-42, PAD-43

**Done when**:

- [ ] Slider and reload tests pass
- [ ] Gate passes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(pads): add the pad volume`

---

### T17: Load the bank and show failures

**What**: The first-visit load, the retry and the notices
**Where**: `src/main.ts` (modify)
**Depends on**: T16
**Reuses**: `loadKit`
**Requirement**: PAD-46, PAD-47, PAD-50, PAD-51, PAD-53

**Done when**:

- [ ] Load, failure and retry tests pass
- [ ] Gate passes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(pads): load the bank on first visit`

---

### T18: Style the screen

**What**: Grid, sticky root column, sounding state and dot, per `.stitch/DESIGN.md`
**Where**: `src/index.css` (modify)
**Depends on**: T17
**Reuses**: `.card`, `--neon-green`, `.status-dot`
**Requirement**: PAD-41

**Done when**:

- [ ] Walk at 1280 px and 390 px logged in the Handoff
- [ ] Gate passes

**Tests**: none
**Gate**: full

**Commit**: `style(pads): style the Improv screen`

---

### T19: Credit and document

**What**: README screens and credit; `public/kit/LICENSE.md` pad section
**Where**: `README.md` (modify)
**Depends on**: None - the previous phase
**Reuses**: the House Kit credit
**Requirement**: PAD-54, PAD-55

**Done when**:

- [ ] `tests/padBank.test.ts` proves both
- [ ] Gate passes

**Tests**: unit
**Gate**: full

**Commit**: `docs(pads): credit FreePats New Age`

---

### T20: Tune by ear

**What**: Offer the running app to the user, and adjust layer gains, default volume and effects until approved
**Where**: `src/pad.rs` (modify)
**Depends on**: T19
**Reuses**: the constants of `src/pad.rs`
**Requirement**: PAD-37, PAD-38, PAD-14, PAD-20, PAD-27

**Done when**:

- [ ] The user approved, in their words, in `tasks.md` Handoff
- [ ] The binary is rebuilt, and the checks of PAD-14, PAD-20 and PAD-27 still pass
- [ ] Gate passes

**Tests**: none
**Gate**: build

**Commit**: `tune(pads): set the pad by ear`

---

## Checks

**C1** - The app offers 168 chords from 12 roots and 14 types (PAD-01, AC 1)
Proof: run js | ✓ tests/chords.test.ts > Chords > pad_01 offers 168 chords

**C2** - Each type holds the semitones of PAD-02 (PAD-02, AC 2)
Proof: run js | ✓ tests/chords.test.ts > Chords > pad_02 semitones of each type

**C3** - Each root sits from MIDI 45 to 56, with the other notes above it (PAD-03, AC 3)
Proof: run js | ✓ tests/chords.test.ts > Chords > pad_03 voices every root in range

**C4** - A first chord reaches full level at 1.5 s and not before (PAD-04, AC 4)
Proof: run rust | test pad::tests::pad_04_first_chord_fades_in_over_1_5_s ... ok

**C5** - A held chord renders 60 s with no silent frame after its fade (PAD-05, AC 5)
Proof: run rust | test pad::tests::pad_05_held_chord_never_ends ... ok

**C6** - A loop wrap adds no step above the largest of the prior 10 ms (PAD-06, AC 6)
Proof: run rust | test pad::tests::pad_06_loop_wrap_adds_no_step ... ok

**C7** - All 8 shipped files close their loop with a step of 0 (PAD-06, AC 6)
Proof: `python3 -I tests/fixtures/pad_bank_check.py`

**C8** - Each note sounds within 5 cents, for both layers (PAD-07, AC 7)
Proof: run rust | test pad::tests::pad_07_notes_within_5_cents ... ok

**C9** - Another chord crossfades over 1.5 s (PAD-08, AC 8)
Proof: run rust | test pad::tests::pad_08_crossfades_over_1_5_s ... ok

**C10** - Fading the sounding chord reaches silence after 1.5 s (PAD-09, AC 9)
Proof: run rust | test pad::tests::pad_09_stop_fades_over_1_5_s ... ok

**C11** - Clicking the sounding chord stops it (PAD-09, AC 9)
Proof: run js | ✓ tests/chords.test.ts > Chords > pad_09 the same chord stops

**C12** - Fast clicks settle on the last chord (PAD-10, AC 10)
Proof: run rust | test pad::tests::pad_10_settles_on_the_last_chord ... ok

**C13** - A replaced fade continues from its level with no jump (PAD-11, AC 11)
Proof: run rust | test pad::tests::pad_11_fade_continues_from_its_level ... ok

**C14** - At most 3 chords sound, and the oldest leaves in 20 ms (PAD-12, AC 12)
Proof: run rust | test pad::tests::pad_12_at_most_3_chords ... ok

**C15** - After the fades, at most one chord sounds (PAD-13, AC 13)
Proof: run rust | test pad::tests::pad_13_one_chord_after_fades ... ok

**C16** - A triad and a 5-note chord sit within 3 dB RMS (PAD-14, AC 14)
Proof: run rust | test pad::tests::pad_14_chords_match_within_3_db ... ok

**C17** - A chord click sounds before the kit finishes loading (PAD-15, AC 15)
Proof: run js | ✓ src/index.test.ts > Improv > pad_15 chord does not wait for the kit

**C18** - A failed engine shows `Audio unavailable` and no sounding chord (PAD-16, AC 16)
Proof: run js | ✓ src/index.test.ts > Improv > pad_16 engine failure

**C19** - A note mixes both layers (PAD-17, AC 17)
Proof: run rust | test pad::tests::pad_17_note_mixes_both_layers ... ok

**C20** - The synth uses 7 detuned saws under a moving low-pass (PAD-18, AC 18)
Proof: run rust | test pad::tests::pad_18_synth_detunes_and_filters ... ok

**C21** - Left and right channels differ (PAD-19, AC 19)
Proof: run rust | test pad::tests::pad_19_output_is_stereo ... ok

**C22** - The sample layer sits 2 dB above the synth, within 1 dB (PAD-20, AC 20)
Proof: run rust | test pad::tests::pad_20_layer_balance ... ok

**C23** - The pad files match FreePats New Age, and the CC0 is recorded (PAD-21, AC 21)
Proof: run js | ✓ tests/padBank.test.ts > Pad bank > pad_21 files and license

**C24** - `public/pads/` takes at most 10 MB (PAD-22, AC 22)
Proof: run js | ✓ tests/padBank.test.ts > Pad bank > pad_22 size limit

**C25** - The pad sounds while the metronome is stopped (PAD-23, AC 23)
Proof: run rust | test tests::pad_23_sounds_while_stopped ... ok

**C26** - The shipped binary renders the pad while stopped (PAD-23, AC 23)
Proof: run js | ✓ tests/wasm.test.ts > Shipped WASM > pad_23 renders while stopped

**C27** - Play and Stop leave the pad unchanged in the engine (PAD-24, AC 24)
Proof: run rust | test tests::pad_24_play_and_stop_keep_the_pad ... ok

**C28** - Play and Stop send no pad command (PAD-24, AC 24)
Proof: run js | ✓ src/index.test.ts > Improv > pad_24 transport sends no pad command

**C29** - A song, preset or groove sends no pad command (PAD-25, AC 25)
Proof: run js | ✓ src/index.test.ts > Improv > pad_25 loading a pattern sends no pad command

**C30** - Changing screens sends no pad command (PAD-26, AC 26)
Proof: run js | ✓ src/index.test.ts > Improv > pad_26 screens send no pad command

**C31** - At default volume the pad peaks at or below -12 dBFS (PAD-27, AC 27)
Proof: run rust | test pad::tests::pad_27_default_peak ... ok

**C32** - Drum hits stay within 1 sample with the pad sounding (PAD-28, AC 28)
Proof: run rust | test tests::pad_28_hits_keep_their_time ... ok

**C33** - With no chord the engine renders the same output, sample for sample (PAD-29, AC 29)
Proof: run rust | test tests::pad_29_silent_pad_changes_nothing ... ok

**C34** - The `Improv` link follows `Grooves` and opens its titled screen (PAD-30, AC 30)
Proof: run js | ✓ src/index.test.ts > Improv > pad_30 link and title

**C35** - The grid has 12 rows, 14 columns and named buttons (PAD-31, AC 31)
Proof: run js | ✓ src/index.test.ts > Improv > pad_31 grid of 168 buttons

**C36** - A sounding chord is marked, with its name and notes (PAD-32, AC 32)
Proof: run js | ✓ src/index.test.ts > Improv > pad_32 shows the sounding chord

**C37** - With no chord the screen shows `No chord playing` (PAD-33, AC 33)
Proof: run js | ✓ src/index.test.ts > Improv > pad_33 idle text

**C38** - Notes are spelled by degree, with doubles made natural (PAD-34, AC 34)
Proof: run js | ✓ tests/chords.test.ts > Chords > pad_34 spelling

**C39** - Stop fades the chord and shows `No chord playing` (PAD-35, AC 35)
Proof: run js | ✓ src/index.test.ts > Improv > pad_35 stop button

**C40** - Stop is disabled with no chord (PAD-36, AC 36)
Proof: run js | ✓ src/index.test.ts > Improv > pad_36 stop disabled

**C41** - The user approves the pad by ear in the running app (PAD-37, AC 37)
Proof: walk - The user holds chords alone and with a groove, and their answer is quoted in `verification.md`

**C42** - A rejected pad is adjusted and offered again (PAD-38, AC 38)
Proof: walk - Each rejection is logged with its change in the Handoff, until the user approves

**C43** - A fading chord clicked again rises from its level (PAD-39, AC 39)
Proof: run rust | test pad::tests::pad_39_fading_chord_returns ... ok

**C44** - The `Improv` link shows a lit dot while a chord sounds (PAD-40, AC 40)
Proof: run js | ✓ src/index.test.ts > Improv > pad_40 link dot

**C45** - At 390 px the grid scrolls sideways, roots in view, with no page scroll (PAD-41, AC 41)
Proof: walk - At 390 px the grid scrolls, the root column stays, and the page width equals the window

**C46** - Volume follows from 0 to 100% with no click (PAD-42, AC 42)
Proof: run rust | test pad::tests::pad_42_volume_has_no_click ... ok

**C47** - The volume control sends the pad volume and no drum command (PAD-42, AC 42)
Proof: run js | ✓ src/index.test.ts > Improv > pad_42 volume control

**C48** - The volume survives a reload (PAD-43, AC 43)
Proof: run js | ✓ src/index.test.ts > Improv > pad_43 remembers the volume

**C49** - A missing or invalid volume becomes 70 (PAD-44, AC 44)
Proof: run js | ✓ tests/chords.test.ts > Chords > pad_44 parses the volume

**C50** - Opening the app sends no chord (PAD-45, AC 45)
Proof: run js | ✓ src/index.test.ts > Improv > pad_45 opens silent

**C51** - Opening `Improv` starts the sample load (PAD-46, AC 46)
Proof: run js | ✓ src/index.test.ts > Improv > pad_46 loads on first open

**C52** - No pad file loads before `Improv` opens (PAD-47, AC 47)
Proof: run js | ✓ src/index.test.ts > Improv > pad_47 loads nothing before

**C53** - With no samples the synth sounds (PAD-48, AC 48)
Proof: run rust | test pad::tests::pad_48_synth_sounds_without_samples ... ok

**C54** - Samples arriving mid-chord fade in over 1.5 s (PAD-49, AC 49)
Proof: run rust | test pad::tests::pad_49_late_samples_fade_in ... ok

**C55** - A failed file logs its path (PAD-50, AC 50)
Proof: run js | ✓ src/index.test.ts > Improv > pad_50 logs a failed file

**C56** - A note uses the nearest loaded file (PAD-50, AC 50)
Proof: run rust | test pad::tests::pad_50_nearest_loaded_file ... ok

**C57** - The notice matches the number of failed files (PAD-51, AC 51)
Proof: run js | ✓ src/index.test.ts > Improv > pad_51 failure notices

**C58** - With no files the synth plays alone (PAD-52, AC 52)
Proof: run rust | test pad::tests::pad_52_synth_alone ... ok

**C59** - A later visit retries only the failed files (PAD-53, AC 53)
Proof: run js | ✓ src/index.test.ts > Improv > pad_53 retries failed files

**C60** - The README lists `Improv` and credits FreePats New Age (PAD-54, AC 54)
Proof: run js | ✓ tests/padBank.test.ts > Pad bank > pad_54 README

**C61** - `LICENSE.md` lists each pad file (PAD-55, AC 55)
Proof: run js | ✓ tests/padBank.test.ts > Pad bank > pad_55 license lists each file

**C62** - A chord click resumes suspended audio (PAD-56, AC 56)
Proof: run js | ✓ src/index.test.ts > Improv > pad_56 resumes audio

**C63** - Starting on `Improv` loads samples and sounds nothing (PAD-57, AC 57)
Proof: run js | ✓ src/index.test.ts > Improv > pad_57 saved screen

**C64** - Pitch holds at 48 kHz (PAD-58, AC 58)
Proof: run rust | test pad::tests::pad_58_pitch_holds_at_48_khz ... ok

**C65** - Starting, changing and stopping allocate nothing (PAD-59, AC 59)
Proof: run rust | test pad::tests::pad_59_no_allocation ... ok

---

## Handoff

**Settled mid-build:** none
**Dispatched:** batch 1 (T1 to T8), from the planning commit
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1:  T1 → T2 → T3
Phase 2:  T4 → T5 → T6 → T7 → T8
Phase 3:  T9 → T10
Phase 4:  T11 → T12
Phase 5:  T13 → T14 → T15 → T16 → T17 → T18
Phase 6:  T19 → T20
```
