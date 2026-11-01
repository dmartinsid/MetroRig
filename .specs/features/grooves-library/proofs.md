# grooves-library proofs

**HEAD**: aae0fa3
**Tree**: dirty - .agents/skills/code-review/, .claude/skills/code-review
**Shell**: /bin/sh
**Result**: 61 pass, 3 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `browser captures/editor.running.png` | **not judged** (screens.md) |
| C2 | `run js / ✓ src/index.test.ts > Grooves Library > nav_02 editor link` | pass |
| C3 | `browser captures/stadium.running.png` | **not judged** (screens.md) |
| C4 | `run js / ✓ src/index.test.ts > Grooves Library > nav_04 grooves link` | pass |
| C5 | `run js / ✓ src/index.test.ts > Grooves Library > nav_05 aria current` | pass |
| C6 | `run js / ✓ src/index.test.ts > Grooves Library > nav_06 no toggle no presets` | pass |
| C7 | `run js / ✓ tests/state.test.ts > StateManager > nav_07 grooves mode persists` | pass |
| C8 | `run js / ✓ src/index.test.ts > Grooves Library > nav_08 playback survives screen change` | pass |
| C9 | `walk - at each width all three links show and the page does not scroll sideways` | pass (Walked) |
| C10 | `run js / ✓ tests/kit.test.ts > Kit > kit_01 eleven tracks in order` | pass |
| C11 | `run rust / test tests::kit_02_every_drum_track_plays_its_sample ... ok` | pass |
| C12 | `run js / ✓ tests/kit.test.ts > Kit > kit_03 samples exist with a license` | pass |
| C13 | `run rust / test tests::kit_04_hi_hat_chokes_open_hat ... ok` | pass |
| C14 | `run rust / test tests::kit_05_output_stays_in_range ... ok` | pass |
| C15 | `run js / ✓ src/index.test.ts > Grooves Library > kit_06 failed sample stays local` | pass |
| C16 | `run rust / test tests::kit_07_click_needs_no_drum_samples ... ok` | pass |
| C17 | `run rust / test tests::dyn_01_step_values_set_the_gain ... ok` | pass |
| C18 | `run js / ✓ src/index.test.ts > Grooves Library > dyn_02 drum cell cycle` | pass |
| C19 | `run js / ✓ src/index.test.ts > Grooves Library > dyn_03 click cell cycle` | pass |
| C20 | `run js / ✓ src/index.test.ts > Grooves Library > dyn_04 cell symbols` | pass |
| C21 | `run js / ✓ src/index.test.ts > Grooves Library > dyn_05 figure writes normal` | pass |
| C22 | `run js / ✓ src/index.test.ts > Grooves Library > dyn_06 dynamics survive save and load` | pass |
| C23 | `run js / ✓ src/index.test.ts > Grooves Library > grv_01 tabs` | pass |
| C24 | `run js / ✓ src/index.test.ts > Grooves Library > grv_02 all shows fourteen` | pass |
| C25 | `run js / ✓ src/index.test.ts > Grooves Library > grv_03 genre counts` | pass |
| C26 | `run js / ✓ src/index.test.ts > Grooves Library > grv_04 card fields` | pass |
| C27 | `run js / ✓ src/index.test.ts > Grooves Library > grv_05 play stays on screen` | pass |
| C28 | `run js / ✓ src/index.test.ts > Grooves Library > grv_06 playing mark` | pass |
| C29 | `run js / ✓ src/index.test.ts > Grooves Library > grv_07 stop keeps song` | pass |
| C30 | `run js / ✓ src/index.test.ts > Grooves Library > grv_08 switch during playback` | pass |
| C31 | `run js / ✓ src/index.test.ts > Grooves Library > grv_09 open in editor` | pass |
| C32 | `run js / ✓ src/index.test.ts > Grooves Library > grv_10 loaded song keeps edits` | pass |
| C33 | `run js / ✓ src/index.test.ts > Grooves Library > grv_11 asks before replacing edits` | pass |
| C34 | `run js / ✓ src/index.test.ts > Grooves Library > grv_12 decline changes nothing` | pass |
| C35 | `walk - at 390px the cards stack in one column and the page does not scroll sideways` | pass (Walked) |
| C36 | `run js / ✓ tests/songs.test.ts > Songs > song_01 fourteen songs with sources` | pass |
| C37 | `run js / ✓ tests/songs.test.ts > Songs > song_02 named versions` | pass |
| C38 | `run js / ✓ tests/songs.test.ts > Songs > song_03 bounds` | pass |
| C39 | `run js / ✓ tests/songs.test.ts > Songs > song_04 click marks the beats` | pass |
| C40 | `run js / ✓ src/index.test.ts > Grooves Library > song_05 load replaces everything` | pass |
| C41 | `run js / ✓ src/index.test.ts > Grooves Library > song_06 card matches tempo bus` | pass |
| C42 | `run js / ✓ src/index.test.ts > Grooves Library > song_07 songs group` | pass |
| C43 | `run js / ✓ src/index.test.ts > Grooves Library > song_08 save leaves catalog` | pass |
| C44 | `browser captures/editor.running.png` | **not judged** (screens.md) |
| C45 | `run js / ✓ src/index.test.ts > Grooves Library > edt_02 eleven mix cards` | pass |
| C46 | `run js / ✓ src/index.test.ts > Grooves Library > edt_03 new track obeys mix` | pass |
| C47 | `run js / ✓ src/index.test.ts > Grooves Library > edt_04 groove clears other tracks` | pass |
| C48 | `run js / ✓ src/index.test.ts > Grooves Library > edt_05 save groove keeps the kit` | pass |
| C49 | `run js / ✓ tests/state.test.ts > completeKit > edt_06 fills missing tracks` | pass |
| C50 | `walk - at 1024px and 390px all 11 tracks show and only the grid scrolls` | pass (Walked) |
| C51 | `run js / ✓ src/index.test.ts > Grooves Library > std_01 four group labels` | pass |
| C52 | `run js / ✓ tests/kit.test.ts > Kit > std_02 snare and toms group` | pass |
| C53 | `run js / ✓ tests/kit.test.ts > Kit > std_03 cymbals group` | pass |
| C54 | `run js / ✓ tests/kit.test.ts > Kit > std_04 group hit` | pass |
| C55 | `run js / ✓ src/index.test.ts > Grooves Library > std_05 orb pulses for its group` | pass |
| C56 | `run js / ✓ src/index.test.ts > Grooves Library > std_06 silenced group stays still` | pass |
| C57 | `grep -q '11 tracks' README.md && grep -q 'Grooves' README.md` | pass |
| C58 | `grep -q 'SNARE/TOMS' .stitch/DESIGN.md && grep -q 'Grooves' .stitch/DESIGN.md` | pass |
| C59 | `grep -qi 'license' public/kit/LICENSE.md` | pass |
| C60 | `walk - at 1024px and 390px both selectors can be used` | pass (Walked) |
| C61 | `run js / ✓ src/index.test.ts > Grooves Library > edge_02 load keeps the mix` | pass |
| C62 | `run js / ✓ tests/state.test.ts > completeKit > edge_03 cleans step values` | pass |
| C63 | `walk - the user played all 14 songs and approved each one, recorded in Handoff` | pass (Walked) |
| Build | `npm run build` | pass |

## Output

`Run js` - exit 0

```
   Start at  01:48:24
   Duration  6.18s (transform 504ms, setup 1ms, collect 791ms, tests 5.96s, environment 2.68s, prepare 804ms)

stderr | src/index.test.ts > Integration Test > should handle click sound variation selector changes, race conditions and fetch rejections
Failed to load click sample, falling back to digital synth: Error: Fetch failed
    at /home/deivid/Projects/Github/MetroRig/src/index.test.ts:188:26
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
test tests::time_03_every_step_same_duration ... ok
test tests::bpm_01_quarter_note_in_every_meter ... ok
test tests::time_01_hits_within_one_sample ... ok
test tests::time_02_one_hour_no_drift ... ok

test result: ok. 52 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 5.80s


running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

    Finished `test` profile [optimized + debuginfo] target(s) in 0.00s
     Running unittests src/lib.rs (target/debug/deps/metrorig_audio-e3c84ac815f4f448)
   Doc-tests metrorig_audio
```

`grep -q '11 tracks' README.md && grep -q 'Grooves' README.md` - exit 0

```
(no output)
```

`grep -q 'SNARE/TOMS' .stitch/DESIGN.md && grep -q 'Grooves' .stitch/DESIGN.md` - exit 0

```
(no output)
```

`grep -qi 'license' public/kit/LICENSE.md` - exit 0

```
(no output)
```
