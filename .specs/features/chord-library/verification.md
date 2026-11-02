# Chord Library verification

**Verdict**: PASS after fixes. Round 1 was FAIL with 7 findings, all closed below. The fixes and C37 had no second Verifier, as the process sets
**Proofs**: `proofs.md` at 29a8e67
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `tests/chords.test.ts` `chd_01 offers 408 chords` | yes - 12, 34, and 408 distinct names |
| C2 | `tests/chords.test.ts` `chd_02 semitones of each type` | yes - whole table by exact value; my parse of the spec's table matches `CHORD_TYPES` row by row |
| C3 | `tests/chords.test.ts` `chd_03 voices every root` | yes - all 408 by exact MIDI, top note 77 |
| C4 | `tests/chords.test.ts` `chd_04 spells the new chords` | no - exact spelling on 13 chords, 12 of them on C; the 408 sweep compares pitch only, so a wrong letter passes |
| C5 | `tests/chords.test.ts` `chd_05 keeps the old types` | no - notes and names hold, but spelling is read on 4 chords of 168; 10 old types can change spelling with this test green |
| C6 | `src/pad.rs` `chd_06_every_orchestra_note_has_its_file` | yes - every note with its bass, real bank, key within 2 |
| C7 | `src/pad.rs` `tim_16_notes_within_5_cents` | yes - 45 to 77 in the 4 timbres, dry at 5 cents and heard at 5, 7 on 71 alone. It holds CHD-07 only as edited: see the finding on CHD-07 |
| C8 | `tests/fixtures/orchestra_bank_check.py --pitch` | yes - shipped files, on a proved meter; it reads the 14 keys, and my example through the engine reads notes 72 to 77 at 0.4 to 0.9 cents |
| C9 | `src/pad.rs` `tim_18_chords_match_within_3_db` | yes - 408 asserted, real files, power and sum |
| C10 | `src/pad.rs` `tim_19_timbres_match_within_3_db` | yes - each of the 408 across the 5 timbres |
| C11 | `src/pad.rs` `tim_20_default_peak` | yes - -4 dBFS as AD-022 sets, on the 408 held and on crossfades |
| C12 | `tests/padBank.test.ts` `tim_36 size limit` | yes - 12,000,000 bytes as a bound, and every listed file must exist; the folder holds about 11.8 MB |
| C13 | `tests/padBank.test.ts` `tim_40 license lists each file` | no - reads Choir, Sweep and Orchestra only, so `pads/new-age/E5.flac`, one of the 3 new files, is outside it |
| C14 | `src/pad.rs` `tim_23_no_allocation` | yes - it plays 7 notes, the most a chord reaches, and nothing on the path depends on which notes; `top_note_gain` is arithmetic |
| C15 | `src/index.test.ts` `chd_15 lists the roots` | yes - exact list in order |
| C16 | `src/index.test.ts` `chd_16 groups the types` | yes - headings, counts per family, and one family by name; with `chd_17`'s order that pins membership |
| C17 | `src/index.test.ts` `chd_17 labels the types` | yes |
| C18 | `src/index.test.ts` `chd_18 opens on C major` | yes - two marks, no play, `No chord playing` |
| C19 | `src/index.test.ts` `chd_19 root plays the selected type` | no - the selected type is the default `maj`, so it passes if a root click with no chord always plays major |
| C20 | `src/index.test.ts` `chd_20 type plays on the selected root` | no - the selected root is the default `C`, so it passes if a type click with no chord always plays on C |
| C21 | `src/index.test.ts` `chd_21 another root keeps the type` | yes - exact notes, no stop sent |
| C22 | `src/index.test.ts` `chd_22 another type keeps the root` | yes - exact notes, no stop sent |
| C23 | `src/index.test.ts` `chd_23 the sounding root or type stops it` | yes - root and type each; the 1.5 s fade is the engine's, under the `chord-pads` tests |
| C24 | `src/index.test.ts` `chd_24 marks the sounding chord` | yes - both marks, `aria-pressed`, name and notes |
| C25 | `src/index.test.ts` `chd_25 marks the selection` | yes - and `src/index.css` gives `selected` and `sounding` distinct styles |
| C26 | `src/index.test.ts` `chd_26 keeps the selection after a stop` | yes - also a click after the stop plays `Eb13` |
| C27 | `src/index.test.ts` `chd_27 uses real buttons` | yes - no key handler exists in `src/` or `index.html` to take Enter or Space from a native button |
| C28 | walk | yes - the Walked line settles it at 1280 px; my own Chrome run reads scrollWidth 1280 = clientWidth 1280 |
| C29 | walk | yes at 390 px, as walked and as my run reads; 767 px also holds. 320 px does not: see the finding on it |
| C30 | walk | yes - the Walked line settles it, the CSS sets 44 px below 768 px, and my run reads 44 px at 320, 390 and 767 |
| C31 | walk | yes - the user, in the running app at 93831af: "aprovado". 29a8e67 differs from 93831af only in `spec.md` and `tasks.md` |
| C32 | walk | yes - the Walked line records no rejection, so nothing had to be offered again |
| C33 | `src/index.test.ts` `chd_33 settles on the last chord` | yes - mixed root and type clicks, one chord sent |
| C34 | `src/index.test.ts` `chd_34 a timbre pick replays a new chord` | yes - exact notes with bass, timbre id, no stop |
| C35 | `src/index.test.ts` `chd_35 resumes audio within the click` | yes - type and root, synchronously |
| C36 | `src/index.test.ts` `chd_36 click during a fade` | yes - type click; my example clicks the fading chord's own root and it plays again rather than stopping |
| C37 | `src/pad.rs` `tim_16_notes_within_5_cents` | added after the report, for the finding on CHD-07; not judged by the Verifier |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Grooves lost its narrow padding, a regression no check names | `src/index.css:1742`: the new rules went between `#grooves-view,` and `#improv-view`, so `#grooves-view` joined the `header` selector and fell out of `padding: 1rem`. In Chrome at 320, 390 and 767 px, `#grooves-view` padding reads 24px; with the stylesheet of 7e3ce19 it reads 16px | Put `#grooves-view,` back directly above `#improv-view`, and leave the `header` rule on its own | 69ceb1c: `#grooves-view` is back on the padding rule, measured 16 px at 320, 390 and 767 px in Chrome |
| CHD-29 breaks at 320 px with a classic scrollbar | My example, not named by the spec or checks: at a 320 px iframe, scrollWidth 308 > clientWidth 305, so the page scrolls 3 px sideways. The overflow is `.view-nav` and `#nav-improv`, and it predates this feature: Grooves reads 308 with the old stylesheet too. A phone's overlay scrollbar leaves 320 px, so it needs a viewport under 308 px or a 15 px scrollbar. Web fonts were not confirmed loaded in this run | Let the nav wrap or shrink below 768 px, or give CHD-29 a stated lowest width through a new requirement | 69ceb1c, C29: the nav wraps, measured scrollWidth = clientWidth at 320 px with a classic scrollbar on Improv and Grooves |
| C4 does not hold spelling by degree on the 408 | Throwaway mutation: spelling every degree of 9 or more on a root other than C from `ROOTS` leaves all 18 tests of `tests/chords.test.ts` green, so `F#9` could read `Ab` for `G#`. The code is right at HEAD: my independent speller agrees on all 408, and all 26 double accidentals land on natural notes | Assert letter and accidental for all 408 from the degrees in `chd_04`, with `pitchOf` kept as the second check | d79895e, C4: all 408 are read by the letter of their degree, with literal spellings on 5 other roots |
| C5 does not hold the spelling of the 14 old types | Throwaway mutation: `6` degrees set to `1 3 5 7` leaves `chd_05` green; `chd_02` and `pad_34` catch it. The code is right at HEAD: names, notes and spelling of all 168 equal 7e3ce19 exactly | Pin the spelling of all 168 in `chd_05`, or name `pad_34` as a second proof with its list widened | d79895e, C5: name, spelling and notes of the 168 chords are frozen by a hash taken from 7e3ce19's code |
| C19 and C20 prove their rule only on the default selection | Throwaway mutations: a root or type click with no chord built from the default C major, not `selectedChord`, leaves `chd_19` and `chd_20` green. `chd_26` catches the first, and `chd_33` and `chd_36` the second, so the rule holds but not under its own proof | Select a type other than `maj` before the click in `chd_19`, and a root other than `C` in `chd_20`, with a stop between | d79895e, C19 and C20: each test now moves the selection away from `C` and `maj` first |
| C13 cannot see the New Age file | Throwaway mutation: deleting the `pads/new-age/E5.flac` row from `LICENSE.md` leaves `tim_40` green; `pad_55` catches it. CHD-13 holds at HEAD, and New Age's CC0 is read by `pad_21` | Add New Age to `tim_40`, or name `pad_55` and `pad_21` as proofs of C13. C13's "the new file" should read 3 files | d79895e, C13: `tim_40` reads New Age too |
| CHD-07 was edited after approval to fit the test | 29a8e67 rewrites approved CHD-07 to add 7 cents on note 71, while `tim_16` already used 7 at 2787ef7. The approved 5 cents fails: note 71 is heard at -6.01 in Analog and -5.22 in New Age. `validate.md` appends a new requirement and "never edits an approved one". The only answer given is "aprovado", which does not name the bound, so I cannot confirm the assumption row's "presented at T7". The row and `src/pad.rs` also say 0.5 cents leaving the voice; I read 0.51 in New Age and 0.76 in Sweep, inside the 5 cents the test asserts | Restore CHD-07, append the exception under a new requirement ID with its own check, confirm the user was shown the 7 cents, and correct the 0.5 | 3adde06, C37: CHD-07 keeps its approved text, and CHD-37 with AD-024 holds the 7 cents. `tim_16`'s comment and the spec now say 1 cent. The user was told of this bound in the message before their "aprovado" at T7 |
