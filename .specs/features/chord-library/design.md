# Chord Library Design

**Spec**: `.specs/features/chord-library/spec.md`
**Status**: Approved with the tasks

---

## Architecture Overview

A chord stays a `ChordId` of root and type, and the pad keeps its rules: `nextChord`, `settleChord` and `play` do not change. Two things are new. `CHORD_TYPES` grows to 34 entries, each with its family. The screen holds a selection, and pure rules in `src/chords.ts` turn a click on a root or type into the `ChordId` that `pressChord` already takes.

| Approach | Verdict |
| -------- | ------- |
| Pure rules `chordOfRoot` and `chordOfType` over a selected `ChordId` | Chosen: every rule of what a click means stays under `vitest` |
| Selection as two variables in `main.ts` | Rejected: the rule of CHD-19 to CHD-23 would run where only the DOM tests reach |

**Measured before designing**

- All 34 types fit in 5 notes, so `MAX_NOTES` stays 7 and the engine does not change.
- The highest note is 77, on `Ab13`: 56 + 21. Orchestra's top key is 71, whose reach ends at 73.
- One file at key 75 covers 73 to 77 within the 2 semitones of `OWN_FILE_SEMITONES`. VSCO's `VlnEns_susVib_E4_v1.wav` is MIDI 76, one semitone from that key.
- An Orchestra file weighs about 0.2 MB, and `public/pads/` holds 10.9 MB of its 12 MB.

---

## Components

### Chord data

- `src/chords.ts`: `CHORD_TYPES` entries add `family`, and they follow the spec's table. `CHORD_FAMILIES` lists the headings in order.
- `chordOfRoot(selected, root)` keeps the type, and `chordOfType(selected, type)` keeps the root.
- `ORCHESTRA_FILES` gains key 75, `/pads/orchestra/Ds5.flac`. New Age and Sweep gain key 76, each `E5.flac`.

### Orchestra bank

- `scripts/build_orchestra_bank.py`: `BANK` gains `75: ((VIOLIN, 'E4', 76, 0),)`.
- `public/kit/LICENSE.md` lists the file. VSCO is downloaded into the scratchpad, as in `pad-timbres` T4.

### Selector

- `index.html`: the `chord-scroller` table gives way to a list of roots and a list of families.
- `src/main.ts`: `selectedChord` starts at C major. A click runs `pressChord(chordOfRoot(selectedChord, root))`, or `chordOfType`. `renderImprov` marks each button by `data-state`: `sounding`, `selected` or none, and sets `aria-pressed` on the sounding pair.
- `src/index.css`: per `.stitch/DESIGN.md`. Below 768 px the roots are sticky.

---

## Tests

- `all_chords` in `src/pad.rs` lists the 34 types, so TIM-16, TIM-18, TIM-19, TIM-20 and PAD-14 run over the 408 chords. Those tests take about twice as long.
- `chordButton` in `src/index.test.ts` gives way to `pressChord(name)`, which clicks the type, then the root. The `chord-pads` tests keep their rule, and AD-023 explains the change of gesture.
- `pad_01` and `pad_31` move to 408 chords and to the selector, as CHD-01 and AD-023 supersede them.

## Risks

| Risk | Where | Effect | Answer |
| ---- | ----- | ------ | ------ |
| Five close notes up high read louder or softer | `src/pad.rs` | TIM-18 and TIM-19 fail on 408 chords | Adjust `MIXES`, then the user's ear decides |
| A `chord-pads` test depends on a silent move between chords | `src/index.test.ts` | The new helper sends an extra chord | Tests read the last chord sent, as PAD-10 settles it |
