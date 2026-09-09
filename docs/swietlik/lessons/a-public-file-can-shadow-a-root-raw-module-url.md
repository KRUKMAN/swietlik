---
title: "A file in public/ can shadow a root ?raw module URL and break the whole app"
areas: ["build-tooling", "licence"]
topics: ["module-resolution", "static-assets", "dev-vs-build"]
---

# A file in public/ can shadow a root ?raw module URL and break the whole app

**Context**: The splash popup needs to serve the GPL text, so the root `COPYING` is duplicated
into `public/` for the built app. Naming that copy `public/COPYING` — the obvious choice, matching
the root file — breaks the entire application in dev: Vite serves `public/` at the site root, so
the static file shadows the `@root/COPYING?raw` module URL the app imports, and the import
resolves to something that is not a module. The fix was to name it `public/COPYING.txt`;
`CLAUDE.md §9` records both the file and the reason.

**Problem**: The failure mode is maximally misleading. It is total (the app does not load, not
"the splash is wrong"), it is absent from the production build or present differently, and
nothing in the error points at `public/`. An agent debugging it reads the stack trace, the
importer, and the splash component — none of which are at fault — while the actual cause is a
filename collision in a directory it never opened.

**Rule**: A file added to `public/` claims the root URL path of its own name, and that path
shadows any module URL the app imports at the same path. Before adding anything to `public/`,
grep for the bare name as an import target (`rg -n 'COPYING' src/`). When a duplicate of a root
file is genuinely needed there, give it a distinct extension, and record the pair in
`CLAUDE.md §9` — two files holding the same text must be synced together or they will drift.
More generally: when an app breaks *totally* in dev but the stack trace implicates innocent code,
suspect module-URL resolution and static-asset precedence before suspecting the code.

**Applies to**: Every addition to `public/`, and any dev-only total failure. Note the licence
coupling: `COPYING` and `public/COPYING.txt` must both carry the verbatim GPL text
(`CLAUDE.md §8`), so a change to one is never complete on its own.
