# Mobile App Specification

**Approved**: 2026-11-14 - user: "Aprovada"

## Problem Statement

On a phone MetroRig spills off the screen and works like a shrunken desktop page. At 360 px the Stadium orbs push the page 6 px wider than the window and the Click selector reads `Digita`; in the Editor, Play and the tempo sit about 1,500 px below the grid, the figure palette takes five rows, and the grid is cut at the right edge with no sign that more lies there. The navigation sits at the top, out of the thumb's reach, and the page flashes on tap, zooms on double tap and on focusing a field, ignores the notch and cannot be installed.

## Goals

- [ ] No screen scrolls sideways at any width from 360 to 430 px, and no control's text is cut.
- [ ] Every screen is one thumb tap away, and Play and the tempo are always in reach in the Editor.
- [ ] Added to the home screen, MetroRig opens full screen like an app and keeps the phone awake while it plays.
- [ ] Windows 768 px and wider look and behave as they do today, apart from the screen order of AD-030.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Offline play (service worker) | Q3: offered, not chosen |
| Haptic feedback | Q3: offered, not chosen; iOS Safari has no Vibration API |
| The grid following the playhead while playing | It fights a user scrolling to edit; deferred |
| A layout change for windows 768 px and wider | The request is about the phone; AD-030's screen order is the one exception |
| Landscape-specific layouts | A phone on its side gets the same layout, held to MOB-01 only |
| New features on any screen | The request is about how the existing screens fit and feel |
| A Stitch capture for the phone layout | No capture came with the request; the layout follows `.stitch/DESIGN.md` |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | --------------- | --------- | ---------- |
| Stadium controls on top | Controls first, clock below, sized to fit above Play on 390 × 844 and larger; scrolls on shorter phones | User: "se der pra colocar tudo no mesmo espaco melhor, mas se nao der vamos alterar pra essa forma" (AD-031) | y |
| A phone between the named sizes, or an installed iPhone with its insets | The clock never shrinks under 200 px: it fills the room above Play when that room holds it, and otherwise keeps 240 px or more below the orbs and the screen scrolls | The Verifier measured 109-187 px clocks on 761-818 px windows and installed iPhones; AD-031's rule, user: "se der pra colocar tudo no mesmo espaco melhor, mas se nao der vamos alterar pra essa forma" | y |
| Stadium first and its Play | Stadium first in both widths, opens first on a first visit, Play fixed above the tabs on phones | Mid-build, user: "Sim, abre no Stadium (Recommended)", "Fixo embaixo no celular (Recommended)" (AD-030) | y |
| Phone layout | Applies at window widths up to 767 px, the existing narrow breakpoint | `src/ui/index.css` already switches there | y, presented with the spec, user: "Aprovada" |
| Widths held to the criteria | 360, 375, 390 and 430 px wide, portrait | The common Android and iPhone widths | y, presented with the spec, user: "Aprovada" |
| Navigation | Bottom tab bar, icon and name, for the four screens | Q1, user: "Tab bar fixa embaixo (Recommended)" | y |
| Editor transport | Bar fixed above the tab bar: BPM −, value, BPM +, Play/Stop; Tempo Bus card keeps its slider | Q2, user: "Barra de transporte fixa (Recommended)" | y |
| Transport bar on other screens | Editor only | Stadium has its own large Play and −/+; Grooves plays per song; Improv has no transport | y, presented with the spec, user: "Aprovada" |
| Transport bar tempo step | 1 BPM per tap, the same rule as the Stadium −/+ (refused at the bounds and while the Trainer is on) | `session.stepBpm` already holds this rule | y, presented with the spec, user: "Aprovada" |
| Native capabilities | Installable manifest and screen wake lock | Q3, user: "Instalável (Recommended), Tela não apaga (Recommended)" | y |
| Wake lock scope | Held while the metronome plays or a chord pad sounds | Both are sound the user is practising with | y, presented with the spec, user: "Aprovada" |
| Grid | Fixed narrow column of track names; steps scroll sideways, snapping to each beat; a fade marks each edge with more steps; figure palette is one scrolling row | Q4, user: "Rolagem com rótulos fixos (Recommended)" | y |
| Top bar | Logo on one row, Click and Preset selectors on the next; scrolls away with the page | The tab bar now carries navigation; a sticky top bar would cover the Improv roots, which `index.css` already avoids | y, presented with the spec, user: "Aprovada" |
| Touch targets | 44 × 44 px for every button, select and tab; 32 × 32 px for step cells | Apple HIG 44 pt; a 16-step bar at 44 px would need three screens of scrolling | y, presented with the spec, user: "Aprovada" |
| Field text size | 16 px for inputs and selects | iOS Safari zooms the page on focusing a field under 16 px | y, presented with the spec, user: "Aprovada" |
| App name and colours | `MetroRig`, theme and background `#080810` | `--bg` token | y, presented with the spec, user: "Aprovada" |
| App icon | The `METRORIG` neon-green mark on `#080810`, 192, 512, maskable 512 and 180 (Apple) PNG | No icon exists in `public/` | y, presented with the spec, user: "Aprovada" |
| Auth, rate limits, data expiry, idempotency, concurrency | N/A because the feature changes layout and adds two browser calls, with no server or stored data | Sweep | y |
| External-dependency failure | Wake Lock missing or refused leaves playback untouched (MOB-30) | Sweep | y |
| Observability | N/A because nothing here can fail silently in a way the user cares about beyond MOB-30 | Sweep | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Nothing spills off the phone ⭐ MVP

**User Story**: As a musician on a phone, I want every screen to fit the width so that I never scroll sideways or read cut text.

**Why P1**: This is the reported bug.

**Acceptance Criteria**:

1. MOB-01: WHILE the window is 360, 375, 390 or 430 px wide the system SHALL show the Editor, Stadium, Grooves and Improv screens with the page's scroll width equal to the window width.
2. MOB-02: WHILE the window is 360 px wide the system SHALL show the Click selector's chosen sound and the Preset selector's chosen preset with no text cut, for every click sound and for the preset `4/4 Metronome`.
3. MOB-03: WHILE the window is 360 px wide the system SHALL show the four Stadium orbs, their names and the tempo − and + buttons inside the Stadium panel.
4. MOB-04: WHILE the window is 767 px wide or narrower the system SHALL give every visible button, select, range thumb and tab a hit area at least 44 × 44 px, and every step cell at least 32 × 32 px.
5. MOB-05: WHILE the window is 767 px wide or narrower the system SHALL show every input and select with text at least 16 px.

**Independent Test**: Open each screen at 360 px; nothing scrolls sideways, `Digital` reads in full, all four orbs sit in the panel.

---

### P1: Tab bar ⭐ MVP

**User Story**: As a musician on a phone, I want the screens in a bar at the bottom so that I switch with my thumb.

**Why P1**: Q1.

**Acceptance Criteria**:

1. MOB-06: WHILE the window is 767 px wide or narrower the system SHALL show `Editor`, `Stadium`, `Grooves` and `Improv`, each with an icon, in a bar fixed to the bottom of the window.
2. MOB-07: WHEN the user taps a tab THEN the system SHALL show that screen and mark that tab, and only that tab, with `aria-current="page"`.
3. MOB-08: WHILE a chord pad sounds the system SHALL light the status dot on the `Improv` tab.
4. MOB-09: The system SHALL pad the tab bar's bottom by the window's bottom safe-area inset.
5. MOB-10: WHEN the user scrolls any screen to its end THEN the system SHALL show its last element above the tab bar and, in the Editor, above the transport bar.
6. MOB-11: WHILE the window is 768 px wide or wider the system SHALL show the four screen links in the header and no tab bar.
7. MOB-12: WHILE the window is 767 px wide or narrower the system SHALL show the logo on one row and the Click and Preset selectors together on the row below it, and no screen links in the header.

**Independent Test**: At 375 px tap each tab; the screen changes and the tab lights; at 1280 px the header links are back.

---

### P1: Editor transport bar ⭐ MVP

**User Story**: As a musician editing a pattern on a phone, I want Play and the tempo always in reach so that I hear each change without scrolling.

**Why P1**: Q2.

**Acceptance Criteria**:

1. MOB-13: WHILE the Editor is shown and the window is 767 px wide or narrower the system SHALL show a bar fixed above the tab bar with a `−` button, the tempo in BPM, a `+` button and a Play button.
2. MOB-14: WHILE Stadium, Grooves or Improv is shown the system SHALL hide the transport bar.
3. MOB-15: WHEN the user taps the transport bar's Play THEN the system SHALL start playback, and both the transport bar and the Tempo Bus card SHALL show Stop.
4. MOB-16: WHEN the user taps the transport bar's Stop THEN the system SHALL stop playback, and both the transport bar and the Tempo Bus card SHALL show Play.
5. MOB-17: WHEN the user taps the Tempo Bus Play or Stop THEN the transport bar SHALL show the same Play or Stop state as the Tempo Bus card.
6. MOB-18: WHEN the user taps `+` THEN the system SHALL raise the tempo 1 BPM, and the transport bar, the Tempo Bus number and the Tempo Bus slider SHALL show the new tempo.
7. MOB-19: WHEN the user taps `−` THEN the system SHALL lower the tempo 1 BPM, and the transport bar, the Tempo Bus number and the Tempo Bus slider SHALL show the new tempo.
8. MOB-20: WHEN the tempo changes by the slider, a preset load or a Trainer step THEN the transport bar SHALL show the new tempo.
9. MOB-21: IF the tempo is 240 BPM THEN the system SHALL disable `+`; IF it is 40 BPM THEN the system SHALL disable `−`.
10. MOB-22: WHILE the Tempo Trainer is enabled the system SHALL disable `−` and `+`, as on the Stadium screen.

**Independent Test**: At 375 px in the Editor, scroll to the grid's bottom, tap Play, tap `+` twice; it plays at 122 BPM and the Tempo Bus card reads 122.

---

### P1: Scrolling grid ⭐ MVP

**User Story**: As a musician on a phone, I want to scroll the steps while the track names stay put so that I always know which row I am editing.

**Why P1**: Q4.

**Acceptance Criteria**:

1. MOB-23: WHILE the window is 767 px wide or narrower and the grid is scrolled sideways the system SHALL keep every track name in view at the grid's left edge.
2. MOB-24: WHEN the user ends a sideways scroll of the grid THEN the system SHALL settle it with a beat's first cell at the left edge of the step area.
3. MOB-25: WHILE more steps lie beyond the grid's right edge the system SHALL show a fade on that edge; WHILE none do, it SHALL show no fade there.
4. MOB-26: WHILE more steps lie beyond the step area's left edge the system SHALL show a fade on that edge; WHILE none do, it SHALL show no fade there.
5. MOB-27: WHILE the window is 767 px wide or narrower the system SHALL show the figure palette as one row that scrolls sideways.

**Independent Test**: At 375 px drag the grid left; names stay, it snaps to a beat, the right fade goes at the end and a left fade appears.

---

### P2: Installable app

**User Story**: As a musician, I want MetroRig on my home screen so that it opens full screen like an app.

**Why P2**: Q3.

**Acceptance Criteria**:

1. MOB-28: The system SHALL link a web app manifest with `name` and `short_name` `MetroRig`, `display` `standalone`, `start_url` and `scope` `./`, `theme_color` and `background_color` `#080810`, and PNG icons of 192 and 512 px plus a 512 px icon with `purpose` `maskable`.
2. MOB-29: The system SHALL declare a `theme-color` of `#080810`, an `apple-touch-icon` of 180 px, `apple-mobile-web-app-capable` `yes`, `apple-mobile-web-app-status-bar-style` `black-translucent` and a viewport with `viewport-fit=cover`.
3. MOB-30: WHEN the site is built THEN every icon the manifest and the page name SHALL resolve under the `/MetroRig/` base.
4. MOB-31: The system SHALL pad the top bar's top by the window's top safe-area inset.

**Independent Test**: Build, serve under `/MetroRig/`, Chrome's Application panel lists the manifest with no errors and the icons load.

---

### P2: Screen stays awake

**User Story**: As a musician practising with my phone on a stand, I want the screen to stay on while MetroRig plays so that I can see the beat.

**Why P2**: Q3.

**Acceptance Criteria**:

1. MOB-32: WHEN playback starts or a chord pad starts sounding THEN the system SHALL request a screen wake lock.
2. MOB-33: WHEN playback stops and no chord pad sounds, or a chord pad stops and playback is stopped, THEN the system SHALL release the wake lock.
3. MOB-34: WHEN the page becomes visible again while playback runs or a chord pad sounds THEN the system SHALL request the wake lock again.
4. MOB-35: IF the browser has no Wake Lock API or refuses the request THEN the system SHALL play on and show no error.

**Independent Test**: With a stub wake lock, Play requests it, Stop releases it, hiding and showing the page requests it again.

---

### P2: Touch feel

**User Story**: As a musician on a phone, I want taps to feel like an app so that the page never flashes, zooms or selects text under my thumb.

**Why P2**: The request's "tao boa quanto fosse um app nativo".

**Acceptance Criteria**:

1. MOB-36: The system SHALL show no tap highlight on any button, tab, step cell or pad.
2. MOB-37: The system SHALL set `touch-action: manipulation` on the page so that a double tap does not zoom it.
3. MOB-38: The system SHALL set `user-select: none` on buttons, tabs, step cells and pads so that a long press selects no text.
4. MOB-39: The system SHALL set `overscroll-behavior-y: none` on the page so that pulling past the top does not reload it during practice.

**Independent Test**: At 375 px with touch emulation, double tap a step cell and long-press a pad; the page neither zooms nor selects.

---

### P1: Stadium first

**User Story**: As a musician, I want Stadium first and its Play in reach so that practice starts with one tap.

**Why P1**: Mid-build request, AD-030.

**Acceptance Criteria**:

1. MOB-40: The system SHALL list the screen links in the order `Stadium`, `Editor`, `Grooves`, `Improv`, in the header at 768 px and wider and in the tab bar at 767 px and narrower.
2. MOB-41: WHEN a visitor opens MetroRig with no saved screen THEN the system SHALL show Stadium and mark the `Stadium` link with `aria-current="page"`.
3. MOB-42: WHEN a visitor opens MetroRig with a saved screen THEN the system SHALL show that screen.
4. MOB-43: WHILE Stadium is shown and the window is 767 px wide or narrower the system SHALL show the Stadium Play button fixed directly above the tab bar, before and after scrolling.
5. MOB-44: WHILE the window is 768 px wide or wider the system SHALL show the Stadium Play button inside the Stadium panel.

**Independent Test**: Clear site data, open at 375 px: Stadium shows, its tab is first and lit, PLAY sits above the tabs; scroll, PLAY stays; at 1280 px the header reads Stadium first and PLAY is in the panel.

---

### P1: Stadium controls on top

**User Story**: As a musician on a phone, I want the tempo and controls at the top of Stadium and the clock below so that I set the tempo without scrolling.

**Why P1**: Request after the feature closed, AD-031.

**Acceptance Criteria**:

1. MOB-45: WHILE Stadium is shown and the window is 767 px wide or narrower the system SHALL show the routine selector, the timer, the tempo with its − and + buttons, the Trainer status and the four orbs above the beat clock.
2. MOB-46: WHILE the window is 390 × 844, 393 × 852, 412 × 915 or 430 × 932 the system SHALL show, at scroll 0 on Stadium, the tempo with − and +, the four orbs, the whole beat clock and its legend between the top of the window and the Stadium Play button, with the clock at least 200 px wide.
3. MOB-47: WHILE the window is 360 × 640 or 375 × 667 the system SHALL show, at scroll 0 on Stadium, the tempo with − and + above the Stadium Play button, and SHALL draw the beat clock at least 240 px wide below the orbs.
4. MOB-48: WHILE Stadium is shown and the window is 767 px wide or narrower the system SHALL draw the beat clock at least 200 px wide at every window height and safe-area inset; where the room above the Play button cannot hold it, the clock SHALL sit below the orbs and be reached by scrolling.
5. MOB-49: WHILE Stadium is shown and the window is 767 px wide or narrower the system SHALL draw the timer and the Trainer status side by side with no overlap and both inside the Stadium panel, for every speed-trainer routine and with the Trainer off.

**Independent Test**: At 390 × 844 open Stadium: tempo, orbs and the whole clock show above PLAY without scrolling; at 375 × 667 the tempo shows at once and the clock is reached by scrolling.

---

## Edge Cases

- MOB-21 and MOB-22 cover the tempo bounds and the Trainer.
- MOB-35 covers a browser with no Wake Lock.
- MOB-25 and MOB-26 cover a pattern short enough to fit with no scroll: no fade on either edge.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| MOB-01 | P1: Nothing spills off the phone | Execute | Verified |
| MOB-02 | P1: Nothing spills off the phone | Execute | Verified |
| MOB-03 | P1: Nothing spills off the phone | Execute | Verified |
| MOB-04 | P1: Nothing spills off the phone | Execute | Verified |
| MOB-05 | P1: Nothing spills off the phone | Execute | Verified |
| MOB-06 | P1: Tab bar | Execute | Verified |
| MOB-07 | P1: Tab bar | Execute | Verified |
| MOB-08 | P1: Tab bar | Execute | Verified |
| MOB-09 | P1: Tab bar | Execute | Verified |
| MOB-10 | P1: Tab bar | Execute | Verified |
| MOB-11 | P1: Tab bar | Execute | Verified |
| MOB-12 | P1: Tab bar | Execute | Verified |
| MOB-13 | P1: Editor transport bar | Execute | Verified |
| MOB-14 | P1: Editor transport bar | Execute | Verified |
| MOB-15 | P1: Editor transport bar | Execute | Verified |
| MOB-16 | P1: Editor transport bar | Execute | Verified |
| MOB-17 | P1: Editor transport bar | Execute | Verified |
| MOB-18 | P1: Editor transport bar | Execute | Verified |
| MOB-19 | P1: Editor transport bar | Execute | Verified |
| MOB-20 | P1: Editor transport bar | Execute | Verified |
| MOB-21 | P1: Editor transport bar | Execute | Verified |
| MOB-22 | P1: Editor transport bar | Execute | Verified |
| MOB-23 | P1: Scrolling grid | Execute | Verified |
| MOB-24 | P1: Scrolling grid | Execute | Verified |
| MOB-25 | P1: Scrolling grid | Execute | Verified |
| MOB-26 | P1: Scrolling grid | Execute | Verified |
| MOB-27 | P1: Scrolling grid | Execute | Verified |
| MOB-28 | P2: Installable app | Execute | Verified |
| MOB-29 | P2: Installable app | Execute | Verified |
| MOB-30 | P2: Installable app | Execute | Verified |
| MOB-31 | P2: Installable app | Execute | Verified |
| MOB-32 | P2: Screen stays awake | Execute | Verified |
| MOB-33 | P2: Screen stays awake | Execute | Verified |
| MOB-34 | P2: Screen stays awake | Execute | Verified |
| MOB-35 | P2: Screen stays awake | Execute | Verified |
| MOB-36 | P2: Touch feel | Execute | Verified |
| MOB-37 | P2: Touch feel | Execute | Verified |
| MOB-38 | P2: Touch feel | Execute | Verified |
| MOB-39 | P2: Touch feel | Execute | Verified |
| MOB-40 | P1: Stadium first | Execute | Verified |
| MOB-41 | P1: Stadium first | Execute | Verified |
| MOB-42 | P1: Stadium first | Execute | Verified |
| MOB-43 | P1: Stadium first | Execute | Verified |
| MOB-44 | P1: Stadium first | Execute | Verified |
| MOB-45 | P1: Stadium controls on top | Execute | Verified |
| MOB-46 | P1: Stadium controls on top | Execute | Verified |
| MOB-47 | P1: Stadium controls on top | Execute | Verified |
| MOB-48 | P1: Stadium controls on top | Execute | Verified |
| MOB-49 | P1: Stadium controls on top | Design | Pending |

**Coverage:** 49 total, 49 mapped to tasks, 0 unmapped

---

## Sources

- The request, 2026-11-14 - the problem and the native-app bar.
- `.specs/features/mobile-app/context.md` - Q1 to Q4 and their answers.
- `.stitch/DESIGN.md` - the design system the phone layout is held to.

---

## Success Criteria

- [ ] At 360 px no screen's scroll width exceeds the window (today Stadium is 366 px).
- [ ] In the Editor at 375 px, Play is on screen at every scroll position (today only after scrolling about 1,500 px).
- [ ] Chrome reports the app installable.
