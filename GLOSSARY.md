# MetroRig Glossary

The words the code and the specs use for MetroRig's parts. `CONTRIBUTING.md` says where each part lives.

## Parts of the app

- **Session**: The object in `src/app/session.ts` that runs every rule a user sees: play and stop, presets, songs, grooves, steps, mute and solo, the Speed Trainer settings and the Improv chords. It receives the engine and the storage as arguments, and the screens read its state and call its commands.
- **Trainer**: The Speed Trainer. It raises the tempo from a start BPM to a target BPM, by an increment, every so many bars or seconds, stepped or smooth. In the engine it is the `Trainer` of `engine/src/sequencer/trainer.rs`, which hands each new BPM back to its caller.
- **Instrument**: A voice of the engine that turns a step or a chord into sound: the click, the drums or the Pad. Each one lives under `engine/src/instruments/` and uses only the `dsp` layer.
- **Screen**: One view of the page: the Editor, Stadium, Grooves or Improv. Each is a module of `src/ui/` that mounts on the Session, next to the header.

## Patterns

- **Cell**: One place a hit can fall in a bar. A straight cell lasts a sixteenth; a triplet cell lasts a third of a beat and a sextuplet cell a sixth. The engine plays each cell for its length in twelfths of a sixteenth: 12, 16 or 8 (AD-029). A pattern holds up to 48 cells in a bar and 192 in all.
- **Beat cells**: The optional `beatCells` of a preset, a song or a groove: each bar's cell count per beat, 4 straight, 3 triplet or 6 sextuplet. With no `beatCells` every beat is straight. `src/domain/layout.ts` holds every rule that places a cell in its bar, beat and time.
- **Tuplet**: A beat of a /4 bar split into 3 cells (a triplet) or 6 (a sextuplet) in place of 4 sixteenths. It is written with the `Triplet` and `Sextuplet` figures, and changing a beat's kind moves each hit to the nearest cell.

## Layers of the app (`src/`)

- **domain**: The music and pattern rules with no I/O: meter, pattern, preset, kit, chords, songs and the track mix. It imports nothing from `src/`.
- **data**: The factory content: presets, grooves and Speed Trainer routines. It imports only `domain`.
- **storage**: What survives a reload: the IndexedDB database and the `localStorage` preferences. It imports only `domain`.
- **audio**: The adapter to the AudioWorklet and the WASM engine, and the scheduler that draws ticks once they are heard. It imports only `domain`.
- **app**: The Session and its parts: transport, library, Improv and the state manager. It imports `domain`, `data`, `storage` and `audio`.
- **ui**: The DOM: the header and the four screens, which render Session state and turn gestures into Session commands. It imports only `app` and `domain`.

## Layers of the engine (`engine/src/`)

- **dsp**: Sound primitives with no notion of tracks or notes: samples, chorus, reverb and filters. It uses no other module of the crate.
- **sequencer**: When steps fall, what each step holds and how the Trainer moves the tempo: the clock, the pattern and the Trainer. It uses no other module of the crate.
- **instruments**: The click, the drums and the Pad. They use only `dsp`.
- **engine**: The `Engine`, which composes the sequencer and the instruments and mixes each block. It uses `sequencer`, `instruments` and `dsp`.
- **ffi**: The WASM seam: the `extern "C"` functions and the only `unsafe` code outside tests. It uses only `engine`.
