# Interface V2 verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at e416efe
**Verifier**: independent sub-agent (author != verifier)

## Own examples

Run at e416efe as a throwaway test, then deleted.

- EDIT-29 and EDIT-21, a stepper at its stop. Rock Groove loaded, nothing edited, Denominator down at `/4`: the Save Toast opens with `Rock Groove` filled in, and a chosen groove in the Groove Library clears to the placeholder. Numerator down at `1` opens the toast the same way. **Breaks.**
- MUTE-04 to MUTE-06 and EDGE-06, empty and full sets through the page. All four muted, then Solo Kick: Kick sends its real steps, Hi-hat sends silence. Solo stays through a preset load and a groove. Un-soloing returns Kick to muted. A silent grid follows a 20-step bar. Holds.
- STAD-06 against the slider and Stop. Slider to 150, open Stadium: Editor `150`, Stadium `120.0`. Calvagada run to a live 170, then Stop: Editor `148`, Stadium `170.0`. **Breaks.**
- Limits that held: `formatTimer` at 359999, 360000, 3599 and 3600; `formatClock` at 22050, 96000 and 192000; 16/16 down to 16/8 (32 steps), then refused at 16/4 and reverted to `/8`; a 1-step bar counts `BAR 03 · STEP 01` on its third tick; opening in Stadium from storage, and the toggle's way back to the Editor.
- Save then edit, during playback: see the findings for the stale header and the dropped first click.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `src/index.test.ts` `shell_01 header controls` | yes - the header sits outside both `main` views, so one header serves both modes |
| C2 | `src/index.test.ts` `shell_02 no dead controls` | yes - no `a` or `nav`, and exactly one `button` |
| C3 | `src/index.test.ts` `shell_03 preset groups` | yes |
| C4 | `src/index.test.ts` `shell_04 editor toggle text` | yes - opening state only; the same text is in `index.html`, and the way back from Stadium is unasserted (it works in my example) |
| C5 | `src/index.test.ts` `shell_05 stadium toggle text` | yes |
| C6 | `src/index.test.ts` `shell_06 footer clock` | yes |
| C7 | `src/index.test.ts` `shell_07 footer latency` | yes |
| C8 | `src/index.test.ts` `shell_08 latency placeholder` | yes |
| C9 | `src/index.test.ts` `shell_09 no invented telemetry` | yes |
| C10 | `browser captures/editor.running.png` | yes - the proof's claim is EDIT-01's claim; the picture itself is judged in `screens.md` |
| C11 | `src/index.test.ts` `edit_02 opening header` | yes |
| C12 | `src/index.test.ts` `edit_03 dot lit playing` | yes |
| C13 | `src/index.test.ts` `edit_04 dot unlit stopped` | yes - on open and after Stop |
| C14 | `src/index.test.ts` `edit_05 beat sub label` | yes |
| C15 | `src/index.test.ts` `edit_06 hit mark` | yes - the mark only; centring and colour are CSS, left to the captures by the Matrix |
| C16 | `src/index.test.ts` `edit_07 accent mark` | yes - the mark only; the solid fill is CSS, left to the captures by the Matrix |
| C17 | `src/index.test.ts` `edit_08 beat spacer` | yes |
| C18 | `src/index.test.ts` `edit_09 sustain kept` | yes |
| C19 | `src/index.test.ts` `edit_10 pattern name` | yes |
| C20 | `src/index.test.ts` `edit_11 steps label` | yes |
| C21 | `src/index.test.ts` `edit_12 resolution label` | yes |
| C22 | `src/index.test.ts` `edit_13 stopped position` | yes |
| C23 | `src/index.test.ts` `edit_14 tick position` | yes |
| C24 | `src/index.test.ts` `edit_15 bar count` | yes - two wraps |
| C25 | `src/index.test.ts` `edit_16 tempo bus title` | yes |
| C26 | `src/index.test.ts` `edit_17 slider scale` | yes - uses a 140 BPM preset, so the middle label is not the default |
| C27 | `src/index.test.ts` `edit_18 slider label follows` | yes |
| C28 | `src/index.test.ts` `edit_19 no measure code` | yes |
| C29 | `src/index.test.ts` `edit_20 numerator stepper` | yes - both ends, and the shared path through `STEPS` and the header |
| C30 | `src/index.test.ts` `edit_21 denominator stepper` | yes - the value stops; what a stopped press does to the page is finding 1 |
| C31 | `src/index.test.ts` `edit_22 groove label` | yes |
| C32 | `tests/state.test.ts` `edit_23 five named grooves` | yes |
| C33 | `src/index.test.ts` `edit_24 metalcore applied` | no - asserts Kick and Snare on the page, not Hi-hat |
| C34 | `src/index.test.ts` `edit_25 trainer starts open` | yes - the first click closes it; no CSS collapses `.trainer-body` |
| C35 | `src/index.test.ts` `edit_26 trainer switch` | yes |
| C36 | `src/index.test.ts` `edit_27 steady dot` | yes - no keyframes or animation in the stylesheet, and no tween on the dot |
| C37 | `src/index.test.ts` `edit_28 toast after edit` | yes |
| C38 | `src/index.test.ts` `edit_29 toast hidden` | no - proves one case, a fresh load with no action; the code fails the criterion on a stopped stepper |
| C39 | `browser captures/stadium.running.png` | yes - the proof's claim is STAD-01's claim; the picture itself is judged in `screens.md` |
| C40 | `src/index.test.ts` `stad_02 ring order` | yes |
| C41 | `src/index.test.ts` `stad_03 legend` | yes - names and order; colour is CSS, and the criterion's wording is finding 10 |
| C42 | `src/index.test.ts` `stad_04 selector label` | yes |
| C43 | `src/index.test.ts` `stad_05 timer label` | yes |
| C44 | `src/index.test.ts` `stad_06 tempo format` | yes - for the format; the value goes stale, finding 2 |
| C45 | `src/index.test.ts` `stad_07 trainer status` | yes |
| C46 | `src/index.test.ts` `stad_08 trainer off` | yes |
| C47 | `src/index.test.ts` `stad_09 orb markup` | yes - icon and name; shape and colour are CSS, left to the captures by the Matrix |
| C48 | `src/index.test.ts` `stad_10 orb pulse` | yes |
| C49 | `src/index.test.ts` `stad_11 orb inert` | yes |
| C50 | `src/index.test.ts` `stad_12 clock behaviours` | yes |
| C51 | `tests/display.test.ts` `time_01 timer format` | yes |
| C52 | `src/index.test.ts` `time_02 timer in both modes` | yes |
| C53 | `src/index.test.ts` `time_03 play restarts` | yes |
| C54 | `src/index.test.ts` `time_04 stop keeps value` | yes |
| C55 | `tests/display.test.ts` `time_05 hours past 99` | yes |
| C56 | `src/index.test.ts` `time_06 same time` | yes |
| C57 | `src/index.test.ts` `mute_01 controls` | yes |
| C58 | `src/index.test.ts` `mute_02 mute silences` | yes |
| C59 | `src/index.test.ts` `mute_03 unmute restores` | yes |
| C60 | `tests/trackMix.test.ts` `mute_04 solo isolates` | yes - unit level as the Matrix names; no test asserts what a Solo press sends the engine, but it shares Mute's path |
| C61 | `tests/trackMix.test.ts` `mute_05 solos add` | yes |
| C62 | `tests/trackMix.test.ts` `mute_06 solo beats mute` | yes |
| C63 | `src/index.test.ts` `mute_07 row dimmed` | yes - Mute and Solo silencing; the opacity is CSS |
| C64 | `src/index.test.ts` `mute_08 orb still` | yes - with a tick already in flight |
| C65 | `src/index.test.ts` `mute_09 edit kept silent` | yes |
| C66 | `src/index.test.ts` `mute_10 saves real grid` | yes - preset and groove |
| C67 | `src/index.test.ts` `mute_11 survives load` | no - Mute across a preset only; Solo is never pressed and no groove is applied |
| C68 | `src/index.test.ts` `mute_12 play sends empty` | yes |
| C69 | `src/index.test.ts` `mute_13 reload clears` | yes |
| C70 | `walk - at 1440 and 1024px the controls sit beside the sequencer` | yes - includes the 1024 boundary |
| C71 | `walk - at 1023px the controls sit under the sequencer` | yes - the other side of the boundary; the CSS rule is `max-width: 1023px` |
| C72 | `walk - at 390px documentElement scrollWidth equals clientWidth in both modes` | yes - the claim matches; the Walked line does not record Stadium, finding 12 |
| C73 | `walk - at 390px the grid wrapper scrolls and the page stays still` | yes |
| C74 | `walk - at 1023px the clock sits above the readout` | yes |
| C75 | `walk - at 390px each header control is on screen and clickable` | yes - the claim matches; the Walked line records on screen only, finding 12 |
| C76 | `walk - at 1440px in 8/4 the grid scrollWidth equals clientWidth` | yes - 8/4 is the 32-step bar |
| C77 | `grep -q 'AUDIO CLOCK' .stitch/DESIGN.md && grep -q 'Track Mix' .stitch/DESIGN.md` | no - proves footer and Mute/Solo, two of five; header, cells and orbs are unproven (the document does cover them) |
| C78 | `! grep -q 'groove-settings-card' .stitch/DESIGN.md` | no - proves one dropped item of the four the feature fixed (the document did drop all four) |
| C79 | `src/index.test.ts` `edge_01 stepper limit` | yes |
| C80 | `src/index.test.ts` `edge_02 steps follow` | yes |
| C81 | `src/index.test.ts` `edge_03 stop resets position` | yes |
| C82 | `src/index.test.ts` `edge_04 stadium placeholder` | yes |
| C83 | `src/index.test.ts` `edge_05 all muted continues` | yes - the tick is injected, but `src/lib.rs` sets `last_tick_index` on every step whatever the grid holds |
| C84 | `src/index.test.ts` `edge_06 groove stays silent` | yes |
| C85 | `git diff --quiet 5481ab6 -- src/lib.rs public/pkg` | yes - both paths are tracked |
| C86 | `src/index.test.ts` `edit_30 header follows save` | yes - added by the fix pass, proven green in `proofs.md`; no second Verifier reviewed it |
| C87 | `src/index.test.ts` `edit_31 first click after save` | yes - added by the fix pass, proven green in `proofs.md`; no second Verifier reviewed it |
| C88 | `src/index.test.ts` `stad_13 tempo follows slider and stop` | yes - added by the fix pass, proven green in `proofs.md`; no second Verifier reviewed it |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| 1. Pressing a stepper at its stop shows the Save Toast and clears the Groove Library, with nothing edited (breaks EDIT-29; new in this feature, since `onchange` only fired on a real change) | `src/main.ts:547-555` always calls `updateTimeSignature`, which runs `grooveSelector.value = ""` and `markPresetAsModified()`. Example: Denominator down at `/4`, and Numerator down at `1` | return from `stepNumerator` and `stepDenominator` when the value did not change; add a test for each stop | 5b36bf7, C38 |
| 2. The Stadium tempo shows a stale value (breaks the goal "Every value on screen is real"; STAD-06 fixes only the format) | Slider to 150: Editor `150`, Stadium `120.0`. Stop after a live 170: Editor `148`, Stadium `170.0`. `src/main.ts:487-497` and the Stop branch at `:431-441` leave `stadiumBpm` alone. The code predates this feature | update `stadiumBpm` from the slider and on Stop; add a criterion and a check | 5b36bf7, C88 |
| 3. After Save the sequencer header keeps the old name beside the new `PAT` | After saving Rock Groove as `Take`: header `Rock Groove  ·  4/4  ·  120 BPM`, pattern bar `PAT: Take`. `btnSave.onclick` at `src/main.ts:779-781` updates only the pattern bar | set `panelHeaderText` on Save too; extend `edit_10` | 5b36bf7, C86 |
| 4. The first grid click after Save is dropped (breaks the goal "Every existing control keeps working"; predates this feature) | After Save the cell did not change and the engine got `0`; the second click worked. `src/main.ts:307` closes over the old `trackSteps`, and Save at `:780` swaps `activePreset` without calling `drawGrid()`. The toast still opens | call `drawGrid()` after the swap; add a test | 5b36bf7, C87 |
| 5. C38's test proves one case of EDIT-29 | `src/index.test.ts:1105` covers a load with no action, so it misses finding 1, and never edits and then loads to see the toast go | add the edit-then-load case and a stopped-stepper case | 5b36bf7, C38 |
| 6. C33's test does not hold the Hi-hat part of EDIT-24 | `src/index.test.ts:1050-1053` asserts tracks 1 and 2. A loop ending at `trackId < 3` in `applyPattern` would pass; `tests/state.test.ts` checks the data, not the apply | assert `hits(3)` and what the engine receives | 5b36bf7, C33 |
| 7. C67's test proves one case of MUTE-11's four | `src/index.test.ts:1211` presses Mute and loads a preset. `edge_06` adds Mute with a groove; Solo is covered in neither, so clearing `soloed` on load would pass every test. The behaviour is right in my example | press Solo, and apply a groove as well as a preset | 5b36bf7, C67 |
| 8. C77's proof greps two of the five subjects in DOCS-01 | The grep covers `AUDIO CLOCK` and `Track Mix`. The header, cells and orbs are not proven, though reading `.stitch/DESIGN.md` shows them described | grep a term for each of the five | c80d010 and 88f0b5e, C77 |
| 9. C78's proof greps one of the four fixed drift items in DOCS-02 | It checks `groove-settings-card` only. The field radii, the hard-coded `#00d4ff` and the stale `index.html` copy are unproven, though they are gone from the list | grep each dropped item | c80d010, C78 |
| 10. STAD-03 reads against `stadium.png` | The criterion puts the legend "in track colours"; the capture draws muted names with track-colour dots, and the code follows the capture. C41 drops the colour | append a criterion that fixes dots in track colours and muted names | c80d010, Assumptions row "Legend in STAD-03" |
| 11. Two departures from `editor.png` are not in `## Differences from the source` | The capture puts an icon on `Save Groove`, and the assumption says capture icons are drawn as inline SVG; `index.html:149` has text only. The capture's Save Toast reads `Rock Groove (120)`, while that row covers only the groove library. No `Confirmed: y` approves either | draw the icon or record it, and record the toast name | 10deb17 and c80d010, Differences row for the Save Toast |
| 12. The `**Walked:**` line records less than C72 and C75 claim | C72 claims both modes and the line names no mode at 390px. C75 claims clickable and the line says on screen | repeat those two steps and record Stadium at 390px and the clicks | c80d010, C72 and C75 |
