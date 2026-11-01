# House Kit Specification

**Approved**: 2026-11-01 - user: "aprovo"

## Problem Statement

Kick, snare and toms use one sample each, and a step's dynamic only changes its volume. Ghost notes sound like quiet copies of a loud hit, and repeated hits sound like a machine. The House Kit by Better Mixes has real recordings of these pieces at several dynamics, with several takes of each.

## Goals

- [ ] Kick, Snare and 4 toms play The House Kit, each dynamic with its own recording and alternating takes.
- [ ] MetroRig has 13 tracks, with 4 toms a user can write in the grid.
- [ ] The user approves each new piece by ear.
- [ ] Better Mixes is credited in the repository and in the app.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Hi-hat, Open Hat, Ride, Ride Bell, Crash, China | The House Kit has no such pieces |
| A control to choose mics or kits | Q5 settled on `Blend`; no such control was requested |
| Dynamics beyond Ghost, Normal and Accent | A step holds these 3 values |
| Letting a hit ring under the next hit of its track | The engine holds one voice per track; the fade covers the click, and more voices are a separate feature |
| The `.tci` trigger files | They serve a drum replacer, not this engine |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | --------------- | --------- | ---------- |
| License | Use the kit, and record the release as the user's account of the video | AD-013; user: "vamos usar, no video o rapaz liberou pra uso geral" | y |
| Tom layout | 13 tracks; 10" High Tom, 12" Mid Tom, 14" Low Tom, 16" Floor Tom | AD-012; user: "vamos pra 13 trilhas" | y |
| Dynamics and takes | 3 dynamics × 3 takes of each piece | Q4, user: "recomendacao"; size limit in AD-014 | y |
| Mic | `Blend` | Q5, user: "recomendacao" | y |
| Recording per dynamic | Kick and toms `Soft`, `Med`, `Hard`; Snare `Soft`, `Hard`, `Crack` | Q7, user: "recomendacoes" | y |
| Level of the new pieces | Recorded dynamics, one fixed trim per piece, no step gain | Q8, user: "recomendacoes" | y |
| Takes used | Files numbered 1, 2 and 3 of each recording | The kit does not rank its takes | y |
| Take order | 1, 2, 3, then 1 again, per track and dynamic, restarting at Play | Stated default, user: "recomendacoes" | y |
| Fade of a replaced hit | 5 ms | Stated as a brief fade, user: "recomendacoes"; 5 ms removes a click without audibly softening the hit | y |
| A piece the user rejects by ear | High Tom, Floor Tom, Kick and Snare go back to their earlier sample. Mid Tom and Low Tom have none, so the recording is retried with `Close` or another take | Q2 settled the first; the earlier kit has no Mid or Low Tom | y |
| A file that fails to load | The hit plays the next loaded take of its dynamic, then of the track; a track with none stays silent | Extends the existing rule: a failed sample leaves the rest of the kit playing | y |
| Input validation, auth and rate limits, data expiry, external dependencies | N/A because the samples are local static files and no input or account is involved | Sweep | y |
| Idempotency | N/A because loading a sample again replaces it, as today | Sweep | y |
| Concurrency | Covered by HK-05, HK-07 and the take rotation; takes are chosen on the audio thread | Sweep | y |
| Observability | A failed file logs its path to the console, as today | Sweep | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Real recordings at each dynamic ⭐ MVP

**User Story**: As a drummer practising with MetroRig, I want each dynamic to play its own recording so that the kit sounds like someone playing.

**Why P1**: This is the request.

**Acceptance Criteria**:

1. HK-01: The kit SHALL hold 3 takes of each of 3 dynamics from the `Blend` folder of The House Kit for Kick, Snare, High Tom (10"), Mid Tom (12"), Low Tom (14") and Floor Tom (16").
2. HK-02: WHEN a Kick or tom step plays THEN the engine SHALL play a `Soft` take for Ghost, a `Med` take for Normal and a `Hard` take for Accent.
3. HK-03: WHEN a Snare step plays THEN the engine SHALL play a `Soft` take for Ghost, a `Hard` take for Normal and a `Crack` take for Accent.
4. HK-04: WHEN a track plays the same dynamic again THEN the engine SHALL play that dynamic's next take in the order 1, 2, 3, 1.
5. HK-05: WHEN Play starts THEN the engine SHALL start every track and dynamic on take 1.
6. HK-06: The engine SHALL play the 6 new pieces at their recorded level times one fixed trim per piece, with no Ghost, Normal or Accent gain.
7. HK-07: WHEN a hit starts on a track that is still sounding THEN the engine SHALL fade the previous hit to silence over 5 ms.
8. HK-08: The engine SHALL keep playing Hi-hat, Open Hat, Ride, Ride Bell, Crash and China from one sample each, at gains 0.3, 0.7 and 1.0.
9. HK-09: The new samples SHALL be 44.1 kHz, 16-bit, stereo WAV files, cut where the sound stays under -60 dBFS.
10. HK-10: Within a piece, the samples SHALL keep the level differences of the recordings.
11. HK-11: All drum samples together SHALL take at most 20 MB.
12. HK-12: IF a take fails to load THEN the app SHALL log its path and the hit SHALL play the next loaded take of its dynamic.
13. HK-13: IF every take of a dynamic fails to load THEN the hit SHALL play the next loaded take of its track.
14. HK-14: IF every take of a track fails to load THEN that track SHALL stay silent while the other tracks play.

**Independent Test**: Load a groove with ghost, normal and accent snare hits, and hear three different recordings and no two identical hits in a row.

---

### P1: Four toms ⭐ MVP

**User Story**: As a drummer, I want all 4 toms in the grid so that I can write real fills.

**Why P1**: The user chose 13 tracks.

**Acceptance Criteria**:

1. HK-15: The app SHALL list 13 tracks in the order Click, Kick, Snare, Hi-hat, Open Hat, Ride, Ride Bell, Crash, China, High Tom, Mid Tom, Low Tom, Floor Tom.
2. HK-16: The track ids in use before this feature SHALL keep their meaning, with Mid Tom as id 11 and Low Tom as id 12.
3. HK-17: The Editor SHALL show a grid row and a Mute/Solo card for each of the 13 tracks.
4. HK-18: WHEN a user clicks a Mid Tom or Low Tom cell THEN the Editor SHALL cycle it through off, normal, accent and ghost, and the engine SHALL play it.
5. HK-19: WHEN a user uses Mute or Solo on Mid Tom or Low Tom THEN the engine SHALL silence or solo that track.
6. HK-20: WHEN a preset saved with 11 tracks loads THEN the app SHALL keep its hits and leave Mid Tom and Low Tom empty.
7. HK-21: WHEN Mid Tom or Low Tom hits THEN the Stadium SHALL light the `SNARE/TOMS` ring and orb.
8. HK-22: WHEN `scripts/tab_to_grid.js` reads a tom note THEN it SHALL write 50 to High Tom, 47 and 48 to Mid Tom, 45 to Low Tom, and 41 and 43 to Floor Tom.
9. HK-23: The Battery song SHALL hold its 2 tom hits on Low Tom, and every other song SHALL keep its grid.

**Independent Test**: Write a fill across the 4 toms in the Editor, then watch the Stadium while it plays.

---

### P1: Approval by ear ⭐ MVP

**User Story**: As the owner of the sound, I want to approve each piece by ear so that a piece that sounds worse does not ship.

**Why P1**: The user reverted the previous kit after hearing it: "O som de caixa, pratos e bumbo ta muito pior do que era."

**Acceptance Criteria**:

1. HK-24: The feature SHALL be done only after the user approves Kick, Snare and each tom by ear, recorded per piece in the user's words in `verification.md`.
2. HK-25: IF the user rejects Kick, Snare, High Tom or Floor Tom THEN that track SHALL go back to its earlier sample.
3. HK-26: IF the user rejects Mid Tom or Low Tom THEN the piece SHALL be replaced with other House Kit recordings until the user approves it.
4. HK-27: The trim of each new piece SHALL be the value the user approved against the cymbals.

**Independent Test**: The user plays the 14 songs and a tom fill, and answers per piece.

---

### P2: Credit to Better Mixes

**User Story**: As the user, I want to thank Better Mixes for the sounds so that its author gets the credit.

**Why P2**: The app plays without it, and the user asked for it.

**Acceptance Criteria**:

1. HK-28: `public/kit/LICENSE.md` SHALL name The House Kit, Better Mixes, https://www.youtube.com/@BetterMixes, https://www.bettermixes.com/drumsamples, each sample's source file, and that no written terms were found.
2. HK-29: `public/kit/LICENSE.md` SHALL state that the release for general use is the user's account of the video https://www.youtube.com/watch?v=WFS0_5Qsc1w.
3. HK-30: The README SHALL thank Better Mixes and link to its channel.
4. HK-31: The app footer SHALL show `Kick, snare and toms: The House Kit by Better Mixes — thanks!` on every screen.
5. HK-32: WHEN a user uses `Better Mixes` in the footer THEN the browser SHALL open https://www.youtube.com/@BetterMixes in a new tab.

**Independent Test**: Open each screen, read the footer and use the link.

---

## Edge Cases

- HK-33: WHEN the pattern loops THEN the engine SHALL continue the take rotation.
- HK-34: WHEN a user changes a step's dynamic during playback THEN the engine SHALL play the new dynamic's next take at that step's next hit.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HK-01 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-02 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-03 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-04 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-05 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-06 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-07 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-08 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-09 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-10 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-11 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-12 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-13 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-14 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-15 | P1: Four toms | Tasks | Implementing |
| HK-16 | P1: Four toms | Design | Implementing |
| HK-17 | P1: Four toms | Design | Implementing |
| HK-18 | P1: Four toms | Design | Implementing |
| HK-19 | P1: Four toms | Design | Implementing |
| HK-20 | P1: Four toms | Design | Implementing |
| HK-21 | P1: Four toms | Design | Implementing |
| HK-22 | P1: Four toms | Design | Implementing |
| HK-23 | P1: Four toms | Design | Implementing |
| HK-24 | P1: Approval by ear | Design | Pending |
| HK-25 | P1: Approval by ear | Design | Pending |
| HK-26 | P1: Approval by ear | Design | Pending |
| HK-27 | P1: Approval by ear | Design | Implementing |
| HK-28 | P2: Credit to Better Mixes | Design | Pending |
| HK-29 | P2: Credit to Better Mixes | Design | Pending |
| HK-30 | P2: Credit to Better Mixes | Design | Pending |
| HK-31 | P2: Credit to Better Mixes | Design | Pending |
| HK-32 | P2: Credit to Better Mixes | Design | Pending |
| HK-33 | P1: Real recordings at each dynamic | Tasks | Implementing |
| HK-34 | P1: Real recordings at each dynamic | Tasks | Implementing |

**Coverage:** 34 total, 0 mapped to tasks, 34 unmapped ⚠️

---

## Sources

- `/home/deivid/Downloads/The House Kit/WAV` - the recordings.
- https://www.bettermixes.com/drumsamples - the kit's page: free, velocity layers and round-robin, no terms stated.
- https://www.youtube.com/watch?v=WFS0_5Qsc1w - the video the user reports releasing the kit for general use.
- `.specs/features/house-kit/context.md` - the user's answers and the measured facts.

---

## Success Criteria

- [ ] The user approves all 6 new pieces by ear.
- [ ] All drum samples take at most 20 MB.
- [ ] Every preset and song from before this feature loads, and only Battery's grid changes.
