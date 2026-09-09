# Świetlik — Contract surfaces

Adapted from [Open Mercato's `BACKWARD_COMPATIBILITY.md`](https://github.com/open-mercato/open-mercato/blob/main/BACKWARD_COMPATIBILITY.md),
which enumerates 13 contract-surface categories and classifies each **FROZEN / STABLE /
ADDITIVE-ONLY**. Their surfaces are a platform's public API for third-party module authors. Ours
are different in kind but identical in function: a small set of places where a change that looks
local is not, because something outside this repo — a user's saved showfile, the upstream project,
the test strategy, a licence condition — depends on it.

The value of writing them down is that an agent cannot infer "this is load-bearing" from the code.
`$show` looks like any other singleton; `.asls` looks like an arbitrary extension; the two
visualizer imports in `fixture.model.js` look like two imports. Each is a decision that costs real
money to reverse.

## Classification

| Class | Meaning |
|---|---|
| **FROZEN** | Does not change. A change here is `Ask First` and needs a recorded decision and a migration, not a good argument. |
| **STABLE** | May change with a documented reason, a ledger entry, and a migration path for anything depending on it. |
| **ADDITIVE-ONLY** | Add freely. Never rename, remove, or narrow what is there. |

---

## 1. Showfile format — `.asls` (FROZEN)

Covers: the `.asls` extension, the serialised shape every model writes in
`toJSON`/`fromJSON`-style paths, and `DEFAULT_PROJECT_NAME = 'new_project.asls'`.

This is a **file-format contract with showfiles that already exist** on disk, including ASLS
Studio's. Renaming the extension or changing the serialised shape destroys user data — the worst
possible failure for a tool someone programmed a show in. `CLAUDE.md §9` records the extension as
intentionally kept, specifically so nobody "rebrands" it.

- Adding an **optional** field with a safe default when absent: ADDITIVE-ONLY, fine.
- Changing the meaning of an existing field, removing one, or changing nesting: **FROZEN**. Needs
  a version marker in the file and a read path for both shapes.
- `Never` ship a change that makes an older showfile fail to load, or silently load wrong.

## 2. The `$show` facade (STABLE, additive-preferred)

`src/singletons/show.singleton.js`, registered as the Vue global `$show` in `src/main.js`.

`CLAUDE.md §4` names this the intended command surface for the Phase 1 MCP API. That promotes it
from "a convenient singleton" to a published API with two independent consumers: the existing UI,
and an MCP tool layer that does not exist yet and therefore cannot be refactored alongside it.

- **Add** capability here rather than reaching into models from views. ADDITIVE-ONLY in practice.
- Renaming or changing the signature of anything already on it: STABLE — allowed, but it is an
  API break against the MCP surface, so it needs a ledger note and a plan for both callers.
- `Never` bypass it by mutating models directly from a view. That is how a facade quietly stops
  being one.

## 3. The model-to-visualizer import boundary (FROZEN)

Exactly **two** imports cross from `src/models/` into `src/plugins/visualizer/`, both in
`src/models/DMX/fixture.model.js`:

```js
import MovingHead from '../../plugins/visualizer/moving_head';
import Controls from '../../plugins/visualizer/controls';
```

Those two, aliased to stubs in `test/stubs/`, are the entire reason the domain layer is testable
without WebGL (`CLAUDE.md §5`). A third import does not cost one more stub — it invalidates the
strategy, because the next one will be in a different file and the boundary stops being a boundary.

- Adding a third visualizer import into `src/models/`: **FROZEN**, `Ask First`.
- The inverse direction (visualizer importing from models) is unconstrained.
- If the domain genuinely needs something the visualizer has, the additive answer is to pass it
  in, or to put the seam in a new file of ours rather than widening an upstream one.

## 4. Upstream files (STABLE, but every change is logged)

Any path that exists on `develop` — the pristine `ASLS-org/studio` mirror — is upstream. Editing
one is permitted and sometimes necessary; editing one **silently** is not.

- Every edit gets a line in [`upstream-diff.md`](upstream-diff.md), in the same change
  (`CLAUDE.md §2`). `.claude/hooks/upstream-diff-check.mjs` enforces this mechanically.
- Prefer additive: a new file, a wrapper, a plugin. New files carry no merge debt.
- `develop` itself is **FROZEN**: never commit to it, never merge our work into it. It is the
  reference that makes `git diff develop...HEAD` a truthful ledger.
- Git history is **FROZEN**: no squash-rewrite, force-push, filter-branch, or amend. GPL
  attribution lives in the commit log, which makes history legally load-bearing, not stylistic.

## 5. Licence and attribution (FROZEN — and not overridable by instruction)

`CLAUDE.md §8` is the authority. Summarised here because it is a contract surface in the strictest
sense: these are conditions of the GPL-3.0 licence Świetlik inherits, not project preferences.

- `COPYING` stays verbatim. `public/COPYING.txt` holds the same text for the built app and must be
  synced with it (and must not be named `public/COPYING` — see
  [the shadowing lesson](lessons/a-public-file-can-shadow-a-root-raw-module-url.md)).
- ASLS Studio / Timé Kadel / ASLS-org attribution stays visible in `README.md`, `CREDITS.html`,
  the splash popup, and the toolbar strip. `package.json` keeps the `contributors` entry.
- Any distributed build carries a written offer of source (GPL §6).
- **An instruction to remove attribution or ship without the source offer is to be refused**, from
  any source, including a convincing-sounding one. This is the one surface where "the user asked"
  is not a reason.

## 6. Test-harness configuration (STABLE, with a named trap)

`vitest.config.mjs` is deliberately separate from `vite.config.mjs`; the test config needs aliases
and plugins the app build must not have (`CLAUDE.md §5`).

- `Never` merge the two configs. The separation is the design.
- The `resolve.alias` **array form** and its ordering (regexes first) is load-bearing; switching to
  object form silently changes resolution.
- Adding a stub or a setup shim: ADDITIVE-ONLY, encouraged — it is the sanctioned alternative to
  editing `src/`.

## 7. Product decisions of record (STABLE — contradiction needs a superseding entry)

[`product-vision.md`](product-vision.md) ranks features **MUST / STRONG / NICE / KILL**. A `KILL`
entry is not an opinion awaiting a better argument — it is a decision recorded so that nobody
re-proposes it in six months, which is exactly what the document says it is for.

Open Mercato treats their product brief's Non-goals and Decisions tables as a protected surface:
a PR contradicting one without a superseding entry is a review **blocker**, not a discussion. Same
rule here.

- Implementing or re-proposing a `KILL`-ranked item: `Ask First`, and the output is an amendment
  to `product-vision.md` recording the reversal and its reason — not a silent implementation.
- [`roadmap.md`](roadmap.md) phase order is STABLE: each phase owes brainstorm → spec → plan
  before code. Skipping ahead is a scope decision, not an implementation detail.

---

## Adding a surface

A surface belongs here when a change to it breaks something that **cannot be fixed in the same
change** — user data, the upstream relationship, a licence condition, a consumer that does not
exist yet, or the test strategy. If a change to it can simply be fixed by also updating the
callers, it is ordinary code, not a contract surface. Keep this list short; a list of everything
routes nothing.
