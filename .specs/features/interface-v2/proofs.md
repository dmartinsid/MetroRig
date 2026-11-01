# interface-v2 proofs

**HEAD**: e416efe
**Tree**: dirty - .agents/skills/code-review/, .claude/skills/code-review
**Shell**: /bin/sh
**Result**: 84 pass, 2 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run js / ✓ src/index.test.ts > Interface V2 > shell_01 header controls` | pass |
| C2 | `run js / ✓ src/index.test.ts > Interface V2 > shell_02 no dead controls` | pass |
| C3 | `run js / ✓ src/index.test.ts > Interface V2 > shell_03 preset groups` | pass |
| C4 | `run js / ✓ src/index.test.ts > Interface V2 > shell_04 editor toggle text` | pass |
| C5 | `run js / ✓ src/index.test.ts > Interface V2 > shell_05 stadium toggle text` | pass |
| C6 | `run js / ✓ src/index.test.ts > Interface V2 > shell_06 footer clock` | pass |
| C7 | `run js / ✓ src/index.test.ts > Interface V2 > shell_07 footer latency` | pass |
| C8 | `run js / ✓ src/index.test.ts > Interface V2 > shell_08 latency placeholder` | pass |
| C9 | `run js / ✓ src/index.test.ts > Interface V2 > shell_09 no invented telemetry` | pass |
| C10 | `browser captures/editor.running.png` | **not judged** (screens.md) |
| C11 | `run js / ✓ src/index.test.ts > Interface V2 > edit_02 opening header` | pass |
| C12 | `run js / ✓ src/index.test.ts > Interface V2 > edit_03 dot lit playing` | pass |
| C13 | `run js / ✓ src/index.test.ts > Interface V2 > edit_04 dot unlit stopped` | pass |
| C14 | `run js / ✓ src/index.test.ts > Interface V2 > edit_05 beat sub label` | pass |
| C15 | `run js / ✓ src/index.test.ts > Interface V2 > edit_06 hit mark` | pass |
| C16 | `run js / ✓ src/index.test.ts > Interface V2 > edit_07 accent mark` | pass |
| C17 | `run js / ✓ src/index.test.ts > Interface V2 > edit_08 beat spacer` | pass |
| C18 | `run js / ✓ src/index.test.ts > Interface V2 > edit_09 sustain kept` | pass |
| C19 | `run js / ✓ src/index.test.ts > Interface V2 > edit_10 pattern name` | pass |
| C20 | `run js / ✓ src/index.test.ts > Interface V2 > edit_11 steps label` | pass |
| C21 | `run js / ✓ src/index.test.ts > Interface V2 > edit_12 resolution label` | pass |
| C22 | `run js / ✓ src/index.test.ts > Interface V2 > edit_13 stopped position` | pass |
| C23 | `run js / ✓ src/index.test.ts > Interface V2 > edit_14 tick position` | pass |
| C24 | `run js / ✓ src/index.test.ts > Interface V2 > edit_15 bar count` | pass |
| C25 | `run js / ✓ src/index.test.ts > Interface V2 > edit_16 tempo bus title` | pass |
| C26 | `run js / ✓ src/index.test.ts > Interface V2 > edit_17 slider scale` | pass |
| C27 | `run js / ✓ src/index.test.ts > Interface V2 > edit_18 slider label follows` | pass |
| C28 | `run js / ✓ src/index.test.ts > Interface V2 > edit_19 no measure code` | pass |
| C29 | `run js / ✓ src/index.test.ts > Interface V2 > edit_20 numerator stepper` | pass |
| C30 | `run js / ✓ src/index.test.ts > Interface V2 > edit_21 denominator stepper` | pass |
| C31 | `run js / ✓ src/index.test.ts > Interface V2 > edit_22 groove label` | pass |
| C32 | `run js / ✓ tests/state.test.ts > Factory grooves > edit_23 five named grooves` | pass |
| C33 | `run js / ✓ src/index.test.ts > Interface V2 > edit_24 metalcore applied` | pass |
| C34 | `run js / ✓ src/index.test.ts > Interface V2 > edit_25 trainer starts open` | pass |
| C35 | `run js / ✓ src/index.test.ts > Interface V2 > edit_26 trainer switch` | pass |
| C36 | `run js / ✓ src/index.test.ts > Interface V2 > edit_27 steady dot` | pass |
| C37 | `run js / ✓ src/index.test.ts > Interface V2 > edit_28 toast after edit` | pass |
| C38 | `run js / ✓ src/index.test.ts > Interface V2 > edit_29 toast hidden` | pass |
| C39 | `browser captures/stadium.running.png` | **not judged** (screens.md) |
| C40 | `run js / ✓ src/index.test.ts > Interface V2 > stad_02 ring order` | pass |
| C41 | `run js / ✓ src/index.test.ts > Interface V2 > stad_03 legend` | pass |
| C42 | `run js / ✓ src/index.test.ts > Interface V2 > stad_04 selector label` | pass |
| C43 | `run js / ✓ src/index.test.ts > Interface V2 > stad_05 timer label` | pass |
| C44 | `run js / ✓ src/index.test.ts > Interface V2 > stad_06 tempo format` | pass |
| C45 | `run js / ✓ src/index.test.ts > Interface V2 > stad_07 trainer status` | pass |
| C46 | `run js / ✓ src/index.test.ts > Interface V2 > stad_08 trainer off` | pass |
| C47 | `run js / ✓ src/index.test.ts > Interface V2 > stad_09 orb markup` | pass |
| C48 | `run js / ✓ src/index.test.ts > Interface V2 > stad_10 orb pulse` | pass |
| C49 | `run js / ✓ src/index.test.ts > Interface V2 > stad_11 orb inert` | pass |
| C50 | `run js / ✓ src/index.test.ts > Interface V2 > stad_12 clock behaviours` | pass |
| C51 | `run js / ✓ tests/display.test.ts > Display rules > time_01 timer format` | pass |
| C52 | `run js / ✓ src/index.test.ts > Interface V2 > time_02 timer in both modes` | pass |
| C53 | `run js / ✓ src/index.test.ts > Interface V2 > time_03 play restarts` | pass |
| C54 | `run js / ✓ src/index.test.ts > Interface V2 > time_04 stop keeps value` | pass |
| C55 | `run js / ✓ tests/display.test.ts > Display rules > time_05 hours past 99` | pass |
| C56 | `run js / ✓ src/index.test.ts > Interface V2 > time_06 same time` | pass |
| C57 | `run js / ✓ src/index.test.ts > Interface V2 > mute_01 controls` | pass |
| C58 | `run js / ✓ src/index.test.ts > Interface V2 > mute_02 mute silences` | pass |
| C59 | `run js / ✓ src/index.test.ts > Interface V2 > mute_03 unmute restores` | pass |
| C60 | `run js / ✓ tests/trackMix.test.ts > Track mix > mute_04 solo isolates` | pass |
| C61 | `run js / ✓ tests/trackMix.test.ts > Track mix > mute_05 solos add` | pass |
| C62 | `run js / ✓ tests/trackMix.test.ts > Track mix > mute_06 solo beats mute` | pass |
| C63 | `run js / ✓ src/index.test.ts > Interface V2 > mute_07 row dimmed` | pass |
| C64 | `run js / ✓ src/index.test.ts > Interface V2 > mute_08 orb still` | pass |
| C65 | `run js / ✓ src/index.test.ts > Interface V2 > mute_09 edit kept silent` | pass |
| C66 | `run js / ✓ src/index.test.ts > Interface V2 > mute_10 saves real grid` | pass |
| C67 | `run js / ✓ src/index.test.ts > Interface V2 > mute_11 survives load` | pass |
| C68 | `run js / ✓ src/index.test.ts > Interface V2 > mute_12 play sends empty` | pass |
| C69 | `run js / ✓ src/index.test.ts > Interface V2 > mute_13 reload clears` | pass |
| C70 | `walk - at 1440 and 1024px the controls sit beside the sequencer` | pass (Walked) |
| C71 | `walk - at 1023px the controls sit under the sequencer` | pass (Walked) |
| C72 | `walk - at 390px documentElement scrollWidth equals clientWidth in both modes` | pass (Walked) |
| C73 | `walk - at 390px the grid wrapper scrolls and the page stays still` | pass (Walked) |
| C74 | `walk - at 1023px the clock sits above the readout` | pass (Walked) |
| C75 | `walk - at 390px each header control is on screen and clickable` | pass (Walked) |
| C76 | `walk - at 1440px in 8/4 the grid scrollWidth equals clientWidth` | pass (Walked) |
| C77 | `grep -q 'AUDIO CLOCK' .stitch/DESIGN.md && grep -q 'Track Mix' .stitch/DESIGN.md` | pass |
| C78 | `! grep -q 'groove-settings-card' .stitch/DESIGN.md` | pass |
| C79 | `run js / ✓ src/index.test.ts > Interface V2 > edge_01 stepper limit` | pass |
| C80 | `run js / ✓ src/index.test.ts > Interface V2 > edge_02 steps follow` | pass |
| C81 | `run js / ✓ src/index.test.ts > Interface V2 > edge_03 stop resets position` | pass |
| C82 | `run js / ✓ src/index.test.ts > Interface V2 > edge_04 stadium placeholder` | pass |
| C83 | `run js / ✓ src/index.test.ts > Interface V2 > edge_05 all muted continues` | pass |
| C84 | `run js / ✓ src/index.test.ts > Interface V2 > edge_06 groove stays silent` | pass |
| C85 | `git diff --quiet 5481ab6 -- src/lib.rs public/pkg` | pass |
| Build | `npx vite build` | pass |

## Output

`Run js` - exit 0

```
   Start at  23:50:24
   Duration  2.72s (transform 340ms, setup 0ms, collect 597ms, tests 2.46s, environment 1.86s, prepare 595ms)

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

`grep -q 'AUDIO CLOCK' .stitch/DESIGN.md && grep -q 'Track Mix' .stitch/DESIGN.md` - exit 0

```
(no output)
```

`! grep -q 'groove-settings-card' .stitch/DESIGN.md` - exit 0

```
(no output)
```

`git diff --quiet 5481ab6 -- src/lib.rs public/pkg` - exit 0

```
(no output)
```
