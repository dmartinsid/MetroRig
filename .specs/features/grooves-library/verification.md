# Grooves Library verification

**Verdict**: PASS
**Proofs**: the Verifier judged `proofs.md` at aae0fa3 and returned FAIL. Every finding is closed below and the current `proofs.md` passes. `cb580c1` (the earlier kick, snare and hi-hat) and `d3baa4b` (the ring separators) came after that judgement, at the user's request, and no second Verifier read them.
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `captures/editor.running.png` against `captures/editor.png` | judged by screens.md |
| C2 | `src/index.test.ts` `nav_02 editor link` | yes |
| C3 | `captures/stadium.running.png` against `captures/stadium.png` | judged by screens.md |
| C4 | `src/index.test.ts` `nav_04 grooves link` | yes |
| C5 | `src/index.test.ts` `nav_05 aria current` | yes |
| C6 | `src/index.test.ts` `nav_06 no toggle no presets` | yes - loose: `Presets` is sought only among `nav button`, so a link elsewhere in the header passes; `index.html` has none |
| C7 | `tests/state.test.ts` `nav_07 grooves mode persists` | yes - the page-level `nav_07 reload opens the last screen` backs it |
| C8 | `src/index.test.ts` `nav_08 playback survives screen change` | yes |
| C9 | walk: at each width all three links show and the page does not scroll sideways | no test; happy-dom applies no CSS, so only a real-browser layout test could hold it, and the repo has no such runner. CSS read: nav stays in the header, which wraps under 1024px |
| C10 | `tests/kit.test.ts` `kit_01 eleven tracks in order` | yes |
| C11 | `src/lib.rs` `kit_02_every_drum_track_plays_its_sample` | yes at the engine; the track-to-file mapping is unheld, see findings |
| C12 | `tests/kit.test.ts` `kit_03 samples exist with a license` | no - pins the fallback kit's name, not the condition that selects it |
| C13 | `src/lib.rs` `kit_04_hi_hat_chokes_open_hat` | yes - asserts the cut position within one sample, and the ring-out without a Hi-hat step |
| C14 | `src/lib.rs` `kit_05_output_stays_in_range` | yes - both signs, 11 voices, would fail without the clamp |
| C15 | `src/index.test.ts` `kit_06 failed sample stays local` | yes |
| C16 | `src/lib.rs` `kit_07_click_needs_no_drum_samples` | yes - sample-mode click only; the default synth click has its own test, `click_01_accent_has_no_echo` |
| C17 | `src/lib.rs` `dyn_01_step_values_set_the_gain` | yes - exact values, scaled by the piece's level |
| C18 | `src/index.test.ts` `dyn_02 drum cell cycle` | yes |
| C19 | `src/index.test.ts` `dyn_03 click cell cycle` | yes |
| C20 | `src/index.test.ts` `dyn_04 cell symbols` | yes - glyphs exact; "smaller" rests on the glyph |
| C21 | `src/index.test.ts` `dyn_05 figure writes normal` | yes - overwrites an accent |
| C22 | `src/index.test.ts` `dyn_06 dynamics survive save and load` | yes |
| C23 | `src/index.test.ts` `grv_01 tabs` | yes |
| C24 | `src/index.test.ts` `grv_02 all shows fourteen` | yes |
| C25 | `src/index.test.ts` `grv_03 genre counts` | yes |
| C26 | `src/index.test.ts` `grv_04 card fields` | yes - one card of 14, all from one code path |
| C27 | `src/index.test.ts` `grv_05 play stays on screen` | yes |
| C28 | `src/index.test.ts` `grv_06 playing mark` | yes |
| C29 | `src/index.test.ts` `grv_07 stop keeps song` | yes |
| C30 | `src/index.test.ts` `grv_08 switch during playback` | yes for a running engine; the press during first initialisation fails, see findings |
| C31 | `src/index.test.ts` `grv_09 open in editor` | yes |
| C32 | `src/index.test.ts` `grv_10 loaded song keeps edits` | yes |
| C33 | `src/index.test.ts` `grv_11 asks before replacing edits` | no - card path only; the `Songs` group in the preset selector loads a different song without asking |
| C34 | `src/index.test.ts` `grv_12 decline changes nothing` | yes on the card paths; the selector path offers no decline, see the C33 finding |
| C35 | walk: at 390px the cards stack in one column and the page does not scroll sideways | no test; a real-browser layout test could hold it, happy-dom cannot. CSS read: `.song-grid` is `minmax(0, 1fr)` at 767px and under |
| C36 | `tests/songs.test.ts` `song_01 fourteen songs with sources` | yes - title, artist, genre, BPM exact; the BPM against the tab is the user's walk |
| C37 | `tests/songs.test.ts` `song_02 named versions` | yes |
| C38 | `tests/songs.test.ts` `song_03 bounds` | no - "1 bar" is not tied to the time signature; a 3/4 song of 16 steps passes |
| C39 | `tests/songs.test.ts` `song_04 click marks the beats` | yes - loose: one song of 14, and 12/8 only counts hits; every shipped song is 4/4 through one function |
| C40 | `src/index.test.ts` `song_05 load replaces everything` | no - starts at 4/4 and loads 4/4, so the time signature assertion cannot fail; denominator and measure length unasserted |
| C41 | `src/index.test.ts` `song_06 card matches tempo bus` | no - reads the TEMPO BUS after Stop, whose branch writes it, so the load's own write is not what passes |
| C42 | `src/index.test.ts` `song_07 songs group` | no - `selectPreset` sets the selector itself, so "selects the loaded one" is a tautology |
| C43 | `src/index.test.ts` `song_08 save leaves catalog` | yes |
| C44 | `captures/editor.running.png` against `captures/editor.png` | judged by screens.md |
| C45 | `src/index.test.ts` `edt_02 eleven mix cards` | yes |
| C46 | `src/index.test.ts` `edt_03 new track obeys mix` | yes - China only, but one loop over `TRACKS` serves every track |
| C47 | `src/index.test.ts` `edt_04 groove clears other tracks` | no - does not assert that `Click` stays, so a groove that clears it passes |
| C48 | `src/index.test.ts` `edt_05 save groove keeps the kit` | yes |
| C49 | `tests/state.test.ts` `edt_06 fills missing tracks` | yes - new tracks empty, Kick kept; "plays the 4 saved tracks" follows from the same grid and is not asserted |
| C50 | walk: at 1024px and 390px all 11 tracks show and only the grid scrolls | no test; a real-browser layout test could hold it, happy-dom cannot. CSS read: the scroller at `src/index.css:412` is the grid's |
| C51 | `src/index.test.ts` `std_01 four group labels` | yes |
| C52 | `tests/kit.test.ts` `std_02 snare and toms group` | yes |
| C53 | `tests/kit.test.ts` `std_03 cymbals group` | yes |
| C54 | `tests/kit.test.ts` `std_04 group hit` | no - only the last track of a group is tried, here and in the page test; a rule on 1 case out of 6 |
| C55 | `src/index.test.ts` `std_05 orb pulses for its group` | yes |
| C56 | `src/index.test.ts` `std_06 silenced group stays still` | yes - by mute; the solo path shares `isAudible` |
| C57 | `grep -q '11 tracks' README.md && grep -q 'Grooves' README.md` | yes - read: both described |
| C58 | `grep -q 'SNARE/TOMS' .stitch/DESIGN.md && grep -q 'Grooves' .stitch/DESIGN.md` | yes for what it names, and the links read true at line 228; the file still misdescribes the cycle, see findings |
| C59 | `grep -qi 'license' public/kit/LICENSE.md` | yes - the grep finds only a word; read: name, source and license of both kits are there |
| C60 | walk: at 1024px and 390px both selectors can be used | no test; a real-browser test could hold it, happy-dom cannot. CSS read: `.preset-controls` takes its own row at 767px and under |
| C61 | `src/index.test.ts` `edge_02 load keeps the mix` | yes |
| C62 | `tests/state.test.ts` `edge_03 cleans step values` | no - holds the function, not the rule: the page can stop calling `completeKit` and all 209 tests pass |
| C63 | walk: the ear approval moved to `song-bars`, recorded in Handoff | yes - the user moved it with "pode seguir"; no song is approved by ear yet |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| GRV-01.11 and .12: loading a different song from the preset selector discards unsaved edits with no confirmation | Own example at HEAD: load `song:song_battery`, edit `China`, select `song:song_cocaine` with `confirm` declining: result `PAT: Cocaine`, `confirm` never called. `presetSelector.onchange` at `src/main.ts:706` skips `useSong`. Spec: "WHEN the user loads a different song", and SONG-01.7 makes the selector a way to load one | Send the selector's song branch through the confirmation, restore the selector on decline, and add a selector case to C33 and C34 | 4f67389, C33 and C34 |
| GRV-01.5: a second `▶` during the first audio initialisation leaves the song stopped | Throwaway at HEAD with `init` held open: `▶` on Battery, `▶` on Cocaine, release: 1 `start`, 1 `stop`, `btn-play` not playing, `PAT: Cocaine`. `playSong` reads `state.isPlaying` before `togglePlay` has set it, and 10 samples now load inside that window | Make the intent idempotent across initialisation, so a second press does not toggle, and test it with a held `init` | 4f67389, C30 |
| C63 is recorded `pass (Walked)` but approval by ear looks pending | `proofs.md` C63. Source caveat: a `grep -i walk` over `tasks.md` returned line 947, which sits in `## Handoff`, contrary to the dispatch; I read no other Handoff line. It says "Approval by ear: pending, the user has not heard the 14 songs yet". `proofs.md` passes the row on the presence of the `**Walked:**` line, not its content | The orchestrator confirms with the user; the user plays the 14 songs and records each approval. Not fixable by an implementer | 86b3597, moved to `song-bars`, user: "pode seguir", C63 |
| KIT-01.3: the kit ships the fallback with no record that its condition holds | The criterion takes the Open Source Drumkit only if SM Drums' bundled terms forbid redistribution. `SM Drums` appears only in `spec.md` and `context.md` among `.specs`, `public` and `README.md` (`tasks.md` not searched); `public/kit/LICENSE.md` does not name it. The spec's own source lists SM Drums as Public Domain. `kit_03` asserts the fallback's name, so it cannot tell. Licence claims in `LICENSE.md` were read, not checked against their URLs | Record what SM Drums' bundled terms say and why they rule it out, or move to SM Drums | 965045e, C12 |
| C62: the page's use of `completeKit` has no test | Mutation on a copy of HEAD: `const preset = normalizePreset(storedPreset)` in `loadPresetIntoUI`: 209 of 209 pass, though a stored `7` would then draw no symbol. At HEAD the rule does hold through the page: own example with a 4-track 3/4 preset holding `7` and `null` showed `●`, sent `1`, and 11 × 12 cells | Add a page-level case in `src/index.test.ts` loading a stored out-of-range value | 965045e, C62 with `edt_06 an old preset loads through the page` |
| C42: "select the loaded one" is unproved | Mutation removing `presetSelector.value = ...` from `useSong`: 209 of 209 pass. `song_07` loads through `selectPreset`, which sets that value itself | Assert `preset-selector` after a load from a card | 965045e, C42 |
| C47: `Click` surviving a groove is unheld | Mutation `TRACKS.slice(1)` to `TRACKS` in `applyPattern`: 209 of 209 pass, and the groove empties `Click`. EDT-01.4 names `Kick` to `Floor Tom` | Assert the `Click` steps are unchanged after a groove | 965045e, C47 |
| C54: "any track of its group" is proved only for the last track | Mutation `trackIds.slice(-1).some(...)` in `groupHit`: 209 of 209 pass. Both tests use China and Floor Tom, each the last id of its group, so Snare or Hi-hat could light nothing | Loop over every track of each group | 965045e, C54 |
| C38: "1 bar" is not tied to the meter | Mutation setting The Trooper to `3/4` with 16 steps: 209 of 209 pass | Assert `measureLength === measureLengthFor(numerator, denominator)` for each song | 965045e, C38 |
| C40 and C41 name tests that pass without their claim | `song_05` passes with the time signature write removed and `song_06` with the TEMPO BUS write removed; each mutation is caught only by older tests (`edit_29 toast hidden`, `legacy 12/8 preset loads expanded`, `train_22 ...`), none with a song. `song_05` starts at 4/4; `song_06` reads after Stop | Start `song_05` from a 3/4 preset and assert numerator, denominator and `setMeasureLength`; read the TEMPO BUS in `song_06` before Stop | 965045e, C40 and C41 |
| KIT-01.2: which file a track plays is unheld | Mutation swapping the `ride.wav` and `ride-bell.wav` paths in `TRACKS`: 209 of 209 pass. Only `/kit/china.wav` is pinned, by `kit_06` | Assert the expected file per track in `kit_03` | 965045e, C10 |
| `.stitch/DESIGN.md` still misdescribes the product | Line 259: "Drum tracks toggle off and hit", against the 4-state cycle of DYN-01.2. Line 367: the prompt draws the removed `GO TO STADIUM MODE` pill and four rows. The `grep` in C58 cannot see either; DOC-01's story is that docs do not mislead | Update both passages | 30935ba, C57 |
