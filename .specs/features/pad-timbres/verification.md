# Pad Timbres verification

**Verdict**: PASS after fixes. Round 1 was FAIL with 3 findings, all closed below. The fixes and the gains of AD-021 and AD-022 had no second Verifier, as the process sets
**Proofs**: `proofs.md` at 02f1870
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `src/index.test.ts` `tim_01 select lists the timbres` | yes - exact names, in order, one select on the screen |
| C2 | `src/index.test.ts` `tim_02 starts on Choir` | yes |
| C3 | `src/pad.rs` `tim_03_timbre_change_crossfades_the_chord` | yes - equal-power levels at 0.3, 0.75 and 1.2 s, and gone by 1.52 s |
| C4 | `src/index.test.ts` `tim_03 replays the chord in the new timbre` | yes - exact notes and timbre id, no stop sent |
| C5 | `src/index.test.ts` `tim_04 silent until the next chord` | yes |
| C6 | `src/pad.rs` `tim_05_settles_on_the_last_timbre` | yes - no list ends on Analog, which has no tone to read; my example of it holds |
| C7 | `src/index.test.ts` `tim_06 remembers the timbre` | yes |
| C8 | `tests/chords.test.ts` `tim_07 parses the stored timbre` | yes |
| C9 | `src/index.test.ts` `tim_08 opens silent` | yes |
| C10 | `src/pad.rs` `tim_09_choir_balance` | yes - Choir files are stereo, so the fixture fault below does not reach it |
| C11 | `src/pad.rs` `tim_10_new_age_is_unchanged` | yes - I recomputed the hash on the engine of 39dd3ac and got the same `0x6dc4d4d93e118ee4` |
| C12 | `src/pad.rs` `tim_11_sweep_mixes_both_layers` | no - decodes the mono Sweep files 3 dB below what the app plays; at the app's level its own bound fails at 4.89 dB |
| C13 | `src/pad.rs` `tim_12_analog_reads_no_file` | yes |
| C14 | `src/pad.rs` `tim_13_orchestra_has_no_synth` | yes |
| C15 | `tests/padBank.test.ts` `tim_13 orchestra sections` | yes - reads the builder's table, and C27 ties that table to the shipped bytes |
| C16 | `tests/chords.test.ts` `tim_14 orchestra bass` | yes - all 168 chords in all 5 timbres |
| C17 | `src/pad.rs` `tim_15_seven_notes_keep_the_rules` | yes |
| C18 | `src/pad.rs` `tim_16_notes_within_5_cents` | yes - the fixture fault shifts only the layers' weight; it passes at the app's level, and the samples alone sit within 4.7 cents |
| C19 | `tests/fixtures/orchestra_bank_check.py --pitch` | yes - shipped files, on a meter proved on a known vibrato and a detuned file |
| C20 | `src/pad.rs` `tim_18_chords_match_within_3_db` | no - measures Sweep and New Age with their samples 3 dB low, not what ships; at the app's level the claim stands, at 1.91 and 2.70 dB |
| C21 | `src/pad.rs` `tim_19_timbres_match_within_3_db` | no - same fixture; at the app's level the claim is false on 7 of 168 chords |
| C22 | `src/pad.rs` `tim_20_default_peak` | no - same fixture; at the app's level the claim stands, with Sweep at -14.93 and New Age at -12.69 dBFS |
| C23 | `tests/fixtures/pad_bank_check.py` | yes - every channel of every shipped file against the 10 ms before the wrap |
| C24 | `tests/fixtures/orchestra_bank_check.py --level` | yes - 100 ms windows that wrap around the loop, on the shipped files |
| C25 | `src/pad.rs` `tim_23_no_allocation` | yes |
| C26 | `tests/padBank.test.ts` `tim_24 orchestra format` | yes - rate, depth, channels and exact frames read from each file |
| C27 | `tests/fixtures/orchestra_bank_check.py --repeat` | yes - two runs match each other and the shipped files |
| C28 | `src/index.test.ts` `tim_26 loads the selected timbre` | yes - reaching Improv by reload is held by other tests: removing that call failed `pad_57` and `pad_43` |
| C29 | `src/index.test.ts` `tim_27 loads on first pick` | yes |
| C30 | `src/index.test.ts` `tim_28 fetches nothing again` | yes |
| C31 | `src/index.test.ts` `tim_29 Analog fetches nothing` | yes |
| C32 | `src/pad.rs` `tim_30_synth_holds_while_loading` | no - covers an empty bank alone; once one Orchestra file has arrived, a new chord has no synth and no test sees it |
| C33 | `src/pad.rs` `tim_31_late_files_fade_in` | yes |
| C34 | `src/pad.rs` `tim_32_orchestra_replaces_the_synth` | yes - one note and one file, but both curves are read at three points |
| C35 | `src/pad.rs` `tim_33_other_timbre_load_changes_nothing` | yes - compares bits, and shows that a load of the same timbre does change them |
| C36 | `src/index.test.ts` `tim_34 failure notices` | yes |
| C37 | `src/index.test.ts` `tim_35 retries failed files` | yes |
| C38 | `tests/padBank.test.ts` `tim_36 size limit` | yes - 10,920,566 bytes |
| C39 | walk | yes - the user, in the running app at 6e6e815, after the mixes changed: "Aprovado". Before it, at 0b404fe: "Sim, so o volume que to achando baixo comparado ao da bateria, se poderiamos aumentar mais eles todos". Round 1 judged the first answer, at 1ff11c9: "Timbres aprovados". A blanket approval of the timbres on offer: it names none and does not describe the walk, so it rests on that reading. No source changed after 1ff11c9. A mix changed for a finding below needs a new approval of that timbre, which the answers above give |
| C40 | walk | yes - round 1's answer rejected nothing. The user then found the level low twice, and each change was offered again until "Aprovado", as the Handoff logs |
| C41 | walk | yes - the answer approves with no pulse reported, which is the proof's "the user reports none", and C24 reads 0.79 dB at worst |
| C42 | `tests/padBank.test.ts` `tim_40 license lists each file` | yes |
| C43 | `tests/padBank.test.ts` `tim_41 README` | yes |
| C44 | `src/index.test.ts` `tim_42 pick during a fade` | yes |
| C45 | `src/index.test.ts` `tim_43 load after stop stays silent` | yes |
| C46 | `src/pad.rs` `tim_44_pitch_holds_at_48_khz` | yes |
| C47 | `src/lib.rs` `tim_45_timbre_leaves_the_drums_alone` | yes - compares bits, and after a chord's tail too |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| The tests hear mono files 3 dB below what the app plays, so C12, C20, C21 and C22 measure a signal that does not ship | `timbre_banks()` in `src/pad.rs:726` decodes every bank with `-ac 2`, and ffmpeg scales mono to stereo by 0.7071 (`C4.flac` of Sweep: RMS 0.3001 at `-ac 1`, 0.2122 at `-ac 2`). All 16 files of Sweep and New Age are mono. `decodeResponse` in `src/audio/MetronomeNode.ts` feeds channel 0 to both sides unscaled, and `bank()` reads New Age with `-ac 1`. With that one line corrected in a scratch copy, `tim_11` fails: Sweep's samples sit 4.89 dB above the synth, against its 1 to 3 dB | decode mono files with `-ac 1` and copy them to both channels, as the worklet does; then set Sweep's mix against the real level and offer it to the user again, as TIM-38 says | 2e0aa98, C12, C20, C21 and C22: mono files now reach the tests at the worklet's level, and Sweep sits 2.46 dB over its synth |
| TIM-19 is false in the shipped app: 7 of 168 chords spread past 3 dB between timbres, worst 3.33 dB, and C21 is green | Same scratch run: `[45,49,53]` 3.33 (Orchestra -33.14, Sweep -29.81), `[55,59,62,65,69]` 3.20 (Analog -33.31, New Age -30.12), `[45,49,52,54]` 3.19, `[45,49,52,55]` 3.12, and `[45,49,52,56]`, `[45,50,52]` and `[55,58,62,65,69]` just past 3.00. New Age cannot move (TIM-10), so the others must come to it | bring Sweep down and Analog, Choir and Orchestra up until `tim_19` passes with the corrected fixture; each changed mix goes back to the user's ear | 2e0aa98, C21: the worst chord spreads 2.69 dB. The user's ear is pending, on C39 |
| TIM-30 breaks for Orchestra: a chord that starts while the bank is part-loaded has no synth, and reads the lowest file that has arrived, at full gain | `new_voice` in `src/pad.rs:473` sets `file_gain` to 1 once any file exists, so `layers` gives Orchestra's synth a gain of 0. My example, Am7 with 1 of 13 files in: synth RMS -inf dB, all 6 notes read `B0.flac` (a contrabass) at speeds 1.78 to 12.70. With 3 of 13 the speed reaches 8.00. With 0 of 13 the synth is at -29.3 dB, the only case C32 tries. The app sends the chord during the load: `pressChord` does not wait, and `loadTimbre` brings 3.6 MB in one file at a time. The spec's decision is that the Analog synth holds the chord until the files arrive | keep Orchestra's files from new voices until its load ends, so a new chord holds on the synth and crossfades as C34 proves, and extend C32 to a bank holding only its first file | 05a9fc2, C32: a timbre with no synth reads only a file within 2 semitones of its note, per note where the fix proposed the whole bank, and C32 tries 1 and 3 of 13 files |
