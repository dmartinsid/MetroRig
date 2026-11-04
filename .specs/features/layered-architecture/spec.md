# Layered Architecture Specification

**Approved**: 2026-11-03 - user: "aprovado"

## Problem Statement

MetroRig's Rust engine sits in two files: `src/lib.rs` (3053 lines) holds the clock, the Speed Trainer, the click, the drums, the per-frame mix and 25 `extern "C"` functions inside one `Engine` of about 40 fields, and `src/pad.rs` (2393 lines) holds the Pad's voices next to its chorus, reverb and filters. The TypeScript is split into files but not into layers: `src/main.ts` (1386 lines) mixes four screens with engine start-up, storage and app rules, and `src/state.ts` mixes meter math, persistence and factory data, with import cycles through `bars.ts` and `songs.ts`. Each change means reading code that has nothing to do with it, and app rules are only testable through the whole DOM.

## Goals

- [ ] The Rust engine lives in `engine/` as one crate in layers `dsp` → `instruments` / `sequencer` → `engine` → `ffi`, with the Speed Trainer as its own module
- [ ] The TypeScript in `src/` sits in layers `domain` → `data` / `storage` / `audio` → `app` → `ui`, with `main.ts` as the only composition root
- [ ] Nothing a user hears or sees changes: the engine renders the same samples bit for bit, and every existing test passes with its assertions unchanged
- [ ] A test fails whenever code imports against the layer rule, in either language

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| One shared engine command protocol for `MetronomeNode` and the processor (review candidate 4) | Not chosen; user picked candidates 1, 2 and 3 |
| Splitting the DOM integration tests by screen (review candidate 5) | User chose to move `src/index.test.ts` and fix its imports only |
| Any change to sound, timing, screens, labels or stored data | This is a structural refactor |
| A Cargo workspace with several crates | User chose one crate with folders |
| ESLint or any new dependency | User chose a vitest import test |
| Renaming the `extern "C"` functions or the `metrorig_audio` crate | The worklet and the shipped WASM depend on them |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Rust layout | One crate `metrorig_audio` in `engine/`, modules `ffi`, `engine`, `sequencer/{clock,pattern,trainer}`, `instruments/{click,drums,pad/}`, `dsp/` | Asked | y - user: "Um crate, pastas"; "engine/ na raiz" |
| Proof of no regression | A golden test written on today's code before any move, plus every existing test with unchanged assertions | Asked | y - user: "Golden + testes" |
| Layer enforcement | A vitest test that reads the imports of `src/` and the `use crate::` lines of `engine/src/` | Asked | y - user: "Teste de imports" |
| `src/index.test.ts` | Moves to `tests/app.test.ts`; only import paths change | Asked | y - user: "Mover e ajustar imports" |
| Golden fingerprint | Each golden scenario stores a 64-bit FNV-1a hash of its output samples' bit patterns, taken at commit `591f031` | A hash keeps the reference small and still fails on a 1-bit change | n |
| Size limit per Rust file | At most 400 lines of production code per `.rs` file, `#[cfg(test)]` blocks excluded | Gives "modular" a measurable bound; the largest piece today, `fill_buffers`, is about 100 lines | n |
| Size limit for `main.ts` | At most 150 lines | `main.ts` only composes adapters, the Session and the screens | n |
| Where Rust tests sit | Each test moves to the module whose behaviour it asserts; the black-box FFI harness tests stay with `ffi.rs` | Tests cross the same interface callers use | n |
| `src/index.ts` | Deleted | `index.html` loads `src/main.ts`; `index.ts` only logs and nothing imports it | n |
| Shipped WASM | `public/pkg/metrorig_audio_bg.wasm` is rebuilt from `engine/` and committed | The app and `tests/wasm.test.ts` load that file | n |
| Paths in scripts and fixtures | `package.json` scripts, `scripts/copy_wasm.js` and the Python fixtures that read `src/chords.ts` follow the moved files | They break otherwise | n |
| File naming | TypeScript keeps camelCase file names; Rust keeps snake_case | Matches the current code | n |
| Docs | `CONTRIBUTING.md` describes the layers and the rule; `GLOSSARY.md` names Session, Trainer, Instrument and the layers; `.specs/STATE.md` gets AD-028 for the layer rule | Future changes read the rule before they break it | n |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: The Rust engine in layers ⭐ MVP

**User Story**: As the developer of MetroRig, I want the engine split into layered modules so that a change to one instrument, the clock or the FFI touches only that module.

**Why P1**: It is the pain the user named, and the change is in-process with 136 tests already guarding it.

**Acceptance Criteria**:

1. The repository SHALL hold the Rust crate `metrorig_audio` in `engine/`, with `engine/Cargo.toml` and its sources under `engine/src/`, and no `.rs` file under `src/`  <!-- ARCH-01 -->
2. The crate SHALL contain the modules `ffi`, `engine`, `sequencer::clock`, `sequencer::pattern`, `sequencer::trainer`, `instruments::click`, `instruments::drums`, `instruments::pad` and `dsp`  <!-- ARCH-02 -->
3. The crate SHALL keep every `extern "C"` function and every `unsafe` block outside `#[cfg(test)]` code in `engine/src/ffi.rs` only  <!-- ARCH-03 -->
4. The crate SHALL depend downward only: `dsp` uses no other crate module, `sequencer` uses no other crate module, `instruments` uses only `dsp`, `engine` uses only `sequencer`, `instruments` and `dsp`, and `ffi` uses only `engine`  <!-- ARCH-04 -->
5. The crate SHALL hold at most 400 lines of production code, `#[cfg(test)]` blocks excluded, in each `.rs` file  <!-- ARCH-05 -->
6. WHEN `npm run build:wasm` runs THEN the build SHALL write `public/pkg/metrorig_audio_bg.wasm` exporting exactly the function names the file at commit `591f031` exports  <!-- ARCH-06 -->
7. WHEN `npm run test:rust` runs THEN it SHALL run every Rust test present at commit `591f031`, with unchanged assertions, and all SHALL pass  <!-- ARCH-07 -->

**Independent Test**: `npm run test:rust` passes, the layer test passes, and the export list of the rebuilt WASM equals the old one.

---

### P1: Same sound, proven ⭐ MVP

**User Story**: As a musician using MetroRig, I want the refactor to leave every sample the engine plays untouched so that my practice sounds and times exactly as before.

**Why P1**: A refactor that moves DSP code can shift a sample without any test noticing.

**Acceptance Criteria**:

1. The golden test SHALL be committed and pass on the code of commit `591f031` before any engine code moves  <!-- ARCH-08 -->
2. WHEN the golden test renders 4 seconds at 44100 Hz of each scenario - drums with takes and all three dynamics, the synth click, the sample click, the Trainer stepped by bars, the Trainer smooth by seconds, and the Pad changing chords and timbre - THEN the engine SHALL produce output whose 64-bit FNV-1a hash equals the hash recorded at commit `591f031`  <!-- ARCH-09 -->
3. IF any output sample of a golden scenario differs by one bit THEN the golden test SHALL fail naming the scenario  <!-- ARCH-10 -->

**Independent Test**: Flip one constant in the engine; the golden test fails naming its scenario.

---

### P1: The Speed Trainer as its own module ⭐ MVP

**User Story**: As the developer, I want the Speed Trainer's rules behind one small interface so that they are tested without rendering audio.

**Why P1**: Its state is spread over six `Engine` fields and eight methods today.

**Acceptance Criteria**:

1. The `Engine` SHALL hold the Speed Trainer's state in one `Trainer` field and no other trainer field  <!-- ARCH-11 -->
2. The `Trainer` SHALL change the tempo only by returning a new BPM to its caller  <!-- ARCH-12 -->
3. WHEN a `Trainer` test runs THEN it SHALL exercise the stepped curve, the smooth curve, steps by bars, steps by seconds, settings held until beat 1, and a schedule restart without creating an `Engine`  <!-- ARCH-13 -->

**Independent Test**: `cargo test --manifest-path engine/Cargo.toml trainer` passes with no `Engine` in those tests.

---

### P1: The TypeScript in layers ⭐ MVP

**User Story**: As the developer, I want `src/` in layers so that app rules run and are tested without the DOM, and each screen is one module.

**Why P1**: `main.ts` and `state.ts` mix rules, persistence and DOM today.

**Acceptance Criteria**:

1. The `src/` folder SHALL hold the folders `domain`, `data`, `storage`, `audio`, `app` and `ui`, and `main.ts` as its only file at its root  <!-- ARCH-14 -->
2. The code in `src/` SHALL import downward only: `domain` imports nothing from `src/`, `data`, `storage` and `audio` import only `domain`, `app` imports only `domain`, `data`, `storage` and `audio`, `ui` imports only `app` and `domain`, and only `main.ts` imports `ui`  <!-- ARCH-15 -->
3. The code in `src/` SHALL contain no import cycle  <!-- ARCH-16 -->
4. IF a file imports against ARCH-04, ARCH-15 or ARCH-16 THEN the layer test SHALL fail naming the file and the import  <!-- ARCH-17 -->
5. The `app` layer SHALL expose a `Session` that receives the engine and the storage as arguments and runs every command `main.ts` sends to them today  <!-- ARCH-18 -->
6. WHEN `tests/app/session.test.ts` runs THEN it SHALL drive the `Session` with a fake engine and an in-memory storage, with no DOM, through play and stop, loading a preset, saving a preset, loading a song, pressing a chord, changing the timbre, changing the pad volume, editing a step and setting the Trainer  <!-- ARCH-19 -->
7. The `ui` layer SHALL hold the Editor, Stadium, Grooves and Improv screens as one module each, and the header as its own module  <!-- ARCH-20 -->
8. The file `src/main.ts` SHALL hold at most 150 lines  <!-- ARCH-21 -->
9. WHEN `npm run test:js` runs THEN every test present at commit `591f031`, with `src/index.test.ts` moved to `tests/app.test.ts`, SHALL pass with unchanged assertions  <!-- ARCH-22 -->
10. WHEN `npm run build` runs THEN it SHALL finish with exit code 0  <!-- ARCH-23 -->

**Independent Test**: `npm run test:js` passes, including the layer test and the Session test.

---

### P2: The layers written down

**User Story**: As a future contributor, I want the layers and their rule documented so that I place new code in the right module.

**Why P2**: The test enforces the rule; the docs explain it.

**Acceptance Criteria**:

1. The `CONTRIBUTING.md` file SHALL describe both layer stacks, the dependency rule and the paths after this change  <!-- ARCH-24 -->
2. The `GLOSSARY.md` file SHALL define Session, Trainer, Instrument and each layer  <!-- ARCH-25 -->
3. The `.specs/STATE.md` file SHALL record the layer rule as AD-028  <!-- ARCH-26 -->

**Independent Test**: Read `CONTRIBUTING.md`; every path it names exists.

---

## Edge Cases

- IF a Python fixture reads a moved TypeScript file THEN the fixture SHALL read it from its new path and pass  <!-- ARCH-27 -->
- IF `scripts/copy_wasm.js` does not find the built WASM at its new target path THEN it SHALL exit with code 1 and print the path it looked for  <!-- ARCH-28 -->

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ARCH-01 | P1: Rust in layers | Design | Pending |
| ARCH-02 | P1: Rust in layers | Design | Pending |
| ARCH-03 | P1: Rust in layers | Design | Pending |
| ARCH-04 | P1: Rust in layers | Design | Pending |
| ARCH-05 | P1: Rust in layers | Design | Pending |
| ARCH-06 | P1: Rust in layers | Design | Pending |
| ARCH-07 | P1: Rust in layers | Design | Pending |
| ARCH-08 | P1: Same sound | Design | Pending |
| ARCH-09 | P1: Same sound | Design | Pending |
| ARCH-10 | P1: Same sound | Design | Pending |
| ARCH-11 | P1: Trainer | Design | Pending |
| ARCH-12 | P1: Trainer | Design | Pending |
| ARCH-13 | P1: Trainer | Design | Pending |
| ARCH-14 | P1: TS in layers | Design | Pending |
| ARCH-15 | P1: TS in layers | Design | Pending |
| ARCH-16 | P1: TS in layers | Design | Pending |
| ARCH-17 | P1: TS in layers | Design | Pending |
| ARCH-18 | P1: TS in layers | Design | Pending |
| ARCH-19 | P1: TS in layers | Design | Pending |
| ARCH-20 | P1: TS in layers | Design | Pending |
| ARCH-21 | P1: TS in layers | Design | Pending |
| ARCH-22 | P1: TS in layers | Design | Pending |
| ARCH-23 | P1: TS in layers | Design | Pending |
| ARCH-24 | P2: Docs | Design | Pending |
| ARCH-25 | P2: Docs | Design | Pending |
| ARCH-26 | P2: Docs | Design | Pending |
| ARCH-27 | Edge cases | Design | Pending |
| ARCH-28 | Edge cases | Design | Pending |

**Coverage:** 28 total, 0 mapped to tasks, 28 unmapped ⚠️ (mapped in Tasks)

---

## Sources

- Architecture review of 2026-11-03 (candidates 1, 2 and 3), chosen by the user: "Vamos mandar bala no 1, 2 e 3"
- `.specs/STATE.md` AD-017 - the Pad stays its own module, mixed after the drums, with fixed arrays

---

## Success Criteria

- [ ] No production `.rs` file holds more than 400 lines, and `main.ts` holds at most 150
- [ ] The golden test, all 136 Rust tests and the whole vitest suite pass at `HEAD`
- [ ] Breaking the layer rule in any file fails the layer test
