# Chord Library Specification

**Approved**: 2026-11-02 - user: "Aprovado"

## Problem Statement

The Improv pad offers 14 chord types, with no 11th, no half-diminished and no altered dominant. The user wants the list "super completa". At 34 types a grid of one button per chord would hold 408 buttons, so the way to pick a chord changes with it.

## Goals

- [ ] Any of 408 chords (12 roots × 34 types) can be played on `Improv`.
- [ ] Choosing a chord reads at a glance: one row of roots, and types grouped by family.
- [ ] Every timbre keeps its pitch, level and peak rules on the new chords.
- [ ] The user approves the new chords and the selector in the running app.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Chords over another bass, such as `C/E` | Not requested, and they are not 12 × 34 |
| Inversions and an octave control | Deferred in `chord-pads` |
| Typing or searching a chord name | Not requested |
| Favourites and saved progressions | Deferred in `chord-pads` |
| Remembering the selected root and type across sessions | PAD-45 opens with no chord, and nothing asks to keep one |
| Chords of more than 5 notes | Every type is voiced in 5 notes or fewer, so the engine limit stays |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | --------------- | --------- | ---------- |
| Chord list | 34 types, the 14 of `chord-pads` and 20 new | User chose "Completa: 34 tipos" | y |
| Selector | One row of roots and types grouped by family; a click on either plays | User chose "Tônica + tipo"; AD-023 | y |
| Voicing of 11ths and 13ths | `11` omits the 3rd, `m11` the 5th, `13` and `m13` the 5th and 11th | Shown with the chosen list | y |
| Voicing of `7(#11)` and `7M(#11)` | Omit the 5th | Keeps them in 5 notes, as `13` does | y, presented with the spec, user: "Aprovado" |
| Voicing of `7(b13)` | Keeps the 5th and omits the 9th | Its colour is the 5th against the b13 | y, presented with the spec, user: "Aprovado" |
| Screen language | Family names in English: `Triads`, `Sevenths`, `Ninths`, `Elevenths`, `Thirteenths`, `Altered` | The whole app is in English | y, presented with the spec, user: "Aprovado" |
| Major's button | Labelled `maj`; the chord's name stays `C` | As in the chosen selector | y |
| Selection on opening | `C` and `maj` selected, nothing sounding | One root and one type must be selected for a single click to play | y, presented with the spec, user: "Aprovado" |
| Delivery | On `feat/pad-timbres`, as the last part of the pad | User: "pra finalizar a feature do pad" | y, presented with the spec, user: "Aprovado" |
| Size | `public/pads/` stays at most 12 MB | AD-019, and it holds 10.9 MB | y |
| Note 71 past the reverb | 7 cents, on that note alone, as CHD-37 and AD-024 set | It leaves the voice within 1 cent, its harmonics sit on the reverb's combs, and TIM-10 keeps that reverb | y, AD-024 |
| Auth, rate limits, external dependencies, concurrency, data expiry | N/A because the chords are static data and the rules of `chord-pads` keep applying | Sweep | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: A complete chord list ⭐ MVP

**User Story**: As a musician, I want every common chord so that I can follow any song.

**Why P1**: This is the request.

**Acceptance Criteria**:

1. CHD-01: The app SHALL offer 408 chords, from the roots `C C# D Eb E F F# G Ab A Bb B` and the 34 types of the table below.
2. CHD-02: The app SHALL build each type from the semitones of the table below.
3. CHD-03: The app SHALL play each root at the MIDI note of PAD-03, with every other note at the root plus its semitones.
4. CHD-04: The app SHALL spell a chord's notes by the degrees of the table below, as AD-018 sets: `C11` shows `C G Bb D F`, `C7(b13)` shows `C E G Bb Ab`, and `Cdim7` shows `C Eb Gb A`.
5. CHD-05: The 14 types of `chord-pads` SHALL keep their names, notes and spelling.

| Family | Suffix | Semitones | Degrees |
| ------ | ------ | --------- | ------- |
| Triads | (major) | 0 4 7 | 1 3 5 |
| Triads | `m` | 0 3 7 | 1 3 5 |
| Triads | `dim` | 0 3 6 | 1 3 5 |
| Triads | `aug` | 0 4 8 | 1 3 5 |
| Triads | `sus2` | 0 2 7 | 1 2 5 |
| Triads | `sus4` | 0 5 7 | 1 4 5 |
| Sevenths | `6` | 0 4 7 9 | 1 3 5 6 |
| Sevenths | `m6` | 0 3 7 9 | 1 3 5 6 |
| Sevenths | `7` | 0 4 7 10 | 1 3 5 7 |
| Sevenths | `7M` | 0 4 7 11 | 1 3 5 7 |
| Sevenths | `m7` | 0 3 7 10 | 1 3 5 7 |
| Sevenths | `m7M` | 0 3 7 11 | 1 3 5 7 |
| Sevenths | `m7(b5)` | 0 3 6 10 | 1 3 5 7 |
| Sevenths | `dim7` | 0 3 6 9 | 1 3 5 7 |
| Sevenths | `7sus4` | 0 5 7 10 | 1 4 5 7 |
| Ninths | `add9` | 0 4 7 14 | 1 3 5 9 |
| Ninths | `madd9` | 0 3 7 14 | 1 3 5 9 |
| Ninths | `9` | 0 4 7 10 14 | 1 3 5 7 9 |
| Ninths | `m9` | 0 3 7 10 14 | 1 3 5 7 9 |
| Ninths | `7M(9)` | 0 4 7 11 14 | 1 3 5 7 9 |
| Ninths | `9sus4` | 0 5 7 10 14 | 1 4 5 7 9 |
| Ninths | `6/9` | 0 4 7 9 14 | 1 3 5 6 9 |
| Elevenths | `add11` | 0 4 7 17 | 1 3 5 11 |
| Elevenths | `11` | 0 7 10 14 17 | 1 5 7 9 11 |
| Elevenths | `m11` | 0 3 10 14 17 | 1 3 7 9 11 |
| Elevenths | `7(#11)` | 0 4 10 14 18 | 1 3 7 9 11 |
| Elevenths | `7M(#11)` | 0 4 11 14 18 | 1 3 7 9 11 |
| Thirteenths | `13` | 0 4 10 14 21 | 1 3 7 9 13 |
| Thirteenths | `m13` | 0 3 10 14 21 | 1 3 7 9 13 |
| Altered | `7(b9)` | 0 4 7 10 13 | 1 3 5 7 9 |
| Altered | `7(#9)` | 0 4 7 10 15 | 1 3 5 7 9 |
| Altered | `7(#5)` | 0 4 8 10 | 1 3 5 7 |
| Altered | `7(b5)` | 0 4 6 10 | 1 3 5 7 |
| Altered | `7(b13)` | 0 4 7 10 20 | 1 3 5 7 13 |

**Independent Test**: Play `Am11`, `G7(b13)` and `Bm7(b5)`, and read their notes on the screen.

---

### P1: Every timbre plays every chord ⭐ MVP

**User Story**: As a musician, I want the new chords to sound as good as the old ones so that the list is usable in any timbre.

**Why P1**: The new chords reach MIDI 77, above the 70 the banks were built for.

**Acceptance Criteria**:

1. CHD-06: Each note of the 408 chords in `Orchestra` SHALL sound from a file within 2 semitones of it, once its bank has loaded.
2. CHD-07: Each note of `Choir`, `New Age`, `Sweep` and `Analog` up to MIDI 77 SHALL sound within 5 cents of equal temperament at A = 440 Hz.
3. CHD-08: The pitch centre of each `Orchestra` note up to MIDI 77 SHALL sit within 10 cents of equal temperament at A = 440 Hz.
4. CHD-09: Within a timbre, any two of the 408 chords SHALL sound within 3 dB RMS.
5. CHD-10: On each of the 408 chords, any two timbres SHALL sound within 3 dB RMS.
6. CHD-11: At the default volume, every timbre SHALL peak at or below -4 dBFS on the 408 chords.
7. CHD-12: All files in `public/pads/` together SHALL take at most 12 MB.
8. CHD-13: `public/kit/LICENSE.md` SHALL list each new file with its source and its CC0 dedication.
9. CHD-14: The engine SHALL allocate no memory on the audio thread while a chord of the 408 starts, changes or stops.

**Independent Test**: Hold `Ab13` in each timbre, and compare its level with `Ab`.

---

### P1: Choose by root and type ⭐ MVP

**User Story**: As a musician, I want to pick a root and a type so that I can find a chord among 408 at a glance.

**Why P1**: 408 buttons in a grid cannot be read. AD-023 records the choice.

**Acceptance Criteria**:

1. CHD-15: The `Improv` screen SHALL show one button per root, in the order of CHD-01.
2. CHD-16: The screen SHALL show the 34 types as buttons under the headings `Triads`, `Sevenths`, `Ninths`, `Elevenths`, `Thirteenths` and `Altered`, in that order.
3. CHD-17: The major type's button SHALL read `maj`, and every other type's button SHALL read its suffix.
4. CHD-18: WHEN the app opens THEN the screen SHALL select `C` and `maj`, and no chord SHALL sound.
5. CHD-19: WHEN a user clicks a root while no chord sounds THEN the pad SHALL play that root with the selected type.
6. CHD-20: WHEN a user clicks a type while no chord sounds THEN the pad SHALL play the selected root with that type.
7. CHD-21: WHEN a user clicks another root while a chord sounds THEN the pad SHALL crossfade to that root with the same type.
8. CHD-22: WHEN a user clicks another type while a chord sounds THEN the pad SHALL crossfade to the same root with that type.
9. CHD-23: WHEN a user clicks the root or the type of the sounding chord THEN the pad SHALL fade it out over 1.5 s.
10. CHD-24: WHILE a chord sounds the screen SHALL mark its root and its type as sounding, and show its name and notes as PAD-32 sets.
11. CHD-25: WHILE no chord sounds the screen SHALL mark the selected root and type as selected, in a style distinct from sounding.
12. CHD-26: WHEN a chord stops THEN its root and type SHALL stay selected.
13. CHD-27: WHEN a user reaches a root or type with the keyboard and presses Enter or Space THEN it SHALL act as a click.
14. CHD-28: WHILE the window is 1280 px wide every root and type SHALL be reachable with no sideways scroll.
15. CHD-29: WHILE the window is narrower than 768 px the page SHALL not scroll sideways, and the roots SHALL stay in view while the types scroll.
16. CHD-30: Every root and type button SHALL be at least 44 px tall while the window is narrower than 768 px.

**Independent Test**: At 1280 and 390 px, go from `Am7` to `Dm7`, then to `Dm9`, then stop, using one click each.

---

### P1: Approval in the running app ⭐ MVP

**User Story**: As the owner, I want to hear and use it so that the running app, not a table, is what I approve.

**Why P1**: The voicings and the screen are judged by ear and by eye.

**Acceptance Criteria**:

1. CHD-31: The feature SHALL not close until the user approves the new chords and the selector in the running app, and the approval SHALL be quoted in `verification.md`.
2. CHD-32: IF the user rejects a voicing or the selector THEN it SHALL be adjusted and offered again.

**Independent Test**: The user plays the new chords in each timbre, and answers.

---

## Edge Cases

- WHEN a user clicks several roots or types within 1.5 s THEN the pad SHALL settle on the last chord they make. (CHD-33)
- WHEN a user picks a timbre while a new chord sounds THEN the pad SHALL crossfade to that chord in the timbre, with its bass where the timbre adds one. (CHD-34)
- IF the browser has suspended audio THEN a click on a root or type SHALL resume it. (CHD-35)
- WHEN a chord is fading out and a user clicks a root or type THEN the pad SHALL treat it as no chord sounding, so CHD-19 and CHD-20 apply. (CHD-36)
- WHILE note 71 is measured past the reverb it SHALL sit within 7 cents of equal temperament, in place of CHD-07's 5 cents for that note and that measure alone; each note leaves the voice within CHD-07's 5 cents. (CHD-37)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CHD-01 | P1: A complete chord list | Tasks | Verified |
| CHD-02 | P1: A complete chord list | Tasks | Verified |
| CHD-03 | P1: A complete chord list | Tasks | Verified |
| CHD-04 | P1: A complete chord list | Tasks | Verified |
| CHD-05 | P1: A complete chord list | Tasks | Verified |
| CHD-06 | P1: Every timbre plays every chord | Tasks | Verified |
| CHD-07 | P1: Every timbre plays every chord | Tasks | Verified |
| CHD-08 | P1: Every timbre plays every chord | Tasks | Verified |
| CHD-09 | P1: Every timbre plays every chord | Tasks | Verified |
| CHD-10 | P1: Every timbre plays every chord | Tasks | Verified |
| CHD-11 | P1: Every timbre plays every chord | Tasks | Verified |
| CHD-12 | P1: Every timbre plays every chord | Tasks | Verified |
| CHD-13 | P1: Every timbre plays every chord | Tasks | Verified |
| CHD-14 | P1: Every timbre plays every chord | Tasks | Verified |
| CHD-15 | P1: Choose by root and type | Tasks | Verified |
| CHD-16 | P1: Choose by root and type | Tasks | Verified |
| CHD-17 | P1: Choose by root and type | Tasks | Verified |
| CHD-18 | P1: Choose by root and type | Tasks | Verified |
| CHD-19 | P1: Choose by root and type | Tasks | Verified |
| CHD-20 | P1: Choose by root and type | Tasks | Verified |
| CHD-21 | P1: Choose by root and type | Tasks | Verified |
| CHD-22 | P1: Choose by root and type | Tasks | Verified |
| CHD-23 | P1: Choose by root and type | Tasks | Verified |
| CHD-24 | P1: Choose by root and type | Tasks | Verified |
| CHD-25 | P1: Choose by root and type | Tasks | Verified |
| CHD-26 | P1: Choose by root and type | Tasks | Verified |
| CHD-27 | P1: Choose by root and type | Tasks | Verified |
| CHD-28 | P1: Choose by root and type | Tasks | Verified |
| CHD-29 | P1: Choose by root and type | Tasks | Verified |
| CHD-30 | P1: Choose by root and type | Tasks | Verified |
| CHD-31 | P1: Approval in the running app | Tasks | Verified |
| CHD-32 | P1: Approval in the running app | Tasks | Verified |
| CHD-33 | Edge Cases | Tasks | Verified |
| CHD-34 | Edge Cases | Tasks | Verified |
| CHD-35 | Edge Cases | Tasks | Verified |
| CHD-36 | Edge Cases | Tasks | Verified |
| CHD-37 | Edge Cases | Tasks | Verified |

**Coverage:** 37 total, all mapped to tasks. CHD-37 came from the Verifier's findings.

---

## Sources

- `.specs/features/chord-pads/spec.md` - the fades and limits every chord keeps.
- `.specs/features/pad-timbres/spec.md` - the rules each timbre keeps.
- `.stitch/DESIGN.md` - the design system of the selector.

---

## Success Criteria

- [ ] The user approves the new chords and the selector in the running app (CHD-31).
- [ ] From any sounding chord, a chord that shares its root or type is one click away.
- [ ] Every `chord-pads` and `pad-timbres` check still passes, or is changed only where this spec supersedes it.
