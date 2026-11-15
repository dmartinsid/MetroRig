# Tuplets verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at f0bb616
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `tests/pattern.test.ts` `tup_01 triplet lays 3 cells and 3 hits` | yes |
| C2 | `tests/pattern.test.ts` `tup_02 triplet rest lays 3 empty cells` | yes |
| C3 | `tests/pattern.test.ts` `tup_03 sextuplet lays 6 cells and 6 hits` | yes |
| C4 | `tests/pattern.test.ts` `tup_04 sextuplet rest lays 6 empty cells` | yes |
| C5 | `tests/pattern.test.ts` `tup_05 straight figure returns a tuplet beat to 4 cells` | yes |
| C6 | `tests/layout.test.ts` `tup_06 hits move to the nearest cell, earlier on a tie` | yes - every straight/3/6 direction, both tie cases |
| C7 | `tests/layout.test.ts` `tup_07 triplet cell k becomes sextuplet cell 2k` | yes |
| C8 | `tests/layout.test.ts` `tup_08 a clash keeps the stronger hit` | yes - all 6 orderings of the 3 strengths |
| C9 | `tests/app/session.test.ts` `tup_09 a tuplet cell cycles like a straight one` | yes |
| C10 | `tests/app.test.ts` `tup_10 tuplet figures are disabled outside /4` | yes - drives /8 in the page; /16 rests on `isTupletSignature('5/16')` in `layout.test.ts` |
| C11 | `tests/app/session.test.ts` `tup_11 a tuplet in bar 2 leaves the other bars` | yes |
| C12 | `engine/src/engine.rs` `tup_12_triplet_cells_start_at_thirds` | yes - two bars, two tempos, within 1 sample |
| C13 | `engine/src/engine.rs` `tup_13_sextuplet_cells_start_at_sixths` | yes |
| C14 | `engine/src/golden_tests.rs` `drums_with_takes_and_dynamics` | yes - `golden_tests.rs` is untouched in the range, so the fingerprint is 591f031's |
| C15 | `tests/layout.test.ts` `tup_15 the click stays on the beat start` | yes |
| C16 | `engine/src/engine.rs` `tup_16_trainer_counts_a_tuplet_bar_once` | yes |
| C17 | `engine/src/sequencer/pattern.rs` `tup_17_bar_holds_48_cells_and_pattern_192` | yes |
| C18 | `tests/display.test.ts` `tup_18 steps count cells over 192` | yes |
| C19 | `tests/app/session.test.ts` `tup_19 the 32-step signature rule stands with tuplets` | yes |
| C20 | `tests/app.test.ts` `tup_20 tuplet cells share a straight beat's width` | yes - grid spans in happy-dom; Chrome at 375 and 1280 px measured beat widths equal (224/224/224.1/224 and 148.1/148.2) |
| C21 | `tests/app.test.ts` `tup_21 tuplet beats carry 3 or 6` | yes |
| C22 | `tests/meter.test.ts` `tup_22 sustain follows the rule inside a tuplet beat` | yes |
| C23 | `tests/app.test.ts` `tup_23 tuplet slices sit at their time` | yes |
| C24 | `tests/app.test.ts` `tup_24 the lit beat follows a tuplet cell` | yes |
| C25 | `tests/app/session.test.ts` `tup_25 surviving beats keep their kind` | yes |
| C26 | `tests/app/session.test.ts` `tup_26 a /8 signature straightens every beat` | yes |
| C27 | `tests/app/session.test.ts` `tup_27 a saved tuplet preset reloads the same` | yes |
| C28 | `tests/preset.test.ts` `tup_28 an old preset loads straight and unchanged` | yes |
| C29 | `tests/app/session.test.ts` `tup_29 a saved groove keeps its beat cells` | yes |
| C30 | `tests/app/session.test.ts` `tup_30 a groove repeats beat by beat` | yes |
| C31 | `tests/app/session.test.ts` `tup_31 a tuplet groove lands straight in /8` | yes |
| C32 | `tests/songs.test.ts` `tup_32 Times Like These plays the 7/4 intro riff` | yes - against the fixture, which re-extracting the .gpx at HEAD reproduces exactly; it cannot catch a wrong GP6 drum map (see findings), though no wrong entry reaches measures 8-11 |
| C33 | `tests/songs.test.ts` `tup_33 Everlong plays the chorus` | yes - fixture equals a fresh extraction of the .gp at measure 64 |
| C34 | `tests/songs.test.ts` `tup_34 Ultimate Guitar sources name the file and measure` | yes |
| C35 | `tests/gpExtract.test.ts` `tup_35 reads drum measures from .gp and .gpx` | yes - but the GP6 case uses only elements 0, 1 and 10/0, and the BCFZ is literal-only (see findings) |
| C36 | `tests/tabToGrid.test.ts` `tup_36 a note between cells names its measure` | yes |
| C37 | `tests/songs.test.ts` `tup_37 no Guitar Pro file is tracked` | yes |
| C38 | walk - the user plays Times Like These and Everlong from Grooves | awaiting the user (TUP-38 is the user's ear, not the Verifier's) |
| C39 | `tests/app/session.test.ts` `tup_39 a tuplet figure outside /4 changes nothing` | yes |
| C40 | `engine/src/engine.rs` `tup_40_new_units_play_from_the_next_pass` | no - it measures the next pass from its own first onset (`let bar = next[0]`), so it passes while that downbeat comes a sixteenth early |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| A beat re-laid during playback jumps the pulse: the engine keeps `step_index` as a raw index, so every later cell of the pass shifts. The next downbeat comes 5512 samples (a sixteenth, 125 ms at 120 BPM) early, and C40's test cannot see it | Throwaway copy of `tup_40` at HEAD (same engine, same 60000-frame split, beat 2 → triplet while beat 3 plays): next onsets `[82688, 104738, 112088, 119438]`, ideal downbeat 88200. `engine/src/engine.rs:598` anchors on `next[0]`. Cause: `Pattern::set_step_units` keeps `step_index` unless it is past the end (`engine/src/sequencer/pattern.rs` `keep_step_in_pattern`) | When the units change, move `step_index` to the cell that starts at the same time from the bar start in the new layout (the old running sum of units up to `step_index`), and keep the partial wait. In `tup_40`, assert the next downbeat at `4 * beat` within 1 sample, not relative to `next[0]` | |
| `gp_extract.py`'s GP6 drum table is not alphaTab's, which Q18 settled ("the alphaTab table stands"), and no test would catch it: the songs test compares the song to the fixture, which already holds the mapped MIDI numbers | alphaTab `PercussionMapper.ts` `gp6ElementAndVariationToArticulation`: toms 5-9 → 43, 45, 47, 48, 50; 12 crash medium → 57; 13 crash high → 49; 15 ride (middle, edge, bell); 2-4 cowbells. `scripts/gp_extract.py` `GP6_DRUMS`: 5-8 → 41, 43, 45, 47 (each one tom low), 12 → 49 and 13 → 57 (swapped), 15/1 → 53 (bell) and 15/2 → 59 (edge) (swapped), 2 → 37 (side stick, not a cowbell). Times Like These measures 8-11 use only (0,0), (1,0), (10,0), (13,0) and (9,0); 13 lands on Crash under either table and 9 → 50 under both, so the shipped song is unaffected (re-extraction equals the fixture). The rest of the file uses (6,0), (8,0) and (15,0), which would map to the wrong tom on another stretch | Replace `GP6_DRUMS` with alphaTab's table, and give `tup_35`'s GP6 score notes on elements 5-9, 12, 13 and 15 with variations, asserting the track each lands on | |
| `tup_35` does not exercise BCFZ's copy runs, the branch every real `.gpx` relies on | `tests/gpExtract.test.ts` `bcfz()` writes literal runs only; the copy branch of `scripts/gp_extract.py` `bcfz` (reversed-bit offset and size) runs only on the real file, which is not in the repository. It does decode Times Like These correctly at HEAD | Add a synthetic BCFZ with at least one copy run (overlapping, offset < size) to `tup_35` | |

Suites at HEAD 3e9ec1a: js 602/602, rust 161 lib tests pass, mobile (Chrome) 31/31, `tests_kept.py js` 433/433 pass and keep their assertions, `tests_kept.py rust` 136/136.

Probed without finding, at HEAD: sextuplets on beats 1 and 3 with a triplet on beat 4 rendered by the engine over 2 bars (every onset within 0 samples of k/n of its beat); a 7/4 bar with sextuplets on beats 1 and 3 and a triplet on beat 7 (31 cells, units sum 28 × 12, contiguous spans, `locateCell`); a 4-bar preset with four different layouts through `normalizePreset` and `completeKit`, and a malformed layout falling back to bar 1; 4/4 → 3/4 dropping a triplet beat 4 while keeping a sextuplet beat 2, then 12/8; a groove saved from a 5/4 bar with a sextuplet beat 5, applied to 3/4 (straight) and 6/4 (beat 5 sextuplet, beat 6 = groove beat 1); a tuplet edit while playing sends the units first, then 13 grids of 15 cells; Chrome at 375 and 1280 px with a triplet and a sextuplet in the Editor (beats equal width, `3`/`6` labels drawn, page scroll width equal to the viewport, 17 Stadium slices per ring, no page errors). Kept-test rewrites in `tests/fixtures/tests_kept.py` stay within Q21 (holds_128_steps `[191]`, 2 worklet `192`, the wasm export name), Q22 (17 `/128` → `/192` denominators, nothing else), Q25 (counts 14 → 16, Rock lists, per-signature steps and click, Songsterr source for the 14 only, and the three renames that drop "fourteen"/"sixteen"), Q26 (hk_23's Mid/Low Tom statement) and AD-030 (link order, first screen); the only non-assertion change to a kept test is hk_23's hash map gaining the two new songs, which the kept `others` assertion requires. Mobile-app breaks no tuplets behaviour found.
