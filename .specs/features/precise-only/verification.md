# Precise-Only Metronome verification

**Verdict**: FAIL
**Proofs**: proofs.md at fee8fc7
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `src/lib.rs` `time_01_hits_within_one_sample` | yes |
| C2 | `src/lib.rs` `time_02_one_hour_no_drift` | yes |
| C3 | `src/lib.rs` `time_03_every_step_same_duration` | yes - interval bound is 1 sample; 5512.5 itself is held by `test_engine_init` |
| C4 | `src/index.test.ts` `swing_01 no swing control` | yes |
| C5 | `src/index.test.ts` `swing_02 card title is Measure` | yes |
| C6 | `src/index.test.ts` `swing_03 stored swing sends nothing` | yes |
| C7 | `src/index.test.ts` `swing_04 save omits swing` | yes |
| C8 | `tests/wasm.test.ts` `swing_05 exports no swing function` | yes - reads the shipped file; a rebuild of HEAD gives identical bytes |
| C9 | `src/lib.rs` `bpm_01_quarter_note_in_every_meter` | yes |
| C10 | `tests/state.test.ts` `bpm_02 steps per note value` | yes |
| C11 | `tests/state.test.ts` `bpm_03 blues shuffle preset` | yes |
| C12 | `tests/state.test.ts` `bpm_04 jazz swing preset` | yes |
| C13 | `tests/state.test.ts` `bpm_05 factory grooves hold 24 steps` | yes |
| C14 | `tests/state.test.ts` `bpm_06 expands legacy steps` | yes |
| C15 | `tests/state.test.ts` `bpm_07 rounds expanded bpm` | yes |
| C16 | `tests/state.test.ts` `bpm_08 caps expanded bpm` | yes |
| C17 | `src/lib.rs` `train_01_first_hit_at_start_bpm` | yes - stepped by bars only; `start()` does not branch on the mode |
| C18 | `src/lib.rs` `train_02_bars_change_on_beat_one` | yes |
| C19 | `src/lib.rs` `train_03_seconds_change_on_beat_one` | yes - `>=` mutated to `>` fails it |
| C20 | `src/lib.rs` `train_04_smooth_is_continuous` | yes |
| C21 | `src/lib.rs` `train_05_edit_keeps_live_bpm` | yes - all five settings |
| C22 | `src/lib.rs` `train_06_edit_applies_on_beat_one` | yes - all five settings |
| C23 | `src/lib.rs` `train_07_start_edit_waits_for_play` | yes |
| C24 | `src/lib.rs` `train_08_disable_holds_live_bpm` | yes |
| C25 | `src/lib.rs` `train_09_enable_continues_from_live_bpm` | yes |
| C26 | `src/index.test.ts` `train_10 slider sends bpm immediately` | yes |
| C27 | `src/lib.rs` `train_11_continues_from_slider_value` | yes |
| C28 | `src/index.test.ts` `train_12 settings keep live bpm` | yes - meter, grid and groove edits run with the Trainer off, but any `setBpm` fails it and the page does not branch on the Trainer |
| C29 | `src/index.test.ts` `train_13 editor shows live bpm` | yes |
| C30 | `src/index.test.ts` `train_14 stop shows preset bpm` | yes |
| C31 | `src/lib.rs` `train_15_never_passes_target` | yes - stepped and smooth caps each mutated, each fails it |
| C32 | `src/lib.rs` `train_16_holds_start_at_target` | yes |
| C33 | `src/lib.rs` `onset_01_trims_before_one_percent` | yes - `>` for `>=` and left-only each fail it |
| C34 | `src/lib.rs` `onset_02_woodblock_on_the_step` | yes - real `woodblock.wav` |
| C35 | `src/lib.rs` `onset_03_silent_sample_unchanged` | yes |
| C36 | `src/lib.rs` `click_01_accent_has_no_echo` | yes - the sample case is exact; the old 38 ms reverb could not pass it |
| C37 | `src/lib.rs` `play_01_stop_is_silent` | yes |
| C38 | `src/lib.rs` `play_02_restart_has_no_leftovers` | yes - synth and drum resets each mutated, each fails it |
| C39 | `src/lib.rs` `play_03_fires_step_zero_first` | yes |
| C40 | `src/index.test.ts` `vis_01 render waits for latency` | yes - delay is mocked here; the sum is held by `sums the valid reported latencies in milliseconds` and `should derive the visual delay from the context latencies` |
| C41 | `tests/visualSync.test.ts` `vis_02 invalid latency gives zero` | yes - one invalid value alongside a valid one counts as 0, as design.md states |
| C42 | `src/index.test.ts` `vis_03 stop cancels pending render` | yes |
| C43 | `tests/metronome-processor.test.ts` `rt_01 no logs on messages or ticks` | yes - drives the shared `handleMessage` path that held the removed logs; per-type logs in the six message types it does not send would pass. Main-thread side is held by `should write no log when messages arrive from the worklet` |
| C44 | `tests/metronome-processor.test.ts` `rt_02 reuses heap views` | yes |
| C45 | `src/lib.rs` `train_17_preset_load_replaces_trainer` | yes - added by the fix in round 2, not judged by the Verifier; fails when the replace is routed to the pending slot (mutation) |
| C46 | `src/lib.rs` `train_18_preset_counts_a_full_bar` | yes - added by the fix in round 2, not judged by the Verifier; fails when the partial bar is counted (mutation) |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| A preset loaded during a running Trainer does not get its Start BPM (spec Edge Cases). Its settings wait in `pending_trainer` while the old Trainer stays live: a stepped schedule adds an increment on the first beat 1, and a Smooth one keeps raising the BPM the page just set | Page message order against the shipped WASM. Old stepped run, preset with Start 100, +5 per bar, loaded one step before beat 1: the next hit plays at 105, so 100 is never heard, against 100 when the old Trainer was off. Old Smooth +20 per second, preset with Start 100 and target 160: 102.9 on the next hit, 137.49 by beat 1, and it stays there. No check covers this; `preset start bpm applies on load and play` only asserts the `setBpm` message | Make a preset load replace the active Trainer at once, with counters reset, so its bar and seconds count from the Start BPM; add an engine test for both old-stepped and old-Smooth loads, covering the on-the-beat-1 case | 37696ab - C45, C46 |
