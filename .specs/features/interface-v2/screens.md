# Interface V2 screens

**Verifier**: independent sub-agent (author != verifier)
**Round**: 1

| Screen | Compared with | Verdict | Finding |
| --- | --- | --- | --- |
| `captures/editor.running.png` | `captures/editor.png` | diverges | 8 rows differ |
| `captures/stadium.running.png` | `captures/stadium.png` | diverges | 5 rows differ |

Both pictures were taken by this sub-agent in headless Chrome at 1x, at each capture's size (1252x1227 and 1600x1280), in the stopped states the `**Walked:**` line gives. The sample data is not judged: timer value, preset name, pattern and tempo digits, trainer values. The sequencer dot and the green `1` are playback states; side pictures confirmed the green `1` during playback, and `EDIT-04` makes the dot unlit when stopped.

### `captures/editor.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| page: header, two columns (sequencer and strips left, cards right), footer | same | Left 787px and right 392px against 795 and 385: spacing note |
| header: `METRORIG` logo with `PRO` badge | same | Divider after the badge went with the links (approved) |
| header: links, `tune` and `settings` icons | same | None (approved) |
| header: click sound selector, dim `Click:` label, bright `Digital` value, thin chevron | differs | Filled triangle caret; `Click: Digital` is one run of mono text in one colour, no separate label |
| header: preset selector with thin chevron | differs | Filled triangle caret; value `Rock Groove` is sample data. Both selectors are wider and sit centred (spacing note) |
| header: green outlined view toggle on the right | same | `GO TO STADIUM MODE` (approved) |
| sequencer header: dot, `name · 4/4 · 120 BPM` | same | Dot unlit because stopped (`EDIT-04`); `Rock Groove` is sample data |
| sequencer header: `SYNC` badge | same | None (approved) |
| sequencer header: green timer on the right | same | `00:00:00`, sample data |
| chip row: `Step`, `Quarter`, `Eighths`, `Gallop`, `Rev. Gallop`, `16ths`, `Rest`, with `Quarter` lit green | same | Dot glyphs slightly larger |
| count row: `BEAT/SUB`, plain bold `1`-`4`, dim `e & a` | differs | `1`-`4` each sit in a filled dark box the capture does not draw |
| track labels: bordered `CLICK`, `KICK`, `SNARE`, `HI-HAT` in track colours | same | |
| grid: 4 rows of 16 cells, hit is a centred dot, accent is solid with `▲` | same | Wider beat gaps and sustain tint approved; cells are rounder, `▲` smaller, dots larger: drawing notes |
| grid: Kick 1, 9, 11, Snare 5, 13, Hi-hat odd steps, Click 1 accented | same | |
| pattern bar: `PAT`, `STEPS`, `RESOLUTION` left, `POS: BAR 01 · STEP 01` right | same | `PAT: Rock Groove`, `STEPS: 16/32` (approved) |
| track strips: four cards in a row under the sequencer, dot, name, `M`, `S` | same | |
| track strips: `S` on `CLICK` lit amber | differs | All `S` unlit. The `**Walked:**` line does not press it. Pressing it lights the same amber `S`, but `MUTE-07` then dims Kick, Snare and Hi-hat, which the capture does not draw |
| Tempo Bus: title, `120 BPM`, no `MASTER` | same | Approved |
| Tempo Bus: slider with `40`, `120`, `240` above it | same | Thumb has no dark outline; slider closer to the Play button |
| Tempo Bus: outlined rounded `▶ PLAY` | same | Triangle larger, nearer the word |
| Save Toast: bookmark icon, name, green `Save` | same | `Rock Groove` with no `(120)`: the product's preset name, as in the approved library row |
| `MEASURE` card: title, no `MTR-04` | same | Approved |
| `MEASURE` card: `NUMERATOR 4` and `DENOMINATOR /4` with stepper arrows | same | |
| `GROOVE LIBRARY`: label and selector showing `Rock Groove (120)`, up-down chevrons | differs | Selector shows `-- Choose a Groove --`. Approved copy is `Rock Groove`. Loading the preset leaves it on the placeholder; only applying the groove in this selector shows the name |
| `Save Groove`: cyan outlined button with a save icon | differs | No save icon, text only |
| Tempo Trainer header: dot, title, thin chevron on the right | differs | Filled `▲` instead of the chevron |
| Tempo Trainer: `Trainer Active` row with green switch | same | Tighter gap to the fields |
| Tempo Trainer: `START BPM 120` green, `TARGET BPM 160`, `STEP VALUE 4` | same | |
| Tempo Trainer: `INCREMENT +5` | differs | `5`, no `+` |
| Tempo Trainer: `STEP TYPE Measures`, `CURVE Stepped` | same | Values are bolder |
| footer: dot and `AUDIO CLOCK` left, `LATENCY` right | same | `44.1 kHz 128 SPLS (2.9ms)` and `LATENCY: --` before the first Play (approved). Footer at the window bottom; the white band is the export artifact |

### `captures/stadium.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| page: header, beat clock left, readout panel right, footer | same | Both sit about 25px further right and the panel is 70px shorter: spacing notes |
| header: logo with `PRO` | same | `PRO` approved; bar 54px tall against 70, smaller logo, same shell as the Editor (`SHELL-01`) |
| header: links, `tune` and `settings` icons | same | None (approved) |
| header: two selectors, as in the Editor | differs | Filled triangle carets, one-colour `Click: Digital`, as the Editor rows that differ |
| header: `GO TO EDITOR MODE` outlined toggle | same | |
| beat clock: four rings outside in Click, Kick, Snare, Hi-hat, about 50px wide | same | Rings 40px wide, because of the hub below. Calvagada's pattern is sample data |
| beat clock: unlit Kick and Snare rings drawn continuous, step lines on Click and Hi-hat only | differs | All four rings cut into 16 cells by step lines |
| beat clock: hub, bevelled dark disc about 70px in radius, green ring and dot | differs | Flat disc about 105px in radius, no bevel. Green ring and dot same |
| beat clock: white hand with a dot at the top | same | |
| beat clock: numerals `1` to `4` around the rim | same | `1` grey when stopped, green during playback; numerals larger |
| legend: `CLICK`, `KICK`, `SNARE`, `HI-HAT` under the clock | same | |
| readout: `SPEED TRAINER ROUTINE` label and selector | same | |
| readout: `ELAPSED REHEARSAL` and timer, centred | same | |
| readout: tempo with one decimal, filling the panel, heavy digits, `BPM` | differs | About 340px wide and 94px tall against 430 and 120; lighter digits, so it leaves wide margins in the panel |
| readout: Trainer status pill, dot, yellow text | same | Values are the Trainer's. Pill less dark, dot smaller, thinner arrow |
| readout: divider | same | |
| orbs: four rounded squares with icons and track names | same | |
| readout: outlined rounded Play button, hollow triangle, `PLAY` | differs | Filled triangle; word set in the sans face |
| footer: dot and audio clock, latency | same | Editor's footer as `SHELL-01` to `SHELL-09` require. `DSP ENGINE` chip gone, `LATENCY: --` on the right |
