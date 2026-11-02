# Chord Pads verification

**Verdict**: PASS
**Proofs**: `proofs.md` at the commit that closes the findings
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `tests/chords.test.ts` `pad_01 offers 168 chords` | yes |
| C2 | `tests/chords.test.ts` `pad_02 semitones of each type` | yes - all 14 types on all 12 roots, against the spec's own table |
| C3 | `tests/chords.test.ts` `pad_03 voices every root in range` | yes - exact MIDI per root in C2's test as well |
| C4 | `src/pad.rs` `pad_04_first_chord_fades_in_over_1_5_s` | yes - a 1.7 s start fade fails it; a 1.55 s constant passes it alone, and C9 and C10 fail that one |
| C5 | `src/pad.rs` `pad_05_held_chord_never_ends` | yes for no end and no silent frame; a sample layer frozen at its loop end passes it (the synth keeps sounding, within its 9 dB bound), and C16, C22 and C31 fail that case |
| C6 | `src/pad.rs` `pad_06_loop_wrap_adds_no_step` | yes - a wrap 300 frames off fails it. Keys and key + 1 only, at 44.1 kHz; `wraps` is computed, not observed |
| C7 | `tests/fixtures/pad_bank_check.py` | yes - reads PAD_BANK and the real files |
| C8 | `src/pad.rs` `pad_07_notes_within_5_cents` | yes - 6 cents sharp fails it on either layer. The sample half uses sine stand-ins, so the shipped files' own tuning is not asserted; own probe found it within 5 cents |
| C9 | `src/pad.rs` `pad_08_crossfades_over_1_5_s` | yes |
| C10 | `src/pad.rs` `pad_09_stop_fades_over_1_5_s` | yes |
| C11 | `tests/chords.test.ts` `pad_09 the same chord stops` | yes - the page wiring is held by `pad_33 idle text` |
| C12 | `src/pad.rs` `pad_10_settles_on_the_last_chord` | yes |
| C13 | `src/pad.rs` `pad_11_fade_continues_from_its_level` | yes |
| C14 | `src/pad.rs` `pad_12_at_most_3_chords` | no - holds the cap of 3, not the 20 ms: `EVICTION_SECONDS` of 0.015 and 0.03 both pass |
| C15 | `src/pad.rs` `pad_13_one_chord_after_fades` | yes |
| C16 | `src/pad.rs` `pad_14_chords_match_within_3_db` | yes - all 168 with the bank. Synth alone is one pair; own probe measured all 168 at 2.53 dB |
| C17 | `src/index.test.ts` `pad_15 chord does not wait for the kit` | yes |
| C18 | `src/index.test.ts` `pad_16 engine failure` | yes |
| C19 | `src/pad.rs` `pad_17_note_mixes_both_layers` | yes |
| C20 | `src/pad.rs` `pad_18_synth_detunes_and_filters` | yes |
| C21 | `src/pad.rs` `pad_19_output_is_stereo` | yes |
| C22 | `src/pad.rs` `pad_20_layer_balance` | no - one chord of 168 (`C7M(9)`, +1.86 dB); 81 of 168 sit outside 1 to 3 dB |
| C23 | `tests/padBank.test.ts` `pad_21 files and license` | yes - own fetch: all 8 SHA-256 prefixes match FreePats `master`, and its `README.txt` states CC0 |
| C24 | `tests/padBank.test.ts` `pad_22 size limit` | yes |
| C25 | `src/lib.rs` `pad_23_sounds_while_stopped` | yes |
| C26 | `tests/wasm.test.ts` `pad_23 renders while stopped` | yes - a rebuild of HEAD is byte-identical to the shipped `.wasm` |
| C27 | `src/lib.rs` `pad_24_play_and_stop_keep_the_pad` | yes - bit-exact against an untouched engine |
| C28 | `src/index.test.ts` `pad_24 transport sends no pad command` | yes |
| C29 | `src/index.test.ts` `pad_25 loading a pattern sends no pad command` | yes - the selectors only, not the Grooves cards; only `pressChord` and Stop reach `padPlay` or `padStop` |
| C30 | `src/index.test.ts` `pad_26 screens send no pad command` | yes |
| C31 | `src/pad.rs` `pad_27_default_peak` | yes - all 168 with the bank. Own probes: -12.69 dBFS over 180 s, and at most -15.8 dBFS under clicks 0.05 to 1 s apart |
| C32 | `src/lib.rs` `pad_28_hits_keep_their_time` | yes |
| C33 | `src/lib.rs` `pad_29_silent_pad_changes_nothing` | yes - own run of `drum_session` on `src/lib.rs` at 4aaa5d4 gave the same hash |
| C34 | `src/index.test.ts` `pad_30 link and title` | yes |
| C35 | `src/index.test.ts` `pad_31 grid of 168 buttons` | yes |
| C36 | `src/index.test.ts` `pad_32 shows the sounding chord` | yes |
| C37 | `src/index.test.ts` `pad_33 idle text` | yes |
| C38 | `tests/chords.test.ts` `pad_34 spelling` | yes - own enumeration: 5 of 168 chords replace a double, all with a natural note |
| C39 | `src/index.test.ts` `pad_35 stop button` | yes |
| C40 | `src/index.test.ts` `pad_36 stop disabled` | yes |
| C41 | walk - The user holds chords alone and with a groove, and their answer is quoted in `verification.md` | walk - `pass (Walked)` in `proofs.md`, not judged here; the quote is still owed (see Findings) |
| C42 | walk - Each rejection is logged with its change in the Handoff, until the user approves | walk - `pass (Walked)` in `proofs.md`, not judged here |
| C43 | `src/pad.rs` `pad_39_fading_chord_returns` | yes |
| C44 | `src/index.test.ts` `pad_40 link dot` | yes |
| C45 | walk - At 390 px the grid scrolls, the root column stays, and the page width equals the window | walk - `pass (Walked)` in `proofs.md`, not judged here |
| C46 | `src/pad.rs` `pad_42_volume_has_no_click` | yes |
| C47 | `src/index.test.ts` `pad_42 volume control` | yes |
| C48 | `src/index.test.ts` `pad_43 remembers the volume` | yes |
| C49 | `tests/chords.test.ts` `pad_44 parses the volume` | yes |
| C50 | `src/index.test.ts` `pad_45 opens silent` | yes |
| C51 | `src/index.test.ts` `pad_46 loads on first open` | yes |
| C52 | `src/index.test.ts` `pad_47 loads nothing before` | yes |
| C53 | `src/pad.rs` `pad_48_synth_sounds_without_samples` | yes |
| C54 | `src/pad.rs` `pad_49_late_samples_fade_in` | yes |
| C55 | `src/index.test.ts` `pad_50 logs a failed file` | yes |
| C56 | `src/pad.rs` `pad_50_nearest_loaded_file` | yes |
| C57 | `src/index.test.ts` `pad_51 failure notices` | yes |
| C58 | `src/pad.rs` `pad_52_synth_alone` | yes |
| C59 | `src/index.test.ts` `pad_53 retries failed files` | yes |
| C60 | `tests/padBank.test.ts` `pad_54 README` | yes |
| C61 | `tests/padBank.test.ts` `pad_55 license lists each file` | yes |
| C62 | `src/index.test.ts` `pad_56 resumes audio` | yes |
| C63 | `src/index.test.ts` `pad_57 saved screen` | yes |
| C64 | `src/pad.rs` `pad_58_pitch_holds_at_48_khz` | yes - `MetronomeNode` also asks for a 44.1 kHz context, so this path is the fallback |
| C65 | `src/pad.rs` `pad_59_no_allocation` | yes |
| C66 | `src/pad.rs` `pad_12_eviction_takes_20_ms` | added in the fix pass, after the Verifier; judged by the author, not by the Verifier |
| C67 | `src/pad.rs` `pad_60_balance_across_every_chord` | added in the fix pass, after the Verifier; judged by the author, not by the Verifier |
| C68 | `src/pad.rs` `pad_61_load_clamps_a_loop_end_past_the_file` | added in the fix pass, after the Verifier; judged by the author, not by the Verifier |
| C69 | `src/pad.rs` `pad_61_load_refuses_an_empty_loop` | added in the fix pass, after the Verifier; judged by the author, not by the Verifier |

## Owner approval

PAD-37, in the running app, 2026-11-02. On hearing the pad, the user: "Gostei, o som do pad hoje tem esse choir". Asked "posso registrar sua frase como a aprovação de ouvido do New Age (PAD-37), mantendo o som como está?", with the recommendation "Sim, se nada disso te incomodou", the user answered: "o que mais gostei foi esse timbre-synth-pad-choir-Cmaj9, mas se tiver string tipo orquestra ou quarteto de cordas ia ficar mais legal. resto recomendacoes".

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| PAD-20's balance holds on about half the chords, and C22 proves it on one. The sample layer falls below the synth on some chords | Measured as `pad_20_layer_balance` does: over 24 s, `C7M(9)` +1.86 dB, `Asus2` (45 47 52) -2.05 dB, `Gaug` (55 59 63) +3.84 dB. Over 12 s, 87 of 168 chords are inside 1 to 3 dB | Decide what "about 2 dB" covers. Either balance the layers per note, or append a criterion that fixes the range the owner approved. Then assert it on all 168 chords | 430d4c6, C67: PAD-60 holds all 168 chords at -2.5 to +4.5 dB, the sound the user heard; measured -2.0 to +4.0, median +1.6 |
| C14 does not hold PAD-12's 20 ms | `src/pad.rs` `pad_12_at_most_3_chords` asserts level 0 in a 20 ms window centred on 1.385 s. `EVICTION_SECONDS` of 0.015 and 0.03 pass; 0.012 and 0.04 fail. `fade_step` is also a fixed rate, so a chord at level 0.7 leaves in 14 ms | Measure the eviction directly, from a chord at level 1, and at the level the test uses. If 20 ms is a duration, derive the step from the current level | 430d4c6, C66: the step comes from the level at eviction, proved at 3 levels, and a later click does not restart it |
| PAD-37's approval is not quoted in this file | C41's proof and PAD-37 require the owner's answer here. This Verifier does not read the Handoff, and the commit `bc0e593` only reports the approval, without its words | Quote the owner's answer verbatim in this file | a8730ac: quoted under `## Owner approval`, C41 |
| `Pad::load` has a rule with no test | `src/pad.rs:354-357` clamps `loop_end` and refuses a bad loop, to keep the audio thread from an out-of-bounds read. With those lines removed, all 109 `cargo test --lib` tests still pass; no test passes such a loop | Add a test with `loop_end` past the file and with `loop_start >= loop_end` | 430d4c6, C68 and C69: PAD-61 |
