# Grooves Library Context

**Gathered:** 2026-11-01
**Spec:** `.specs/features/grooves-library/spec.md` (not written yet)
**Status:** Grilling in progress

---

## Feature Boundary

Header links `Editor`, `Stadium` and `Grooves` that work, a Grooves screen with transcribed drum parts of famous songs by genre, and the expanded drum kit with dynamics those parts need.

---

## Implementation Decisions

Round 1. Answers quoted from the user: "q1 recomendacao q2 recomendacao q3 recomendacao q4 vamos adicionar as outras pecas da bateria e ja vamos colocar eles no metrorig q5 pode colocar dinamica e kit expandido q6 recomendacao q7 pra metallica adicione batterry, pra bullet adicione dont need you, de resto ta otimo as sugestoes q8 recomendacao q9 recomendacao".

### Navigation (Q1, Q2)

- `Grooves` opens a third screen beside Editor and Stadium.
- The header carries the links `Editor`, `Stadium` and `Grooves`. `Presets` stays out.
- `GO TO STADIUM MODE` is removed. This supersedes part of AD-001 and departs from the captures.

### What a real drum part is (Q3, Q6, Q8)

- Each song is a transcription on the step grid, played by MetroRig's samples. No audio from recordings.
- Each entry holds 1 bar. A section that deserves it becomes another entry, such as `Verse` and `Chorus`.
- An entry needs a transcription and a BPM from a published source, cited in the data. No source, no entry.
- The user approves each groove by ear before the feature closes, because the agent cannot hear the recordings.

### Kit and dynamics (Q4, Q5)

- The other drum pieces are added to MetroRig in this feature, not a later one.
- Dynamics are added in this feature.

### Repertoire (Q7)

| Genre | Artist | Songs |
| --- | --- | --- |
| Rock | AC/DC | Back in Black, Highway to Hell |
| Metal | Iron Maiden | The Trooper, Run to the Hills |
| Metal | Metallica | Enter Sandman, Master of Puppets, Battery |
| Metalcore | Bullet for My Valentine | Tears Don't Fall, Scream Aim Fire, Don't Need You |
| Blues | Eric Clapton | Cocaine, Crossroads |
| Blues | B.B. King | The Thrill Is Gone, Every Day I Have the Blues |

### Loading a song (Q9)

- Loading a song replaces BPM, time signature and drum tracks, and turns the Trainer off.
- The Grooves screen shows the BPM. This is an exception to AD-004 for songs.
- The `Click` track keeps marking the beats of the bar.
- The `Groove Library` dropdown stays as it is.

---

## Round 2

Answers quoted from the user: "q10 coloca o china e sino sim. q11 recomendacao q12 recomendacao q13 recomendacao q14 recomendacao q15 recomendacao, pode ser os grupos senao nao vai caber. q16 recomendacao q17 recomendacao q18 recomendacao".

### Kit (Q10 to Q13)

- MetroRig has 11 tracks: `Click`, `Kick`, `Snare`, `Hi-hat`, `Open Hat`, `Ride`, `Ride Bell`, `Crash`, `China`, `High Tom`, `Floor Tom`.
- Every drum piece, the current kick, snare and hi-hat included, comes from one acoustic kit that is public domain or CC0. SM Drums first; the Open Source Drumkit if its license does not hold.
- Each piece has 1 sample, played at 3 volumes: `ghost`, `normal`, `accent`.
- Clicking a drum cell cycles `empty → normal → accent → ghost → empty`. `Click` keeps normal and accent only. A cell shows `●` for normal, `▲` for accent and a smaller dot for ghost.

### Existing screens (Q14, Q15)

- The Editor grid and the Mute/Solo cards always show every track, with lower rows. This departs from `editor.png`.
- The Stadium keeps 4 rings and 4 orbs, grouped as `CLICK`, `KICK`, `SNARE/TOMS` and `CYMBALS`. Mute and Solo per piece stay in the Editor.

### Grooves screen (Q16, Q17)

- Tabs `Todos`, `Rock`, `Metal`, `Metalcore`, `Blues`, and cards with song, artist, section, BPM and time signature.
- `▶` on a card loads the song and plays it without leaving the screen.
- `Abrir no Editor` loads the song and opens the Editor.
- With unsaved edits, both ask for confirmation before replacing them.

### Transcriptions (Q18)

- Songsterr drum tabs are the source. Each song stores the link and the revision.
- The agent picks the main bar and takes the BPM from the tab.
- `Crossroads` is the live Cream version with Ginger Baker, shown as `Cream (Eric Clapton)`.
- `Every Day I Have the Blues` uses the Cook County recording, once its tab is confirmed to carry drums.

### Stated defaults, not corrected by the user

- The links stay visible at every width.
- The last screen opened returns on reload.
- Saved presets and grooves keep working, with the new tracks empty.
- A loaded song appears in a `Songs` group of the preset selector, and can be edited and saved as a user preset.

---

## Round 3

Answer quoted from the user: "recomendacoes". It accepts Q19 to Q21.

- Q19: SM Drums if its bundled terms allow redistribution. Otherwise the Open Source Drumkit plus one CC0 China hit.
- Q20: the labels are `All` and `Open in Editor`.
- Q21: `ghost` 0.3, `normal` 0.7, `accent` 1.0, adjusted by ear.

---

## Deferred Ideas

- The `Presets` header link.
- Whole-song arrangements and drum fills.
