# Świetlik — Code review checklist

Apply only the sections the diff touches; skip the rest. Adapted from
[Open Mercato's `.ai/review-checklist.md`](https://github.com/open-mercato/open-mercato) (22
sections, ~380 checks for an ERP platform) down to what this codebase can actually violate. Their
list is long because their surface is; copying its length rather than its method would be the
cargo-cult version.

Used by the `code-reviewer` subagent (`.claude/agents/code-reviewer.md`) and by anything claiming
a diff is ready.

---

## 0. Evidence — check this first, and refuse to proceed without it

Open Mercato's blunt framing: *a mention does not bind.* A gate that is claimed but never run is
indistinguishable, in a transcript, from one that passed.

- [ ] The gate was **run**, not described: `npm run lint:ci`, `npm run test:run`, and
      `npm run build` for anything touching the build. Exit statuses reported.
- [ ] `lint:ci` is at **0 errors**. Warning count is 13 or fewer and unchanged (`CLAUDE.md §9`).
- [ ] The evidence **covers the changed surface**. A green test run says nothing about
      `src/views/**`, `src/plugins/visualizer/**`, or `wsc.connection.js` — those have no test
      coverage at all. See [the evidence lesson](lessons/tests-and-lint-are-not-evidence-that-the-app-renders.md).
- [ ] Anything visual, or touching the visualizer or `index.html`, has a
      [`verification.md`](verification.md) pass attached — app started, fixture patched, beam
      confirmed, console clean.
- [ ] "All fixed" claims enumerate what was fixed, per item, with file paths. A bare "all fixed"
      after a review round is re-checked against the source, not taken at face value.

## 1. Additive-first and merge debt

- [ ] Could this have been a **new file, a wrapper, or a plugin** instead of an upstream edit? If
      yes and it wasn't, that is a finding, not a style note.
- [ ] Every touched file that exists on `develop` has a line in
      [`upstream-diff.md`](upstream-diff.md), **in this change**, with a reason.
- [ ] No upstream file was edited purely to make something testable — stub at the module boundary
      instead ([lesson](lessons/stub-at-the-module-boundary-instead-of-refactoring-upstream.md)).
- [ ] No commits on `develop`. No history rewriting, force-push, or amend.

## 2. Contract surfaces

Against [`contract-surfaces.md`](contract-surfaces.md):

- [ ] Showfile format (`.asls`) unchanged, or the change is additive-with-default and an older
      showfile still loads correctly. **Any other change here is a blocker.**
- [ ] No third visualizer import into `src/models/`.
- [ ] Capability added on `$show` / a module beside it, not by a view reaching into a model.
- [ ] Licence and attribution surfaces untouched (`COPYING`, `public/COPYING.txt`, `CREDITS.html`,
      splash, toolbar strip, `package.json` contributors). A diff touching these is a blocker
      unless it is a deliberate, explained attribution change.
- [ ] Nothing implements or re-proposes a `KILL`-ranked item from
      [`product-vision.md`](product-vision.md) without a superseding entry in that document.

## 3. Architecture & domain model

- [ ] New model classes extend `Proxify` where Vue reactivity is expected
      (`src/models/utils/proxify.utils.js`).
- [ ] **No new import-time singletons.** Export a factory or class; let the caller construct it
      ([lesson](lessons/import-time-singletons-defeat-test-isolation.md)).
- [ ] Pool/model naming follows `CLAUDE.md §6`: `*.model.js`, `*.pool.model.js`.
- [ ] No feature assumes a URL, deep link, or browser back/forward — the router uses
      `createMemoryHistory()`.
- [ ] Nothing assumes a single local machine or filesystem-only persistence; a hosted multi-user
      version must stay possible ([`roadmap.md`](roadmap.md) product goals).
- [ ] Nothing in the previz path requires a WSC gateway to be running. Hardware output is
      orthogonal to the 3D preview.

## 4. UI

- [ ] An existing `uikit.*.vue` primitive was checked **before** a new control was written.
- [ ] File naming follows the taxonomy: `*.activity.vue`, `*.fragment.vue`, `*.widget.*.vue`,
      `_popups/popup.*.vue`.
- [ ] Layered UX respected: say what the simple layer shows and what the pro layer exposes
      ([`product-vision.md`](product-vision.md)). A feature that only serves console-trained
      operators needs an explicit reason.

## 5. Tests

- [ ] Changed behaviour in `src/models/`, `src/singletons/` or `src/plugins/` has a test in
      `test/**/*.spec.js`. Untested domain changes are a finding.
- [ ] Tests **assert behaviour**, not just execute code. A test that constructs an object and
      checks nothing meaningful is coverage theatre — this is the dominant failure mode of
      agent-written tests, and the reason mutation testing is on the roadmap
      ([proposal](agentic-harness-proposal.md)).
- [ ] Both a happy path and at least one failure/edge case where the behaviour has one.
- [ ] No new `resolve.alias` entry or stub added without a note on why the module cannot load.
- [ ] `vitest.config.mjs` and `vite.config.mjs` still separate.
- [ ] Missing coverage is **named explicitly** in the review, with the file and case that should
      exist, rather than waved at.

## 6. Dependencies & build

- [ ] No new production dependency without a reason — `Ask First`.
- [ ] `@asls/wsc-client` / `@asls/wsc-sdk` still at or above `2.2.0`, `.env`'s `WSC_VERSION`
      aligned ([lesson](lessons/a-pinned-dependencys-metadata-can-be-platform-wrong.md)).
- [ ] Nothing added to `public/` whose name could shadow a module URL
      ([lesson](lessons/a-public-file-can-shadow-a-root-raw-module-url.md)).
- [ ] No Electron work (`CLAUDE.md §3` — out of scope, `Ask First`).
- [ ] `node_modules/`, `dist/`, `out/` not committed.

## 7. Code quality

- [ ] JSDoc on new public members, matching surrounding density (`@class`, `@classdesc`,
      `@param`, `@return`, `@public`/`@private`) — upstream is well-annotated and the docma build
      consumes it.
- [ ] No one-letter names. No comments restating what the code says.
- [ ] No docstrings, comments, or annotations added to code the diff did not otherwise change —
      it inflates the upstream diff for nothing.
- [ ] New code is self-consistent with the surrounding file's style rather than the author's.

## 8. Documentation & knowledge

- [ ] A correction during this work that produced reusable knowledge became **one** lesson record
      plus **one** index row ([`lessons.md`](lessons.md)) — not a paragraph in `CLAUDE.md`.
- [ ] A hard boundary discovered during this work went into `CLAUDE.md` or
      [`contract-surfaces.md`](contract-surfaces.md), not into a lesson.
- [ ] A task that burned tool calls rediscovering known facts produced a new
      [`task-router.md`](task-router.md) row.
- [ ] Factual claims in docs (test counts, warning counts, file paths) still hold.

---

## Severity

Report findings with a severity and a concrete fix. Budget the output: a review that returns forty
low-severity notes buries the one blocker, which is a worse outcome than missing the forty.

| Severity | Meaning |
|---|---|
| **Blocker** | Licence/attribution violation, showfile-format break, unlogged upstream edit, third visualizer import, missing or non-covering evidence, `KILL`-item implementation. |
| **High** | Untested domain behaviour change, a test that asserts nothing, an avoidable upstream edit, a new import-time singleton, a new production dependency without a reason. |
| **Medium** | Naming/taxonomy violations, a duplicated uikit primitive, missing JSDoc on a new public member, an edge case with no test. |
| **Low** | Style, comment noise, docs wording. Group these; do not enumerate each one. |
