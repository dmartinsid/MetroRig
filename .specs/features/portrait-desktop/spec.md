# Portrait Desktop (9:16) Specification

**Approved**: 2026-11-17 - user: "aprovada"

## Problem Statement

MetroRig's phone layout (`mobile-app`) only activates at `@media (max-width: 767px)`. On a desktop screen or window in 9:16 (such as `900 × 1600`, `1080 × 1800` with browser bars, or `1080 × 1920`), windows from 768 to 1023 px fall into an intermediate layout with no bottom tab bar, no Editor transport bar, a 576 px capped Stadium panel below a giant beat clock, and wrapped header links; windows 1024 px and wider stay in the two-column landscape desktop layout, squeezing both columns side by side into a tall vertical viewport.

## Goals

- [x] Every 9:16 and portrait window up to a 3:4 aspect ratio (`max-aspect-ratio: 3/4`) gets the full-width phone experience across `Stadium`, `Editor`, `Grooves` and `Improv`, at any width.
- [x] Windows 768 px and wider that are wider than 3:4 keep today's desktop layout.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Centering the app inside a narrow phone-width column with empty side margins | Q2, user: "recomendacoes" |
| Proportional zoom scaling of fonts and controls on wide 9:16 screens | Q2, user: "recomendacoes" |
| A third hybrid layout between phone and desktop | Q3, user: "recomendacoes" |
| Changes to landscape desktop windows (768 px and wider, wider than 3:4) | Q1, user: "recomendacoes" |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Activation rule for the phone layout | `@media (max-width: 767px), (max-aspect-ratio: 3/4)` | Q1, user: "recomendacoes" (AD-032): covers exact 9:16 (`540 × 960`, `720 × 1280`, `900 × 1600`, `1080 × 1920`, `1440 × 2560`), 9:16 monitors with browser chrome (`1080 × 1800`), and portrait tablets (`768 × 1024`), while leaving landscape and near-square desktop windows (`768 × 800`, `1280 × 800`, `1920 × 1080`) on the desktop layout | y |
| Width behaviour on wide 9:16 windows | Full-width responsive phone layout across the window: `.stadium-panel` takes the full display width (`max-width: none`) and `#editor-view` stacks in one column at every portrait width | Q2, user: "recomendacoes" (AD-032) | y |
| Scope of the phone experience in 9:16 | Full mobile package on all 4 screens: bottom tab bar, two-row header, Stadium controls on top + square clock below + fixed Play button above the tabs, Editor fixed transport bar + sticky track names + one-row figure palette + two-column track mix, one-column song grid, 6-column sticky chord roots, 44 px touch targets (32 px step cells) and 16 px field text | Q3, user: "recomendacoes" (AD-032) | y |
| Beat clock box on wide 9:16 windows (e.g. `1080 × 1920`) | `.beat-clock` stays square (`width` and `height` within 1 px) and fits inside both the column width and the room above the Play button (or scrolls at 240 px+ when the room above Play is shorter than 200 px) | In a tall 1080 × 1920 flexbox, `flex: 1 1 0` without a height cap stretches the SVG box taller than its width and pushes `.clock-legend` away from the dial | y, stated with the spec |
| Editor grid on wide 9:16 windows (e.g. `900 × 1600`, `1080 × 1920`) | `.sequencer-grid` keeps `width: max-content; min-width: 100%` with sticky track names: a 16-step bar that fits the card expands across the width with no fade, and a bar wider than the card (or on a narrower window) scrolls sideways with beat snap and edge fades | Follows `MOB-23` to `MOB-26` at every portrait width | y, stated with the spec |
| Figure palette on wide 9:16 windows | `.figure-palette` stays a single horizontal row (`flex-wrap: nowrap; overflow-x: auto`), scrolling sideways whenever its chips exceed the card width | Follows `MOB-27` | y, stated with the spec |
| Implicit-requirement dimensions (auth, rate limits, data expiry, idempotency, concurrency, observability, external dependencies) | N/A for this scope because the feature only changes CSS media-query layout rules | Sweep | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Full-width mobile experience on 9:16 and portrait desktop windows ⭐ MVP

**User Story**: As a musician using MetroRig in a 9:16 or vertical desktop window, I want the same layout and controls as on a phone so that every screen fits cleanly and keeps transport and navigation in reach.

**Why P1**: This is the reported problem on 9:16 desktop screens.

**Acceptance Criteria**:

1. PRT-01: WHILE the window is 540 × 960, 720 × 1280, 900 × 1600, 1080 × 1800, 1080 × 1920 or 768 × 1024 the system SHALL show the Editor, Stadium, Grooves and Improv screens with the page's scroll width equal to the window width.
2. PRT-02: WHILE the window has an aspect ratio of 3:4 or narrower at 768 px wide or wider the system SHALL show the logo on the first header row, the Click and Preset selectors on the row below it, no screen links in the header, and the four icon tabs `Stadium`, `Editor`, `Grooves` and `Improv` fixed to the bottom of the window.
3. PRT-03: WHILE Stadium is shown and the window is 900 × 1600, 1080 × 1800 or 1080 × 1920 the system SHALL show the Stadium panel across the display's full inner width above the beat clock, the Stadium Play button fixed directly above the tab bar, and at scroll 0 the tempo with − and +, the four orbs, the whole beat clock and its legend above the Stadium Play button, with the beat clock square and at least 200 px wide.
4. PRT-04: WHILE the Editor is shown and the window has an aspect ratio of 3:4 or narrower at 768 px wide or wider the system SHALL stack the controls column below the sequencer column, show the transport bar fixed directly above the tab bar, show the figure palette as one row, and keep every track name in view at the grid's left edge when the grid scrolls sideways.
5. PRT-05: WHILE the window has an aspect ratio of 3:4 or narrower at 768 px wide or wider the system SHALL give every visible button, select, range thumb and tab a hit area at least 44 × 44 px, every step cell at least 32 × 32 px, and every input and select text at least 16 px.
6. PRT-06: WHEN the user scrolls any screen to its end in a window with an aspect ratio of 3:4 or narrower at 768 px wide or wider THEN the system SHALL show its last element above the tab bar, above the transport bar in the Editor, and above the Stadium Play button on Stadium.
7. PRT-07: WHILE the window is 768 px wide or wider and wider than 3:4 the system SHALL show the four screen links in the header, no tab bar, no transport bar, and the Stadium Play button inside the Stadium panel.

**Independent Test**: Open Stadium and Editor at `1080 × 1920` and `900 × 1600`: the bottom tab bar and fixed Play / transport bars are shown, Stadium's panel spans the width above a square beat clock, Editor stacks in one column, and at `1280 × 800` the desktop layout returns.

---

## Edge Cases

- WHEN a 4/4 16-step bar is shown in the Editor at `1080 × 1920` THEN the system SHALL fit all 16 steps across the grid with no left or right fade; WHEN a 32-step bar (`8/4` with sextuplets or `16/4`) exceeds the grid width at `1080 × 1920` THEN the system SHALL scroll the steps sideways under the sticky track names and draw the edge fades (PRT-04).
- WHILE the window is `900 × 600` (narrower than 1024 px wide, but wider than 3:4) the system SHALL keep the desktop header links and show no fixed tab bar or transport bar (PRT-07).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PRT-01 | P1: Full-width mobile experience on 9:16 and portrait desktop windows | Execute | Verified |
| PRT-02 | P1: Full-width mobile experience on 9:16 and portrait desktop windows | Execute | Verified |
| PRT-03 | P1: Full-width mobile experience on 9:16 and portrait desktop windows | Execute | Verified |
| PRT-04 | P1: Full-width mobile experience on 9:16 and portrait desktop windows | Execute | Verified |
| PRT-05 | P1: Full-width mobile experience on 9:16 and portrait desktop windows | Execute | Verified |
| PRT-06 | P1: Full-width mobile experience on 9:16 and portrait desktop windows | Execute | Verified |
| PRT-07 | P1: Full-width mobile experience on 9:16 and portrait desktop windows | Execute | Verified |

**Coverage:** 7 total, 7 mapped to checks, 0 unmapped

---

## Sources

- The request, 2026-11-17: "usando o skill grilling e tlc-spec-driven vamos dar a mesma experiencia hoje do mobile, para telas na 9:16 pra desktop, hoje nessa proporcao no desktop fica estranho"
- Grilling round 1, Q1 to Q3, user: "recomendacoes" (AD-032)
- `.specs/features/mobile-app/spec.md` - the phone layout rules (`MOB-01` to `MOB-49`)
- `.stitch/DESIGN.md` - the design system

---

## Success Criteria

- [x] At `900 × 1600`, `1080 × 1800` and `1080 × 1920`, all four screens show the mobile layout with full-width panels, a square Stadium clock above the fixed Play button, and no horizontal page overflow.
- [x] At `768 × 800` and `1280 × 800`, the desktop layout is unchanged.

---

## Execution Plan

Tasks skipped: one atomic implementation step, then verification.

1. [x] Apply the phone layout at `@media (max-width: 767px), (max-aspect-ratio: 3/4)` with full-width Stadium panel, single-column Editor and a square beat clock capped by the column width, and cover `PRT-01` to `PRT-07` in `tests/mobile/phone.test.ts` → files: `src/ui/index.css`, `tests/mobile/phone.test.ts` → verify: `npx vitest run --config vitest.mobile.config.ts --reporter=verbose && npm run test:js && npm run build` → commit: `feat(ui): use the phone layout on 9:16 and portrait desktop windows`

**Build**: `npm run build; npm run test:js`
**Run mobile**: `npx vitest run --config vitest.mobile.config.ts --reporter=verbose`

## Checks

**C1** - At 540 × 960, 720 × 1280, 900 × 1600, 1080 × 1800, 1080 × 1920 and 768 × 1024, Editor, Stadium, Grooves and Improv each have page scrollWidth equal to the window width (PRT-01, AC 1)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > prt_01 no sideways page scroll on portrait desktop windows

**C2** - At 768 × 1024, 900 × 1600, 1080 × 1800 and 1080 × 1920 across all four screens, the logo sits alone on the first header row, Click and Preset sit on the row below it, no screen links sit in the header, and the four icon tabs `Stadium`, `Editor`, `Grooves`, `Improv` sit fixed to the bottom of the window before and after scrolling (PRT-02, AC 2)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > prt_02 compact header and fixed bottom tab bar on portrait desktop

**C3** - At 900 × 1600, 1080 × 1800 and 1080 × 1920 on Stadium, the Stadium panel spans the display's full inner width above the beat clock, the Play button stays fixed directly above the tab bar before and after scrolling, and at scroll 0 the tempo with − and +, the four orbs, the square beat clock (at least 200 px wide) and its legend sit above the Play button (PRT-03, AC 3)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > prt_03 stadium full-width panel, square clock and fixed play on 9:16 desktop

**C4** - At 768 × 1024, 900 × 1600, 1080 × 1800 and 1080 × 1920 in the Editor, the controls column stacks below the sequencer column, the transport bar sits fixed directly above the tab bar, the figure palette sits on one row, a 16-step 4/4 bar fits at 1080 × 1920 with no edge fade, and a 32-step bar scrolls sideways under sticky track names with edge fades (PRT-04, AC 4)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > prt_04 editor single column, transport bar, one-row palette and sticky grid on portrait desktop

**C5** - At 768 × 1024, 900 × 1600 and 1080 × 1920 across all four screens, every visible button, select, range thumb and tab is at least 44 × 44 px, every step cell is at least 32 × 32 px, and every input and select has text at least 16 px (PRT-05, AC 5)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > prt_05 touch targets 44 px, step cells 32 px and fields 16 px on portrait desktop

**C6** - At 768 × 1024, 900 × 1600 and 1080 × 1920, scrolling Editor, Stadium, Grooves or Improv to its end places the view and footer above the tab bar, above the transport bar in the Editor, and above the Play button on Stadium (PRT-06, AC 6)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > prt_06 last element clears the fixed bars on portrait desktop

**C7** - At 768 × 800, 769 × 1024, 900 × 600, 1280 × 800 and 1920 × 1080, the four screen links stay in the header with no tab icons, nothing is fixed to the window, the transport bar is hidden, and the Stadium Play button stays static inside the Stadium panel (PRT-07, AC 7)
Proof: run mobile | ✓ tests/mobile/phone.test.ts > Mobile App > prt_07 desktop windows wider than 3:4 keep the desktop layout

---

## Handoff

**Settled mid-build:** none
**Dispatched:** Verifier at 3044adc, returned with 1 finding, closed at 6e5c676
**Walked:** Headless Chrome on the Vite dev server (no sign-in or seed data; screens opened via `#nav-*`). At 1080 × 1920 and 900 × 1600: Stadium opened with the compact two-row header, full-width panel (1048 px at 1080, 868 px at 900) above a 1:1 square beat clock (1048 × 1048 and 868 × 868) and legend above the fixed PLAY bar and bottom tab bar (`scrollWidth === width`), clicking `+` twice stepped tempo to `122.0`. Editor stacked in one column with one-row figure palette, full-width 16-step grid (`maxScroll: 0`), two-column mix cards, fixed transport bar (showing `122` then `123` on `+`) above the tab bar. Grooves (`1` song column, `scrollWidth: 1080`) and Improv (`6` root columns, `scrollWidth: 1080`) fit without overflow. At 1280 × 800, desktop header links, two-column Stadium (560 × 560 clock beside 576 px panel with static PLAY inside), and two-column Editor returned unchanged.
