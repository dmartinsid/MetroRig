# Mobile App verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at d41ac4c
**Verifier**: independent sub-agent (author != verifier)

Diff range `1a2d9fa..901911e`. No product defect was found. The two findings are tests that leave the edge of their criterion's range unmeasured. The probes below show that both rules hold at HEAD today.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `tests/mobile/phone.test.ts` `mob_01 no sideways page scroll at 360 375 390 430` | yes |
| C2 | `tests/mobile/phone.test.ts` `mob_02 header selectors show their value in full at 360` | yes |
| C3 | `tests/mobile/phone.test.ts` `mob_03 stadium orbs and tempo buttons inside the panel at 360` | yes |
| C4 | `tests/mobile/phone.test.ts` `mob_04 touch targets 44 px and step cells 32 px` | no - measured only at 375; MOB-04 holds for every width up to 767, and 360 (where controls are narrowest) is never measured |
| C5 | `tests/mobile/phone.test.ts` `mob_05 fields use 16 px text` | yes |
| C6 | `tests/mobile/phone.test.ts` `mob_06 tab bar fixed to the bottom with four icon tabs` | yes |
| C7 | `tests/app.test.ts` `mob_07 tab shows its screen and marks only itself` | yes |
| C8 | `tests/app.test.ts` `mob_08 improv tab dot follows the pad` | yes |
| C9 | `tests/mobile/phone.test.ts` `mob_09 tab bar pads the bottom safe area` | yes |
| C10 | `tests/mobile/phone.test.ts` `mob_10 last element clears the fixed bars` | yes |
| C11 | `tests/mobile/phone.test.ts` `mob_11 desktop keeps header links` | no - measured only at 1280; MOB-11 says 768 and wider, and the 768 boundary, where the header is tightest and the 767 query flips, is never measured |
| C12 | `tests/mobile/phone.test.ts` `mob_12 compact top bar rows` | yes |
| C13 | `tests/mobile/phone.test.ts` `mob_13 transport bar fixed above the tab bar` | yes |
| C14 | `tests/mobile/phone.test.ts` `mob_14 transport bar only in the editor` | yes |
| C15 | `tests/app.test.ts` `mob_15 transport play starts and both show stop` | yes |
| C16 | `tests/app.test.ts` `mob_16 transport stop stops and both show play` | yes |
| C17 | `tests/app.test.ts` `mob_17 tempo bus play mirrors to the transport bar` | yes |
| C18 | `tests/app.test.ts` `mob_18 plus raises one bpm everywhere` | yes |
| C19 | `tests/app.test.ts` `mob_19 minus lowers one bpm everywhere` | yes |
| C20 | `tests/app.test.ts` `mob_20 transport tempo follows slider preset and trainer` | yes |
| C21 | `tests/app.test.ts` `mob_21 tempo bounds disable the steps` | yes |
| C22 | `tests/app.test.ts` `mob_22 trainer disables the steps` | yes |
| C23 | `tests/mobile/phone.test.ts` `mob_23 track names stay in view while steps scroll` | yes |
| C24 | `tests/mobile/phone.test.ts` `mob_24 grid snaps to beat starts` | yes |
| C25 | `tests/mobile/phone.test.ts` `mob_25 right fade marks more steps` | yes |
| C26 | `tests/mobile/phone.test.ts` `mob_26 left fade marks hidden steps` | yes |
| C27 | `tests/mobile/phone.test.ts` `mob_27 figure palette is one scrolling row` | yes |
| C28 | `tests/install.test.ts` `mob_28 manifest declares the installable app` | yes |
| C29 | `tests/install.test.ts` `mob_29 page declares install metadata` | yes |
| C30 | `tests/install.test.ts` `mob_30 built icons resolve under the base` | yes |
| C31 | `tests/mobile/phone.test.ts` `mob_31 top bar pads the top safe area` | yes |
| C32 | `tests/keepAwake.test.ts` `mob_32 sound requests a wake lock` | yes |
| C33 | `tests/keepAwake.test.ts` `mob_33 silence releases the wake lock` | yes |
| C34 | `tests/keepAwake.test.ts` `mob_34 visible again requests the lock` | yes |
| C35 | `tests/keepAwake.test.ts` `mob_35 missing or refused wake lock plays on` | yes |
| C36 | `tests/mobile/phone.test.ts` `mob_36 no tap highlight` | yes |
| C37 | `tests/mobile/phone.test.ts` `mob_37 double tap does not zoom` | yes |
| C38 | `tests/mobile/phone.test.ts` `mob_38 long press selects no text` | yes |
| C39 | `tests/mobile/phone.test.ts` `mob_39 pull past the top does not reload` | yes |

## Own examples (all at HEAD, headless Chrome with touch, throwaway scripts in the session scratchpad)

- **MOB-01:** widths 360, 375, 390, 393, 412, 414, 428 and 430, on all four screens. Editor states tried: `Battery` (multi-bar song, bar selector shown) and `Crossroads`, each with the Trainer open; a Trainer routine; 7/8; and an 8/4 bar of 32 steps. Grooves tried with every genre tab and Improv with a pad sounding. Page scroll width equalled the window in every case, and no element outside the inner scrollers crossed the window edge. Holds.
- **MOB-23/24/25/26:** 12/8 `Blues` and `Jazz` (24 steps), 6/8, `Battery` and 32 steps, at 360 and 430, each dragged by touch for 0.3, 0.75, 1.4 and 2.6 beats. Every drag settled on a beat start or the scroll end. Every name stayed at the left edge and was drawn on top, and `data-more-left`/`data-more-right` matched the scroll position each time. Also tried: a grid redrawn while the Editor was hidden, a bar switch while scrolled to the end, a tab round trip, and a resize to 1280. The edge marks were right each time. Holds.
- **MOB-04/05:** at 360, 430, 600 and 767, on all four screens, Editor with a song loaded and the Trainer open. Every button, select, tab, range thumb and checkbox label was at least 44 × 44, every step cell at least 32 × 32, and every input and select at 16 px. Holds (only labels, the footer link and the numerator number input are smaller, and the criterion does not name them).
- **MOB-06/10/12/13/14:** at 360, 390, 412 and 430, height 740, at scroll 0, 700 and the end, Editor with `Battery` and the Trainer open. The tab bar was flush with the window bottom and the transport bar sat directly on it. The last element of each screen and the footer ended above the bars, the header rows were correct, and the transport parts did not overlap with a `127.3` tempo. Holds.
- **Desktop unchanged:** HEAD compared with `1a2d9fa` in the same Chrome, pixel for pixel. Tried at 768, 1024 and 1280 on all four screens (zero differing pixels), and at 768 and 1280 with the default preset, `Battery`, `Crossroads` and 7/8, scrolled to 0, 600, 1200 and the end, on Editor, Grooves and Stadium (zero differing pixels). Stadium was also tried at heights 848, 1200 and 2200. Holds.
- **MOB-08 in Chrome:** the dot on the Improv tab is hidden while no pad sounds, and drawn neon inside the tab while one sounds, also with the Editor shown.
- **MOB-32/33/35 in Chrome:** the real `navigator.wakeLock` was granted on transport Play and released on Stop, with no page error or console error.

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C4's test measures the 44 px and 32 px targets only at 375, while MOB-04 holds every width up to 767, and the spec's narrowest width, 360, is where the two-column mix buttons, the transport row and the tab cells are smallest. A control that drops under 44 px at 360 passes the test. | `tests/mobile/phone.test.ts:543`, `openScreen(screen, 375)` only. A probe at 360, 430, 600 and 767 passes today. | Loop `mob_04` over 360 and 767 (and keep 375), with the same song and Trainer state. | |
| C11's test checks the header links and no fixed bar only at 1280, while MOB-11 starts at 768, the width where `@media (max-width: 767px)` flips and the header is tightest. A breakpoint off by one (e.g. `max-width: 768px`) passes the test. | `tests/mobile/phone.test.ts:332`, `openScreen(screen, 1280)` only. At 768 HEAD is pixel-identical to `1a2d9fa` today. | Run `mob_11` at 768 as well as 1280. | |
