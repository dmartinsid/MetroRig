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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
