---
name: MetroRig
colors:
  background: '#080810'
  on-background: '#F3F4F6'
  surface: '#080810'
  surface-dim: '#080810'
  surface-container-low: '#0F0F17'
  surface-container: '#12121A'
  surface-container-high: '#16161F'
  on-surface: '#F3F4F6'
  on-surface-variant: '#9CA3AF'
  outline: '#393940'
  outline-variant: '#1C1C23'
  primary: '#39FF14'
  on-primary: '#080810'
  primary-container: '#1E640B'
  on-primary-container: '#39FF14'
  secondary: '#00D4FF'
  on-secondary: '#080810'
  tertiary: '#FFE600'
  on-tertiary: '#080810'
  track-click: '#FFB800'
  track-kick: '#FF2D55'
  track-snare: '#00D4FF'
  track-hihat: '#00FF94'
typography:
  stadium-bpm:
    fontFamily: JetBrains Mono
    fontSize: 156px
    fontWeight: '900'
    lineHeight: '1'
    letterSpacing: -0.05em
  editor-bpm:
    fontFamily: JetBrains Mono
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1'
  logo:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '700'
  stadium-timer:
    fontFamily: JetBrains Mono
    fontSize: 19.2px
    fontWeight: '400'
    letterSpacing: 0.15em
  button-play:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '700'
    letterSpacing: 0.1em
  card-title:
    fontFamily: Inter
    fontSize: 13.6px
    fontWeight: '600'
    letterSpacing: 0.08em
  control:
    fontFamily: Inter
    fontSize: 13.6px
    fontWeight: '400'
  selector-mono:
    fontFamily: JetBrains Mono
    fontSize: 13.6px
    fontWeight: '400'
  panel-header:
    fontFamily: JetBrains Mono
    fontSize: 12.8px
    fontWeight: '400'
    letterSpacing: 0.05em
  track-label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    letterSpacing: 0.05em
  form-label:
    fontFamily: Inter
    fontSize: 11.2px
    fontWeight: '600'
    letterSpacing: 0.06em
  step-count:
    fontFamily: JetBrains Mono
    fontSize: 11.2px
    fontWeight: '400'
rounded:
  badge: 4px
  cell: 6px
  control: 8px
  card: 12px
  full: 999px
spacing:
  xs: 4px
  sm: 6.4px
  md: 12px
  lg: 16px
  card: 24px
  section: 24px
  header-x: 32px
  header-y: 16px
---

# Design System: MetroRig

Source of truth: `README.md`, `index.html`, `src/index.css`, `src/main.ts`, `src/state.ts`, `src/lib.rs`. All copy and values below come from those files. Where a value is derived rather than read directly, it says so.

## 1. Visual Theme & Atmosphere

MetroRig is an instrument, not a website. Its own redesign commit names the target: "DAW plugin premium style with glassmorphism and track colors". Picture a rack unit in a dark studio: a near-black, faintly blue room, smoked-glass panels floating on it, and one electric phosphor green that says the machine is alive. Saturated track colours are the only other voices, and each one always means the same instrument.

The density is that of pro audio gear. Controls sit tight, spacing stays under 24px, and labels are small, uppercase and tracked. The contrast comes from scale: a 156px monospaced tempo readout in Stadium sits beside 11px field labels. Numbers are the display; everything else is a label for a number.

The product promise is "rock-solid timing accuracy", so the interface has to feel exact. Motion follows the audio clock, not decoration. Nothing flashes: a code comment says the orbs "keep a steady color and only nudge in size, avoiding luminance flashes", and the Stadium background flash was deliberately replaced by the rotating beat clock.

### Product Shape

The native object is **a pattern of 1 or 4 bars on a loop**: 11 tracks (Click, Kick, Snare, Hi-hat, Open Hat, Ride, Ride Bell, Crash, China, High Tom, Floor Tom) multiplied by up to 32 steps, where a step is a sixteenth. Each cell holds `0` (off), `1` (normal), `2` (accent) or `3` (ghost, drum tracks only). The product has no feed, only this one matrix shown two ways, plus the Grooves screen that loads a song into it:

| View | Projection | Purpose | Lead element |
|:---|:---|:---|:---|
| **Editor Mode** | Linear: tracks as rows, steps as columns | "Set presets, configure Sequencer grids, and adjust speed details." | The 16-step sequencer |
| **Practice Stadium Mode** | Polar: 4 kit groups as concentric rings, steps as slices, step 0 at 12 o'clock | "Full-screen layout with elapsed timer, current tempo gauge, and rotating beat clock." | The beat clock and the tempo |

Organise every screen around this bar. Never use a generic section template or a dashboard of unrelated widgets.

### What Leads

The README introduces MetroRig as a "16-step sequencer, metronome, and practice tool" and names rock-solid timing as its reason to exist. Weight follows that order:

1. **The bar**: the sequencer grid in Editor, the beat clock in Stadium.
2. **The tempo**: the largest type on every screen, in neon green.
3. **Play / Stop**: the only full-width action.
4. **Measure, Tempo Trainer and presets**: support that stays quiet until needed.

## 2. Color Palette & Roles

### Primary Foundation

- **Studio Black** (`#080810`, `--bg`): the page. A near-black with a cold blue-violet cast, also used for text on neon fills.
- **Smoked Glass** (`rgba(255,255,255,0.04)`, `--glass-bg`): every card, with a 20px backdrop blur. Over Studio Black it resolves to about `#12121A` (derived).
- **Glass Edge** (`rgba(255,255,255,0.08)`, `--glass-border`): 1px hairlines, dividers and the slider track. Resolves to about `#1C1C23` (derived).
- **Empty Cell** (`rgba(255,255,255,0.03)`): resting step cells. Resolves to about `#0F0F17` (derived).
- **Dead Slice** (`#16161F`): unlit beat clock slices.
- **Recessed Field** (`rgba(8,8,16,0.8)`): inputs and selects, set darker than the card around them. The sticky header uses the same value.

The `surface-container*` and `outline*` values in the frontmatter are these flat composites, for tools that can't express alpha. Prefer real transparency.

### Accent & Interactive

- **Neon Green** (`#39FF14`, `--neon-green`): the brand and the live signal. Used for the logo, tempo, Play, slider thumb, focus ring, active figure, active beat number and trainer dot.
- **Dim Green** (`#1E640B`, `--neon-green-dim`): resting fill of the Save button only.
- **Signal Cyan** (`#00D4FF`): the subtle secondary action, Save Groove, as a 10% tint with a 20% border. It is the same value as the Snare track, a known overlap.
- **Cyber Yellow** (`#FFE600`, `--cyber-yellow`): the Stadium trainer status line only.

### Track Colours

Eleven fixed identities, bound through `data-track`. Each colour appears on the track label, its step cells and its mix card. The Stadium's 4 groups take the first four colours, by position.

| Track | ID | Name | Hex |
|:---|:---|:---|:---|
| Click | 0 | **Amber Click** | `#FFB800` |
| Kick | 1 | **Hot Coral Kick** | `#FF2D55` |
| Snare | 2 | **Ice Cyan Snare** | `#00D4FF` |
| Hi-hat | 3 | **Mint Hi-hat** | `#00FF94` |
| Open Hat | 4 | **Pale Mint Open Hat** | `#7CFFC4` |
| Ride | 5 | **Violet Ride** | `#B388FF` |
| Ride Bell | 6 | **Lilac Ride Bell** | `#E0B3FF` |
| Crash | 7 | **Orange Crash** | `#FF8A3D` |
| China | 8 | **Pink China** | `#FF5CA8` |
| High Tom | 9 | **Blue High Tom** | `#4D9DFF` |
| Floor Tom | 10 | **Periwinkle Floor Tom** | `#7C8CFF` |

Never reassign these to other meanings. Red here is the Kick; it doesn't mean danger.

### Typography & Text Hierarchy

- **Bright Fog** (`#F3F4F6`, `--text`): primary text and the active downbeat number.
- **Steel Grey** (`#9CA3AF`, `--text-muted`): labels, units, card titles and the panel header. Contrast is about 7.3:1 on glass (calculated).
- **Neon Green**: numbers that are live.

### Functional States

The repo defines no success, warning or error colours, and this file deliberately adds none. Runtime messages use native browser dialogs. If a state colour is ever needed, it needs a new decision; don't borrow the Kick red.

## 3. Typography Rules

- **JetBrains Mono** (400, 700, 900) is the instrument voice: tempo, timer, logo, preset selectors, panel header, count row and clock numerals. Fixed-width digits keep a changing tempo from jittering.
- **Inter** (400, 500, 600, 700), falling back to `system-ui`, is the operator voice: buttons, labels, card titles and track pills.

### Hierarchy & Weights

| Role | Font | Size | Weight | Tracking | Other |
|:---|:---|:---|:---|:---|:---|
| Stadium tempo | Mono | 9.75rem | 900 | -0.05em | Neon, 30px glow, line-height 1 |
| Editor tempo | Mono | 4rem | 700 | default | Neon, 30px glow, line-height 1 |
| Logo | Mono | 1.5rem | 700 | 0.08em | Neon, 12px glow |
| Stadium timer | Mono | 1.5rem | 400 | 0.15em | Bright Fog |
| Editor timer | Mono | 1.2rem | 400 | 0.15em | Neon |
| Play button | Inter | 1rem, Stadium 1.2rem | 700 | 0.1em | |
| Stadium status | Inter | 1rem | 400 | 0.05em | Cyber Yellow |
| Card title | Inter | 0.85rem | 600–700 | 0.05–0.08em | Uppercase, muted |
| Controls | Inter | 0.85rem | 400 | default | |
| Preset selectors | Mono | 0.85rem | 400 | default | |
| Panel header | Mono | 0.8rem | 400 | 0.05em | Muted |
| Track pill | Inter | 0.75rem | 600 | 0.05em | Uppercase, track colour |
| Form label | Inter | 0.7rem | 600 | 0.06em | Uppercase, muted |
| Count row | Mono | 0.7rem | 400, beat start 700 | default | 60% opacity, beat start 100% |
| PRO badge | Mono | 0.6rem | 700 | 0.1em | Neon on a 10% tint, hairline border |

### Spacing Principles

Line-height is only set where it matters: `1` on tempo readouts, browser default elsewhere. Tracking opens as type shrinks. Only the giant tempo tightens. Glow belongs to neon numerals and the logo, never to body text.

## 4. Component Stylings

### Buttons

- **Play / Stop** (`▶ PLAY` / `■ STOP`): outlined neon on transparent, 1px border, 8px radius, full width, 0.9rem padding. Hover fills neon with Studio Black text and a 20px green glow over 0.2s. In Stadium it is a 250px rounded rectangle with a 2px border, a hollow triangle and a mono label. It is never a pill.
- **Save**: Dim Green fill, neon text and border, 6px radius; hover fills neon.
- **Save Groove**: subtle cyan tint, full width, 6px radius, a save icon.
- **Figure buttons**: glass chips with a 6px radius, all mono. Each shows a name plus a pattern of `●` and `·`. The active one has neon text, a neon border and a faint glow.

### Cards & Panels

Every panel uses the same recipe: Smoked Glass, 20px backdrop blur, 1px Glass Edge, 12px radius, shadow `0 8px 32px rgba(0,0,0,0.5)` and a top inner highlight of `inset 0 1px 0 rgba(255,255,255,0.06)`. Padding is 1.25–1.5rem. Cards divide themselves with 1px hairlines rather than fills.

### Navigation

A sticky header: glass-black, blurred, with a bottom hairline. Left: `METRORIG` plus a small `PRO` badge, then the mono links `Editor`, `Stadium` and `Grooves` behind a hairline. Muted links lift on hover, and the open screen's link is neon with a 2px underline. Right: the click sound selector, with a dim `Click:` label beside a bright value, and the preset selector. The three screens swap in place. Don't add links or icons without a function behind them.

### Grooves Screen

Genre tabs (`All`, `Rock`, `Metal`, `Metalcore`, `Blues`) above a grid of glass song cards: title, artist, section, a neon BPM, the time signature, an outlined neon `▶` that turns to `■` while the song plays, and a recessed `Open in Editor`. The grid collapses to one column at phone width.

### Status Bar

A hairline-topped footer in both modes, mono and small. Left: a lit dot and `AUDIO CLOCK: 44.1 kHz 128 SPLS (2.9ms)`. Right: `LATENCY: --` until the first tick, then the value the browser reports. It shows real values only.

### Inputs & Forms

- **Selects and number inputs**: Recessed Field, hairline border, 0.4rem × 0.6rem padding, 6px radius. Focus turns the border neon. Header selectors use 8px, a custom chevron and a soft green glow on focus.
- **Stepper fields** (Numerator, Denominator): a recessed block with a tiny label, a 1.5rem mono value and small `▲` `▼` buttons.
- **BPM slider**: 4px Glass Edge track and an 18px neon thumb with an 8px glow. Range 40–240, with `40`, the current BPM and `240` above it.
- **Switch**: `Trainer Active` is a 36×20px switch that turns neon when on.
- **Labels**: always above the field, uppercase and small.

### Sequencer Grid (hero)

Row 1 starts with `BEAT/SUB`, then the count: `1 e & a 2 e & a 3 e & a 4 e & a`, or `1 & 2 &` when a beat has two steps. Beat numbers are bold at full opacity. Below are eleven rows, each starting with a rectangular outlined track label on a faint tint. Columns are `auto` then equal `1fr` steps with a 0.4rem gap, and a 0.5rem spacer between beats makes the pulse readable at a glance. Cells are 32px tall, at least 14px wide, with a 6px radius and 0.15s transitions.

| Cell state | Value | Treatment |
|:---|:---|:---|
| Empty | `0` | Empty Cell fill, hairline border |
| Sustain | `0`, following a hit in a beat with 2+ hits | 12% track fill, 25% track border |
| Hit | `1` | 25% track fill, solid track border, 8px glow at 40%, a `●` mark |
| Accent | `2` | Solid track fill, 16px full-colour glow, a `▲` mark |
| Ghost | `3` | 10% track fill, 50% track border, a `•` mark |
| Hover | any | Lighter fill, border at 50% track colour |
| Silenced | any | 35% opacity on the whole row |

Click cycles off, normal, accent. Drum tracks cycle off, normal, accent, ghost, with `●`, `▲` and a smaller dot. With a figure selected, one click stamps the whole quarter note. Grid length follows the meter: 16 steps in 4/4, 12 in 3/4 and 6/8, 14 in 7/8, 24 in 12/8, 32 at most.

### Bar Selector

On a pattern of 4 bars, a row under the figure chips: a muted `BAR` label and buttons `1` to `4`, styled like the chips, with the current bar in neon. The grid shows that one bar and follows the music during playback. A pattern of 1 bar shows no bar selector.

### Pattern Bar

A mono line under the grid: `PAT: <preset name>`, `STEPS: 16/128`, `RESOLUTION: 1/16th`, and at the right `POS: BAR 01 · STEP 01`, with the position in neon. Bars count from Play and reset on Stop. `STEPS` shows the whole pattern, 64/128 on 4 bars.

### Track Mix

Eleven small cards under the sequencer, one per track: a track dot, the name, then `M` and `S`. A pressed button takes the track colour. Several tracks can be soloed, Solo wins over Mute, and the state lasts until the page reloads. It is never saved in a preset.

### Figure Palette

A wrapping row above the grid: `Step`, `Quarter ●···`, `Eighths ●·●·`, `Gallop ●·●●`, `Rev. Gallop ●●·●`, `16ths ●●●●`, `Rest ····`.

### BPM Card

The first card in the control column, titled `TEMPO BUS`: the giant neon number with a small muted `BPM` unit on its baseline, then the slider scale, the slider and Play.

### Tempo Trainer Card

A collapsible card, open on load. Its header is an uppercase title with a chevron that rotates 180°, plus a steady 7px glowing neon dot while active. The body is a two-column form of recessed blocks: `Trainer Active`, `Start BPM`, `Target BPM`, `Increment`, `Step Value`, `Step Type` (`Measures`, `Seconds`), `Curve` (`Stepped`, `Smooth Ramp`).

### Save Toast

Not a floating notification. It's an inline card in the control column, between BPM and Measure, that slides down after any edit (0.25s, `power2.out`). It holds a `Preset name…` field, pre-filled with the current preset, and a `Save` button.

### Beat Clock

The hero of Stadium: an SVG up to 700px wide (`min(70vh, 90vw)`). Four concentric rings run outside in as `CLICK`, `KICK`, `SNARE/TOMS` (Snare, High Tom, Floor Tom) and `CYMBALS` (Hi-hat, Open Hat, Ride, Ride Bell, Crash, China), each with one annular slice per step, lit when any track of its group hits, and a small gap between rings. Empty Kick and Snare slices merge into a continuous ring. Slice fills are track colour when on, a 30% mix when sustained, and Dead Slice when empty, separated by thin Studio Black strokes. Faint lines mark each beat, a small bevelled disc fills the centre around a green hub, and mono numerals sit outside the rings, turning neon on the current beat. A thin white hand at 70% opacity sweeps linearly from the hub, step by step, with a small dot at its tip. A dotted legend sits below the clock. On 4 bars the clock draws only the bar in play, changing at each bar, and bar 1 when stopped.

### Stadium Readout

A glass panel beside the clock, up to 576px wide: `SPEED TRAINER ROUTINE` selector (`Choose a speed trainer`), `ELAPSED REHEARSAL` timer `00:00:00`, tempo `120.0 BPM` with one decimal, status pill, orbs, Play.

The pill is Cyber Yellow on a faint tint. It reads `Trainer Off`, or `Trainer 120 → 160 BPM · +5 every 4 bars` with a steady neon dot.

### Instrument Orbs

Four 60px rounded squares in track colours, each with a dark icon and its name below. They are indicators, not buttons. One orb per Stadium group. On each hit of an audible track of its group an orb scales from 1.15 to 1.0 in 0.2s (`power2.out`). The colour never changes.

## 5. Layout Principles

### Grid & Structure

- **Editor**: full-width two-column grid, `2fr 1fr`, with a 1.5rem gap and padding. No max-width. The sequencer takes the left two-thirds; the right column stacks BPM, Save Toast, Measure and Tempo Trainer with a 1rem gap.
- **Stadium**: a two-column grid with the beat clock on the left and the readout panel on the right, on a barely visible radial green glow. The header and status bar stay visible.

### Whitespace Strategy

Spacing is rem-based and compact, built from 0.25, 0.4, 0.5, 0.75, 1, 1.25 and 1.5rem. Tight gaps inside a group, 1–1.5rem between panels. Density is intended: everything stays reachable during practice.

### Alignment & Visual Balance

Editor is left-weighted: the bar is the mass, controls are the counterweight. Stadium is centred and symmetrical, read from across a room. All large numerals are monospaced so nothing shifts while the tempo moves.

### Motion

| Element | Motion |
|:---|:---|
| Hover and focus | 0.15–0.2s colour, border and shadow |
| Clock hand | Linear, exactly one step long at the live tempo |
| Orbs | Scale 1.15 → 1.0, 0.2s `power2.out` |
| Trainer body | Height to auto, 0.3s out, 0.25s in |
| Save Toast | 20px slide and fade, 0.25s in, 0.2s out |

All beat-driven visuals are delayed by the device's reported output latency, so what you see lands with what you hear. Avoid looping ambient animation, pulsing backgrounds and any full-area brightness change.

### Responsive Behavior & Touch

- **1024px and up**: two columns in both modes.
- **Under 1024px**: the Editor stacks the controls under the sequencer, and the Stadium stacks the clock above the readout.
- **Under 768px**: the header wraps, the track mix becomes two columns, and the Stadium tempo drops to 5rem.
- **The grid**: step cells never go under 14px. If the grid doesn't fit, only the grid scrolls sideways.

Orbs are 60px. Step cells are 32px tall.

## 6. Design System Notes for Stitch Generation

### Language to Use

Say: dark studio instrument, DAW plugin, smoked glass rack panels, neon phosphor readout, monospaced numerals, step sequencer matrix, concentric beat clock, track colour identity, hairline borders, restrained glow.

Avoid: landing page, hero banner, marketing sections, testimonials, pricing, sidebars, user avatars, charts, light theme, gradients on buttons, stock imagery.

### Color References

Studio Black `#080810`, Smoked Glass (white at 4%), Glass Edge (white at 8%), Neon Green `#39FF14`, Amber Click `#FFB800`, Hot Coral Kick `#FF2D55`, Ice Cyan Snare `#00D4FF`, Mint Hi-hat `#00FF94`, Cyber Yellow `#FFE600`, Bright Fog `#F3F4F6`, Steel Grey `#9CA3AF`.

### Real Content

- **Name**: MetroRig, with a `PRO` badge. **Page title**: "MetroRig — Pro Metronome & Drum Machine".
- **Click sounds**: Click: Digital, Mechanical, Woodblock, Stick Click, Cowbell.
- **Time Signatures**: 4/4 Metronome, 3/4 Metronome, 6/8 Metronome, 7/8 Metronome.
- **Drum Grooves**: Rock Groove (120), Metal Groove (140), Blues Shuffle (135), Jazz Swing (195), Metalcore Breakdown (160).
- **Speed Trainer**: 69 - 110 - 4/4, 110-135 - 4/4, 134-180- 4/4, 179-220 - 4/4, Calvagada - 148 - 190, Calvagada - 189 - 215, 134-162 -4/4, 180 to 195, 130 to 140, Ligados, Gallop. Keep these strings verbatim, spacing included.
- **User Presets**: empty state "No custom presets".
- **Measure card**: Numerator (1–16), Denominator (/4, /8, /16), Groove Library, `-- Choose a Groove --`, `Save Groove`.
- **Panel header**: `4/4 Metronome  ·  4/4  ·  120 BPM`.
- **Default state**: 120 BPM, 4/4, Click grid `2 0 0 0 1 0 0 0 1 0 0 0 1 0 0 0`, trainer 120 → 160, +5 every 4 measures, Stepped.

Don't add a Swing control, a CPU monitor, an engine version or a sync source. Swing was removed on purpose: MetroRig plays only exact time, and the card is called "Measure". The others have no real data behind them. Blues Shuffle and Jazz Swing keep their names.

Don't invent copy, stats, session history, accounts or genres. Practice logs are stored in `practice_logs` but have no UI, so there's no history screen to design from the repo.

### Component Prompts

**Editor Mode**

> A dark desktop audio plugin called MetroRig on a near-black #080810 background. Sticky glass header: neon green #39FF14 monospaced logo with a small outlined PRO badge, two dark selectors reading "Click: Digital" and "4/4 Metronome". Below, two columns at 2:1. The left glass panel dominates: a muted mono header "4/4 Metronome · 4/4 · 120 BPM", a row of small figure chips (Step, Quarter ●···, Eighths ●·●·, Gallop ●·●●, Rev. Gallop ●●·●, 16ths ●●●●, Rest ····), then a 16-step sequencer with a count row "BEAT/SUB 1 e & a 2 e & a…" and eleven rows with rectangular labels CLICK amber #FFB800, KICK coral #FF2D55, SNARE cyan #00D4FF, HI-HAT mint #00FF94, OPEN HAT #7CFFC4, RIDE #B388FF, RIDE BELL #E0B3FF, CRASH #FF8A3D, CHINA #FF5CA8, HIGH TOM #4D9DFF, FLOOR TOM #7C8CFF. Portrait cells with 6px corners, small gaps grouping them in fours. Show Rock Groove: hits as tinted glowing cells with a dot, the first Click as a solid accent with ▲. Under the grid, a mono line "PAT: Rock Groove STEPS: 16/128 RESOLUTION: 1/16th POS: BAR 01 · STEP 01", then eleven small cards with M and S buttons, one per track. The right column stacks glass cards: "TEMPO BUS" with a huge 64px neon "120 BPM", a thin slider, an outlined "▶ PLAY" button; a "MEASURE" card; an open "TEMPO TRAINER" card. A thin mono footer reads "AUDIO CLOCK: 44.1 kHz 128 SPLS (2.9ms)" and "LATENCY: --". Smoked glass cards with 12px corners and 1px white-at-8% borders.

**Practice Stadium Mode**

> The same dark instrument in a practice view, centred with a barely visible green radial glow. Left: a large circular beat clock with four concentric rings, amber outermost, then coral, cyan and mint innermost, divided into 16 slices with lit slices in the track colour and unlit ones #16161F. A black centre disc, a rounded white hand sweeping from 12 o'clock, and mono numerals 1 2 3 4 outside the rings with the current one neon. Right: a smoked glass panel with a dark selector labelled "SPEED TRAINER ROUTINE", a mono timer "00:00:00" labelled "ELAPSED REHEARSAL", a giant 156px neon "120.0 BPM" in JetBrains Mono Black, a yellow pill "Trainer 120 → 160 BPM · +5 every 4 bars", four 60px rounded squares in track colours with dark icons and names, and a neon outlined rounded rectangle "▶ PLAY".

**Tempo Trainer Card**

> A smoked glass card with 12px corners in a dark audio plugin. Header: small uppercase muted "TEMPO TRAINER", a 7px glowing neon dot, and a chevron at the right. Two-column compact form with tiny uppercase labels in recessed dark blocks: a "Trainer Active" switch across both columns, Start BPM 120, Target BPM 160, Increment 5, Step Value 4, Step Type Measures, Curve Stepped.

### Incremental Iteration

1. Start with the sequencer or beat clock alone. If the bar doesn't dominate, nothing else will fix the screen.
2. Check that each track colour appears only for its track.
3. Reduce glow before adding anything. Glow marks live values and accents; it isn't a surface finish.
4. Use the real grids from `src/state.ts` instead of random patterns. A musician will spot a fake groove.

### Known Drift From This System

These gaps remain in the code. Follow this document, not the drift:

- The README calls Stadium "full-screen", but the header and status bar stay visible.
- Keyboard focus styling exists only on form fields, and step cells are not focusable.
- Editor Mode has no moving playhead on the grid; `POS` shows the position. Don't draw one as if it were an existing feature.
- The groove prompt, its confirmation and the 32-step limit message are native browser dialogs with no designed equivalent.
