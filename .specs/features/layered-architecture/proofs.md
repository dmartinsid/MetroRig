# layered-architecture proofs

**HEAD**: 54012f0
**Tree**: clean
**Shell**: /bin/sh
**Result**: 47 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run js / ✓ Layers > the engine crate lives in engine/ and src/ holds no .rs file` | pass |
| C2 | `run js / ✓ Layers > the engine crate has every layered module` | pass |
| C3 | `run js / ✓ Layers > extern C and unsafe live only in ffi.rs` | pass |
| C4 | `run js / ✓ Layers > engine modules depend downward only` | pass |
| C5 | `run js / ✓ Layers > no engine file holds over 400 lines of production code` | pass |
| C6 | `run js / ✓ Shipped WASM > exports the same names as at 591f031` | pass |
| C7 | `python3 -I tests/fixtures/tests_kept.py rust` | pass |
| C8 | `python3 -I tests/fixtures/golden_first.py` | pass |
| C9 | `run rust / test golden_tests::drums_with_takes_and_dynamics ... ok` | pass |
| C10 | `run rust / test golden_tests::synth_click ... ok` | pass |
| C11 | `run rust / test golden_tests::sample_click ... ok` | pass |
| C12 | `run rust / test golden_tests::trainer_stepped_by_bars ... ok` | pass |
| C13 | `run rust / test golden_tests::trainer_smooth_by_seconds ... ok` | pass |
| C14 | `run rust / test golden_tests::pad_changes_chord_and_timbre ... ok` | pass |
| C15 | `run rust / test golden_tests::a_one_bit_change_fails_naming_its_scenario ... ok` | pass |
| C16 | `run js / ✓ Layers > the Engine holds the Trainer in one field` | pass |
| C17 | `run js / ✓ Layers > the Trainer holds no tempo and no Engine` | pass |
| C18 | `run rust / test sequencer::trainer::tests::stepped_curve_steps_at_the_bar_count ... ok` | pass |
| C19 | `run rust / test sequencer::trainer::tests::smooth_curve_ramps_each_frame ... ok` | pass |
| C20 | `run rust / test sequencer::trainer::tests::steps_by_bars ... ok` | pass |
| C21 | `run rust / test sequencer::trainer::tests::steps_by_seconds_wait_for_beat_one ... ok` | pass |
| C22 | `run rust / test sequencer::trainer::tests::settings_wait_for_beat_one ... ok` | pass |
| C23 | `run rust / test sequencer::trainer::tests::a_changed_schedule_restarts ... ok` | pass |
| C24 | `run js / ✓ Layers > src holds the six layers and main.ts alone at its root` | pass |
| C25 | `run js / ✓ Layers > src imports downward only` | pass |
| C26 | `run js / ✓ Layers > src has no import cycle` | pass |
| C27 | `run js / ✓ Layers > a crossing import fails naming the file and the import` | pass |
| C28 | `run js / ✓ Session > sends every engine and storage call through the adapters it receives` | pass |
| C29 | `run js / ✓ Session > plays and stops` | pass |
| C30 | `run js / ✓ Session > loads a preset` | pass |
| C31 | `run js / ✓ Session > saves a preset` | pass |
| C32 | `run js / ✓ Session > loads a song` | pass |
| C33 | `run js / ✓ Session > presses a chord` | pass |
| C34 | `run js / ✓ Session > changes the timbre` | pass |
| C35 | `run js / ✓ Session > changes the pad volume` | pass |
| C36 | `run js / ✓ Session > edits a step` | pass |
| C37 | `run js / ✓ Session > sets the Trainer` | pass |
| C38 | `run js / ✓ Layers > ui holds one module per screen and the header` | pass |
| C39 | `run js / ✓ Layers > main.ts holds at most 150 lines` | pass |
| C40 | `python3 -I tests/fixtures/tests_kept.py js` | pass |
| C41 | `npm run build` | pass |
| C42 | `run js / ✓ Docs > CONTRIBUTING names the layers and only paths that exist` | pass |
| C43 | `run js / ✓ Docs > GLOSSARY defines Session, Trainer, Instrument and each layer` | pass |
| C44 | `run js / ✓ Docs > STATE records the layer rule as AD-028` | pass |
| C45 | `python3 -I tests/fixtures/pad_bank_check.py` | pass |
| C46 | `run js / ✓ copy_wasm > exits 1 naming the path when the build is missing` | pass |
| Build | `npm run build` | pass |

## Output

`Run js` - exit 0

```
    at run (file:///home/deivid/Projects/Github/MetroRig/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:105:3)

stderr | tests/app.test.ts > Improv > tim_30 brackets each load, so its files reach the notes once all have come or failed
Failed to load /pads/choir/Fs3.flac: Error: 404
    at MockMetronomeNode.<anonymous> (/home/deivid/Projects/Github/MetroRig/tests/app.test.ts:3238:52)
    at MockMetronomeNode.mockCall (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/spy/dist/index.js:50:17)
    at MockMetronomeNode.spy [as padLoad] (file:///home/deivid/Projects/Github/MetroRig/node_modules/tinyspy/dist/index.js:42:80)
    at /home/deivid/Projects/Github/MetroRig/src/app/improv.ts:83:29
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
Failed to load /pads/choir/Fs3.flac: Error: 404
    at MockMetronomeNode.<anonymous> (/home/deivid/Projects/Github/MetroRig/tests/app.test.ts:3238:52)
    at MockMetronomeNode.mockCall (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/spy/dist/index.js:50:17)
    at MockMetronomeNode.spy [as padLoad] (file:///home/deivid/Projects/Github/MetroRig/node_modules/tinyspy/dist/index.js:42:80)
    at /home/deivid/Projects/Github/MetroRig/src/app/improv.ts:83:29
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
```

`Run rust` - exit 0

```
test instruments::pad::tests::tim_30_synth_holds_while_loading has been running for over 60 seconds
test instruments::pad::tests::tim_16_notes_within_5_cents ... ok
test instruments::pad::tests::tim_20_default_peak ... ok
test instruments::pad::tests::tim_30_synth_holds_while_loading ... ok

test result: ok. 149 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 195.15s


running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

    Finished `test` profile [optimized + debuginfo] target(s) in 0.00s
     Running unittests src/lib.rs (engine/target/debug/deps/metrorig_audio-e3c84ac815f4f448)
   Doc-tests metrorig_audio
```

`python3 -I tests/fixtures/tests_kept.py rust` - exit 0

```
rust: 136 of 136 recorded tests pass
```

`python3 -I tests/fixtures/golden_first.py` - exit 0

```
golden commit 181d14f; 10 of 10 engine commits follow it
```

`python3 -I tests/fixtures/tests_kept.py js` - exit 0

```
js: 433 of 433 recorded tests pass
```

`npm run build` - exit 0

```

Copying WASM from: /home/deivid/Projects/Github/MetroRig/engine/target/wasm32-unknown-unknown/release/metrorig_audio.wasm
To destination: /home/deivid/Projects/Github/MetroRig/public/pkg/metrorig_audio_bg.wasm
WASM file successfully copied to public/pkg/metrorig_audio_bg.wasm
vite v5.4.21 building for production...
transforming...
✓ 29 modules transformed.
rendering chunks...
computing gzip size...
dist/assets/metronome-processor-mzbFy-xz.ts  10.61 kB
dist/index.html                              15.22 kB │ gzip:  3.72 kB
dist/assets/index-Con4F8W0.css               27.48 kB │ gzip:  5.56 kB
dist/assets/index-B8PwSyVZ.js                60.94 kB │ gzip: 17.87 kB
✓ built in 345ms
    Finished `release` profile [optimized] target(s) in 0.00s
```

`python3 -I tests/fixtures/pad_bank_check.py` - exit 0

```
Orchestra 55 /pads/orchestra/G3.flac: wrap step 0
Orchestra 59 /pads/orchestra/B3.flac: wrap step 1
Orchestra 63 /pads/orchestra/Ds4.flac: wrap step 2
Orchestra 67 /pads/orchestra/G4.flac: wrap step 2
Orchestra 71 /pads/orchestra/B4.flac: wrap step 2
Orchestra 75 /pads/orchestra/Ds5.flac: wrap step 3
Sweep 44 /pads/sweep/Gs2.flac: wrap step 91
Sweep 48 /pads/sweep/C3.flac: wrap step 711
Sweep 52 /pads/sweep/E3.flac: wrap step 194
Sweep 56 /pads/sweep/Gs3.flac: wrap step 1092
Sweep 60 /pads/sweep/C4.flac: wrap step 130
Sweep 64 /pads/sweep/E4.flac: wrap step 108
Sweep 68 /pads/sweep/Gs4.flac: wrap step 538
Sweep 72 /pads/sweep/C5.flac: wrap step 702
Sweep 76 /pads/sweep/E5.flac: wrap step 1552
```
