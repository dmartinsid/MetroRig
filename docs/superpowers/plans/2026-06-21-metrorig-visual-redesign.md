# MetroRig Visual Redesign — DAW Plugin Premium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign MetroRig's UI to a DAW/plugin premium aesthetic using glassmorphism, per-track colors, GSAP animations, and per-instrument stadium orbs.

**Architecture:** Pure visual layer change — Vanilla CSS for all layout/style, GSAP (CDN) for animations only. One small AudioWorklet change to add `activeTrackIds` to the tick message. No Rust, no state, no audio logic changes.

**Tech Stack:** Vanilla CSS, GSAP 3 (CDN), JetBrains Mono (Google Fonts), TypeScript (existing), no new npm packages.

## Global Constraints

- Vanilla CSS only — no Tailwind, no CSS-in-JS, no component framework.
- GSAP loaded from CDN (`https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js`) — do NOT install via npm.
- JetBrains Mono loaded from Google Fonts — do NOT install via npm.
- No changes to `src/lib.rs`, `src/state.ts`, `src/audio/MetronomeNode.ts`, or any test file.
- Test commands: `npm run test:js` (vitest) and `npm run test:rust` (cargo test).
- All 5 existing JS tests must remain green after every task.
- Target: Wasm32-unknown-unknown (Rust, unchanged).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `index.html` | Modify | Structure: GSAP CDN, JetBrains Mono font, orb elements, bg-flash div, data-track attrs, header restructure |
| `src/index.css` | Full rewrite | All visual styles — design system tokens, glassmorphism cards, track color cascade, stadium orbs |
| `src/audio/metronome-processor.ts` | Modify | Add `activeTrackIds: number[]` to TICK message payload |
| `src/main.ts` | Modify | Wire GSAP animations: play icon morph, trainer collapse, save toast, BPM pulse, orb pulses, bg flash |

---

## Task 1: Design System CSS Foundation

**Files:**
- Modify: `src/index.css` (full rewrite)

**Interfaces:**
- Consumes: nothing (pure CSS)
- Produces: CSS custom properties and base styles consumed by all subsequent tasks. Key tokens:
  - `--color-click: #FFB800`, `--color-kick: #FF2D55`, `--color-snare: #00D4FF`, `--color-hihat: #00FF94`
  - `--glass-bg: rgba(255,255,255,0.04)`, `--glass-border: rgba(255,255,255,0.08)`
  - `--bg: #080810`, `--neon-green: #39FF14`, `--neon-green-dim: #1e640b`
  - `--radius-card: 12px`, `--radius-cell: 6px`
  - Track color cascade via `[data-track="0"]`, `[data-track="1"]`, `[data-track="2"]`, `[data-track="3"]`

- [ ] **Step 1: Replace the entire `src/index.css` with the new design system**

```css
/* ─── Google Fonts ──────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;900&display=swap');

/* ─── Design Tokens ─────────────────────────────────────── */
:root {
  --bg:             #080810;
  --glass-bg:       rgba(255, 255, 255, 0.04);
  --glass-border:   rgba(255, 255, 255, 0.08);
  --neon-green:     #39FF14;
  --neon-green-dim: #1e640b;
  --color-click:    #FFB800;
  --color-kick:     #FF2D55;
  --color-snare:    #00D4FF;
  --color-hihat:    #00FF94;
  --text:           #F3F4F6;
  --text-muted:     #9CA3AF;
  --cyber-yellow:   #FFE600;
  --radius-card:    12px;
  --radius-cell:    6px;
}

/* ─── Track color shortcuts (used in cascade selectors) ─── */
[data-track="0"] { --track-color: var(--color-click); }
[data-track="1"] { --track-color: var(--color-kick);  }
[data-track="2"] { --track-color: var(--color-snare); }
[data-track="3"] { --track-color: var(--color-hihat); }

/* ─── Reset & Base ───────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background-color: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

/* ─── Glass card mixin (applied as class) ───────────────── */
.card {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
}

/* ─── Header ─────────────────────────────────────────────── */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(8, 8, 16, 0.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--glass-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--neon-green);
  text-shadow: 0 0 20px rgba(57, 255, 20, 0.4);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo .badge {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--neon-green);
  border: 1px solid var(--neon-green);
  border-radius: 4px;
  padding: 1px 5px;
  opacity: 0.7;
  align-self: flex-start;
  margin-top: 4px;
}

.preset-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

#preset-selector {
  background: rgba(8, 8, 16, 0.8);
  color: var(--text);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239CA3AF' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  transition: border-color 0.2s, box-shadow 0.2s;
}

#preset-selector:focus {
  border-color: var(--neon-green);
  box-shadow: 0 0 8px rgba(57, 255, 20, 0.3);
}

/* ─── Stadium Mode Button ────────────────────────────────── */
#btn-toggle-view {
  background: transparent;
  color: var(--neon-green);
  border: 1px solid var(--neon-green);
  border-radius: 999px;
  padding: 0.5rem 1.25rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  letter-spacing: 0.05em;
}

#btn-toggle-view:hover {
  background: var(--neon-green);
  color: var(--bg);
  box-shadow: 0 0 16px rgba(57, 255, 20, 0.4);
}

/* ─── Editor Layout ──────────────────────────────────────── */
#editor-view {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
  padding: 1.5rem;
}

/* ─── Sequencer Panel ────────────────────────────────────── */
.sequencer-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-header {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--glass-border);
  margin-bottom: 0.5rem;
}

.sequencer-grid {
  display: grid;
  grid-template-columns: auto repeat(16, 1fr);
  gap: 0.4rem;
  align-items: center;
}

/* Track label pill */
.track-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--track-color);
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--track-color);
  border-radius: 999px;
  padding: 3px 10px;
  min-width: 60px;
  text-align: center;
  text-transform: uppercase;
}

/* Step cells */
.step-cell {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-cell);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.step-cell:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
}

[data-track] .step-cell:hover {
  border-color: color-mix(in srgb, var(--track-color) 50%, transparent);
}

.step-cell.active {
  background: color-mix(in srgb, var(--track-color) 25%, transparent);
  border-color: var(--track-color);
  box-shadow: 0 0 8px color-mix(in srgb, var(--track-color) 40%, transparent);
}

.step-cell.accent {
  background: var(--track-color);
  border-color: var(--track-color);
  box-shadow: 0 0 16px var(--track-color);
}

/* ─── Controls Panel ─────────────────────────────────────── */
.controls-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* BPM Card */
.bpm-card {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bpm-display {
  font-family: 'JetBrains Mono', monospace;
  font-size: 4rem;
  font-weight: 700;
  color: var(--neon-green);
  text-shadow: 0 0 30px rgba(57, 255, 20, 0.35);
  line-height: 1;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.bpm-display .bpm-unit {
  font-size: 1rem;
  font-weight: 400;
  color: var(--text-muted);
}

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--glass-border);
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--neon-green);
  box-shadow: 0 0 8px rgba(57, 255, 20, 0.6);
  cursor: pointer;
}

/* Play Button */
.play-btn {
  background: transparent;
  color: var(--neon-green);
  border: 1px solid var(--neon-green);
  border-radius: 8px;
  width: 100%;
  padding: 0.9rem;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.play-btn:hover {
  background: var(--neon-green);
  color: var(--bg);
  box-shadow: 0 0 20px rgba(57, 255, 20, 0.4);
}

.play-btn .icon-play { display: inline; }
.play-btn .icon-stop { display: none; }
.play-btn.playing .icon-play { display: none; }
.play-btn.playing .icon-stop { display: inline; }

/* Trainer Card */
.trainer-card {
  padding: 1.25rem;
  overflow: hidden;
}

.trainer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.trainer-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.trainer-active-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--neon-green);
  box-shadow: 0 0 6px var(--neon-green);
  display: none;
}

.trainer-active-dot.visible { display: block; }

.trainer-chevron {
  color: var(--text-muted);
  font-size: 0.75rem;
  transition: transform 0.3s ease;
}

.trainer-body {
  height: 0;
  overflow: hidden;
}

.trainer-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  padding-top: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.form-group.full-width {
  grid-column: 1 / -1;
}

input[type="number"],
select {
  background: rgba(8, 8, 16, 0.8);
  border: 1px solid var(--glass-border);
  color: var(--text);
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.85rem;
  width: 100%;
  outline: none;
  transition: border-color 0.2s;
}

input[type="number"]:focus,
select:focus {
  border-color: var(--neon-green);
}

input[type="checkbox"] {
  accent-color: var(--neon-green);
  width: 16px;
  height: 16px;
}

/* Save Preset Toast */
.save-toast {
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  overflow: hidden;
  opacity: 0;
  transform: translateY(-20px);
  pointer-events: none;
}

.save-toast.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.save-toast input[type="text"] {
  flex: 1;
  background: rgba(8, 8, 16, 0.8);
  border: 1px solid var(--glass-border);
  color: var(--text);
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.85rem;
  outline: none;
}

.save-toast input[type="text"]:focus {
  border-color: var(--neon-green);
}

.btn-save {
  background: var(--neon-green-dim);
  color: var(--neon-green);
  border: 1px solid var(--neon-green);
  border-radius: 6px;
  padding: 0.4rem 0.9rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}

.btn-save:hover {
  background: var(--neon-green);
  color: var(--bg);
}

/* ─── Utilities ──────────────────────────────────────────── */
.hidden { display: none !important; }

/* ─── Stadium View ───────────────────────────────────────── */
#stadium-view {
  height: calc(100vh - 70px);
  display: flex;
  justify-content: center;
  align-items: center;
  background: radial-gradient(ellipse at center, rgba(57,255,20,0.03) 0%, transparent 70%);
}

.stadium-display {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.stadium-timer {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.2rem;
  color: var(--text-muted);
  letter-spacing: 0.15em;
}

.stadium-bpm {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8rem;
  font-weight: 900;
  color: var(--neon-green);
  text-shadow: 0 0 30px rgba(57, 255, 20, 0.4);
  letter-spacing: -0.05em;
  line-height: 1;
}

.stadium-trainer-info {
  font-size: 1rem;
  color: var(--cyber-yellow);
  letter-spacing: 0.05em;
}

/* Orb row */
.orb-row {
  display: flex;
  gap: 2rem;
  align-items: center;
  justify-content: center;
}

.orb {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  position: relative;
}

[data-track="0"].orb {
  background: rgba(255, 184, 0, 0.1);
  border: 1px solid rgba(255, 184, 0, 0.25);
}
[data-track="1"].orb {
  background: rgba(255, 45, 85, 0.1);
  border: 1px solid rgba(255, 45, 85, 0.25);
}
[data-track="2"].orb {
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.25);
}
[data-track="3"].orb {
  background: rgba(0, 255, 148, 0.1);
  border: 1px solid rgba(0, 255, 148, 0.25);
}

/* Background flash overlay */
#bg-flash {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  z-index: 0;
}

/* Stadium play button */
.play-btn-large {
  width: 200px;
  font-size: 1.2rem;
  border-radius: 999px;
  padding: 1rem 2rem;
}
```

- [ ] **Step 2: Run JS tests to confirm no CSS change broke test harness**

```bash
npm run test:js
```
Expected: `5 passed (5)`, no failures.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: redesign CSS to DAW plugin premium style with glassmorphism and track colors"
```

---

## Task 2: HTML Structure Update

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: CSS classes from Task 1 (`card`, `bpm-card`, `trainer-card`, `save-toast`, `orb`, `orb-row`, `panel-header`, `play-btn`, `badge`, `track-label`, `bpm-display`, etc.)
- Produces: Updated DOM structure. Key new elements for Task 4 (GSAP wiring):
  - `#btn-play` — has `.icon-play` and `.icon-stop` child spans
  - `#btn-stadium-play` — same children
  - `.trainer-header` div (click target for collapse)
  - `.trainer-chevron` span (rotation target)
  - `.trainer-body` div (height animation target)
  - `.save-toast` div (slide animation target)
  - `#orb-0`, `#orb-1`, `#orb-2`, `#orb-3` — orb elements with `data-track` attrs
  - `#bg-flash` — fixed overlay div
  - `#stadium-bpm` — BPM text (glow pulse target)
  - `#panel-header-text` — sequencer info text (updated from JS)

- [ ] **Step 1: Replace `index.html` with the updated structure**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MetroRig — Pro Metronome & Drum Machine</title>
  <meta name="description" content="MetroRig is a professional browser-based metronome and drum machine sequencer with time signature presets and tempo trainer.">
  <link rel="stylesheet" href="./src/index.css">
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
</head>
<body>
  <!-- Background flash overlay for stadium beats -->
  <div id="bg-flash"></div>

  <div id="app">
    <header>
      <span class="logo">MetroRig<span class="badge">PRO</span></span>

      <div class="preset-controls">
        <select id="preset-selector">
          <optgroup id="group-signatures" label="Time Signatures"></optgroup>
          <optgroup id="group-genres" label="Drum Grooves"></optgroup>
          <optgroup id="group-user" label="User Presets"></optgroup>
        </select>
      </div>

      <button id="btn-toggle-view">⚡ Stadium Mode</button>
    </header>

    <!-- Editor Mode -->
    <main id="editor-view">
      <!-- Left: Sequencer -->
      <section class="sequencer-container card" style="padding: 1.5rem;">
        <div class="panel-header" id="panel-header-text">Default · 4/4 · 120 BPM</div>
        <div class="sequencer-grid" id="grid-container"></div>
      </section>

      <!-- Right: Controls -->
      <aside class="controls-container">
        <!-- BPM & Play -->
        <div class="bpm-card card">
          <div class="bpm-display">
            <span id="bpm-number">120</span>
            <span class="bpm-unit">BPM</span>
          </div>
          <input type="range" id="bpm-slider" min="40" max="240" value="120">
          <button id="btn-play" class="play-btn">
            <span class="icon-play">▶ PLAY</span>
            <span class="icon-stop">■ STOP</span>
          </button>
        </div>

        <!-- Save Preset Toast -->
        <div class="save-toast card" id="save-toast">
          <input type="text" id="preset-name" placeholder="Preset name…">
          <button class="btn-save" id="btn-save">Save</button>
        </div>

        <!-- Trainer (collapsible) -->
        <div class="trainer-card card">
          <div class="trainer-header" id="trainer-toggle">
            <span class="trainer-title">
              <span class="trainer-active-dot" id="trainer-dot"></span>
              Tempo Trainer
            </span>
            <span class="trainer-chevron" id="trainer-chevron">▾</span>
          </div>
          <div class="trainer-body" id="trainer-body">
            <div class="trainer-form">
              <div class="form-group full-width">
                <label>
                  <input type="checkbox" id="trainer-enable"> Trainer Active
                </label>
              </div>
              <div class="form-group">
                <label for="trainer-start">Start BPM</label>
                <input type="number" id="trainer-start" value="120">
              </div>
              <div class="form-group">
                <label for="trainer-target">Target BPM</label>
                <input type="number" id="trainer-target" value="160">
              </div>
              <div class="form-group">
                <label for="trainer-inc">Increment</label>
                <input type="number" id="trainer-inc" value="5">
              </div>
              <div class="form-group">
                <label for="trainer-val">Step Value</label>
                <input type="number" id="trainer-val" value="4">
              </div>
              <div class="form-group">
                <label for="trainer-type">Step Type</label>
                <select id="trainer-type">
                  <option value="measures">Measures</option>
                  <option value="seconds">Seconds</option>
                </select>
              </div>
              <div class="form-group">
                <label for="trainer-curve">Curve</label>
                <select id="trainer-curve">
                  <option value="stepped">Stepped</option>
                  <option value="smooth">Smooth Ramp</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </main>

    <!-- Stadium View -->
    <main id="stadium-view" class="hidden">
      <div class="stadium-display">
        <div class="stadium-timer" id="stadium-timer">00:00</div>
        <div class="stadium-bpm" id="stadium-bpm">120.0</div>
        <div class="stadium-trainer-info" id="stadium-status">Trainer Off</div>

        <!-- Per-instrument orbs -->
        <div class="orb-row">
          <div class="orb" id="orb-0" data-track="0" title="Click"></div>
          <div class="orb" id="orb-1" data-track="1" title="Kick"></div>
          <div class="orb" id="orb-2" data-track="2" title="Snare"></div>
          <div class="orb" id="orb-3" data-track="3" title="Hi-hat"></div>
        </div>

        <button id="btn-stadium-play" class="play-btn play-btn-large">
          <span class="icon-play">▶ PLAY</span>
          <span class="icon-stop">■ STOP</span>
        </button>
      </div>
    </main>
  </div>

  <script type="module" src="./src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Run JS tests**

```bash
npm run test:js
```
Expected: `5 passed (5)`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: update HTML structure for visual redesign — orbs, toast, trainer collapse"
```

---

## Task 3: Tick Message — activeTrackIds Payload

**Files:**
- Modify: `src/audio/metronome-processor.ts` (lines 155–165 approximately, the `process()` method tick block)

**Interfaces:**
- Consumes: existing `engine_get_tick` FFI which returns the current `step_index` (i32, -1 if no tick), and the `tracks` data already stored in Rust memory. At tick time, the grid data for the current step is already processed in `trigger_step()` in Rust — the worklet can read `activeTrackIds` by inspecting the last grid data it knows about from `UPDATE_GRID` messages.
- Produces: TICK message with shape:
  ```ts
  { type: 'TICK', beatIndex: number, currentBpm: number, activeTrackIds: number[] }
  ```
  `activeTrackIds` is an array of 0–3 containing the track IDs that had a non-zero step at this beat index.

**Implementation note:** The worklet already receives `UPDATE_GRID` messages with the step data per track. The simplest approach (no Rust changes needed) is for the worklet to maintain a local JS mirror of the grid data, and on tick, read `grid[trackId][beatIndex]` for each track to determine which are active. This avoids any Rust FFI changes.

- [ ] **Step 1: Add a local grid mirror to `MetronomeProcessor`**

In `src/audio/metronome-processor.ts`, add a private field after `private bufferLength`:

```ts
// Local mirror of the grid data for computing activeTrackIds on tick
private gridMirror: number[][] = [
  new Array(32).fill(0),
  new Array(32).fill(0),
  new Array(32).fill(0),
  new Array(32).fill(0),
];
```

- [ ] **Step 2: Update the `UPDATE_GRID` case to populate the mirror**

In the `processCommand` switch, update the `UPDATE_GRID` case to also write into `this.gridMirror`:

```ts
case 'UPDATE_GRID': {
  const { trackId, steps } = msg;
  const length = steps.length;

  // Update local mirror
  for (let i = 0; i < length; i++) {
    this.gridMirror[trackId][i] = steps[i];
  }

  // Allocate buffer, copy data, and update grid (existing code)
  const ptr = exports.engine_alloc(length);
  const heap = new Uint8Array(exports.memory.buffer);
  heap.set(steps, ptr);
  exports.engine_update_grid(this.enginePtr, trackId, ptr, length);
  exports.engine_free_buf(ptr, length);
  break;
}
```

- [ ] **Step 3: Extend the TICK postMessage to include `activeTrackIds`**

In the `process()` method, find the existing tick block:
```ts
if (tickIndex >= 0) {
  const heapDouble = new Float64Array(exports.memory.buffer);
  const bpm = heapDouble[this.bpmPtr / 8];
  this.port.postMessage({
    type: 'TICK',
    beatIndex: tickIndex,
    currentBpm: bpm
  });
}
```

Replace with:
```ts
if (tickIndex >= 0) {
  const heapDouble = new Float64Array(exports.memory.buffer);
  const bpm = heapDouble[this.bpmPtr / 8];

  // Determine which tracks have a step active at this beat
  const activeTrackIds: number[] = [];
  for (let t = 0; t < 4; t++) {
    if ((this.gridMirror[t][tickIndex] ?? 0) > 0) {
      activeTrackIds.push(t);
    }
  }

  this.port.postMessage({
    type: 'TICK',
    beatIndex: tickIndex,
    currentBpm: bpm,
    activeTrackIds,
  });
}
```

- [ ] **Step 4: Run JS tests**

```bash
npm run test:js
```
Expected: `5 passed (5)`.

- [ ] **Step 5: Commit**

```bash
git add src/audio/metronome-processor.ts
git commit -m "feat: add activeTrackIds to TICK message payload using local grid mirror"
```

---

## Task 4: GSAP Animation Wiring in main.ts

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes:
  - GSAP global (`window.gsap`) loaded from CDN — TypeScript sees it as `(window as any).gsap` or declare a global. Use `declare const gsap: any;` at the top of the file.
  - DOM elements from Task 2: `#save-toast`, `#trainer-toggle`, `#trainer-body`, `#trainer-chevron`, `#trainer-dot`, `#btn-play`, `#btn-stadium-play`, `#orb-0..3`, `#bg-flash`, `#stadium-bpm`, `#panel-header-text`, `#trainer-enable`
  - TICK message shape from Task 3: `{ type, beatIndex, currentBpm, activeTrackIds: number[] }`
- Produces: all animations wired, panel header text updated, play toggle classes applied, save toast shown/hidden via GSAP.

**Track color lookup** (define as a constant at the top of `main.ts`, after imports):
```ts
const TRACK_COLORS = ['#FFB800', '#FF2D55', '#00D4FF', '#00FF94'];
```

- [ ] **Step 1: Add GSAP global declaration and new DOM references**

After the existing imports and before `const state = new StateManager();`, add:

```ts
declare const gsap: any;

const TRACK_COLORS = ['#FFB800', '#FF2D55', '#00D4FF', '#00FF94'];
```

Add the following new DOM references alongside the existing ones:

```ts
const panelHeaderText = document.getElementById('panel-header-text') as HTMLElement;
const saveTost = document.getElementById('save-toast') as HTMLElement;
const trainerToggle = document.getElementById('trainer-toggle') as HTMLElement;
const trainerBody = document.getElementById('trainer-body') as HTMLElement;
const trainerChevron = document.getElementById('trainer-chevron') as HTMLElement;
const trainerDot = document.getElementById('trainer-dot') as HTMLElement;
const bgFlash = document.getElementById('bg-flash') as HTMLElement;
const orbs = [0, 1, 2, 3].map(i => document.getElementById(`orb-${i}`) as HTMLElement);
```

Note: `presetNameInput` now points to `#preset-name` inside `#save-toast`. `btnSave` points to `#btn-save` inside `#save-toast`. These element IDs are unchanged — no DOM reference updates needed for them.

- [ ] **Step 2: Replace `markPresetAsModified()` with GSAP toast slide-in**

Replace the existing `markPresetAsModified()` function:

```ts
function markPresetAsModified() {
  if (!presetNameInput.value) {
    presetNameInput.value = state.activePreset.name;
  }
  gsap.to(saveTost, { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out', pointerEvents: 'auto' });
}
```

And update `loadPresetIntoUI` to hide the toast via GSAP (replace the two `style.display = 'none'` lines for toast/button):

```ts
// Replace this block in loadPresetIntoUI:
presetNameInput.style.display = 'none';
presetNameInput.value = '';
btnSave.style.display = 'none';

// With:
gsap.to(saveTost, { y: -20, opacity: 0, duration: 0.2, ease: 'power2.in', pointerEvents: 'none' });
presetNameInput.value = '';
```

And update `btnSave.onclick` to hide the toast via GSAP after save:

```ts
// Replace this block in the then() callback:
presetNameInput.value = '';
presetNameInput.style.display = 'none';
btnSave.style.display = 'none';

// With:
gsap.to(saveTost, { y: -20, opacity: 0, duration: 0.2, ease: 'power2.in', pointerEvents: 'none' });
presetNameInput.value = '';
```

- [ ] **Step 3: Wire trainer panel collapse/expand via GSAP**

Add after the existing `formInputs.forEach` block:

```ts
// Trainer panel toggle
let trainerOpen = false;
trainerToggle.onclick = () => {
  trainerOpen = !trainerOpen;
  if (trainerOpen) {
    gsap.to(trainerBody, { height: 'auto', duration: 0.3, ease: 'power2.out' });
    gsap.to(trainerChevron, { rotation: 180, duration: 0.3, ease: 'power2.out' });
  } else {
    gsap.to(trainerBody, { height: 0, duration: 0.25, ease: 'power2.in' });
    gsap.to(trainerChevron, { rotation: 0, duration: 0.25, ease: 'power2.in' });
  }
};

// Trainer active dot visibility
trainerEnable.addEventListener('change', () => {
  if (trainerEnable.checked) {
    trainerDot.classList.add('visible');
  } else {
    trainerDot.classList.remove('visible');
  }
});
```

- [ ] **Step 4: Wire play button class toggle for icon swap**

In `togglePlay()`, after `btnPlay.innerText = 'PLAY'` / `'STOP'` — **remove those two lines** (the CSS + span approach handles it now) and replace with class toggling:

```ts
// In the stop branch (state.isPlaying was true):
btnPlay.classList.remove('playing');
btnStadiumPlay.classList.remove('playing');

// In the play branch (was stopped, now playing):
btnPlay.classList.add('playing');
btnStadiumPlay.classList.add('playing');
```

- [ ] **Step 5: Update panel header text on preset load**

In `loadPresetIntoUI`, after the BPM lines, add:

```ts
const ts = state.activePreset.timeSignature ?? '4/4';
panelHeaderText.textContent = `${state.activePreset.name}  ·  ${ts}  ·  ${state.activePreset.bpm} BPM`;
```

Also update it in `bpmSlider.oninput`:

```ts
const ts = state.activePreset.timeSignature ?? '4/4';
panelHeaderText.textContent = `${state.activePreset.name}  ·  ${ts}  ·  ${bpm} BPM`;
```

Note: `timeSignature` may not exist yet on the `Preset` interface — check `src/state.ts`. If it does not exist, use the `measureLength` field to derive it: 12→`'3/4'`, 14→`'7/8'`, 16→`'4/4'`. Add a helper:

```ts
function measureLengthToTimeSig(len: number): string {
  const map: Record<number, string> = { 12: '3/4', 14: '7/8', 16: '4/4' };
  return map[len] ?? `${len} steps`;
}
```

Then use `measureLengthToTimeSig(state.activePreset.measureLength || 16)` in place of `ts`.

- [ ] **Step 6: Wire stadium orb pulses and BPM glow in the tick handler**

Replace the entire existing `audioNode.addEventListener('tick', ...)` handler:

```ts
audioNode.addEventListener('tick', (e: any) => {
  const { currentBpm, activeTrackIds } = e.detail;

  // Update BPM text
  stadiumBpm.innerText = Number(currentBpm).toFixed(1);

  // Trainer status
  stadiumStatus.innerText = trainerEnable.checked
    ? `Trainer Running (${trainerCurve.value})`
    : 'Trainer Off';

  // BPM display glow pulse
  gsap.fromTo(stadiumBpm,
    { textShadow: '0 0 60px rgba(57,255,20,0.9)' },
    { textShadow: '0 0 30px rgba(57,255,20,0.4)', duration: 0.4, ease: 'power2.out' }
  );

  // Orb pulses for each active track
  const ids: number[] = activeTrackIds ?? [];
  ids.forEach((trackId: number) => {
    const orb = orbs[trackId];
    const color = TRACK_COLORS[trackId];
    if (!orb || !color) return;
    gsap.timeline()
      .to(orb, {
        scale: 1.8,
        backgroundColor: color,
        boxShadow: `0 0 40px ${color}, 0 0 80px ${color}`,
        duration: 0.05,
        ease: 'none',
      })
      .to(orb, {
        scale: 1.0,
        backgroundColor: `${color}1A`, // ~10% opacity hex
        boxShadow: 'none',
        duration: 0.35,
        ease: 'power2.out',
      });
  });

  // Background flash — dominant color = lowest trackId in activeTrackIds
  if (ids.length > 0) {
    const dominantColor = TRACK_COLORS[Math.min(...ids)];
    gsap.set(bgFlash, { backgroundColor: dominantColor });
    gsap.fromTo(bgFlash,
      { opacity: 0.05 },
      { opacity: 0, duration: 0.35, ease: 'power2.out' }
    );
  }
});
```

- [ ] **Step 7: Run full JS test suite**

```bash
npm run test:js
```
Expected: `5 passed (5)`, output pristine.

- [ ] **Step 8: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire GSAP animations — orb pulses, BPM glow, trainer collapse, save toast, play icon"
```

---

## Task 5: drawGrid track-color integration

**Files:**
- Modify: `src/main.ts` — `drawGrid()` function

**Interfaces:**
- Consumes: existing `drawGrid()` structure, CSS class `track-label` and `step-cell` from Task 1, `data-track` attribute cascade from Task 1.
- Produces: each track row wrapped in a `<div data-track="{trackId}">` so the CSS cascade applies `--track-color` correctly to labels and cells.

- [ ] **Step 1: Update `drawGrid()` to wrap rows in `data-track` divs**

Replace the entire `drawGrid()` function body:

```ts
function drawGrid() {
  gridContainer.innerHTML = '';
  const measureLength = state.activePreset.measureLength || 16;
  gridContainer.style.gridTemplateColumns = `auto repeat(${measureLength}, 1fr)`;

  for (let trackId = 0; trackId < 4; trackId++) {
    // Label cell (inside a wrapper that carries data-track for CSS cascade)
    const label = document.createElement('div');
    label.className = 'track-label';
    label.setAttribute('data-track', String(trackId));
    label.innerText = trackNames[trackId];
    gridContainer.appendChild(label);

    const trackSteps = state.activePreset.gridData[trackId] || new Array(16).fill(0);

    for (let step = 0; step < measureLength; step++) {
      const cell = document.createElement('div');
      cell.className = 'step-cell';
      cell.setAttribute('data-track', String(trackId));

      if (trackSteps[step] === 1) cell.classList.add('active');
      if (trackSteps[step] === 2) cell.classList.add('accent');

      cell.onclick = () => {
        let nextState = 0;
        if (trackId === 0) {
          nextState = (trackSteps[step] + 1) % 3;
        } else {
          nextState = trackSteps[step] === 1 ? 0 : 1;
        }
        trackSteps[step] = nextState;

        cell.className = 'step-cell';
        cell.setAttribute('data-track', String(trackId));
        if (nextState === 1) cell.classList.add('active');
        if (nextState === 2) cell.classList.add('accent');

        if (isAudioInit) {
          audioNode.updateGrid(trackId, new Uint8Array(trackSteps));
        }
        markPresetAsModified();
      };

      gridContainer.appendChild(cell);
    }
  }
}
```

- [ ] **Step 2: Run JS tests**

```bash
npm run test:js
```
Expected: `5 passed (5)`.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: add data-track attrs in drawGrid for per-track color cascade"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run all JS tests**

```bash
npm run test:js
```
Expected: `5 passed (5)`, output pristine.

- [ ] **Step 2: Run all Rust tests**

```bash
npm run test:rust
```
Expected: all passing.

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
npm run build 2>&1 | tail -20
```
Expected: build completes without TypeScript errors.

- [ ] **Step 4: Final commit if any cleanup**

```bash
git add -A
git commit -m "chore: visual redesign final cleanup"
```

Only commit if there are changes. If clean, skip.

