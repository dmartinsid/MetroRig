# pad-timbres proofs

**HEAD**: f0b4c59
**Tree**: clean
**Shell**: /bin/sh
**Result**: 48 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run js / ✓ src/index.test.ts > Timbres > tim_01 select lists the timbres` | pass |
| C2 | `run js / ✓ src/index.test.ts > Timbres > tim_02 starts on Choir` | pass |
| C3 | `run rust / test pad::tests::tim_03_timbre_change_crossfades_the_chord ... ok` | pass |
| C4 | `run js / ✓ src/index.test.ts > Timbres > tim_03 replays the chord in the new timbre` | pass |
| C5 | `run js / ✓ src/index.test.ts > Timbres > tim_04 silent until the next chord` | pass |
| C6 | `run rust / test pad::tests::tim_05_settles_on_the_last_timbre ... ok` | pass |
| C7 | `run js / ✓ src/index.test.ts > Timbres > tim_06 remembers the timbre` | pass |
| C8 | `run js / ✓ tests/chords.test.ts > Timbres > tim_07 parses the stored timbre` | pass |
| C9 | `run js / ✓ src/index.test.ts > Timbres > tim_08 opens silent` | pass |
| C10 | `run rust / test pad::tests::tim_09_choir_balance ... ok` | pass |
| C11 | `run rust / test pad::tests::tim_10_new_age_is_unchanged ... ok` | pass |
| C12 | `run rust / test pad::tests::tim_11_sweep_mixes_both_layers ... ok` | pass |
| C13 | `run rust / test pad::tests::tim_12_analog_reads_no_file ... ok` | pass |
| C14 | `run rust / test pad::tests::tim_13_orchestra_has_no_synth ... ok` | pass |
| C15 | `run js / ✓ tests/padBank.test.ts > Timbre banks > tim_13 orchestra sections` | pass |
| C16 | `run js / ✓ tests/chords.test.ts > Timbres > tim_14 orchestra bass` | pass |
| C17 | `run rust / test pad::tests::tim_15_seven_notes_keep_the_rules ... ok` | pass |
| C18 | `run rust / test pad::tests::tim_16_notes_within_5_cents ... ok` | pass |
| C19 | `python3 -I tests/fixtures/orchestra_bank_check.py --pitch` | pass |
| C20 | `run rust / test pad::tests::tim_18_chords_match_within_3_db ... ok` | pass |
| C21 | `run rust / test pad::tests::tim_19_timbres_match_within_3_db ... ok` | pass |
| C22 | `run rust / test pad::tests::tim_20_default_peak ... ok` | pass |
| C23 | `python3 -I tests/fixtures/pad_bank_check.py` | pass |
| C24 | `python3 -I tests/fixtures/orchestra_bank_check.py --level` | pass |
| C25 | `run rust / test pad::tests::tim_23_no_allocation ... ok` | pass |
| C26 | `run js / ✓ tests/padBank.test.ts > Timbre banks > tim_24 orchestra format` | pass |
| C27 | `python3 -I tests/fixtures/orchestra_bank_check.py --repeat` | pass |
| C28 | `run js / ✓ src/index.test.ts > Timbres > tim_26 loads the selected timbre` | pass |
| C29 | `run js / ✓ src/index.test.ts > Timbres > tim_27 loads on first pick` | pass |
| C30 | `run js / ✓ src/index.test.ts > Timbres > tim_28 fetches nothing again` | pass |
| C31 | `run js / ✓ src/index.test.ts > Timbres > tim_29 Analog fetches nothing` | pass |
| C32 | `run rust / test pad::tests::tim_30_synth_holds_while_loading ... ok` | pass |
| C33 | `run rust / test pad::tests::tim_31_late_files_fade_in ... ok` | pass |
| C34 | `run rust / test pad::tests::tim_32_orchestra_replaces_the_synth ... ok` | pass |
| C35 | `run rust / test pad::tests::tim_33_other_timbre_load_changes_nothing ... ok` | pass |
| C36 | `run js / ✓ src/index.test.ts > Timbres > tim_34 failure notices` | pass |
| C37 | `run js / ✓ src/index.test.ts > Timbres > tim_35 retries failed files` | pass |
| C38 | `run js / ✓ tests/padBank.test.ts > Timbre banks > tim_36 size limit` | pass |
| C39 | `walk - The user holds chords in each timbre, alone and with a groove, and their answer is quoted in verificati` | pass (Walked) |
| C40 | `walk - Each rejection is logged with its change in the Handoff, until the user approves` | pass (Walked) |
| C41 | `walk - Any pulse the user reports is logged with its rebuild in the Handoff, or the user reports none` | pass (Walked) |
| C42 | `run js / ✓ tests/padBank.test.ts > Timbre banks > tim_40 license lists each file` | pass |
| C43 | `run js / ✓ tests/padBank.test.ts > Timbre banks > tim_41 README` | pass |
| C44 | `run js / ✓ src/index.test.ts > Timbres > tim_42 pick during a fade` | pass |
| C45 | `run js / ✓ src/index.test.ts > Timbres > tim_43 load after stop stays silent` | pass |
| C46 | `run rust / test pad::tests::tim_44_pitch_holds_at_48_khz ... ok` | pass |
| C47 | `run rust / test tests::tim_45_timbre_leaves_the_drums_alone ... ok` | pass |
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
test pad::tests::tim_30_synth_holds_while_loading ... ok
test pad::tests::tim_44_pitch_holds_at_48_khz ... ok
test tests::time_02_one_hour_no_drift ... ok
test pad::tests::tim_16_notes_within_5_cents ... ok

test result: ok. 133 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 116.60s


running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

    Finished `test` profile [optimized + debuginfo] target(s) in 0.00s
     Running unittests src/lib.rs (target/debug/deps/metrorig_audio-e3c84ac815f4f448)
   Doc-tests metrorig_audio
```

`python3 -I tests/fixtures/orchestra_bank_check.py --pitch` - exit 0

```
meter: key 71 with a known centre of 7 cents reads +7.1
meter: key 47 detuned by 30 cents reads +29.5, from -0.6
23 B0.flac: -0.1 cents
27 Ds1.flac: -0.1 cents
31 G1.flac: +0.1 cents
35 B1.flac: -0.4 cents
39 Ds2.flac: +0.5 cents
43 G2.flac: +2.6 cents
47 B2.flac: -0.6 cents
51 Ds3.flac: +0.7 cents
55 G3.flac: +1.5 cents
59 B3.flac: +0.2 cents
63 Ds4.flac: -0.8 cents
67 G4.flac: +0.5 cents
71 B4.flac: +0.1 cents
```

`python3 -I tests/fixtures/pad_bank_check.py` - exit 0

```
Orchestra 47 /pads/orchestra/B2.flac: wrap step 1
Orchestra 51 /pads/orchestra/Ds3.flac: wrap step 1
Orchestra 55 /pads/orchestra/G3.flac: wrap step 0
Orchestra 59 /pads/orchestra/B3.flac: wrap step 1
Orchestra 63 /pads/orchestra/Ds4.flac: wrap step 2
Orchestra 67 /pads/orchestra/G4.flac: wrap step 1
Orchestra 71 /pads/orchestra/B4.flac: wrap step 2
Sweep 44 /pads/sweep/Gs2.flac: wrap step 91
Sweep 48 /pads/sweep/C3.flac: wrap step 711
Sweep 52 /pads/sweep/E3.flac: wrap step 194
Sweep 56 /pads/sweep/Gs3.flac: wrap step 1092
Sweep 60 /pads/sweep/C4.flac: wrap step 130
Sweep 64 /pads/sweep/E4.flac: wrap step 108
Sweep 68 /pads/sweep/Gs4.flac: wrap step 538
Sweep 72 /pads/sweep/C5.flac: wrap step 702
```

`python3 -I tests/fixtures/orchestra_bank_check.py --level` - exit 0

```
23 B0.flac: level moves 0.68 dB
27 Ds1.flac: level moves 0.68 dB
31 G1.flac: level moves 0.27 dB
35 B1.flac: level moves 0.49 dB
39 Ds2.flac: level moves 0.45 dB
43 G2.flac: level moves 0.36 dB
47 B2.flac: level moves 0.34 dB
51 Ds3.flac: level moves 0.27 dB
55 G3.flac: level moves 0.33 dB
59 B3.flac: level moves 0.65 dB
63 Ds4.flac: level moves 0.79 dB
67 G4.flac: level moves 0.71 dB
71 B4.flac: level moves 0.52 dB
```

`python3 -I tests/fixtures/orchestra_bank_check.py --repeat` - exit 0

```
two runs give the same 13 files, which are the shipped ones
```
