# stadium-tempo proofs

**HEAD**: d8e13bb
**Tree**: clean
**Shell**: /bin/sh
**Result**: 16 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run unit / ✓ tests/app.test.ts > Stadium tempo > TMP-01 the + button raises the Stadium tempo 1 BPM` | pass |
| C2 | `run unit / ✓ tests/app.test.ts > Stadium tempo > TMP-02 the − button lowers the Stadium tempo 1 BPM` | pass |
| C3 | `run unit / ✓ tests/app.test.ts > Stadium tempo > TMP-03 the raising keys on the Stadium raise the tempo 1 BPM ` | pass |
| C4 | `run unit / ✓ tests/app.test.ts > Stadium tempo > TMP-04 the lowering keys on the Stadium lower the tempo 1 BPM` | pass |
| C5 | `run unit / ✓ tests/app.test.ts > Stadium tempo > TMP-05 a key with Ctrl or Cmd leaves the tempo and the browse` | pass |
| C6 | `run unit / ✓ tests/app/session.test.ts > Stadium tempo > TMP-06 the keys leave the tempo on the other screens` | pass |
| C7 | `run unit / ✓ tests/app.test.ts > Stadium tempo > TMP-07 a key typed in a text field leaves the tempo` | pass |
| C8 | `run unit / ✓ tests/app.test.ts > Stadium tempo > TMP-08 at 240 BPM the + button is disabled and + leaves the t` | pass |
| C9 | `run unit / ✓ tests/app.test.ts > Stadium tempo > TMP-09 at 40 BPM the − button is disabled and - leaves the te` | pass |
| C10 | `run unit / ✓ tests/app.test.ts > Stadium tempo > TMP-10 an enabled Trainer disables both buttons and the keys` | pass |
| C11 | `run unit / ✓ tests/app/session.test.ts > Stadium tempo > TMP-11 a step during playback reaches the engine at o` | pass |
| C12 | `run unit / ✓ tests/app/session.test.ts > Stadium tempo > TMP-12 a step marks the preset edited` | pass |
| C13 | `run unit / ✓ tests/app.test.ts > Stadium tempo > TMP-13 a Stadium step moves the header number and slider` | pass |
| C14 | `run unit / ✓ tests/app/session.test.ts > Stadium tempo > TMP-14 a step from a fractional tempo rounds in its d` | pass |
| C15 | `run unit / ✓ tests/app/session.test.ts > Stadium tempo > TMP-15 a step after the Trainer is turned off during ` | pass |
| Build | `npm run build` | pass |

## Output

`Run unit` - exit 0

```
    at run (file:///home/deivid/Projects/Github/MetroRig/node_modules/vitest/dist/chunks/runtime-runBaseTests.oAvMKtQC.js:105:3)

stderr | tests/app.test.ts > Improv > tim_30 brackets each load, so its files reach the notes once all have come or failed
Failed to load /pads/choir/Fs3.flac: Error: 404
    at MockMetronomeNode.<anonymous> (/home/deivid/Projects/Github/MetroRig/tests/app.test.ts:3298:52)
    at MockMetronomeNode.mockCall (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/spy/dist/index.js:50:17)
    at MockMetronomeNode.spy [as padLoad] (file:///home/deivid/Projects/Github/MetroRig/node_modules/tinyspy/dist/index.js:42:80)
    at /home/deivid/Projects/Github/MetroRig/src/app/improv.ts:85:29
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
Failed to load /pads/choir/Fs3.flac: Error: 404
    at MockMetronomeNode.<anonymous> (/home/deivid/Projects/Github/MetroRig/tests/app.test.ts:3298:52)
    at MockMetronomeNode.mockCall (file:///home/deivid/Projects/Github/MetroRig/node_modules/@vitest/spy/dist/index.js:50:17)
    at MockMetronomeNode.spy [as padLoad] (file:///home/deivid/Projects/Github/MetroRig/node_modules/tinyspy/dist/index.js:42:80)
    at /home/deivid/Projects/Github/MetroRig/src/app/improv.ts:85:29
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
```
