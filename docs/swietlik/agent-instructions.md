# Writing agent instructions for Świetlik

How to edit `CLAUDE.md`, `AGENTS.md`, and the routing documents under `docs/swietlik/` without
quietly breaking them. Adapted from
[Open Mercato's `.ai/docs/agent-instructions.md`](https://github.com/open-mercato/open-mercato).

---

## 1. The instruction budget

A coding agent loads project instruction files at session start and **stops once the combined size
reaches its budget**. Codex's default `project_doc_max_bytes` is **32,768 bytes** — a byte budget,
not tokens — and everything past that offset is silently dropped. No warning reaches the agent and
none reaches the author.

This is the failure mode worth internalising: a rule written past the budget is not a weak rule, it
is an **absent** rule, and the symptom is an agent that appears to ignore an instruction it never
received.

Consequences:

1. `CLAUDE.md` + `AGENTS.md` together must stay under the limit. Currently ~13 KB of a 28,672-byte
   limit (32,768 minus a 4 KB reserve) — comfortable, and worth keeping that way.
2. Root files spend the budget that any future nested instruction file would need.

`node .claude/scripts/check-instruction-budget.mjs` enforces it, reading
`instructionBudget` from `.claude/harness.json`, and runs in CI
(`.github/workflows/harness.yaml`). Open Mercato runs the same check as a blocking job; their root
`AGENTS.md` sits at ~300 lines against a 31,232-byte hard limit, with one package file at ~103 KB
that the gate freezes as recorded debt rather than hiding.

**Rule of thumb when editing any instruction file:** hard rules, boundaries, and routing stay in
the file. Long-form procedure, option tables, and worked examples move into a referenced document
that the agent reads on demand. Three layers, costed differently:

| Layer | Loaded | Put here |
|---|---|---|
| `CLAUDE.md` / `AGENTS.md` | Every session | Hard rules, prohibitions, the routing table, the gate |
| [`task-router.md`](task-router.md), [`contract-surfaces.md`](contract-surfaces.md) | When routed to | Decisions, classifications, per-area constraints |
| [`lessons.md`](lessons.md) records, [`verification.md`](verification.md) | On demand, individually | Evidence, procedure, worked detail |

This is the same economy Open Mercato applies to skills: *SKILL.md is the router and the map;
`references/` is the terrain.* Their lint caps a skill body at 20,000 characters and a description
at 500, because the description loads into **every** conversation.

## 2. Boundary labels

Use these four headings when adding or reorganising agent rules, with these exact names:

| Heading | What goes in it |
|---|---|
| `Always` | Required defaults and commands an agent applies without asking. The bulk of constraint content. |
| `Ask First` | Decisions needing the owner's input before changing behaviour, scope, dependencies, or a contract surface. |
| `Never` | Prohibited actions and unsafe shortcuts, phrased as "Never …" — the heading does the tagging. |
| `Validation Commands` | Short, real commands that prove the relevant path. |

Why a fixed vocabulary beats well-written prose: an agent scanning for "what am I not allowed to
do" finds a `Never` heading reliably and finds a carefully-worded paragraph unreliably. It also
makes a **missing** boundary visible — a document with no `Never` section has usually not been
asked what its prohibitions are.

Additional sections (tables, maps, checklists) live **alongside** these, never instead of them.

Write instructions, not documentation. Every sentence should tell the agent what to do
("Use X when…"), constrain it ("MUST NOT…"), or give a procedure ("1. … 2. …"). Descriptive prose
about how the system works belongs in the architecture map; it is context, not instruction, and the
two should not be interleaved.

## 3. Where knowledge goes

| Kind of knowledge | Home |
|---|---|
| A hard boundary that must be read every session | `CLAUDE.md` |
| Something that must not change, and what it costs if it does | [`contract-surfaces.md`](contract-surfaces.md) |
| Task → which files answer it | [`task-router.md`](task-router.md) |
| A recurring failure mode with evidence and a durable rule | a [lesson](lessons.md) record |
| A procedure with steps to follow | its own doc under `docs/swietlik/` |
| What a diff is checked against | [`review-checklist.md`](review-checklist.md) |

The most common mistake is putting a lesson in `CLAUDE.md`. It works for the first five and fails at
fifty: the file grows past the budget, and every session pays to load facts relevant to none of
them. The second most common is the reverse — a hard prohibition filed as a lesson, where it is
only read by an agent that already happened to route to that area. A lesson explains **why** a
rule exists and how it was learned; the rule itself lives where it is always read.

## 4. Keeping claims true

These documents make checkable factual claims — test counts, warning counts, version pins, file
paths. Claims rot silently and an agent trusts them completely, which makes a stale claim worse
than no claim.

- `node .claude/scripts/check-doc-links.mjs` fails on a dangling relative link.
- `node .claude/scripts/check-lessons.mjs` fails on a record that drifted from its index row.
- `node .claude/scripts/check-claims.mjs` fails on a stated count or pin that no longer matches
  the repo.

Open Mercato's equivalent exists for exactly this reason: their release metadata claimed "18
user-facing skills" after a change to 11, and the version in `package.json` sat at 1.8.0 while the
plugin shipped 1.20.0 — neither caught by anything until a drift checker was added.

When a claim changes, update it in the same change. When a claim is expensive to verify, write it
as a claim about something cheap instead.
