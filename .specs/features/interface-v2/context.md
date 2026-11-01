# Interface V2 Context

**Gathered:** 2026-10-31
**Spec:** `.specs/features/interface-v2/spec.md`
**Status:** Discussion closed - spec awaiting approval

---

## Feature Boundary

MetroRig's Editor and Stadium screens are rebuilt to match the Stitch captures, on the current stack and with the audio engine untouched.

Request: "O stitch deu uma sugestao de design, vamos implementar ela utilizando o skill grilling e tlc-spec-driven"

---

## Implementation Decisions

Round 1. Answers quoted from the user: "q1 uma das telas ta aqui ... q2 recomendacao q3 recomendacao q4 recomendacao q5 recomendacao q6 recomendacao q7 q8 q9 q11 q12 recomendacoes".

### Sources (Q1)

- The Stitch exports are binding: `captures/stadium.png` (1600x1280) and `captures/editor.png` (1252x1227).
- The white band under the Editor capture is an export artifact, not part of the design.
- `captures/*.stitch.html` and `prd.md` are the exports they came with.

### Stack and scope (Q2, Q3)

- Keep plain TypeScript, CSS tokens, `StateManager` and GSAP tick sync. No Tailwind, store library or routes.
- PRD Phase 4 is cut. The Rust engine and the WASM binary stay out of scope.
- PRD Phases 1 to 3 ship as one feature.

### Footer (Q4)

- Shows real data only, such as `44.1 kHz · 128 SPLS (2.9ms)` and the output latency the browser reports.
- No engine version, no CPU monitor, no "Hardware Parity".

### Header (Q5, Q6)

- The links `Editor`, `Stadium`, `Grooves`, `Presets` and the `settings` and `tune` icons are removed.
- The toggle reads `GO TO STADIUM MODE` / `GO TO EDITOR MODE`.
- The full preset selector stays, with its 4 groups, where the capture draws "Meter".

### Mute and Solo (Q7)

- Per-track M and S, implemented by sending an empty grid to silenced tracks. No Rust change.
- Session only, never saved in a preset.

### Editor telemetry (Q8)

- `SYNC: INTERNAL AUDIO CORE` is removed.
- `PAT` shows the real preset name.
- `STEPS`, `RESOLUTION` and `POS: BAR 01 · STEP 01` show real values, updated during playback.

### Timer (Q9)

- One `HH:MM:SS` timer in both modes, keeping today's rule: restarts on Play, freezes on Stop.

### Indicators (Q11)

- Trainer dots are steady, never pulsing.

### Narrow windows (Q12)

- Below 1024px the Editor stacks the controls under the sequencer.
- Only the grid scrolls horizontally.
- Validated at 1440, 1024 and 390px.

---

## Round 2

Answer quoted from the user: "Recomendacoes". It accepts Q10 and Q13 to Q18, plus the listed defaults.

### Groove library (Q10)

- Names show no BPM.
- `Metalcore Breakdown` joins the factory grooves.

### Orbs (Q13)

- Rounded squares of about 60px with an icon and a track name, as the capture draws.
- Indicators only, with no click.

### Grid (Q14)

- The beat spacer and the sustain state stay.

### Mute and Solo rules (Q15)

- Several tracks can be soloed at once.
- Solo wins over Mute.
- State survives preset loads and clears on page reload.
- Silenced rows are dimmed and their orbs don't react.
- Saving keeps the real grid.

### Labels (Q16, Q17)

- `MASTER` and `MTR-04` go. `TEMPO BUS` stays.
- `STEPS` reads measure length over the engine limit, such as `STEPS: 16/32`.

### Save Toast (Q18)

- It still appears only after an edit. The capture is the state after an edit.

### Stated defaults

- `PRO` logo and two header selectors, rounded Play, portrait cells, switch and steppers, open Trainer card.
- `Trainer Off` in the status pill, a playback dot in the sequencer header, `BAR 01 · STEP 01` when stopped, `--` latency before the first Play.
- Native dialogs stay. `.stitch/DESIGN.md` is updated at the end.

---

## Specific References

- `captures/stadium.png`, `captures/editor.png`
- `prd.md`

---

## Deferred Ideas

None - discussion stayed within feature scope.
