# GitHub Pages Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline below - Medium scope, no `design.md`
**Status**: Approved
**Approved**: 2026-11-08 - user: "Aprovado"
**Build**: `npm run build; npm run test:rust`
**Run unit**: `npx vitest run tests/assets.test.ts tests/app/session.test.ts tests/viteConfig.test.ts tests/deploy.test.ts tests/docs.test.ts --reporter=verbose`

### Design (inline)

- The domain keeps its root paths (`/kit/...`, `/pads/...`, `/click.wav`). `withBase(base, path)` in `src/domain/assets.ts` joins a base (`/` or `/MetroRig/`) to a root path with exactly one slash between them.
- The Session takes `assetBase` (default `/`) and resolves every URL it hands the engine through `withBase`: the WASM, each drum sample and take, the click sounds and each pad file. The UI and the audio adapter fetch only what the Session hands them.
- `src/main.ts` passes `import.meta.env.BASE_URL` as `assetBase`. The worklet URL comes from Vite's `?url` import, which already carries the base.
- `vite.config.ts` exports a function: `base` is `/MetroRig/` for `build`, `/` for `serve`.
- `.github/workflows/deploy.yml` has a `test` job (`test:js`, `test:rust`), a `build` job that `needs: test` and runs `npm run build` with Rust and `wasm32-unknown-unknown`, then uploads `dist`, and a `deploy` job using `actions/deploy-pages`. `concurrency: { group: pages, cancel-in-progress: false }`.
- `npx tsc --noEmit` already fails on `main` (19 errors in `metronome-processor.ts` worklet globals), so it stays out of the Build line and out of CI. Fixing it is not this feature.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CONTRIBUTING.md` (a rule a user sees goes in `domain` or the Session, tested by `tests/app/session.test.ts` with a fake engine), `vitest.config.ts` (no coverage threshold).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| domain | unit | Every branch of `withBase`; 1:1 to GHP-02/03 | `tests/*.test.ts` | `npx vitest run` |
| app (Session) | unit, fake engine | Every URL the Session hands the engine, under both bases | `tests/app/session.test.ts` | `npx vitest run` |
| composition root, ui, audio | unit (source scan) | No literal asset path bypasses the Session | `tests/assets.test.ts` | `npx vitest run` |
| build config | unit | `base` per command | `tests/viteConfig.test.ts` | `npx vitest run` |
| CI workflow | unit (file read) | Each of GHP-05..09 | `tests/deploy.test.ts` | `npx vitest run` |
| docs | unit (file read) | GHP-10 | `tests/docs.test.ts` | `npx vitest run` |
| engine (Rust) | unit | untouched; must stay green | `engine/src/**` | `npm run test:rust` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `npx vitest run` |
| Full | After tasks that touch the build or the workflow | `npx vitest run && npm run build` |
| Build | After the last task | `npm run build && npx vitest run && npm run test:rust` |

---

## Execution Plan

### Phase 1: Base-aware assets

```
T1 → T2 → T3
```

### Phase 2: Build and publish

```
T3 → T4 → T5 → T6
```

---

## Task Breakdown

### T1: Join a base to a root path

**What**: `withBase(base, path)` returns the path under the base, with one slash between them
**Where**: `src/domain/assets.ts`
**Depends on**: None
**Reuses**: `src/domain/` conventions (pure, no I/O)
**Requirement**: GHP-02, GHP-03

**Done when**:

- [x] `withBase('/MetroRig/', '/kit/ride.wav')` is `/MetroRig/kit/ride.wav`; `withBase('/', '/kit/ride.wav')` is `/kit/ride.wav`; a base without the trailing slash gives the same result
- [x] Gate check passes: `npx vitest run`
- [x] Test count: 474 + the new tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): join the site base to an asset path`

---

### T2: The Session hands the engine base-aware URLs

**What**: `SessionOptions.assetBase` (default `/`) prefixes the WASM, every drum sample and take, the click sounds and every pad file
**Where**: `src/app/session.ts` (with `src/app/transport.ts` and `src/app/improv.ts`, which it constructs)
**Depends on**: T1
**Reuses**: `withBase` from T1; `FakeEngine` in `tests/app/session.test.ts`
**Requirement**: GHP-02, GHP-03

**Done when**:

- [x] With `assetBase: '/MetroRig/'`, every URL in `init`, `loadSample`, `loadTake` and `padLoad` starts with `/MetroRig/`
- [x] With no `assetBase`, the same URLs start with `/` and never with `//` or `/MetroRig/`
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(app): resolve every asset under the Session's base`

---

### T3: The composition root passes Vite's base

**What**: `src/main.ts` passes `import.meta.env.BASE_URL` as `assetBase`; a scan fails naming the file when `src/main.ts`, `src/ui/` or `src/audio/` holds a literal root asset path
**Where**: `src/main.ts`
**Depends on**: T2
**Reuses**: `tests/layers.test.ts` file walking
**Requirement**: GHP-02

**Done when**:

- [x] `tests/assets.test.ts` passes, and fails naming the file when a literal `'/pkg/...wasm'` is put back in `src/main.ts`
- [x] Gate check passes: `npx vitest run`

**Tests**: unit
**Gate**: quick
**Commit**: `feat: hand the Session Vite's base URL`

---

### T4: Build under `/MetroRig/`

**What**: `vite.config.ts` uses base `/MetroRig/` for `vite build` and `/` for the dev server
**Where**: `vite.config.ts`
**Depends on**: T3
**Reuses**: the existing server headers and `assetsInlineLimit`
**Requirement**: GHP-01, GHP-03

**Done when**:

- [ ] `tests/viteConfig.test.ts` asserts both bases
- [ ] `dist/index.html` and the emitted worklet reference `/MetroRig/assets/`
- [ ] Gate check passes: `npx vitest run && npm run build`

**Tests**: unit
**Gate**: full
**Commit**: `build: serve the production build under /MetroRig/`

---

### T5: Deploy workflow

**What**: `.github/workflows/deploy.yml` tests, builds with the Rust engine and deploys `dist` to Pages
**Where**: `.github/workflows/deploy.yml`
**Depends on**: T4
**Reuses**: GitHub's Pages actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`)
**Requirement**: GHP-05, GHP-06, GHP-07, GHP-08, GHP-09

**Done when**:

- [ ] `tests/deploy.test.ts` holds one test per GHP-05..09
- [ ] Gate check passes: `npx vitest run && npm run build`

**Tests**: unit
**Gate**: full
**Commit**: `ci: deploy to GitHub Pages on every push to main`

---

### T6: README links the site

**What**: The README links `https://dmartinsid.github.io/MetroRig/` above `## Features`
**Where**: `README.md`
**Depends on**: T5
**Reuses**: `tests/docs.test.ts`
**Requirement**: GHP-10

**Done when**:

- [ ] `tests/docs.test.ts` checks the link sits above `## Features`
- [ ] Gate check passes: `npm run build && npx vitest run && npm run test:rust`

**Tests**: unit
**Gate**: build
**Commit**: `docs: link the live site from the README`

---

### After T6: remote actions (each needs the user's explicit ok)

1. `gh api -X POST repos/dmartinsid/MetroRig/pages -f build_type=workflow` - enables Pages from Actions
2. `gh repo edit dmartinsid/MetroRig --homepage https://dmartinsid.github.io/MetroRig/` - GHP-11
3. `git push origin main` - triggers the first deploy, GHP-04
4. Watch the run with `gh run watch`

---

## Checks

**C1** - `vite build` writes `dist/index.html` with its script and stylesheet under `/MetroRig/assets/`, none under `/assets/` (GHP-01, AC 1)
Proof: `npx vite build --logLevel error && grep -q '"/MetroRig/assets/' dist/index.html && ! grep -qE '(src|href)="/(assets|src)/' dist/index.html`

**C2** - The emitted bundle loads the worklet from `/MetroRig/assets/` (GHP-01, AC 1)
Proof: `npx vite build --logLevel error && grep -lq '/MetroRig/assets/metronome-processor' dist/assets/*.js`

**C3** - `vite.config.ts` gives `build` the base `/MetroRig/` and `serve` the base `/` (GHP-01, AC 1; GHP-03, AC 3)
Proof: run unit | ✓ tests/viteConfig.test.ts > vite config > builds under /MetroRig/ and serves under /

**C4** - `withBase` joins any base to a root path with one slash (GHP-02, AC 2)
Proof: run unit | ✓ tests/assets.test.ts > withBase > joins a base to a root path with one slash

**C5** - Under base `/MetroRig/`, the Session hands the engine the WASM, every drum sample and take, the click sounds and every pad file under `/MetroRig/` (GHP-02, AC 2)
Proof: run unit | ✓ tests/app/session.test.ts > Session > asset base > fetches every asset under /MetroRig/

**C6** - With no base, the same URLs sit under `/` (GHP-03, AC 3)
Proof: run unit | ✓ tests/app/session.test.ts > Session > asset base > fetches every asset under / by default

**C7** - No literal root asset path in `src/main.ts`, `src/ui/` or `src/audio/` bypasses the Session (GHP-02, edge case)
Proof: run unit | ✓ tests/assets.test.ts > asset paths > only the Session resolves asset paths

**C8** - After the deploy, the page, `pkg/metrorig_audio_bg.wasm` and `kit/ride.wav` each answer 200 at `https://dmartinsid.github.io/MetroRig/` (GHP-04, AC 4)
Proof: `for p in '' pkg/metrorig_audio_bg.wasm kit/ride.wav; do curl -sfo /dev/null "https://dmartinsid.github.io/MetroRig/$p" || exit 1; done`

**C9** - The workflow runs on a push to `main` (GHP-05, AC 1)
Proof: run unit | ✓ tests/deploy.test.ts > deploy workflow > deploys on every push to main

**C10** - The workflow runs by hand (GHP-06, AC 2)
Proof: run unit | ✓ tests/deploy.test.ts > deploy workflow > deploys when started by hand

**C11** - The build job installs Rust with `wasm32-unknown-unknown`, runs `npm run build` and uploads `dist` (GHP-07, AC 3)
Proof: run unit | ✓ tests/deploy.test.ts > deploy workflow > compiles the engine before it builds the site

**C12** - The build needs the test job, which runs `test:js` and `test:rust`, and the deploy needs the build (GHP-08, AC 4)
Proof: run unit | ✓ tests/deploy.test.ts > deploy workflow > deploys only after both test suites pass

**C13** - Deploys share the `pages` concurrency group without cancelling a running one (GHP-09, AC 5)
Proof: run unit | ✓ tests/deploy.test.ts > deploy workflow > queues a newer deploy behind a running one

**C14** - The README links the site above `## Features` (GHP-10, AC 1)
Proof: run unit | ✓ tests/docs.test.ts > Docs > README links the live site above its features

**C15** - The repo's Website field is `https://dmartinsid.github.io/MetroRig/` (GHP-11, AC 2)
Proof: `test "$(gh repo view dmartinsid/MetroRig --json homepageUrl -q .homepageUrl)" = https://dmartinsid.github.io/MetroRig/`

---

## Handoff

**Settled mid-build:** none
**Dispatched:** none
**Walked:** none
