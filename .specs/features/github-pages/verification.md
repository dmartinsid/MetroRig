# GitHub Pages verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 3a76502
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | shell: `vite build` + `grep '"/MetroRig/assets/' dist/index.html` + no `(src\|href)="/(assets\|src)/` | yes - the live index.html serves `/MetroRig/assets/index-*.js` and `.css`; the rest are absolute https URLs |
| C2 | shell: `vite build` + `grep -l '/MetroRig/assets/metronome-processor-*.js' dist/assets/*.js` | yes |
| C3 | `tests/viteConfig.test.ts` `builds under /MetroRig/ and serves under /` | yes - exact `toBe` for build, serve and preview |
| C4 | `tests/assets.test.ts` `withBase > joins a base to a root path with one slash` | yes - exact strings, base with and without the trailing slash, and `/` |
| C5 | `tests/app/session.test.ts` `Session > asset base > fetches every asset under /MetroRig/` | yes, with a gap - exact ordered arrays for the WASM, samples, takes and click, but pads only for the default timbre (Choir), 1 of the 4 sampled timbres |
| C6 | `tests/app/session.test.ts` `Session > asset base > fetches every asset under / by default` | yes - exact arrays, and none under `/MetroRig/` or `//` |
| C7 | `tests/assets.test.ts` `asset paths > only the Session resolves asset paths` | yes - a literal or template root asset path in `src/main.ts`, `src/ui/`, `src/audio/` fails it; a path built by `+` concatenation would slip past |
| C8 | shell: `curl -sfo /dev/null` on the page, the WASM and `kit/ride.wav` | no - `-f` without `-w '%{http_code}'` passes on a 3xx; the live `kit/house` and `/MetroRig` answer 301 and would pass. The three URLs answer 200 today |
| C9 | `tests/deploy.test.ts` `deploy workflow > deploys on every push to main` | partly - passes with a `paths:` or `paths-ignore:` filter under `push`, which breaks "every push" |
| C10 | `tests/deploy.test.ts` `deploy workflow > deploys when started by hand` | no - asserts only that the `workflow_dispatch:` key exists; nothing holds "the head of `main`" |
| C11 | `tests/deploy.test.ts` `deploy workflow > compiles the engine before it builds the site` | yes - rustup before `npm run build`, `build` is exactly `npm run build:wasm && vite build`, `copy_wasm.js` exits 1 when cargo produced nothing, artifact path `dist` |
| C12 | `tests/deploy.test.ts` `deploy workflow > deploys only after both test suites pass` | partly - passes with `continue-on-error: true` on the test steps or `if: always()` on `build`/`deploy`, both of which deploy after a red test |
| C13 | `tests/deploy.test.ts` `deploy workflow > queues a newer deploy behind a running one` | yes |
| C14 | `tests/docs.test.ts` `Docs > README links the live site above its features` | yes - a missing `## Features` makes the bound -1 and fails |
| C15 | shell: `gh repo view --json homepageUrl` equals the URL | yes |
| C16 | shell: `vite build` + `grep registerProcessor dist/assets/metronome-processor-*.js` + no `dist/assets/*.ts` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| A dispatch from another branch builds that branch; "the head of `main`" (GHP-06) is held only by the `github-pages` environment's branch policy, outside the repo, and no check names it | `deploy.yml` checks out `github.ref` with no `ref: main` and no `if:` on `deploy`; `gh api .../environments/github-pages` shows `custom_branch_policies: true` with one policy `main`; C10's test asserts only `/^  workflow_dispatch:/m` | pin the build to `main` in the workflow (`ref: main` on both checkouts, or `if: github.ref == 'refs/heads/main'` on the jobs) and assert it in C10's test, or add a check on the environment's branch policy via `gh api` || 687bc6b - C10 |
| C12 passes on a workflow that deploys after a failing test | `deploy.test.ts` `runs()`/`block()` read only `run:` lines and `needs:`; `continue-on-error: true` on `npm run test:js`, or `if: always()` on `build`, keeps it green | assert that no job or step in `test`, `build`, `deploy` carries `continue-on-error` or an `if:` || 687bc6b - C12 |
| C9 passes with a path filter on `push` | `block(on, 'push')` is matched only against `/branches: \[main\]/` | assert the `push` block is exactly `branches: [main]` (no `paths`, `paths-ignore`, `tags`) || 687bc6b - C9 |
| C8 accepts a redirect where GHP-04 fixes 200 | `curl -sfo /dev/null` exits 0 on 3xx; `curl` on `https://dmartinsid.github.io/MetroRig` answers 301 | compare `curl -so /dev/null -w '%{http_code}'` to `200` for each path || 687bc6b - C8 |
| No check proves the app hands the Session `import.meta.env.BASE_URL`; C5/C6 inject the base by hand, C8 curls static files, so dropping `assetBase` in `src/main.ts` would keep every check green while the live app fetches `/kit/...` | `src/main.ts` `assetBase: import.meta.env.BASE_URL`; the test `asset paths > the composition root hands the Session the base Vite serves from` exists in `tests/assets.test.ts` but no check selects it | name that test in a check for GHP-02 || 687bc6b - C17 |
| C5 proves "every pad sample" on the default timbre only | `padFiles = PAD_TIMBRES[DEFAULT_TIMBRE].files`; Choir, of Choir, New Age, Orchestra, Sweep | switch through every sampled timbre in the test and assert each one's `padLoad` URLs under `/MetroRig/` || 687bc6b - C5 |

Own examples, run at 3a76502 as a throwaway vitest file, then deleted. All held:
- `withBase('', '/kit/ride.wav')` gives `/kit/ride.wav`; `withBase('/a/b/', …)` gives `/a/b/kit/ride.wav`; `withBase('/MetroRig/', 'kit/ride.wav')` (no leading slash) gives `/MetroRig/kit/ride.wav`; `withBase('/MetroRig//', '//kit/ride.wav')` gives `/MetroRig/kit/ride.wav`; `./` and an absolute `https://` base join correctly.
- A Session with base `/a/b/` that plays, switches to the `cowbell` click, opens Improv and switches to Orchestra: all 81 engine URLs sit under `/a/b/`, none under `/a/b//`, and Orchestra's pads match the data. Base `/MetroRig` with no trailing slash gives `/MetroRig/engine.wasm`.

Live site (read-only): the page, the WASM, `kit/ride.wav`, `pads/choir/C3.flac` and `woodblock.wav` answer 200, and the index references `/MetroRig/assets/`. The deploy run for `3a76502` (push, main) succeeded.
