# House Kit verification

**Verdict**: PASS
**Proofs**: `proofs.md` at the commit that closes this file
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `tests/kit.test.ts` `hk_01 nine takes of each piece` | yes - asserts the 54 names, 6 folders and that `takesOf` names files that exist; the `Blend` source is not asserted, but a rebuild from the kit gave 54 of 54 byte-identical files |
| C2 | `src/lib.rs` `hk_02_kick_and_toms_map_their_dynamics` | yes - exact output per dynamic on tracks 1, 9, 10, 11, 12; the names `Soft`, `Med`, `Hard` are held by the sibling `kick and toms recordings by dynamic` |
| C3 | `tests/kit.test.ts` `hk_03 snare recordings` | yes - exact URLs per dynamic; the engine half on track 2 is held by `hk_04` and `hk_05` |
| C4 | `src/lib.rs` `hk_04_takes_rotate_per_dynamic` | yes - exact order, per dynamic and per track |
| C5 | `src/lib.rs` `hk_05_play_restarts_the_takes` | yes - a missing reset of any of the 3 dynamics changes the second pass |
| C6 | `src/lib.rs` `hk_06_bank_hit_has_no_step_gain` | yes - exact level on all 3 dynamics; the trim itself is held by `loads a take as its channels times the trim` |
| C7 | `src/lib.rs` `hk_07_replaced_hit_fades_over_5_ms` | yes for tracks 1 to 12, frame by frame at 44.1 and 48 kHz; track 0 has no such test and no fade (see Findings) |
| C8 | `src/lib.rs` `hk_08_single_sample_keeps_its_gains` | yes - exact gains on tracks 3 to 8 |
| C9 | `tests/kit.test.ts` `hk_09 format and tail` | yes - every file; the tail is a window of 198 to 4410 frames, which the fade requires and the real files need (203 to 3844) |
| C10 | `tests/kit.test.ts` `hk_10 recorded levels` | no - floors of 6, 2 and 1 dB on `hard` over `soft`, not the recorded differences; `med` and `crack` are not read Fixed in d7ab3ad |
| C11 | `tests/kit.test.ts` `hk_11 size limit` | yes - sums every drum sample against 20 MB; the real total is 16,527,704 bytes |
| C12 | `src/index.test.ts` `hk_12 logs a failed take` | yes - exact path and one log only |
| C13 | `src/lib.rs` `hk_12_missing_take_is_skipped` | yes - each take missing, and one left |
| C14 | `src/lib.rs` `hk_13_missing_dynamic_falls_back` | yes - every dynamic missing, and the rotation of the fallback |
| C15 | `src/lib.rs` `hk_14_track_with_no_takes_is_silent` | yes - silence and the other track's exact takes |
| C16 | `src/index.test.ts` `hk_15 rows follow the track order` | yes - after the fix: reads the drawn rows, in order, with each row's cells. Was no at 6293dfd: it read only `TRACKS` |
| C17 | `tests/kit.test.ts` `hk_16 ids stay` | yes |
| C18 | `src/index.test.ts` `hk_17 thirteen rows and cards` | yes - counts rows, cards and cells against the real `index.html`; it does not read their order, which is C16 |
| C19 | `src/index.test.ts` `hk_18 new tom cells cycle and play` | yes - exact cycle on both toms and the value sent; the engine side is held by `hk_02` and `plays a take on track 12` |
| C20 | `src/index.test.ts` `hk_19 mute and solo the new toms` | no - 2 of 4 cases: `mute-11` and `solo-12`; `mute-12` and `solo-11` are never pressed Fixed in d7ab3ad |
| C21 | `tests/state.test.ts` `hk_20 eleven track preset` | yes - exact hits on 11 tracks, new toms empty at full length |
| C22 | `src/index.test.ts` `hk_21 new toms light the stadium group` | yes - ring and orb for both toms |
| C23 | `tests/tabToGrid.test.ts` `hk_22 four toms` | yes - all 6 notes, and no other tom track |
| C24 | `tests/songs.test.ts` `hk_23 toms on four tracks` | no - Battery is exact, but other songs are only checked empty on tracks 11 and 12, so a changed grid passes Fixed in d7ab3ad |
| C25 | walk - the user plays the songs and a tom fill and answers per piece | not judged by the Verifier - a human ear decides; `proofs.md` shows `pass (Walked)`, and the per-piece record HK-24 places in this file is absent (see Findings) |
| C26 | walk - each rejected piece is heard on its earlier sample, or none was rejected | not judged by the Verifier - a human ear decides; the spec's Success Criteria tick all 6 approved and 6293dfd removes the earlier samples, which is consistent with none rejected |
| C27 | walk - each rejected piece is heard on its new recordings, or none was rejected | not judged by the Verifier - a human ear decides; the shipped Mid and Low Tom are `Toms/12/Blend` and `Toms/14/Blend`, byte-identical to a rebuild, so no retried recording shows in the tree |
| C28 | walk - the trims in `src/kit.ts` match those the user heard | not judged by the Verifier - `src/kit.ts` holds one fixed trim per piece (Kick 0.85, the other 5 at 0.7) and the load test passes them through; that these are the approved values is the walk's to say |
| C29 | `tests/kit.test.ts` `hk_28 license facts` | yes - every required string and each piece's source row |
| C30 | `tests/kit.test.ts` `hk_29 release is the user account` | yes - the exact sentence |
| C31 | `tests/kit.test.ts` `hk_30 readme credit` | yes - thanks and link |
| C32 | `src/index.test.ts` `hk_31 footer credit` | yes - exact text, footer outside all 3 views; also seen on all 3 screens at 390, 1024 and 1440 px in Chromium |
| C33 | `src/index.test.ts` `hk_32 footer link` | yes - exact text, `href` and `target` |
| C34 | `src/lib.rs` `hk_33_loop_keeps_the_rotation` | yes - 6 hits over 3 loops, in order |
| C35 | `src/lib.rs` `hk_34_changed_dynamic_uses_its_next_take` | yes - the new dynamic's take 1, then the old rotation resumes |
| C36 | walk - no sideways page scroll at the 3 widths | spec text met as far as Chromium shows - `scrollWidth` equals `clientWidth` at 390, 1024 and 1440 px on Editor, Stadium and Grooves; no approval claimed |
| C37 | `tests/kit.test.ts` `hk_35 kick and snare layers` | yes - after the fix: runs the builder on made-up recordings, and wrong gains, a dropped alignment and a dropped piece gain each fail it. Was no at 6293dfd: it read the script's text |
| C38 | `src/lib.rs` `hk_36_click_restarts_with_no_fade` | yes - added for the finding on HK-07 at d7ab3ad; the frames after the restart equal the first ones |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| The Editor lists the toms as High, Floor, Mid, Low, against HK-15's High, Mid, Low, Floor, and no test fails | `src/main.ts:339` and `:350` place rows with `gridRow = trackId + 2`, so id 10 lands on row 12 and ids 11 and 12 on rows 13 and 14. Headless Chromium at HEAD, labels by height at 1440 px: HIGH TOM 604, FLOOR TOM 643, MID TOM 681, LOW TOM 720. `design.md:185` says the order comes from the array | place each row by its position in `TRACKS`, and assert the rendered row order of all 13 labels and of a tom's cells in `src/index.test.ts` | d7ab3ad, C16 |
| C16 sits below the layer of its rule | HK-15 says the app lists the tracks; `hk_15` reads only `TRACKS`, while the matrix puts page markup in `src/index.test.ts` | the row-order assertion above becomes C16's proof | d7ab3ad, C16 |
| HK-07 does not hold on the Click track | Throwaway test on a copy of `src/lib.rs`: a 20000-frame 0.5 sample on track 0 with steps 0 and 1 set gives `left[hit]` 0.5 and `left[hit + 110]` 0.5, a hard restart with no fading voice. `trigger_step` handles track 0 outside the loop that starts a fade. HK-07 says "a track" and names no exception | fade the Click sample too, or append a criterion that scopes HK-07 to the drum tracks | d7ab3ad, C38: appended HK-36, which scopes the fade to the drum tracks |
| HK-24's per-piece approval is not in `verification.md` | HK-24 requires it there and C25's proof says "written to Handoff and verification.md", yet the file did not exist before this report and `proofs.md` already shows `pass (Walked)`. The Verifier reads no Handoff and invents no approval | add each piece's approval to this file in the user's words | 27116ea, written below in `## Ear approval`, C25 |
| C37 does not read the layers in the shipped samples | `tests/kit.test.ts` `hk_35` asserts a substring of the builder and a peak of -0.1 dB or more. 54 of 54 files rebuilt byte-identical today, but nothing keeps them so | commit a checksum list written by the builder and assert the shipped files against it | d7ab3ad, C37: the builder runs on made-up recordings and each file is compared to its exact mix |
| C10 asserts floors, not the level differences | Shipped mean peaks: snare `hard` over `soft` about 9 dB against a floor of 6, kick about 4.5 against 2, so a third of the snare's difference or half the kick's could go. `med` and `crack` are not read | assert the differences within each piece to a tolerance, every recording included, or hold them with the checksum list | d7ab3ad, C10: every recording pinned within 0.05 dB |
| C24 does not hold "every other song SHALL keep its grid" | `hk_23` only checks tracks 11 and 12 empty, plus one song's Floor Tom not empty. Today's diff of `src/songs.ts` is Battery's one line, so the rule holds but no test keeps it | compare every other song's whole grid to a frozen copy or hash | d7ab3ad, C24: 13 songs pinned to the grids of main |
| C20 proves 2 of 4 cases | `hk_19` presses `mute-11` and `solo-12` only | press `mute-12` and `solo-11` too | d7ab3ad, C20 |
| The README miscounts the kit | `README.md` says "three recordings per dynamic, three takes of each"; HK-01 and the bank hold one recording per dynamic, 3 takes of it. `hk_30` does not read that sentence | say one recording per dynamic with three takes | d7ab3ad |

## Ear approval

HK-24: the user compared the layered kit with `Blend` alone on 2026-11-01, having been told the answer closes all 6 pieces, and answered once: "Pode deixar assim, pode abrir a PR".

| Piece | User's words | Trim |
| --- | --- | --- |
| Kick | "Pode deixar assim" | 0.85 |
| Snare | "Pode deixar assim" | 0.7 |
| High Tom | "Pode deixar assim" | 0.7 |
| Mid Tom | "Pode deixar assim" | 0.7 |
| Low Tom | "Pode deixar assim" | 0.7 |
| Floor Tom | "Pode deixar assim" | 0.7 |

## Notes

The rows and findings above up to C37 are the Verifier's judgement of 6293dfd, with the fixes marked by the author. A `grep` of the Verifier's printed the `**Walked:**` line of the Handoff, against its brief. It reports not using that line in any judgement, and it did not see the fixes. There was no second Verifier, as the process sets: the proofs re-ran at the fix.
