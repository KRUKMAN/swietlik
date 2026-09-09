---
title: "Tests and lint are not evidence that the app renders"
areas: ["verification", "testing", "ui"]
topics: ["evidence", "coverage-honesty", "visualizer"]
---

# Tests and lint are not evidence that the app renders

**Context**: Phase 0 closed with 156 passing tests across 10 files and `lint:ci` at 0 errors. All
156 tests cover the plain-JS domain model. **Zero** cover a Vue SFC (no `@vue/test-utils`, no
`@testing-library/vue` is installed), zero cover visualizer rendering (jsdom has no WebGL), and
zero cover WSC hardware output (stubbed out entirely). A green suite is therefore fully
compatible with an app that white-screens on load.

**Problem**: "Tests pass, lint passes, done" is the single easiest false claim to make in this
repo, because it is *true* and *irrelevant* at the same time. The evidence is real; it just does
not cover the surface that changed. Three concrete defect classes slip straight through: a broken
Vue template or a bad prop, a visualizer change that throws at first frame, and a module-URL
collision that only manifests in the dev server (see
[the `public/` shadowing lesson](a-public-file-can-shadow-a-root-raw-module-url.md)).

**Rule**: Match the evidence to the changed surface. A change confined to `src/models/`,
`src/singletons/` or `test/` is covered by `npm run test:run`. A change touching `src/views/`,
`src/plugins/visualizer/`, `src/plugins/wsc.connection.js` or `index.html` is **not** — it owes a
pass of [`verification.md`](../verification.md): start the app, patch a fixture, confirm a beam,
confirm a clean console. State which gate you ran and what it covers; never let a green suite
stand in for a surface it does not touch. `.claude/harness.json` → `untestable.paths` lists the
uncovered surfaces machine-readably so a skill or hook can make the same distinction.

**Applies to**: Every completion claim. Also to test-count claims in documentation — if
`CLAUDE.md` says 156 tests and the suite reports otherwise, one of them is lying, and
`.claude/scripts/check-claims.mjs` exists to say which.
