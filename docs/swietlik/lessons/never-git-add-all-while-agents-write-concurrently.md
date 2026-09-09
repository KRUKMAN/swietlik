---
title: "Never `git add -A` while other agents write concurrently — stage explicit paths"
areas: ["agent-workflow"]
topics: ["concurrent-agents", "commit-hygiene", "staging"]
---

# Never `git add -A` while other agents write concurrently — stage explicit paths

**Context**: Świetlik is built by multiple AI agents working the same checkout at the same
time. During Phase 1, an orchestrator commit intended to capture only engine hardening ran
`git add -A` while three background agents were mid-write. Commit `bb28940` ("fix(engine):
pre-Phase-1 hardening from code review") swallowed 44 files, including the MCP protocol
module from one agent, a product-vision addendum from another, and the entire in-progress
agentic-harness file set from a third — none of which its message describes.

**Problem**: `git add -A` snapshots whatever exists in the working tree at that instant. With
concurrent writers, "whatever exists" includes other agents' unfinished, unreviewed work. The
resulting commit message lies about its own content, the sweep can capture half-written files,
and later commits for that work come up empty ("no changes added"), which reads as a failure
and costs a debugging round to explain. History surgery afterwards is worse than the disease:
rewriting is forbidden here (GPL attribution makes history load-bearing) and would race the
same concurrent writers again.

**Rule**: While any background agent may be writing into the repo, stage by explicit path only
(`git add <file> <dir>`), scoped to the work the commit message describes. Reserve `git add -A`
for provably single-writer moments. If a sweep does happen, do not rewrite pushed history —
note the stowaway content in the eventual PR description and move on.

**Applies to**: Every orchestrator commit during multi-agent execution; any workflow round
where agents share a checkout without worktree isolation.
