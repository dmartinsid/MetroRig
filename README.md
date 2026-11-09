# MetroRig Metronome & Drum Machine

MetroRig is a modern, high-fidelity Web-based 16-step sequencer, metronome, and practice tool. It uses a low-latency Rust DSP audio engine compiled to WebAssembly (WASM) running inside an AudioWorklet thread to guarantee rock-solid timing accuracy.

**Try it live: [dmartinsid.github.io/MetroRig](https://dmartinsid.github.io/MetroRig/)**

## Features

- **High-Accuracy Audio**: WebAssembly-powered DSP core rendering samples directly inside Web Audio's process loop.
- **Step Sequencer**: A fully editable grid of up to 32 steps per bar with 13 tracks (Click, Kick, Snare, Hi-hat, Open Hat, Ride, Ride Bell, Crash, China, High Tom, Mid Tom, Low Tom, Floor Tom), each hit at ghost, normal or accent.
- **Grooves**: Transcribed drum parts of famous rock, metal, metalcore and blues songs, loaded with their tempo in one click. Each song plays 4 bars of its Songsterr tab, fills included, and cites that tab.
- **Tempo Trainer**: Increase BPM automatically dynamically over time, supporting both stepped and smooth acceleration models.
- **Four Screens**:
  - **Editor Mode**: Set presets, configure Sequencer grids, and adjust speed details.
  - **Practice Stadium Mode**: Full-screen layout with elapsed timer, current tempo gauge, and rotating beat clock.
  - **Grooves**: Browse the songs by genre, play one in place, or open it in the Editor.
  - **Improv**: Hold a sustained pad on any of 408 chords and improvise over it, with or without the metronome.

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

Kick, Snare, High Tom, Mid Tom, Low Tom and Floor Tom come from The House Kit by [Better Mixes](https://www.youtube.com/@BetterMixes): one recording per dynamic, three takes of each, in `public/kit/house/`. Thank you, Better Mixes! The Hi-hat, Open Hat, Ride, Ride Bell, Crash and China are single samples from public-domain and CC0 sources, in `public/` and `public/kit/`. `public/kit/LICENSE.md` lists the origin of every file, and which licenses are unconfirmed.

## Chord Pads

The Improv screen holds a chord in one of five timbres, chosen in a select: Choir, New Age, Orchestra, Sweep and Analog. Analog comes from a synth in the Rust engine alone, and the others use samples released under Creative Commons CC0:

- New Age by FreePats: https://github.com/freepats/new-age
- Synth Pad Choir by FreePats: https://github.com/freepats/synth-pad-choir
- Sweep Pad by FreePats: https://github.com/freepats/sweep-pad
- Orchestra, built from the strings of VSCO 2 Community Edition by Versilian Studios: https://github.com/sgossner/VSCO-2-CE

Thank you, FreePats and Versilian Studios! The files are in `public/pads/`, and `public/kit/LICENSE.md` lists them.

## Building for Production

To build the app for production (pre-compiling the WebAssembly and bundling resources):
```bash
npm run build
```
The production assets will be output to the `dist/` directory, built to be served from `/MetroRig/`.

Every push to `main` runs `.github/workflows/deploy.yml`: it runs both test suites, builds the engine and the site, and publishes `dist/` to GitHub Pages.

## Troubleshooting & Browser Security

Because this app relies on low-latency multithreaded WASM and `SharedArrayBuffer` modules, your browser requires **Cross-Origin Isolation** headers.
- Vite is pre-configured to automatically inject these headers (`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`) during development and production build configurations.
- If hosting the compiled static files, ensure your production web server serves the project with the corresponding headers.
