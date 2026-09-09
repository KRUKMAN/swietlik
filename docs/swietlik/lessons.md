# Świetlik — Lessons

A retrieval index, **not** a session-start document. Route the task first (see
[`task-router.md`](task-router.md)), then open only the records whose areas or topics match.

Adopted from [Open Mercato's `.ai/lessons.md`](https://github.com/open-mercato/open-mercato)
(133 records at the time of study). The shape matters: hard-won knowledge that lives only in a
closed session's transcript is knowledge the next agent pays for again. Prose in `CLAUDE.md`
does not scale to hundreds of facts — an index of tagged one-page records does, because the
agent loads the index and then four records instead of everything.

## How to use this catalogue

1. Start from the areas the task matches: `architecture`, `domain-model`, `visualizer`, `ui`,
   `testing`, `verification`, `build-tooling`, `dependencies`, `upstream`, `agent-workflow`,
   `licence`.
2. Narrow with topics when the task is cross-cutting (`test-isolation`, `merge-debt`,
   `module-resolution`, `reactivity`, `evidence`, …).
3. Open only the linked records that apply. **Do not bulk-read `lessons/`.**

```bash
rg -n '\b<area-or-topic>\b' docs/swietlik/lessons.md
rg -l 'areas:.*"<area>"' docs/swietlik/lessons/*.md
```

## Adding a lesson

- One reusable lesson per `docs/swietlik/lessons/<kebab-case-slug>.md`. Update an existing
  record rather than duplicating it.
- Front matter keys are exactly `title`, `areas`, `topics`, JSON-valued. `title` must match the
  H1. 1+ area from the list above, 2–6 kebab-case topics.
- Body sections, in order: **Context** (the concrete evidence — name the file, the symptom),
  **Problem** (why the naive move is wrong), **Rule** (the durable, actionable instruction),
  **Applies to** (the surface this governs).
- Add exactly one catalogue row below. Keep titles stable once cited.
- A **hard boundary** belongs in `CLAUDE.md` or [`contract-surfaces.md`](contract-surfaces.md),
  not here. A lesson carries the evidence, the recurring failure mode, and the durable rule —
  it does not replace a rule that must be read every session.
- Run `node .claude/scripts/check-lessons.mjs` before committing.

The trigger is specific: **after a correction produces reusable knowledge.** Not after every
task, and not as a place to park notes. If the same mistake could plausibly be made again by an
agent with no memory of this session, it is a lesson.

---

## Catalogue

### testing

- [Stub at the module boundary instead of refactoring upstream for testability](lessons/stub-at-the-module-boundary-instead-of-refactoring-upstream.md) — area:testing,upstream; topic:test-isolation,merge-debt,module-resolution
- [Import-time singletons defeat test isolation and cannot be mocked after the fact](lessons/import-time-singletons-defeat-test-isolation.md) — area:testing,architecture; topic:test-isolation,reactivity,side-effects

### verification

- [Tests and lint are not evidence that the app renders](lessons/tests-and-lint-are-not-evidence-that-the-app-renders.md) — area:verification,testing,ui; topic:evidence,coverage-honesty,visualizer

### build-tooling

- [A file in public/ can shadow a root ?raw module URL and break the whole app](lessons/a-public-file-can-shadow-a-root-raw-module-url.md) — area:build-tooling,licence; topic:module-resolution,static-assets,dev-vs-build

### dependencies

- [A pinned dependency's own metadata can be platform-wrong — pin forward, not back](lessons/a-pinned-dependencys-metadata-can-be-platform-wrong.md) — area:dependencies,build-tooling; topic:install-failures,platform-windows,version-pins
