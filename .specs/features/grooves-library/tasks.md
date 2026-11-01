# Grooves Library Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/grooves-library/design.md`
**Status**: Approved
**Approved**: 2026-11-01 - user: "aprovado"
**Build**: `npm run build`
**Run js**: `npx vitest run --reporter=verbose`
**Run rust**: `cargo test`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md`, `vitest.config.ts`; no coverage thresholds, so strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Rust engine | unit | All branches; 1:1 to spec ACs | `src/lib.rs` | `cargo test` |
| Kit, song and state rules | unit | All branches; 1:1 to spec ACs; all listed edge cases | `tests/*.test.ts` | `npx vitest run --reporter=verbose` |
| Tab converter | unit | Every mapping and each refusal | `tests/tabToGrid.test.ts` | `npx vitest run --reporter=verbose` |
| Audio bridge | unit | Every changed message | `tests/metronome-processor.test.ts` | `npx vitest run --reporter=verbose` |
| Kit samples | unit | Every file named by `TRACKS`, and the size cap | `tests/kit.test.ts` | `npx vitest run --reporter=verbose` |
| Page markup and wiring | integration | Each control in scope, against the real `index.html` | `src/index.test.ts` | `npx vitest run --reporter=verbose` |
| CSS | none | - (happy-dom applies no CSS; the walk and the captures prove it) | - | build gate only |
| Docs | none | - (build gate only) | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute. `tsc` fails on missing AudioWorklet types and the project has no linter, so neither is a gate. Baseline: 139 JS tests pass.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After rule and wiring tasks | `npx vitest run` |
| Rust | After engine tasks | `cargo test` |
| Full | After CSS and docs tasks | `npx vitest run && npx vite build` |
| Build | After the WASM rebuild and the last task | `cargo test && npx vitest run && npx vite build` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Engine

The Rust engine and the worklet, proven with no screen.

```
T1 → T2 → T3 → T4 → T5
```

### Phase 2: Kit

The samples and how they load.

```
T6 → T7
```

### Phase 3: Editor

The grid, mix and data with 11 tracks.

```
T8 → T9 → T10 → T11
```

### Phase 4: Stadium

The clock and orbs by group.

```
T12
```

### Phase 5: Navigation

The header links.

```
T13 → T14
```

### Phase 6: Songs

The converter and the catalog.

```
T15 → T16 → T17 → T18 → T19
```

### Phase 7: Grooves screen

Tabs, cards and their actions.

```
T20 → T21 → T22 → T23
```

### Phase 8: Style and docs

What only the eye can judge.

```
T24 → T25 → T26 → T27 → T28
```

---

## Task Breakdown

### T1: Add the kit rules

**What**: Tracks, Stadium groups and the step cycle as pure rules
**Where**: `src/kit.ts`
**Depends on**: None
**Reuses**: `src/trackMix.ts` pattern
**Requirement**: KIT-01, DYN-01, STD-01

**Done when**:

- [x] `TRACKS` and `STADIUM_GROUPS` match `design.md`
- [x] `tests/kit.test.ts` holds the tests of their checks
- [x] The tests of the checks for KIT-01, DYN-01, STD-01 that this task reaches pass
- [x] Gate check passes: `npx vitest run`
- [x] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(kit): add the kit rules`

---

### T2: Play 11 voices with dynamics

**What**: 11 sample voices with gains 0.3, 0.7 and 1.0
**Where**: `src/lib.rs`
**Depends on**: T1
**Reuses**: Existing sample loop
**Requirement**: KIT-01, DYN-01

**Done when**:

- [x] `MAX_SAMPLES` is 11 and every array sized from it
- [x] Tests that asserted unity gain on value 1 assert 0.7, and change in nothing else
- [x] An engine test holds each new id
- [x] The tests of the checks for KIT-01, DYN-01 that this task reaches pass
- [x] Gate check passes: `cargo test`
- [x] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: rust

**Commit**: `feat(engine): play 11 voices with dynamics`

---

### T3: Choke the open hat

**What**: A `Hi-hat` step stops `Open Hat`
**Where**: `src/lib.rs`
**Depends on**: T2
**Reuses**: Voice state from T2
**Requirement**: KIT-01

**Done when**:

- [x] The test of its check passes
- [x] The tests of the checks for KIT-01 that this task reaches pass
- [x] Gate check passes: `cargo test`
- [x] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: rust

**Commit**: `feat(engine): choke the open hat`

---

### T4: Clamp the output

**What**: Each output sample stays within -1.0 to 1.0
**Where**: `src/lib.rs`
**Depends on**: T3
**Reuses**: `fill_buffers`
**Requirement**: KIT-01

**Done when**:

- [x] Existing output assertions still pass unchanged
- [x] The tests of the checks for KIT-01 that this task reaches pass
- [x] Gate check passes: `cargo test`
- [x] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: rust

**Commit**: `feat(engine): clamp the output`

---

### T5: Carry 11 tracks through the worklet

**What**: `gridMirror` and `activeTrackIds` cover 11 tracks, and `public/pkg` is rebuilt
**Where**: `src/audio/metronome-processor.ts`
**Depends on**: T4
**Reuses**: `UPDATE_GRID`
**Requirement**: KIT-01

**Done when**:

- [x] `npm run build:wasm` output committed
- [x] `tests/metronome-processor.test.ts` covers track 8
- [x] The tests of the checks for KIT-01 that this task reaches pass
- [x] Gate check passes: `cargo test && npx vitest run && npx vite build`
- [x] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: build

**Commit**: `feat(audio): carry 11 tracks through the worklet`

---

### T6: Add the drum samples

**What**: 10 trimmed one-shots and their license record
**Where**: `public/kit/`
**Depends on**: None
**Reuses**: `scripts/generate_clicks.py` as tool precedent
**Requirement**: KIT-01, DOC-01

**Done when**:

- [ ] The kit's bundled terms are read first; SM Drums only if they allow redistribution, otherwise the approved fallback
- [ ] If no CC0 China is found, the task stops and the user decides
- [ ] `public/kit/LICENSE.md` records name, source and license
- [ ] `public/kit/` totals at most 10 MB
- [ ] Old `kick.wav`, `snare.wav`, `hihat.wav` removed, and `scripts/download_sounds.js` no longer fetches them
- [ ] The tests of the checks for KIT-01, DOC-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(kit): add the drum samples`

---

### T7: Load the kit

**What**: Each sample loads on its own, and a failure stays local
**Where**: `src/main.ts`
**Depends on**: T6
**Reuses**: `initAudio`, `audioNode.loadSample`
**Requirement**: KIT-01

**Done when**:

- [ ] `Promise.allSettled` over the 10 loads
- [ ] Click stays audible when none loaded
- [ ] The tests of the checks for KIT-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(kit): load every sample on its own`

---

### T8: Keep stored presets valid

**What**: `normalizePreset` fills missing tracks and cleans step values
**Where**: `src/state.ts`
**Depends on**: None
**Reuses**: `normalizePreset`
**Requirement**: EDT-01, DYN-01

**Done when**:

- [ ] Factory presets and speed trainers also pass through it
- [ ] The tests of the checks for EDT-01, DYN-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(state): keep stored presets valid on 11 tracks`

---

### T9: Draw every track in the grid

**What**: 11 rows, the ghost dot and the step cycle
**Where**: `src/main.ts`
**Depends on**: T8
**Reuses**: `drawGrid`, `nextStepValue`
**Requirement**: EDT-01, DYN-01

**Done when**:

- [ ] No `trackId < 4` remains in `drawGrid` or `syncMeterAndGrid`
- [ ] The tests of the checks for EDT-01, DYN-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): draw every track in the grid`

---

### T10: Generate the mix cards

**What**: One Mute/Solo card per track, from `TRACKS`
**Where**: `src/main.ts`
**Depends on**: T9
**Reuses**: `applyTrackMix`
**Requirement**: EDT-01

**Done when**:

- [ ] Ids `mute-N` and `solo-N` hold for 0 to 10
- [ ] The tests of the checks for EDT-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): add a mix card for every track`

---

### T11: Apply grooves to the whole kit

**What**: `Groove Library` and `Save Groove` cover tracks 1 to 10
**Where**: `src/main.ts`
**Depends on**: T10
**Reuses**: `applyPattern`, `btnSaveGroove`
**Requirement**: EDT-01

**Done when**:

- [ ] `FACTORY_GROOVES` keeps its 5 entries
- [ ] The tests of the checks for EDT-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): apply grooves to the whole kit`

---

### T12: Group the Stadium

**What**: 4 rings, 4 orbs and their labels
**Where**: `src/main.ts`
**Depends on**: None
**Reuses**: `drawBeatClock`, `renderTick`, `groupHit`
**Requirement**: STD-01

**Done when**:

- [ ] Legend and orb labels read `CLICK`, `KICK`, `SNARE/TOMS`, `CYMBALS`
- [ ] The tests of the checks for STD-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): group the Stadium by kit area`

---

### T13: Add the third view

**What**: `grooves` as a persisted view mode
**Where**: `src/state.ts`
**Depends on**: None
**Reuses**: `setViewMode`
**Requirement**: NAV-01

**Done when**:

- [ ] An unknown stored mode still opens the Editor
- [ ] The tests of the checks for NAV-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(state): add the Grooves view`

---

### T14: Wire the header links

**What**: Links replace the toggle, and each shows one screen
**Where**: `src/main.ts`
**Depends on**: T13
**Reuses**: `state.subscribe`
**Requirement**: NAV-01

**Done when**:

- [ ] The empty Grooves `main` exists in `index.html`
- [ ] The old toggle tests are replaced by the link tests of the same behaviour
- [ ] The tests of the checks for NAV-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run && npx vite build`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): add the header links`

---

### T15: Add the tab converter

**What**: `barToGrid` with its piece and dynamic mapping
**Where**: `scripts/tab_to_grid.js`
**Depends on**: None
**Reuses**: `measureLengthFor` rule
**Requirement**: SONG-01

**Done when**:

- [ ] Tests use a fixture bar written by hand, not a copied tab
- [ ] Refuses a note off the step grid
- [ ] The tests of the checks for SONG-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(songs): add the tab converter`

---

### T16: Add the catalog rules

**What**: `Song`, `songToPreset`, `songsForGenre` and the 2 AC/DC songs
**Where**: `src/songs.ts`
**Depends on**: T15
**Reuses**: `Preset`
**Requirement**: SONG-01

**Done when**:

- [ ] Each song's bar taken from its tab with T15
- [ ] The tests of the checks for SONG-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(songs): add the catalog with AC/DC`

---

### T17: Add the metal songs

**What**: The Trooper, Run to the Hills, Enter Sandman, Master of Puppets, Battery
**Where**: `src/songs.ts`
**Depends on**: T16
**Reuses**: T15
**Requirement**: SONG-01

**Done when**:

- [ ] A bar that does not fit stops the task, and the user decides
- [ ] The tests of the checks for SONG-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(songs): add Iron Maiden and Metallica`

---

### T18: Add the metalcore songs

**What**: Tears Don't Fall, Scream Aim Fire, Don't Need You
**Where**: `src/songs.ts`
**Depends on**: T17
**Reuses**: T15
**Requirement**: SONG-01

**Done when**:

- [ ] A bar that does not fit stops the task, and the user decides
- [ ] The tests of the checks for SONG-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(songs): add Bullet for My Valentine`

---

### T19: Add the blues songs

**What**: Cocaine, Crossroads, The Thrill Is Gone, Every Day I Have the Blues
**Where**: `src/songs.ts`
**Depends on**: T18
**Reuses**: T15
**Requirement**: SONG-01

**Done when**:

- [ ] A bar that does not fit stops the task, and the user decides
- [ ] The catalog holds 14 songs
- [ ] The tests of the checks for SONG-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(songs): add Eric Clapton and B.B. King`

---

### T20: Draw tabs and cards

**What**: The genre tabs and one card per song
**Where**: `src/main.ts`
**Depends on**: None
**Reuses**: `songsForGenre`
**Requirement**: GRV-01

**Done when**:

- [ ] Counts come from `songsForGenre`
- [ ] The tests of the checks for GRV-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): draw the Grooves screen`

---

### T21: Add the songs to the preset selector

**What**: A `Songs` group that follows the loaded song
**Where**: `src/main.ts`
**Depends on**: T20
**Reuses**: `populatePresetsDropdown`
**Requirement**: SONG-01

**Done when**:

- [ ] `Save` on a loaded song leaves `SONGS` unchanged
- [ ] The tests of the checks for SONG-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): list the songs in the preset selector`

---

### T22: Play a song from its card

**What**: `▶` and `■`, in place
**Where**: `src/main.ts`
**Depends on**: T21
**Reuses**: `togglePlay`, `loadPresetIntoUI`
**Requirement**: GRV-01, SONG-01

**Done when**:

- [ ] The card's mark follows playback from any screen
- [ ] The tests of the checks for GRV-01, SONG-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): play a song from its card`

---

### T23: Open a song in the Editor

**What**: `Open in Editor`, with the confirmation
**Where**: `src/main.ts`
**Depends on**: T22
**Reuses**: `markPresetAsModified`
**Requirement**: GRV-01

**Done when**:

- [ ] Declining changes nothing
- [ ] The tests of the checks for GRV-01 that this task reaches pass
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(ui): open a song in the Editor`

---

### T24: Style the header links

**What**: As drawn in `.specs/features/grooves-library/captures/editor.png`, at every width
**Where**: `src/index.css`
**Depends on**: None
**Reuses**: `#btn-toggle-view` rules removed
**Requirement**: NAV-01

**Done when**:

- [ ] `captures/editor.running.png` retaken
- [ ] The walk shows the result
- [ ] Gate check passes: `npx vitest run && npx vite build`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: none
**Gate**: full

**Commit**: `style(ui): style the header links`

---

### T25: Style the 11-track Editor

**What**: Lower rows, mix cards and 5 new track colours
**Where**: `src/index.css`
**Depends on**: T24
**Reuses**: `--track-color`
**Requirement**: EDT-01

**Done when**:

- [ ] Grid readable at 1440, 1024 and 390px
- [ ] The walk shows the result
- [ ] Gate check passes: `npx vitest run && npx vite build`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: none
**Gate**: full

**Commit**: `style(ui): fit the Editor to 11 tracks`

---

### T26: Style the Grooves screen

**What**: Tabs and cards, one column at 390px
**Where**: `src/index.css`
**Depends on**: T25
**Reuses**: `.card`
**Requirement**: GRV-01

**Done when**:

- [ ] No horizontal page scroll at 390px
- [ ] The walk shows the result
- [ ] Gate check passes: `npx vitest run && npx vite build`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: none
**Gate**: full

**Commit**: `style(ui): style the Grooves screen`

---

### T27: Update the docs

**What**: 11 tracks and the Grooves screen in the README
**Where**: `README.md`
**Depends on**: T26
**Reuses**: Existing README
**Requirement**: DOC-01

**Done when**:

- [ ] Its check passes
- [ ] The walk shows the result
- [ ] Gate check passes: `npx vitest run && npx vite build`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: none
**Gate**: full

**Commit**: `docs: describe the kit and the Grooves screen`

---

### T28: Update the design document

**What**: Links, Grooves screen and Stadium groups
**Where**: `.stitch/DESIGN.md`
**Depends on**: T27
**Reuses**: `.stitch/DESIGN.md`
**Requirement**: DOC-01

**Done when**:

- [ ] Its check passes
- [ ] The walk shows the result
- [ ] Gate check passes: `npx vitest run && npx vite build`
- [ ] Test count: at least the previous task's count (no silent deletions)

**Tests**: none
**Gate**: full

**Commit**: `docs(design): describe the Grooves screen`

---

## Checks

**C1** - The header shows `Editor`, `Stadium` and `Grooves` as drawn in `captures/editor.png` (NAV-01, AC 1)
Proof: browser captures/editor.running.png

**C2** - `Editor` shows only the Editor screen (NAV-01, AC 2)
Proof: run js | ✓ src/index.test.ts > Grooves Library > nav_02 editor link

**C3** - `Stadium` shows only the Stadium, as in `captures/stadium.png` (NAV-01, AC 3)
Proof: browser captures/stadium.running.png

**C4** - `Grooves` shows only the Grooves screen (NAV-01, AC 4)
Proof: run js | ✓ src/index.test.ts > Grooves Library > nav_04 grooves link

**C5** - Only the open screen's link has `aria-current="page"` (NAV-01, AC 5)
Proof: run js | ✓ src/index.test.ts > Grooves Library > nav_05 aria current

**C6** - The header has no toggle and no `Presets` link (NAV-01, AC 6)
Proof: run js | ✓ src/index.test.ts > Grooves Library > nav_06 no toggle no presets

**C7** - Reload reopens the last screen, Grooves included (NAV-01, AC 7)
Proof: run js | ✓ tests/state.test.ts > StateManager > nav_07 grooves mode persists

**C8** - Changing screens during playback sends no stop or start (NAV-01, AC 8)
Proof: run js | ✓ src/index.test.ts > Grooves Library > nav_08 playback survives screen change

**C9** - All three links show at 1440, 1024 and 390px with no page scroll (NAV-01, AC 9)
Proof: walk - at each width all three links show and the page does not scroll sideways

**C10** - The 11 tracks exist in the spec's order (KIT-01, AC 1)
Proof: run js | ✓ tests/kit.test.ts > Kit > kit_01 eleven tracks in order

**C11** - An active step of each drum track plays its sample (KIT-01, AC 2)
Proof: run rust | test tests::kit_02_every_drum_track_plays_its_sample ... ok

**C12** - Each sample's license is recorded and the kit stays within 10 MB (KIT-01, AC 3)
Proof: run js | ✓ tests/kit.test.ts > Kit > kit_03 samples exist with a license

**C13** - A `Hi-hat` step stops a ringing `Open Hat` (KIT-01, AC 4)
Proof: run rust | test tests::kit_04_hi_hat_chokes_open_hat ... ok

**C14** - All 11 tracks on one step keep output within ±1.0 (KIT-01, AC 5)
Proof: run rust | test tests::kit_05_output_stays_in_range ... ok

**C15** - A failed sample load is logged and the other tracks still load (KIT-01, AC 6)
Proof: run js | ✓ src/index.test.ts > Grooves Library > kit_06 failed sample stays local

**C16** - With no drum sample, the click still sounds (KIT-01, AC 7)
Proof: run rust | test tests::kit_07_click_needs_no_drum_samples ... ok

**C17** - Values 3, 1 and 2 play at 0.3, 0.7 and 1.0 (DYN-01, AC 1)
Proof: run rust | test tests::dyn_01_step_values_set_the_gain ... ok

**C18** - A drum cell cycles `empty`, `normal`, `accent`, `ghost`, `empty` (DYN-01, AC 2)
Proof: run js | ✓ src/index.test.ts > Grooves Library > dyn_02 drum cell cycle

**C19** - A `Click` cell cycles `empty`, `normal`, `accent`, `empty` (DYN-01, AC 3)
Proof: run js | ✓ src/index.test.ts > Grooves Library > dyn_03 click cell cycle

**C20** - The grid shows `●`, `▲` and a smaller ghost dot (DYN-01, AC 4)
Proof: run js | ✓ src/index.test.ts > Grooves Library > dyn_04 cell symbols

**C21** - A stamped figure writes `normal` hits (DYN-01, AC 5)
Proof: run js | ✓ src/index.test.ts > Grooves Library > dyn_05 figure writes normal

**C22** - A saved preset keeps each dynamic (DYN-01, AC 6)
Proof: run js | ✓ src/index.test.ts > Grooves Library > dyn_06 dynamics survive save and load

**C23** - The screen shows the 5 tabs (GRV-01, AC 1)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_01 tabs

**C24** - First open selects `All` with 14 cards (GRV-01, AC 2)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_02 all shows fourteen

**C25** - The tabs show 2, 5, 3 and 4 cards (GRV-01, AC 3)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_03 genre counts

**C26** - A card shows song, artist, section, BPM and time signature (GRV-01, AC 4)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_04 card fields

**C27** - `▶` loads, plays and stays on the screen (GRV-01, AC 5)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_05 play stays on screen

**C28** - The playing card shows `■` (GRV-01, AC 6)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_06 playing mark

**C29** - `■` stops and keeps the song loaded (GRV-01, AC 7)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_07 stop keeps song

**C30** - `▶` on another card keeps playing at its BPM (GRV-01, AC 8)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_08 switch during playback

**C31** - `Open in Editor` loads the song and shows the Editor (GRV-01, AC 9)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_09 open in editor

**C32** - Acting on the loaded song keeps its edits (GRV-01, AC 10)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_10 loaded song keeps edits

**C33** - Loading another song with unsaved edits asks for confirmation (GRV-01, AC 11)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_11 asks before replacing edits

**C34** - Declining changes nothing (GRV-01, AC 12)
Proof: run js | ✓ src/index.test.ts > Grooves Library > grv_12 decline changes nothing

**C35** - At 390px the cards form one column with no page scroll (GRV-01, AC 13)
Proof: walk - at 390px the cards stack in one column and the page does not scroll sideways

**C36** - The catalog holds the 14 songs with every field and a Songsterr link (SONG-01, AC 1)
Proof: run js | ✓ tests/songs.test.ts > Songs > song_01 fourteen songs with sources

**C37** - `Crossroads` reads `Cream (Eric Clapton)`, and Every Day uses Cook County (SONG-01, AC 2)
Proof: run js | ✓ tests/songs.test.ts > Songs > song_02 named versions

**C38** - Each song holds 1 bar, at most 32 steps, 40 to 240 BPM, and a drum hit (SONG-01, AC 3)
Proof: run js | ✓ tests/songs.test.ts > Songs > song_03 bounds

**C39** - `Click` accents beat 1 and marks the other beats (SONG-01, AC 4)
Proof: run js | ✓ tests/songs.test.ts > Songs > song_04 click marks the beats

**C40** - Loading replaces BPM, time signature and tracks, and turns the Trainer off (SONG-01, AC 5)
Proof: run js | ✓ src/index.test.ts > Grooves Library > song_05 load replaces everything

**C41** - The card's BPM equals the `TEMPO BUS` (SONG-01, AC 6)
Proof: run js | ✓ src/index.test.ts > Grooves Library > song_06 card matches tempo bus

**C42** - The selector's `Songs` group holds 14 and selects the loaded one (SONG-01, AC 7)
Proof: run js | ✓ src/index.test.ts > Grooves Library > song_07 songs group

**C43** - Saving an edited song stores a user preset and leaves `SONGS` unchanged (SONG-01, AC 8)
Proof: run js | ✓ src/index.test.ts > Grooves Library > song_08 save leaves catalog

**C44** - The grid shows 11 tracks in the composition of `captures/editor.png` (EDT-01, AC 1)
Proof: browser captures/editor.running.png

**C45** - There is one Mute/Solo card per track (EDT-01, AC 2)
Proof: run js | ✓ src/index.test.ts > Grooves Library > edt_02 eleven mix cards

**C46** - `China` follows the Mute and Solo rules (EDT-01, AC 3)
Proof: run js | ✓ src/index.test.ts > Grooves Library > edt_03 new track obeys mix

**C47** - A groove empties the tracks it does not hold (EDT-01, AC 4)
Proof: run js | ✓ src/index.test.ts > Grooves Library > edt_04 groove clears other tracks

**C48** - `Save Groove` stores 10 drum tracks (EDT-01, AC 5)
Proof: run js | ✓ src/index.test.ts > Grooves Library > edt_05 save groove keeps the kit

**C49** - A 4-track preset loads with the new tracks empty (EDT-01, AC 6)
Proof: run js | ✓ tests/state.test.ts > normalizePreset > edt_06 fills missing tracks

**C50** - At 1024 and 390px every track shows with no page scroll (EDT-01, AC 7)
Proof: walk - at 1024px and 390px all 11 tracks show and only the grid scrolls

**C51** - The clock and orbs show the 4 labels (STD-01, AC 1)
Proof: run js | ✓ src/index.test.ts > Grooves Library > std_01 four group labels

**C52** - `SNARE/TOMS` holds `Snare`, `High Tom`, `Floor Tom` (STD-01, AC 2)
Proof: run js | ✓ tests/kit.test.ts > Kit > std_02 snare and toms group

**C53** - `CYMBALS` holds its 6 tracks (STD-01, AC 3)
Proof: run js | ✓ tests/kit.test.ts > Kit > std_03 cymbals group

**C54** - A ring step lights for any track of its group (STD-01, AC 4)
Proof: run js | ✓ tests/kit.test.ts > Kit > std_04 group hit

**C55** - An audible track pulses its group's orb (STD-01, AC 5)
Proof: run js | ✓ src/index.test.ts > Grooves Library > std_05 orb pulses for its group

**C56** - A wholly silenced group does not pulse (STD-01, AC 6)
Proof: run js | ✓ src/index.test.ts > Grooves Library > std_06 silenced group stays still

**C57** - The README describes 11 tracks and the Grooves screen (DOC-01, AC 1)
Proof: `grep -q '11 tracks' README.md && grep -q 'Grooves' README.md`

**C58** - `DESIGN.md` describes the links, screen and groups (DOC-01, AC 2)
Proof: `grep -q 'SNARE/TOMS' .stitch/DESIGN.md && grep -q 'Grooves' .stitch/DESIGN.md`

**C59** - The license record sits beside the samples (DOC-01, AC 3)
Proof: `grep -qi 'license' public/kit/LICENSE.md`

**C60** - At 1024px and narrower the header selectors stay reachable beside the links (Edge Cases, item 1)
Proof: walk - at 1024px and 390px both selectors can be used

**C61** - A song load keeps the session's Mute and Solo (Edge Cases, item 2)
Proof: run js | ✓ src/index.test.ts > Grooves Library > edge_02 load keeps the mix

**C62** - A stored value outside 0 to 3 becomes `normal` (Edge Cases, item 3)
Proof: run js | ✓ tests/state.test.ts > normalizePreset > edge_03 cleans step values

**C63** - The user approves all 14 songs by ear (Success Criteria, item 1)
Proof: walk - the user played all 14 songs and approved each one, recorded in Handoff

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** Q22 had no explicit answer, only "aprovado", so no batch worker is dispatched and the tasks run in the main session.
**Dispatched:** none
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8

Phase 1:  T1 ------→ T2 ------→ T3 ------→ T4 ------→ T5
Phase 2:  T6 ------→ T7
Phase 3:  T8 ------→ T9 ------→ T10 ------→ T11
Phase 4:  T12
Phase 5:  T13 ------→ T14
Phase 6:  T15 ------→ T16 ------→ T17 ------→ T18 ------→ T19
Phase 7:  T20 ------→ T21 ------→ T22 ------→ T23
Phase 8:  T24 ------→ T25 ------→ T26 ------→ T27 ------→ T28
```

Execution is strictly sequential - there is no intra-phase parallelism.
