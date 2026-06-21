# MetroRig Visual Redesign — DAW Plugin Premium

**Date:** 2026-06-21  
**Status:** Approved  
**Scope:** Full visual overhaul of `index.html`, `src/index.css`, and `src/main.ts` (animation wiring only). No audio engine or state changes.

---

## 1. Goals

- Elevate MetroRig's UI from a flat dark page to a **DAW/plugin premium** aesthetic: glassmorphism surfaces, metallic gradients, smooth GSAP animations.
- Give each instrument track a **distinct color identity** used consistently in the sequencer grid, track labels, and stadium mode orbs.
- Replace the single beat flasher in stadium mode with **4 per-instrument colored orbs** that animate individually when each sound fires.
- Keep the full-page adaptive layout (no fixed plugin window size).
- Keep Vanilla CSS for all layout and styling; add **GSAP (CDN)** exclusively for animations.

---

## 2. Design System

### 2.1 Color Palette

```css
:root {
  --bg:            #080810;
  --glass-bg:      rgba(255, 255, 255, 0.04);
  --glass-border:  rgba(255, 255, 255, 0.08);
  --neon-green:    #39FF14;
  --neon-green-dim:#1e640b;
  --color-click:   #FFB800;
  --color-kick:    #FF2D55;
  --color-snare:   #00D4FF;
  --color-hihat:   #00FF94;
  --text:          #F3F4F6;
  --text-muted:    #9CA3AF;
  --cyber-yellow:  #FFE600;
  --radius-card:   12px;
  --radius-cell:   6px;
}
```

### 2.2 Track Color Map

| trackId | Name   | CSS Variable    | Hex       |
|---------|--------|-----------------|-----------|
| 0       | Click  | --color-click   | #FFB800   |
| 1       | Kick   | --color-kick    | #FF2D55   |
| 2       | Snare  | --color-snare   | #00D4FF   |
| 3       | Hi-hat | --color-hihat   | #00FF94   |

Used in: track label pills, active/accent step cells, stadium orbs.

### 2.3 Typography

- UI labels, controls: `Inter`, system-ui fallback (already loaded)
- BPM display, logo, monospace: `JetBrains Mono` from Google Fonts (weights: 400, 700)

### 2.4 Surface & Elevation

- Glass cards: `background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border);`
- Card shadow: `box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);`

### 2.5 Animation Library

Load GSAP 3 from CDN in `index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
```

GSAP used only for:
- Beat orb pulse in stadium mode
- Background color flash on beat
- Play button icon morph (▶ ↔ ■)
- Trainer panel collapse/expand
- Save preset toast slide-in/out

---

## 3. Editor View

### 3.1 Header

```
[ MetroRig PRO ]   [ ▾ preset-selector ]   [ ⚡ Stadium Mode ]
```

- Logo: JetBrains Mono, 2rem, font-weight 700, color var(--neon-green), text-shadow glow. Followed by a small `.badge` pill with text "PRO".
- Preset selector: dark glass background, mono font, custom SVG chevron (appearance: none). Focus: border-color neon-green.
- Stadium Mode button: pill shape (border-radius: 999px), neon-green border and text, ⚡ icon. Hover: fills neon-green, dark text.

### 3.2 Layout

Two-column CSS grid: `grid-template-columns: 2fr 1fr; gap: 1.5rem; padding: 1.5rem;`

### 3.3 Sequencer Panel (left column)

Glass card with:
- **Panel header** inside card: `{preset.name} · {timeSignature} · {bpm} BPM` in small mono text.
- **Track label pills** per row: background rgba(track-color, 0.15), border track-color, text track-color, border-radius 999px.
- **Step cells:**
  - Base: rgba(255,255,255,0.03) bg, glass border.
  - `.active`: rgba(TRACK_COLOR, 0.25) bg, border track-color, glow box-shadow.
  - `.accent` (Click only): full track-color bg, strong glow.
  - Hover: border-color rgba(TRACK_COLOR, 0.5), transition 200ms.
- Track color applied via `data-track="{0-3}"` on each row wrapper; CSS cascade via `[data-track="0"]`, `[data-track="1"]`, etc.

### 3.4 Controls Panel (right column)

**Card 1 — BPM & Play:**
- BPM number: JetBrains Mono, 4rem, font-weight 700, neon-green with glow.
- Slider: custom-styled range. Thumb: 16px circle, neon-green with glow.
- Play/Stop: large full-width pill button. GSAP crossfades between ▶ and ■ icon spans (opacity, 150ms).

**Card 2 — Trainer Config (collapsible):**
- Header: "Tempo Trainer" label + chevron ▾. Click toggles open/close.
- GSAP animates height 0→auto and chevron rotation 0→180deg.
- Inputs in 2-column grid inside panel.
- Enabled indicator: green dot next to header label when checkbox is checked.

**Card 3 — Save Preset (conditional toast):**
- Hidden by default. GSAP slide-down (y: -20→0, opacity 0→1) when preset is modified.
- Contains: text input pre-filled with preset name + "Save" button.
- On save: GSAP slides back up and fades out.

---

## 4. Stadium View

### 4.1 Layout (centered flex column)

```
[ timer — small mono ]
[ BPM — giant ]
[ trainer status ]
[ orb row: 4 orbs ]
[ play button ]
```

Background: radial gradient from center (dim spotlight effect on var(--bg)).

### 4.2 BPM Display

JetBrains Mono, 8rem, font-weight 900, neon-green. On each beat tick: GSAP quick glow pulse (textShadow intensity up then settles, 300ms total).

### 4.3 Per-Instrument Orbs

Four `<div class="orb" data-track="{0-3}">` in a flex row, gap 2rem.

Resting state: 48px circle, rgba(TRACK_COLOR, 0.1) bg, thin rgba(TRACK_COLOR, 0.2) border.

On fire (GSAP timeline):
```js
gsap.timeline()
  .to(orb, { scale: 1.8, backgroundColor: TRACK_COLOR, boxShadow: `0 0 40px ${TRACK_COLOR}`, duration: 0.05 })
  .to(orb, { scale: 1.0, backgroundColor: 'rgba(TRACK_COLOR, 0.1)', boxShadow: 'none', duration: 0.3, ease: 'power2.out' });
```

Background flash: fixed full-screen `#bg-flash` div, pointer-events none. GSAP fades to opacity 0.04 (dominant track color) then back to 0 in 300ms. Dominant = lowest trackId that fired this tick.

### 4.4 Tick Event Integration

The AudioWorklet tick message must be extended to include `activeTrackIds: number[]` — the list of track IDs that had a step=1 or step=2 at the current beat position.

Changes required:
- `metronome-processor.ts`: include `activeTrackIds` in the tick port message.
- `main.ts` tick handler: read `activeTrackIds`, fire orb animations for each, fire bg flash.

The existing `currentBpm` field in the tick message is preserved.

### 4.5 Removed Elements

- `#beat-flash` bar — removed, replaced by orb system.
- `#stadium-status` — kept, repositioned above orb row.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `index.html` | GSAP CDN, orb elements, data-track attrs, header restructure, bg-flash div |
| `src/index.css` | Full visual rewrite with new design system and data-track color cascade |
| `src/main.ts` | GSAP animation wiring (play toggle, trainer collapse, save toast, orb pulses, BPM glow) |
| `src/audio/metronome-processor.ts` | Add activeTrackIds to tick message payload |

---

## 6. Out of Scope

- No Rust engine changes.
- No StateManager, FACTORY_PRESETS, or Preset interface changes.
- No test file changes.
- No Tailwind, no component framework.

---

## 7. Success Criteria

- [ ] Each track row has a colored pill label in its track color.
- [ ] Active/accent step cells glow in their track color, not global green.
- [ ] BPM display uses JetBrains Mono and pulses via GSAP on each beat.
- [ ] Stadium mode: 4 orbs each animate independently when their instrument fires a step.
- [ ] Background flash fires at very low opacity on each beat.
- [ ] Trainer panel collapses/expands with GSAP height animation.
- [ ] Save preset appears as animated toast (not permanent layout element).
- [ ] All existing JS tests pass (`npm run test:js`).
- [ ] Rust tests pass (`npm run test:rust`).
