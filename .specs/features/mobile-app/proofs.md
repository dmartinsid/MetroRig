# mobile-app proofs

**HEAD**: d41ac4c
**Tree**: clean
**Shell**: /bin/sh
**Result**: 40 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_01 no sideways page scroll at 360 375 390 430` | pass |
| C2 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_02 header selectors show their value in full at 3` | pass |
| C3 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_03 stadium orbs and tempo buttons inside the pane` | pass |
| C4 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_04 touch targets 44 px and step cells 32 px` | pass |
| C5 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_05 fields use 16 px text` | pass |
| C6 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_06 tab bar fixed to the bottom with four icon tab` | pass |
| C7 | `run js / ✓ tests/app.test.ts > Mobile App > mob_07 tab shows its screen and marks only itself` | pass |
| C8 | `run js / ✓ tests/app.test.ts > Mobile App > mob_08 improv tab dot follows the pad` | pass |
| C9 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_09 tab bar pads the bottom safe area` | pass |
| C10 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_10 last element clears the fixed bars` | pass |
| C11 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_11 desktop keeps header links` | pass |
| C12 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_12 compact top bar rows` | pass |
| C13 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_13 transport bar fixed above the tab bar` | pass |
| C14 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_14 transport bar only in the editor` | pass |
| C15 | `run js / ✓ tests/app.test.ts > Mobile App > mob_15 transport play starts and both show stop` | pass |
| C16 | `run js / ✓ tests/app.test.ts > Mobile App > mob_16 transport stop stops and both show play` | pass |
| C17 | `run js / ✓ tests/app.test.ts > Mobile App > mob_17 tempo bus play mirrors to the transport bar` | pass |
| C18 | `run js / ✓ tests/app.test.ts > Mobile App > mob_18 plus raises one bpm everywhere` | pass |
| C19 | `run js / ✓ tests/app.test.ts > Mobile App > mob_19 minus lowers one bpm everywhere` | pass |
| C20 | `run js / ✓ tests/app.test.ts > Mobile App > mob_20 transport tempo follows slider preset and trainer` | pass |
| C21 | `run js / ✓ tests/app.test.ts > Mobile App > mob_21 tempo bounds disable the steps` | pass |
| C22 | `run js / ✓ tests/app.test.ts > Mobile App > mob_22 trainer disables the steps` | pass |
| C23 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_23 track names stay in view while steps scroll` | pass |
| C24 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_24 grid snaps to beat starts` | pass |
| C25 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_25 right fade marks more steps` | pass |
| C26 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_26 left fade marks hidden steps` | pass |
| C27 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_27 figure palette is one scrolling row` | pass |
| C28 | `run js / ✓ tests/install.test.ts > Mobile App > mob_28 manifest declares the installable app` | pass |
| C29 | `run js / ✓ tests/install.test.ts > Mobile App > mob_29 page declares install metadata` | pass |
| C30 | `run js / ✓ tests/install.test.ts > Mobile App > mob_30 built icons resolve under the base` | pass |
| C31 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_31 top bar pads the top safe area` | pass |
| C32 | `run js / ✓ tests/keepAwake.test.ts > Mobile App > mob_32 sound requests a wake lock` | pass |
| C33 | `run js / ✓ tests/keepAwake.test.ts > Mobile App > mob_33 silence releases the wake lock` | pass |
| C34 | `run js / ✓ tests/keepAwake.test.ts > Mobile App > mob_34 visible again requests the lock` | pass |
| C35 | `run js / ✓ tests/keepAwake.test.ts > Mobile App > mob_35 missing or refused wake lock plays on` | pass |
| C36 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_36 no tap highlight` | pass |
| C37 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_37 double tap does not zoom` | pass |
| C38 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_38 long press selects no text` | pass |
| C39 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > mob_39 pull past the top does not reload` | pass |
| Build | `npm run build` | pass |

## Output

`Run mobile` - exit 0

```
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_27 figure palette is one scrolling row
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_27 figure palette is one scrolling row 657ms
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_25 right fade marks more steps
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_25 right fade marks more steps 1352ms
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_26 left fade marks hidden steps 1055ms
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_01 no sideways page scroll at 360 375 390 430 8594ms
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_02 header selectors show their value in full at 360 549ms
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_03 stadium orbs and tempo buttons inside the panel at 360 466ms
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_04 touch targets 44 px and step cells 32 px
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_04 touch targets 44 px and step cells 32 px 2628ms

 Test Files  1 passed (1)
      Tests  23 passed (23)
   Start at  17:46:41
   Duration  35.85s (transform 108ms, setup 1ms, collect 355ms, tests 35.26s, environment 0ms, prepare 65ms)
```

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
