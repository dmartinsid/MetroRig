# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - When edits are deferred to a boundary, give context-replacing actions such as a preset load their own immediate path and test it from a running state.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/lib.rs` · harmful: 0
- features: precise-only
- evidence: TRAIN-17 (src/lib.rs)
- last seen: 2026-10-31T17:07:39Z

### L-002 - Return early from a stepper at its limit so a value that does not change never counts as an edit.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/main.ts` · harmful: 0
- features: interface-v2
- evidence: src/main.ts (src/main.ts)
- last seen: 2026-11-01T03:04:06Z

### L-003 - Redraw every view whose handlers captured the active state object after replacing that object.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/main.ts` · harmful: 0
- features: interface-v2
- evidence: src/main.ts (src/main.ts)
- last seen: 2026-11-01T03:04:06Z

### L-004 - When two views show one value, update both on every path that changes it.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/main.ts` · harmful: 0
- features: interface-v2
- evidence: src/main.ts (src/main.ts)
- last seen: 2026-11-01T03:04:06Z

### L-005 - Prove a persistence rule on each kind of state and each path that could clear it.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `src/index.test.ts` · harmful: 0
- features: interface-v2
- evidence: C67 (src/index.test.ts)
- last seen: 2026-11-01T03:04:06Z

### L-006 - Make a documentation proof name every subject its criterion lists.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `docs` · harmful: 0
- features: interface-v2
- evidence: C77 (docs)
- last seen: 2026-11-01T03:04:06Z

### L-007 - Copy a capture's colour rule into the criterion instead of paraphrasing it.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `specs` · harmful: 0
- features: interface-v2
- evidence: STAD-03 (specs)
- last seen: 2026-11-01T03:04:06Z

### L-008 - Send every entry point of an action through the same guard, and test each entry point.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/main.ts` · harmful: 0
- features: grooves-library
- evidence: GRV-01.11 (src/main.ts) (src/main.ts)
- last seen: 2026-11-01T16:19:20Z

### L-009 - Make a user intent idempotent across async initialisation, and test it with the initialisation held open.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/main.ts` · harmful: 0
- features: grooves-library
- evidence: GRV-01.5 (src/main.ts) (src/main.ts)
- last seen: 2026-11-01T16:19:20Z

### L-010 - Reach the state under test through a path that does not set the asserted value itself.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: grooves-library
- evidence: C42 (src/index.test.ts) (tests)
- last seen: 2026-11-01T16:19:20Z

### L-011 - Start a replace test from a state that differs in every field the replacement writes.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: grooves-library
- evidence: C40 (src/index.test.ts) (tests)
- last seen: 2026-11-01T16:19:20Z

### L-012 - Prove a rule over a group on every member of the group, not on its last one.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: grooves-library
- evidence: C54 (tests/kit.test.ts) (tests)
- last seen: 2026-11-01T16:19:20Z

### L-013 - Assert what an action must leave alone, not only what it must change.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: grooves-library
- evidence: C47 (src/index.test.ts) (tests)
- last seen: 2026-11-01T16:19:20Z

### L-014 - Hold a data-cleaning rule through the page path, not only through its function.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: grooves-library
- evidence: C62 (src/index.test.ts) (tests)
- last seen: 2026-11-01T16:19:20Z

### L-015 - Pin the full mapping from each id to its file, not one sample entry.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: grooves-library
- evidence: KIT-01.2 (tests/kit.test.ts) (tests)
- last seen: 2026-11-01T16:19:20Z

### L-016 - Record why a conditional fallback was taken, so the condition can be checked.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `specs` · harmful: 0
- features: grooves-library
- evidence: C12 (KIT-01.3) (specs)
- last seen: 2026-11-01T16:19:20Z

### L-017 - Check a line drawn in a gap against the strokes of the shapes beside it, which can cover the gap.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `src/index.css` · harmful: 0
- features: grooves-library
- evidence: C3 (src/index.css) (src/index.css)
- last seen: 2026-11-01T16:19:20Z

### L-018 - Reset view state at Play as well as at Stop when playback drives that view.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/main.ts` · harmful: 0
- features: song-bars
- evidence: BAR-01 AC 5 (src/main.ts) (src/main.ts)
- last seen: 2026-11-01T18:13:34Z

### L-019 - Check whether a value really changed before running a destructive path.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/main.ts` · harmful: 0
- features: song-bars
- evidence: BAR-05 AC 1 (src/main.ts) (src/main.ts)
- last seen: 2026-11-01T18:13:34Z

### L-020 - When a data model grows, walk every legacy migration with the new shape.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/state.ts` · harmful: 0
- features: song-bars
- evidence: normalizePreset (src/state.ts) (src/state.ts)
- last seen: 2026-11-01T18:13:34Z

### L-021 - Ignore a late event whose index no longer fits the current state.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/main.ts` · harmful: 0
- features: song-bars
- evidence: renderTick (src/main.ts) (src/main.ts)
- last seen: 2026-11-01T18:13:35Z

### L-022 - Read what a test actually forbids before calling two requirements a conflict.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/main.ts` · harmful: 0
- features: song-bars
- evidence: BAR-01 AC 4 (src/main.ts) (src/main.ts)
- last seen: 2026-11-01T18:13:35Z

### L-023 - Assert the stored values after a round trip, not only their count.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: song-bars
- evidence: C7 (src/index.test.ts) (tests)
- last seen: 2026-11-01T18:13:35Z

### L-024 - Pick test data where the two states compared really differ, and assert that first.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: song-bars
- evidence: C29 (src/index.test.ts) (tests)
- last seen: 2026-11-01T18:13:35Z

### L-025 - Trace a file's origin in git history before writing it down.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `specs` · harmful: 0
- features: song-bars
- evidence: KIT-01.3 (public/kit/LICENSE.md) (specs)
- last seen: 2026-11-01T18:13:35Z

### L-026 - When display order differs from id order, place rows by list position, and test the drawn rows rather than the data array.
- signal: `ac_gap` · recurrence: 1 feature(s) · harmful: 0
- features: house-kit
- evidence: C16
- last seen: 2026-11-01T22:10:54Z

### L-027 - Pin each measured level per recording; floors on one pair of recordings let the levels drift.
- signal: `weak_test` · recurrence: 1 feature(s) · harmful: 0
- features: house-kit
- evidence: C10
- last seen: 2026-11-01T22:10:54Z

### L-028 - A rule that says everything else stays the same needs a pin of the old value of every item, not a check on the changed fields.
- signal: `weak_test` · recurrence: 1 feature(s) · harmful: 0
- features: house-kit
- evidence: C24
- last seen: 2026-11-01T22:10:54Z

### L-029 - Mute and Solo tests press every control on every new track, not one control per track.
- signal: `weak_test` · recurrence: 1 feature(s) · harmful: 0
- features: house-kit
- evidence: C20
- last seen: 2026-11-01T22:10:54Z

### L-030 - Test a sample builder by running it on made-up sources and comparing each output to its exact mix, not by reading its constants.
- signal: `weak_test` · recurrence: 1 feature(s) · harmful: 0
- features: house-kit
- evidence: C37
- last seen: 2026-11-01T22:10:54Z

### L-031 - A rule worded for any track must name the Click, which has its own code path in the engine.
- signal: `ac_gap` · recurrence: 1 feature(s) · harmful: 0
- features: house-kit
- evidence: HK-07
- last seen: 2026-11-01T22:10:54Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
