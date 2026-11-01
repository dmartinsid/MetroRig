# song-bars proofs

**HEAD**: f56537b
**Tree**: clean
**Shell**: /bin/sh
**Result**: 43 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run js / ✓ tests/songs.test.ts > Songs > bars_01 four bars of sixteen` | pass |
| C2 | `run js / ✓ tests/songs.test.ts > Songs > bars_02 consecutive measures` | pass |
| C3 | `run js / ✓ tests/songs.test.ts > Songs > bars_03 two different bars` | pass |
| C4 | `run js / ✓ tests/songs.test.ts > Songs > bars_04 first measure and tempo` | pass |
| C5 | `run js / ✓ tests/songs.test.ts > Songs > bars_05 click marks every beat` | pass |
| C6 | `run rust / test tests::pattern_wraps_after_four_bars ... ok` | pass |
| C7 | `run js / ✓ src/index.test.ts > Song Bars > bars_07 saved song keeps four bars` | pass |
| C8 | `run js / ✓ tests/state.test.ts > Preset normalization > bars_08 no bar count is one bar` | pass |
| C9 | `run js / ✓ src/index.test.ts > Song Bars > edit_01 selector on four bars` | pass |
| C10 | `run js / ✓ src/index.test.ts > Song Bars > edit_02 no selector on one bar` | pass |
| C11 | `run js / ✓ src/index.test.ts > Song Bars > edit_03 press shows the bar` | pass |
| C12 | `run js / ✓ src/index.test.ts > Song Bars > edit_04 song loads on bar one` | pass |
| C13 | `run js / ✓ src/index.test.ts > Song Bars > edit_05 follows the bar in play` | pass |
| C14 | `run js / ✓ src/index.test.ts > Song Bars > edit_06 press during playback` | pass |
| C15 | `run js / ✓ src/index.test.ts > Song Bars > edit_07 cell changes one bar` | pass |
| C16 | `run js / ✓ src/index.test.ts > Song Bars > edit_08 figure stays in the bar` | pass |
| C17 | `run js / ✓ src/index.test.ts > Song Bars > edit_09 groove stays in the bar` | pass |
| C18 | `run js / ✓ src/index.test.ts > Song Bars > edit_10 save groove takes the bar` | pass |
| C19 | `run js / ✓ src/index.test.ts > Song Bars > edit_11 stop returns to bar one` | pass |
| C20 | `walk - at 1024px and 390px pressing a bar shows it and the page does not scroll sideways` | pass (Walked) |
| C21 | `run rust / test tests::trainer_counts_each_bar ... ok` | pass |
| C22 | `run rust / test tests::smooth_trainer_ignores_bars ... ok` | pass |
| C23 | `run js / ✓ src/index.test.ts > Song Bars > count_03 position by bar` | pass |
| C24 | `run js / ✓ src/index.test.ts > Song Bars > count_04 steps over the limit` | pass |
| C25 | `run rust / test tests::holds_128_steps ... ok` | pass |
| C26 | `run js / ✓ src/index.test.ts > Song Bars > count_06 limit of one bar` | pass |
| C27 | `run js / ✓ src/index.test.ts > Song Bars > clock_01 sixteen slices` | pass |
| C28 | `run js / ✓ src/index.test.ts > Song Bars > clock_02 bar in play` | pass |
| C29 | `run js / ✓ src/index.test.ts > Song Bars > clock_03 changes on the first step` | pass |
| C30 | `run js / ✓ src/index.test.ts > Song Bars > clock_04 stopped shows bar one` | pass |
| C31 | `run js / ✓ src/index.test.ts > Song Bars > clock_05 orb pulses` | pass |
| C32 | `run js / ✓ src/index.test.ts > Song Bars > meter_01 asks first` | pass |
| C33 | `run js / ✓ src/index.test.ts > Song Bars > meter_02 accept keeps bar one` | pass |
| C34 | `run js / ✓ src/index.test.ts > Song Bars > meter_03 decline changes nothing` | pass |
| C35 | `run js / ✓ src/index.test.ts > Song Bars > meter_04 selector hides` | pass |
| C36 | `run js / ✓ tests/tabToGrid.test.ts > tab_to_grid > bars_doc four bars from one measure` | pass |
| C37 | `grep -q '4 bars' README.md` | pass |
| C38 | `grep -q 'bar selector' .stitch/DESIGN.md` | pass |
| C39 | `run js / ✓ src/index.test.ts > Song Bars > edge_01 load during bar three` | pass |
| C40 | `run js / ✓ src/index.test.ts > Song Bars > edge_02 edits in any bar ask` | pass |
| C41 | `run js / ✓ tests/state.test.ts > Preset normalization > edge_03 bars that do not fit` | pass |
| C42 | `walk - the user played all 14 songs and approved each one, recorded in Handoff` | pass (Walked) |
| Build | `npm run build` | pass |

## Output

`Run js` - exit 0

```
   Start at  13:55:15
   Duration  9.48s (transform 462ms, setup 1ms, collect 718ms, tests 9.46s, environment 2.85s, prepare 846ms)

stderr | src/index.test.ts > Integration Test > should handle click sound variation selector changes, race conditions and fetch rejections
Failed to load click sample, falling back to digital synth: Error: Fetch failed
    at /home/deivid/Projects/Github/MetroRig/src/index.test.ts:191:26
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

test result: ok. 59 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.92s


running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

    Finished `test` profile [optimized + debuginfo] target(s) in 0.00s
     Running unittests src/lib.rs (target/debug/deps/metrorig_audio-e3c84ac815f4f448)
   Doc-tests metrorig_audio
```

`grep -q '4 bars' README.md` - exit 0

```
(no output)
```

`grep -q 'bar selector' .stitch/DESIGN.md` - exit 0

```
(no output)
```
