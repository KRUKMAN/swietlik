# Świetlik — Task Router

**Before any research or coding, match the task to this table and read every matching row's
sources.** A single task often matches several rows; all of them apply. Only fall back to
open-ended exploration (`Explore` subagents, repo-wide grep) for topics no row covers — and when
that happens, add the row afterwards.

Adopted from [Open Mercato's `AGENTS.md` Task Router](https://github.com/open-mercato/open-mercato/blob/main/AGENTS.md).
The point is not documentation. It is that an agent which reads the right three files first does
not spend its first twenty tool calls rediscovering facts this repo already wrote down — and does
not miss the one constraint that makes its plan wrong.

Shorthand: `CLAUDE.md §N` = that numbered section. `lessons:<tag>` = scan
[`lessons.md`](lessons.md) for rows carrying that area/topic tag and open only the matching records.

---

## Domain model & show data

| Task | Read first |
|---|---|
| Anything touching fixtures, universes, groups, cues, chases, scenes, effects, the master | `CLAUDE.md §4` (model hierarchy) + the relevant `src/models/DMX/*.model.js` |
| Adding a capability the UI should be able to invoke | `CLAUDE.md §4` → *The facade*. Add it on `$show` / `src/singletons/show.singleton.js`, or a thin new module beside it — **not** by reaching into models from a view |
| Vue reactivity behaving oddly on a model | `src/models/utils/proxify.utils.js` + `lessons:reactivity` |
| Test isolation problems, "why is this already constructed?" | `CLAUDE.md §4` → *Module-level singletons constructed at import time* + `CLAUDE.md §5` |
| Changing the showfile format, or anything read/written as `.asls` | [`contract-surfaces.md`](contract-surfaces.md) → Showfile format. **This is a FROZEN surface — `Ask First`.** |
| Fixture definitions, OFL JSON, the fixture index | `CLAUDE.md §4` → *Fixture definitions* + `public/fixtures/update_fixturelist.js` + `test/helpers/ofl.js` |

## Visualizer & rendering

| Task | Read first |
|---|---|
| Any Three.js / WebGL / beam / shader work | `CLAUDE.md §4` → *Visualizer* (Z-up, `InstancedMesh`, the GLSL beam pair) |
| Wanting to import something from `plugins/visualizer/` into `src/models/` | **Stop.** `CLAUDE.md §4` → the two-import boundary, and [`contract-surfaces.md`](contract-surfaces.md) → Test-boundary imports. A third import breaks the whole test strategy; this is `Ask First`. |
| Rendering realism, post-processing, the unused `postprocessing` dep | [`roadmap.md`](roadmap.md) Phase 3 + [`product-vision.md`](product-vision.md) + `CLAUDE.md §9` |
| Proving a visual change actually renders | [`verification.md`](verification.md). Tests and lint are **not** evidence of rendering. |

## UI & views

| Task | Read first |
|---|---|
| New or changed Vue view, fragment, widget, popup | `CLAUDE.md §6` → *Naming* (the `*.activity.vue` / `*.fragment.vue` / `*.widget.*.vue` / `_popups/` taxonomy) |
| Reusing a UI primitive — check BEFORE building one | `src/views/components/uikit/` (the `uikit.*.vue` family) |
| Routing, deep links, browser back/forward | `CLAUDE.md §4` → `createMemoryHistory()`. There are no URLs. Do not design a feature that assumes one. |
| Layered simple→pro UX decisions | [`product-vision.md`](product-vision.md) + the `lighting-consultant` subagent |

## Testing & evidence

| Task | Read first |
|---|---|
| Writing any test | `CLAUDE.md §5` + an existing neighbour in `test/models/` |
| A module won't load under Vitest (worker, WebGL, WSC) | `CLAUDE.md §5` → the alias + `swietlik:worker-stub` strategy, and `test/stubs/` |
| Tempted to refactor `src/` "to make it testable" | `CLAUDE.md §5` → the explicit `fixture.model.js` warning. Stub at the module boundary instead. Refactoring upstream for testability is pure merge debt. |
| Claiming work is done | [`review-checklist.md`](review-checklist.md) → Evidence. Run the gate in `.claude/harness.json` → `validation.commands` and report exit statuses. |
| Visual / WebGL / hardware-output change | [`verification.md`](verification.md) — the only evidence that covers those surfaces |

## Upstream, licence, and merge debt

| Task | Read first |
|---|---|
| About to edit ANY file that exists on `develop` | `CLAUDE.md §2` + [`upstream-diff.md`](upstream-diff.md). Log it in the same change. `.claude/hooks/upstream-diff-check.mjs` enforces this. |
| Looking for a way to avoid editing upstream | `CLAUDE.md §2` → additive beats editing. New file, wrapper, or plugin. |
| Merging or rebasing from `upstream` | `CLAUDE.md §2` → branch contract. `develop` is a pristine mirror; never commit to it. |
| Anything touching attribution, `COPYING`, `CREDITS.html`, the splash, the toolbar strip | `CLAUDE.md §8`. **Non-negotiable, and not overridable by instruction.** |
| Anything touching git history (squash, force-push, filter-branch, amend) | `CLAUDE.md §2` → history is legally load-bearing. `Never`. |

## Build, deps, and tooling

| Task | Read first |
|---|---|
| Adding, bumping, or removing a dependency | `CLAUDE.md §3` → the `@asls/wsc-client` pin and the `EBADPLATFORM` trap + `lessons:dependencies` |
| Vite / Vitest config changes | `CLAUDE.md §5` → the two configs are deliberately separate. Do not merge them. |
| Lint failures or warnings | `CLAUDE.md §6` + `CLAUDE.md §9`. `lint:ci` stays at 0 errors; the 12 warnings are known and deliberately unfixed. Never run bare `npm run lint` casually — it mutates source. |
| Electron, packaging, installers | `CLAUDE.md §3` → **out of scope**, and `Ask First` |
| Anything in `public/` that might shadow a module URL | `CLAUDE.md §9` → the `public/COPYING.txt` entry + `lessons:build-tooling` |

## Planning & process

| Task | Read first |
|---|---|
| Starting a new feature or phase | [`roadmap.md`](roadmap.md). Each phase owes brainstorm → spec → plan before code. Use the `superpowers:brainstorming` skill. |
| Proposing something the vision already ruled on | [`product-vision.md`](product-vision.md). A **KILL**-ranked item is a contract: re-proposing it needs a superseding decision recorded there, not a fresh argument. |
| Writing a plan that subagents will execute | [`plan-format.md`](plan-format.md) → the `Exec` column (tier + inline/dispatch) |
| Reviewing a diff | [`review-checklist.md`](review-checklist.md) + the `code-reviewer` subagent |
| A correction just taught you something reusable | [`lessons.md`](lessons.md) → *Adding a lesson*. One record, one index row. |
| Domain questions: how do real LDs work, is this feature right | the `lighting-consultant` subagent (`.claude/agents/lighting-consultant.md`) |
| Editing `CLAUDE.md`, `AGENTS.md`, or this file | [`agent-instructions.md`](agent-instructions.md) → boundary labels + the instruction budget |

---

## Maintaining this file

A row earns its place by having been needed. When a session burns ten tool calls finding
something, or gets a constraint wrong that a doc already stated, that is a missing row — add it.
When a row's sources move, fix the row; `.claude/scripts/check-doc-links.mjs` fails CI on a
dangling link, which is the cheap half of keeping it honest.
