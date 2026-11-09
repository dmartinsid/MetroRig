# github-pages proofs

**HEAD**: 3a76502
**Tree**: clean
**Shell**: /bin/sh
**Result**: 18 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `npx vite build --logLevel error && grep -q '"/MetroRig/assets/' dist/index.html && ! grep -qE '(src/href)="/(a` | pass |
| C2 | `npx vite build --logLevel error && grep -lq '/MetroRig/assets/metronome-processor-[A-Za-z0-9_-]*\.js' dist/ass` | pass |
| C3 | `run unit / ✓ tests/viteConfig.test.ts > vite config > builds under /MetroRig/ and serves under /` | pass |
| C4 | `run unit / ✓ tests/assets.test.ts > withBase > joins a base to a root path with one slash` | pass |
| C5 | `run unit / ✓ tests/app/session.test.ts > Session > asset base > fetches every asset under /MetroRig/` | pass |
| C6 | `run unit / ✓ tests/app/session.test.ts > Session > asset base > fetches every asset under / by default` | pass |
| C7 | `run unit / ✓ tests/assets.test.ts > asset paths > only the Session resolves asset paths` | pass |
| C8 | `for p in '' pkg/metrorig_audio_bg.wasm kit/ride.wav; do curl -sfo /dev/null "https://dmartinsid.github.io/Metr` | pass |
| C9 | `run unit / ✓ tests/deploy.test.ts > deploy workflow > deploys on every push to main` | pass |
| C10 | `run unit / ✓ tests/deploy.test.ts > deploy workflow > deploys when started by hand` | pass |
| C11 | `run unit / ✓ tests/deploy.test.ts > deploy workflow > compiles the engine before it builds the site` | pass |
| C12 | `run unit / ✓ tests/deploy.test.ts > deploy workflow > deploys only after both test suites pass` | pass |
| C13 | `run unit / ✓ tests/deploy.test.ts > deploy workflow > queues a newer deploy behind a running one` | pass |
| C14 | `run unit / ✓ tests/docs.test.ts > Docs > README links the live site above its features` | pass |
| C15 | `test "$(gh repo view dmartinsid/MetroRig --json homepageUrl -q .homepageUrl)" = https://dmartinsid.github.io/M` | pass |
| C16 | `npx vite build --logLevel error && grep -q registerProcessor dist/assets/metronome-processor-*.js && ! ls dist` | pass |
| Build | `npm run build` | pass |
| Build | `npm run test:rust` | pass |

## Output

`Run unit` - exit 0

```
 ✓ tests/app/session.test.ts > Session > keeps unsaved edits when the user declines a song
 ✓ tests/app/session.test.ts > Session > edits a step
 ✓ tests/app/session.test.ts > Session > sets the Trainer
 ✓ tests/app/session.test.ts > Session > shows the Trainer fields as typed
 ✓ tests/app/session.test.ts > Session > presses a chord
 ✓ tests/app/session.test.ts > Session > changes the timbre
 ✓ tests/app/session.test.ts > Session > changes the pad volume
 ✓ tests/app/session.test.ts > Session > sends every engine and storage call through the adapters it receives
 ✓ tests/app/session.test.ts > Session > asset base > fetches every asset under /MetroRig/
 ✓ tests/app/session.test.ts > Session > asset base > fetches every asset under / by default

 Test Files  5 passed (5)
      Tests  29 passed (29)
   Start at  23:13:58
   Duration  479ms (transform 254ms, setup 0ms, collect 548ms, tests 48ms, environment 1ms, prepare 374ms)
```

`npx vite build --logLevel error && grep -q '"/MetroRig/assets/' dist/index.html && ! grep -qE '(src/href)="/(a` - exit 0

```
(no output)
```

`npx vite build --logLevel error && grep -lq '/MetroRig/assets/metronome-processor-[A-Za-z0-9_-]*\.js' dist/ass` - exit 0

```
(no output)
```

`for p in '' pkg/metrorig_audio_bg.wasm kit/ride.wav; do curl -sfo /dev/null "https://dmartinsid.github.io/Metr` - exit 0

```
(no output)
```

`test "$(gh repo view dmartinsid/MetroRig --json homepageUrl -q .homepageUrl)" = https://dmartinsid.github.io/M` - exit 0

```
(no output)
```

`npx vite build --logLevel error && grep -q registerProcessor dist/assets/metronome-processor-*.js && ! ls dist` - exit 0

```
(no output)
```
