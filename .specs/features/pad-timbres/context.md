# Pad Timbres Context

**Gathered:** 2026-11-02
**Spec:** `.specs/features/pad-timbres/spec.md` (not written yet)
**Status:** In discussion. Starts after `chord-pads` closes, on top of its branch (Q19)

---

## Feature Boundary

A select on the `Improv` screen chooses the timbre of the pad. User: "Talvez ate um select pra escolher".

---

## Implementation Decisions

### Timbres (Q16, Q17, Q21)

- New Age, Choir, Orchestra, Sweep and Analog. Choir is the user's favourite: "o que mais gostei foi esse timbre-synth-pad-choir-Cmaj9".
- Orchestra uses real string sections from VSCO 2 Community Edition, CC0. User: "se tiver string tipo orquestra ou quarteto de cordas ia ficar mais legal". A real quartet is not possible: the free set has no solo viola or solo cello.
- Each timbre has its own mix of samples and synth, set by ear. User on Q17: "resto recomendacoes".
- The first Orchestra demo lacked bass. User on Q21: "faltou mais graves".
- The second demo adds cello an octave down and solo contrabass in two octaves. User on Q24: "q24 sim, gostei". It carries no synth layer.

### Select (Q18)

- It sits on `Improv`. Changing timbre with a chord sounding crossfades over 1.5 s, and the choice is remembered across sessions. User: "resto recomendacoes".
- A timbre downloads the first time it is chosen, and the synth holds the sound until then. A failed timbre shows the existing notice.

### Size (Q22)

- `public/pads/` may take up to 12 MB, up from 10 MB in `chord-pads`. User: "q22 recomendacao".

### Default (Q23)

- Choir, with the synth over it as in the chosen demo, is the sound of a first visit. User: "q23 recomendacao".

---

## Specific References

- Demos in the session scratchpad: `timbre-synth-pad-choir-Cmaj9.wav`, `timbre-orquestra-graves-Cmaj9.wav`, the approved one.
- Measured for MIDI 45 to 70: `synth-pad-choir` 2.8 MB, `sweep-pad` 1.9 MB. VSCO sustain samples have no loop points, so a build script must make them.

---

## Deferred Ideas

None yet.
