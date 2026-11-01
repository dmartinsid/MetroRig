# Interface V2 screens

**Verifier**: independent sub-agent (author != verifier)
**Round**: 2

| Screen | Compared with | Verdict | Finding |
| --- | --- | --- | --- |
| `captures/editor.running.png` | `captures/editor.png` | matches | 0 rows differ; all 8 from round 1 closed |
| `captures/stadium.running.png` | `captures/stadium.png` | matches | 0 rows differ; all 5 from round 1 closed |

Both pictures were taken by this sub-agent in headless Chrome at 1x, at each capture's size (1252x1227 and 1600x1280), in the stopped states the `**Walked:**` line gives. The sample data is not judged: timer value, preset name, pattern and tempo digits, trainer values. The sequencer dot and the green `1` are playback states; side pictures confirmed the green `1` during playback, and `EDIT-04` makes the dot unlit when stopped.

Round 2: a fresh sub-agent retook both pictures the same way and opened only the 13 rows that differed in round 1, applying `## Differences from the source` as it now stands. Rows already `same` were not reopened. The tempo row was measured on a side picture at `120.0`, so the digits match the capture's.

### `captures/editor.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| page: header, two columns (sequencer and strips left, cards right), footer | same | Left 787px and right 392px against 795 and 385: spacing note |
| header: `METRORIG` logo with `PRO` badge | same | Divider after the badge went with the links (approved) |
| header: links, `tune` and `settings` icons | same | None (approved) |
| header: click sound selector, dim `Click:` label, bright `Digital` value, thin chevron | same | Dim sans `Click:`, bright mono `Digital`, thin chevron. Selector wider and centred, chevron further from the text: spacing notes |
| header: preset selector with thin chevron | same | Thin chevron; value `Rock Groove` is sample data. Selector wider and centred: spacing note |
| header: green outlined view toggle on the right | same | `GO TO STADIUM MODE` (approved) |
| sequencer header: dot, `name · 4/4 · 120 BPM` | same | Dot unlit because stopped (`EDIT-04`); `Rock Groove` is sample data |
| sequencer header: `SYNC` badge | same | None (approved) |
| sequencer header: green timer on the right | same | `00:00:00`, sample data |
| chip row: `Step`, `Quarter`, `Eighths`, `Gallop`, `Rev. Gallop`, `16ths`, `Rest`, with `Quarter` lit green | same | Dot glyphs slightly larger |
| count row: `BEAT/SUB`, plain bold `1`-`4`, dim `e & a` | same | Plain bold `1`-`4` with no box; dim `e & a` |
| track labels: bordered `CLICK`, `KICK`, `SNARE`, `HI-HAT` in track colours | same | |
| grid: 4 rows of 16 cells, hit is a centred dot, accent is solid with `▲` | same | Wider beat gaps and sustain tint approved; cells are rounder, `▲` smaller, dots larger: drawing notes |
| grid: Kick 1, 9, 11, Snare 5, 13, Hi-hat odd steps, Click 1 accented | same | |
| pattern bar: `PAT`, `STEPS`, `RESOLUTION` left, `POS: BAR 01 · STEP 01` right | same | `PAT: Rock Groove`, `STEPS: 16/32` (approved) |
| track strips: four cards in a row under the sequencer, dot, name, `M`, `S` | same | |
| track strips: `S` on `CLICK` lit amber | same | All `S` unlit, no row dimmed: no solo in the Editor state (AD-006) |
| Tempo Bus: title, `120 BPM`, no `MASTER` | same | Approved |
| Tempo Bus: slider with `40`, `120`, `240` above it | same | Thumb has no dark outline; slider closer to the Play button |
| Tempo Bus: outlined rounded `▶ PLAY` | same | Triangle larger, nearer the word |
| Save Toast: bookmark icon, name, green `Save` | same | `Rock Groove` with no `(120)`: the product's preset name, as in the approved library row |
| `MEASURE` card: title, no `MTR-04` | same | Approved |
| `MEASURE` card: `NUMERATOR 4` and `DENOMINATOR /4` with stepper arrows | same | |
| `GROOVE LIBRARY`: label and selector showing `Rock Groove (120)`, up-down chevrons | same | Shows `Rock Groove` (approved, AD-004), up-down chevrons |
| `Save Groove`: cyan outlined button with a save icon | same | Save icon left of the text; icon is outlined, the capture's has a filled centre: drawing note |
| Tempo Trainer header: dot, title, thin chevron on the right | same | Thin chevron, slightly larger |
| Tempo Trainer: `Trainer Active` row with green switch | same | Tighter gap to the fields |
| Tempo Trainer: `START BPM 120` green, `TARGET BPM 160`, `STEP VALUE 4` | same | |
| Tempo Trainer: `INCREMENT +5` | same | `+5` |
| Tempo Trainer: `STEP TYPE Measures`, `CURVE Stepped` | same | Values are bolder |
| footer: dot and `AUDIO CLOCK` left, `LATENCY` right | same | `44.1 kHz 128 SPLS (2.9ms)` and `LATENCY: --` before the first Play (approved). Footer at the window bottom; the white band is the export artifact |

### `captures/stadium.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| page: header, beat clock left, readout panel right, footer | same | Both sit about 25px further right and the panel is 70px shorter: spacing notes |
| header: logo with `PRO` | same | `PRO` approved; bar 54px tall against 70, smaller logo, same shell as the Editor (`SHELL-01`) |
| header: links, `tune` and `settings` icons | same | None (approved) |
| header: two selectors, as in the Editor | same | Thin chevrons, dim `Click:`, bright `Digital`, as the Editor |
| header: `GO TO EDITOR MODE` outlined toggle | same | |
| beat clock: four rings outside in Click, Kick, Snare, Hi-hat, about 50px wide | same | Rings 40px wide, because of the hub below. Calvagada's pattern is sample data |
| beat clock: unlit Kick and Snare rings drawn continuous, step lines on Click and Hi-hat only | same | Kick and Snare unlit cells read continuous; step lines visible on Click and Hi-hat only. Kick and Snare lines remain at one level from the fill, seen only with the contrast forced. The Kick-Snare ring gap is thinner: drawing note |
| beat clock: hub, bevelled dark disc about 70px in radius, green ring and dot | same | Disc about 70px in radius, darker centre, lighter rim, softer than the capture's lit edge: shade note. Green ring and dot same; ring slightly larger |
| beat clock: white hand with a dot at the top | same | |
| beat clock: numerals `1` to `4` around the rim | same | `1` grey when stopped, green during playback; numerals larger |
| legend: `CLICK`, `KICK`, `SNARE`, `HI-HAT` under the clock | same | |
| readout: `SPEED TRAINER ROUTINE` label and selector | same | |
| readout: `ELAPSED REHEARSAL` and timer, centred | same | |
| readout: tempo with one decimal, filling the panel, heavy digits, `BPM` | same | At `120.0`, 413px wide and 117px tall against 428 and 121, filling the panel. Digits a little lighter, left margin 59px against 40, `BPM` smaller: weight and spacing notes |
| readout: Trainer status pill, dot, yellow text | same | Values are the Trainer's. Pill less dark, dot smaller, thinner arrow |
| readout: divider | same | |
| orbs: four rounded squares with icons and track names | same | |
| readout: outlined rounded Play button, hollow triangle, `PLAY` | same | Hollow triangle, word in the mono face. Word slightly smaller and lighter: weight note |
| footer: dot and audio clock, latency | same | Editor's footer as `SHELL-01` to `SHELL-09` require. `DSP ENGINE` chip gone, `LATENCY: --` on the right |
