# Stadium Tempo verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at be1b8a2
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `tests/app.test.ts` `TMP-01 the + button raises the Stadium tempo 1 BPM` | yes |
| C2 | `tests/app.test.ts` `TMP-02 the − button lowers the Stadium tempo 1 BPM` | yes |
| C3 | `tests/app.test.ts` `TMP-03 the raising keys on the Stadium raise the tempo 1 BPM each` | yes - numpad `+` sends `key: '+'`, which the map reads |
| C4 | `tests/app.test.ts` `TMP-04 the lowering keys on the Stadium lower the tempo 1 BPM each` | yes |
| C5 | `tests/app.test.ts` `TMP-05 a key with Ctrl or Cmd leaves the tempo and the browser's action` | yes - asserts tempo and `defaultPrevented` false for Ctrl and Cmd |
| C6 | `tests/app/session.test.ts` `TMP-06 the keys leave the tempo on the other screens` | yes - the page listener has no screen check of its own, so the Session test is the rule |
| C7 | `tests/app.test.ts` `TMP-07 a key typed in a text field leaves the tempo` | yes |
| C8 | `tests/app.test.ts` `TMP-08 at 240 BPM the + button is disabled and + leaves the tempo` | yes - dropping the bound from `canStepBpm` fails the `disabled` assertion |
| C9 | `tests/app.test.ts` `TMP-09 at 40 BPM the − button is disabled and - leaves the tempo` | yes |
| C10 | `tests/app.test.ts` `TMP-10 an enabled Trainer disables both buttons and the keys` | yes - removing `emit('trainer')` fails it (mutation run) |
| C11 | `tests/app/session.test.ts` `TMP-11 a step during playback reaches the engine at once` | yes |
| C12 | `tests/app/session.test.ts` `TMP-12 a step marks the preset edited` | yes |
| C13 | `tests/app.test.ts` `TMP-13 a Stadium step moves the header number and slider` | yes |
| C14 | `tests/app/session.test.ts` `TMP-14 a step from a fractional tempo rounds in its direction` | no - only 120.4, a fraction below .5; `Math.round(bpm) + 1` for the up step passes it |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C14 proves the up rounding only on a fraction below .5: replacing `Math.floor(bpm) + 1` with `Math.round(bpm) + 1` in `src/domain/tempo.ts:9` keeps TMP-14 green, while 120.6 up would then give 122, not 121 | Mutation run at be1b8a2: `tests/app/session.test.ts` TMP-14 (lines 535-543) passes with the mutant; the test only steps from 120.4 | add a step from a fraction above .5 (e.g. 120.6: up gives 121, down gives 120) to TMP-14 | 7b8b628 - TMP-14 now steps from 120.6; the `Math.round` mutant fails it |
