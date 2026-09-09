# Świetlik — Roadmap

Five phases. Each one gets its own **brainstorm → spec → plan** cycle before any implementation starts; nothing below is a licence to start coding.

---

## Product goals

- **Previz-first.** The primary job is previsualization for Rundown Digital's own productions: design and check a rig before load-in, not to run a show off a laptop. Hardware output stays supported, but it is not what the product is optimised for.
- **Possible SaaS later.** Nothing in the architecture should hard-block a hosted, multi-user version. Avoid decisions that assume a single local machine, a single show, or filesystem-only persistence.
- **Layered UX.** One app that a beginner can use in five minutes and a full-time programmer can live in all day — depth revealed progressively, not bolted on as a separate "advanced" product.
- **Full scene realism.** The 3D viewport should be convincing enough that a client signs off on a look from a render.

---

## Phase 0 — Foundation ✅ DONE

Fork, rebrand, test harness, CI.

- Forked `ASLS-org/studio` → `KRUKMAN/swietlik`, with `develop` kept as a pristine upstream mirror and `upstream` remote wired up.
- Rebranded: name, logos, titles, splash, toolbar, Electron product metadata, docs configs — while **preserving** all GPL-3.0 attribution to Timé Kadel / ASLS-org.
- Dependency fixes: `@asls/wsc-*` bumped to `^2.2.0` (2.1.0 `EBADPLATFORM`s on Windows), `WSC_VERSION` aligned, `semantic-release` dropped.
- Test harness from zero: Vitest + jsdom, a separate `vitest.config.mjs`, module-boundary stubs for Three.js and WSC, and an inline plugin for Vite `?worker` imports — **156 tests / 10 files, zero upstream refactoring**.
- `npm run lint:ci` brought to **0 errors** (12 tolerated pre-existing warnings).
- GitHub Actions CI (`.github/workflows/ci.yaml`): `npm ci` → `lint:ci` → `test:run` → `build` on push/PR to `main`.
- Divergence ledger established at [`upstream-diff.md`](upstream-diff.md); render checklist at [`verification.md`](verification.md); agent orientation at [`/CLAUDE.md`](../../CLAUDE.md).

---

## Phase 1 — MCP command API

**Goal: Claude can drive the application.**

Expose a Model Context Protocol command surface over the `Show` facade (`src/singletons/show.singleton.js`, the Vue global `$show`) so an agent can patch fixtures, build groups, set channel values, create cues and chases, and read the show's state back — the same operations the UI performs, through the same object.

Why the facade is the right seam: it is already the single point through which every view mutates the show, it is already reactive, and targeting it means the MCP layer is **additive** — new files, no upstream edits.

Also in scope: this same surface doubles as **dev and verification tooling**. An agent that can query show state and set a dimmer to 255 can drive the [verification checklist](verification.md) end to end instead of a human clicking through it.

Open questions for the brainstorm: transport (in-page bridge vs. sidecar process); read-model shape (how much of the object graph to serialise); write safety (undo? dry-run? confirmation for destructive ops); whether the same surface should eventually back a scripting API for users.

---

## Phase 2 — Stage builder

**Goal: build the venue, not just the fixture list.**

- Venue geometry: room dimensions, stage/riser blocks, floor, walls.
- Rigging: trusses (straight, corner, circle), towers, ladders, floor positions — with fixtures attachable to them.
- LED walls and set-piece surfaces as first-class objects.
- Drag-and-drop fixture placement directly in the 3D viewport, with snapping to truss.
- **Auto-patching**: dropping fixtures onto a truss assigns DMX addresses and universes automatically, respecting footprint and leaving gaps where asked.

This is where previz stops being "a list of lights in a void" and starts being a room a client recognises.

---

## Phase 3 — Rendering realism

**Goal: renders a client will sign off on.**

- Volumetrics: proper light shafts beyond the current single-pass beam shader.
- Atmospheric haze with controllable density (the thing that makes beams visible at all).
- Gobo projection and rotation.
- PBR materials for stage surfaces, truss, and fixtures.
- HDR pipeline, tone mapping, bloom, exposure control.

**Easy entry point:** the `postprocessing` package (`^6.36.4`) is **already installed and completely unwired** — nothing in `src/` imports it. Wiring an `EffectComposer` with bloom + tone mapping into `src/plugins/visualizer/visualizer.js` is the cheapest first visible win of this phase.

Watch the boundary: the model layer touches the visualizer through exactly two imports in `fixture.model.js`. Rendering work must not widen that.

---

## Phase 4 — Layered UX

**Goal: simple by default, professional on demand.**

- A **simple mode**: pick fixtures, place them, choose looks, go. No DMX vocabulary required to get a usable result.
- A **pro mode**: the full patch/channel/cue/chase/effect surface that exists today.
- Progressive disclosure between the two rather than a hard mode switch — the same show, the same objects, more controls revealed as the user asks for them.
- Revisit the UI kit and information architecture accordingly; this is the phase where upstream's UI assumptions get genuinely reconsidered.

---

## Process

For every phase: **brainstorm** (what and why, options, trade-offs) → **spec** (agreed behaviour and boundaries) → **plan** (ordered, verifiable steps) → implement. Log any upstream `src/` file touched along the way in [`upstream-diff.md`](upstream-diff.md).
