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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
