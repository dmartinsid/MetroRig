# chord-library proofs

**HEAD**: ccfdcc5
**Tree**: clean
**Shell**: /bin/sh
**Result**: 38 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run js / ✓ tests/chords.test.ts > Chord library > chd_01 offers 408 chords` | pass |
| C2 | `run js / ✓ tests/chords.test.ts > Chord library > chd_02 semitones of each type` | pass |
| C3 | `run js / ✓ tests/chords.test.ts > Chord library > chd_03 voices every root` | pass |
| C4 | `run js / ✓ tests/chords.test.ts > Chord library > chd_04 spells the new chords` | pass |
| C5 | `run js / ✓ tests/chords.test.ts > Chord library > chd_05 keeps the old types` | pass |
| C6 | `run rust / test pad::tests::chd_06_every_orchestra_note_has_its_file ... ok` | pass |
| C7 | `run rust / test pad::tests::tim_16_notes_within_5_cents ... ok` | pass |
| C8 | `python3 -I tests/fixtures/orchestra_bank_check.py --pitch` | pass |
| C9 | `run rust / test pad::tests::tim_18_chords_match_within_3_db ... ok` | pass |
| C10 | `run rust / test pad::tests::tim_19_timbres_match_within_3_db ... ok` | pass |
| C11 | `run rust / test pad::tests::tim_20_default_peak ... ok` | pass |
| C12 | `run js / ✓ tests/padBank.test.ts > Timbre banks > tim_36 size limit` | pass |
| C13 | `run js / ✓ tests/padBank.test.ts > Timbre banks > tim_40 license lists each file` | pass |
| C14 | `run rust / test pad::tests::tim_23_no_allocation ... ok` | pass |
| C15 | `run js / ✓ src/index.test.ts > Chord selector > chd_15 lists the roots` | pass |
| C16 | `run js / ✓ src/index.test.ts > Chord selector > chd_16 groups the types` | pass |
| C17 | `run js / ✓ src/index.test.ts > Chord selector > chd_17 labels the types` | pass |
| C18 | `run js / ✓ src/index.test.ts > Chord selector > chd_18 opens on C major` | pass |
| C19 | `run js / ✓ src/index.test.ts > Chord selector > chd_19 root plays the selected type` | pass |
| C20 | `run js / ✓ src/index.test.ts > Chord selector > chd_20 type plays on the selected root` | pass |
| C21 | `run js / ✓ src/index.test.ts > Chord selector > chd_21 another root keeps the type` | pass |
| C22 | `run js / ✓ src/index.test.ts > Chord selector > chd_22 another type keeps the root` | pass |
| C23 | `run js / ✓ src/index.test.ts > Chord selector > chd_23 the sounding root or type stops it` | pass |
| C24 | `run js / ✓ src/index.test.ts > Chord selector > chd_24 marks the sounding chord` | pass |
| C25 | `run js / ✓ src/index.test.ts > Chord selector > chd_25 marks the selection` | pass |
| C26 | `run js / ✓ src/index.test.ts > Chord selector > chd_26 keeps the selection after a stop` | pass |
| C27 | `run js / ✓ src/index.test.ts > Chord selector > chd_27 uses real buttons` | pass |
| C28 | `walk - In Chrome at 1280 px, scrollWidth equals clientWidth and every root and type is reached` | pass (Walked) |
| C29 | `walk - At 390 px, scrollWidth equals clientWidth, and the roots stay in view while the types scroll` | pass (Walked) |
| C30 | `walk - At 390 px, each root and type button measures at least 44 px tall` | pass (Walked) |
| C31 | `walk - The user plays the new chords in each timbre, and their answer is quoted in verification.md` | pass (Walked) |
| C32 | `walk - Each rejection is logged with its change in the Handoff, until the user approves` | pass (Walked) |
| C33 | `run js / ✓ src/index.test.ts > Chord selector > chd_33 settles on the last chord` | pass |
| C34 | `run js / ✓ src/index.test.ts > Chord selector > chd_34 a timbre pick replays a new chord` | pass |
| C35 | `run js / ✓ src/index.test.ts > Chord selector > chd_35 resumes audio within the click` | pass |
| C36 | `run js / ✓ src/index.test.ts > Chord selector > chd_36 click during a fade` | pass |
| C37 | `run rust / test pad::tests::tim_16_notes_within_5_cents ... ok` | pass |
| Build | `npm run build` | pass |

## Output

`Run js` - exit 0

```
stderr | tests/MetronomeNode.test.ts > MetronomeNode > tries again after the worklet reports a WASM error
MetronomeNode: WASM error reported from worklet: bad module

stderr | src/index.test.ts > Integration Test > should handle click sound variation selector changes, race conditions and fetch rejections
Failed to load click sample, falling back to digital synth: Error: Fetch failed
    at /home/deivid/Projects/Github/MetroRig/src/index.test.ts:200:26
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
    at runTest (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/runner/dist/index.js:781:11)
    at runSuite (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/runner/dist/index.js:909:15)
    at runSuite (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/runner/dist/index.js:909:15)
    at runFiles (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/runner/dist/index.js:958:5)
    at startTests (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/runner/dist/index.js:967:3)
    at file:///home/deivid/Projects/Github/MetroRig/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:116:7
    at withEnv (file:///home/deivid/Projects/Github/MetroRig/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:83:5)
    at run (file:///home/deivid/Projects/Github/MetroRig/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:105:3)
```

`Run rust` - exit 0

```
test pad::tests::tim_20_default_peak ... ok
test tests::time_02_one_hour_no_drift ... ok
test pad::tests::tim_30_synth_holds_while_loading ... ok

test result: ok. 134 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 191.59s


running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Compiling metrorig_audio v1.0.0 (/home/deivid/Projects/Github/MetroRig)
    Finished `test` profile [optimized + debuginfo] target(s) in 3.01s
     Running unittests src/lib.rs (target/debug/deps/metrorig_audio-e3c84ac815f4f448)
   Doc-tests metrorig_audio
```

`python3 -I tests/fixtures/orchestra_bank_check.py --pitch` - exit 0

```
meter: key 51 detuned by 30 cents reads +30.7, from +0.7
23 B0.flac: -0.1 cents
27 Ds1.flac: -0.1 cents
31 G1.flac: +0.1 cents
35 B1.flac: -0.4 cents
39 Ds2.flac: +0.5 cents
43 G2.flac: +2.6 cents
47 B2.flac: -0.6 cents
51 Ds3.flac: +0.7 cents
55 G3.flac: +1.5 cents
59 B3.flac: +0.2 cents
63 Ds4.flac: -0.8 cents
67 G4.flac: +0.5 cents
71 B4.flac: +0.1 cents
75 Ds5.flac: -0.0 cents
```
