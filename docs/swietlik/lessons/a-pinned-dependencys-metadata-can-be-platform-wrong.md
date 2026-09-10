---
title: "A pinned dependency's own metadata can be platform-wrong — pin forward, not back"
areas: ["dependencies", "build-tooling"]
topics: ["install-failures", "platform-windows", "version-pins"]
---

# A pinned dependency's own metadata can be platform-wrong — pin forward, not back

**Context**: `@asls/wsc-client` and `@asls/wsc-sdk` are pinned at `^2.2.0`. Version 2.1.0 of those
packages declares `os: "windows"` in its own `package.json` — not a legal npm value, which is
`win32` — so `npm ci` hard-fails with `EBADPLATFORM` on Windows. Nothing in this repo is at fault
and nothing in this repo can fix it. Separately, `@asls/wsc-client` declares
`engines.node: "18"` while local Node is 24, which makes `npm ci` print an `EBADENGINE` warning
on every clean install; that one is harmless and is documented as expected in `CLAUDE.md §3`.

**Problem**: Both facts invite the same wrong reflex. `EBADPLATFORM` reads like a local
environment problem, so the instinct is to downgrade, add `--force`, or set
`--omit=optional` — and downgrading is precisely the move that *causes* it. `EBADENGINE` reads
like a problem at all, so the instinct is to "fix" it by changing the pin or the Node version,
churning the lockfile for a warning that has no effect. An agent that treats every install
diagnostic as actionable will make this repo worse in both directions.

**Rule**: Before acting on an install diagnostic, decide which of three things it is: (a) broken
metadata in a dependency — the fix is to pin **forward** past it and write down why, never to
downgrade or force; (b) cosmetic noise — record it as expected and leave it alone; (c) an actual
local problem. `.env`'s `WSC_VERSION` is kept aligned with the `@asls/*` pins, so a pin change is
a two-file change. Never drop `@asls/wsc-client` / `@asls/wsc-sdk` below 2.2.0, and never run
`npm install --force` to get past `EBADPLATFORM`.

**Applies to**: Every dependency add, bump, or removal, and any `npm ci` failure. General form:
a version pin can encode a defect in the *package*, not a preference of ours, and such a pin is
a floor rather than a choice.
