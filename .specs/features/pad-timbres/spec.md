# Pad Timbres Specification

**Approved**: 2026-11-02 - user: "manda bala"

## Problem Statement

The Improv pad has one sound. The user liked what they heard, and their favourite demo was a different timbre: Choir. They also want real orchestral strings. A select on the `Improv` screen lets a musician pick the sound that suits what they are playing.

## Goals

- [ ] A select on `Improv` offers Choir, New Age, Orchestra, Sweep and Analog.
- [ ] Orchestra sounds like real string sections, with a bass under them.
- [ ] A timbre downloads only when chosen, and the first load of the app stays as light as it is today.
- [ ] The user approves each new timbre by ear in the running app.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| A real string quartet | VSCO 2 Community Edition has no solo viola or solo cello |
| Bowed | 6.3 MB, and Q16 kept it out |
| Synth Strings 1 and 2 | The user asked for orchestra or quartet strings, not synthetic ones |
| A mix or effects control per timbre | Each timbre's mix is set by ear and fixed |
| Different chords or chord names per timbre | Every timbre plays the 168 chords of `chord-pads` |
| An octave control | Deferred in `chord-pads` |
| Automatic progressions, MIDI, presets | Deferred in `chord-pads` |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | --------------- | --------- | ---------- |
| Timbres | Choir, New Age, Orchestra, Sweep, Analog | Q16 and Q21, user: "resto recomendacoes" and "q24 sim, gostei" | y |
| Mix per timbre | Each timbre has its own, set by ear | Q17, user: "resto recomendacoes" | y |
| Select | On `Improv`, crossfading over 1.5 s, remembered | Q18, user: "resto recomendacoes" | y |
| Delivery | A feature of its own, on top of `feat/chord-pads` | Q19, user: "resto recomendacoes" | y |
| Size | `public/pads/` at most 12 MB, superseding PAD-22 | Q22, user: "q22 recomendacao" | y |
| Default | Choir with the synth over it, superseding New Age as the first sound | Q23, user: "q23 recomendacao"; `chord-pads` tests that name New Age as the first load change with it | y |
| Orchestra bass | Each chord adds the root an octave and two octaves down, as in the approved demo | Q24, user: "q24 sim, gostei" | y |
| Order in the select | Choir, New Age, Orchestra, Sweep, Analog | Default first, then the rest of the user's interest | y, presented with the spec, user: "manda bala" |
| Orchestra synth layer | None, as in the approved demo | Q24 approved a demo with no synth | y, presented with the spec, user: "manda bala" |
| Orchestra while loading | The Analog synth holds the chord until the files arrive, then crossfades | Q15 and Q18 settle on the synth as the fallback | y, presented with the spec, user: "manda bala" |
| Orchestra tuning | The build script tunes each file, and the centre of a note sits within 10 cents | Section vibrato is wide, and a measurement of 7 files gave offsets up to ±34 cents that may be the vibrato | y, presented with the spec, user: "manda bala" |
| Level between timbres | Any two sit within 3 dB RMS on the same chord | A change of timbre must not act as a change of volume | y, presented with the spec, user: "manda bala" |
| A loaded timbre | Stays in memory until the page closes | Going back to it must not fetch or wait | y, presented with the spec, user: "manda bala" |
| Orchestra loops | 4 s, each file made by a long crossfade | VSCO samples have no loop points; 13 files come to about 2.7 MB | y, presented with the spec, user: "manda bala" |
| Auth, rate limits, external dependencies, data expiry | N/A because the files are local and static | Sweep | y |
| Observability | A failed file logs its path, as in `chord-pads` | Sweep | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Choose a timbre ⭐ MVP

**User Story**: As a musician, I want to pick the pad's sound so that it suits what I am playing.

**Why P1**: This is the request.

**Acceptance Criteria**:

1. TIM-01: The `Improv` screen SHALL show a select with `Choir`, `New Age`, `Orchestra`, `Sweep` and `Analog`, in that order.
2. TIM-02: WHEN no timbre is stored THEN the select SHALL show `Choir`.
3. TIM-03: WHEN a user picks a timbre while a chord sounds THEN the pad SHALL crossfade to the same chord in that timbre over 1.5 s.
4. TIM-04: WHEN a user picks a timbre while no chord sounds THEN the pad SHALL stay silent, and the next chord SHALL use that timbre.
5. TIM-05: WHEN a user picks several timbres within 1.5 s THEN the pad SHALL settle on the last one picked.
6. TIM-06: WHEN a user picks a timbre THEN the app SHALL remember it across sessions.
7. TIM-07: IF the stored timbre is missing or unknown THEN the app SHALL use `Choir`.
8. TIM-08: WHEN the app opens on a stored timbre THEN no chord SHALL sound.

**Independent Test**: Hold `Am7`, pick each timbre in turn, and hear the same chord change sound with no gap and no click.

---

### P1: Five sounds ⭐ MVP

**User Story**: As a musician, I want each timbre to sound like what its name says so that the choice means something.

**Why P1**: The user chose these sounds by ear.

**Acceptance Criteria**:

1. TIM-09: `Choir` SHALL mix FreePats Synth Pad Choir with the synth layer, with the samples about 2 dB above the synth, as in `timbre-synth-pad-choir-Cmaj9.wav`.
2. TIM-10: `New Age` SHALL render the same output as `chord-pads` for the same chord, sample for sample.
3. TIM-11: `Sweep` SHALL mix FreePats Sweep Pad with the synth layer.
4. TIM-12: `Analog` SHALL render the synth layer alone and read no file.
5. TIM-13: `Orchestra` SHALL render VSCO string sections with no synth layer: cello, viola and violin from low to high.
6. TIM-14: `Orchestra` SHALL add the chord's root 12 and 24 semitones below it, voiced by cello and contrabass.
7. TIM-15: The pad SHALL play a chord of up to 7 notes in every fade, limit and rule of `chord-pads`.
8. TIM-16: Each note of `Choir`, `New Age`, `Sweep` and `Analog` SHALL sound within 5 cents of equal temperament at A = 440 Hz.
9. TIM-17: The pitch centre of each `Orchestra` note SHALL sit within 10 cents of equal temperament at A = 440 Hz.
10. TIM-18: Within a timbre, any two held chords SHALL sound within 3 dB RMS.
11. TIM-19: On the same chord, any two timbres SHALL sound within 3 dB RMS.
12. TIM-20: At the default volume, every timbre SHALL peak at or below -12 dBFS.
13. TIM-21: Every file loop SHALL close with no sample-to-sample step above the largest in the 10 ms before it.
14. TIM-22: Across each `Orchestra` loop, the level SHALL stay within 1.5 dB over windows of 100 ms, so the loop does not pulse.
15. TIM-23: The engine SHALL allocate no memory on the audio thread while a chord or timbre starts, changes or stops.

**Independent Test**: Hold `C7M(9)` in each timbre, and compare Choir and Orchestra with their demos.

---

### P1: Orchestra bank build ⭐ MVP

**User Story**: As the owner, I want the Orchestra files built by a script so that they can be remade and tuned.

**Why P1**: VSCO's samples have no loops, and they must ship small.

**Acceptance Criteria**:

1. TIM-24: `scripts/build_orchestra_bank.py` SHALL turn the VSCO recordings into 44.1 kHz, 16-bit, stereo FLAC files with a 4 s loop.
2. TIM-25: The script SHALL produce the same bytes from the same input.

**Independent Test**: Run the script twice and compare the files.

---

### P1: Download only what is chosen ⭐ MVP

**User Story**: As a musician, I want a timbre to load when I pick it so that the app stays light.

**Why P1**: Five banks would otherwise weigh down the first visit.

**Acceptance Criteria**:

1. TIM-26: WHEN `Improv` opens THEN the app SHALL load the files of the selected timbre alone.
2. TIM-27: WHEN a user picks a timbre for the first time THEN the app SHALL load its files.
3. TIM-28: WHEN a user picks a timbre already loaded THEN the app SHALL fetch nothing.
4. TIM-29: WHEN `Analog` is selected THEN the app SHALL fetch no pad file.
5. TIM-30: WHILE a timbre loads, WHEN a chord sounds the pad SHALL sound its synth layer.
6. TIM-31: WHEN a timbre finishes loading while its chord sounds THEN its sample layer SHALL fade in over 1.5 s.
7. TIM-32: WHEN `Orchestra` finishes loading while its chord sounds THEN the synth SHALL fade out over 1.5 s as the sections fade in.
8. TIM-33: WHEN a load finishes for a timbre no longer selected THEN the pad SHALL keep the sound of the selected one.
9. TIM-34: IF a file of the selected timbre fails to load THEN the app SHALL log its path and show the notices of PAD-51.
10. TIM-35: WHEN `Improv` opens again, or the timbre is picked again, after a failure THEN the app SHALL retry only the files that failed.
11. TIM-36: All files in `public/pads/` together SHALL take at most 12 MB.

**Independent Test**: With the network panel open, reload, pick `Orchestra` during a chord, and go back to `Choir`.

---

### P1: Approval by ear ⭐ MVP

**User Story**: As the owner, I want to hear each timbre in the app so that the engine's sound, not a demo, is what I approve.

**Why P1**: The demos used ffmpeg effects, and Orchestra has real loops to judge.

**Acceptance Criteria**:

1. TIM-37: The feature SHALL not close until the user approves `Choir`, `Orchestra` and `Sweep` by ear in the running app, and the approval SHALL be quoted in `verification.md`.
2. TIM-38: IF the user rejects a timbre by ear THEN its mix SHALL be adjusted and offered again.
3. TIM-39: IF the user rejects `Orchestra` for a pulsing loop THEN the loop SHALL be rebuilt.

**Independent Test**: The user holds chords in each timbre for 30 s, alone and with a groove, and answers.

---

### P3: Credit

**User Story**: As the owner, I want every source credited so that the repository states where each sound comes from.

**Why P3**: CC0 requires no credit, and the project gives it anyway.

**Acceptance Criteria**:

1. TIM-40: `public/kit/LICENSE.md` SHALL list each new file with its source and its CC0 dedication.
2. TIM-41: The README SHALL credit FreePats and Versilian Studios for the pads.

**Independent Test**: Read both files.

---

## Edge Cases

- IF a user picks a timbre during a chord fade-out THEN the fade SHALL continue, and the next chord SHALL use the timbre. (TIM-42)
- WHEN a chord stops while a timbre loads THEN the load SHALL finish, and no sound SHALL start. (TIM-43)
- IF the audio output sample rate differs from 44.1 kHz THEN every timbre SHALL keep its pitch. (TIM-44)
- WHILE no chord sounds the engine SHALL render the same drum output as today, sample for sample, whichever timbre is selected. (TIM-45)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TIM-01 | P1: Choose a timbre | Design | Pending |
| TIM-02 | P1: Choose a timbre | Design | Pending |
| TIM-03 | P1: Choose a timbre | Design | Pending |
| TIM-04 | P1: Choose a timbre | Design | Pending |
| TIM-05 | P1: Choose a timbre | Design | Pending |
| TIM-06 | P1: Choose a timbre | Design | Pending |
| TIM-07 | P1: Choose a timbre | Design | Implementing |
| TIM-08 | P1: Choose a timbre | Design | Pending |
| TIM-09 | P1: Five sounds | Design | Pending |
| TIM-10 | P1: Five sounds | Design | Pending |
| TIM-11 | P1: Five sounds | Design | Pending |
| TIM-12 | P1: Five sounds | Design | Pending |
| TIM-13 | P1: Five sounds | Design | Pending |
| TIM-14 | P1: Five sounds | Design | Implementing |
| TIM-15 | P1: Five sounds | Design | Pending |
| TIM-16 | P1: Five sounds | Design | Pending |
| TIM-17 | P1: Five sounds | Design | Pending |
| TIM-18 | P1: Five sounds | Design | Pending |
| TIM-19 | P1: Five sounds | Design | Pending |
| TIM-20 | P1: Five sounds | Design | Pending |
| TIM-21 | P1: Five sounds | Design | Implementing |
| TIM-22 | P1: Five sounds | Design | Pending |
| TIM-23 | P1: Five sounds | Design | Pending |
| TIM-24 | P1: Orchestra bank build | Design | Implementing |
| TIM-25 | P1: Orchestra bank build | Design | Implementing |
| TIM-26 | P1: Download only what is chosen | Design | Pending |
| TIM-27 | P1: Download only what is chosen | Design | Pending |
| TIM-28 | P1: Download only what is chosen | Design | Pending |
| TIM-29 | P1: Download only what is chosen | Design | Pending |
| TIM-30 | P1: Download only what is chosen | Design | Pending |
| TIM-31 | P1: Download only what is chosen | Design | Pending |
| TIM-32 | P1: Download only what is chosen | Design | Pending |
| TIM-33 | P1: Download only what is chosen | Design | Pending |
| TIM-34 | P1: Download only what is chosen | Design | Pending |
| TIM-35 | P1: Download only what is chosen | Design | Pending |
| TIM-36 | P1: Download only what is chosen | Design | Implementing |
| TIM-37 | P1: Approval by ear | Design | Pending |
| TIM-38 | P1: Approval by ear | Design | Pending |
| TIM-39 | P1: Approval by ear | Design | Pending |
| TIM-40 | P3: Credit | Design | Pending |
| TIM-41 | P3: Credit | Design | Pending |
| TIM-42 | Edge Cases | Design | Pending |
| TIM-43 | Edge Cases | Design | Pending |
| TIM-44 | Edge Cases | Design | Pending |
| TIM-45 | Edge Cases | Design | Pending |

**Coverage:** 45 total, 0 mapped to tasks, 45 unmapped until Tasks.

---

## Sources

- `.specs/features/pad-timbres/context.md` - the user's answers to Q16 to Q24.
- `.specs/features/chord-pads/spec.md` - the fades, limits and rules every timbre keeps.
- https://freepats.zenvoid.org/Synthesizer/synth-pad.html - Synth Pad Choir and Sweep Pad, CC0.
- https://www.github.com/sgossner/VSCO-2-CE - VSCO 2 Community Edition, whose LICENSE is CC0 1.0.

---

## Success Criteria

- [ ] The user approves Choir, Orchestra and Sweep by ear in the running app (TIM-37).
- [ ] A first visit fetches no more than the Choir files.
- [ ] Every `chord-pads` check still passes, or is changed only where Q22 and Q23 supersede it.
