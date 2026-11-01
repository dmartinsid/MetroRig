# Song Bars verification

**Verdict**: PASS
**Proofs**: this Verifier judged `proofs.md` at add17e5 and returned FAIL. Every finding is closed below and the current `proofs.md` passes. The fixes came after that judgement, and no second Verifier read them.
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `tests/songs.test.ts` `bars_01 four bars of sixteen` | yes - every song, every track at 64; mutant with `bars: 1` killed |
| C2 | `tests/songs.test.ts` `bars_02 consecutive measures` | yes - a one-step change fails it. The fixture keeps only the 4 measures, so "consecutive at the cited revision" rests on how it was cut; re-read from the live tabs at each cited revision, all 14 match measure for measure |
| C3 | `tests/songs.test.ts` `bars_03 two different bars` | yes - all drum tracks; mutant with 4 equal bars killed |
| C4 | `tests/songs.test.ts` `bars_04 first measure and tempo` | yes - the fixture holds `tempo` as a copied number, not the tab's automation, so the test cannot derive it; `tempoAt` on the 14 live tabs gives the same BPM |
| C5 | `tests/songs.test.ts` `bars_05 click marks every beat` | yes - exact 64 values on all 14; accent-per-bar and 1-bar-click mutants killed |
| C6 | `src/lib.rs` `pattern_wraps_after_four_bars` | yes - exact step order and intervals; early wrap, 1-bar wrap and a 3-sample gap at the wrap all killed |
| C7 | `src/index.test.ts` `bars_07 saved song keeps four bars` | no - checks the count and the length, never the steps of bars 2 to 4 |
| C8 | `tests/state.test.ts` `bars_08 no bar count is one bar` | yes |
| C9 | `src/index.test.ts` `edit_01 selector on four bars` | yes |
| C10 | `src/index.test.ts` `edit_02 no selector on one bar` | yes |
| C11 | `src/index.test.ts` `edit_03 press shows the bar` | yes |
| C12 | `src/index.test.ts` `edit_04 song loads on bar one` | yes when stopped; a load during playback is not tried, see findings |
| C13 | `src/index.test.ts` `edit_05 follows the bar in play` | yes for a running pattern; a bar pressed before Play is not tried and fails, see findings |
| C14 | `src/index.test.ts` `edit_06 press during playback` | yes - counts engine messages and the hold to step 16; a sending and a snapping mutant killed |
| C15 | `src/index.test.ts` `edit_07 cell changes one bar` | yes - other bars and the 64 steps sent |
| C16 | `src/index.test.ts` `edit_08 figure stays in the bar` | yes |
| C17 | `src/index.test.ts` `edit_09 groove stays in the bar` | yes - bar-1-only and all-bars mutants killed |
| C18 | `src/index.test.ts` `edit_10 save groove takes the bar` | yes |
| C19 | `src/index.test.ts` `edit_11 stop returns to bar one` | yes |
| C20 | walk: at 1024px and 390px pressing a bar shows it and the page does not scroll sideways | no test; happy-dom applies no CSS. The Walked line records `scrollWidth` equal to the window width at both widths; CSS read: `.bar-selector` is a small flex row, `[hidden]` overrides its `display` at `src/index.css:471` |
| C21 | `src/lib.rs` `trainer_counts_each_bar` | yes - counting at the pattern wrap instead of the bar is killed |
| C22 | `src/lib.rs` `smooth_trainer_ignores_bars` | yes - multiplying by the pattern length is killed |
| C23 | `src/index.test.ts` `count_03 position by bar` | yes - ticks jump (`16` to `37` counts as the same bar), but the rule read is step-only; both mutants killed |
| C24 | `src/index.test.ts` `count_04 steps over the limit` | yes |
| C25 | `src/lib.rs` `holds_128_steps` | yes - the worklet's 128 is backed by `reports every track of the kit on a tick` |
| C26 | `src/index.test.ts` `count_06 limit of one bar` | yes |
| C27 | `src/index.test.ts` `clock_01 sixteen slices` | yes |
| C28 | `src/index.test.ts` `clock_02 bar in play` | yes - loose: a clock wired to `viewBar` passes it; `clock_04 a press during playback leaves the clock` catches that |
| C29 | `src/index.test.ts` `clock_03 changes on the first step`, `clock_03 waits for the sound` | no - Battery's bars 1 and 2 light the same slices on every ring, so both tests pass with a clock one step late |
| C30 | `src/index.test.ts` `clock_04 stopped shows bar one` | yes |
| C31 | `src/index.test.ts` `clock_05 orb pulses` | yes - the test injects `activeTrackIds`; the real source is held by `tests/metronome-processor.test.ts` `reports the tracks of a step past 32` |
| C32 | `src/index.test.ts` `meter_01 asks first` | yes - loose: the denominator goes through the stepper, so the `select`'s own `onchange` can be removed and it passes |
| C33 | `src/index.test.ts` `meter_02 accept keeps bar one` | no - with bar 3 on screen it reads Kick, whose first 12 steps are equal in bars 1, 3 and 4, so resizing the bar on screen passes |
| C34 | `src/index.test.ts` `meter_03 decline changes nothing` | yes |
| C35 | `src/index.test.ts` `meter_04 selector hides` | yes |
| C36 | `tests/tabToGrid.test.ts` `bars_doc four bars from one measure` | yes |
| C37 | `grep -q '4 bars' README.md` | yes - line 9 is the song sentence |
| C38 | `grep -q 'bar selector' .stitch/DESIGN.md` | yes - loose: the only match is "shows no bar selector", and the clock half of DOC-02 AC 3 is not in the proof; `.stitch/DESIGN.md:291` does hold it |
| C39 | `src/index.test.ts` `edge_01 load during bar three` | yes - resetting `POS` on load is killed |
| C40 | `src/index.test.ts` `edge_02 edits in any bar ask` | yes for the card; the `Songs` group path is held by `grv_11` and `grv_12`, and tried here with a bar 2 edit: asks, declines and accepts correctly |
| C41 | `tests/state.test.ts` `edge_03 bars that do not fit` | yes - four bad counts and the sliced steps |
| C42 | walk: the user played all 14 songs, recorded in Handoff | yes - the user approved them: "Aprovei as 14 musicas do jeito que ta" |
| C43 | `src/lib.rs` `restart_returns_to_bar_one_on_the_pulse` | added after this Verifier, for a PR review; not judged by it |
| C44 | `src/index.test.ts` `edit_04 a song loaded during playback starts on bar one` | added after this Verifier, for a PR review; not judged by it |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C42 is open: the user has not approved the 14 songs by ear, and the Every Day I Have the Blues tempo is undecided. The `pass (Walked)` row only says a Walked line exists | `tasks.md` Handoff, Walked line: "The sound itself was not heard: approval by ear: pending"; `context.md` Open section; `proofs.md` C42 | The user plays the 14 songs and decides the tempo, recorded in Handoff; the proof must read that approval, not the line's presence | recorded after 989a34d, approved by the user: "Aprovei as 14 musicas do jeito que ta", C42 |
| A bar pressed while stopped stays on screen for all of bar 1 after Play, so the Editor shows a bar that is not in play (BAR-01 AC 5) | Throwaway test: press 3, Play, ticks 0 and 5, `pressedBars()` is `['3']`. `src/main.ts:715` only moves `viewBar` when `bar !== playBar`, and both are 0 for the first bar; the Play branch at `src/main.ts:510` does not set `viewBar` | Set `viewBar = 0` and redraw on Play, with a test | 2e4b099, edit_05 a bar pressed while stopped gives way to Play |
| Retyping the same time signature on 4 bars drops bars 2 to 4 with no question (BAR-05 AC 1, AC 2 spirit) | Throwaway test: on Battery set `time-sig-num` to `04` and fire `change`: `confirm` not called, `STEPS: 16/128`. `src/main.ts:592` asks only when `sigStr` differs, and the code below sets `bars = 1` regardless | Return early when `sigStr` equals the active signature, with a test | 2e4b099, meter_01 the same time signature changes nothing |
| `normalizePreset` on a 12/8 legacy preset with `bars` loses bars and leaves a count its steps do not hold | `{ measureLength: 12, bars: 4, 48 steps }` gives `bars 4, measureLength 24, 24 steps`: only the first 12 of 48 stored steps are kept, and `patternLength` is 96 against 24 held; `{ bars: 2, 24 steps }` likewise. `src/state.ts:59-71` expands only `step < 12` after `fitBars` accepted the 4 bars. `{ bars: 1 }` and non-fitting counts are correct | Expand the whole pattern, or fall back to 1 bar there, with a test | 2e4b099, expands every bar of a legacy 12/8 pattern |
| A tick of the old pattern draws an empty grid on a 1-bar pattern. `updateTimeSignature` does not cancel pending ticks, and a tick posted before `SET_BARS` lands survives `loadPresetIntoUI` | Throwaway tests: visual delay 100ms, tick 40, accept 3/4, advance timers: the grid no longer shows bar 1; tick 33 after loading `factory:rock` during bar 3: Kick row goes empty. Both set `viewBar` past the pattern at `src/main.ts:715-718`, until the next tick. `confirm` blocks the page while the worklet keeps ticking, so accepting during playback queues several | Clamp the bar to `barCount` in `renderTick`, and cancel pending ticks on the accepted change, with a test | 2e4b099, a tick of the old pattern draws nothing after a load |
| C7's test passes with the saved bars wrecked | Mutants survived: bars 2 to 4 zeroed on the `user:` load, and Save writing bar 1 four times. `src/index.test.ts:2420-2433` reads only `saved.bars` and `toHaveLength(64)`, then the `STEPS` text. A throwaway test shows the code itself is right, including an edit in bar 3 saved as a second preset | Assert every bar's steps on screen after the reload | 2e4b099, C7 |
| C29's tests cannot see the change they are named for | Mutant `barOfStep(beatIndex - 1)` survived both. Battery bars 1 and 2 differ only by Crash against Open Hat on step 1, one ring. `src/index.test.ts:2323-2342` | Test the change at a bar line whose rings differ: 2 to 3 on Battery | 2e4b099, C29 |
| C33's test cannot tell bar 1 from the bar on screen | Mutant resizing `viewBar` instead of bar 1 survived `meter_02`; Kick `x...xx..x...` starts bars 1, 3 and 4. `src/index.test.ts:2208`. A throwaway check on tracks 1, 2, 4, 5, 7 and 10 shows the code keeps bar 1 | Assert a track that differs, such as Crash or Open Hat | 2e4b099, C33 |
| `playBar = 0` on preset load and on an accepted time signature has no test | Removing either line in `src/main.ts` passes the whole suite (266 tests); design.md names the load reset as the guard against a stale bar. Removing the Stop reset is killed by `clock_04` | Assert the clock right after each, during bar 3 of a song | 2e4b099, the clock leaves the old bar when a preset loads during playback |
| `normalizePreset` keeps bar counts the spec rules out when they divide the steps | `bars 2` over 32 steps, `5` over 80 and `8` over 128 stay as they are, against Out of Scope "A bar count other than 1 or 4". By code read, `engine_set_bars` refuses above 4 and keeps the previous count, and the selector always draws 4 buttons. Stored data only: the app writes 1 or 4 | Accept only 1 and 4 in `fitBars` | 2e4b099, C41 |
| A song loaded during playback does not stay on bar 1, and enters the new song mid-pattern. BAR-01 AC 4 has no playback exception and no criterion decides this | Throwaway test: Battery at bar 3, load Cocaine: bar 1 pressed, next tick (33) shows `['3']`. The engine keeps `step_index`, since 33 fits 64. C12 tries it stopped only | The user decides: restart the pattern on a song load, or a new criterion for joining at the bar in play | 989a34d, C43 and C44 |
| PR review: `.stitch/DESIGN.md` still drew 4 rows, 44px cells, 4 mix cards and no ghost state | PR 11 comment, checked against `src/index.css` and the page | Update the passages | 7e8ef7b, C38 |
