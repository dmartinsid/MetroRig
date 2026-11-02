# Chord Pads Specification

**Approved**: 2026-11-01 - user: "Aprovado"

## Problem Statement

A musician practising with MetroRig has no harmony to play over: the app only offers a click and drums. Improvising over one sustained chord is a classic exercise, and it needs a pad that sounds like a professional keyboard, in any key and chord type, at one click.

## Goals

- [ ] Any of 168 chords (12 roots × 14 types) starts with one click and holds until the user changes or stops it.
- [ ] The pad layers FreePats New Age samples and a synth in the Rust engine, and the user approves it by ear.
- [ ] The pad and the metronome work independently, and the drums keep their level and timing.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Automatic chord progressions | Q7, user: "pra agora eh so foco de improvisar sobre um acorde especifico mesmo" |
| MIDI controllers and computer-keyboard shortcuts | Q7 |
| Saving pads in presets | Q7 |
| More than one timbre | Q2 settles one timbre first; the design leaves room for more |
| An octave control | Q12 settles one register |
| Changing chord on the bar | Q6 settles an immediate change |
| Other chord types | Q3 settles 14 types; adding one later is a data change |
| Worship pad packs and the Ennui pack | Paid, or no written terms on the page |
| Surge XT renders | The user approved the New Age and synth layers without needing them |
| A Stitch capture for the screen | The screen follows `.stitch/DESIGN.md` |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | --------------- | --------- | ---------- |
| Sound source | FreePats New Age samples layered with a synth in the engine, then chorus and reverb | Q1, user: "eu gostei muito do 2 e 3, acho que pode ser, ate somar eles tb"; Q8, user: "recomendacoes" | y |
| Layer balance | Demo 4's balance: New Age about 2 dB above the synth | The user was told "peso igual", but demo 4 measures 0.8 and 0.6 over similar levels. What the user accepted is what the file plays; PAD-37 is the final say | y, presented with the spec, user: "Aprovado" |
| Chorus path | The chorus takes the sample layer alone, as demo 4 did; effects sit below the demos | With the synth in it chords sit 6 dB apart against PAD-14. Heard in the running app, and kept per Q20, user: "resto recomendacoes" | y |
| Chord model | Built from note samples at run time | 120 pre-rendered chords would take about 170 MB | y |
| Timbres | One | Q2, user: "q2 recomendacao" | y |
| Chord list | 12 roots × 14 types in Brazilian notation | Q3, user: "q3 recomendacao" | y |
| Screen | New `Improv` link and screen, titled `Improv · Chord Pads` | Q4 and Q9, user: "recomendacoes" | y |
| Playing gesture | One click holds; another crossfades over 1.5 s; the same one stops | Q5, user: "q5 recomendacao" | y |
| Metronome | Independent of Play; chord changes at once | Q6, user: "q6 recomendacao" | y |
| Chord picker | A grid of all 168 chords | Q10, user: "recomendacoes"; two steps would sound a chord nobody asked for | y |
| Notes on screen | Chord name and its notes | Q11, user: "recomendacoes" | y |
| Voicing | Root from A2 to G#3, other notes stacked above it | Q12, user: "recomendacoes"; C4 is MIDI 60 | y |
| Volume | One pad volume, remembered; the chord is not remembered | Q13, user: "recomendacoes" | y |
| Pad sounding on another screen | Lit dot on the `Improv` link; no stop button in the header | Q14, user: "recomendacoes" | y |
| Loading and failure | Samples load on the first visit to `Improv`; the synth covers loading and failure | Q15, user: "recomendacoes" | y |
| Stop fade | 1.5 s, the same for the Stop button and for clicking the sounding chord | Stated default, user: "recomendacoes" | y |
| Pad folder size | At most 10 MB in `public/pads/`, apart from the drums' 20 MB | Stated default, user: "recomendacoes" | y |
| Credit | FreePats in `public/kit/LICENSE.md` and the README | Stated default, user: "recomendacoes" | y |
| Note spelling | Each chord degree takes its own letter (`Ebm` is `Eb Gb Bb`, not `Eb F# Bb`). A double accidental becomes its natural note (`Ebdim` is `Eb Gb A`) | Musicians read degrees, and `Bbb` helps nobody improvising. Not asked before writing this spec | y, presented with the spec, user: "Aprovado" |
| Start fade | 1.5 s, matching the crossfade | Demos 2 and 3 fade in over 1.2 s and 1.5 s | y, presented with the spec, user: "Aprovado" |
| Default volume | 70% of the slider, peaking at or below -12 dBFS | Q13 asked for a level that leaves the drums in place; the exact value is set by ear under PAD-37 | y, presented with the spec, user: "Aprovado" |
| A sample file that fails | Its notes use the nearest loaded file; with none left, the synth plays alone | Extends Q15 the way HK-12 to HK-14 extend a failed take | y, presented with the spec, user: "Aprovado" |
| Saved view | `Improv` is remembered like the other screens | `metrorig_view_mode` already does this | y |
| Audio engine start | The first chord click starts it, as Play does today, and the chord does not wait for the drum kit | `initAudio` runs on Play and waits for the kit | y |
| Output limiter | None added; the output keeps its clamp | AD-015 keeps the drums at their level, and PAD-27 keeps the pad low enough | y |
| Auth, rate limits, external dependencies, data expiry | N/A because the files are local and static, and there is no account or server | Sweep | y |
| Observability | A failed file logs its path to the console, as the kit does | Sweep | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Hold a chord ⭐ MVP

**User Story**: As a musician, I want to click a chord and have it hold so that I can improvise over it with both hands free.

**Why P1**: This is the request.

**Acceptance Criteria**:

1. PAD-01: The app SHALL offer 168 chords, from the roots `C C# D Eb E F F# G Ab A Bb B` and the 14 types in PAD-02.
2. PAD-02: The app SHALL build each type from these semitones above the root: major 0 4 7; `m` 0 3 7; `7` 0 4 7 10; `7M` 0 4 7 11; `m7` 0 3 7 10; `sus4` 0 5 7; `sus2` 0 2 7; `add9` 0 4 7 14; `9` 0 4 7 10 14; `m9` 0 3 7 10 14; `7M(9)` 0 4 7 11 14; `6` 0 4 7 9; `dim` 0 3 6; `aug` 0 4 8.
3. PAD-03: The app SHALL play each root at the MIDI note from 45 (A2) to 56 (G#3) that carries its name, with every other note at the root plus the semitones of PAD-02.
4. PAD-04: WHEN a user clicks a chord while none sounds THEN the pad SHALL fade that chord in over 1.5 s.
5. PAD-05: WHILE a chord is held the pad SHALL keep sounding with no end and no silent frame.
6. PAD-06: WHILE a chord is held a sample loop point SHALL add no sample-to-sample step larger than the largest step in the 10 ms before it.
7. PAD-07: Each note of a held chord SHALL sound within 5 cents of equal temperament at A = 440 Hz.
8. PAD-08: WHEN a user clicks another chord while one sounds THEN the pad SHALL crossfade to the new chord over 1.5 s.
9. PAD-09: WHEN a user clicks the sounding chord THEN the pad SHALL fade it out over 1.5 s.
10. PAD-10: WHEN a user clicks several chords within 1.5 s THEN the pad SHALL settle on the last one clicked.
11. PAD-11: WHEN a chord is replaced during a fade THEN each fading chord SHALL continue from its current level with no jump.
12. PAD-12: The engine SHALL sound at most 3 chords at once however fast a user clicks, fading the oldest out over 20 ms to make room.
13. PAD-13: WHILE no fade is running the pad SHALL sound at most one chord.
14. PAD-14: Any two held chords SHALL sound within 3 dB RMS of each other, whatever their number of notes.
15. PAD-15: WHEN the first chord click comes before the audio engine has started THEN the app SHALL start the engine and sound the chord without waiting for the drum kit to load.
16. PAD-16: IF the audio engine fails to start THEN the screen SHALL show `Audio unavailable` and show no chord as sounding.
17. PAD-59: The engine SHALL allocate no memory on the audio thread while a chord starts, changes or stops.

**Independent Test**: Click `Cm7`, then `F7`, then `F7` again: the first fades in, the second crossfades, and the third fades out.

---

### P1: A pad that sounds professional ⭐ MVP

**User Story**: As a musician, I want a rich pad so that it sounds like a professional keyboard, not a test tone.

**Why P1**: The user asked for the sound of a professional keyboard.

**Acceptance Criteria**:

1. PAD-17: Each note SHALL mix a New Age sample layer and a synth layer.
2. PAD-18: The synth layer SHALL be detuned sawtooth voices through a low-pass filter with slow movement, like demo 3.
3. PAD-19: The sample layer SHALL pass through stereo chorus and the whole pad through reverb, so that its left and right channels differ.
4. PAD-20: The sample layer SHALL sound at the balance of demo 4: about 2 dB above the synth layer.
5. PAD-21: The pad samples SHALL come from FreePats New Age, whose CC0 dedication SHALL be recorded in `public/kit/LICENSE.md`.
6. PAD-22: All files in `public/pads/` together SHALL take at most 10 MB.

**Independent Test**: Hold `C7M(9)` and compare it with demo 4.

---

### P1: The pad and the metronome stay independent ⭐ MVP

**User Story**: As a musician, I want the pad to sound with or without the drums so that I can use either on its own.

**Why P1**: Q6 settled it, and today the engine is silent while stopped.

**Acceptance Criteria**:

1. PAD-23: WHILE the metronome is stopped the pad SHALL sound.
2. PAD-24: WHEN a user presses Play or Stop THEN the pad SHALL keep its chord and level.
3. PAD-25: WHEN a song, preset or groove loads THEN the pad SHALL keep its chord and level.
4. PAD-26: WHEN a user changes screens THEN the pad SHALL keep its chord and level.
5. PAD-27: WHILE the pad sounds at the default volume it SHALL peak at or below -12 dBFS.
6. PAD-28: WHILE the pad sounds every drum hit SHALL stay within 1 sample of its time without the pad.
7. PAD-29: WHILE no chord sounds the engine SHALL render the same output as before this feature, sample for sample.

**Independent Test**: Hold a chord, press Play, change to the Stadium and press Stop: the pad never changes.

---

### P1: The Improv screen ⭐ MVP

**User Story**: As a musician, I want every chord in view so that I can reach any of them with one click.

**Why P1**: Without it the pad cannot be played.

**Acceptance Criteria**:

1. PAD-30: The header SHALL show an `Improv` link after `Grooves`, and using it SHALL open a screen titled `Improv · Chord Pads`.
2. PAD-31: The screen SHALL show a grid of 12 rows of roots by 14 columns of types, with one button per chord, each named by root and type such as `C7M(9)`.
3. PAD-32: WHILE a chord sounds the screen SHALL mark its button and show its name and notes, such as `C7M(9) · C E G B D`.
4. PAD-33: WHILE no chord sounds the screen SHALL show `No chord playing`.
5. PAD-34: The app SHALL spell a chord's notes by degree, with double accidentals replaced by their natural note: `Ebm` shows `Eb Gb Bb`, `Abm` shows `Ab Cb Eb`, and `Ebdim` shows `Eb Gb A`.
6. PAD-35: WHEN a user uses the Stop button while a chord sounds THEN the pad SHALL fade it out over 1.5 s, and the screen SHALL show `No chord playing`.
7. PAD-36: WHILE no chord sounds the Stop button SHALL be disabled.
8. PAD-40: WHILE a chord sounds the `Improv` link SHALL show a lit dot on every screen.
9. PAD-41: WHILE the window is narrower than 768 px the grid SHALL scroll sideways with the root column in view, and the page SHALL not scroll sideways.

**Independent Test**: Open `Improv`, click three chords and Stop, at 1280 px and at 390 px.

---

### P1: Approval by ear ⭐ MVP

**User Story**: As the owner, I want to hear the finished pad before it ships so that the engine's sound, not a demo, is what I approve.

**Why P1**: Demos 2, 3 and 4 used a prototype and ffmpeg effects.

**Acceptance Criteria**:

1. PAD-37: The feature SHALL not close until the user approves the pad by ear in the running app, and the approval SHALL be quoted in `verification.md`.
2. PAD-38: IF the user rejects the pad by ear THEN the layer balance, default volume and effects SHALL be adjusted and offered again.

**Independent Test**: The user holds chords in the running app, alone and with drums, and answers.

---

### P2: Pad volume

**User Story**: As a musician, I want to set the pad's level so that it sits under my instrument.

**Why P2**: The default level works without it.

**Acceptance Criteria**:

1. PAD-42: WHEN a user moves the volume control THEN the pad SHALL follow it from 0 to 100% with no click, and the drums SHALL keep their level.
2. PAD-43: WHEN a user moves the volume control THEN the app SHALL remember the value across sessions.
3. PAD-44: IF the stored volume is missing or is not a number from 0 to 100 THEN the app SHALL use 70.
4. PAD-45: WHEN the app opens THEN no chord SHALL sound, whatever was sounding when it closed.

**Independent Test**: Set the volume to 30, reload and find 30, with silence until a click.

---

### P2: Loading and failure

**User Story**: As a musician, I want the pad to work at once and survive a failed download so that practice never stops for it.

**Why P2**: The synth layer already gives a working pad.

**Acceptance Criteria**:

1. PAD-46: WHEN `Improv` opens for the first time in a session THEN the app SHALL start loading the pad samples.
2. PAD-47: The app SHALL load no pad sample before `Improv` opens.
3. PAD-48: WHILE the samples load, WHEN a user clicks a chord the pad SHALL sound its synth layer.
4. PAD-49: WHEN the samples finish loading while a chord sounds THEN the sample layer SHALL fade in over 1.5 s.
5. PAD-50: IF a sample file fails to load THEN the app SHALL log its path and its notes SHALL use the nearest loaded file.
6. PAD-51: IF a sample file fails to load THEN the screen SHALL show `Samples unavailable · synth only` only when no file loaded, and `Some samples unavailable` otherwise.
7. PAD-52: IF no sample file loaded THEN the pad SHALL sound its synth layer alone.
8. PAD-53: WHEN `Improv` opens again after a failure THEN the app SHALL retry only the files that failed.

**Independent Test**: Block `public/pads/` in the browser, open `Improv`, and hear the synth alone with the notice on screen.

---

### P3: Credit and documentation

**User Story**: As the owner, I want the source credited so that the repository states where every sound comes from.

**Why P3**: CC0 requires no credit, and the project gives it anyway.

**Acceptance Criteria**:

1. PAD-54: The README SHALL list the `Improv` screen and credit FreePats New Age.
2. PAD-55: `public/kit/LICENSE.md` SHALL list each pad file with its source.

**Independent Test**: Read both files.

---

## Edge Cases

- WHEN a user clicks a chord that is fading out THEN the pad SHALL fade it back in from its current level. (PAD-39)
- IF the browser has suspended audio THEN a chord click SHALL resume it. (PAD-56)
- WHEN `Improv` is the saved screen at startup THEN the app SHALL open it, load the samples and sound nothing. (PAD-57)
- IF the audio output sample rate differs from 44.1 kHz THEN the pad SHALL keep the pitch of PAD-07. (PAD-58)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PAD-01 | P1: Hold a chord | Design | Implementing |
| PAD-02 | P1: Hold a chord | Design | Implementing |
| PAD-03 | P1: Hold a chord | Design | Implementing |
| PAD-04 | P1: Hold a chord | Design | Implementing |
| PAD-05 | P1: Hold a chord | Design | Implementing |
| PAD-06 | P1: Hold a chord | Design | Implementing |
| PAD-07 | P1: Hold a chord | Design | Implementing |
| PAD-08 | P1: Hold a chord | Design | Implementing |
| PAD-09 | P1: Hold a chord | Design | Implementing |
| PAD-10 | P1: Hold a chord | Design | Implementing |
| PAD-11 | P1: Hold a chord | Design | Implementing |
| PAD-12 | P1: Hold a chord | Design | Implementing |
| PAD-13 | P1: Hold a chord | Design | Implementing |
| PAD-14 | P1: Hold a chord | Design | Implementing |
| PAD-15 | P1: Hold a chord | Design | Implementing |
| PAD-16 | P1: Hold a chord | Design | Implementing |
| PAD-59 | P1: Hold a chord | Design | Implementing |
| PAD-17 | P1: A pad that sounds professional | Design | Implementing |
| PAD-18 | P1: A pad that sounds professional | Design | Implementing |
| PAD-19 | P1: A pad that sounds professional | Design | Implementing |
| PAD-20 | P1: A pad that sounds professional | Design | Implementing |
| PAD-21 | P1: A pad that sounds professional | Design | Implementing |
| PAD-22 | P1: A pad that sounds professional | Design | Implementing |
| PAD-23 | P1: The pad and the metronome stay independent | Design | Implementing |
| PAD-24 | P1: The pad and the metronome stay independent | Design | Implementing |
| PAD-25 | P1: The pad and the metronome stay independent | Design | Implementing |
| PAD-26 | P1: The pad and the metronome stay independent | Design | Implementing |
| PAD-27 | P1: The pad and the metronome stay independent | Design | Implementing |
| PAD-28 | P1: The pad and the metronome stay independent | Design | Implementing |
| PAD-29 | P1: The pad and the metronome stay independent | Design | Implementing |
| PAD-30 | P1: The Improv screen | Design | Implementing |
| PAD-31 | P1: The Improv screen | Design | Implementing |
| PAD-32 | P1: The Improv screen | Design | Implementing |
| PAD-33 | P1: The Improv screen | Design | Implementing |
| PAD-34 | P1: The Improv screen | Design | Implementing |
| PAD-35 | P1: The Improv screen | Design | Implementing |
| PAD-36 | P1: The Improv screen | Design | Implementing |
| PAD-40 | P1: The Improv screen | Design | Implementing |
| PAD-41 | P1: The Improv screen | Design | Implementing |
| PAD-37 | P1: Approval by ear | Design | Pending |
| PAD-38 | P1: Approval by ear | Design | Pending |
| PAD-42 | P2: Pad volume | Design | Implementing |
| PAD-43 | P2: Pad volume | Design | Implementing |
| PAD-44 | P2: Pad volume | Design | Implementing |
| PAD-45 | P2: Pad volume | Design | Implementing |
| PAD-46 | P2: Loading and failure | Design | Implementing |
| PAD-47 | P2: Loading and failure | Design | Implementing |
| PAD-48 | P2: Loading and failure | Design | Implementing |
| PAD-49 | P2: Loading and failure | Design | Implementing |
| PAD-50 | P2: Loading and failure | Design | Implementing |
| PAD-51 | P2: Loading and failure | Design | Implementing |
| PAD-52 | P2: Loading and failure | Design | Implementing |
| PAD-53 | P2: Loading and failure | Design | Implementing |
| PAD-54 | P3: Credit and documentation | Tasks | Implementing |
| PAD-55 | P3: Credit and documentation | Tasks | Implementing |
| PAD-39 | Edge Cases | Design | Implementing |
| PAD-56 | Edge Cases | Design | Implementing |
| PAD-57 | Edge Cases | Design | Implementing |
| PAD-58 | Edge Cases | Design | Implementing |

**Coverage:** 59 total, 0 mapped to tasks, 59 unmapped until Tasks.

---

## Sources

- `.specs/features/chord-pads/context.md` - the user's answers to Q1 to Q15.
- https://github.com/freepats/new-age - CC0-1.0 dedication, 16 notes from MIDI 34 to 98, with loop points.
- `.stitch/DESIGN.md` - the design system the screen follows.
- `src/lib.rs` and `src/main.ts` - one voice per track, silent while stopped, and `initAudio` on Play.

---

## Success Criteria

- [ ] The user approves the pad by ear in the running app, alone and with drums (PAD-37).
- [ ] Any chord is one click away from any other.
- [ ] Every drum test that passes today still passes.
