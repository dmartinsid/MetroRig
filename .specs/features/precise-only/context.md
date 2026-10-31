# Precise-Only Metronome Context

**Gathered:** 2026-10-31
**Spec:** `.specs/features/precise-only/spec.md` (not written yet)
**Status:** Discussion closed - spec awaiting approval

---

## Feature Boundary

MetroRig plays only exact time. The swing mode goes away, and what the musician hears and sees matches the displayed tempo.

Request: "O metronomo esta preciso? Vamos usar o skill grilling e o tlc-spec-driven pra deixar ele somente preciso, o modo de tocar nao tao certo nao faz mais sentido"

---

## Implementation Decisions

Round 1: the user accepted every recommendation with "Recomendacoes".

### Swing

- "Modo não tão certo" means the Swing / Shuffle slider.
- Remove the slider, the engine and worklet code, and the `swing` preset field.
- Saved presets with swing play straight.
- The "Measure & Swing" card becomes "Measure".
- The Blues Shuffle and Jazz Swing presets keep their names.

### Definition of precise

- Every hit lands within 1 sample of the ideal grid, with no accumulated drift over 1 hour.
- An automated `cargo test` proves it across several BPMs, including BPMs with a non-integer number of samples per beat.
- Device output latency is out of scope: it is constant and outside the app.

### Sound onset

- Every click sound starts exactly on the beat.
- Leading silence is cut when a sample loads, so a re-downloaded WAV cannot bring the delay back.

### BPM meaning

- BPM is always the quarter note, in every meter.
- The 12/8 presets become 24 steps with a click every 6 steps.
- Blues Shuffle becomes 135 BPM (pulse of 90). Jazz Swing becomes 195 BPM (pulse of 130).

### Trainer

- Playback starts at Start BPM.
- A stepped change lands exactly on beat 1.
- Editing the trainer during playback does not reset the BPM. The change applies from the next beat 1.

### Click reverb

- Remove the click reverb entirely.

### Visual sync

- Delay animations by the output latency the browser reports.
- This is visual only and best effort, because some browsers and Bluetooth devices report it inaccurately.

### Stop and play

- Stop cuts the sound immediately.
- The next Play starts clean, with the first hit on beat 1.

### Trainer details

Round 2: the user accepted every recommendation with "REcomendacoes, pode escrever as specs".

- Stepped by seconds: the increment waits for the first beat 1 after the seconds elapse, so an interval can run up to a bar longer.
- Smooth stays continuous and does not wait for beat 1.
- During playback, Start BPM applies at the next Play. Target, Increment, interval and curve apply from the next beat 1.
- Disabling the Trainer holds the live BPM until Stop.
- The BPM slider changes the live BPM immediately, and the Trainer continues from it. The next Play returns to Start BPM.
- The Editor shows the live BPM during a Trainer run and the preset BPM after Stop.

### Saved 12/8 presets

- User presets with 12/8 and 12 steps convert on load to 24 steps and `bpm * 1.5`, limited to 240.

### Technical defaults

The user accepted these defaults with round 2:

- The silence trim applies to all samples, at 1% of peak.
- Unknown latency gives no visual delay.
- Factory grooves Blues Shuffle and Jazz Swing become 24 steps.
- Per-tick logs, per-message logs and repeated per-block views are removed.
- `public/pkg/metrorig_audio_bg.wasm` is rebuilt.
- Work happens on a feature branch, `.specs/` is tracked, and existing deletions and tool folders stay out of commits.

### Agent's Discretion

None - remaining defaults are listed in the spec's Assumptions table.

### Declined / Undiscussed Gray Areas → Assumptions

None yet.

---

## Specific References

Measured on 2026-10-31 with a black-box harness over the FFI exports:

- Constant tempo, 1 simulated hour at 40, 97, 120, 133, 187 and 240 BPM: maximum error 1 sample (22.7 µs), no accumulated drift.
- `public/woodblock.wav`: first sound at 122.47 ms.
- Trainer at 120 to 125 BPM every bar: the interval into the downbeat is already 5292 samples (new tempo).
- BPM 100 with Start BPM 80: the first interval is 6615 samples (100 BPM).

---

## Deferred Ideas

None - discussion stayed within feature scope.
