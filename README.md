# MetroRig Metronome & Drum Machine

MetroRig is a modern, high-fidelity Web-based 16-step sequencer, metronome, and practice tool. It uses a low-latency Rust DSP audio engine compiled to WebAssembly (WASM) running inside an AudioWorklet thread to guarantee rock-solid timing accuracy.

## Features

- **High-Accuracy Audio**: WebAssembly-powered DSP core rendering samples directly inside Web Audio's process loop.
- **Step Sequencer**: A fully editable grid of up to 32 steps with 11 tracks (Click, Kick, Snare, Hi-hat, Open Hat, Ride, Ride Bell, Crash, China, High Tom, Floor Tom), each hit at ghost, normal or accent.
- **Grooves**: Transcribed drum parts of famous rock, metal, metalcore and blues songs, loaded with their tempo in one click. Each song cites its Songsterr tab.
- **Tempo Trainer**: Increase BPM automatically dynamically over time, supporting both stepped and smooth acceleration models.
- **Three Screens**:
  - **Editor Mode**: Set presets, configure Sequencer grids, and adjust speed details.
  - **Practice Stadium Mode**: Full-screen layout with elapsed timer, current tempo gauge, and rotating beat clock.
  - **Grooves**: Browse the songs by genre, play one in place, or open it in the Editor.

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

## Drum Samples

Kick, Snare and Hi-hat are this project's own samples, written by `scripts/generate_samples.js`. The other 7 pieces, in `public/kit/`, come from public-domain and CC0 sources, listed file by file in `public/kit/LICENSE.md`.

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
