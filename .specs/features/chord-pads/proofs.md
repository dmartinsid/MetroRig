# chord-pads proofs

**HEAD**: bc0e593
**Tree**: clean
**Shell**: /bin/sh
**Result**: 66 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run js / ✓ tests/chords.test.ts > Chords > pad_01 offers 168 chords` | pass |
| C2 | `run js / ✓ tests/chords.test.ts > Chords > pad_02 semitones of each type` | pass |
| C3 | `run js / ✓ tests/chords.test.ts > Chords > pad_03 voices every root in range` | pass |
| C4 | `run rust / test pad::tests::pad_04_first_chord_fades_in_over_1_5_s ... ok` | pass |
| C5 | `run rust / test pad::tests::pad_05_held_chord_never_ends ... ok` | pass |
| C6 | `run rust / test pad::tests::pad_06_loop_wrap_adds_no_step ... ok` | pass |
| C7 | `python3 -I tests/fixtures/pad_bank_check.py` | pass |
| C8 | `run rust / test pad::tests::pad_07_notes_within_5_cents ... ok` | pass |
| C9 | `run rust / test pad::tests::pad_08_crossfades_over_1_5_s ... ok` | pass |
| C10 | `run rust / test pad::tests::pad_09_stop_fades_over_1_5_s ... ok` | pass |
| C11 | `run js / ✓ tests/chords.test.ts > Chords > pad_09 the same chord stops` | pass |
| C12 | `run rust / test pad::tests::pad_10_settles_on_the_last_chord ... ok` | pass |
| C13 | `run rust / test pad::tests::pad_11_fade_continues_from_its_level ... ok` | pass |
| C14 | `run rust / test pad::tests::pad_12_at_most_3_chords ... ok` | pass |
| C15 | `run rust / test pad::tests::pad_13_one_chord_after_fades ... ok` | pass |
| C16 | `run rust / test pad::tests::pad_14_chords_match_within_3_db ... ok` | pass |
| C17 | `run js / ✓ src/index.test.ts > Improv > pad_15 chord does not wait for the kit` | pass |
| C18 | `run js / ✓ src/index.test.ts > Improv > pad_16 engine failure` | pass |
| C19 | `run rust / test pad::tests::pad_17_note_mixes_both_layers ... ok` | pass |
| C20 | `run rust / test pad::tests::pad_18_synth_detunes_and_filters ... ok` | pass |
| C21 | `run rust / test pad::tests::pad_19_output_is_stereo ... ok` | pass |
| C22 | `run rust / test pad::tests::pad_20_layer_balance ... ok` | pass |
| C23 | `run js / ✓ tests/padBank.test.ts > Pad bank > pad_21 files and license` | pass |
| C24 | `run js / ✓ tests/padBank.test.ts > Pad bank > pad_22 size limit` | pass |
| C25 | `run rust / test tests::pad_23_sounds_while_stopped ... ok` | pass |
| C26 | `run js / ✓ tests/wasm.test.ts > Shipped WASM > pad_23 renders while stopped` | pass |
| C27 | `run rust / test tests::pad_24_play_and_stop_keep_the_pad ... ok` | pass |
| C28 | `run js / ✓ src/index.test.ts > Improv > pad_24 transport sends no pad command` | pass |
| C29 | `run js / ✓ src/index.test.ts > Improv > pad_25 loading a pattern sends no pad command` | pass |
| C30 | `run js / ✓ src/index.test.ts > Improv > pad_26 screens send no pad command` | pass |
| C31 | `run rust / test pad::tests::pad_27_default_peak ... ok` | pass |
| C32 | `run rust / test tests::pad_28_hits_keep_their_time ... ok` | pass |
| C33 | `run rust / test tests::pad_29_silent_pad_changes_nothing ... ok` | pass |
| C34 | `run js / ✓ src/index.test.ts > Improv > pad_30 link and title` | pass |
| C35 | `run js / ✓ src/index.test.ts > Improv > pad_31 grid of 168 buttons` | pass |
| C36 | `run js / ✓ src/index.test.ts > Improv > pad_32 shows the sounding chord` | pass |
| C37 | `run js / ✓ src/index.test.ts > Improv > pad_33 idle text` | pass |
| C38 | `run js / ✓ tests/chords.test.ts > Chords > pad_34 spelling` | pass |
| C39 | `run js / ✓ src/index.test.ts > Improv > pad_35 stop button` | pass |
| C40 | `run js / ✓ src/index.test.ts > Improv > pad_36 stop disabled` | pass |
| C41 | `walk - The user holds chords alone and with a groove, and their answer is quoted in verification.md` | pass (Walked) |
| C42 | `walk - Each rejection is logged with its change in the Handoff, until the user approves` | pass (Walked) |
| C43 | `run rust / test pad::tests::pad_39_fading_chord_returns ... ok` | pass |
| C44 | `run js / ✓ src/index.test.ts > Improv > pad_40 link dot` | pass |
| C45 | `walk - At 390 px the grid scrolls, the root column stays, and the page width equals the window` | pass (Walked) |
| C46 | `run rust / test pad::tests::pad_42_volume_has_no_click ... ok` | pass |
| C47 | `run js / ✓ src/index.test.ts > Improv > pad_42 volume control` | pass |
| C48 | `run js / ✓ src/index.test.ts > Improv > pad_43 remembers the volume` | pass |
| C49 | `run js / ✓ tests/chords.test.ts > Chords > pad_44 parses the volume` | pass |
| C50 | `run js / ✓ src/index.test.ts > Improv > pad_45 opens silent` | pass |
| C51 | `run js / ✓ src/index.test.ts > Improv > pad_46 loads on first open` | pass |
| C52 | `run js / ✓ src/index.test.ts > Improv > pad_47 loads nothing before` | pass |
| C53 | `run rust / test pad::tests::pad_48_synth_sounds_without_samples ... ok` | pass |
| C54 | `run rust / test pad::tests::pad_49_late_samples_fade_in ... ok` | pass |
| C55 | `run js / ✓ src/index.test.ts > Improv > pad_50 logs a failed file` | pass |
| C56 | `run rust / test pad::tests::pad_50_nearest_loaded_file ... ok` | pass |
| C57 | `run js / ✓ src/index.test.ts > Improv > pad_51 failure notices` | pass |
| C58 | `run rust / test pad::tests::pad_52_synth_alone ... ok` | pass |
| C59 | `run js / ✓ src/index.test.ts > Improv > pad_53 retries failed files` | pass |
| C60 | `run js / ✓ tests/padBank.test.ts > Pad bank > pad_54 README` | pass |
| C61 | `run js / ✓ tests/padBank.test.ts > Pad bank > pad_55 license lists each file` | pass |
| C62 | `run js / ✓ src/index.test.ts > Improv > pad_56 resumes audio` | pass |
| C63 | `run js / ✓ src/index.test.ts > Improv > pad_57 saved screen` | pass |
| C64 | `run rust / test pad::tests::pad_58_pitch_holds_at_48_khz ... ok` | pass |
| C65 | `run rust / test pad::tests::pad_59_no_allocation ... ok` | pass |
| Build | `npm run build` | pass |

## Output

`Run js` - exit 0

```
stderr | tests/MetronomeNode.test.ts > MetronomeNode > tries again after the worklet reports a WASM error
MetronomeNode: WASM error reported from worklet: bad module

stderr | src/index.test.ts > Integration Test > should handle click sound variation selector changes, race conditions and fetch rejections
Failed to load click sample, falling back to digital synth: Error: Fetch failed
    at /home/deivid/Projects/Github/MetroRig/src/index.test.ts:199:26
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
    at runTest (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/runner/dist/index.js:781:11)
    at runSuite (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/runner/dist/index.js:909:15)
    at runSuite (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/runner/dist/index.js:909:15)
    at runFiles (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/runner/dist/index.js:958:5)
    at startTests (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/runner/dist/index.js:967:3)
    at file:///home/deivid/Projects/Github/MetroRig/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:116:7
    at withEnv (file:///home/deivid/Projects/Github/MetroRig/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:83:5)
    at run (file:///home/deivid/Projects/Github/MetroRig/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:105:3)
```

`Run rust` - exit 0

```
test pad::tests::pad_58_pitch_holds_at_48_khz ... ok
test pad::tests::pad_14_chords_match_within_3_db ... ok
test tests::time_02_one_hour_no_drift ... ok
test pad::tests::pad_27_default_peak ... ok

test result: ok. 109 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 26.77s


running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

    Finished `test` profile [optimized + debuginfo] target(s) in 0.00s
     Running unittests src/lib.rs (target/debug/deps/metrorig_audio-e3c84ac815f4f448)
   Doc-tests metrorig_audio
```

`python3 -I tests/fixtures/pad_bank_check.py` - exit 0

```
44 /pads/new-age/Gs2.flac: loop step 0
48 /pads/new-age/C3.flac: loop step 0
52 /pads/new-age/E3.flac: loop step 0
56 /pads/new-age/Gs3.flac: loop step 0
60 /pads/new-age/C4.flac: loop step 0
64 /pads/new-age/E4.flac: loop step 0
68 /pads/new-age/Gs4.flac: loop step 0
72 /pads/new-age/C5.flac: loop step 0
```
