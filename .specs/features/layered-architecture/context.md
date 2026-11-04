# Layered Architecture Context

**Gathered:** 2026-11-03
**Spec:** `.specs/features/layered-architecture/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Candidates 1, 2 and 3 of the 2026-11-03 architecture review: the Rust engine in layers, the Speed Trainer as its own module, and the TypeScript in layers. No behaviour changes. User: "Vamos mandar bala no 1, 2 e 3".

---

## Implementation Decisions

### Rust layout

- One crate, folders: `lib.rs` (mods only), `ffi.rs`, `engine.rs`, `sequencer/`, `instruments/` (with `pad/`), `dsp/`. User chose "Um crate, pastas (Recommended)".
- The crate moves out of `src/` to `engine/` at the repository root, with its own `Cargo.toml`; `src/` holds only TypeScript. User chose "engine/ na raiz (Recommended)".

### Proof of no regression

- A golden test that renders the engine and compares output sample by sample, written before any code moves, plus every existing test with unchanged assertions. User chose "Golden + testes (Recommended)".

### Layer enforcement

- A vitest test reads imports and fails on any import against the layer rule. No new dependency. User chose "Teste de imports (Recommended)".

### Existing DOM tests

- `src/index.test.ts` moves to `tests/app.test.ts`; only import paths change; a new `tests/app/session.test.ts` tests rules without the DOM. User chose "Mover e ajustar imports (Recommended)".

### Agent's Discretion

None.

### Declined / Undiscussed Gray Areas → Assumptions

The size limits, golden hash, test placement, `src/index.ts` deletion, WASM rebuild, path updates and docs are in the spec's Assumptions table for the user to correct.

---

## Specific References

- AD-017: the Pad stays a Rust module of its own, mixed after the drums, with fixed arrays.

---

## Deferred Ideas

- Review candidate 4: one typed engine command protocol shared by `MetronomeNode` and the processor.
- Review candidate 5: DOM tests split by screen.
