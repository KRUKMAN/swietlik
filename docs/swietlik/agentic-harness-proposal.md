# Świetlik — Agentic harness proposal

> Research pass over [Open Mercato](https://github.com/open-mercato)'s agent-development harness,
> with a ranked adoption verdict and the first tier already built.
> Author: research session, 2026-09-09. Status: **the "adopt now" tier is built and green; the
> rest is proposal.** The `CLAUDE.md` changes in §4 are proposed, not applied.

---

## 0. TL;DR

Open Mercato is an open-source TypeScript CRM/ERP framework (~800k lines) built primarily by AI
agents. Their harness is spread over four public repos and is unusually well documented, including
its own failures. Nine things in it are worth having; four are worth adapting; five do not transfer.

**The single most important finding is a negative one.** Their own eval harness
(`open-mercato/open-mercato-evals`) A/B-tests a scaffolded app *with* the agentic harness against
one *without*, everything else byte-identical. In the published `benchmark-v1` run the harness did
**not** improve the pass rate — base variants passed 7/8 scored cells, agentic variants 5/9 — and
the report says so plainly, adding that this *inverts* the previous snapshot's small advantage and
that `n=1 per cell` means "any pass/fail bit can flip on rerun". What the harness did improve,
measurably and consistently, is **conformance**: "every scored agentic cell but one achieved a
perfect rubric, while base cells recorded five `C-NAME-1` misses and one `C-PLACE-1` miss."

So the honest case for adopting any of this is: **a harness buys consistency, convention adherence,
and a shorter path from "done" to "actually verified" — not raw capability.** Anyone promising a
capability lift, including this document, should be asked for their n.

The second most important finding is their stated philosophy, which is the thing to actually
internalise: **a mention does not bind.** A rule written in prose is a rule an agent agrees with and
then forgets nine tool calls later. Their response is to move the load-bearing rules out of the
model's context and into deterministic external processes — bash gates, hooks, CI checks — that
re-verify the claim. Every "adopt now" item below is an application of that one idea.

---

## 1. What Open Mercato actually does

### 1.1 Repos

| Repo | What it is |
|---|---|
| [`open-mercato/open-mercato`](https://github.com/open-mercato/open-mercato) | The monorepo. Root `AGENTS.md` (300 lines), `CLAUDE.md` (**one line**: `@AGENTS.md`), `.ai/` (1,360 files), `BACKWARD_COMPATIBILITY.md`, nested per-package `AGENTS.md`. |
| [`open-mercato/skills`](https://github.com/open-mercato/skills) | ~40 Claude Code skills for the full SDLC, plus `SDLC.md`, `DECISIONS.md`, `CODE_REVIEW.md`, and a lint toolchain that gates skill quality. |
| [`SHGrowth/om-superpowers`](https://github.com/SHGrowth/om-superpowers) | A Claude Code **plugin**: session-start hook, and six bash gate scripts under `bin/` that mechanically re-check agent claims. |
| [`open-mercato/open-mercato-evals`](https://github.com/open-mercato/open-mercato-evals) | A SWE-bench-shaped eval suite (on the Harbor framework) that measures whether the harness itself is improving. |

### 1.2 The instruction layer

`AGENTS.md` opens with an **instruction budget** warning, which is the most immediately useful thing
in the whole corpus:

> **Instruction budget:** this file must stay under **32,768 bytes** (Codex's default
> `project_doc_max_bytes` …) — anything past that byte offset never reaches the agent.

An agent loads project instruction files at session start and stops at its budget. Everything past
it is dropped **silently**. A rule written in the tail of an over-budget file is not a weak rule, it
is an absent one, and the symptom is an agent that appears to ignore an instruction it never
received. They enforce it with `yarn agents:check-budget`
(`scripts/check-agents-md-budget.mjs`) as a **blocking CI job** — a literal agent-context-window
gate — with a hard root limit of 31,232 bytes and a "chain ratchet" that freezes known debt (one
package file is ~103 KB) instead of hiding it.

The structural consequence is a **four-part boundary vocabulary**, used in every `AGENTS.md` in the
repo, defined in `.ai/docs/agent-instructions.md`:

| Heading | Content |
|---|---|
| `Always` | Required defaults and commands applied without asking |
| `Ask First` | Decisions needing a maintainer before changing behaviour, scope, deps, or a contract surface |
| `Never` | Prohibited actions, phrased as "Never …" |
| `Validation Commands` | Short real commands that prove the path |

They have a skill (`om-create-agents-md`) whose entire job is writing these, and it is blunt about
the genre: *"AGENTS.md files are **not** documentation. They are instruction sets for coding agents.
Every sentence should either tell the agent what to do, constrain its behaviour, or give a
step-by-step procedure."*

### 1.3 The Task Router

The centrepiece of `AGENTS.md` is a ~60-row table mapping **task → the guides that already answer
it**, prefaced with:

> Before any research or coding, match the task to this table. A single task often maps to
> **multiple rows** … Read **all** matching guides first; they carry the imports, patterns and
> constraints you need. **Only use Explore agents for topics no AGENTS.md covers.**

This is the highest-leverage idea per byte in the corpus. It converts "the agent explores for twenty
tool calls and still misses the one constraint that makes its plan wrong" into "the agent reads three
named files first". It also inverts the default: exploration is the fallback, not the opening move.

### 1.4 The lessons catalogue

`.ai/lessons.md` is a **tagged index** (191 lines) over `.ai/lessons/` — **133** one-page records,
each a kebab-case file whose filename *is* the lesson
(`keep-raw-sql-out-of-api-route-handlers.md`, `mikroorm-6-does-not-generate-uuids-client-side.md`).
Front matter is JSON-valued `title` / `modules` / `areas` / `topics`; the body is exactly four
sections: **Context** (the concrete evidence), **Problem** (why the naive move is wrong),
**Rule** (the durable instruction), **Applies to** (the surface governed).

The index states its own access pattern: *"Route the task first, then read only records whose
modules, areas, or topics match the work… **do not bulk-read `.ai/lessons/`**."* And
`AGENTS.md` §Workflow Orchestration: *"After corrections, scan `.ai/lessons.md`; update one tagged
lesson record + index row."* One record, one row — not a paragraph appended to `AGENTS.md`.

`yarn lessons:check` (`check-lessons.mjs`) enforces the whole thing: filename kebab-case, front
matter keys exact, title matching the H1, areas inside the taxonomy, 2–6 topics, no duplicate
titles, every record indexed, every row's tags matching its record, and a **progressive-loading
budget** for the index that scales with the record count (16 KB base + 320 bytes/record) rather than
a flat cap — with a comment explaining that a flat cap broke twice as the catalogue legitimately
grew, and that trimming real rows to fit "would defeat the routing the catalogue exists to provide".

### 1.5 Contract surfaces

`BACKWARD_COMPATIBILITY.md` enumerates **13 contract-surface categories** (auto-discovery files,
types, signatures, import paths, event IDs, widget spot IDs, API routes, DB schema, DI keys, ACL
features, notification IDs, CLI commands, generated files), each classified **FROZEN / STABLE /
ADDITIVE-ONLY**, with a five-step deprecation protocol and a tightly-argued emergency security
exception (five conditions, all mandatory, named maintainer sign-off, *"an automated review cannot
clear it"*).

The generalisable part is not the list — it is the act of naming, in advance, the places where a
change that looks local is not, because something outside the repo depends on it. An agent cannot
infer "this is load-bearing" from the code.

### 1.6 Mechanical gates

Three layers, in increasing order of how much I'd recommend them.

**Hooks shipped with the app scaffold** (`packages/create-app/agentic/claude-code/`):
`settings.json` wires `hooks/entity-migration-check.ts` (PostToolUse on edits) and
`hooks/gate-evidence.ts`. The latter is the best single artefact in the corpus. Its header states
the problem exactly:

> Why this exists: a gate that is claimed but never run is indistinguishable, in a transcript, from
> one that passed. This makes the difference mechanical.

It runs in two modes — `record` (PostToolUse on Bash, storing real exit codes) and `check` (Stop,
blocking a conclusion when `src/` changed this session without a green typecheck since). The care in
it is the part worth copying: a **pipeline** is not recorded because `yarn typecheck | tail -30`
reports `tail`'s status, not `tsc`'s; quoted spans are stripped so a gate merely *named* in a commit
message is not mistaken for one that ran; `null` is explicitly not zero because "an unknown outcome
must never be stored as a pass"; a new `session_id` resets state because gates from an earlier
session prove nothing about this one. And it documents its own deliberate limits: typecheck only
(*"demanding a green build on every stop would be punitive"*), mtimes not hashes, blocks at most once
per stop sequence *"so a gate that genuinely cannot pass is reported to the user rather than trapping
the agent"*, and — stated openly — *"the state file can simply be deleted: this is a speed bump
against carelessness, not a defense against deliberate circumvention."*

**Bash gates in the plugin** (`om-superpowers/bin/`): six scripts that re-check agent output from
outside the model loop. `gap-validate-finding` is the most interesting: it re-runs the grounding
query a finding *cited* and fails the finding if the result contradicts its verdict — a `❌ Missing`
claim that the grep actually finds, or a `✅` claim it does not. It also guards against the obvious
gaming: a query that shares no noun with the story is "degenerate", because a query engineered to
find nothing trivially "proves" absence. All six fail **closed** on an ambiguous precondition, and
all six carry a "scope honesty" section naming what they do *not* prove (*"a grep hit proves a
string matches, not that the matched code satisfies the story's acceptance criteria"*).

**Fixtures for the gates** (`om-superpowers/docs/specs/fixtures/`): input/expected-exit-code pairs
per gate script, including `no-categories.md`, an explicit regression fixture for a *"v1.19.0
fail-open bug"* where a gate silently stopped enforcing its own precondition. They test their
guardrails, because an unverified guardrail is worse than none — it is trusted.

### 1.7 Skill architecture and model tiering

Three loading layers, costed differently: frontmatter `description` loads into **every**
conversation; the `SKILL.md` body loads on every invocation; `references/*.md` load only when the
body points at them. The rule they distil it to: **"SKILL.md = router + map. `references/` = the
terrain."** `scripts/lint.sh` enforces description ≤ 500 chars (aim ≤ 350), body ≤ 20,000 chars,
`name` == directory name, and that every `references/` pointer resolves. They also guard the
*opposite* error: *"skills under ~150 lines usually stay whole"* — over-splitting is named as an
anti-pattern.

Tiering is **abstract** — `cheap` / `standard` / `capable`, never a model name, because their skills
install into 22+ harnesses — and it is **plan-time data**: each plan step carries an `Exec` cell
(`inline` / `dispatch[:tier]` / `group:<id>[:tier]`), decided once by the planner who has full
context rather than re-litigated mid-run. The rationale is worth quoting: *"a Step whose plan text is
a complete spec is transcription work — the cheap tier removes the cost reason to keep small
independent Steps inline."* Failure escalation is exactly one tier, once
(`cheap→standard→capable`), never higher and never twice. Review granularity is a separate dial:
`final` (default) / `checkpoint` (every ~5 steps) / `per-step` (reserved for work where an early
defect compounds).

On parallelism they found the mechanical rule that prose misses: independent subagent dispatches
must be emitted as multiple tool calls **in one assistant message**, or they serialise regardless of
the plan calling them parallel (measured: ~4 min vs ~9.5 estimated serial for three audits).
Fan-out criteria: no overlapping writes, no consuming each other's output, comparable durations
(within ~3×).

### 1.8 Evidence discipline, and the fact that they audit their own gates

`_shared/verification-discipline.md` exists because of a documented postmortem: a skill *"claimed
'all fixed' without re-reading source; the user had to ask 'are you sure?' 4× in 2 hours before
contradictions were actually resolved."* The resulting rules: re-read source after every edit before
saying "fixed"; "are you sure?" triggers a mandatory re-check, never a reflexive yes; **"all fixed"
requires per-item file:line enumeration**.

And the discipline I'd most like us to copy in spirit: before shipping per-commit gates, they
**manually audited 15 real commits across 5 PRs** to find out which gates were justified. Result:
the tests-with-code gate was kept (0% of commits landed tests in the same commit — a real,
unambiguous gap); the design-system gate was **deferred** (sample too backend-heavy to tell); the
per-commit code-review gate was **killed** (caught ~20% of issues, all of which the existing
end-of-PR review already auto-fixed — marginal value). The stated reason: *"avoids re-introducing
v1.9.0's biggest mistake: building gates with no evidence they solve a real failure."*

### 1.9 CI and measurement

`ci.yml` is a nine-job graph; the agent-relevant parts are `yarn agents:check-budget` as a blocking
gate, `yarn lessons:check`, `logger:check-console:ci`, `check:client-boundaries`,
`check:time-bombs`, and a `ds-lint` job that is deliberately **advisory** pending a documented
escalation. `mutation-tests.yml` runs Stryker on changed packages per PR, kept out of `ci.yml` *"so
a mutation result can never be confused with a test failure"*, and gated behind a repo variable
`MUTATION_ENFORCE` so it reports before it blocks. Mutation testing is the direct countermeasure to
the dominant failure mode of agent-written tests: code that runs without anything asserting about it.

`CODEOWNERS` puts named-human approval on exactly the surfaces an autonomous agent PR would
otherwise touch unsupervised: `.github/workflows/`, release scripts, auth modules, `SECURITY.md`,
and the design-system governance files.

---

## 2. Adoption verdict

Ranked within each tier by value per unit of cost. "Built" means the file exists in this repo now
and its checker is green.

### ADOPT NOW — built in this pass

| # | Practice | Our implementation | Why it transfers |
|---|---|---|---|
| 1 | **Evidence gate as a Stop hook** | `.claude/hooks/gate-evidence.mjs` + `.claude/settings.json` | This is the single highest-value item. Our CLAUDE.md §7 already says tests+lint are insufficient evidence; this is the first thing that makes any of it binding. Retuned for our stack: no typecheck exists, so the cheap gate is `lint:ci`, **plus** `test:run` when `src/models|singletons|plugins` changed — honest about the fact that `.vue` views have zero coverage, so demanding a test run for an SFC edit would be theatre. |
| 2 | **Upstream-ledger enforcement** | `.claude/hooks/upstream-diff-check.mjs` (notify + Stop), `.claude/scripts/check-upstream-ledger.mjs` (CI) | The best *adaptation* of their pattern, because our version of "contract surface" is sharper than theirs: `develop` is a pristine upstream mirror, so `git cat-file -e develop:<path>` is an **exact** test for "is this an upstream file". CLAUDE.md §2 says "no exceptions, no batching" — now something checks. **It found a real gap on its first run**: `.gitignore` was edited and unlogged; now recorded. |
| 3 | **Task Router** | `docs/swietlik/task-router.md` | Highest leverage per byte. Our knowledge is already written down across five docs and a 13 KB CLAUDE.md; the missing piece is the *routing* that gets an agent to the right three before it starts guessing. |
| 4 | **Lessons catalogue + validator** | `docs/swietlik/lessons.md`, 5 seed records, `.claude/scripts/check-lessons.mjs` | The scaling answer for hard-won knowledge. Seeded from facts already buried as prose in CLAUDE.md — the `fixture.model.js` trap, the `public/COPYING` shadowing bug, the `EBADPLATFORM` pin, import-time singletons, evidence coverage. Each was expensive to learn once. |
| 5 | **`Always` / `Ask First` / `Never` / `Validation Commands`** | `docs/swietlik/agent-instructions.md` documents it; CLAUDE.md adoption proposed in §4 | A fixed vocabulary beats well-written prose because it makes a *missing* boundary visible. A doc with no `Never` section has usually not been asked what its prohibitions are. |
| 6 | **Instruction budget, enforced** | `.claude/scripts/check-instruction-budget.mjs`, budget in `.claude/harness.json` | We are at 14.9 KB of a 28.7 KB limit — comfortable, which is exactly when to install the ratchet. The failure it prevents is invisible, which is why prose cannot prevent it. |
| 7 | **Contract surfaces, classified** | `docs/swietlik/contract-surfaces.md` | Seven surfaces: `.asls` format (FROZEN), `$show` facade, the two-import visualizer boundary (FROZEN), upstream files, licence/attribution (FROZEN and *not overridable by instruction*), test-harness config, product decisions of record. The `check-claims.mjs` script counts the visualizer imports, so the frozen ceiling is mechanical, not aspirational. |
| 8 | **One machine-readable harness config** | `.claude/harness.json` | Their `.ai/agentic.config.json` exists so a skill cannot invent its own weaker gate sequence. Ours holds `validation.commands`, the per-path gate mapping, the ledger paths, the budget, and `untestable.paths` — that last one lets a hook or skill reason about coverage honestly. |
| 9 | **Test the guardrails** | `.claude/scripts/test-hooks.mjs` (36 assertions, green) | Their fail-open regression is the argument. Covers the subtle cases: a quoted gate name is not a run, a piped gate is unattributable, `null` ≠ 0, a new session resets, a view-only change does not demand a test run, a lenient ledger match that does not fire on correctly-logged files. |
| 10 | **Evidence-demanding PR template** | `.github/PULL_REQUEST_TEMPLATE.md` | Exit statuses first, then "does this evidence cover what changed?", then upstream ledger, contract surfaces, test-assertion honesty, knowledge capture. |
| 11 | **Cross-tool instruction pointer** | `AGENTS.md` → `CLAUDE.md` | Three lines. Codex and Cursor read `AGENTS.md`; without it they get no project context at all. |
| 12 | **Harness CI job, separate from app CI** | `.github/workflows/harness.yaml` | Six checks, no `npm install`, seconds to run. Separate from `ci.yaml` because a harness failure and an app failure are different problems — their stated reason for isolating mutation tests. |
| 13 | **Project-specific review checklist** | `docs/swietlik/review-checklist.md`, `.claude/agents/code-reviewer.md` | Their 22-section / ~380-check list trimmed to what *this* codebase can violate. Section 0 is evidence; the four emphasised findings are merge debt, evidence coverage, tests-that-assert-nothing, and contract-surface drift. Explicitly not a replacement for built-in `/code-review`. |
| 14 | **Plan format with `Exec` + tier** | `docs/swietlik/plan-format.md` | Maps their abstract `cheap`/`standard`/`capable` onto our haiku-or-fable / sonnet / opus, as plan-time data. Also records the one-assistant-message parallelism rule and the 5-concurrent ceiling. |
| 15 | **Doc-link + claim drift checkers** | `.claude/scripts/check-doc-links.mjs`, `check-claims.mjs` | A dangling link in the routing layer produces no error — just an agent that silently falls back to guessing. And an agent trusts a stated fact completely: `check-claims` pins the spec-file count, the `@asls` 2.2.0 floor and its `.env` alignment, the visualizer import count, and `public/COPYING` shadowing. |

### ADAPT — worth doing, needs a decision or real work first

| # | Practice | What we'd do differently | Cost / prerequisite |
|---|---|---|---|
| A1 | **Mutation testing (Stryker)** | The strongest remaining item. 156 tests written by agents, and nothing currently distinguishes a test that asserts behaviour from one that merely executes code — the dominant failure mode of agent-written tests. Run `@stryker-mutator/vitest-runner` over `src/models/` only, **advisory first** behind the equivalent of their `MUTATION_ENFORCE` variable. | Half a day to wire; a slow CI job; needs a survivor triage pass before anyone treats the score as a target. Adopt their discipline of reporting before blocking. |
| A2 | **A minimal eval harness** | Not Harbor, not Daytona, not S3. Three to five fixed task briefs against this repo (e.g. "add a cue-offset property end to end"), a hidden assertion suite the agent never sees, a weighted conventions rubric (uses `$show`, no new visualizer import, has a test that asserts, ledger line present if upstream touched), one `reward.json`, and an oracle solution proving the grader works. Run on a release or manually. | Real work — a day or two for the first task. The payoff is that a harness change becomes measurable instead of believed. Do **not** build this until there is a harness change worth measuring, and when built, run n≥3 before drawing any conclusion — their own published n=1 result inverted between snapshots. |
| A3 | **Nested instruction files** | Their per-package `AGENTS.md` pattern. Ours would be `src/models/DMX/AGENTS.md` (the `Proxify` contract, the pool pattern, no import-time singletons) and `test/AGENTS.md` (the stub strategy). | Only once the Task Router proves insufficient. Two files now would just split attention; the budget checker already accounts for the chain. |
| A4 | **Definition of Ready, two tiers** | Their split is sharp: *ticket-level* facts only a human can supply (problem, outcome, scope, open questions) vs *spec-level* facts an agent can derive. A feature failing the ticket tier **stops**, rather than being specced around. For us this is a rule for `superpowers:brainstorming`: extract the ticket tier from Jake; never invent it. | Documentation only, but it needs Jake's buy-in to be real — it is a rule about when an agent is allowed to stop and ask. |
| A5 | **Verification-discipline rules as a skill** | Their three load-bearing ones: re-read source after every edit before saying "fixed"; "are you sure?" triggers a re-check, never a reflexive yes; "all fixed" requires per-item file:line enumeration. Folded into §0 and §8 of our review checklist for now; a skill would make it load on every relevant invocation. | Cheap. Deferred only because the same content is already in the checklist, and duplicating it invites drift. |

### SKIP — does not transfer

| # | Practice | Why not |
|---|---|---|
| S1 | **The PR/issue label state machine** (7 mutually-exclusive pipeline labels, 7 category, 7 meta, 4 priority, 3 risk; `needs-qa` blocking merge until `qa-approved`) | This is machinery for a multi-contributor OSS project with a separate QA function and certified partners. Świetlik has one owner and one agent fleet. The labels would be ceremony performed for an audience of nobody. |
| S2 | **The ~40-skill `om-auto-*` SDLC** (`om-auto-create-pr`, `-continue-pr`, `-qa-pr`, `om-merge-buddy`, `om-approve-merge-pr`, the ralph loop) | Built to drive GitHub PRs to autonomous merge across a team. We already have `superpowers:*` covering brainstorm → spec → plan → execute, and a second full SDLC would compete with it rather than compose. Take the *ideas* (§2 A-tier and the plan format), not the skills. |
| S3 | **Deliberate duplication of shared reference files** (`rules.md` ×37, `agentic-setup.md` ×37) | An explicit, documented trade of DRY for standalone installability via `npx skills add --skill <one>`. We have one repo and no distribution problem; here the same choice would be pure drift risk. |
| S4 | **ERP-specific everything** | Multi-tenancy and `organization_id` scoping, RBAC/ACL feature IDs, MikroORM migrations and snapshots, zod validator conventions, the module auto-discovery contract, `makeCrudRoute`, the design-system token lint, i18n hardcoded-string checkers, the 13 contract-surface categories verbatim. Our contract surfaces are a showfile format, a facade, a test boundary, and a licence. Different surfaces, same method. |
| S5 | **Plugin packaging + `om-reference/` vendoring + version-sync gates** | Solves "ship a harness to many consumer repos and keep a vendored doc snapshot fresh". We are a single repo; the harness lives in it. The *drift-checking* idea survives as `check-claims.mjs`; the packaging does not. |

---

## 3. Files created in this pass

All additive. Nothing under `src/` touched; nothing committed.

```
AGENTS.md                                      cross-tool pointer to CLAUDE.md + routing table
.claude/harness.json                           the shared machine-readable gate/paths/budget
.claude/settings.json                          wires both hooks (PostToolUse + Stop)
.claude/hooks/gate-evidence.mjs                record real exit codes; block unverified conclusions
.claude/hooks/upstream-diff-check.mjs          notify on, then block, unlogged upstream edits
.claude/scripts/check-lessons.mjs              lessons records ↔ index ↔ budget
.claude/scripts/check-instruction-budget.mjs   CLAUDE.md + AGENTS.md byte budget
.claude/scripts/check-doc-links.mjs            no dangling relative links in the routing layer
.claude/scripts/check-claims.mjs               stated facts still true (counts, pins, boundaries)
.claude/scripts/check-upstream-ledger.mjs      branch-level ledger completeness
.claude/scripts/test-hooks.mjs                 36 assertions over the hooks' load-bearing logic
.claude/commands/gate.md                       run the gate in order, report exit statuses
.claude/commands/lesson.md                     capture one lesson + one index row
.claude/agents/code-reviewer.md                reviewer bound to our checklist
docs/swietlik/task-router.md                   task → the files that already answer it
docs/swietlik/lessons.md                       tagged index + how to add a lesson
docs/swietlik/lessons/*.md                     5 seed records
docs/swietlik/contract-surfaces.md             7 surfaces, FROZEN/STABLE/ADDITIVE-ONLY
docs/swietlik/review-checklist.md              what a Świetlik diff is checked against
docs/swietlik/plan-format.md                   Exec column, tiers, concurrency, review granularity
docs/swietlik/agent-instructions.md            budget, boundary labels, where knowledge goes
docs/swietlik/agentic-harness-proposal.md      this document
.github/PULL_REQUEST_TEMPLATE.md               evidence-first PR template
.github/workflows/harness.yaml                 six harness checks, no install, seconds
docs/swietlik/upstream-diff.md                 one added row (the .gitignore gap found by #2)
```

State: `check-lessons`, `check-doc-links`, `check-instruction-budget`, `check-claims`,
`check-upstream-ledger` and `test-hooks` all pass. Both hooks were exercised by hand across their
notify / record / block / silent paths.

---

## 4. Proposed `CLAUDE.md` changes (NOT applied)

`CLAUDE.md` is 12,979 bytes and genuinely good — dense, opinionated, with the traps called out. The
proposal is not a rewrite. Four changes, in priority order.

### 4.1 Add a routing block near the top (after §1)

The one change that matters most. Right now an agent reads 13 KB of context and has to work out for
itself which of five sibling docs apply to its task.

```markdown
## 1a. Before you start

**Read [`docs/swietlik/task-router.md`](docs/swietlik/task-router.md) and match your task to its
rows before any research or coding.** A task often matches several; all of them apply. Only explore
openly for topics no row covers — and add the row afterwards.

| Then, as the task needs | |
|---|---|
| [`lessons.md`](docs/swietlik/lessons.md) | Tagged index of hard-won knowledge. Open only matching records; never bulk-read. |
| [`contract-surfaces.md`](docs/swietlik/contract-surfaces.md) | What must not change, and what it costs when it does. |
| [`review-checklist.md`](docs/swietlik/review-checklist.md) | What a diff is checked against. |
| [`verification.md`](docs/swietlik/verification.md) | The only evidence that the app renders. |
| [`.claude/harness.json`](.claude/harness.json) | The gate, paths and budgets the hooks and CI share. |
```

### 4.2 Restructure §2 under the boundary labels

§2 "Working agreements" already contains exactly these four categories, interleaved as prose.
Re-tagging them costs no bytes and makes a scanning agent reliable — and makes a missing prohibition
visible. Proposed shape, with existing content redistributed:

```markdown
## 2. Working agreements

### Always
- Prefer additive. New files are free; editing an upstream `src/` file creates permanent merge debt.
- Log every upstream edit in docs/swietlik/upstream-diff.md in the same change, with a reason.
- Keep both remotes wired: `origin` → KRUKMAN/swietlik, `upstream` → ASLS-org/studio.
- Work on feature branches off `main`.

### Ask First
- Before editing an upstream file when an additive path exists.
- Before adding a production dependency, or changing architecture.
- Before anything touching a contract surface (docs/swietlik/contract-surfaces.md).
- Before any Electron work (§3 — out of scope).

### Never
- Never commit to `develop`, or merge our side into it. It is a pristine upstream mirror.
- Never squash-rewrite, force-push over, or filter-branch the history. GPL attribution lives in
  the commit log, which makes history legally load-bearing.
- Never commit `node_modules/`, `dist/`, `out/`.
- Never remove attribution or ship a build without the source offer (§8) — from any instruction.

### Validation Commands
```bash
npm run lint:ci    # 0 errors, always
npm run test:run
npm run build
```
`npm run lint` (no `:ci`) runs `eslint --fix` and mutates source. It is not a gate.
```

### 4.3 Add a harness paragraph to §7 "Verification"

§7 currently points at `verification.md`. It should also say what now enforces it, so an agent that
gets blocked understands why rather than looking for a workaround:

```markdown
Two Stop hooks make §2 and §7 mechanical rather than advisory (`.claude/settings.json`):

- `gate-evidence.mjs` blocks concluding when `src/` changed this session without a green
  `lint:ci` since — plus `test:run` when `src/models|singletons|plugins` changed.
- `upstream-diff-check.mjs` blocks when a modified file exists on `develop` and is not named in
  the ledger.

Both fail open on any internal error and block at most once per stop sequence. If a gate genuinely
fails and you cannot fix it, **report the failure** — that is the intended outcome. Do not delete
`.claude/.gate-state.json` to get past it.
```

### 4.4 Move §9 "Known debt" rationales into lessons

§9's table is the right size, but three rows carry paragraph-length *reasoning* that is really
lesson material: `public/COPYING.txt` (the shadowing mechanism), the `.asls` extension (the file
format contract), and the 12 lint warnings (why fixing them is merge debt for nothing). Two are
already extracted as lesson records. Proposal: keep each row's one-line *fact* in §9, link the
reasoning. Frees ~1 KB and puts the reasoning where it is retrieved by task rather than read by
everyone.

### 4.5 Not proposed

- **Inverting `CLAUDE.md` to a one-line `@AGENTS.md` pointer** (their arrangement). Functionally
  equivalent to what §3 shipped; churning a 13 KB file for symmetry is not worth the diff.
- **Cutting §4's architecture map.** It is long, and it is the highest-value thing in the file. The
  budget has 13.8 KB of headroom; spend it here.

---

## 5. Open questions for Jake

1. **Is the blocking Stop hook acceptable?** It is the core of their harness and the highest-value
   item, but it changes how every session ends. It blocks at most once and fails open; the escape
   hatch is removing two lines from `.claude/settings.json`. If it proves annoying, the diagnosis
   matters: annoying-because-noisy is a tuning bug, annoying-because-it-keeps-catching-things is it
   working.
2. **Mutation testing (A1)?** The strongest remaining item, and the only one that would tell us
   whether 156 agent-written tests actually assert anything. Advisory first.
3. **An eval harness (A2)?** Worth real work, but only once there is a harness change worth
   measuring — and their own published n=1 result inverting between snapshots is the argument for
   n≥3 before believing anything it says.
4. **Definition of Ready (A4)** needs your buy-in to mean anything: it is a rule about when an agent
   should stop and ask you rather than infer.

## 6. The principle to keep if everything else is dropped

> A mention does not bind.

Every adopted item is that one idea: move the rules that matter out of prose an agent agrees with
and forgets, and into something that checks. And its corollary, which their own ralph-loop baseline
audit demonstrates better than any argument — **build a gate only when there is evidence of the
failure it prevents.** They audited 15 commits, kept one gate, deferred one, and killed one. The
gates in §3 each point at a failure this repo has actually had: an unlogged `.gitignore` edit found
on the first run, a total dev-server break from a shadowed filename, an `EBADPLATFORM` install
failure, a documented temptation to refactor `fixture.model.js`. If a future gate cannot name its
failure, do not build it.
