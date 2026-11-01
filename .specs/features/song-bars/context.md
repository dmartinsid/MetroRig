# Song Bars Context

**Gathered:** 2026-11-01
**Spec:** `.specs/features/song-bars/spec.md`
**Status:** Spec approved, user: "aprovado"

---

## Feature Boundary

Each of the 14 songs plays 4 bars in place of 1, so it reads as a real part of the song. The user's words: "Pensando aqui talvez o ideal eh ter 4 compassos de cada musica, ai vai parecer algo mais real". Measured on the 14 tabs at the current source measure: 2 songs hold 4 different bars, 5 hold 3, 5 hold 2, and 2 hold 1, Highway to Hell and Crossroads.

---

## Implementation Decisions

All five questions below were answered "recomendacoes".

### Which patterns hold 4 bars (Q1)

- Only the 14 songs. Presets and grooves keep 1 bar.
- A song saved as a preset keeps its 4 bars.

### Which 4 bars (Q2)

- Four consecutive bars, as the tab writes them, fills included.
- A stretch that cuts a phrase gives way to another one. Highway to Hell and Crossroads move to another stretch.

### Editor (Q3)

- One bar at a time, with a `1 2 3 4` selector. The grid keeps its size and follows the music during playback.

### Stadium (Q4)

- The clock shows the current bar and changes at each bar. It keeps 16 slices and the numbers 1 to 4.

### Time signature (Q5)

- Changing it on a 4-bar pattern warns and returns the pattern to 1 bar.

### Stated without a question, accepted with "recomendacoes"

- The Trainer counts real bars: "every 4" is 4 bars.
- `POS: BAR` keeps counting.
- A groove from the Groove Library enters only the bar on screen.
- `STEPS` shows the total over the new limit.

### Every Day I Have the Blues

- It stays at the tab's 200 BPM. The user approved the 14 songs by ear: "Aprovei as 14 musicas do jeito que ta".

### Agent's Discretion

None.

### Declined / Undiscussed Gray Areas → Assumptions

The spec's Assumptions table holds the defaults, confirmed at approval, user: "aprovado".

---

## Specific References

- The ear approval of the 14 songs moved here from `grooves-library`, user: "pode seguir".
- `scripts/tab_to_grid.js` turns one bar of a Songsterr drum part into a grid.

---

## Deferred Ideas

- Swing. `precise-only` removed it, and the feel of Every Day I Have the Blues may need it.
- Patterns of 4 bars created by the user.
