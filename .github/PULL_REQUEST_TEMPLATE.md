<!--
Świetlik PRs are authored by agents. This template exists so the evidence for a change travels
with it, instead of living in a session transcript nobody will read again.
Adapted from open-mercato/open-mercato's .github/PULL_REQUEST_TEMPLATE.md.
-->

## Summary

What changed and why. One paragraph.

## Evidence

<!-- Report exit statuses you actually observed. A gate that was claimed but not run is
indistinguishable in a transcript from one that passed — which is why this section is first. -->

| Gate | Exit | Notes |
|---|---|---|
| `npm run lint:ci` | | must be 0 errors; warning count ≤ 12 |
| `npm run test:run` | | |
| `npm run build` | | |

**Does this evidence cover what changed?**

- [ ] Change is confined to `src/models/` / `src/singletons/` / `src/plugins/` (non-visualizer) /
      `test/` — the gate above is sufficient.
- [ ] Change touches `src/views/`, `src/plugins/visualizer/`, `wsc.connection.js`, or
      `index.html` — these have **no test coverage**, so a `docs/swietlik/verification.md` pass is
      attached below.

<details>
<summary>Verification pass (if applicable)</summary>

<!-- App started, fixture patched, beam confirmed, console clean. Screenshot welcome. -->

</details>

## Upstream divergence

- [ ] This change touches **no** file that exists on `develop` (purely additive).
- [ ] It edits upstream file(s), and every one has a line with its reason in
      `docs/swietlik/upstream-diff.md` **in this PR**.

<!-- If you edited upstream: say in one line why an additive approach (new file, wrapper, plugin)
wasn't viable. "It was easier" is not a reason. -->

## Contract surfaces

Against `docs/swietlik/contract-surfaces.md`:

- [ ] Showfile (`.asls`) format unchanged, or additive-with-default and older showfiles still load.
- [ ] `src/models/` still has exactly **two** imports from `plugins/visualizer/`.
- [ ] Licence and attribution surfaces untouched (`COPYING`, `public/COPYING.txt`, `CREDITS.html`,
      splash popup, toolbar strip, `package.json` contributors).
- [ ] No `KILL`-ranked item from `docs/swietlik/product-vision.md` implemented without a
      superseding entry in that document.
- [ ] No commits on `develop`; no history rewriting, force-push, or amend.

## Tests

- [ ] Changed domain behaviour has a test under `test/**/*.spec.js`.
- [ ] Each new test **asserts behaviour** — something specific would have to break for it to fail.
- [ ] Happy path plus at least one failure/edge case where the behaviour has one.
- [ ] Missing coverage, if any, is named below with the file and case that should exist.

## Knowledge

- [ ] A correction during this work became **one** `docs/swietlik/lessons/` record plus **one**
      index row (or: nothing reusable was learned).
- [ ] A hard boundary discovered went into `CLAUDE.md` / `contract-surfaces.md`, not a lesson.
- [ ] A new `docs/swietlik/task-router.md` row was added if this task burned calls rediscovering
      known facts.
- [ ] `node .claude/scripts/check-lessons.mjs`, `check-doc-links.mjs`, `check-claims.mjs` and
      `check-instruction-budget.mjs` pass (CI runs these).

## Scope

- [ ] Nothing here needed `Ask First` (new production dependency, architecture change, Electron,
      contract surface, scope reduction) — or it was asked and the answer is linked.

## Linked issues

<!-- Fixes #... -->
