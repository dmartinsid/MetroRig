# tuplets proofs

**HEAD**: f7f0156
**Tree**: clean
**Shell**: /bin/sh
**Result**: 41 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run js / ✓ Pattern > tup_01 triplet lays 3 cells and 3 hits` | pass |
| C2 | `run js / ✓ Pattern > tup_02 triplet rest lays 3 empty cells` | pass |
| C3 | `run js / ✓ Pattern > tup_03 sextuplet lays 6 cells and 6 hits` | pass |
| C4 | `run js / ✓ Pattern > tup_04 sextuplet rest lays 6 empty cells` | pass |
| C5 | `run js / ✓ Pattern > tup_05 straight figure returns a tuplet beat to 4 cells` | pass |
| C6 | `run js / ✓ Layout > tup_06 hits move to the nearest cell, earlier on a tie` | pass |
| C7 | `run js / ✓ Layout > tup_07 triplet cell k becomes sextuplet cell 2k` | pass |
| C8 | `run js / ✓ Layout > tup_08 a clash keeps the stronger hit` | pass |
| C9 | `run js / ✓ Session > tup_09 a tuplet cell cycles like a straight one` | pass |
| C10 | `run js / ✓ Editor > tup_10 tuplet figures are disabled outside /4` | pass |
| C11 | `run js / ✓ Session > tup_11 a tuplet in bar 2 leaves the other bars` | pass |
| C12 | `run rust / tup_12_triplet_cells_start_at_thirds ... ok` | pass |
| C13 | `run rust / tup_13_sextuplet_cells_start_at_sixths ... ok` | pass |
| C14 | `run rust / golden_tests::drums_with_takes_and_dynamics ... ok` | pass |
| C15 | `run js / ✓ Layout > tup_15 the click stays on the beat start` | pass |
| C16 | `run rust / tup_16_trainer_counts_a_tuplet_bar_once ... ok` | pass |
| C17 | `run rust / tup_17_bar_holds_48_cells_and_pattern_192 ... ok` | pass |
| C18 | `run js / ✓ Format > tup_18 steps count cells over 192` | pass |
| C19 | `run js / ✓ Session > tup_19 the 32-step signature rule stands with tuplets` | pass |
| C20 | `run js / ✓ Editor > tup_20 tuplet cells share a straight beat's width` | pass |
| C21 | `run js / ✓ Editor > tup_21 tuplet beats carry 3 or 6` | pass |
| C22 | `run js / ✓ Meter > tup_22 sustain follows the rule inside a tuplet beat` | pass |
| C23 | `run js / ✓ Stadium > tup_23 tuplet slices sit at their time` | pass |
| C24 | `run js / ✓ Stadium > tup_24 the lit beat follows a tuplet cell` | pass |
| C25 | `run js / ✓ Session > tup_25 surviving beats keep their kind` | pass |
| C26 | `run js / ✓ Session > tup_26 a /8 signature straightens every beat` | pass |
| C27 | `run js / ✓ Session > tup_27 a saved tuplet preset reloads the same` | pass |
| C28 | `run js / ✓ Preset > tup_28 an old preset loads straight and unchanged` | pass |
| C29 | `run js / ✓ Session > tup_29 a saved groove keeps its beat cells` | pass |
| C30 | `run js / ✓ Session > tup_30 a groove repeats beat by beat` | pass |
| C31 | `run js / ✓ Session > tup_31 a tuplet groove lands straight in /8` | pass |
| C32 | `run js / ✓ Songs > tup_32 Times Like These plays the 7/4 intro riff` | pass |
| C33 | `run js / ✓ Songs > tup_33 Everlong plays the chorus` | pass |
| C34 | `run js / ✓ Songs > tup_34 Ultimate Guitar sources name the file and measure` | pass |
| C35 | `run js / ✓ gp_extract > tup_35 reads drum measures from .gp and .gpx` | pass |
| C36 | `run js / ✓ tab_to_grid > tup_36 a note between cells names its measure` | pass |
| C37 | `run js / ✓ Songs > tup_37 no Guitar Pro file is tracked` | pass |
| C38 | `walk - the user plays Times Like These and Everlong from Grooves and approves them` | pass (Walked) |
| C39 | `run js / ✓ Session > tup_39 a tuplet figure outside /4 changes nothing` | pass |
| C40 | `run rust / tup_40_new_units_play_from_the_next_pass ... ok` | pass |
| Build | `npm run build` | pass |

## Output

`Run js` - exit 0

```
    at run (file:///home/deivid/Projects/Github/MetroRig/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:105:3)

stderr | tests/app.test.ts > Improv > tim_30 brackets each load, so its files reach the notes once all have come or failed
Failed to load /pads/choir/Fs3.flac: Error: 404
    at MockMetronomeNode.<anonymous> (/home/deivid/Projects/Github/MetroRig/tests/app.test.ts:3299:52)
    at MockMetronomeNode.mockCall (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/spy/dist/index.js:50:17)
    at MockMetronomeNode.spy [as padLoad] (file:///home/deivid/Projects/Github/MetroRig/node_modules/tinyspy/dist/index.js:42:80)
    at /home/deivid/Projects/Github/MetroRig/src/app/improv.ts:85:29
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
Failed to load /pads/choir/Fs3.flac: Error: 404
    at MockMetronomeNode.<anonymous> (/home/deivid/Projects/Github/MetroRig/tests/app.test.ts:3299:52)
    at MockMetronomeNode.mockCall (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/spy/dist/index.js:50:17)
    at MockMetronomeNode.spy [as padLoad] (file:///home/deivid/Projects/Github/MetroRig/node_modules/tinyspy/dist/index.js:42:80)
    at /home/deivid/Projects/Github/MetroRig/src/app/improv.ts:85:29
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
```

`Run rust` - exit 0

```
test instruments::pad::tests::tim_30_synth_holds_while_loading has been running for over 60 seconds
test instruments::pad::tests::tim_20_default_peak ... ok
test instruments::pad::tests::tim_16_notes_within_5_cents ... ok
test instruments::pad::tests::tim_30_synth_holds_while_loading ... ok

test result: ok. 162 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 218.77s


running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

    Finished `test` profile [optimized + debuginfo] target(s) in 0.00s
     Running unittests src/lib.rs (engine/target/debug/deps/metrorig_audio-e3c84ac815f4f448)
   Doc-tests metrorig_audio
```
