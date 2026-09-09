# Świetlik — Plan format for agent execution

A plan that subagents execute needs three things a prose plan does not carry: which step runs
where, on what model tier, and what "this step is done" means. Adopted from Open Mercato's
`om-auto-create-pr-loop` (`references/executor-dispatch.md`, `references/step-review.md`,
`engine.*` in their `.ai/agentic.config.json`).

This supplements the `superpowers:writing-plans` and `superpowers:executing-plans` skills — it
does not replace them. It adds the columns their plan template leaves implicit.

---

## 1. The `Exec` column

Every step carries an execution decision made **at planning time**, not re-litigated when the step
comes up. Open Mercato's reason for fixing it in the plan is worth stating: the planner has full
context on the step's difficulty and the executor, mid-run, does not. Deciding it later means
deciding it worse, and deciding it repeatedly.

| Step | What | Exec | Done when |
|---|---|---|---|
| 1.1 | … | `inline` | … |
| 1.2 | … | `dispatch:cheap` | … |
| 1.3 | … | `group:A:standard` | … |

`Exec` values:

| Value | Meaning |
|---|---|
| `inline` | The orchestrating session does it. Correct when the step needs the conversation's context, or is too small to be worth a handoff. |
| `dispatch[:tier]` | One subagent, fresh context. Correct when the step's plan text is self-contained enough to be a brief. |
| `group:<id>[:tier]` | Dispatched **concurrently** with every other step sharing that group id. |

## 2. Tiers

Write the **abstract** tier in the plan, not a model name. Open Mercato does this because their
skills install into 22+ different harnesses; our reason is narrower but real — the model lineup
changes faster than the plans do, and a plan that says `opus` is wrong the moment the mapping
shifts.

| Tier | Maps to | Use for |
|---|---|---|
| `cheap` | haiku / fable | Transcription work: the step's plan text is already a complete spec. Mechanical edits, renames, moving code, adding a test that mirrors an existing one. |
| `standard` | sonnet | The default. Implementation with judgement inside a settled design. |
| `capable` | opus | Design decisions inside the step, ambiguous requirements, anything touching a [contract surface](contract-surfaces.md), debugging with an unknown cause. |

Resolution order: the step's tier suffix → `standard`. Omitting the suffix means `standard`.

The insight worth keeping: **a step whose plan text is a complete spec is transcription work**, and
at `cheap` it stops being worth the cost of keeping small independent steps inline. Better plans
make cheaper execution possible, which is a real argument for writing the plan properly.

**Failure escalation:** one bounded retry per step, escalating **exactly one** tier
(`cheap`→`standard`, `standard`→`capable`). Never above `capable`, and never more than one rescue —
a step that fails twice is a planning defect, and re-dispatching it at ever-larger models hides
that instead of surfacing it.

## 3. Concurrency

**The mechanical rule, which is easy to get wrong:** independent subagent dispatches must be
emitted as multiple tool calls **in one assistant message**. Split across turns, they serialise —
regardless of the plan calling them parallel. Open Mercato found a session where three audits in
one message took ~4 minutes against an estimated ~9.5 serial; the prose said "parallel" either way.

Ceiling: **5 concurrent**. Group steps only when all of these hold:

- They do not write overlapping files.
- None consumes another's output.
- They finish on comparable timescales (within roughly 3× of each other) — otherwise the group's
  cost is the slowest member and the fan-out bought little.

Sequential dependencies (model → facade method → view) and anything sharing a write target must
**not** be grouped. When parallel steps genuinely must write to the same area, isolate them with
`superpowers:using-git-worktrees` rather than hoping.

## 4. Review granularity

Choose once per plan and record it at the top:

| Mode | When |
|---|---|
| `final` | Default. One review at the end. Correct for most plans. |
| `checkpoint` | Review the accumulated diff every ~5 steps. Correct for long plans where a wrong turn compounds. |
| `per-step` | Review every step immediately. Reserve for work on a [contract surface](contract-surfaces.md), where an early defect propagating into later steps costs more than the extra reviews. |

## 5. Progress tracking

Keep a checklist in the plan and update it as steps land, using a stable format so a resumed
session can parse it:

```markdown
## Progress

- [x] 1.1 Add the cue-offset field — a1b2c3d
- [x] 1.2 Expose it on $show — e4f5g6h
- [ ] 1.3 Wire the fragment
```

`- [ ]` pending, `- [x]` done, append the short commit sha when a step lands. **Do not rename step
titles** — a resumed session matches on them.

## 6. Per-step definition of done

Every step's "Done when" states an observable condition, not an activity. "Added a test for the
cue offset" is an activity; "`npm run test:run` covers a non-zero cue offset and passes" is a
condition. A step whose done-condition cannot be checked mechanically is a step whose completion
will be claimed rather than demonstrated — see
[`review-checklist.md`](review-checklist.md) §0.
