# Mobile App Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/mobile-app/design.md`
**Status**: Approved
**Approved**: 2026-11-14 - user: "aprovo e vamos com sub-agents"
**Build**: `npm run build`
**Run js**: `npx vitest run --reporter=verbose`
**Run mobile**: `npx vitest run --config vitest.mobile.config.ts --reporter=verbose`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Keep-awake rule | unit | All branches; 1:1 to MOB-32 to MOB-35 | `tests/keepAwake.test.ts` | `npx vitest run --reporter=verbose` |
| Page markup and wiring | integration | Each control in scope, against the real `index.html` | `tests/app.test.ts` | `npx vitest run --reporter=verbose` |
| Install files and build | unit | The real files, sizes and built links | `tests/install.test.ts` | `npx vitest run --reporter=verbose` |
| Phone layout (CSS) | e2e | Each layout criterion measured in Chrome at its width | `tests/mobile/phone.test.ts` | `npx vitest run --config vitest.mobile.config.ts --reporter=verbose` |
| CI workflow | unit | The new step | `tests/deploy.test.ts` | `npx vitest run --reporter=verbose` |

## Gate Check Commands

> Generated from codebase - confirm before Execute. `tsc` fails on missing AudioWorklet types and the project has no linter, so neither is a gate.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After rule, wiring and file tasks | `npx vitest run` |
| Full | After CSS tasks | `npx vitest run && npm run test:mobile` |
| Build | After the last task | `npx vitest run && npm run test:mobile && npm run build` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Harness

```
T1
```

### Phase 2: Shell and transport

```
T2 → T3 → T4 → T5
```

### Phase 3: Grid and fit

```
T6 → T7 → T8
```

### Phase 4: Native

```
T9 → T10 → T11
```

### Phase 5: Verifier findings and Stadium first

```
T12 → T13 → T14
```

---

## Task Breakdown

### T1: Mobile browser test harness

**What**: `vitest.mobile.config.ts` with a `globalSetup` that starts Vite's dev server on a free port, `playwright-core` as a dev dependency driving the system Chrome, `npm run test:mobile`, `tests/mobile/` excluded from `vitest.config.ts`, and a `test:mobile` step in the CI `test` job.
**Where**: `vitest.mobile.config.ts`, `tests/mobile/setup.ts`, `tests/mobile/phone.test.ts`, `package.json`, `vitest.config.ts`, `.github/workflows/deploy.yml`, `tests/deploy.test.ts`
**Depends on**: None
**Reuses**: `vite.config.ts`
**Requirement**: none (infrastructure for MOB-01 to MOB-39)

**Done when**:

- [x] `tests/mobile/phone.test.ts` has a helper that opens a screen at a width with touch emulation, and one smoke test that the Editor loads at 375 px
- [x] `tests/deploy.test.ts` asserts the `test` job runs `npm run test:mobile`
- [x] Gate check passes: `npx vitest run && npm run test:mobile`

**Tests**: e2e
**Gate**: full
**Commit**: `test(mobile): drive Chrome at phone widths`
**Status**: Done

---

### T2: Touch feel and field size

**What**: Base CSS for no tap highlight, `touch-action: manipulation`, `user-select: none` on controls, `overscroll-behavior-y: none`, and 16 px inputs and selects on phones.
**Where**: `src/ui/index.css`
**Depends on**: None (Phase order: after T1)
**Reuses**: The `max-width: 767px` block
**Requirement**: MOB-05, MOB-36, MOB-37, MOB-38, MOB-39

**Done when**:

- [x] `mob_05`, `mob_36` to `mob_39` pass in Chrome
- [x] Gate check passes: `npx vitest run && npm run test:mobile`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): make taps feel native on phones`
**Status**: Done

---

### T3: Bottom tab bar and compact top bar

**What**: An icon in each `.view-link`; on phones the header becomes static with no backdrop filter and safe-area top padding, the logo on one row and the two selectors on the next, and `.view-nav` becomes a tab bar fixed to the bottom with safe-area padding; `main` clears it.
**Where**: `index.html`, `src/ui/index.css`
**Depends on**: T2
**Reuses**: `.view-link`, `renderView`, `#improv-dot`
**Requirement**: MOB-06, MOB-07, MOB-08, MOB-09, MOB-10, MOB-11, MOB-12, MOB-31

**Done when**:

- [x] `mob_06`, `mob_09`, `mob_10` (Stadium, Grooves, Improv), `mob_11`, `mob_12`, `mob_31` pass in Chrome
- [x] `mob_07` and `mob_08` pass in `tests/app.test.ts`
- [x] Gate check passes: `npx vitest run && npm run test:mobile`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): move the screens to a bottom tab bar on phones`
**Status**: Done

---

### T4: Transport bar wiring

**What**: `#transport-bar` markup in the Editor and its wiring in `header.ts`: Play/Stop mirrors `#btn-play`, `−` / `+` call `session.stepBpm`, the tempo follows every render path, and the steps are disabled from `canStepBpm`.
**Where**: `src/ui/header.ts`
**Depends on**: T3
**Reuses**: `renderPlayback`, `renderTempo`, `renderTick`, `renderPreset`; `renderTempoSteps` from `src/ui/stadium.ts`
**Requirement**: MOB-15, MOB-16, MOB-17, MOB-18, MOB-19, MOB-20, MOB-21, MOB-22

**Done when**:

- [x] `mob_15` to `mob_22` pass in `tests/app.test.ts`
- [x] Gate check passes: `npx vitest run`

**Tests**: integration
**Gate**: quick
**Commit**: `feat(ui): add a transport bar to the editor`
**Status**: Done

---

### T5: Transport bar layout

**What**: On phones the transport bar sits fixed directly above the tab bar in the Editor only; the Editor's `main` clears both bars; above 767 px it is not displayed.
**Where**: `src/ui/index.css`
**Depends on**: T4
**Reuses**: Tab bar height token from T3
**Requirement**: MOB-10, MOB-13, MOB-14

**Done when**:

- [x] `mob_10` (all four screens), `mob_13`, `mob_14` pass in Chrome, and `mob_11` still passes
- [x] Gate check passes: `npx vitest run && npm run test:mobile`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): pin the transport bar above the tabs on phones`
**Status**: Done

---

### T6: Scrolling grid and palette row

**What**: On phones the track names stick to the grid's left edge, the steps snap to each beat's first cell, and the figure palette is one sideways-scrolling row.
**Where**: `src/ui/index.css`
**Depends on**: None (Phase order: after T5)
**Reuses**: `.beat-start` cells drawn by `src/ui/editor.ts`
**Requirement**: MOB-23, MOB-24, MOB-27

**Done when**:

- [x] `mob_23`, `mob_24`, `mob_27` pass in Chrome
- [x] Gate check passes: `npx vitest run && npm run test:mobile`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): scroll the grid under fixed track names on phones`
**Status**: Done

---

### T7: Grid edge fades

**What**: `updateGridEdges` sets `data-more-left` / `data-more-right` on `.grid-scroller` on scroll, resize and redraw, and the CSS draws a fade on each marked edge.
**Where**: `src/ui/editor.ts`
**Depends on**: T6
**Reuses**: `drawGrid`
**Requirement**: MOB-25, MOB-26

**Done when**:

- [x] `mob_25`, `mob_26` pass in Chrome
- [x] Gate check passes: `npx vitest run && npm run test:mobile`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): fade the grid edge that has more steps`
**Status**: Done

---

### T8: Fit and touch targets

**What**: Re-flow the Stadium orb and tempo rows to the panel, size the header selectors so their values read in full, and bring buttons, selects, range thumbs and step cells to their minimum hit areas on phones.
**Where**: `src/ui/index.css`
**Depends on**: T7
**Reuses**: The `max-width: 767px` block
**Requirement**: MOB-01, MOB-02, MOB-03, MOB-04

**Done when**:

- [x] `mob_01` to `mob_04` pass in Chrome
- [x] Gate check passes: `npx vitest run && npm run test:mobile`

**Tests**: e2e
**Gate**: full
**Commit**: `fix(ui): fit every screen to phone widths`
**Status**: Done

---

### T9: Keep the screen awake

**What**: `ScreenLock` port, `keepAwake` rule in the app layer, and the `navigator.wakeLock` adapter in `main.ts`.
**Where**: `src/app/keepAwake.ts`
**Depends on**: None (Phase order: after T8)
**Reuses**: `session.subscribe`, `session.isPlaying`, `session.pad.soundingChord`
**Requirement**: MOB-32, MOB-33, MOB-34, MOB-35

**Done when**:

- [x] `mob_32` to `mob_35` pass in `tests/keepAwake.test.ts`, with a stub lock and stub page
- [x] `tests/layers.test.ts` still passes
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(app): keep the screen awake while MetroRig sounds`
**Status**: Done

---

### T10: App icons

**What**: `public/icons/icon.svg` and `scripts/build_icons.js`, which renders it through Chrome to `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `apple-touch-icon.png` (180 px), all committed.
**Where**: `scripts/build_icons.js`
**Depends on**: T9
**Reuses**: `playwright-core` from T1
**Requirement**: MOB-28

**Done when**:

- [x] `tests/install.test.ts` asserts each PNG exists with its pixel size
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(install): draw the MetroRig app icons`
**Status**: Done

---

### T11: Manifest and install metadata

**What**: `public/manifest.webmanifest` and the `<head>` links and metas, all with relative URLs so the `/MetroRig/` base resolves them.
**Where**: `public/manifest.webmanifest`
**Depends on**: T10
**Reuses**: `--bg` token value
**Requirement**: MOB-28, MOB-29, MOB-30

**Done when**:

- [x] `mob_28`, `mob_29`, `mob_30` pass in `tests/install.test.ts`
- [x] Gate check passes: `npx vitest run && npm run test:mobile && npm run build`

**Tests**: unit
**Gate**: build
**Commit**: `feat(install): make MetroRig installable`
**Status**: Done

---

### T12: Close the Verifier's width findings

**What**: `mob_04` also measures at 360 and 767 px, and `mob_11` also at 768 px, as `verification.md` findings 1 and 2 ask.
**Where**: `tests/mobile/phone.test.ts`
**Depends on**: None (Phase order: after T11)
**Reuses**: `openScreen`
**Requirement**: MOB-04, MOB-11

**Done when**:

- [x] `mob_04` runs at 360, 375 and 767 px and `mob_11` at 768 and 1280 px
- [x] Gate check passes: `npx vitest run && npm run test:mobile`

**Tests**: e2e
**Gate**: full
**Commit**: `test(mobile): measure touch targets and the breakpoint at their edges`
**Status**: Done

---

### T13: Stadium first

**What**: The screen links read `Stadium`, `Editor`, `Grooves`, `Improv`, and with no saved screen the app opens on Stadium.
**Where**: `src/app/stateManager.ts`
**Depends on**: T12
**Reuses**: `loadActiveViewMode`, `.view-link` markup in `index.html`
**Requirement**: MOB-40, MOB-41, MOB-42

**Done when**:

- [x] `mob_40` passes in Chrome at 375 and 1280 px; `mob_41` and `mob_42` pass in `tests/app.test.ts`
- [x] `tests/state.test.ts` default-view assertions follow AD-030 (Stadium), the saved-screen ones unchanged
- [x] Gate check passes: `npx vitest run && npm run test:mobile`

**Tests**: integration
**Gate**: full
**Commit**: `feat(ui): put stadium first and open on it`
**Status**: Done

---

### T14: Stadium Play above the tabs on phones

**What**: On phones the existing `#btn-stadium-play` sits fixed directly above the tab bar, and the Stadium screen clears it at its end; at 768 px and wider it stays in the panel.
**Where**: `src/ui/index.css`
**Depends on**: T13
**Reuses**: Tab bar height and the transport bar placement from T5
**Requirement**: MOB-10, MOB-43, MOB-44

**Done when**:

- [x] `mob_43`, `mob_44` pass in Chrome and `mob_10` measures Stadium's end against the Play button
- [x] Gate check passes: `npx vitest run && npm run test:mobile && npm run build`

**Tests**: e2e
**Gate**: build
**Commit**: `feat(ui): pin the stadium play button above the tabs on phones`
**Status**: Done

---

## Checks

**C1** - At 360, 375, 390 and 430 px the Editor, Stadium, Grooves and Improv each have a page scroll width equal to the window width (MOB-01, AC 1)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_01 no sideways page scroll at 360 375 390 430

**C2** - At 360 px the Click selector shows each of the five click sounds, and the Preset selector `4/4 Metronome`, with no text cut (MOB-02, AC 2)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_02 header selectors show their value in full at 360

**C3** - At 360 px the four Stadium orbs, their names and the − and + buttons lie inside the Stadium panel (MOB-03, AC 3)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_03 stadium orbs and tempo buttons inside the panel at 360

**C4** - At 375 px every visible button, select, range thumb and tab is at least 44 × 44 px, and every step cell at least 32 × 32 px (MOB-04, AC 4)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_04 touch targets 44 px and step cells 32 px

**C5** - At 375 px every input and select renders text at 16 px or more (MOB-05, AC 5)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_05 fields use 16 px text

**C6** - At 375 px the four screen tabs, each with an icon, sit in a bar whose bottom is the window's bottom, before and after scrolling (MOB-06, AC 6)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_06 tab bar fixed to the bottom with four icon tabs

**C7** - Tapping each tab shows its screen and puts `aria-current="page"` on that tab alone (MOB-07, AC 7)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_07 tab shows its screen and marks only itself

**C8** - While a chord pad sounds the dot on the `Improv` tab is lit, and it goes out when the pad stops (MOB-08, AC 8)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_08 improv tab dot follows the pad

**C9** - The tab bar's bottom padding is `env(safe-area-inset-bottom)` added to its base padding (MOB-09, AC 9)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_09 tab bar pads the bottom safe area

**C10** - At 375 px, scrolled to the end, each screen's last element ends above the tab bar, and in the Editor above the transport bar (MOB-10, AC 10)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_10 last element clears the fixed bars

**C11** - At 1280 px the four links sit in the header and no element is fixed to the window's bottom (MOB-11, AC 11)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_11 desktop keeps header links

**C12** - At 375 px the logo is alone on the header's first row, the Click and Preset selectors share the second, and the header holds no visible screen link (MOB-12, AC 12)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_12 compact top bar rows

**C13** - At 375 px in the Editor a bar with `−`, the tempo, `+` and Play sits directly above the tab bar, before and after scrolling (MOB-13, AC 13)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_13 transport bar fixed above the tab bar

**C14** - At 375 px on Stadium, Grooves and Improv the transport bar is not displayed (MOB-14, AC 14)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_14 transport bar only in the editor

**C15** - Tapping the transport Play starts the engine and both Play buttons show Stop (MOB-15, AC 15)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_15 transport play starts and both show stop

**C16** - Tapping the transport Stop stops the engine and both buttons show Play (MOB-16, AC 16)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_16 transport stop stops and both show play

**C17** - Tapping the Tempo Bus Play and then Stop gives the transport button the same state each time (MOB-17, AC 17)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_17 tempo bus play mirrors to the transport bar

**C18** - From 120 BPM, `+` sets 121 on the transport bar, the Tempo Bus number and the slider (MOB-18, AC 18)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_18 plus raises one bpm everywhere

**C19** - From 120 BPM, `−` sets 119 on the transport bar, the Tempo Bus number and the slider (MOB-19, AC 19)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_19 minus lowers one bpm everywhere

**C20** - The transport tempo follows the slider, a preset load and a Trainer tick (MOB-20, AC 20)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_20 transport tempo follows slider preset and trainer

**C21** - At 240 BPM `+` is disabled and at 40 BPM `−` is disabled, and a tap leaves the tempo unchanged (MOB-21, AC 21)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_21 tempo bounds disable the steps

**C22** - With the Trainer enabled `−` and `+` are disabled; disabling it enables them (MOB-22, AC 22)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_22 trainer disables the steps

**C23** - At 375 px, with the grid scrolled to its end, every track name's left edge equals the grid's left edge (MOB-23, AC 23)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_23 track names stay in view while steps scroll

**C24** - At 375 px a sideways scroll released mid-beat settles with a beat's first cell at the step area's left edge (MOB-24, AC 24)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_24 grid snaps to beat starts

**C25** - At 375 px the right fade shows while steps lie beyond the right edge and not at the scroll end, nor for a pattern that fits (MOB-25, AC 25)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_25 right fade marks more steps

**C26** - At 375 px the left fade is absent at the start and shows once steps scroll past the left edge (MOB-26, AC 26)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_26 left fade marks hidden steps

**C27** - At 375 px every figure chip shares one row and the palette scrolls sideways (MOB-27, AC 27)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_27 figure palette is one scrolling row

**C28** - `public/manifest.webmanifest` has the name, short name, standalone display, `./` start URL and scope, `#080810` colours, and 192, 512 and maskable 512 PNG icons whose files have those sizes (MOB-28, AC 28)
Proof: run js | ✓ tests/install.test.ts > Mobile App > mob_28 manifest declares the installable app

**C29** - `index.html` links the manifest and declares the theme colour, the 180 px Apple icon, the two Apple web-app metas and `viewport-fit=cover` (MOB-29, AC 29)
Proof: run js | ✓ tests/install.test.ts > Mobile App > mob_29 page declares install metadata

**C30** - A Vite build with base `/MetroRig/` emits the manifest and every icon, and each link the page and the manifest name points at an emitted file (MOB-30, AC 30)
Proof: run js | ✓ tests/install.test.ts > Mobile App > mob_30 built icons resolve under the base

**C31** - The header's top padding is `env(safe-area-inset-top)` added to its base padding (MOB-31, AC 31)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_31 top bar pads the top safe area

**C32** - Play requests a wake lock, and a chord pad starting with the metronome stopped requests one (MOB-32, AC 32)
Proof: run js | ✓ tests/keepAwake.test.ts > Mobile App > mob_32 sound requests a wake lock

**C33** - The lock is released when playback stops with no pad sounding, and kept while either sounds (MOB-33, AC 33)
Proof: run js | ✓ tests/keepAwake.test.ts > Mobile App > mob_33 silence releases the wake lock

**C34** - Hidden then visible while playing requests the lock again; while silent it does not (MOB-34, AC 34)
Proof: run js | ✓ tests/keepAwake.test.ts > Mobile App > mob_34 visible again requests the lock

**C35** - With no Wake Lock API, or a rejected request, Play still starts the engine and nothing is thrown (MOB-35, AC 35)
Proof: run js | ✓ tests/keepAwake.test.ts > Mobile App > mob_35 missing or refused wake lock plays on

**C36** - Buttons, tabs, step cells and pads compute `-webkit-tap-highlight-color` as transparent (MOB-36, AC 36)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_36 no tap highlight

**C37** - `html` and `body` compute `touch-action: manipulation` (MOB-37, AC 37)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_37 double tap does not zoom

**C38** - Buttons, tabs, step cells and pads compute `user-select: none` (MOB-38, AC 38)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_38 long press selects no text

**C39** - `html` and `body` compute `overscroll-behavior-y: none` (MOB-39, AC 39)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_39 pull past the top does not reload

**C40** - The screen links read `Stadium`, `Editor`, `Grooves`, `Improv` in the tab bar at 375 px and in the header at 1280 px (MOB-40, AC 1)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_40 stadium is the first screen link

**C41** - With no saved screen the page shows Stadium and marks its link current (MOB-41, AC 2)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_41 first visit opens on stadium

**C42** - With `editor` saved the page opens on the Editor (MOB-42, AC 3)
Proof: run js | ✓ tests/app.test.ts > Mobile App > mob_42 a saved screen still opens first

**C43** - At 375 px on Stadium the Play button's bottom meets the tab bar's top, before and after scrolling (MOB-43, AC 4)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_43 stadium play fixed above the tab bar

**C44** - At 768 and 1280 px the Stadium Play button lies inside the Stadium panel (MOB-44, AC 5)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > mob_44 desktop stadium play stays in the panel

---

## Handoff

**Settled mid-build:** after T11, user: "Acho que o botao stadium pode ser o primeiro no mobile e tb no desktop. Podemos colocar o start em cima ou em lugar mais facil nessa tela"; then "Sim, abre no Stadium (Recommended)" and "Fixo embaixo no celular (Recommended)". Recorded as AD-030, MOB-40 to MOB-44, T13 and T14. The Verifier findings 1 and 2 become T12.
**Dispatched:** batch 1 (T1 to T5), from 1a2d9fa, returned at a8508b2; batch 2 (T6 to T11), from a8508b2, returned at d41ac4c; Verifier over the proofs at 901911e
**Walked:** Headless Chrome (playwright-core, touch emulation, 1x) on the Vite dev server, `npx vite --port 5199`, no sign-in or data needed; each screen reached by its tab. **P1 fit:** at 360 and 375 px Editor, Stadium, Grooves and Improv each had page scrollWidth equal to the window (360/375); before the feature Stadium was 366 at 360. Elements past the edge are only the figure chips inside the palette's own scroller. Header: logo row, then speaker icon + `Digital` and `4/4 Metronome` in full at 360. Stadium at 360: four orbs inside the panel, `SNARE/ TOMS` wrapping after the slash, − and + inside. **P1 tab bar:** four icon tabs fixed at the bottom on every screen, Improv tab lit neon on Improv, Stadium on Stadium. **P1 transport:** Editor shows `− 120 BPM + ▶ PLAY` directly above the tabs at the top and at the end of the page; the Tempo Bus card still reads 120 with its slider. **P1 grid:** names column fixed, first chip row scrolls sideways (`Step`, `Quarter`, `Eighths`, cut at the edge). **P2:** manifest and icons checked by the batch worker on `vite preview` under `/MetroRig/` (no manifest errors; only `in-incognito` from the test context). Wake lock not walked on a phone; it rests on tests/keepAwake.test.ts. Pictures: scratchpad `after/*.png`, no capture binds.

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1
Phase 2:  T2 ------→ T3 ------→ T4 ------→ T5
Phase 3:  T6 ------→ T7 ------→ T8
Phase 4:  T9 ------→ T10 -----→ T11
Phase 5:  T12 -----→ T13 -----→ T14
```

Execution is strictly sequential.
