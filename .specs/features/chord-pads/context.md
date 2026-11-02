# Chord Pads Context

**Gathered:** 2026-11-01
**Spec:** `.specs/features/chord-pads/spec.md`
**Status:** Spec approved; ready for design

---

## Feature Boundary

The user picks one chord and it sounds as a sustained pad, so they can improvise over it. User: "pra agora eh so foco de improvisar sobre um acorde especifico mesmo".

---

## Implementation Decisions

### Sound (Q1)

- Demos 2 (FreePats New Age with chorus and reverb) and 3 (Rust supersaw) both pleased the user. User: "eu gostei muito do 2 e 3, acho que pode ser, ate somar eles tb."
- The layered sum is the candidate timbre, pending the user's ear on demo 4.
- Chords are built from note samples at run time, because 120 pre-rendered chords would take about 170 MB.

### Timbres (Q2)

- One timbre in the first version, with the design ready for more. User: "q2 recomendacao".

### Chords (Q3)

- 12 roots × 14 types, in Brazilian notation. User: "q3 recomendacao".
- Roots: `C C# D Eb E F F# G Ab A Bb B`.
- Types: major, `m`, `7`, `7M`, `m7`, `sus4`, `sus2`, `add9`, `9`, `m9`, `7M(9)`, `6`, `dim`, `aug`.

### Where it lives (Q4)

- A new screen with its own link in the header. User: "um menu novo algo relacionado a improvisar em cima dos acordes, ou pode ser pad se nao chegarmos em um nome melhor".
- The link is `Improv` and the screen title `Improv · Chord Pads` (Q9).
- The picker is a grid of all 168 chords, scrolling sideways below 768 px with the roots in view (Q10).
- The screen shows the sounding chord and its notes, such as `C7M(9) · C E G B D` (Q11).
- A lit dot on the `Improv` link shows the pad sounding on another screen; stopping happens on `Improv` (Q14).
- Q8 to Q15, and the stated defaults, user: "recomendacoes".

### Playing (Q5)

- One click starts a chord and it holds. Another chord crossfades over about 1.5 s. Clicking the same chord stops it. One chord at a time. User: "q5 recomendacao".

### Metronome (Q6)

- The pad is independent of Play, sounds with or without the drums, keeps sounding across screens, and changes chord at once, not on the bar. User: "q6 recomendacao".

### Voicing, volume and loading (Q12, Q13, Q15)

- Roots sit from A2 to G#3 with the other notes stacked above; no octave control.
- One pad volume, remembered across sessions, at a default that leaves the drums in place; the chord is never remembered.
- Samples load on the first visit to `Improv`. The synth covers loading and failure, with a discreet notice.
- User: "recomendacoes".

---

## Specific References

- Listening demos, in the session scratchpad: `2-newage-com-chorus-reverb-Cmaj9.wav`, `3-synth-rust-supersaw-Cmaj9.wav`, `4-soma-newage-e-synth-Cmaj9.wav`.
- FreePats New Age: https://github.com/freepats/new-age, CC0, 16 notes, MIDI 34 to 98, 4.5 MB of FLAC, with loop points.

---

## Deferred Ideas

User on Q7: "sim, pra agora eh so foco de improvisar sobre um acorde especifico mesmo".

- Automatic chord progressions
- MIDI controllers and computer-keyboard shortcuts
- Saving pads in presets
- More timbres, with a select to choose them. User: "Talvez ate um select pra escolher" and "Se tiver algo como strings tb acho que fica interessante". CC0 candidates measured for MIDI 45 to 70: `synth-strings-1` 2.2 MB, `synth-strings-2` 2.2 MB, `synth-pad-choir` 2.8 MB, `sweep-pad` 1.9 MB, `synth-crystal` 1.2 MB, `synth-pad-bowed` 6.3 MB.
