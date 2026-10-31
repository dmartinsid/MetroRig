# Precise-Only Metronome Specification

**Approved**: 2026-10-31 - user: "Aprovado"

## Problem Statement

MetroRig's audio engine already keeps exact time: a measured hour stayed within 1 sample of the ideal grid, with no drift. The musician still gets inexact time from the layers around it. Woodblock sounds 122 ms late, the 12/8 presets play a pulse that does not match their BPM, the Trainer ignores Start BPM and changes tempo before the downbeat, and the visuals run ahead of the sound. Swing also shifts notes off the grid on purpose, and the user no longer wants that mode.

## Goals

- [ ] Every hit lands within 1 sample of the ideal grid, with no accumulated drift over 1 hour
- [ ] MetroRig has no way to play off the grid
- [ ] The displayed BPM matches what plays in every meter and during Trainer runs
- [ ] Each click sound starts on the beat and leaves no echo
- [ ] Visuals follow the sound by the output latency the browser reports

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Device latency compensation for audio | It is constant, and it sits outside the app |
| Manual latency calibration | Visual sync is best effort from the browser's reported value |
| BPM counted by compound pulse | The user chose quarter-note BPM in every meter |
| Trainer deceleration | It is existing behaviour and unrelated to precision |
| Changing the forced 44.1 kHz context rate | Browser resampling adds constant latency, not jitter or drift |
| Renaming Speed Trainer presets whose names differ from their values | These are imported labels and do not change timing |
| Making `mechanical.wav` differ from `click.wav` | The files are identical, which is a sound-library issue |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Silence-trim threshold | First frame at or above 1% of the sample's peak | The value separates Woodblock's silence from its attack and leaves the other samples intact | y - user accepted |
| Trim coverage | All samples, click and drums | One rule keeps loading simple | y - user accepted |
| Unknown output latency | No visual delay | The app must not invent a value | y - user accepted |
| Factory grooves Blues Shuffle and Jazz Swing | Expand to 24 steps | They must match the corrected 12/8 presets | y - user accepted |
| Worklet logging and per-block allocation | Remove per-tick logs, per-message logs and repeated per-block views | Audio-thread stalls delay sound | y - user accepted |
| Shipped WASM | Rebuild `public/pkg/metrorig_audio_bg.wasm` | The app loads this file, not `src/lib.rs` | y - user accepted |
| Git | Work on a feature branch and track `.specs/`; leave existing deletions and tool folders out of commits | They are not part of this feature | y - user accepted |
| Legacy preset BPM rounding | Round `bpm * 1.5` to the nearest integer | The BPM slider holds integers | n - agent default |
| Legacy preset storage | Convert in memory on load; the record changes only when the user saves | Loading must not rewrite stored data | n - agent default |
| Legacy preset Trainer values | Leave them unchanged | The conversion covers only steps and BPM | n - agent default |
| Trainer enabled during playback | Continue from the live BPM | Start BPM applies only at Play, so the tempo does not jump | n - agent default |
| Preset loaded during playback | Apply its Start BPM if its Trainer is on, otherwise its BPM | The preset's own start rule applies | n - agent default |
| Saved swing data | Ignore it on load and omit it on the next save | Stored records stay readable | n - agent default |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Exact timing ⭐ MVP

**User Story**: As a musician, I want every hit on the ideal grid so that I can trust the metronome for practice.

**Why P1**: This is the purpose of the feature.

**Acceptance Criteria**:

1. TIME-01: WHILE playing at a constant BPM from 40 to 240 the engine SHALL place each hit within 1 sample of its ideal position.
2. TIME-02: WHILE playing for 1 hour at 40, 97, 120, 133, 187 and 240 BPM the engine SHALL keep the final hit within 1 sample of its ideal position.
3. TIME-03: The engine SHALL give every step the same ideal duration of `sampleRate * 60 / (bpm * 4)` samples.

**Independent Test**: Render 1 hour of audio through the engine exports with one-sample click impulses and compare every hit to the ideal grid.

---

### P1: Swing removal ⭐ MVP

**User Story**: As a musician, I want no off-grid playing mode so that the app always plays straight.

**Why P1**: The user asked for this removal directly.

**Acceptance Criteria**:

1. SWING-01: The Editor SHALL show no swing control.
2. SWING-02: The Editor SHALL title the time-signature card "Measure".
3. SWING-03: WHEN a saved preset containing a swing value loads THEN the system SHALL send no swing setting to the audio engine.
4. SWING-04: WHEN a preset is saved THEN the system SHALL store no swing field.
5. SWING-05: The shipped WASM SHALL export no `engine_set_swing` function.

**Independent Test**: Load a preset with `swing: 50`, save it again, and confirm that the Editor, the engine messages and the stored record contain no swing.

---

### P1: BPM matches what plays ⭐ MVP

**User Story**: As a musician, I want the number on screen to match the tempo I hear so that I can practise at a known speed.

**Why P1**: Blues Shuffle and Jazz Swing currently display one tempo and play another.

**Acceptance Criteria**:

1. BPM-01: The engine SHALL treat BPM as quarter notes per minute in every meter.
2. BPM-02: WHEN the user sets a time signature THEN the system SHALL use 4 steps per quarter, 2 per eighth and 1 per sixteenth.
3. BPM-03: The Blues Shuffle preset SHALL be 12/8 with 24 steps, 135 BPM and a click every 6 steps.
4. BPM-04: The Jazz Swing preset SHALL be 12/8 with 24 steps, 195 BPM and a click every 6 steps.
5. BPM-05: The factory grooves Blues Shuffle and Jazz Swing SHALL each hold 24 steps.
6. BPM-06: WHEN a user preset with time signature 12/8 and 12 steps loads THEN the system SHALL expand it to 24 steps with each original step at twice its index.
7. BPM-07: WHEN a user preset is expanded THEN the system SHALL set its BPM to `bpm * 1.5` rounded to the nearest integer.
8. BPM-08: IF the expanded BPM exceeds 240 THEN the system SHALL use 240.

**Independent Test**: Load Blues Shuffle, render one bar, and measure 90 clicks per minute at 135 BPM.

---

### P1: Precise Trainer ⭐ MVP

**User Story**: As a musician, I want the Trainer to follow its settings exactly so that a speed-up session is predictable.

**Why P1**: The Trainer currently starts at the wrong BPM and changes tempo early.

**Acceptance Criteria**:

1. TRAIN-01: WHILE the Trainer is enabled, WHEN the user presses Play the system SHALL play the first hit at Start BPM.
2. TRAIN-02: WHERE the Trainer is stepped by bars the engine SHALL keep the old BPM on the interval into beat 1 and use the new BPM from the interval after it.
3. TRAIN-03: WHERE the Trainer is stepped by seconds the engine SHALL apply the increment on the first beat 1 after the configured seconds elapse.
4. TRAIN-04: WHERE the Trainer uses the Smooth curve the engine SHALL raise BPM continuously without waiting for beat 1.
5. TRAIN-05: WHEN Target, Increment, interval type, interval value or curve changes during playback THEN the engine SHALL keep the live BPM at that moment.
6. TRAIN-06: WHEN Target, Increment, interval type, interval value or curve changes during playback THEN the engine SHALL use the new value from the next beat 1.
7. TRAIN-07: WHEN Start BPM changes during playback THEN the engine SHALL keep the live BPM until the next Play.
8. TRAIN-08: WHEN the user disables the Trainer during playback THEN the engine SHALL hold the live BPM until Stop.
9. TRAIN-09: WHEN the user enables the Trainer during playback THEN the engine SHALL continue from the live BPM.
10. TRAIN-10: WHEN the user moves the BPM slider during a Trainer run THEN the engine SHALL use the slider value immediately.
11. TRAIN-11: WHEN the user moves the BPM slider during a Trainer run THEN the Trainer SHALL continue from the slider value.
12. TRAIN-12: WHEN the time signature, a grid step or a groove changes during a Trainer run THEN the engine SHALL keep the live BPM.
13. TRAIN-13: WHILE a Trainer run plays the Editor SHALL show the live BPM.
14. TRAIN-14: WHEN the user presses Stop THEN the Editor SHALL show the preset BPM.
15. TRAIN-15: The Trainer SHALL never raise BPM above Target BPM.
16. TRAIN-16: IF Start BPM is at or above Target BPM THEN the engine SHALL hold Start BPM.

**Independent Test**: Set BPM 100, Start BPM 80, and +5 every bar, then render 3 bars and check each interval around both downbeats.

---

### P1: Clean click sounds ⭐ MVP

**User Story**: As a musician, I want each click to be one clean sound on the beat so that I can lock to it.

**Why P1**: Woodblock is 122 ms late, and the accent echo can sound like a second hit.

**Acceptance Criteria**:

1. ONSET-01: WHEN a sample loads THEN the system SHALL discard every frame before the first frame reaching 1% of the sample's peak in either channel.
2. ONSET-02: WHEN Woodblock plays on a step THEN the system SHALL output its first audible frame within 1 sample of that step's position.
3. ONSET-03: IF a sample contains only silence THEN the system SHALL load it unchanged.
4. CLICK-01: WHEN an accented click plays THEN the engine SHALL output no delayed repetition after the click ends.

**Independent Test**: Load `woodblock.wav`, render one hit, and confirm that its first audible frame lands on the step.

---

### P1: Clean Stop and Play ⭐ MVP

**User Story**: As a musician, I want each Play to start clean so that the first bar is exact.

**Why P1**: Remains of the previous sound can currently return on restart.

**Acceptance Criteria**:

1. PLAY-01: WHEN the user presses Stop THEN the engine SHALL output silence from the next audio block.
2. PLAY-02: WHEN the user presses Play after Stop THEN the engine SHALL output no sound left from the previous run.
3. PLAY-03: WHEN the user presses Play THEN the engine SHALL fire step 0 first.

**Independent Test**: Stop during a kick sample, press Play with an empty step 0, and confirm silence until the first enabled step.

---

### P2: Visual sync

**User Story**: As a musician, I want visuals to land with the sound so that the eye and ear agree.

**Why P2**: Audio timing does not depend on it, and the browser's value can be inaccurate.

**Acceptance Criteria**:

1. VIS-01: WHILE playing, WHEN a tick arrives the system SHALL start its beat animation after the sum of the reported base and output latency.
2. VIS-02: IF the reported latency is missing, non-finite or negative THEN the system SHALL use a delay of 0.
3. VIS-03: WHEN the user presses Stop THEN the system SHALL cancel every pending beat animation.

**Independent Test**: Fake a 200 ms latency and confirm that the animation starts 200 ms after the tick.

---

### P2: Quiet audio thread

**User Story**: As a musician, I want the audio thread free of avoidable work so that hits are not delayed by stalls.

**Why P2**: The engine meets its timing target already, and this reduces underrun risk.

**Acceptance Criteria**:

1. RT-01: WHEN a message or tick passes between the main thread and the worklet THEN the system SHALL write no console log.
2. RT-02: WHILE WASM memory size is unchanged the worklet SHALL reuse its heap views across audio blocks.

**Independent Test**: Drive the processor through START, SET_BPM and 100 audio blocks, and confirm no logs and one heap view.

---

## Edge Cases

- IF a user preset has time signature 6/8 and 12 steps THEN the system SHALL leave it unchanged.
- WHEN a preset loads during playback THEN the engine SHALL use that preset's Start BPM if its Trainer is enabled.
- WHEN a preset without an enabled Trainer loads during playback THEN the engine SHALL use that preset's BPM.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TIME-01 | P1: Exact timing | Tasks | Implementing |
| TIME-02 | P1: Exact timing | Tasks | Implementing |
| TIME-03 | P1: Exact timing | Tasks | Implementing |
| SWING-01 | P1: Swing removal | Tasks | Pending |
| SWING-02 | P1: Swing removal | Tasks | Pending |
| SWING-03 | P1: Swing removal | Tasks | Pending |
| SWING-04 | P1: Swing removal | Tasks | Pending |
| SWING-05 | P1: Swing removal | Tasks | Pending |
| BPM-01 | P1: BPM matches what plays | Tasks | Implementing |
| BPM-02 | P1: BPM matches what plays | Tasks | Pending |
| BPM-03 | P1: BPM matches what plays | Tasks | Pending |
| BPM-04 | P1: BPM matches what plays | Tasks | Pending |
| BPM-05 | P1: BPM matches what plays | Tasks | Pending |
| BPM-06 | P1: BPM matches what plays | Tasks | Pending |
| BPM-07 | P1: BPM matches what plays | Tasks | Pending |
| BPM-08 | P1: BPM matches what plays | Tasks | Pending |
| TRAIN-01 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-02 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-03 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-04 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-05 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-06 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-07 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-08 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-09 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-10 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-11 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-12 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-13 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-14 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-15 | P1: Precise Trainer | Tasks | Pending |
| TRAIN-16 | P1: Precise Trainer | Tasks | Pending |
| ONSET-01 | P1: Clean click sounds | Tasks | Pending |
| ONSET-02 | P1: Clean click sounds | Tasks | Pending |
| ONSET-03 | P1: Clean click sounds | Tasks | Pending |
| CLICK-01 | P1: Clean click sounds | Tasks | Implementing |
| PLAY-01 | P1: Clean Stop and Play | Tasks | Implementing |
| PLAY-02 | P1: Clean Stop and Play | Tasks | Implementing |
| PLAY-03 | P1: Clean Stop and Play | Tasks | Implementing |
| VIS-01 | P2: Visual sync | Tasks | Pending |
| VIS-02 | P2: Visual sync | Tasks | Pending |
| VIS-03 | P2: Visual sync | Tasks | Pending |
| RT-01 | P2: Quiet audio thread | Tasks | Pending |
| RT-02 | P2: Quiet audio thread | Tasks | Pending |

**ID format:** `[CATEGORY]-[NUMBER]`

**Coverage:** 44 total, 0 mapped to tasks, 44 unmapped until the Tasks phase.

---

## Sources

- `.specs/features/precise-only/context.md` - every user decision and the measurements of 2026-10-31

---

## Success Criteria

- [ ] A `cargo test` run proves TIME-01 and TIME-02 at all six BPMs
- [ ] Woodblock's first audible frame lands within 1 sample of its step
- [ ] Blues Shuffle plays 90 clicks per minute and Jazz Swing plays 130
- [ ] A Trainer run from Start BPM changes tempo only at beat 1 when stepped
- [ ] The shipped WASM exports no swing function
