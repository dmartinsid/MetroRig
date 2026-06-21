# Documentation and WASM Build Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate compilation and copying of the Rust-compiled WASM binary, and document local execution and contributing guidelines in README.md and CONTRIBUTING.md.

**Architecture:** A lightweight Node.js script `scripts/copy_wasm.js` will copy the compiled `metrorig_audio.wasm` target into Vite's public static folder `public/pkg/metrorig_audio_bg.wasm`. Separate markdown files (`README.md` and `CONTRIBUTING.md`) will serve as the User and Developer manuals.

**Tech Stack:** Node.js, Rust (Cargo, wasm32), Vite, Markdown.

## Global Constraints

- Precompiled/synced WASM target must reside at: `public/pkg/metrorig_audio_bg.wasm`.
- Build scripts in package.json must use standard, portable commands to ensure cross-platform compatibility (macOS/Linux/Windows).
- Documentation files must be written in English.

---

### Task 1: WASM Build & Copy Automation

**Files:**
- Create: `scripts/copy_wasm.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `target/wasm32-unknown-unknown/release/metrorig_audio.wasm` (compiled Rust output)
- Produces: Synced WASM asset at `public/pkg/metrorig_audio_bg.wasm` via `"npm run build:wasm"` and `"npm run build"` commands.

- [ ] **Step 1: Create the WASM copy utility script**
  Create the file `scripts/copy_wasm.js` with the following content:
  ```javascript
  import fs from 'fs';
  import path from 'path';
  import { fileURLToPath } from 'url';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const source = path.resolve(__dirname, '../target/wasm32-unknown-unknown/release/metrorig_audio.wasm');
  const destDir = path.resolve(__dirname, '../public/pkg');
  const dest = path.resolve(destDir, 'metrorig_audio_bg.wasm');

  console.log(`Copying WASM from: ${source}`);
  console.log(`To destination: ${dest}`);

  if (!fs.existsSync(source)) {
    console.error(`Error: Compiled WASM file not found at: ${source}`);
    console.error('Please run "cargo build --target wasm32-unknown-unknown --release" first.');
    process.exit(1);
  }

  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(source, dest);
    console.log('WASM file successfully copied to public/pkg/metrorig_audio_bg.wasm');
  } catch (err) {
    console.error(`Error copying WASM file: ${err.message}`);
    process.exit(1);
  }
  ```

- [ ] **Step 2: Dry run the copy script with pre-existing build**
  Run: `node scripts/copy_wasm.js`
  Expected: Success output showing WASM file successfully copied.

- [ ] **Step 3: Modify package.json to integrate copy script**
  Modify target lines in `package.json` to declare the `"build:wasm"` command and update the `"build"` command:
  ```json
      "build:wasm": "cargo build --target wasm32-unknown-unknown --release && node scripts/copy_wasm.js",
      "build": "npm run build:wasm && vite build",
  ```

- [ ] **Step 4: Verify full build pipeline**
  Run: `npm run build`
  Expected:
  - Cargo builds the `wasm32-unknown-unknown` target.
  - `node scripts/copy_wasm.js` executes and outputs success messages.
  - Vite completes the build successfully, writing output to `dist/`.

- [ ] **Step 5: Commit build script changes**
  Run: `git add scripts/copy_wasm.js package.json && git commit -m "feat: automate WASM build and copy task"`

---

### Task 2: Create User Guide (README.md)

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: Project configuration, scripts defined in Task 1.
- Produces: Root-level markdown user manual.

- [ ] **Step 1: Create README.md**
  Write the user-facing documentation into `README.md` containing introduction, setup, local execution, build instructions, and UI guide:
  ```markdown
  # MetroRig Metronome & Drum Machine

  MetroRig is a modern, high-fidelity Web-based 16-step sequencer, metronome, and practice tool. It uses a low-latency Rust DSP audio engine compiled to WebAssembly (WASM) running inside an AudioWorklet thread to guarantee rock-solid timing accuracy.

  ## Features

  - **High-Accuracy Audio**: WebAssembly-powered DSP core rendering samples directly inside Web Audio's process loop.
  - **16-Step Sequencer**: A fully editable matrix with 4 tracks (Click, Kick, Snare, Hi-hat).
  - **Tempo Trainer**: Increase BPM automatically dynamically over time, supporting both stepped and smooth acceleration models.
  - **Dual Mode Views**:
    - **Editor Mode**: Set presets, configure Sequencer grids, and adjust speed details.
    - **Practice Stadium Mode**: Full-screen layout with elapsed timer, current tempo gauge, and clean beat pulse visualizer.

  ## Prerequisites

  To run the metronome locally, you need:
  - **Node.js** (version 18 or later)
  - Precompiled WASM assets are already checked into git (`public/pkg/metrorig_audio_bg.wasm`), so a Rust installation is **not** required for standard execution.

  ## Quick Start

  1. **Clone the repository**:
     ```bash
     git clone https://github.com/dmartinsid/MetroRig.git
     cd MetroRig
     ```

  2. **Install dependencies**:
     ```bash
     npm install
     ```

  3. **Launch the development server**:
     ```bash
     npm run dev
     ```

  4. **Open the App**:
     Open [http://localhost:3000](http://localhost:3000) in your web browser.

  ## Building for Production

  To build the app for production (pre-compiling the WebAssembly and bundling resources):
  ```bash
  npm run build
  ```
  The production assets will be output to the `dist/` directory.

  ## Troubleshooting & Browser Security

  Because this app relies on low-latency multithreaded WASM and `SharedArrayBuffer` modules, your browser requires **Cross-Origin Isolation** headers.
  - Vite is pre-configured to automatically inject these headers (`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`) during development and production build configurations.
  - If hosting the compiled static files, ensure your production web server serves the project with the corresponding headers.
  ```
  ```

- [ ] **Step 2: Commit User Guide**
  Run: `git add README.md && git commit -m "docs: create user README documentation"`

---

### Task 3: Create Contributor Guide (CONTRIBUTING.md)

**Files:**
- Create: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: Codebase structure, Cargo setup, Vitest configurations.
- Produces: Developer documentation.

- [ ] **Step 1: Create CONTRIBUTING.md**
  Write developer onboarding and code architecture details to `CONTRIBUTING.md`:
  ```markdown
  # MetroRig Developer & Contributor Guide

  Welcome! This guide explains how to set up the development environment, compile code, run tests, and contribute code modifications to MetroRig.

  ## Code Architecture Overview

  MetroRig separates its audio processing from its UI interactions using modern Web Audio APIs:

  ```mermaid
  graph TD
      A[Rust DSP Core - src/lib.rs] -->|cargo build Target wasm32| B(WebAssembly Binary)
      B -->|Compiled & Loaded| C[AudioWorklet - src/audio/metronome-processor.ts]
      C -->|SharedArrayBuffer / PostMessage| D[Main Thread Node - src/audio/MetronomeNode.ts]
      D -->|Handles Input/Ticks| E[State Manager - src/state.ts]
      E -->|Render UI Views| F[DOM Controller - src/main.ts]
  ```

  1. **DSP Engine (`src/lib.rs`)**: High-performance Rust synthesizer and mixer compiling to raw WebAssembly (WASM).
  2. **Audio Worklet (`src/audio/metronome-processor.ts`)**: JavaScript AudioWorklet thread loading the WASM binary and processing actual floating-point audio output.
  3. **Main Node Wrapper (`src/audio/MetronomeNode.ts`)**: API interfacing the worklet thread with the main thread.
  4. **State Manager (`src/state.ts`)**: Handles local browser state.
  5. **UI Layer (`src/main.ts`)**: Binds events and manipulates DOM interfaces.

  ## Developer Prerequisites

  To modify and rebuild the WebAssembly code, you need:
  - **Rust Toolchain**: Install via [rustup.rs](https://rustup.rs).
  - **WASM compilation target**: Run:
    ```bash
    rustup target add wasm32-unknown-unknown
    ```
  - **Node.js** (v18+) and npm.

  ## Development Workflow

  1. **Run Dev Server**:
     ```bash
     npm run dev
     ```
  2. **Modify Rust Audio Code**:
     Edit code inside `src/lib.rs`.
  3. **Recompile and Sync WASM**:
     To build the updated Rust library and copy the compiled `.wasm` output to Vite's static public folder:
     ```bash
     npm run build:wasm
     ```
     The Vite dev server will pick up the updated WASM file in `public/pkg/metrorig_audio_bg.wasm` and trigger an automatic browser hot-reload.

  ## Running Tests

  MetroRig has independent test suites for the Rust DSP engine and the frontend state controller.

  ### 1. Rust Unit Tests (DSP Engine)
  Runs the DSP math assertions written in Rust:
  ```bash
  npm run test:rust
  ```
  *(or run standard `cargo test`)*

  ### 2. Frontend JS/TS Unit Tests
  Runs Vitest assertions targeting state management:
  ```bash
  npm run test:js
  ```
  *(runs `vitest run`)*

  ## Contribution Standards

  - Preserve type safety inside `MetronomeNode.ts`.
  - Maintain pristine compilation: all Rust edits must compile without warnings (`cargo check` or `cargo build` must produce 0 warnings).
  - Run all JS and Rust tests before submitting pull requests.
  ```

- [ ] **Step 2: Commit Contributor Guide**
  Run: `git add CONTRIBUTING.md && git commit -m "docs: create CONTRIBUTING developer guide"`
