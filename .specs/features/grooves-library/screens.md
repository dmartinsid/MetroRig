# Grooves Library screens

**Verifier**: independent sub-agent (author != verifier)
**Round**: 2

Pictures taken by this sub-agent in headless Chrome at each capture's size (1x), walking the running app at `http://localhost:4317/`. No horizontal or vertical page scroll at either size. Differences applied: `## Differences from the source` of this feature's `spec.md` and of `.specs/features/interface-v2/spec.md`.

Round 2: a fresh sub-agent retook both pictures the same way, opened only the 10 rows that differed in round 1 and added none. Sample data is judged by `specify.md`: names, quantities and dates in a capture are not transcribed. Side pictures, not saved over the captures, confirmed the two playback states: the status dot lit and the `1` green while playing.

| Screen | Compared with | Verdict | Finding |
| --- | --- | --- | --- |
| `captures/editor.running.png` | `captures/editor.png` | matches | 0 rows differ; all 4 from round 1 closed |
| `captures/stadium.running.png` | `captures/stadium.png` | diverges | 1 row differs; 5 of 6 from round 1 closed |

### `captures/editor.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| header: `METRORIG`, `PRO` badge, divider | same | |
| header links: `Editor` lit and underlined, `Stadium`, `Grooves` | same | `Presets` absent: approved, AD-007 |
| header: `Click: Digital` selector | same | |
| header: preset selector showing `4/4 Metronome` | same | `Rock Groove`, the preset the walk chooses: sample data, as in `interface-v2` |
| header right: `tune` and `settings` icons, `Stadium Mode` pill | same | absent: approved, AD-001 and AD-007. Note: the selectors sit further right, against the edge, in the space these left |
| page: two columns, grid card and Mute/Solo cards left, side panels right | same | note: right column 8px wider |
| grid card, status row: dot lit green | same | dot grey because stopped: `interface-v2` `EDIT-04`, lit while playing on a side picture |
| grid card, status row: `4/4 Metronome · 4/4 · 120 BPM` | same | `Rock Groove · 4/4 · 120 BPM`: the name is sample data, as in `interface-v2`. Note: separators more widely spaced |
| grid card, status row: `SYNC: INTERNAL AUDIO CORE` | same | absent: approved, AD-002 |
| grid card, status row: clock `00:04:12` on the right | same | `00:00:00`: an elapsed count that follows when the picture is taken, like a date; the state is stopped |
| figure chips: `Step`, `Quarter ●···` lit, `Eighths`, `Gallop`, `Rev. Gallop`, `16ths`, `Rest`, one row | same | |
| grid header: `BEAT/SUB`, `1 e & a` to `4 e & a`, beats in white | same | |
| grid: outlined coloured track labels on the left | same | |
| grid: `CLICK` accent `▲` on 1 and marks on 2, 3, 4 | same | |
| grid: `KICK` on 1, 3 and the `&` of 3 | same | note: sustain cells after the hits, approved, AD-003 |
| grid: `SNARE` on 2 and 4 | same | |
| grid: `HI-HAT` on every eighth | same | note: sustain cells between, approved, AD-003 |
| grid: 4 rows, equal gaps | same | 11 rows, lower, wider gap between beats: approved, AD-008 and AD-003. Note: dots a little larger |
| grid footer: red dot, `PAT:`, `STEPS:`, `RESOLUTION: 1/16th` | same | `PAT: Rock Groove`, `STEPS: 16/32`: approved, AD-002 |
| grid footer: `POS: BAR 01 · STEP 01` on the right | same | |
| Mute/Solo cards: dot, name, `M`, `S`, 4 across | same | 11 cards in 3 rows of 4: approved, AD-008. `S` on `CLICK` unlit: approved, AD-006 |
| `TEMPO BUS` card: label, `120`, `BPM` | same | `MASTER` badge absent: approved, AD-002 |
| `TEMPO BUS` card: slider, `40`, `120`, `240`, green thumb | same | |
| `TEMPO BUS` card: outlined `▶ PLAY` | same | |
| Save Toast: bookmark icon, preset name, green `Save` | same | `Rock Groove`: approved, AD-004 |
| `MEASURE` card: title, numerator `4`, denominator `/4`, both with steppers | same | `MTR-04` absent: approved, AD-002 |
| `GROOVE LIBRARY` selector | same | `Rock Groove`: approved, AD-004 |
| `Save Groove`, outlined cyan with icon | same | |
| `TEMPO TRAINER` header: dot, title, chevron at the far right of the card | same | chevron at the card's right edge. Note: slightly larger |
| `Trainer Active` row, toggle on at the right | same | |
| trainer fields: `START BPM 120` green, `TARGET BPM 160`, `INCREMENT +5`, `STEP VALUE 4`, `STEP TYPE Measures`, `CURVE Stepped`, 2 by 3 | same | note: `Measures` and `Stepped` larger and heavier |
| footer: green dot, `AUDIO CLOCK:` left, `LATENCY:` right | same | real rate and buffer; `ENGINE:` and `CPU:` absent: approved, AD-002. `LATENCY: --` with the app stopped. Note: the band sits at the window's bottom edge; the capture ends with a white strip under it |

### `captures/stadium.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| header: `METRORIG`, `PRO` badge | same | `Pro` as `PRO`: approved, AD-005 |
| header links: `Editor`, `Stadium` lit and underlined, `Grooves` | same | `Presets` absent: approved, AD-007. Note: links sit further left, as in the Editor |
| header: joined `SOUND` and `METER` selector | same | two separate selectors: approved, AD-005 and AD-001 |
| header right: `tune` and `settings` icons, `GO TO EDITOR MODE` pill | same | absent: approved, AD-001 and AD-007 |
| page: clock left, panel right, both centred vertically | same | note: panel shorter and 25px further right |
| clock: 4 concentric rings on a dark disc, 16 outer segments, centre hub with a green dot and ring | same | note: hub dot larger |
| clock: separators between rings, all heavy black | differs | the line between the second and third rings is a faint hairline, about 2px and dark grey, where the capture draws about 8px of near black; the other two are about 4px. No approved difference names it, and sample data does not cover a line. `interface-v2` kept the same drawing as a note on a `same` row, but `verify-screens.md` counts a line drawn differently as `differs` and in this picture one of three lines nearly disappears |
| clock: lit steps, amber on all 4 beats of the outer ring, red, cyan and green on the inner rings, hi-hat on 8 steps | same | outer ring empty; red on 1, 2, 3; cyan on 4; green on 4 steps: the pattern is sample data, as in `interface-v2`. Each lit step is the grid of `Calvagada - 148 - 190`, read from the app, and its `Click` track is empty |
| clock: white playhead at beat 1 | same | |
| clock: beat `1` lit green, `2`, `3`, `4` grey | same | `1` grey because stopped, as in `interface-v2`: `STAD-12` active beat numeral, green during playback on a side picture |
| legend: `CLICK`, `KICK`, `SNARE`, `HI-HAT` under the clock | same | `SNARE/TOMS`, `CYMBALS`: approved, AD-009 |
| panel: `SPEED TRAINER ROUTINE` and selector `Calvagada - 148 - 190` | same | |
| panel: `ELAPSED REHEARSAL` `00:04:12` | same | `00:00:00`: an elapsed count that follows when the picture is taken; the state is stopped |
| panel: `120.0` `BPM` | same | `148.0`, the preset's start tempo: a quantity, sample data, as in `interface-v2`. Note: `BPM` smaller, letter spacing narrower |
| panel: amber pill `Trainer 120 → 160 BPM · +5 every 4 bars` | same | `Trainer 148 → 190 BPM · +2 every 3 bars`, the Trainer's own values: sample data, and `interface-v2` `STAD-07` says "using the Trainer's values". Note: text smaller |
| panel: divider, 4 coloured orbs with icons and labels | same | `SNARE/TOMS`, `CYMBALS`: approved, AD-009 |
| panel: outlined `▷ PLAY` | same | note: closer to the orbs |
| footer: green dot, `Audio Clock:` and `Latency:` together on the left | same | upper-case `AUDIO CLOCK:` on the left and `LATENCY: --` on the far right, the Editor's footer: `interface-v2` Rack shell asks for one footer in both modes and `SHELL-06` fixes the copy, as judged there. Rate and buffer approved, AD-002 |
| footer: `DSP ENGINE` and version box on the right | same | absent: read as the approved `ENGINE:` row, AD-002 |
