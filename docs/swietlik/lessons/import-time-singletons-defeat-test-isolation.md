---
title: "Import-time singletons defeat test isolation and cannot be mocked after the fact"
areas: ["testing", "architecture"]
topics: ["test-isolation", "reactivity", "side-effects"]
---

# Import-time singletons defeat test isolation and cannot be mocked after the fact

**Context**: Five modules in this codebase instantiate at the moment they are first imported,
before any test body runs: `Live` (`src/models/DMX/live.model.js`, which spawns a Web Worker),
`ProxifySingleton` (`src/models/utils/proxify.utils.js`, which attaches `window` mousedown and
mouseup listeners **in its constructor**), `EntityManager`, `SceneManager`
(`src/plugins/visualizer/scene_manager.js`) and `ShowSingleton`
(`src/singletons/show.singleton.js`).

**Problem**: A `vi.mock` or a `beforeEach` that tries to neutralise one of these is already too
late — the side effect happened during module resolution. The symptoms do not look like a test
problem: a listener from a previous test file fires during an unrelated test, or state leaks
between specs, or a worker spawn fails in a test that never mentions workers. Chasing the
symptom leads to sprinkling cleanup code; the actual cause is the import graph.

**Rule**: Treat import-time construction as a property of the module, not a bug to be worked
around in tests. Two consequences. (1) When a test needs one of these neutralised, intervene at
the resolver — a `resolve.alias` stub in `vitest.config.mjs`, which runs before any import — not
with a runtime mock. (2) When writing **new** code, do not add another one: export a factory or a
class and let the caller construct it, so the next test author has the choice these five took
away. `test/setup.js` exists for the residue (shimming `ResizeObserver`, `matchMedia`,
`requestAnimationFrame`, clearing `localStorage` after each test) — it is the floor, not a
licence to add more import-time effects.

**Applies to**: Every new module under `src/models/`, `src/singletons/` and `src/plugins/`, and
any diagnosis of cross-test state leakage. Check the import chain of the spec file before
concluding a test is flaky.
