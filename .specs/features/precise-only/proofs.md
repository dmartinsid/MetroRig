# precise-only proofs

**HEAD**: 92fcf64
**Tree**: clean
**Shell**: /bin/sh
**Result**: 52 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run rust / test tests::time_01_hits_within_one_sample ... ok` | pass |
| C2 | `run rust / test tests::time_02_one_hour_no_drift ... ok` | pass |
| C3 | `run rust / test tests::time_03_every_step_same_duration ... ok` | pass |
| C4 | `run js / ✓ src/index.test.ts > Precise page > swing_01 no swing control` | pass |
| C5 | `run js / ✓ src/index.test.ts > Precise page > swing_02 card title is Measure` | pass |
| C6 | `run js / ✓ src/index.test.ts > Precise page > swing_03 stored swing sends nothing` | pass |
| C7 | `run js / ✓ src/index.test.ts > Precise page > swing_04 save omits swing` | pass |
| C8 | `run js / ✓ tests/wasm.test.ts > Shipped WASM > swing_05 exports no swing function` | pass |
| C9 | `run rust / test tests::bpm_01_quarter_note_in_every_meter ... ok` | pass |
| C10 | `run js / ✓ tests/state.test.ts > Meter rules > bpm_02 steps per note value` | pass |
| C11 | `run js / ✓ tests/state.test.ts > Meter rules > bpm_03 blues shuffle preset` | pass |
| C12 | `run js / ✓ tests/state.test.ts > Meter rules > bpm_04 jazz swing preset` | pass |
| C13 | `run js / ✓ tests/state.test.ts > Meter rules > bpm_05 factory grooves hold 24 steps` | pass |
| C14 | `run js / ✓ tests/state.test.ts > Preset normalization > bpm_06 expands legacy steps` | pass |
| C15 | `run js / ✓ tests/state.test.ts > Preset normalization > bpm_07 rounds expanded bpm` | pass |
| C16 | `run js / ✓ tests/state.test.ts > Preset normalization > bpm_08 caps expanded bpm` | pass |
| C17 | `run rust / test tests::train_01_first_hit_at_start_bpm ... ok` | pass |
| C18 | `run rust / test tests::train_02_bars_change_on_beat_one ... ok` | pass |
| C19 | `run rust / test tests::train_03_seconds_change_on_beat_one ... ok` | pass |
| C20 | `run rust / test tests::train_04_smooth_is_continuous ... ok` | pass |
| C21 | `run rust / test tests::train_05_edit_keeps_live_bpm ... ok` | pass |
| C22 | `run rust / test tests::train_06_edit_applies_on_beat_one ... ok` | pass |
| C23 | `run rust / test tests::train_07_start_edit_waits_for_play ... ok` | pass |
| C24 | `run rust / test tests::train_08_disable_holds_live_bpm ... ok` | pass |
| C25 | `run rust / test tests::train_09_enable_continues_from_live_bpm ... ok` | pass |
| C26 | `run js / ✓ src/index.test.ts > Precise page > train_10 slider sends bpm immediately` | pass |
| C27 | `run rust / test tests::train_11_continues_from_slider_value ... ok` | pass |
| C28 | `run js / ✓ src/index.test.ts > Precise page > train_12 settings keep live bpm` | pass |
| C29 | `run js / ✓ src/index.test.ts > Precise page > train_13 editor shows live bpm` | pass |
| C30 | `run js / ✓ src/index.test.ts > Precise page > train_14 stop shows preset bpm` | pass |
| C31 | `run rust / test tests::train_15_never_passes_target ... ok` | pass |
| C32 | `run rust / test tests::train_16_holds_start_at_target ... ok` | pass |
| C45 | `run rust / test tests::train_17_preset_load_replaces_trainer ... ok` | pass |
| C46 | `run rust / test tests::train_18_preset_counts_a_full_bar ... ok` | pass |
| C47 | `run rust / test tests::train_19_new_schedule_counts_from_beat_one ... ok` | pass |
| C48 | `run rust / test tests::train_20_value_edit_keeps_interval_progress ... ok` | pass |
| C49 | `run rust / test tests::train_21_settings_before_first_hit_apply_on_it ... ok` | pass |
| C50 | `run js / ✓ src/index.test.ts > Precise page > train_22 preset load shows its start bpm during playback` | pass |
| C33 | `run rust / test tests::onset_01_trims_before_one_percent ... ok` | pass |
| C34 | `run rust / test tests::onset_02_woodblock_on_the_step ... ok` | pass |
| C35 | `run rust / test tests::onset_03_silent_sample_unchanged ... ok` | pass |
| C36 | `run rust / test tests::click_01_accent_has_no_echo ... ok` | pass |
| C37 | `run rust / test tests::play_01_stop_is_silent ... ok` | pass |
| C38 | `run rust / test tests::play_02_restart_has_no_leftovers ... ok` | pass |
| C39 | `run rust / test tests::play_03_fires_step_zero_first ... ok` | pass |
| C40 | `run js / ✓ src/index.test.ts > Precise page > vis_01 render waits for latency` | pass |
| C41 | `run js / ✓ tests/visualSync.test.ts > Visual sync > vis_02 invalid latency gives zero` | pass |
| C42 | `run js / ✓ src/index.test.ts > Precise page > vis_03 stop cancels pending render` | pass |
| C43 | `run js / ✓ tests/metronome-processor.test.ts > Worklet > rt_01 no logs on messages or ticks` | pass |
| C44 | `run js / ✓ tests/metronome-processor.test.ts > Worklet > rt_02 reuses heap views` | pass |
| Build | `npm run build:wasm` | pass |
| Build | `npx vite build` | pass |

## Output

`Run rust` - exit 0

```
test tests::bpm_01_quarter_note_in_every_meter ... ok
test tests::time_01_hits_within_one_sample ... ok
test tests::time_02_one_hour_no_drift ... ok

test result: ok. 43 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.25s


running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Compiling metrorig_audio v1.0.0 (/tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/verify)
    Finished `test` profile [optimized + debuginfo] target(s) in 1.35s
     Running unittests src/lib.rs (target/debug/deps/metrorig_audio-e3c84ac815f4f448)
   Doc-tests metrorig_audio
```

`Run js` - exit 0

```
   Start at  15:09:03
   Duration  1.08s (transform 243ms, setup 1ms, collect 452ms, tests 819ms, environment 1.47s, prepare 450ms)

stderr | src/index.test.ts > Integration Test > should handle click sound variation selector changes, race conditions and fetch rejections
Failed to load click sample, falling back to digital synth: Error: Fetch failed
    at /tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/verify/src/index.test.ts:186:26
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
    at runTest (file:///tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/verify/node_modules/@vitest/runner/dist/index.js:781:11)
    at runSuite (file:///tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/verify/node_modules/@vitest/runner/dist/index.js:909:15)
    at runSuite (file:///tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/verify/node_modules/@vitest/runner/dist/index.js:909:15)
    at runFiles (file:///tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/verify/node_modules/@vitest/runner/dist/index.js:958:5)
    at startTests (file:///tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/verify/node_modules/@vitest/runner/dist/index.js:967:3)
    at file:///tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/verify/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:116:7
    at withEnv (file:///tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/verify/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:83:5)
    at run (file:///tmp/claude-1000/-home-deivid-Projects-Github-MetroRig/fe59fed3-a65f-4e7d-a9e0-3710c751221f/scratchpad/verify/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:105:3)
```
