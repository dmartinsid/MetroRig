# Layered Architecture verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 54012f0
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `layers.test.ts` `the engine crate lives in engine/ and src/ holds no .rs file` | yes |
| C2 | `layers.test.ts` `the engine crate has every layered module` | yes |
| C3 | `layers.test.ts` `extern C and unsafe live only in ffi.rs` | yes |
| C4 | `layers.test.ts` `engine modules depend downward only` | no - a crossing inside a nested `use crate::{a::{..}, engine::X}` group is not seen (F2) |
| C5 | `layers.test.ts` `no engine file holds over 400 lines of production code` | yes - counts non-blank, non-comment lines; physical lines before `#[cfg(test)]` also stay under 400 (largest 283) |
| C6 | `wasm.test.ts` `exports the same names as at 591f031` | yes - recorded list equals the 591f031 wasm's exports; `npm run build` at HEAD left the tree clean, so the committed wasm is the rebuilt one |
| C7 | `tests/fixtures/tests_kept.py rust` | partly - checks names and passing, not "unchanged assertions" (F4); a hand diff shows only field paths changed |
| C8 | `tests/fixtures/golden_first.py` | partly - checks commit order only, not that the golden test passed on 591f031's code (F5); confirmed by running it at 181d14f: 7 pass |
| C9 | `golden_tests::drums_with_takes_and_dynamics` | yes - unchanged since 181d14f except imports; passes there |
| C10 | `golden_tests::synth_click` | yes |
| C11 | `golden_tests::sample_click` | yes |
| C12 | `golden_tests::trainer_stepped_by_bars` | yes |
| C13 | `golden_tests::trainer_smooth_by_seconds` | yes |
| C14 | `golden_tests::pad_changes_chord_and_timbre` | yes |
| C15 | `golden_tests::a_one_bit_change_fails_naming_its_scenario` | yes |
| C16 | `layers.test.ts` `the Engine holds the Trainer in one field` | yes |
| C17 | `layers.test.ts` `the Trainer holds no tempo and no Engine` | yes - also each rule returns `Option<f64>` |
| C18 | `sequencer::trainer::tests::stepped_curve_steps_at_the_bar_count` | yes - exact BPM sequence, with clamp at target |
| C19 | `sequencer::trainer::tests::smooth_curve_ramps_each_frame` | yes |
| C20 | `sequencer::trainer::tests::steps_by_bars` | yes |
| C21 | `sequencer::trainer::tests::steps_by_seconds_wait_for_beat_one` | yes |
| C22 | `sequencer::trainer::tests::settings_wait_for_beat_one` | yes |
| C23 | `sequencer::trainer::tests::a_changed_schedule_restarts` | yes |
| C24 | `layers.test.ts` `src holds the six layers and main.ts alone at its root` | yes |
| C25 | `layers.test.ts` `src imports downward only` | yes - own examples (`export * from '../ui/format'` in app, a multi-line `import {..} from '../app/library'` in domain) fail it |
| C26 | `layers.test.ts` `src has no import cycle` | yes |
| C27 | `layers.test.ts` `a crossing import fails naming the file and the import` | no - only TypeScript crossings and cycles; no Rust crossing case for ARCH-04 (F3) |
| C28 | `session.test.ts` `sends every engine and storage call through the adapters it receives` | yes - no DOM storage globals in node; `arrayContaining` lists a subset of commands, the rest are covered by C29-C37 |
| C29 | `session.test.ts` `plays and stops` | yes |
| C30 | `session.test.ts` `loads a preset` | partly - checks every track id was sent, but the steps of 2 tracks out of 13 (F7) |
| C31 | `session.test.ts` `saves a preset` | yes |
| C32 | `session.test.ts` `loads a song` | partly - tracks asserted on the preset, not on the engine (F6); own probe shows all 13 sent correctly at HEAD |
| C33 | `session.test.ts` `presses a chord` | yes |
| C34 | `session.test.ts` `changes the timbre` | yes |
| C35 | `session.test.ts` `changes the pad volume` | partly - one value (40) (F8); own probe: 0 -> 0, 100 -> 1 |
| C36 | `session.test.ts` `edits a step` | yes |
| C37 | `session.test.ts` `sets the Trainer` | yes |
| C38 | `layers.test.ts` `ui holds one module per screen and the header` | yes |
| C39 | `layers.test.ts` `main.ts holds at most 150 lines` | yes (27 lines) |
| C40 | `tests/fixtures/tests_kept.py js` | partly - names only, not "unchanged assertions" (F4); diff of the test files shows only import and file paths changed |
| C41 | `npm run build` | yes |
| C42 | `docs.test.ts` `CONTRIBUTING names the layers and only paths that exist` | yes |
| C43 | `docs.test.ts` `GLOSSARY defines Session, Trainer, Instrument and each layer` | yes |
| C44 | `docs.test.ts` `STATE records the layer rule as AD-028` | yes |
| C45 | `tests/fixtures/pad_bank_check.py` | yes |
| C46 | `copyWasm.test.ts` `exits 1 naming the path when the build is missing` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1 - The Stadium's Trainer status label changed: it now prints the stored numbers, not the Editor's field text. Start `080` shows `Trainer 80` (was `Trainer 080`), Step Value `1.0` shows `every 1 bar` (was `every 1.0 bars`), an empty Increment shows `+0` (was `+`). This breaks the goal "nothing a user sees changes" and Out of Scope "labels". No check catches it | `src/ui/stadium.ts:134-141` against 591f031 `src/main.ts:735-741`; a throwaway DOM probe (stad_07's steps with those values) printed `Trainer 080 → 160 BPM · +5 every 1.0 bars` at 591f031 and `Trainer 80 → 160 BPM · +5 every 1 bar` at HEAD | Restore the old text (the Editor gives the Session the form's raw strings for display, or the Stadium reads them through the Session), and add an app test with `080` / `1.0`. Or the user approves the change as a recorded departure with a new requirement | 121beac |
| F2 - The Rust layer checker misses a crossing inside a nested use group | `tests/layers.test.ts:99` - `crate::\{([^}]*)\}` stops at the first `}`; adding `use crate::{dsp::{sample::trim_onset}, engine::Engine};` to `instruments/click.rs` in a scratch copy left C4 green | Parse `use` trees with brace matching, or flag every top-level path segment in a `crate::{...}` group | 5520175 |
| F3 - C27 proves the failure message only for TypeScript; ARCH-17 also covers ARCH-04 (Rust) | `tests/layers.test.ts:319-339` has no Rust case | Add Rust crossing cases (flat `crate::engine`, grouped, nested group, `super::super::`) to the C27 test, asserting file and import named | d95a149 |
| F4 - C7 and C40 check test names, not ARCH-07/ARCH-22's "unchanged assertions" | `tests/fixtures/tests_kept.py:52-84` compares names and pass status only. A hand diff of assert lines (591f031 `src/lib.rs`+`src/pad.rs` vs `engine/src`) and of `tests/*.test.ts` shows only field-path (`engine.bpm` -> `engine.clock.bpm`) and import-path changes, so the claim holds today | Record each kept test's assertion text at 591f031 and compare it, with field and import paths normalized | 61c8db5 |
| F5 - C8 checks commit order, not that the golden test passed on 591f031's code. It also ignores commits to `src/*.rs`, where the engine lived before the move | `tests/fixtures/golden_first.py:21-30`; run by hand on `git archive 181d14f`: 7 golden tests pass | Have the proof run `cargo test golden` on an archive of the golden commit, and watch `src/*.rs` as well as `engine/src` | c1f07c1 |
| F6 - C32 does not assert the song's tracks reach the engine | `tests/app/session.test.ts:176-190`: `updateGrid` is never checked | Assert each track's `updateGrid` equals `songToPreset(song).gridData` | b739064 |
| F7 - C30 checks the sent steps of tracks 1 and 2 only | `tests/app/session.test.ts:146-149` | Compare every track's sent steps with the preset's | 8e3ebd9 |
| F8 - C35 proves 0-100 -> 0-1 on one value | `tests/app/session.test.ts:275-277` (40 only) | Add 0 -> 0 and 100 -> 1 | 4d90ab6 |

## Departures judged

- Stadium status reads `session.preset.trainerSettings` - a visible behaviour change, see F1.
- `src/index.css` -> `src/ui/index.css` - required by ARCH-14 (only `main.ts` at the `src/` root). `index.html` and the test's path follow it, and no assertion changed. Accepted.
- `'tempo'` SessionChange and the read-only `factoryPresets`/`trainerPresets`/`factoryGrooves` - required by ARCH-15 (`ui` may not import `data`). `setBpm` keeps the old order of effects (`src/app/session.ts:173-178` vs 591f031 `main.ts:604-613`). Accepted.
- Save redraws on `'library'` - emitted only inside the save's `.then` (`src/app/session.ts:374-380`), and the header and editor redraw what the old `.then` did. Accepted.
- `syncAudioSettings` sends `preset.trainerSettings` - every form `change` writes `Number(...)` of each field into the preset, and every preset load writes the preset into the form, so the two never differ at Play on a reachable path. Accepted.

## PR #14 review

The code review posted on PR #14 at cc0f016 ([comment](https://github.com/dmartinsid/MetroRig/pull/14#issuecomment-6647988329)), each point checked against the code and closed or answered. After the fixes: `vitest` 472 pass, `tests_kept.py rust` 136 of 136 and `js` 433 of 433 pass and keep their assertions, `golden_first.py` 7 of 7, `npm run build` leaves the tree clean.

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| R1 - The Stadium held the practice timer and wrote the Editor's `#editor-timer`, against AD-028 | `src/ui/stadium.ts:117-131` at cc0f016 | The Session counts `practiceSeconds` and emits `'timer'`; each screen draws its own. `session.test.ts` `counts the practice time from Play, holds it at Stop and restarts it at the next Play`; `time_02` to `time_06` unchanged | a9e482c |
| R2 - The Editor's panel header held the 12/14/16-step signature rule, repeated in the Session's preset load | `src/ui/editor.ts:202-209`, `src/app/session.ts:379-387` | `timeSignatureOf` in `domain/meter.ts` for both. The Editor's fallback for other lengths read `N steps` where the Session wrote `N/16`; every load writes the signature, so it was unreachable | 12056c3 |
| R3 - `header.ts` bound the Stadium's play button and routine selector, and the selector dispatched a change on the header's | `src/ui/header.ts:28, 39, 191, 202-206` | `stadium.ts` fills its selector, loads through the Session and follows `selectedPresetValue`. Two `app.test.ts` tests, passing before and after, cover the selector and the button | 63ac3b6 |
| R4 - `trainerStatusText` and `formatLiveBpm` sat outside `src/ui/format.ts` | `src/app/session.ts:40-46`, `src/ui/header.ts:10-12` | `formatTrainerStatus` and `formatLiveBpm` in `ui/format.ts`; `display.test.ts` asserts the text, `session.test.ts` the fields | 0c54b48 |
| R5 - `stateManager.ts` repeated the factory 4/4 Metronome | `src/app/stateManager.ts:8-29` | `structuredClone(FACTORY_PRESETS[0])`; `state.test.ts` pins the two equal and apart | 63b0c96 |
| R6 - `setTimeSignature` and `saveGroove` repeated the bar slice-and-pad loop | `src/app/session.ts:275-282, 480-487` | `fitBar` in `domain/pattern.ts`; `bars.test.ts` covers cut, pad and copy | 5bbe8af |
| R7 - The Rust layer check missed `self::` and the crate's own name | `tests/layers.test.ts:134` | Both resolved; C27 gains a crossing and an allowed case of each. `lib.rs`, in no layer, may import nothing | 3ea2333 |
| R8 - Ten white-box tests that build an `Engine` stayed in `ffi_tests.rs`, against `spec.md:40` | `engine/src/ffi_tests.rs:979-1033, 1575-1920` at cc0f016 | Moved to `engine.rs`'s test module; the two that went through `engine_set_measure_length` and `engine_set_click_mode` call the Engine methods those wrap. `ffi_tests.rs` keeps the 74 tests through the exports | 1e2fcd3 |

Answered without a change:

- `pressChord`, `stopChord`, `setTimbre`, `setPadVolume` and `loadSelectedTimbre` forward to `Session.improv`. They stay: the Session is the one door for commands, and C28 holds every engine call to the adapters it receives. `improv` stays readable for the Improv screen's state.
- The ARCH-05 counter skips comments and blank lines. Every file also stays under 400 physical lines before `#[cfg(test)]`, as C5 records, so the rule holds under both readings.
