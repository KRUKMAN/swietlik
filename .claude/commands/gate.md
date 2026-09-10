---
description: Run Świetlik's validation gate in order and report exit statuses as evidence.
allowed-tools: Bash, Read
---

Run the validation gate defined in `.claude/harness.json` → `validation.commands`, in order, and
report the result as evidence rather than as a claim.

## Procedure

1. Read `.claude/harness.json` and use its `validation.commands` list. Do not substitute your own
   sequence, and do not reorder it — the order is the CI order, so a failure here is a failure
   there.
2. Run each command. **Do not pipe them** through `tail`, `head`, or `grep`: a pipeline reports the
   exit status of its last stage, so `npm run test:run | tail -30` reports `tail` succeeding no
   matter what Vitest did. If output is long, let it be long.
3. Stop at the first failure. Report the failing command, its exit status, and the relevant output.
   Do not run the rest and do not attempt a fix in the same breath as the report — say what broke
   first.
4. On a clean run, report each command with its exit status, explicitly.

## Then: does this evidence cover what changed?

The gate proves the domain layer works. It proves nothing about surfaces that have no tests.
Check `git status --short` and `git diff --name-only` against
`.claude/harness.json` → `untestable.paths`:

- Changes confined to `src/models/`, `src/singletons/`, `src/plugins/` (non-visualizer), or
  `test/` — the gate is sufficient evidence.
- Anything under `src/views/`, `src/plugins/visualizer/`, `src/plugins/wsc.connection.js`,
  `src/electron/`, or `index.html` — the gate is **necessary but not sufficient**. Say so, and
  name `docs/swietlik/verification.md` as the outstanding evidence. Do not describe the work as
  verified until that checklist has actually been worked.

## Never

- Never report a gate you did not run. `.claude/hooks/gate-evidence.mjs` records real exit statuses
  from real Bash calls; a described run leaves no record and will block the session's conclusion.
- Never run bare `npm run lint` to make the lint gate pass. It runs `eslint --fix` and mutates
  source files — that is a change, not a verification.
- Never characterise a red gate as "mostly passing". Report the failure.
