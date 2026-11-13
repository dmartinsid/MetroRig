# Stadium Tempo Specification

**Approved**: 2026-11-12 - user: "Aprovado"

## Problem Statement

The Stadium shows the tempo but cannot change it. To nudge the BPM during practice, the user has to leave the Stadium for the header slider, which loses the screen built for playing along. The app has no keyboard shortcut either, so the hands leave the instrument for the mouse.

## Goals

- [ ] On the Stadium, the tempo goes up or down 1 BPM with one click or one key press
- [ ] The header shows the same tempo the Stadium set, slider included

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Steps other than 1 BPM, Shift for 5 | Q1, user: "Recomendacoes" |
| The `+` and `-` keys on the Editor, Grooves or Improv screens | Q5, user: "Recomendacoes" |
| Changing the Trainer's start or target BPM from the Stadium | Q6, user: "Recomendacoes" |
| Other keyboard shortcuts, such as Space for Play | Not asked |
| A tempo outside 40 to 240 BPM | Q3, user: "Recomendacoes" |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Step | 1 BPM per click or key press; a held key repeats at the keyboard's own rate | Q1, user: "Recomendacoes" | y |
| Place of the buttons | A `−` button left of the Stadium's BPM number and a `+` button right of it | Q2, user: "Recomendacoes" | y |
| Bounds | 40 to 240 BPM, as the header slider; the button at a bound is disabled, its key does nothing | Q3, user: "Recomendacoes" | y |
| Keys | Up: `+`, `=`, numpad `+`. Down: `-`, numpad `-`. Ignored with Ctrl or Cmd held | Q4, user: "Recomendacoes" | y |
| Where the keys act | Only while the Stadium is open, and never while focus sits in a text field | Q5, user: "Recomendacoes" | y |
| Trainer on | Both buttons disabled and both keys ignored while the loaded preset's Trainer is enabled | Q6, user: "Recomendacoes" | y |
| Effect of a change | As the header slider: applies live during playback, marks the preset edited, and the header number and slider follow | Q7, user: "Recomendacoes" | y |
| Which Trainer state disables the controls | The applied one, `preset.trainerSettings.enabled`, the one the engine runs; a Trainer typed in the Editor form but not applied does not disable them | The engine only overrides the tempo with the Trainer it runs; user: "Aprovado" | y |
| A fractional tempo | A step from a fractional BPM rounds to the next whole BPM in the step's direction: 120.4 up gives 121, down gives 120 | Only the Trainer's smooth ramp leaves a fraction, and the slider holds whole BPM; user: "Aprovado" | y |
| Where a step starts after a ramp | From the last tick's tempo at the moment the Trainer is turned off; it lags the engine by the output latency, so a stepped ramp that moved inside that window starts one increment early | PR #15 review: the step read `preset.bpm` while the engine kept the ramp's tempo (`syncPlaybackSettings` sends no BPM). TMP-01 already says "the current BPM". User, on the lag: "Sem problemas do incremento ser abaixo" | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Nudge the tempo on the Stadium ⭐ MVP

**User Story**: As a musician practising on the Stadium, I want to raise or lower the tempo 1 BPM at a time with a button or a key, so that I adjust the speed without leaving the screen or the instrument.

**Why P1**: It is the whole request.

**Acceptance Criteria**:

1. WHEN the user clicks the Stadium's `+` button THEN the system SHALL set the tempo to the current BPM plus 1, and show it in the Stadium's BPM number  <!-- TMP-01 -->
2. WHEN the user clicks the Stadium's `−` button THEN the system SHALL set the tempo to the current BPM minus 1, and show it in the Stadium's BPM number  <!-- TMP-02 -->
3. WHEN the user presses `+`, `=` or numpad `+` while the Stadium is open THEN the system SHALL raise the tempo by 1 BPM  <!-- TMP-03 -->
4. WHEN the user presses `-` or numpad `-` while the Stadium is open THEN the system SHALL lower the tempo by 1 BPM  <!-- TMP-04 -->
5. IF Ctrl or Cmd is held with one of those keys THEN the system SHALL leave the tempo unchanged and let the browser handle the key  <!-- TMP-05 -->
6. IF the Editor, Grooves or Improv screen is open WHEN the user presses one of those keys THEN the system SHALL leave the tempo unchanged  <!-- TMP-06 -->
7. IF focus sits in a text field WHEN the user presses one of those keys THEN the system SHALL leave the tempo unchanged  <!-- TMP-07 -->
8. WHILE the tempo is 240 BPM the system SHALL disable the `+` button and ignore the raising keys  <!-- TMP-08 -->
9. WHILE the tempo is 40 BPM the system SHALL disable the `−` button and ignore the lowering keys  <!-- TMP-09 -->
10. WHILE the loaded preset's Trainer is enabled the system SHALL disable both buttons and ignore all four keys  <!-- TMP-10 -->
11. WHEN the tempo changes from the Stadium during playback THEN the system SHALL send the new BPM to the engine at once  <!-- TMP-11 -->
12. WHEN the tempo changes from the Stadium THEN the system SHALL mark the preset edited, as a slider change does  <!-- TMP-12 -->
13. WHEN the tempo changes from the Stadium THEN the system SHALL show the new BPM in the header's number, the slider's value label and the slider's position  <!-- TMP-13 -->
14. WHEN a step starts from a fractional BPM THEN the system SHALL round to the next whole BPM in the step's direction  <!-- TMP-14 -->
15. WHEN the Trainer is turned off during playback THEN the system SHALL step from the tempo the ramp left in the engine, until Stop, a preset load or a step replaces it  <!-- TMP-15 -->

**Independent Test**: Open the Stadium at 120 BPM, click `+` twice and press `-` once: the Stadium and the header read 121.

---

## Edge Cases

- WHEN the tempo is 239 and the user presses `+` twice THEN the system SHALL stop at 240 (TMP-08)
- WHEN a preset with the Trainer on is loaded on the Stadium THEN the system SHALL disable both buttons (TMP-10)
- WHEN a preset with the Trainer off is loaded after one with it on THEN the system SHALL enable both buttons, each within its bound (TMP-08, TMP-09, TMP-10)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TMP-01 | P1: Nudge the tempo | Tasks | Pending |
| TMP-02 | P1: Nudge the tempo | Tasks | Pending |
| TMP-03 | P1: Nudge the tempo | Tasks | Pending |
| TMP-04 | P1: Nudge the tempo | Tasks | Pending |
| TMP-05 | P1: Nudge the tempo | Tasks | Pending |
| TMP-06 | P1: Nudge the tempo | Tasks | Pending |
| TMP-07 | P1: Nudge the tempo | Tasks | Pending |
| TMP-08 | P1: Nudge the tempo | Tasks | Pending |
| TMP-09 | P1: Nudge the tempo | Tasks | Pending |
| TMP-10 | P1: Nudge the tempo | Tasks | Pending |
| TMP-11 | P1: Nudge the tempo | Tasks | Pending |
| TMP-12 | P1: Nudge the tempo | Tasks | Pending |
| TMP-13 | P1: Nudge the tempo | Tasks | Pending |
| TMP-14 | P1: Nudge the tempo | Tasks | Pending |
| TMP-15 | P1: Nudge the tempo | Tasks | Pending |

**Coverage:** 15 total, 15 mapped to checks

## Sources

- Request: "na tela do stadium implementar controles pra aumentar o diminuir o tempo, e utilizar tb as teclas de mais e menos"
- Grilling round 1, Q1 to Q7, user: "Recomendacoes"
- AD-028: the step, the bounds, the key map and the Trainer guard run in `app` or `domain`; `ui` renders Session state

## Success Criteria

- [ ] From 120 BPM, two `+` and one `-` on the Stadium leave 121 BPM on the Stadium and the header
- [ ] No key changes the tempo outside the Stadium

