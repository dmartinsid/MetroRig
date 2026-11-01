# House Kit Context

**Gathered:** 2026-11-01
**Spec:** `.specs/features/house-kit/spec.md`
**Status:** Discussing

---

## Feature Boundary

Replace the drum pieces The House Kit by Better Mixes covers with its recordings, so MetroRig sounds like a real kit. Source: `/home/deivid/Downloads/The House Kit/WAV`.

---

## Implementation Decisions

### License and credit

- Q1: use the kit. User: "vamos usar, no video o rapaz liberou pra uso geral, agradecer a ele e ao canal dele pelo sons."
- The written terms were not found: neither the zip nor the product pages state any, and the video's transcript could not be read. The release for general use is the user's account of the video.

### Pieces

- Q2: replace every piece the kit covers, each subject to the user's ear. User: "isso trocamos o que tem disponivel". Hi-hat and cymbals stay, since the kit has none.

### Toms

- Q3: all 4 toms, 13 tracks. User: "vamos pra 13 trilhas". This overrides the recommendation to keep 2.

### Dynamics

- Q4: a different recording per dynamic and alternating takes: 3 dynamics × 3 takes, 10 MB limit kept. User: "recomendacao".

### Mic

- Q5: the `Blend` versions. `Close` is tried at the ear approval if the kick blurs at high tempo. User: "recomendacao".

### Round 2, all answered "recomendacoes"

- Q6: keep 3 dynamics × 3 takes and raise the kit limit to 20 MB.
- Q7: Kick and toms use `Soft`, `Med`, `Hard`; Snare uses `Soft`, `Hard`, `Crack`, for Ghost, Normal, Accent.
- Q8: the new pieces play their recorded dynamics with no step gain on top. Each piece has one fixed trim, set by ear. Hi-hat and cymbals stay as they are.
- Q9: grid order `High Tom` (10"), `Mid Tom` (12"), `Low Tom` (14"), `Floor Tom` (16"). Saved presets keep their hits. Mid and Low join `SNARE/TOMS`. MIDI 50 High, 47 and 48 Mid, 45 Low, 41 and 43 Floor.
- Q10: credit in `LICENSE.md`, the README and an app footer line linking to the channel: `Kick, snare and toms: The House Kit by Better Mixes — thanks!`.
- Stated defaults, accepted: takes rotate in a fixed order and restart at Play; a new hit on a track fades the previous one briefly; files are 44.1 kHz, 16-bit, stereo, tails cut at -60 dB, with no per-take normalization.

### Layers, after the first listen

- Q11: "Vamos somar os sons diferentes, acho que vai ser uma boa. gere sim". The user accepted a test version on branch `house-kit-layer`. This reopens Q5 for Kick and Snare until the user hears it; `house-kit` keeps `Blend` alone.
- The offer named `Blend` + `Close` on both. Measuring changed the Kick: its `Close` is the `Blend` take again (correlation 0.97 to 0.99, same level), so adding it would only double the sound.
- Test recipe. Kick: `Blend` + `Close` above 2 kHz + `Room` at half level. Snare: `Blend` + `Close`, lined up per take, + `Room` at half level. One gain per piece: Kick -2.3 dB, Snare -4.8 dB. Kick trim 0.85, to match the current Kick's average level.

---

## Measured facts

- Q4's estimate assumed 2 toms. With 4 toms, 3 dynamics × 3 takes is 54 files and 14.6 MB at 44.1 kHz, 16-bit, stereo, tails cut at -60 dB. The kit's other samples add about 2 MB, so the total is about 16.6 MB, over the 10 MB limit. 3 × 2 is 9.8 MB, about 11.8 MB in total.
- Mean take levels (RMS over the sounding part). Snare: Soft -28.6, Hard -22.8, Crack -23.2 dB. Kick: Soft -18.7, Med -17.2, Hard -16.9 dB. Toms: Soft to Hard differ by about 2 to 3 dB. Hard takes peak at 0 dBFS.
- Only 3 of the 14 song tabs use toms: Highway to Hell and Crossroads on MIDI note 41, Battery on note 45.
- The credit's channel is https://www.youtube.com/@BetterMixes. Its host's name was not found.
