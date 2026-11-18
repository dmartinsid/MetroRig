# portrait-desktop proofs

**HEAD**: 3947166
**Tree**: clean
**Shell**: /bin/sh
**Result**: 9 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > prt_01 no sideways page scroll on portrait desktop wi` | pass |
| C2 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > prt_02 compact header and fixed bottom tab bar on por` | pass |
| C3 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > prt_03 stadium full-width panel, square clock and fix` | pass |
| C4 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > prt_04 editor single column, transport bar, one-row p` | pass |
| C5 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > prt_05 touch targets 44 px, step cells 32 px and fiel` | pass |
| C6 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > prt_06 last element clears the fixed bars on portrait` | pass |
| C7 | `run mobile / ✓ tests/mobile/phone.test.ts > Mobile App > prt_07 desktop windows wider than 3:4 keep the deskto` | pass |
| Build | `npm run build` | pass |
| Build | `npm run test:js` | pass |

## Output

`Run mobile` - exit 0

```
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_03 stadium orbs and tempo buttons inside the panel at 360 528ms
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_04 touch targets 44 px and step cells 32 px
 ✓ tests/mobile/phone.test.ts > Mobile App > mob_04 touch targets 44 px and step cells 32 px 7689ms
 ✓ tests/mobile/phone.test.ts > Mobile App > prt_01 no sideways page scroll on portrait desktop windows 5022ms
 ✓ tests/mobile/phone.test.ts > Mobile App > prt_02 compact header and fixed bottom tab bar on portrait desktop 4437ms
 ✓ tests/mobile/phone.test.ts > Mobile App > prt_03 stadium full-width panel, square clock and fixed play on 9:16 desktop 1861ms
 ✓ tests/mobile/phone.test.ts > Mobile App > prt_04 editor single column, transport bar, one-row palette and sticky grid on portrait desktop 7326ms
 ✓ tests/mobile/phone.test.ts > Mobile App > prt_05 touch targets 44 px, step cells 32 px and fields 16 px on portrait desktop 4034ms
 ✓ tests/mobile/phone.test.ts > Mobile App > prt_06 last element clears the fixed bars on portrait desktop 3279ms
 ✓ tests/mobile/phone.test.ts > Mobile App > prt_07 desktop windows wider than 3:4 keep the desktop layout 3782ms

 Test Files  1 passed (1)
      Tests  39 passed (39)
   Start at  00:25:32
   Duration  91.84s (transform 96ms, setup 0ms, collect 325ms, tests 91.25s, environment 0ms, prepare 86ms)
```
