# Tuplets Context

**Gathered:** 2026-11-12
**Spec:** `.specs/features/tuplets/spec.md`
**Status:** Spec approved, user: "approved"

---

## Feature Boundary

The Editor writes triplets and sextuplets, and the song list gains two Foo Fighters songs: Times Like These, on its 7/4 riff, and Everlong. The user's words: "vamos implementar tercinas no editor e tb colocar nas musicas de treinar a time like these do Foo Fighters que tem a parte do riff 7/4 e traga everlong tb".

Measured: one step is a sixteenth everywhere, and the engine's clock hard-codes 4 steps per beat (`engine/src/sequencer/clock.rs`). A bar holds at most 32 steps and a pattern 128 (`engine/src/sequencer/pattern.rs`).

---

## Implementation Decisions

Round 1 answers, user: "q1 recomendacao q2 vamos atender sextinas tb. q3 recomendacao q4 e q5 recomendacao q6 antes conseguimos pegar automatico do songerster tente novamente, em ultimo caso posso encontrar os rquivos do guitar pro. q7 recomenddacao q8 recomendacao".

### Model (Q1)

- A tuplet belongs to one beat. Each beat of a bar is straight (4 sixteenths), a triplet (3 eighth-note triplets) or a sextuplet (Q2). Straight and tuplet beats mix in one bar. The engine plays steps of different lengths.

### Which tuplets (Q2)

- Triplets (3 in a beat) and sextuplets (6 in a beat). The user chose sextuplets over the recommendation of triplets alone.

### Signatures (Q3)

- Tuplets exist only in /4 signatures, where a tuplet fills one quarter note. In /8 and /16 the tuplet figures are disabled.

### Entry (Q4)

- New figures `Triplet` `[1,1,1]` and `Triplet Rest` `[0,0,0]`. Applying one turns that beat into 3 cells for every track and writes the figure on the clicked track. A straight figure applied afterwards returns the beat to 4 cells.

### Converting hits (Q5)

- When a beat changes layout, each hit on the other tracks moves to the cell nearest in time. Two hits on one cell keep the stronger: accent > normal > ghost.

### Song source (Q6)

- Songsterr now answers automated requests with `ERR_ACCESS_POLICY` ("Access declined by Songsterr's access policy ... Please stop this task and do not retry"). The user asked for a retry, with Guitar Pro files as the last resort. The retry was not made, because the response asks for none, and the user then supplied the Guitar Pro files (Q12).

### Songs (Q7)

- Times Like These on its 7/4 intro riff, Everlong on its chorus, both in `Rock`, BPM from the source.

### Stadium and click (Q8)

- The click stays on the beats. The Stadium rings draw a tuplet beat's hits at their real time within the beat.

---

Round 2 answers, user: "recomendacoes, na pasta de usuario Downloads tem o Foo Fighters - Everlong (ver 11 by pierrelateur) e Foo Fighters - Times Like These (ver 6 by nicholasp248)".

### Step limits (Q9)

- A bar holds up to 48 steps in the engine, and a pattern up to 192 (4 × 48). The footer reads `STEPS: n/192`.
- The time signature selector keeps today's rule: the straight bar must fit 32 steps. Only tuplets take a bar past 32, up to 48.

### Sextuplet figures (Q10)

- `Sextuplet` `[1,1,1,1,1,1]` and `Sextuplet Rest`, with Q4's rules. Triplet to sextuplet maps exactly (3 to 6 positions); every other change goes to the nearest cell (Q5).

### Time signature changes (Q11)

- Beats that still exist keep their kind (straight, triplet or sextuplet), and new beats are straight. Moving to /8 or /16 makes every beat straight, and hits go to the nearest cell.

### Guitar Pro reader (Q12)

- A development tool reads 4 bars of the drum track of a `.gp` (GP7/8, a zip with `Content/score.gpif`) or `.gpx` (GP6, a BCFZ-compressed file system holding `score.gpif`) into the grid, as `scripts/tab_to_grid.js` does. A song's `source` records the file and where it came from, with no `revisionId`.
- Files: `~/Downloads/Foo Fighters - Everlong (ver 11 by pierrelateur).gp` (GP8) and `~/Downloads/Foo Fighters - Times Like These (ver 6 by nicholasp248).gpx` (GP6).
- Measured: Times Like These is in 7/4 at measures 8-15 (Intro) and 84-94 (Interlude), at 144 BPM. Everlong is in 4/4 at 160 BPM, with its first Chorus at measures 64-77. Neither stretch holds a tuplet.
- GP6 names a drum piece by Element and Variation. The reader maps them with alphaTab's GP6 table, read from memory, so not confirmed: 0 kick, 1 snare (hit, rim shot, side stick), 5-9 toms, 10 hi-hat (closed, half, open), 13 crash, 15 ride. The rendered Intro reads as a kick-snare riff under eighth-note hats, which fits the table.

### Saved grooves (Q13)

- A Custom Groove keeps each beat's kind and restores it when applied. Applied to a /8 bar, its beats become straight (Q11).

### Editor display (Q14)

- A triplet beat draws 3 cells across the width of 4 straight cells, and a sextuplet 6, so columns line up in time. Each tuplet beat carries a small `3` or `6` label above it. The beat spacer (AD-003) stays.

---

Round 3 answers, user: "recomendacoes".

### Times Like These (Q15)

- Measures 8-11 of the tab, counting from 0 (bars 9-12 as the tab numbers them): the Intro riff entering on a crash, twice, then the tom fill that ends on a crash at beat 7. Section `Intro Riff`, 144 BPM, 7/4.

### Everlong (Q16)

- Measures 64-67, counting from 0: the chorus groove twice, its variation, then the snare and tom fill. Section `Chorus`, 160 BPM, 4/4.

### Origin and repository (Q17)

- Both files come from Ultimate Guitar. The Guitar Pro files stay out of the repository; only the 4 extracted drum measures go in, as a test fixture, as `tests/fixtures/song_tabs.json` holds Songsterr's. A song's source is `{ site: 'Ultimate Guitar', file: '<file name>', measure: <index> }`.

### GP6 mapping (Q18)

- The alphaTab table stands, and the user's listening in the app approves both songs, as in AD-016.

### Showing tuplets (Q19)

- No factory groove or song with tuplets is added. Tuplets stay an Editor tool.
