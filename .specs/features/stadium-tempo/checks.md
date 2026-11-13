# Stadium Tempo Checks

**Spec**: `.specs/features/stadium-tempo/spec.md`

## Execution Plan

Tasks skipped: three steps, each one commit.

1. [x] The tempo step rules: `src/domain/tempo.ts` (bounds, step, key map) and `Session.canStepBpm`, `stepBpm`, `pressTempoKey`; `setTrainer` emits `trainer` → files: `src/domain/tempo.ts`, `src/app/session.ts`, `src/app/ports.ts`, `tests/app/session.test.ts` → verify: run unit → commit: `feat(session): step the tempo 1 BPM from the Stadium rules`
2. [x] The Stadium's `−` and `+` buttons and the `+`/`-` keys → files: `index.html`, `src/ui/stadium.ts`, `src/ui/index.css`, `tests/app.test.ts` → verify: run unit → commit: `feat(stadium): add tempo buttons and keys`
3. [x] The header follows a tempo set elsewhere → files: `src/ui/header.ts`, `tests/app.test.ts` → verify: run unit, then Build → commit: `feat(header): follow a tempo set from the Stadium`

**Build**: `npm run build`
**Run unit**: `npx vitest run tests/app/session.test.ts tests/app.test.ts --reporter=verbose`

## Checks

**C1** - From 120 BPM, a click on the Stadium's `+` shows `121.0` (TMP-01, AC 1)
Proof: run unit | ✓ tests/app.test.ts > Stadium tempo > TMP-01 the + button raises the Stadium tempo 1 BPM

**C2** - From 120 BPM, a click on the Stadium's `−` shows `119.0` (TMP-02, AC 2)
Proof: run unit | ✓ tests/app.test.ts > Stadium tempo > TMP-02 the − button lowers the Stadium tempo 1 BPM

**C3** - On the Stadium, `+`, `=` and numpad `+` each raise the tempo by 1 BPM (TMP-03, AC 3)
Proof: run unit | ✓ tests/app.test.ts > Stadium tempo > TMP-03 the raising keys on the Stadium raise the tempo 1 BPM each

**C4** - On the Stadium, `-` and numpad `-` each lower the tempo by 1 BPM (TMP-04, AC 4)
Proof: run unit | ✓ tests/app.test.ts > Stadium tempo > TMP-04 the lowering keys on the Stadium lower the tempo 1 BPM each

**C5** - With Ctrl or Cmd held, the four keys leave the tempo and the key's default action (TMP-05, AC 5)
Proof: run unit | ✓ tests/app.test.ts > Stadium tempo > TMP-05 a key with Ctrl or Cmd leaves the tempo and the browser's action

**C6** - On the Editor, Grooves and Improv screens, the four keys leave the tempo (TMP-06, AC 6)
Proof: run unit | ✓ tests/app/session.test.ts > Stadium tempo > TMP-06 the keys leave the tempo on the other screens

**C7** - A key pressed in a text field leaves the tempo (TMP-07, AC 7)
Proof: run unit | ✓ tests/app.test.ts > Stadium tempo > TMP-07 a key typed in a text field leaves the tempo

**C8** - At 240 BPM the `+` button is disabled and `+` leaves 240 (TMP-08, AC 8)
Proof: run unit | ✓ tests/app.test.ts > Stadium tempo > TMP-08 at 240 BPM the + button is disabled and + leaves the tempo

**C9** - At 40 BPM the `−` button is disabled and `-` leaves 40 (TMP-09, AC 9)
Proof: run unit | ✓ tests/app.test.ts > Stadium tempo > TMP-09 at 40 BPM the − button is disabled and - leaves the tempo

**C10** - With the preset's Trainer enabled, both buttons are disabled and the keys leave the tempo; turned off, both come back (TMP-10, AC 10)
Proof: run unit | ✓ tests/app.test.ts > Stadium tempo > TMP-10 an enabled Trainer disables both buttons and the keys

**C11** - A step during playback sends the new BPM to the engine (TMP-11, AC 11)
Proof: run unit | ✓ tests/app/session.test.ts > Stadium tempo > TMP-11 a step during playback reaches the engine at once

**C12** - A step marks the preset edited (TMP-12, AC 12)
Proof: run unit | ✓ tests/app/session.test.ts > Stadium tempo > TMP-12 a step marks the preset edited

**C13** - After a Stadium step to 121, the header number, slider label and slider read 121 (TMP-13, AC 13)
Proof: run unit | ✓ tests/app.test.ts > Stadium tempo > TMP-13 a Stadium step moves the header number and slider

**C14** - From 120.4 BPM, up gives 121 and down gives 120 (TMP-14, AC 14)
Proof: run unit | ✓ tests/app/session.test.ts > Stadium tempo > TMP-14 a step from a fractional tempo rounds in its direction

---

## Handoff

**Settled mid-build:** none
**Dispatched:** none
**Walked:** not yet
