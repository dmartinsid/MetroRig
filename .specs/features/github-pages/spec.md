# GitHub Pages Specification

**Approved**: 2026-11-08 - user: "Sim"

## Problem Statement

MetroRig only runs on a machine that clones the repo and starts the dev server. Nobody can open it from a link. The repo is now public, so GitHub Pages can serve it for free at `https://dmartinsid.github.io/MetroRig/`, but the app fetches every asset from the domain root (`/kit/...`, `/pads/...`, `/pkg/...`), which a project site does not serve.

## Goals

- [ ] `https://dmartinsid.github.io/MetroRig/` loads MetroRig, which plays the click, the drum kit and a pad with no failed request
- [ ] Every push to `main` whose tests pass publishes that commit, with no manual step
- [ ] `npm run dev` keeps serving the app at `http://localhost:3000/`

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| A custom domain | Q2: the site lives at the `github.io` subpath |
| Preview deploys for pull requests | Not asked; Pages serves one site per repo |
| Running the tests on pull requests | Not asked; the workflow runs on `main` and by hand |
| Offline use, a service worker, a web app manifest | Not asked |
| Analytics | Not asked |
| Changing visibility or plan | Q1: the user made the repo public |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Hosting | GitHub Pages on the public repo | Q1: the user made the repo public | y |
| Address | `https://dmartinsid.github.io/MetroRig/`, base `/MetroRig/` | Q2: "recomendacao" | y |
| Trigger | Push to `main` and `workflow_dispatch` | Q3: "recomendacao" | y |
| Tests gate the deploy | `test:js` and `test:rust` run first; a failure publishes nothing | Q4: "recomendacao" | y |
| WASM source | CI compiles the engine with `npm run build` | Q5: "recomendacao" | y |
| Site link | In the README and in the repo's Website field | Q6: "recomendacao" | y |
| Remote actions | Claude enables Pages, sets the homepage and pushes, after an explicit ok | Q7: "recomendacao" | y |
| Base in dev | `npm run dev` keeps base `/`; only `vite build` uses `/MetroRig/` | Q2's recommendation: local dev does not change | y |
| Dependency install in CI | `npm install`, not `npm ci` | `package-lock.json` is in `.gitignore` and not tracked | y |
| Concurrent deploys | One Pages deploy at a time; a running one is not cancelled | GitHub's Pages starter workflow does this, and a half-cancelled deploy is worse than a late one | y |
| COOP/COEP headers | Not served | Pages cannot set headers, and the app uses no `SharedArrayBuffer` | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Open MetroRig from a link ⭐ MVP

**User Story**: As a musician, I want to open MetroRig from a URL so that I can practise without installing anything.

**Why P1**: It is the feature.

**Acceptance Criteria**:

1. The production build SHALL reference every script, stylesheet and worklet it emits under `/MetroRig/`  <!-- GHP-01 -->
2. WHEN the app runs from a build with base `/MetroRig/` THEN the system SHALL fetch the engine WASM, every drum sample and every pad sample under `/MetroRig/`  <!-- GHP-02 -->
3. WHILE the app runs on the dev server the system SHALL fetch the same assets under `/`  <!-- GHP-03 -->
4. WHEN `https://dmartinsid.github.io/MetroRig/` is opened after a deploy THEN the page, the WASM and a drum sample SHALL each answer HTTP 200  <!-- GHP-04 -->

**Independent Test**: Run `npm run build` and `npx vite preview`, open `http://localhost:4173/MetroRig/`, press play: click, kit and a pad sound, and the network log shows no 404.

---

### P1: Publish on every push to main ⭐ MVP

**User Story**: As the maintainer, I want each push to `main` to publish itself so that the site never lags the code.

**Why P1**: Without it the site goes stale on the first commit after launch.

**Acceptance Criteria**:

1. WHEN a commit is pushed to `main` THEN the workflow SHALL build the site and deploy it to GitHub Pages  <!-- GHP-05 -->
2. WHEN the workflow is started by hand (`workflow_dispatch`) THEN the workflow SHALL build and deploy the head of `main`  <!-- GHP-06 -->
3. The workflow SHALL compile the engine from `engine/` with `npm run build`, never deploying the committed `public/pkg/metrorig_audio_bg.wasm` as is  <!-- GHP-07 -->
4. IF `npm run test:js` or `npm run test:rust` fails THEN the workflow SHALL stop before deploying, and the site SHALL keep serving the last deployed commit  <!-- GHP-08 -->
5. WHILE a deploy is running the workflow SHALL queue a newer one instead of running both or cancelling the running one  <!-- GHP-09 -->

**Independent Test**: Push a commit to `main`; the Actions run goes green and the site serves it. Push one with a failing test; the run stops red before the deploy job and the site is unchanged.

---

### P2: Find the site from the repo

**User Story**: As a visitor of the repo, I want a link to the live app so that I can try it before cloning.

**Why P2**: The site works without it.

**Acceptance Criteria**:

1. The README SHALL link to `https://dmartinsid.github.io/MetroRig/` above its Features section  <!-- GHP-10 -->
2. The repository's Website field SHALL hold `https://dmartinsid.github.io/MetroRig/`  <!-- GHP-11 -->

**Independent Test**: Open the repo on GitHub; the About box and the README both link to the site.

---

## Edge Cases

- IF the Rust build fails in CI THEN the workflow SHALL stop before deploying (covered by GHP-07 and GHP-08: the build runs before the deploy job)
- IF an asset path is added later without the base THEN `tests/` SHALL fail naming the file (part of GHP-02's proof)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| GHP-01 | P1: Open from a link | Execute | Pending |
| GHP-02 | P1: Open from a link | Execute | Pending |
| GHP-03 | P1: Open from a link | Execute | Pending |
| GHP-04 | P1: Open from a link | Execute | Pending |
| GHP-05 | P1: Publish on push | Execute | Pending |
| GHP-06 | P1: Publish on push | Execute | Pending |
| GHP-07 | P1: Publish on push | Execute | Pending |
| GHP-08 | P1: Publish on push | Execute | Pending |
| GHP-09 | P1: Publish on push | Execute | Pending |
| GHP-10 | P2: Find the site | Execute | Pending |
| GHP-11 | P2: Find the site | Execute | Pending |

**Coverage:** 11 total, 0 mapped to tasks, 11 unmapped ⚠️ (Tasks phase follows approval)

## Sources

- The user's request: "Vamos fazer o deploy no metrorig via github pages nessa tarefa"
- Grilling Q1-Q7, answered "Transformei o repo em publico pra q1, q2, q3, q4, q5, q6 q7 recomendacao"

---

## Success Criteria

- [ ] The site loads and plays at `https://dmartinsid.github.io/MetroRig/` with zero failed requests
- [ ] The first push after approval deploys with no manual step besides enabling Pages
