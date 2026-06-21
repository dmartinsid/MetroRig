# Design Spec: Local Execution & Contributor Documentation with WASM Build Automation

This document outlines the design for creating user and developer documentation (README.md and CONTRIBUTING.md) and automating the WebAssembly (WASM) build-and-copy process for MetroRig.

---

## 1. Objectives

- Provide a clear onboarding experience for **users** who want to run the project locally.
- Provide a detailed guide for **contributors** on prerequisites, project architecture, compilation, and testing.
- Automate the process of building the Rust DSP library and copying the resulting `.wasm` binary into the `public/pkg` directory for Vite consumption.
- Ensure the copy/build automation is cross-platform compatible (works on Linux, macOS, and Windows).

---

## 2. Proposed Changes

### 2.1. Build Automation Configuration

#### New file: `scripts/copy_wasm.js`
A platform-agnostic Node.js script to copy the compiled WASM binary to the correct static asset folder.

- **Source path**: `target/wasm32-unknown-unknown/release/metrorig_audio.wasm`
- **Destination path**: `public/pkg/metrorig_audio_bg.wasm`
- **Logic**:
  - Check if source exists. If not, log instructions to compile.
  - Create the target directories recursively if they don't exist.
  - Copy the file.
  - Print success/failure output.

#### Updated file: `package.json`
Introduce new scripts and chain them together:
- `"build:wasm"`: Compiles Rust target (`cargo build --target wasm32-unknown-unknown --release`) and runs `node scripts/copy_wasm.js`.
- `"build"`: Runs `"npm run build:wasm && vite build"`.

---

## 3. Documentation Outlines

### 3.1. `README.md` (User & General Execution Guide)

- **Introduction**: Description of MetroRig as a modern 16-step sequencer, metronome, and tempo trainer.
- **Key Features**: List of main capabilities (synthesized click oscillator, multi-track audio nodes, practice timer, editor/stadium modes).
- **Prerequisites**: Node.js (version 18+).
- **Getting Started**:
  - `npm install`
  - `npm run dev`
  - Open `http://localhost:3000`
- **Building for Production**:
  - `npm run build`
  - Description of `dist/` build output.
- **Troubleshooting**: Common browser security contexts (Cross-Origin isolation headers required for SharedArrayBuffer / AudioWorklet execution).

### 3.2. `CONTRIBUTING.md` (Contributor & Architecture Guide)

- **Prerequisites**:
  - Rust toolchain (stable).
  - Target target: `wasm32-unknown-unknown` (`rustup target add wasm32-unknown-unknown`).
  - Node.js & npm.
- **Architecture Overview**:
  - System diagram showing components: `lib.rs` (DSP) $\rightarrow$ compiled to WebAssembly $\rightarrow$ AudioWorklet thread (`metronome-processor.ts`) $\rightarrow$ main thread wrapper (`MetronomeNode.ts`) $\rightarrow$ State Manager (`state.ts`) $\rightarrow$ DOM UI (`main.ts`).
  - SharedArrayBuffer communication details.
- **Development Steps**:
  - Modifying Rust source files.
  - Compiling and syncing: `npm run build:wasm`.
  - Running dev server: `npm run dev`.
- **Testing**:
  - Running Vitest unit tests: `npm run test:js`.
  - Running Cargo unit tests: `npm run test:rust` (or `cargo test`).

---

## 4. Verification Plan

1. **Verify copy script**: Run `cargo build --target wasm32-unknown-unknown --release` and then run `node scripts/copy_wasm.js`. Confirm `public/pkg/metrorig_audio_bg.wasm` exists and is identical to the target build output.
2. **Verify npm script workflow**: Run `npm run build` to verify the automated pipeline compiles and outputs static pages in `dist/`.
3. **Verify document accessibility**: Check links in `README.md` and `CONTRIBUTING.md` to ensure they reference active codebase elements correctly.
