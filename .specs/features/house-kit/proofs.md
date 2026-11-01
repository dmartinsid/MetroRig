# house-kit proofs

**HEAD**: 02f7259
**Tree**: clean
**Shell**: /bin/sh
**Result**: 39 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run js / ✓ tests/kit.test.ts > House Kit > hk_01 nine takes of each piece` | pass |
| C2 | `run rust / test tests::hk_02_kick_and_toms_map_their_dynamics ... ok` | pass |
| C3 | `run js / ✓ tests/kit.test.ts > House Kit > hk_03 snare recordings` | pass |
| C4 | `run rust / test tests::hk_04_takes_rotate_per_dynamic ... ok` | pass |
| C5 | `run rust / test tests::hk_05_play_restarts_the_takes ... ok` | pass |
| C6 | `run rust / test tests::hk_06_bank_hit_has_no_step_gain ... ok` | pass |
| C7 | `run rust / test tests::hk_07_replaced_hit_fades_over_5_ms ... ok` | pass |
| C8 | `run rust / test tests::hk_08_single_sample_keeps_its_gains ... ok` | pass |
| C9 | `run js / ✓ tests/kit.test.ts > House Kit > hk_09 format and tail` | pass |
| C10 | `run js / ✓ tests/kit.test.ts > House Kit > hk_10 recorded levels` | pass |
| C11 | `run js / ✓ tests/kit.test.ts > House Kit > hk_11 size limit` | pass |
| C12 | `run js / ✓ src/index.test.ts > House Kit > hk_12 logs a failed take` | pass |
| C13 | `run rust / test tests::hk_12_missing_take_is_skipped ... ok` | pass |
| C14 | `run rust / test tests::hk_13_missing_dynamic_falls_back ... ok` | pass |
| C15 | `run rust / test tests::hk_14_track_with_no_takes_is_silent ... ok` | pass |
| C16 | `run js / ✓ src/index.test.ts > House Kit > hk_15 rows follow the track order` | pass |
| C17 | `run js / ✓ tests/kit.test.ts > House Kit > hk_16 ids stay` | pass |
| C18 | `run js / ✓ src/index.test.ts > House Kit > hk_17 thirteen rows and cards` | pass |
| C19 | `run js / ✓ src/index.test.ts > House Kit > hk_18 new tom cells cycle and play` | pass |
| C20 | `run js / ✓ src/index.test.ts > House Kit > hk_19 mute and solo the new toms` | pass |
| C21 | `run js / ✓ tests/state.test.ts > Preset normalization > hk_20 eleven track preset` | pass |
| C22 | `run js / ✓ src/index.test.ts > House Kit > hk_21 new toms light the stadium group` | pass |
| C23 | `run js / ✓ tests/tabToGrid.test.ts > tab_to_grid > hk_22 four toms` | pass |
| C24 | `run js / ✓ tests/songs.test.ts > Songs > hk_23 toms on four tracks` | pass |
| C25 | `walk - the user plays the songs and a tom fill and answers per piece, written to Handoff and verification.md` | pass (Walked) |
| C26 | `walk - each rejected piece is heard on its earlier sample, or none was rejected, written to Handoff` | pass (Walked) |
| C27 | `walk - each rejected piece is heard on its new recordings, or none was rejected, written to Handoff` | pass (Walked) |
| C28 | `walk - the trims in src/kit.ts match those the user heard, written to Handoff` | pass (Walked) |
| C29 | `run js / ✓ tests/kit.test.ts > House Kit > hk_28 license facts` | pass |
| C30 | `run js / ✓ tests/kit.test.ts > House Kit > hk_29 release is the user account` | pass |
| C31 | `run js / ✓ tests/kit.test.ts > House Kit > hk_30 readme credit` | pass |
| C32 | `run js / ✓ src/index.test.ts > House Kit > hk_31 footer credit` | pass |
| C33 | `run js / ✓ src/index.test.ts > House Kit > hk_32 footer link` | pass |
| C34 | `run rust / test tests::hk_33_loop_keeps_the_rotation ... ok` | pass |
| C35 | `run rust / test tests::hk_34_changed_dynamic_uses_its_next_take ... ok` | pass |
| C36 | `walk - no sideways page scroll at the 3 widths, written to Handoff` | pass (Walked) |
| C37 | `run js / ✓ tests/kit.test.ts > House Kit > hk_35 kick and snare layers` | pass |
| C38 | `run rust / test tests::hk_36_click_restarts_with_no_fade ... ok` | pass |
| Build | `npm run build` | pass |

## Output

`Run js` - exit 0

```
   Start at  19:10:28
   Duration  11.27s (transform 696ms, setup 2ms, collect 1.00s, tests 14.25s, environment 2.82s, prepare 835ms)

stderr | src/index.test.ts > Integration Test > should handle click sound variation selector changes, race conditions and fetch rejections
Failed to load click sample, falling back to digital synth: Error: Fetch failed
    at /home/deivid/Projects/Github/MetroRig/src/index.test.ts:194:26
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
test tests::time_03_every_step_same_duration ... ok
test tests::bpm_01_quarter_note_in_every_meter ... ok
test tests::time_01_hits_within_one_sample ... ok
test tests::time_02_one_hour_no_drift ... ok

test result: ok. 78 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 13.29s


running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

    Finished `test` profile [optimized + debuginfo] target(s) in 0.00s
     Running unittests src/lib.rs (target/debug/deps/metrorig_audio-e3c84ac815f4f448)
   Doc-tests metrorig_audio
```
