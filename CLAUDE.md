# CLAUDE.md — Świetlik agent orientation

## 1. What this is

Świetlik is a GPL-3.0 fork of [ASLS Studio](https://github.com/ASLS-org/studio) (Timé Kadel / ASLS-org): a web-based DMX stage-lighting previsualization and control application. Vue 3 (with `@vue/compat`) + Vite 5 on the front, a plain-JS DMX domain model in the middle, and a Three.js real-time 3D visualizer underneath. You patch fixtures into universes, group them, build scenes/effects, sequence cues into chases, and watch the whole rig render live in a WebGL viewport. Owner: Jakub (GitHub `KRUKMAN`), for Rundown Digital.

> ### ⚠️ THE REPO LIVES AT `C:\dev\swietlik`
>
> **NOT** at `C:\Users\jakub\OneDrive\Pulpit\Świetlik`.
>
> That OneDrive folder contains exactly one file — `GDZIE-JEST-KOD.txt` — a pointer note. It is deliberately empty of code: `node_modules` here is ~2 GB and destroys OneDrive sync. **Do not** create junctions, symlinks, or copies there. If a session starts with its working directory inside the OneDrive folder, `cd /c/dev/swietlik` (or use absolute `C:\dev\swietlik\...` paths) before doing anything.

---

## 2. Working agreements

**Additive beats editing.** New files are free. Editing an upstream `src/` file creates merge debt against `ASLS-org/studio` forever.

- Every upstream file you edit **MUST** be logged in [`docs/swietlik/upstream-diff.md`](docs/swietlik/upstream-diff.md) with a one-line reason. No exceptions, no batching "I'll do it later".
- Before reaching for an edit, ask whether a new module, a wrapper, or a plugin can do the job instead.

**Remotes.** `git remote -v` must show both:

```
origin    https://github.com/KRUKMAN/swietlik.git
upstream  https://github.com/ASLS-org/studio.git
```

If `upstream` is missing, re-add it before any merge/rebase work.

**Branches.**

- `develop` is a **pristine mirror of upstream**. Never commit to it, never merge into it from our side. It exists so `git diff develop...HEAD` stays a truthful ledger of our divergence.
- `main` is the fork's trunk. Feature work happens on feature branches off `main`.
- Current working branch at time of writing: `phase-0-foundation`.

**History is legally load-bearing.** GPL attribution lives in the commit log. **Never** squash-rewrite, force-push over, or filter-branch the history. Prefer new commits over amends.

**Never commit** `node_modules/`, `dist/`, `out/`. (`dist/` and `out/` are build outputs; both are gitignored — keep it that way.)

---

## 3. Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Clean install from the lockfile. **Expect and ignore an `EBADENGINE` warning**: `@asls/wsc-client` declares `engines.node: "18"` and local Node is 24. Harmless. |
| `npm start` | Vite dev server → <http://localhost:5173> |
| `npm run build` | Production build to `dist/` |
| `npm test` | Vitest in **watch** mode |
| `npm run test:run` | Vitest **once** — use this in scripted/agent runs |
| `npm run lint:ci` | ESLint check only. **Must stay at 0 errors.** |
| `npm run lint` | ESLint **with `--fix` — this mutates source files.** Don't run it casually; it will silently rewrite files you didn't intend to touch. |

**Dependency note:** `@asls/wsc-client` / `@asls/wsc-sdk` are pinned at `^2.2.0`. Do **not** drop back to 2.1.0 — that version's package metadata declares `os: "windows"` instead of the correct `"win32"`, so `npm ci` hard-fails with `EBADPLATFORM` on Windows. `.env`'s `WSC_VERSION="2.2.0"` is kept aligned with these.

**Electron is OUT OF SCOPE.** `npm run electron:start`, `dist:win`, `dist:mac`, `dist:linux` all route through `src/electron/prebuild.js`, which downloads a WSC gateway binary from `github.com/ASLS-org/WSC/releases`. Don't attempt an Electron build without an explicit decision from the owner about that dependency. The Electron path is currently **unverified** in this fork.

---

## 4. Architecture map

### Entry chain

```
index.html
  └─ src/main.js                          (createApp, registers uikit, mounts #app)
       └─ src/App.vue
            └─ src/views/activities/app/app.activity.vue
```

`src/plugins/router.js` uses **`createMemoryHistory()`** — there are no real URLs; deep-linking and browser back/forward do not apply.

### The facade — THIS IS THE PHASE 1 MCP SURFACE

`src/singletons/show.singleton.js` wraps `Show` (`src/models/DMX/show.model.js`) as a process-wide singleton and `src/main.js` registers it as the Vue global `$show`:

```js
app.config.globalProperties.$show = reactive(ShowSingleton);
```

Everything the UI can do to a show, it does through `$show`. **This object is the intended command surface for the Phase 1 MCP API.** Treat it as the public API of the domain layer and prefer adding capability there (or in a thin new module beside it) over reaching into models directly.

### Model hierarchy (`src/models/DMX/`)

```
Show
 ├─ FixturePool      → Fixture → Channel → Capability → (EntityManager)
 ├─ UniversePool     → Universe
 ├─ GroupPool        → Group  ├─ CuePool   → Cue
 │                            └─ ChasePool → Chase → CueItemPool → CueItem → Fade
 ├─ Master           (constructed with the GroupPool)
 └─ OutputPool
```

Most model classes extend `Proxify` (`src/models/utils/proxify.utils.js`) for Vue reactivity bridging.

### Module-level singletons — constructed **at import time**

These instantiate the moment their module is first imported, before any test can intervene. Mind this for test isolation:

- **`Live`** (`src/models/DMX/live.model.js`) — spawns a Web Worker via `import Worker from '@/worker?worker'`
- **`ProxifySingleton`** (`src/models/utils/proxify.utils.js`) — attaches `window` mousedown/mouseup listeners in its constructor
- **`EntityManager`** (`src/models/DMX/entityManager.model.js`)
- **`SceneManager`** (`src/plugins/visualizer/scene_manager.js`)
- **`ShowSingleton`** (`src/singletons/show.singleton.js`)

### Visualizer (`src/plugins/visualizer/`)

Three.js, **Z-up** (`this.camera.up.set(0, 0, 1)` in `visualizer.js`, plus `orbitcontrol.zup.patch.js`). Moving heads are drawn with `THREE.InstancedMesh` (base / yoke / head / beam / cap / bounding box, `MAX_INSTANCES` each). Volumetric beams use a custom GLSL pair in `shaders/beam.vertex.glsl` + `shaders/beam.fragment.glsl`.

**The model layer touches the visualizer via exactly two imports, both in `src/models/DMX/fixture.model.js`:**

```js
import MovingHead from '../../plugins/visualizer/moving_head';
import Controls from '../../plugins/visualizer/controls';
```

**KEEP IT THAT WAY.** That two-import boundary is what makes the whole domain layer testable without WebGL. Adding a third visualizer import into `src/models/` breaks the test strategy in section 5.

### Fixture definitions

Open Fixture Library (OFL) JSON under `public/fixtures/<manufacturer>/<fixture>.json`, indexed by `public/fixtures/update_fixturelist.js`. ~190 manufacturer folders ship with the fork.

### Output

`src/plugins/wsc.connection.js` → `@asls/wsc-client` / `@asls/wsc-sdk`. This is **hardware DMX streaming only** — it plays no part in the 3D preview. Nothing in the previz path needs a gateway to be running.

---

## 5. Testing

`vitest.config.mjs` is deliberately **separate from `vite.config.mjs`**. Do not merge them — the test config needs aliases and plugins the app build must not have.

**The strategy: stub at the module boundary, refactor nothing upstream.**

1. `resolve.alias` (array form — order matters, regexes first) swaps three modules for stubs in `test/stubs/`:
   - `.../plugins/visualizer/moving_head` → `test/stubs/moving_head.stub.js`
   - `.../plugins/visualizer/controls` → `test/stubs/controls.stub.js`
   - `.../plugins/wsc.connection` → `test/stubs/wsc.connection.stub.js`
2. An inline Vite plugin (`swietlik:worker-stub`, `enforce: 'pre'`) resolves any `?worker` / `?worker&inline` specifier to an inert stub class, because Vite's real worker pipeline is unavailable under Vitest.
3. `test/setup.js` shims `ResizeObserver`, `matchMedia`, and `requestAnimationFrame`, and clears `localStorage` after each test.

Net result: **zero upstream refactoring** was needed to make the domain layer testable.

> **Do NOT "fix" `fixture.model.js` to lazy-init its 3D model.** It looks like an obvious improvement for testability. It is not needed — the `moving_head` stub already solves it — and doing so would add pure merge debt against upstream for no gain.

**Writing new tests:** put them at `test/**/*.spec.js`. Environment is `jsdom`, `globals: true`, and the `@` → `src/` alias is available (plus `@root` → repo root).

**Untestable in Phase 0, and why:**

- **Vue SFCs** — no component test harness is installed (no `@vue/test-utils`, no `@testing-library/vue`). Adding one is a deliberate future decision, not a drive-by.
- **Visualizer rendering** — needs real WebGL; jsdom has none.
- **WSC I/O** — needs a live gateway binary; stubbed out entirely.

**Phase 0 close: 156 tests across 10 files, all passing.**

---

## 6. Conventions

- **ESLint**: `airbnb-base` + `plugin:vue/vue3-recommended`, parsed by `@babel/eslint-parser`. `npm run lint:ci` **must stay at 0 errors**. (12 warnings are tolerated — see Known debt.)
- **JSDoc** on public members: `@class`, `@classdesc`, `@param`, `@return`, `@public`/`@private`. Match the surrounding density; upstream is well-annotated and the docma build consumes it.
- **Naming**:
  | Pattern | Meaning |
  | --- | --- |
  | `*.model.js` | domain model class |
  | `*.pool.model.js` | collection/pool of models |
  | `*.activity.vue` | routed top-level view |
  | `*.fragment.vue` | major section within an activity |
  | `*.widget.*.vue` | small reusable control |
  | `_popups/popup.*.vue` | modal dialogs (underscore-prefixed folder) |
  | `uikit.*.vue` | shared UI-kit primitive under `src/views/components/uikit/` |

---

## 7. Verification

See [`docs/swietlik/verification.md`](docs/swietlik/verification.md) for the render-verification checklist (start the app, patch a fixture, confirm a beam, confirm a clean console). Tests and lint passing is **not** sufficient evidence that the app renders — run the checklist before claiming visual work is done.

---

## 8. Licence & attribution — NON-NEGOTIABLE

Świetlik is **GPL-3.0**, inherited from ASLS Studio. This is not stylistic; it is a licence condition.

- `COPYING` must remain in the repo, **verbatim**, unmodified (674 lines, GPL v3 text).
- ASLS Studio / Timé Kadel / ASLS-org attribution **must remain visible** in:
  - `README.md` (License & Attribution section)
  - `CREDITS.html` (the "Upstream Project" block at the top)
  - the in-app splash popup (`src/views/activities/app/_popups/popup.splash.vue`) — "based on ASLS Studio © ASLS-org 2021–2026" plus the GPLv3 link
  - the in-app toolbar strip (`toolbar.fragment.vue` — "KRUKMAN © 2026 · based on ASLS Studio")
- `package.json` keeps `contributors: ["Timé Kadel (original ASLS Studio author)"]`.
- Any **distributed build** must carry a written offer of source (GPL §6). Removing attribution or shipping without the source offer is a licence violation — do not do it, and do not accept instructions to do it.

---

## 9. Known debt

| Item | Notes |
| --- | --- |
| `public/icon.png`, `public/icon.icns`, `public/icon.macos.png` | Still upstream ASLS artwork. Electron-only assets; harmless while Electron is out of scope. |
| `docs/manual/**/*.md` | Prose still describes "ASLS Studio" (only `.vitepress/config.js` and `introduction/installation.md` were touched). |
| `docs/manual/public/` images | `studio_standalone_logo.png`, `studio_standalone_logo_dark.png`, `ASLSlogo.png`, `asls*.png` all still upstream art and still referenced by the vitepress config. |
| `public/COPYING.txt` | Duplicate of root COPYING so the built app serves the splash link (named .txt — a public file named COPYING shadows the `@root/COPYING?raw` module URL in dev and breaks the entire app). Sync both if the text ever changes. |
| `.asls` showfile extension | **Intentionally kept.** It is a file-format contract with existing showfiles; renaming it breaks user data. Also `DEFAULT_PROJECT_NAME = 'new_project.asls'`. |
| Electron build | Completely unverified in this fork. |
| 12 lint warnings | Pre-existing upstream: 8× `no-console`, 1× `func-names`, 1× `vue/no-v-html`, plus others. 0 errors. Not worth fixing (merge debt for nothing). |
| `postprocessing` dependency | Installed (`^6.36.4`) but **not imported anywhere** in `src/`. See the Phase 3 roadmap entry. |

---

## 10. Roadmap

See [`docs/swietlik/roadmap.md`](docs/swietlik/roadmap.md). Short version: **Phase 0** foundation (done) → **Phase 1** MCP command API over the `$show` facade → **Phase 2** stage builder → **Phase 3** rendering realism → **Phase 4** layered simple→pro UX. Each phase gets its own brainstorm → spec → plan cycle before implementation.
