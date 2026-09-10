---
title: "Stub at the module boundary instead of refactoring upstream for testability"
areas: ["testing", "upstream"]
topics: ["test-isolation", "merge-debt", "module-resolution"]
---

# Stub at the module boundary instead of refactoring upstream for testability

**Context**: `src/models/DMX/fixture.model.js` constructs a `MovingHead` (Three.js) in its
constructor, via two imports — `../../plugins/visualizer/moving_head` and
`../../plugins/visualizer/controls`. Under jsdom there is no WebGL, so the obvious reading is
that the domain layer is untestable until `fixture.model.js` lazy-initialises its 3D model. That
refactor is the first thing an agent proposes, and `CLAUDE.md §5` carries an explicit warning
against it for exactly that reason.

**Problem**: The refactor works and is still wrong. `fixture.model.js` is an upstream file, so
editing it creates permanent merge debt against `ASLS-org/studio` — every future upstream change
to that file now needs a manual three-way resolution, forever, in exchange for a test-harness
benefit that can be had for free. The general trap: "make the source testable" feels like
improving the code, but in a fork it is a trade of a recurring cost against a one-off one, and
the one-off option usually exists.

**Rule**: When a module cannot load in the test environment, replace it at the **resolver**, not
at the call site. `vitest.config.mjs` uses `resolve.alias` in **array form** (order matters —
regexes first) to swap `moving_head`, `controls` and `wsc.connection` for stubs in `test/stubs/`,
and an inline `swietlik:worker-stub` plugin (`enforce: 'pre'`) to resolve `?worker` specifiers to
an inert class. Net upstream refactoring required to make the whole domain layer testable: zero.
Before proposing any `src/` edit justified by testability, ask what a resolver alias, a stub, or a
setup shim would do instead.

**Applies to**: Everything under `src/models/`, `src/singletons/` and `src/plugins/`, and any
future decision to add a test harness for a surface that currently has none (Vue SFCs, WebGL).
The corollary also holds: a third visualizer import into `src/models/` would break this strategy,
which is why that boundary is a frozen contract surface, not a style preference.
