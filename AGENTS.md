# AGENTS.md

Świetlik's agent instructions live in [`CLAUDE.md`](CLAUDE.md). Read that file first, in full.

This file exists so that every coding agent finds the instructions under the name it looks for —
Codex and Cursor read `AGENTS.md`, Claude Code reads `CLAUDE.md`, and a repo with only one of them
silently gives the other agent no project context at all. Open Mercato solves this in the opposite
direction: their `CLAUDE.md` is the single line `@AGENTS.md`. Either direction works; having
neither does not.

After `CLAUDE.md`, the routing layer is:

| Document | What it is for |
|---|---|
| [`docs/swietlik/task-router.md`](docs/swietlik/task-router.md) | **Read before any research or coding.** Task → the files that already answer it. |
| [`docs/swietlik/lessons.md`](docs/swietlik/lessons.md) | Tagged index of hard-won, reusable knowledge. Open only matching records; never bulk-read. |
| [`docs/swietlik/contract-surfaces.md`](docs/swietlik/contract-surfaces.md) | What must not change, and what it costs when it does. |
| [`docs/swietlik/review-checklist.md`](docs/swietlik/review-checklist.md) | What a review of a Świetlik diff actually checks. |
| [`docs/swietlik/verification.md`](docs/swietlik/verification.md) | The only evidence that the app renders. Tests and lint are not. |
| [`docs/swietlik/agent-instructions.md`](docs/swietlik/agent-instructions.md) | How to write and edit these files: boundary labels, instruction budget. |
| [`.claude/harness.json`](.claude/harness.json) | The machine-readable gate, paths, and budgets the hooks and CI share. |

The validation gate, in order — the full list is `validation.commands` in
[`.claude/harness.json`](.claude/harness.json):

```bash
npm run lint:ci    # must stay at 0 errors
npm run test:run   # Vitest once, not watch
npm run build
```

`npm run lint` (without `:ci`) runs `eslint --fix` and **mutates source files**. It is not a gate.
