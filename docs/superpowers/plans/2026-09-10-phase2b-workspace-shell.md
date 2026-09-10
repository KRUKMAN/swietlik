# Świetlik Phase 2B — Workspace Shell + Keyboard Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every panel in Świetlik resizable behind our own `uk-workspace` wrapper, move the app root to an additive `workspace.activity.vue` that shares one bootstrap composable with the existing activity, and land the single additive keyboard router that reclaims `Ctrl+Z` for undo — all for **three modified lines in `src/App.vue` plus one `package.json` dependency line**.

**Architecture:** A headless, framework-free layout store (`workspace.layout.store.js`) owns the whole layout as percentages: named groups of panes, per-pane minimum sizes, three named presets (`build` · `look` · `show`), normalisation, serialisation. Two thin SFCs (`workspace.shell.vue`, `workspace.pane.vue`) wrap `splitpanes@4` and are the *only* files that know the library exists — swapping in `dockview` in Phase 4 is one file. A new `workspace.activity.vue` assembles the five existing fragments into that shell without editing one of them: the fragments' hard-coded widths are neutralised with `:deep()` overrides from the activity's scoped stylesheet. The bootstrap `setup()` logic currently inlined in `app.activity.vue` is lifted into an additive plain-JS composable so the new root does not duplicate it. Separately, one window-level **capturing** keydown listener (`keyboard.router.js`) sits in front of the eight uncoordinated bubble-phase listeners the app already has, claims only the combos it is asked to claim, and passes everything else through untouched.

**Tech Stack:** Vue 3 (Options API, `@vue/compat` present but not active — arch §0.1) + Vite 5, `splitpanes@^4.1.2` (MIT, zero runtime deps, `vue` peer `^3.2.0`), plain-JS DMX domain models, `mitt` EventBus, Vitest 3 + jsdom, the existing MCP command registry.

**Spec:** [`docs/superpowers/specs/2026-09-10-phase2-instrument-design.md`](../specs/2026-09-10-phase2-instrument-design.md)
**Product source:** [`docs/swietlik/phase2-scope-draft.md`](../../swietlik/phase2-scope-draft.md) §3 (P2-2 workspace, AC-15..AC-21) and §6 (P2-5 keyboard router, AC-38..AC-40)
**Architecture source:** [`docs/swietlik/phase2-architecture-options.md`](../../swietlik/phase2-architecture-options.md) §0.7, §2, §4.2
**Evidence of the problem:** [`docs/swietlik/ux-audit.md`](../../swietlik/ux-audit.md) §2.2 and §3.7

**Scope of THIS plan:** P2-2 (workspace layout shell v1) + P2-5 (keyboard router seed). **Not** in this plan: P2-0 housekeeping, P2-1 transport, P2-3 timeline, P2-4 fixture records, P2-6 MIDI. The bottom pane keeps the existing `modifier.fragment.vue` contents — the *tabbed editor pane* (scope §3.2 bullet 2) is a P2-3-era change to the modifier fragment and is explicitly **out** here; this plan makes the strip resizable, which is the half that unblocks the timeline.

**Review granularity:** `checkpoint` — review the accumulated diff after Task 4, after Task 6, and after Task 9. Chosen over `final` because Task 6 swaps the application root: a defect there is invisible in unit tests and compounds into every later task. Chosen over `per-step` because only two files in the plan sit on a contract surface (`src/App.vue`, the MCP tool catalogue) and both are single-task.

---

## Global Constraints

Every task's requirements implicitly include this section. Rulings quoted verbatim from the spec are marked **[spec]**.

- **[spec] Ruling 2 — "Upstream edits budget is the plan's contract"**: *"~22–23 lines across 6 files (arch §7). Any task pushing past its area's line budget stops and re-plans. No monkey-patching upstream prototypes, ever — the ledger hook can't see it."* **This plan's share of that budget is: `src/App.vue` (3 modified lines) and `package.json` (1 added dependency line). Nothing else upstream may be touched.** If a task believes it needs another upstream edit, it **stops and reports** rather than making it.
- **[spec] Ruling 3**: *"`splitpanes@4` adopted (MIT, 82.7 KB, zero deps) behind `uk-workspace`; dockview deferred to Phase 4 behind the same wrapper."* The spec **pre-approves** the dependency, so `CLAUDE.md` §2's *Ask First* for a new production dependency is already satisfied — no further approval is needed, but the `package.json` ledger row is mandatory.
- **[spec] Ruling 4**: *"Root activity: new additive `workspace.activity.vue` + 2-line `App.vue` change; the bootstrap logic in `app.activity.vue`'s `setup()` is extracted into an additive composable used by both activities so nothing is duplicated (resolves arch §8-Q4 by dissolving the trade)."* See **Deviation D1** below — the composable is written and consumed by the *new* activity; retrofitting `app.activity.vue` is deliberately deferred because it would blow ruling 2's line budget.
- **[spec] Ruling 5**: *"Serialisation seam: `ShowSingleton` overrides (`showData` spread + `loadFromData` restore ordering per arch §4.2-B). One seam serves workspace layouts now, venue and hang positions later."* **This plan consumes that seam; it does not build it.** Task 8 is the only task that touches it and it is **blocked on Plan A / P2-0**.
- **[spec] Ruling 11**: *"MCP surface: every P2 feature ships its MCP commands in the same task that ships the feature (transport_\*, get_transport_state, set/get_workspace, set_fixture_meta, simulate_midi, …); `tool-parity.spec.js` extended in the same PR."*
- **[spec] Verification gate**: *"Existing 408 tests stay green; lint 0 errors; upstream-edit ledger current."* `npm run test:run` must report **408 + the new tests, 0 failures**.
- **`npm run lint:ci` must stay at 0 errors.** It lints `src` only (`eslint --ext .js,.vue --ignore-path .gitignore src`), so every new file under `src/views/` and `src/mcp-bridge/` is subject to `airbnb-base` + `plugin:vue/vue3-recommended`. Concretely: `max-len` 100 chars; `no-restricted-syntax` bans `for…of` and `for…in` (use classic `for` or array methods); `class-methods-use-this` is an error; `import/extensions` is `js: 'never'`; `no-console` is a warning and the repo tolerates **13** pre-existing warnings — do not add a 14th without an inline `// eslint-disable-next-line no-console`. Files under `mcp/` and `test/` are outside the lint path.
- **Additive-first** (`CLAUDE.md` §2). Every upstream file touched **MUST** be logged in [`docs/swietlik/upstream-diff.md`](../../swietlik/upstream-diff.md) **in the same commit** — `.claude/hooks/upstream-diff-check.mjs` blocks the stop otherwise. Both of this plan's upstream files (`package.json`, `src/App.vue`) already have ledger rows: **append to the existing row, do not create a second one.**
- **Vue SFCs are NOT unit-testable in this repo, and this plan does not pretend otherwise.** `CLAUDE.md` §5: *"Vue SFCs — no component test harness is installed (no `@vue/test-utils`, no `@testing-library/vue`). Adding one is a deliberate future decision, not a drive-by."* `.claude/harness.json` lists `src/views/` under `untestable.paths`. **Therefore:** all layout, bootstrap, keyboard and persistence *logic* lives in plain-JS modules with real Vitest coverage (Tasks 2, 3, 4, 7, 8); the SFC layer (Tasks 5 and 6) carries **no unit tests at all** and is verified instead by `npm run build` plus the [`verification.md`](../../swietlik/verification.md) §8 MCP/browser checklist extended in Task 9. Any task that "adds a component test" has gone off-plan.
- **Percentages, not pixels.** `splitpanes` sizes every pane as a percentage of its container (verified: `pane.vue` computes `` `${horizontal ? 'height' : 'width'}: ${size}%` ``). The layout store therefore stores percentages and every minimum is a percentage. This is what makes scope §3.4 **AC-21** ("restoring a saved layout whose total exceeds the current viewport rescales proportionally instead of pushing content off-screen") true by construction rather than by arithmetic.
- **Showfile format is ADDITIVE-ONLY** ([`contract-surfaces.md`](../../swietlik/contract-surfaces.md) §1): *"Adding an optional field with a safe default when absent: ADDITIVE-ONLY, fine."* A showfile with no `workspace` key must load at defaults with no error and no console warning (scope §3.4 **AC-20**).
- **GPL-3.0 applies to every new file.** No attribution removal. `splitpanes` is MIT, which is GPL-3.0-compatible (arch §2.2).
- **Never commit** `node_modules/`, `dist/`, `out/`.

### Deviations from the sources, declared up front

| # | Deviation | Why |
|---|---|---|
| **D1** | Spec ruling 4 says the bootstrap composable is *"used by both activities"*. This plan builds the composable and wires it into `workspace.activity.vue` **only**; `app.activity.vue` keeps its inline copy. | Retrofitting `app.activity.vue` means ~20 deleted + ~4 added lines in an upstream file that today has **zero** fork divergence (arch §2.4), i.e. a brand-new ledger entry and ~24 lines against a 2-line budget. Ruling 2 says *"Any task pushing past its area's line budget stops and re-plans."* Ruling 2 outranks the convenience half of ruling 4; the *purpose* of ruling 4 — "so nothing is duplicated" — is met, because the new activity contains no copy of the bootstrap. The retrofit is written up as **Task 6.OPT**, marked DO-NOT-EXECUTE, so a future budget decision is a five-minute job. |
| **D2** | Arch §2.4 budgets `src/App.vue` at *"2 (import + tag)"*. The real diff is **3 modified lines**. | The arch doc overlooked the `components: { AppActivity }` registration entry (`App.vue:16`), which must change too. Three modified lines, zero added. Recorded here rather than silently absorbed. |
| **D3** | Scope §6 says the app *"already has five uncoordinated `window` keydown listeners"*. There are **eight**. | Measured, with file:line, in Task 4's *Coexistence map*. The count in the scope doc was low; the plan uses the measured list. |
| **D4** | This plan registers `Ctrl+Y` for redo alongside `Ctrl+Z` / `Ctrl+Shift+Z`. | Scope §6 lists `Ctrl+Z`/`Ctrl+Shift+Z`; `Ctrl+Y` is already advertised in the EDIT menu (`toolbar.fragment.vue:192`) and is currently **broken** — see finding F1. Reclaiming it is three lines inside the same task and fixes the same latent bug. It migrates no other binding. |
| **D5** | `bootstrap.attach()` is called from `created()`, not `mounted()`. | See Task 6, risk R6-1: the upstream ordering only works because `visualizer.fragment.vue:130-136` awaits `init()` before emitting `visualizer_loaded`. `created()` is strictly earlier and behaviourally identical. |
| **D6** | Scope §3.2 bullet 2 ("the bottom strip becomes one tabbed editor pane") is **not** implemented. | It is a rewrite of `modifier.fragment.vue` (upstream) plus the nine widget panels, worth far more than the 3-line budget, and it belongs with P2-3 (the timeline is one of the tabs). This plan delivers the *resizable* half — the half the timeline is blocked on (scope §1, argument 3). Recorded so nobody thinks it was forgotten. |

### Findings from the read-through that the executor must not re-discover

- **F1 — `$show.undo()` and `$show.redo()` are broken today.** `Show#undo` and `Show#redo` are **static** methods (`src/models/DMX/show.model.js:171` and `:179`). `$show` is `reactive(ShowSingleton)`, an *instance* — static methods are not on instances. So `toolbar.fragment.vue:187` (`this.$show.undo()`) and `:195` (`this.$show.redo()`) throw `TypeError: this.$show.undo is not a function`. The MCP bridge already gets this right: `show.commands.js:138` calls `Show.undo()` on the imported class. **Task 4 must call the static, via the class.**
- **F2 — the visualizer already re-sizes itself.** `visualizer.fragment.vue:132-135` attaches a `ResizeObserver` to `$refs.visualizer` bound to `Visualizer#resize` (`plugins/visualizer/visualizer.js:363-374`, which reads `offsetWidth`/`clientHeight` and calls `renderer.setSize` + `camera.updateProjectionMatrix`). **No extra wiring is needed to make the 3D view follow a splitter drag** — but a browser check is still required, because the observer fires on the *element*, and the element is now inside a `.splitpanes__pane` that animates its width for 200 ms.
- **F3 — the router renders nothing** (arch §0.7): there is no `<router-view>` in `src/`; `modifier.fragment.vue:3-5` mounts all three modifiers permanently and toggles them with `v-show` keyed on `$route.name`. Changing the root activity therefore needs **no** router change, and the modifier fragment keeps working untouched.
- **F4 — `$router._appReayState` is write-only.** Grepped across `src/`: assigned at `app.activity.vue:86` and `:119`, read nowhere. Port it anyway (faithful port; a future reader may add the consumer), but do not build anything on it.

---

## File Structure

| Path | Responsibility | Task | Upstream? |
| --- | --- | --- | --- |
| `package.json` | One added line: `"splitpanes": "^4.1.2"` in `dependencies`. | 1 | **upstream — existing ledger row** |
| `package-lock.json` | Regenerated by `npm install`. | 1 | **upstream — existing ledger row** |
| `src/views/components/workspace/workspace.layout.store.js` | The whole headless layout model: `normalizeSizes`, `createWorkspaceLayoutStore`, the group descriptors, the `build`/`look`/`show` presets, and the app-wide singleton. Knows nothing about Vue or `splitpanes`. | 2 | additive |
| `test/workspace/layout.store.spec.js` | Unit coverage for AC-15, AC-16, AC-17(partial), AC-20, AC-21 and the preset table. | 2 | additive |
| `src/views/composables/useShowBootstrap.js` | The load-or-demo bootstrap lifted out of `app.activity.vue:101-122`, as an injectable plain-JS factory. | 3 | additive |
| `test/views/show-bootstrap.spec.js` | Unit coverage for the bootstrap paths, the `app_ready` emission and attach/detach. | 3 | additive |
| `src/views/keyboard/keyboard.router.js` | `normalizeCombo`, `comboFromEvent`, `isEditableTarget`, `createKeyboardRouter`, and the app-wide singleton. One capturing `keydown` listener. | 4 | additive |
| `src/views/keyboard/keyboard.bindings.js` | The Phase 2 binding table: `Ctrl+Z` → `Show.undo()`, `Ctrl+Shift+Z` / `Ctrl+Y` → `Show.redo()`. | 4 | additive |
| `test/keyboard/keyboard.router.spec.js` | Registration, context resolution, editable-target guard, unbind, and the capture-phase reclaim proof. | 4 | additive |
| `test/keyboard/keyboard.bindings.spec.js` | The binding table dispatches to the static `undo`/`redo`. | 4 | additive |
| `src/views/components/workspace/workspace.pane.vue` | One pane's chrome: an `aria-label`led `<section>` with a `data-pane-id` hook for browser verification. | 5 | additive |
| `src/views/components/workspace/workspace.shell.vue` | `uk-workspace`: renders `<splitpanes>` + one `<pane>` per store descriptor, exposes a named slot per pane id, pushes drags back into the store, resets on splitter double-click. **The only file that imports `splitpanes`.** | 5 | additive |
| `src/views/activities/workspace/workspace.activity.vue` | The new root: toolbar fixed on top, then `uk-workspace` nesting `patch-bay │ group-pool │ visualizer` above the modifier strip; owns the splash/error popups, the bootstrap composable, the keyboard router attach and the width-neutralising `:deep()` CSS. | 6 | additive |
| `src/App.vue` | **THE ONLY UPSTREAM SOURCE EDIT** — 3 modified lines swapping `AppActivity` for `WorkspaceActivity`. | 6 | **upstream — existing ledger row** |
| `src/mcp-bridge/commands/workspace.commands.js` | `get_workspace`, `set_workspace`. Self-registers through `commands/index.js`'s `import.meta.glob` — **the index is never edited.** | 7 | additive |
| `mcp/tools.js` | Two appended `TOOLS` entries. | 7 | additive (ours) |
| `test/mcp/tool-parity.spec.js` | One added string in the `loadedCommandModules` assertion. | 7 | additive (ours) |
| `test/mcp-bridge/workspace.commands.spec.js` | Command coverage: read model, preset switch, size set, validation errors. | 7 | additive |
| `src/views/components/workspace/workspace.persistence.js` | Registers the layout store with the P2-0 `registerShowExtension` seam. | 8 | additive |
| `test/workspace/persistence.spec.js` | Seam registration shape + `.asls` round-trip + absent-key default. | 8 | additive |
| `docs/swietlik/verification.md` | New §9 workspace/keyboard checklist + a Result row. | 9 | additive (ours) |
| `docs/swietlik/upstream-diff.md` | Appended text on the existing `package.json` and `src/App.vue` rows. | 1, 6 | additive (ours) |

### Dependency order

```
Task 1 (dep + ledger) ──────────────┐
                                    │
Task 2 (layout store) ──┬───────────┼──> Task 5 (shell + pane SFC) ──┐
   [group A]            │           │                                │
Task 3 (bootstrap) ─────┼───────────┼────────────────────────────────┼──> Task 6 (activity + App.vue)
   [group A]            │                                            │        [spine]
Task 4 (keyboard) ──────┼────────────────────────────────────────────┘
   [group A]            │
                        └──> Task 7 (MCP get/set_workspace)   [group B, with Task 5]

Plan A / P2-0 seam ──────────> Task 8 (persistence)   ** BLOCKED until the seam lands **

Tasks 1–8 ───────────────────> Task 9 (verification)   [inline]
```

Tasks **2, 3, 4** write disjoint files, consume nothing from each other, and are comparable in size — dispatch all three **in one assistant message** (plan-format §3: split across turns they serialise). Tasks **5 and 7** likewise. Everything else is sequential.

### Exec plan

| Step | What | Exec | Done when |
|---|---|---|---|
| 1 | `splitpanes@^4.1.2` dependency + ledger | `inline` | `npm ls splitpanes` prints `splitpanes@4.1.2`, `npm run build` exits 0, ledger row names it |
| 2 | Headless layout store + presets + tests | `group:A:capable` | `npx vitest run test/workspace/layout.store.spec.js` passes; `lint:ci` 0 errors |
| 3 | `useShowBootstrap` composable + tests | `group:A:standard` | `npx vitest run test/views/show-bootstrap.spec.js` passes; `lint:ci` 0 errors |
| 4 | Keyboard router + bindings + tests | `group:A:capable` | `npx vitest run test/keyboard` passes incl. the capture-reclaim test; `lint:ci` 0 errors |
| 5 | `uk-workspace` shell + pane SFCs | `group:B:standard` | `npm run build` exits 0; `lint:ci` 0 errors; **no test files added** |
| 6 | `workspace.activity.vue` + `App.vue` swap + `:deep` CSS + ledger | `dispatch:capable` | `npm run build` exits 0; `npm run test:run` 408 + new, 0 failures; `git diff develop...HEAD -- src/App.vue` shows exactly 3 changed lines |
| 7 | MCP `get_workspace` / `set_workspace` + tools + parity | `group:B:standard` | `npx vitest run test/mcp` and `test/mcp-bridge/workspace.commands.spec.js` pass |
| 8 | Layout persistence via `registerShowExtension` | `dispatch:standard` | **blocked**; then `npx vitest run test/workspace/persistence.spec.js` passes |
| 9 | Full gate + `verification.md` §9 + browser checklist | `inline` | all three gate commands exit 0; §9 checklist executed with evidence recorded |

Tier reasoning (plan-format §2): Tasks 2, 4 and 6 are `capable` — the store's normalisation arithmetic, the capture-phase propagation semantics, and the application-root swap all contain judgement the plan text can specify but not fully mechanise. Tasks 3, 5, 7, 8 are `standard`: the plan text is a settled design, the code blocks are complete. Nothing here is `cheap` — every task has a real failure mode.

**Failure escalation** (plan-format §2): one bounded retry per step, escalating exactly one tier. A step that fails twice is a planning defect — report it, do not re-dispatch at a larger model.

---

## Progress

- [ ] 1 Add the splitpanes dependency
- [ ] 2 Headless workspace layout store
- [ ] 3 useShowBootstrap composable
- [ ] 4 Keyboard router seed and the Ctrl+Z reclaim
- [ ] 5 uk-workspace shell and pane components
- [ ] 6 Workspace activity and the App.vue root swap
- [ ] 7 MCP get_workspace and set_workspace
- [ ] 8 Layout persistence through the show-extension seam
- [ ] 9 Verification pass

---

## Task 1: Add the `splitpanes` dependency

**Files:**
- Modify: `package.json` (one added line in `dependencies`)
- Modify: `package-lock.json` (regenerated)
- Modify: `docs/swietlik/upstream-diff.md:24` (append to the existing `package.json` row)

**Interfaces:**
- Consumes: nothing.
- Produces: the module specifier `splitpanes` resolving to `node_modules/splitpanes/dist/splitpanes.esm.js`, and the stylesheet `splitpanes/dist/splitpanes.css`. Task 5 is the only consumer.

**Verified facts about splitpanes 4.1.2** (read from the published tarball on 2026-09-10, not from memory):

| Fact | Value |
|---|---|
| Licence | MIT (`package/LICENSE`) — GPL-3.0-compatible |
| Runtime dependencies | **none** |
| Peer dependency | `vue: ^3.2.0` (we run 3.5.x) |
| Package type | `"type": "module"`, `main`/`module` → `./dist/splitpanes.esm.js` |
| `exports` map | `"."`, `"./package.json"`, `"./dist/*"` — **there is no `./css` subpath.** The README's `import 'splitpanes/css'` is for a later release and **will fail here.** Use `import 'splitpanes/dist/splitpanes.css'`. |
| Shipped files | `dist/{splitpanes.esm.js,splitpanes.cjs.js,splitpanes.umd.js,splitpanes.css}`, plus the unbuilt `src/components/splitpanes/{index.js,index.d.ts,pane.vue,splitpanes.vue}` |

- [ ] **Step 1: Install the dependency**

The spec pre-approves this (ruling 3), so no separate approval round is needed.

```bash
cd /c/dev/swietlik
npm install --save --save-exact=false splitpanes@^4.1.2
```

Expect and ignore the `EBADENGINE` warning from `@asls/wsc-client` (`CLAUDE.md` §3).

- [ ] **Step 2: Verify the install and the resolved paths**

```bash
npm ls splitpanes
node -e "const p=require('./node_modules/splitpanes/package.json');console.log(p.version,p.license,JSON.stringify(p.dependencies||{}));"
ls node_modules/splitpanes/dist
```

Expected: `splitpanes@4.1.2`, `4.1.2 MIT {}`, and a `dist/` listing containing `splitpanes.css` and `splitpanes.esm.js`.

If `npm ls` reports a version other than `4.1.2`, **stop**: the arch doc's bundle/licence audit was done against 4.1.2 and a newer major may have moved the CSS entry point.

- [ ] **Step 3: Confirm `package.json` gained exactly one line**

```bash
git diff -- package.json
```

Expected: exactly one added line inside `"dependencies"`, alphabetically after `"raw-loader"` and before `"stats.js"`:

```json
    "splitpanes": "^4.1.2",
```

If npm reordered or reformatted anything else in `package.json`, revert those hunks by hand — the budget is one line.

- [ ] **Step 4: Append to the existing ledger row**

`docs/swietlik/upstream-diff.md:24` already carries a `package.json` row. **Append to its Reason cell**; do not add a second row. The sentence to append:

```
 Phase 2B: added the `splitpanes` `^4.1.2` production dependency (MIT, zero runtime deps, `vue` peer `^3.2.0`) — the resizable workspace shell, pre-approved by the Phase 2 spec ruling 3 and wrapped behind our own `uk-workspace` so the library can be swapped in Phase 4.
```

- [ ] **Step 5: Prove the build still works and commit**

```bash
npm run lint:ci
npm run build
```

Expected: lint exits 0 with 13 warnings; build exits 0. (Nothing imports `splitpanes` yet, so this is a pure "did the install break the tree" check.)

```bash
git add package.json package-lock.json docs/swietlik/upstream-diff.md
git commit -m "build: add splitpanes@^4.1.2 for the Phase 2 workspace shell

Pre-approved by docs/superpowers/specs/2026-09-10-phase2-instrument-design.md
ruling 3. MIT, zero runtime deps. Wrapped behind uk-workspace so the library
is replaceable in Phase 4.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hisrh377ZdkTp4Kupbhhpf"
```

---

## Task 2: Headless workspace layout store

**Files:**
- Create: `src/views/components/workspace/workspace.layout.store.js`
- Test: `test/workspace/layout.store.spec.js`

**Interfaces:**
- Consumes: nothing. This module imports **nothing** — not Vue, not `splitpanes`, not the show. That is what makes it the only fully-tested part of the shell.
- Produces (all exports of `src/views/components/workspace/workspace.layout.store.js`):
  - `LAYOUT_VERSION: 1`
  - `SIZE_EPSILON: 1e-4`
  - `CUSTOM_PRESET: 'custom'`
  - `WORKSPACE_GROUPS: Array<{ id: String, horizontal: Boolean, panes: Array<{ id: String, label: String, min: Number }> }>`
  - `WORKSPACE_PRESETS: Object<String, Object<String, Array<Number>>>`
  - `DEFAULT_PRESET: 'build'`
  - `normalizeSizes(sizes: Array<Number>, mins: Array<Number>) -> Array<Number>`
  - `createWorkspaceLayoutStore({ groups, presets, defaultPreset }) -> Store`
  - `default` — the app-wide `Store` singleton built from `WORKSPACE_GROUPS` / `WORKSPACE_PRESETS` / `DEFAULT_PRESET`
  - `Store` shape (every later task binds to these exact names):
    - `state: { version: Number, preset: String, sizes: Object<String, Array<Number>> }`
    - `groups: Array<GroupDescriptor>` (frozen)
    - `defaultPreset: String`
    - `getGroup(groupId: String) -> GroupDescriptor` — throws `RangeError` on an unknown id
    - `getSizes(groupId: String) -> Array<Number>` — a copy, never the live array
    - `getPaneSize(groupId: String, paneId: String) -> Number`
    - `getPaneMin(groupId: String, paneId: String) -> Number`
    - `setSizes(groupId: String, sizes: Array<Number>) -> Array<Number>` — normalised result
    - `applyPreset(name: String) -> Object` — returns `serialize()`; throws `RangeError` on an unknown preset
    - `resetGroup(groupId: String) -> Array<Number>`
    - `reset() -> Object`
    - `listPresets() -> Array<String>`
    - `serialize() -> { version: Number, preset: String, sizes: Object<String, Array<Number>> }`
    - `restore(data: Object|undefined) -> Boolean`
    - `toTree() -> Array<{ id, horizontal, panes: Array<{ id, label, size, min }> }>`
    - `onChange(listener: Function) -> Function` — the returned function unsubscribes

**Design notes the implementer must not re-litigate:**

1. **Sizes are percentages of the parent container**, because that is what `splitpanes` consumes. Every group's sizes sum to exactly `100`.
2. **Two groups, nested.** `body` is horizontal (stacked) and holds `stage` above `editor`; `stage` is vertical (side-by-side) and holds `patch-bay │ group-pool │ visualizer`. The pane id `stage` in group `body` deliberately equals the group id `stage` — that identity is how `workspace.activity.vue` nests one shell inside another's slot.
3. **`preset` collapses to `'custom'`** the moment a stored size stops matching the active preset. Restoring a showfile that says `preset: 'look'` with no `sizes` reproduces `look` exactly.
4. **`normalizeSizes` is total.** Any input — negative, `NaN`, all-zero, wrong magnitude — produces a valid layout. It throws only on a *structural* error (wrong length, impossible minimums), because those are programming errors, not data errors.

- [ ] **Step 1: Write the failing test**

Create `test/workspace/layout.store.spec.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import workspaceLayoutStore, {
  LAYOUT_VERSION,
  CUSTOM_PRESET,
  DEFAULT_PRESET,
  WORKSPACE_GROUPS,
  WORKSPACE_PRESETS,
  normalizeSizes,
  createWorkspaceLayoutStore,
} from '@/views/components/workspace/workspace.layout.store';

/**
 * A fresh store, so tests never share the app-wide singleton's mutable state.
 *
 * @return {Object} store
 */
function freshStore() {
  return createWorkspaceLayoutStore({
    groups: WORKSPACE_GROUPS,
    presets: WORKSPACE_PRESETS,
    defaultPreset: DEFAULT_PRESET,
  });
}

/**
 * @param {Array<Number>} sizes any size array
 * @return {Number} their sum
 */
const total = (sizes) => sizes.reduce((sum, value) => sum + value, 0);

describe('normalizeSizes', () => {
  it('leaves an already-valid layout alone', () => {
    expect(normalizeSizes([50, 50], [0, 0])).toEqual([50, 50]);
  });

  it('scales any total up or down to exactly 100', () => {
    expect(normalizeSizes([25, 25], [0, 0])).toEqual([50, 50]);
    expect(normalizeSizes([200, 200], [0, 0])).toEqual([50, 50]);
    expect(total(normalizeSizes([14, 28, 58], [6, 12, 20]))).toBeCloseTo(100, 6);
  });

  it('distributes evenly when every size is zero or unusable', () => {
    expect(normalizeSizes([0, 0], [0, 0])).toEqual([50, 50]);
    expect(normalizeSizes([Number.NaN, Number.NaN], [0, 0])).toEqual([50, 50]);
    expect(normalizeSizes([-5, -5], [0, 0])).toEqual([50, 50]);
  });

  it('clamps a pane up to its minimum and takes the deficit from panes with slack', () => {
    expect(normalizeSizes([2, 98], [10, 10])).toEqual([10, 90]);
  });

  it('takes a minimum deficit proportionally from every pane with slack', () => {
    // AC-16: a drag below a minimum clamps; it does not jump or overflow.
    expect(normalizeSizes([1, 28, 71], [6, 12, 20])).toEqual([6, 26.806, 67.194]);
    expect(total(normalizeSizes([1, 28, 71], [6, 12, 20]))).toBeCloseTo(100, 6);
  });

  it('throws when the size and minimum arrays disagree in length', () => {
    expect(() => normalizeSizes([50, 50], [0, 0, 0])).toThrow(RangeError);
  });

  it('throws when the minimums cannot fit in 100%', () => {
    expect(() => normalizeSizes([50, 50], [60, 60])).toThrow(RangeError);
  });
});

describe('workspace layout store -- defaults and presets', () => {
  it('starts on the default preset with every group seeded', () => {
    const store = freshStore();
    expect(store.state.preset).toBe(DEFAULT_PRESET);
    expect(store.state.version).toBe(LAYOUT_VERSION);
    expect(store.getSizes('body')).toEqual(WORKSPACE_PRESETS[DEFAULT_PRESET].body);
    expect(store.getSizes('stage')).toEqual(WORKSPACE_PRESETS[DEFAULT_PRESET].stage);
  });

  it('names exactly the three presets the product vision asks for', () => {
    expect(freshStore().listPresets()).toEqual(['build', 'look', 'show']);
  });

  it('gives every preset a valid, minimum-respecting layout for every group', () => {
    const store = freshStore();
    store.listPresets().forEach((name) => {
      store.applyPreset(name);
      store.groups.forEach((group) => {
        const sizes = store.getSizes(group.id);
        expect(sizes, `${name}/${group.id} length`).toHaveLength(group.panes.length);
        expect(total(sizes), `${name}/${group.id} total`).toBeCloseTo(100, 6);
        sizes.forEach((size, index) => {
          expect(size, `${name}/${group.id}/${group.panes[index].id}`)
            .toBeGreaterThanOrEqual(group.panes[index].min);
        });
      });
    });
  });

  it('rejects an unknown preset name', () => {
    expect(() => freshStore().applyPreset('nope')).toThrow(RangeError);
  });

  it('rejects an unknown group id', () => {
    expect(() => freshStore().getGroup('nope')).toThrow(RangeError);
  });
});

describe('workspace layout store -- resizing', () => {
  it('keeps the total invariant when a splitter moves (AC-15)', () => {
    const store = freshStore();
    const before = store.getSizes('stage');
    const after = store.setSizes('stage', [before[0] + 6, before[1] - 6, before[2]]);
    expect(total(after)).toBeCloseTo(100, 6);
    expect(after[0]).toBeCloseTo(before[0] + 6, 6);
    expect(after[1]).toBeCloseTo(before[1] - 6, 6);
    expect(after[2]).toBeCloseTo(before[2], 6);
  });

  it('clamps rather than jumping when a pane is dragged under its minimum (AC-16)', () => {
    const store = freshStore();
    const after = store.setSizes('stage', [0, 30, 70]);
    expect(after[0]).toBe(store.getPaneMin('stage', 'patch-bay'));
    expect(total(after)).toBeCloseTo(100, 6);
  });

  it('marks the layout custom once a size stops matching the active preset', () => {
    const store = freshStore();
    expect(store.state.preset).toBe(DEFAULT_PRESET);
    store.setSizes('body', [50, 50]);
    expect(store.state.preset).toBe(CUSTOM_PRESET);
  });

  it('stays on the preset when the incoming sizes are the preset sizes', () => {
    const store = freshStore();
    store.setSizes('body', WORKSPACE_PRESETS[DEFAULT_PRESET].body.slice());
    expect(store.state.preset).toBe(DEFAULT_PRESET);
  });

  it('restores one group to its base preset on resetGroup (AC-17, splitter double-click)', () => {
    const store = freshStore();
    store.applyPreset('look');
    store.setSizes('stage', [40, 40, 20]);
    expect(store.state.preset).toBe(CUSTOM_PRESET);
    expect(store.resetGroup('stage')).toEqual(WORKSPACE_PRESETS.look.stage);
    // The other group is untouched by a single splitter reset.
    expect(store.getSizes('body')).toEqual(WORKSPACE_PRESETS.look.body);
  });

  it('never hands out the live array', () => {
    const store = freshStore();
    const sizes = store.getSizes('body');
    sizes[0] = 999;
    expect(store.getSizes('body')).toEqual(WORKSPACE_PRESETS[DEFAULT_PRESET].body);
  });

  it('rejects a size array of the wrong length', () => {
    expect(() => freshStore().setSizes('body', [100])).toThrow(RangeError);
  });
});

describe('workspace layout store -- change notification', () => {
  it('notifies subscribers on every mutation and stops on unsubscribe', () => {
    const store = freshStore();
    const listener = vi.fn();
    const unsubscribe = store.onChange(listener);
    store.setSizes('body', [50, 50]);
    store.applyPreset('show');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.applyPreset('build');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify when a resize changes nothing', () => {
    const store = freshStore();
    const listener = vi.fn();
    store.onChange(listener);
    store.setSizes('body', store.getSizes('body'));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('workspace layout store -- serialisation (AC-20, AC-21)', () => {
  it('round-trips a custom layout', () => {
    const store = freshStore();
    store.setSizes('stage', [20, 30, 50]);
    const data = store.serialize();
    expect(data.version).toBe(LAYOUT_VERSION);

    const other = freshStore();
    expect(other.restore(data)).toBe(true);
    expect(other.getSizes('stage')).toEqual(store.getSizes('stage'));
    expect(other.state.preset).toBe(CUSTOM_PRESET);
  });

  it('round-trips a named preset without storing sizes twice', () => {
    const store = freshStore();
    store.applyPreset('show');
    const other = freshStore();
    expect(other.restore(store.serialize())).toBe(true);
    expect(other.state.preset).toBe('show');
    expect(other.getSizes('stage')).toEqual(WORKSPACE_PRESETS.show.stage);
  });

  it('falls back to defaults for a showfile with no workspace key (AC-20)', () => {
    const store = freshStore();
    store.applyPreset('show');
    expect(store.restore(undefined)).toBe(false);
    expect(store.state.preset).toBe(DEFAULT_PRESET);
    expect(store.getSizes('stage')).toEqual(WORKSPACE_PRESETS[DEFAULT_PRESET].stage);
  });

  it('falls back to defaults on a foreign or future layout version', () => {
    const store = freshStore();
    expect(store.restore({ version: 99, preset: 'show', sizes: {} })).toBe(false);
    expect(store.state.preset).toBe(DEFAULT_PRESET);
  });

  it('ignores individually malformed group entries without losing the rest', () => {
    const store = freshStore();
    const applied = store.restore({
      version: LAYOUT_VERSION,
      preset: CUSTOM_PRESET,
      sizes: { stage: [20, 30, 50], body: 'nonsense', ghost: [1, 2] },
    });
    expect(applied).toBe(true);
    expect(store.getSizes('stage')).toEqual([20, 30, 50]);
    expect(store.getSizes('body')).toEqual(WORKSPACE_PRESETS[DEFAULT_PRESET].body);
  });

  it('rescales a saved layout that does not sum to 100 (AC-21)', () => {
    const store = freshStore();
    // A layout saved on a wider monitor, expressed with a stale total.
    expect(store.restore({
      version: LAYOUT_VERSION,
      preset: CUSTOM_PRESET,
      sizes: { stage: [40, 60, 140] },
    })).toBe(true);
    const sizes = store.getSizes('stage');
    expect(total(sizes)).toBeCloseTo(100, 6);
    sizes.forEach((size, index) => {
      expect(size).toBeGreaterThanOrEqual(WORKSPACE_GROUPS[1].panes[index].min);
    });
  });
});

describe('workspace layout store -- read model', () => {
  it('produces the get_workspace tree with ids, labels, sizes and minimums', () => {
    const store = freshStore();
    const tree = store.toTree();
    expect(tree.map((group) => group.id)).toEqual(['body', 'stage']);
    expect(tree[1].horizontal).toBe(false);
    expect(tree[1].panes.map((pane) => pane.id))
      .toEqual(['patch-bay', 'group-pool', 'visualizer']);
    expect(tree[1].panes[0]).toEqual({
      id: 'patch-bay',
      label: 'Patch Bay',
      size: WORKSPACE_PRESETS[DEFAULT_PRESET].stage[0],
      min: 6,
    });
  });

  it('exports a ready-made app-wide singleton', () => {
    expect(workspaceLayoutStore.listPresets()).toEqual(['build', 'look', 'show']);
    expect(workspaceLayoutStore.groups.map((group) => group.id)).toEqual(['body', 'stage']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /c/dev/swietlik && npx vitest run test/workspace/layout.store.spec.js
```

Expected: FAIL — `Failed to resolve import "@/views/components/workspace/workspace.layout.store"`.

- [ ] **Step 3: Write the implementation**

Create `src/views/components/workspace/workspace.layout.store.js`:

```js
/**
 * Headless workspace layout model.
 *
 * The whole geometry of the workspace lives here as plain data and pure
 * functions: named groups of panes, per-pane minimums, three named presets and
 * the normalisation that keeps every group's sizes summing to exactly 100%.
 *
 * It imports nothing -- not Vue, not `splitpanes`, not the show -- which is
 * precisely why it is the part of the shell that has real unit tests. The two
 * SFCs above it (`workspace.shell.vue`, `workspace.pane.vue`) stay thin enough
 * that `npm run build` plus the docs/swietlik/verification.md checklist is
 * honest coverage for them (CLAUDE.md section 5: there is no component test
 * harness in this repo).
 *
 * Sizes are PERCENTAGES of the parent container, because that is what
 * `splitpanes` consumes. Storing percentages is also what makes a layout saved
 * on a 4K monitor open correctly on a laptop -- scope draft AC-21 is true by
 * construction rather than by arithmetic.
 *
 * @module views/components/workspace/workspace.layout.store
 */

/**
 * Serialised layout schema version. Bump only on a breaking shape change; a
 * showfile carrying any other value is ignored and the defaults are used.
 *
 * @constant {Number}
 */
export const LAYOUT_VERSION = 1;

/**
 * Percentage points below which two sizes are considered identical.
 *
 * @constant {Number}
 */
export const SIZE_EPSILON = 1e-4;

/**
 * Preset name meaning "the user moved a splitter".
 *
 * @constant {String}
 */
export const CUSTOM_PRESET = 'custom';

/**
 * The workspace's pane groups, outermost first. Each group is one
 * `splitpanes` container. The `stage` pane of the `body` group and the `stage`
 * group share an id on purpose -- that identity is how `workspace.activity.vue`
 * nests one shell inside the other's slot.
 *
 * `min` is a percentage of the group's own extent.
 *
 * @constant {Array<Object>}
 */
export const WORKSPACE_GROUPS = [
  {
    id: 'body',
    horizontal: true,
    panes: [
      { id: 'stage', label: 'Stage', min: 30 },
      { id: 'editor', label: 'Editor', min: 10 },
    ],
  },
  {
    id: 'stage',
    horizontal: false,
    panes: [
      { id: 'patch-bay', label: 'Patch Bay', min: 6 },
      { id: 'group-pool', label: 'Group Pool', min: 12 },
      { id: 'visualizer', label: 'Visualizer', min: 20 },
    ],
  },
];

/**
 * Named layout presets (product-vision.md's Build / Look / Show modes,
 * reduced to what a v1 splitter shell can actually express: sizes).
 *
 * - `build` -- rigging: the patch bay and group pool are wide, the editor tall.
 * - `look`  -- designing: the render dominates, the editor stays usable.
 * - `show`  -- running: the render takes the screen, editing shrinks to a strip.
 *
 * @constant {Object}
 */
export const WORKSPACE_PRESETS = {
  build: { body: [62, 38], stage: [14, 28, 58] },
  look: { body: [74, 26], stage: [10, 22, 68] },
  show: { body: [82, 18], stage: [8, 18, 74] },
};

/**
 * The preset a first run -- and every unrecognised showfile -- opens on.
 *
 * @constant {String}
 */
export const DEFAULT_PRESET = 'build';

/**
 * Rounds to four decimal places, which is finer than any splitter drag can
 * resolve and coarse enough to keep serialised layouts readable.
 *
 * @param {Number} value any number
 * @return {Number} the rounded value
 * @private
 */
function round4(value) {
  return Math.round(value * 1e4) / 1e4;
}

/**
 * True for a non-null, non-array object.
 *
 * @param {*} value candidate
 * @return {Boolean} whether it is a plain object
 * @private
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Coerces any size array into a valid one: every entry at or above its
 * minimum, and the whole thing summing to exactly 100.
 *
 * Total by design. Negative, NaN, all-zero and wrongly-scaled inputs all
 * produce a usable layout, because they arrive from showfiles and from
 * `splitpanes` drag callbacks, neither of which this module controls. It
 * throws only on structural errors, which are programming mistakes.
 *
 * @param {Array<Number>} sizes candidate sizes, in pane order
 * @param {Array<Number>} mins minimum size per pane, in the same order
 * @return {Array<Number>} normalised sizes summing to 100
 * @throws {TypeError} when either argument is not an array
 * @throws {RangeError} on a length mismatch, or minimums that cannot fit
 * @public
 */
export function normalizeSizes(sizes, mins) {
  if (!Array.isArray(sizes) || !Array.isArray(mins)) {
    throw new TypeError('normalizeSizes expects two arrays');
  }
  if (sizes.length !== mins.length) {
    throw new RangeError(`Expected ${mins.length} sizes, received ${sizes.length}`);
  }
  const count = mins.length;
  if (count === 0) {
    return [];
  }
  const minTotal = mins.reduce((sum, value) => sum + value, 0);
  if (minTotal > 100) {
    throw new RangeError(`Minimum sizes total ${minTotal}%, which cannot fit in 100%`);
  }

  const raw = sizes.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const rawTotal = raw.reduce((sum, value) => sum + value, 0);
  const out = rawTotal > 0
    ? raw.map((value) => (value * 100) / rawTotal)
    : raw.map(() => 100 / count);

  const locked = new Array(count).fill(false);
  for (let pass = 0; pass < count; pass += 1) {
    let deficit = 0;
    for (let i = 0; i < count; i += 1) {
      if (out[i] < mins[i]) {
        deficit += mins[i] - out[i];
        out[i] = mins[i];
        locked[i] = true;
      }
    }
    if (deficit <= SIZE_EPSILON) {
      break;
    }
    let slack = 0;
    for (let i = 0; i < count; i += 1) {
      if (!locked[i]) {
        slack += out[i] - mins[i];
      }
    }
    if (slack <= 0) {
      break;
    }
    for (let i = 0; i < count; i += 1) {
      if (!locked[i]) {
        out[i] -= deficit * ((out[i] - mins[i]) / slack);
      }
    }
  }

  const rounded = out.map(round4);
  const roundedTotal = rounded.reduce((sum, value) => sum + value, 0);
  let largest = 0;
  for (let i = 1; i < count; i += 1) {
    if (rounded[i] > rounded[largest]) {
      largest = i;
    }
  }
  rounded[largest] = round4(rounded[largest] + (100 - roundedTotal));
  return rounded;
}

/**
 * True when two size arrays agree within SIZE_EPSILON.
 *
 * @param {Array<Number>} a first array
 * @param {Array<Number>} b second array
 * @return {Boolean} whether they match
 * @private
 */
function sameSizes(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length
    && a.every((value, index) => Math.abs(value - b[index]) <= SIZE_EPSILON);
}

/**
 * Builds a layout store over a set of group descriptors and presets.
 *
 * @param {Object} options store options
 * @param {Array<Object>} options.groups group descriptors, outermost first
 * @param {Object} options.presets preset name to per-group size arrays
 * @param {String} options.defaultPreset the preset a fresh store opens on
 * @return {Object} the store
 * @throws {RangeError} when the descriptors or presets are inconsistent
 * @public
 */
export function createWorkspaceLayoutStore({ groups, presets, defaultPreset }) {
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new RangeError('A workspace needs at least one pane group');
  }
  if (!isPlainObject(presets) || !presets[defaultPreset]) {
    throw new RangeError(`Unknown default preset "${defaultPreset}"`);
  }
  groups.forEach((group) => {
    if (!Array.isArray(group.panes) || group.panes.length < 2) {
      throw new RangeError(`Group "${group.id}" needs at least two panes`);
    }
  });

  const frozenGroups = Object.freeze(groups.map((group) => Object.freeze({
    id: group.id,
    horizontal: Boolean(group.horizontal),
    panes: Object.freeze(group.panes.map((pane) => Object.freeze({ ...pane }))),
  })));

  const listeners = new Set();

  const state = {
    version: LAYOUT_VERSION,
    preset: defaultPreset,
    sizes: {},
  };

  /**
   * @param {String} groupId a group id
   * @return {Object} the frozen group descriptor
   * @throws {RangeError} when the id is unknown
   */
  function getGroup(groupId) {
    const group = frozenGroups.find((candidate) => candidate.id === groupId);
    if (!group) {
      const known = frozenGroups.map((candidate) => candidate.id).join(', ');
      throw new RangeError(`Unknown workspace group "${groupId}". Known groups: ${known}`);
    }
    return group;
  }

  /**
   * @param {Object} group a group descriptor
   * @return {Array<Number>} its minimums, in pane order
   */
  function minsOf(group) {
    return group.panes.map((pane) => pane.min);
  }

  /**
   * Seeds every group from a preset without notifying.
   *
   * @param {String} name preset name
   */
  function seedFromPreset(name) {
    frozenGroups.forEach((group) => {
      const preset = presets[name][group.id];
      const candidate = Array.isArray(preset) && preset.length === group.panes.length
        ? preset
        : minsOf(group);
      state.sizes[group.id] = normalizeSizes(candidate, minsOf(group));
    });
    state.preset = name;
  }

  /**
   * Calls every subscriber. Subscribers must not mutate the store.
   */
  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  seedFromPreset(defaultPreset);

  /**
   * @param {String} groupId a group id
   * @return {Array<Number>} a copy of that group's sizes
   */
  function getSizes(groupId) {
    getGroup(groupId);
    return state.sizes[groupId].slice();
  }

  /**
   * @param {String} groupId a group id
   * @param {String} paneId a pane id inside that group
   * @return {Number} the pane's index
   * @throws {RangeError} when the pane is unknown
   */
  function paneIndex(groupId, paneId) {
    const group = getGroup(groupId);
    const index = group.panes.findIndex((pane) => pane.id === paneId);
    if (index < 0) {
      throw new RangeError(`Unknown pane "${paneId}" in group "${groupId}"`);
    }
    return index;
  }

  const store = {
    state,
    groups: frozenGroups,
    defaultPreset,
    getGroup,
    getSizes,

    /**
     * @param {String} groupId a group id
     * @param {String} paneId a pane id
     * @return {Number} the pane's current size, in percent
     */
    getPaneSize(groupId, paneId) {
      return state.sizes[groupId][paneIndex(groupId, paneId)];
    },

    /**
     * @param {String} groupId a group id
     * @param {String} paneId a pane id
     * @return {Number} the pane's minimum size, in percent
     */
    getPaneMin(groupId, paneId) {
      return getGroup(groupId).panes[paneIndex(groupId, paneId)].min;
    },

    /**
     * Stores a group's sizes, normalising first. Collapses the active preset to
     * `custom` when the result stops matching it. A no-op resize does not
     * notify, which is what stops the shell's own change handler looping.
     *
     * @param {String} groupId a group id
     * @param {Array<Number>} sizes candidate sizes, in pane order
     * @return {Array<Number>} the normalised sizes actually stored
     */
    setSizes(groupId, sizes) {
      const group = getGroup(groupId);
      const next = normalizeSizes(sizes, minsOf(group));
      if (sameSizes(next, state.sizes[groupId])) {
        return next.slice();
      }
      state.sizes[groupId] = next;
      const active = presets[state.preset];
      if (active && !sameSizes(next, normalizeSizes(active[groupId], minsOf(group)))) {
        state.preset = CUSTOM_PRESET;
      }
      notify();
      return next.slice();
    },

    /**
     * @param {String} name preset name
     * @return {Object} the serialised layout after the switch
     * @throws {RangeError} when the preset is unknown
     */
    applyPreset(name) {
      if (!presets[name]) {
        throw new RangeError(`Unknown workspace preset "${name}". Known: ${Object.keys(presets).join(', ')}`);
      }
      seedFromPreset(name);
      notify();
      return store.serialize();
    },

    /**
     * Restores one group to the sizes of the preset the layout is based on --
     * the active preset, or the default when the layout has gone custom. This
     * is what a splitter double-click does.
     *
     * @param {String} groupId a group id
     * @return {Array<Number>} the restored sizes
     */
    resetGroup(groupId) {
      const group = getGroup(groupId);
      const base = presets[state.preset] ? state.preset : defaultPreset;
      state.sizes[groupId] = normalizeSizes(presets[base][groupId], minsOf(group));
      notify();
      return state.sizes[groupId].slice();
    },

    /**
     * @return {Object} the serialised layout after resetting to the default
     */
    reset() {
      return store.applyPreset(defaultPreset);
    },

    /**
     * @return {Array<String>} preset names in declaration order
     */
    listPresets() {
      return Object.keys(presets);
    },

    /**
     * @return {Object} a detached, JSON-safe snapshot for the showfile
     */
    serialize() {
      const sizes = {};
      frozenGroups.forEach((group) => {
        sizes[group.id] = state.sizes[group.id].slice();
      });
      return { version: state.version, preset: state.preset, sizes };
    },

    /**
     * Applies a showfile's `workspace` block, falling back to the defaults for
     * anything absent or malformed. Never throws: a corrupt layout must not
     * stop a show from loading.
     *
     * @param {Object} [data] the showfile's `workspace` value
     * @return {Boolean} whether anything from `data` was applied
     */
    restore(data) {
      seedFromPreset(defaultPreset);
      if (!isPlainObject(data) || data.version !== LAYOUT_VERSION) {
        notify();
        return false;
      }
      const named = Boolean(presets[data.preset]);
      const presetName = named || data.preset === CUSTOM_PRESET ? data.preset : defaultPreset;
      if (named) {
        seedFromPreset(data.preset);
      }
      let applied = named;
      if (isPlainObject(data.sizes)) {
        frozenGroups.forEach((group) => {
          const incoming = data.sizes[group.id];
          const usable = Array.isArray(incoming)
            && incoming.length === group.panes.length
            && incoming.every((value) => Number.isFinite(value));
          if (usable) {
            state.sizes[group.id] = normalizeSizes(incoming, minsOf(group));
            applied = true;
          }
        });
      }
      state.preset = presetName;
      notify();
      return applied;
    },

    /**
     * The read model behind the `get_workspace` MCP command.
     *
     * @return {Array<Object>} groups with per-pane id, label, size and minimum
     */
    toTree() {
      return frozenGroups.map((group) => ({
        id: group.id,
        horizontal: group.horizontal,
        panes: group.panes.map((pane, index) => ({
          id: pane.id,
          label: pane.label,
          size: state.sizes[group.id][index],
          min: pane.min,
        })),
      }));
    },

    /**
     * @param {Function} listener called after every mutation
     * @return {Function} unsubscribe
     */
    onChange(listener) {
      listeners.add(listener);
      return function unsubscribe() {
        listeners.delete(listener);
      };
    },
  };

  return store;
}

/**
 * The app-wide layout store. Every consumer binds to this instance so a
 * splitter drag, an MCP `set_workspace` call and a showfile load all move the
 * same object.
 *
 * @constant {Object}
 */
const workspaceLayoutStore = createWorkspaceLayoutStore({
  groups: WORKSPACE_GROUPS,
  presets: WORKSPACE_PRESETS,
  defaultPreset: DEFAULT_PRESET,
});

export default workspaceLayoutStore;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /c/dev/swietlik && npx vitest run test/workspace/layout.store.spec.js
```

Expected: PASS, ~24 tests.

If `normalizeSizes([1, 28, 71], [6, 12, 20])` does not produce exactly `[6, 26.806, 67.194]`, the redistribution loop has drifted from the plan — do **not** relax the assertion; fix the loop. (Hand-check: deficit `5`, slack `(28−12) + (71−20) = 67`, so pane 1 loses `5·16/67 = 1.19402985…` and pane 2 loses `5·51/67 = 3.80597015…`.)

- [ ] **Step 5: Lint and commit**

```bash
npm run lint:ci
```

Expected: 0 errors, 13 warnings.

```bash
git add src/views/components/workspace/workspace.layout.store.js test/workspace/layout.store.spec.js
git commit -m "feat(workspace): headless layout store with Build/Look/Show presets

Percentage-based pane geometry, minimum clamping, preset table and
showfile-safe (de)serialisation. Imports nothing, so it carries the real
unit coverage for a shell whose SFCs cannot be unit-tested (CLAUDE.md 5).
Covers scope-draft AC-15, AC-16, AC-20, AC-21.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hisrh377ZdkTp4Kupbhhpf"
```

---

## Task 3: `useShowBootstrap` composable

**Files:**
- Create: `src/views/composables/useShowBootstrap.js` (the `composables/` directory is new)
- Test: `test/views/show-bootstrap.spec.js`
- Read first, and port faithfully: `src/views/activities/app/app.activity.vue:54-124`

**Interfaces:**
- Consumes: `EventBus` from `@/plugins/eventbus` (a `mitt()` instance — `.on`, `.off`, `.emit`).
- Produces (default export of `src/views/composables/useShowBootstrap.js`):
  - `useShowBootstrap(options) -> BootstrapController`
  - `options: { show: Object, router: Object, eventBus?: Object, fetchImpl?: Function, demoUrl?: String, settleMs?: Number }`
  - `BootstrapController`:
    - `state: { ready: Boolean, loading: Boolean, loader: Object, errPopup: { error: Error, state: Boolean } }`
    - `setup() -> Promise<void>`
    - `setLoader(value: Object) -> void`
    - `attach() -> void`
    - `detach() -> void`

**What is being ported, line for line** (`app.activity.vue`):

| Upstream | Ported to |
|---|---|
| `data()` `errPopup` / `ready` / `loading` / `loader: this.$show.loading` (`:54-76`) | `state` |
| `watch['$show.loading']` deep handler (`:77-84`) | `setLoader(value)`, called from the consuming SFC's watcher (a watcher is Vue-specific and stays in the SFC) |
| `mounted()` `$router._appReayState = false` (`:86`) | `attach()` |
| `mounted()` `EventBus.on('visualizer_loaded', this.setup)` (`:87`) | `attach()` |
| `mounted()` `EventBus.on('app_error', …)` (`:88-92`) | `attach()` |
| `setup()` (`:101-122`), including `EventBus.emit('app_ready')` | `setup()` |

**`app_ready` is load-bearing** — `src/mcp-bridge/index.js:99` starts the whole MCP bridge on it, and `toolbar.fragment.vue:289` reads the project name and binds its `Space` handler on it. Emitting it exactly once, at the end, is not optional.

- [ ] **Step 1: Write the failing test**

Create `test/views/show-bootstrap.spec.js`:

```js
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import mitt from 'mitt';
import useShowBootstrap from '@/views/composables/useShowBootstrap';

const DEMO_URL = 'http://example.test/demo.showfile.json';

/**
 * A show stand-in exposing only what the bootstrap touches.
 *
 * @param {Boolean} localSucceeds what loadFromLocalStorage resolves to
 * @return {Object} the fake show
 */
function fakeShow(localSucceeds) {
  return {
    loading: { state: true, message: 'Preparing Environment', percentage: 0 },
    loadFromLocalStorage: vi.fn(() => Promise.resolve(localSucceeds)),
    loadFromData: vi.fn(() => Promise.resolve()),
  };
}

/**
 * A router stand-in.
 *
 * @return {Object} the fake router
 */
function fakeRouter() {
  return { push: vi.fn(() => Promise.resolve()) };
}

/**
 * Builds a controller with every side effect injected.
 *
 * @param {Object} overrides partial options
 * @return {Object} `{ controller, show, router, eventBus, fetchImpl, demoData }`
 */
function build(overrides = {}) {
  const demoData = { name: 'demo', fixtures: [] };
  const show = overrides.show || fakeShow(true);
  const router = overrides.router || fakeRouter();
  const eventBus = overrides.eventBus || mitt();
  const fetchImpl = overrides.fetchImpl
    || vi.fn(() => Promise.resolve({ json: () => Promise.resolve(demoData) }));
  const controller = useShowBootstrap({
    show, router, eventBus, fetchImpl, demoUrl: DEMO_URL, settleMs: 0,
  });
  return {
    controller, show, router, eventBus, fetchImpl, demoData,
  };
}

describe('useShowBootstrap -- initial state', () => {
  it('mirrors the show s loading handle and starts not-ready', () => {
    const { controller, show } = build();
    expect(controller.state.ready).toBe(false);
    expect(controller.state.loading).toBe(true);
    expect(controller.state.loader).toBe(show.loading);
    expect(controller.state.errPopup.state).toBe(false);
    expect(controller.state.errPopup.error).toBeInstanceOf(Error);
  });

  it('replaces the loader handle through setLoader', () => {
    const { controller } = build();
    const next = { state: true, message: 'x', percentage: 5 };
    controller.setLoader(next);
    expect(controller.state.loader).toBe(next);
  });
});

describe('useShowBootstrap -- setup', () => {
  it('uses the autosave when local loading succeeds and never fetches the demo', async () => {
    const { controller, show, fetchImpl } = build();
    await controller.setup();
    expect(show.loadFromLocalStorage).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(show.loadFromData).not.toHaveBeenCalled();
  });

  it('falls back to the demo showfile when there is no autosave', async () => {
    const { controller, show, fetchImpl, demoData } = build({ show: fakeShow(false) });
    await controller.setup();
    expect(fetchImpl).toHaveBeenCalledWith(DEMO_URL);
    expect(show.loadFromData).toHaveBeenCalledWith(demoData);
  });

  it('routes to the default universe, settles, and finishes ready', async () => {
    const { controller, router } = build();
    await controller.setup();
    expect(router.push).toHaveBeenCalledWith('/universe/0');
    expect(router._appReayState).toBe(true);
    expect(controller.state.ready).toBe(true);
    expect(controller.state.loader.state).toBe(false);
  });

  it('shows the settle message before the splash closes', async () => {
    const { controller } = build();
    const seen = [];
    const pending = controller.setup();
    // The settle loader is installed synchronously after the awaited push resolves.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    seen.push(controller.state.loader.message);
    await pending;
    expect(seen[0]).toBe('Waiting for views to settle');
    expect(controller.state.loader.percentage).toBe(90);
  });

  it('emits app_ready exactly once, last', async () => {
    const { controller, eventBus } = build();
    const ready = vi.fn();
    eventBus.on('app_ready', ready);
    await controller.setup();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(controller.state.ready).toBe(true);
  });
});

describe('useShowBootstrap -- attach and detach', () => {
  let harness;

  beforeEach(() => {
    harness = build();
  });

  it('clears the router readiness flag on attach', () => {
    harness.controller.attach();
    expect(harness.router._appReayState).toBe(false);
  });

  it('runs setup when the visualizer reports itself loaded', async () => {
    harness.controller.attach();
    harness.eventBus.emit('visualizer_loaded', true);
    await vi.waitFor(() => expect(harness.controller.state.ready).toBe(true));
    expect(harness.show.loadFromLocalStorage).toHaveBeenCalledTimes(1);
  });

  it('surfaces an app_error into the error popup', () => {
    harness.controller.attach();
    const error = new Error('boom');
    harness.eventBus.emit('app_error', error);
    expect(harness.controller.state.errPopup.state).toBe(true);
    expect(harness.controller.state.errPopup.error).toBe(error);
    expect(harness.controller.state.loader.message)
      .toBe('An error occured while loading the app...');
  });

  it('stops listening after detach', () => {
    harness.controller.attach();
    harness.controller.detach();
    harness.eventBus.emit('app_error', new Error('ignored'));
    expect(harness.controller.state.errPopup.state).toBe(false);
  });

  it('is idempotent -- a second attach does not double-subscribe', async () => {
    harness.controller.attach();
    harness.controller.attach();
    harness.eventBus.emit('visualizer_loaded', true);
    await vi.waitFor(() => expect(harness.controller.state.ready).toBe(true));
    expect(harness.show.loadFromLocalStorage).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /c/dev/swietlik && npx vitest run test/views/show-bootstrap.spec.js
```

Expected: FAIL — `Failed to resolve import "@/views/composables/useShowBootstrap"`.

- [ ] **Step 3: Write the implementation**

Create `src/views/composables/useShowBootstrap.js`:

```js
import EventBus from '@/plugins/eventbus';

/**
 * The app's load-or-demo bootstrap, lifted out of `app.activity.vue`'s
 * `setup()` (`app.activity.vue:101-122`) so more than one root activity can
 * use it without duplicating it -- Phase 2 spec ruling 4.
 *
 * Deliberately framework-free: no `ref`, no `onMounted`, no `this`. It returns
 * a plain state object the consuming SFC drops into `data()`, which is what
 * makes it unit-testable in a repo with no Vue component harness (CLAUDE.md
 * section 5). Every side effect -- the show, the router, the event bus, fetch
 * -- is injected, so the tests need neither.
 *
 * @module views/composables/useShowBootstrap
 */

/**
 * The demo showfile the app falls back to when there is no autosave. Read from
 * the Vite env exactly as upstream does (`app.activity.vue:105`).
 *
 * @return {String} the demo showfile URL
 * @private
 */
function defaultDemoUrl() {
  return `${import.meta.env.VITE_STATIC_URL}demo/showfiles/demo.showfile.json`;
}

/**
 * Builds the bootstrap controller for a root activity.
 *
 * @param {Object} options controller options
 * @param {Object} options.show the reactive show handle (`$show`)
 * @param {Object} options.router the vue-router instance (`$router`)
 * @param {Object} [options.eventBus=EventBus] the mitt bus
 * @param {Function} [options.fetchImpl] fetch implementation, for tests
 * @param {String} [options.demoUrl] demo showfile URL, for tests
 * @param {Number} [options.settleMs=500] the view-settle delay
 * @return {Object} `{ state, setup, setLoader, attach, detach }`
 * @public
 */
export default function useShowBootstrap({
  show,
  router,
  eventBus = EventBus,
  fetchImpl = (...args) => fetch(...args),
  demoUrl = defaultDemoUrl(),
  settleMs = 500,
}) {
  const state = {
    /**
     * Error popup description object.
     */
    errPopup: {
      error: new Error(),
      state: false,
    },
    /**
     * App readiness state.
     */
    ready: false,
    /**
     * App loading state. Inert upstream too -- kept for a faithful port.
     */
    loading: true,
    /**
     * Handle to the show's loading property.
     */
    loader: show.loading,
  };

  let attachedSetup = null;

  /**
   * Replaces the loader handle. The consuming SFC calls this from its deep
   * watcher on `$show.loading` (`app.activity.vue:77-84`); a watcher is
   * Vue-specific and stays in the SFC.
   *
   * @param {Object} value the new loader handle
   * @public
   */
  function setLoader(value) {
    state.loader = value;
  }

  /**
   * Setup app. Loads the show from local storage or creates a new show project
   * if no local data is available.
   *
   * @return {Promise<void>} resolves once the app is ready
   * @public
   */
  async function setup() {
    const localLoadingSucceeded = await show.loadFromLocalStorage();

    if (!localLoadingSucceeded) {
      const res = await fetchImpl(demoUrl);
      const showData = await res.json();
      await show.loadFromData(showData);
    }

    await router.push('/universe/0');
    state.loader = {
      message: 'Waiting for views to settle',
      percentage: 90,
      state: true,
    };

    await new Promise((resolve) => { setTimeout(resolve, settleMs); });
    state.loader.state = false;
    router._appReayState = true;
    state.ready = true;
    eventBus.emit('app_ready');
  }

  /**
   * Handles an `app_error` broadcast (`app.activity.vue:88-92`).
   *
   * @param {Error} err the error
   * @private
   */
  function onAppError(err) {
    state.loader.message = 'An error occured while loading the app...';
    state.errPopup.error = err;
    state.errPopup.state = true;
  }

  /**
   * Subscribes to the bootstrap events. Idempotent.
   *
   * Call this from the activity's `created()`, not `mounted()`: child
   * components mount before their parent, and `visualizer.fragment.vue:130-136`
   * emits `visualizer_loaded` from its own `mounted()`. That emit only lands
   * after the parent's `mounted()` today because it awaits `init()` first --
   * subscribing in `created()` removes the race instead of relying on it.
   *
   * @public
   */
  function attach() {
    if (attachedSetup) {
      return;
    }
    router._appReayState = false;
    attachedSetup = () => setup();
    eventBus.on('visualizer_loaded', attachedSetup);
    eventBus.on('app_error', onAppError);
  }

  /**
   * Unsubscribes. Upstream never does this because the root activity never
   * unmounts; doing it anyway keeps hot reloads and tests honest.
   *
   * @public
   */
  function detach() {
    if (!attachedSetup) {
      return;
    }
    eventBus.off('visualizer_loaded', attachedSetup);
    eventBus.off('app_error', onAppError);
    attachedSetup = null;
  }

  return {
    state, setup, setLoader, attach, detach,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /c/dev/swietlik && npx vitest run test/views/show-bootstrap.spec.js
```

Expected: PASS, 11 tests.

Note on the "settle message" test: `setup()` awaits `loadFromLocalStorage`, then `router.push`, before installing the settle loader. The three `await Promise.resolve()` hops drain those microtasks. If the ordering in the implementation changes, that test is the one that catches it — do not delete it, adjust the hop count.

- [ ] **Step 5: Lint and commit**

```bash
npm run lint:ci
```

Expected: 0 errors.

```bash
git add src/views/composables/useShowBootstrap.js test/views/show-bootstrap.spec.js
git commit -m "feat(views): extract the app bootstrap into a testable composable

Ports app.activity.vue:101-122 -- load-or-demo, the /universe/0 push, the
settle delay and the load-bearing app_ready emission -- into an injectable
plain-JS factory, per Phase 2 spec ruling 4. No Vue APIs, so it has real
unit coverage.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hisrh377ZdkTp4Kupbhhpf"
```

---

## Task 4: Keyboard router seed and the `Ctrl+Z` reclaim

**Files:**
- Create: `src/views/keyboard/keyboard.router.js`
- Create: `src/views/keyboard/keyboard.bindings.js`
- Test: `test/keyboard/keyboard.router.spec.js`
- Test: `test/keyboard/keyboard.bindings.spec.js`
- **Do not modify:** `src/plugins/visualizer/controls.js` (the gizmo `T` / `R` / `H` / `Escape` keys keep working untouched — that is a requirement, not an omission)

**Interfaces:**
- Consumes: `Show` (default export of `@/models/DMX/show.model`) — for its **static** `undo()` / `redo()`.
- Produces (exports of `src/views/keyboard/keyboard.router.js`):
  - `GLOBAL_CONTEXT: 'global'`
  - `normalizeCombo(combo: String) -> String` — canonical `ctrl+alt+shift+meta+<key>`, lower-case
  - `comboFromEvent(event: KeyboardEvent) -> String|null` — `null` for a modifier-only press
  - `isEditableTarget(target: EventTarget) -> Boolean`
  - `createKeyboardRouter({ target?: EventTarget, isEditable?: Function }) -> Router`
  - `default` — the app-wide `Router` singleton bound to `window`
  - `Router`:
    - `register({ combo: String, context?: String, handler: Function, description?: String, preventDefault?: Boolean, allowInEditable?: Boolean }) -> Function` (the returned function unregisters)
    - `handle(event: KeyboardEvent) -> Boolean` — `true` when a binding fired
    - `attach() -> void` / `detach() -> void`
    - `setContext(name: String) -> void` / `getContext() -> String`
    - `list() -> Array<{ combo, context, description }>`
    - `clear() -> void`
- Produces (exports of `src/views/keyboard/keyboard.bindings.js`):
  - `UNDO_COMBO: 'Ctrl+Z'`
  - `REDO_COMBOS: ['Ctrl+Shift+Z', 'Ctrl+Y']`
  - `default registerCoreKeyBindings(router?: Router, { showClass?: Object }) -> Function` (the returned function unregisters all of them)

### Coexistence map — the listeners this router must not fight

Measured on 2026-09-10 with `grep -rn "addEventListener('keydown'" src/views src/plugins`. **Eight**, not the five scope §6 estimates (deviation D3). Every one of them is **bubble-phase** (no `true`/`{capture:true}` third argument), which is exactly why the router can sit in front of them.

| # | File:line | Keys it claims | Lifecycle | Notes |
|---|---|---|---|---|
| 1 | `src/views/components/uikit/menus/uikit.menu.vue:88` | `Ctrl+O`, `Ctrl+S`, `Ctrl+Shift+S`, **`Ctrl+Z`**, **`Ctrl+Y`**, `Ctrl+Shift+V`, `Ctrl+Shift+o` (from `toolbar.fragment.vue:155-214`) | added per menu item at init, **never removed** | Matches via `eval()` on a generated string (`:158-170`). Its `Ctrl+Z`/`Ctrl+Y` callbacks call `this.$show.undo()` / `.redo()` — **broken, see F1**. |
| 2 | `src/views/components/uikit/popups/uikit.popup.vue:191` | popup dismiss/confirm keys | added while displayed, removed on `update()` | |
| 3 | `src/views/components/uikit/lists/uikit.list.vue:480` | list navigation | added on `focusin`; the matching `removeEventListener` is **commented out** (`:502-503`) so these accumulate | Pre-existing leak. Not this plan's to fix. |
| 4 | `src/views/activities/app/fragments/group-pool/group-pool.fragment.vue:222` | `Backspace` / `Delete` → delete-group popup | focus-gated via `handleFocus` | |
| 5 | `src/views/activities/app/fragments/modifiers/group/_widgets/group.modifier.widget.cuepool.vue:360` | `Backspace` / `Delete` → `deleteCue()` | focus-gated | |
| 6 | `src/views/activities/app/fragments/modifiers/chase/chase.modifier.fragment.vue:109` | `Backspace` / `Delete` → delete chase | rebound on chase change | |
| 7 | `src/views/activities/app/fragments/toolbar/toolbar.fragment.vue:292` | **`Space`** → `playPauseShow()` | bound on `app_ready` | **P2-1 owns `Space`.** This plan registers nothing for it; the toolbar keeps it. |
| 8 | `src/plugins/visualizer/controls.js:195` | `Escape`, `T`, `R`, **`Ctrl+Z`** (→ `applyTransformation()`), `H` | bound once in the `Controls` constructor with `.bind(this)`, so it can **never** be removed | **T / R / H / Escape must keep working.** Only `Ctrl+Z` is taken from it, and only because the router stops the event before it arrives. |

**The three rules that make coexistence work, and that the implementation must honour exactly:**

1. **Capture phase on `window`.** `addEventListener('keydown', handle, true)` on `window` runs before the event descends to the target and long before it bubbles back to any of the eight. All eight are bubble-phase, so the router genuinely sees every key first.
2. **Only claimed combos are stopped.** When — and *only* when — a registered binding matches, the router calls `preventDefault()` and `stopImmediatePropagation()`. Everything else returns without touching the event, so `T`, `R`, `H`, `Escape`, `Delete`, `Backspace` and `Space` reach their existing owners unchanged.
3. **Editable targets short-circuit first.** If the event target is an `input`, `textarea`, `select` or contenteditable, the router returns *before* stopping anything, so text entry is never intercepted. This is scope §6 **AC-38**, and it is also why the router cannot break `uikit.input.textbox.*`'s `@keydown.stop` hygiene.

**Migrate nothing else in this phase.** No `Space`, no `Del`, no `\`, no `C`. Those arrive with P2-1 and P2-3.

- [ ] **Step 1: Write the failing router test**

Create `test/keyboard/keyboard.router.spec.js`:

```js
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {
  GLOBAL_CONTEXT,
  normalizeCombo,
  comboFromEvent,
  isEditableTarget,
  createKeyboardRouter,
} from '@/views/keyboard/keyboard.router';

/**
 * @param {Object} init KeyboardEvent init overrides
 * @return {KeyboardEvent} a bubbling, cancellable keydown
 */
function keydown(init) {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

describe('normalizeCombo', () => {
  it('lower-cases and canonically orders the modifiers', () => {
    expect(normalizeCombo('Ctrl+Shift+Z')).toBe('ctrl+shift+z');
    expect(normalizeCombo('shift+CTRL+z')).toBe('ctrl+shift+z');
    expect(normalizeCombo('Alt+Ctrl+Meta+Shift+K')).toBe('ctrl+alt+shift+meta+k');
  });

  it('accepts the usual modifier spellings', () => {
    expect(normalizeCombo('Control+z')).toBe('ctrl+z');
    expect(normalizeCombo('Cmd+z')).toBe('meta+z');
    expect(normalizeCombo('Command+z')).toBe('meta+z');
    expect(normalizeCombo('Option+z')).toBe('alt+z');
  });

  it('aliases the awkward key names', () => {
    expect(normalizeCombo(' ')).toBe('space');
    expect(normalizeCombo('Esc')).toBe('escape');
    expect(normalizeCombo('Del')).toBe('delete');
    expect(normalizeCombo('ArrowUp')).toBe('up');
  });

  it('rejects a combo with no key, or with two keys', () => {
    expect(() => normalizeCombo('Ctrl')).toThrow(RangeError);
    expect(() => normalizeCombo('a+b')).toThrow(RangeError);
    expect(() => normalizeCombo('')).toThrow(TypeError);
  });
});

describe('comboFromEvent', () => {
  it('reads the modifier flags off the event', () => {
    expect(comboFromEvent(keydown({ key: 'z', ctrlKey: true }))).toBe('ctrl+z');
    expect(comboFromEvent(keydown({ key: 'Z', ctrlKey: true, shiftKey: true })))
      .toBe('ctrl+shift+z');
    expect(comboFromEvent(keydown({ key: 't' }))).toBe('t');
  });

  it('returns null for a bare modifier press', () => {
    expect(comboFromEvent(keydown({ key: 'Control', ctrlKey: true }))).toBeNull();
    expect(comboFromEvent(keydown({ key: 'Shift', shiftKey: true }))).toBeNull();
  });

  it('aliases the space bar', () => {
    expect(comboFromEvent(keydown({ key: ' ' }))).toBe('space');
  });
});

describe('isEditableTarget', () => {
  it('recognises the text-entry elements', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const div = document.createElement('div');
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(select)).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(div)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('recognises a node inside a contenteditable region', () => {
    const region = document.createElement('div');
    region.setAttribute('contenteditable', 'true');
    const span = document.createElement('span');
    region.appendChild(span);
    document.body.appendChild(region);
    expect(isEditableTarget(span)).toBe(true);
    document.body.removeChild(region);
  });
});

describe('keyboard router -- registration', () => {
  let router;

  beforeEach(() => {
    router = createKeyboardRouter();
  });

  afterEach(() => {
    router.detach();
    router.clear();
  });

  it('fires a registered handler and reports that it handled the event', () => {
    const handler = vi.fn();
    router.register({ combo: 'Ctrl+Z', handler, description: 'Undo' });
    expect(router.handle(keydown({ key: 'z', ctrlKey: true }))).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores an unregistered combo', () => {
    router.register({ combo: 'Ctrl+Z', handler: vi.fn() });
    expect(router.handle(keydown({ key: 't' }))).toBe(false);
  });

  it('ignores auto-repeat', () => {
    const handler = vi.fn();
    router.register({ combo: 'Ctrl+Z', handler });
    expect(router.handle(keydown({ key: 'z', ctrlKey: true, repeat: true }))).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('unbinds through the function register returns', () => {
    const handler = vi.fn();
    const unregister = router.register({ combo: 'Ctrl+Z', handler });
    unregister();
    expect(router.handle(keydown({ key: 'z', ctrlKey: true }))).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(router.list()).toHaveLength(0);
  });

  it('refuses to silently double-bind a combo in one context', () => {
    router.register({ combo: 'Ctrl+Z', handler: vi.fn(), description: 'Undo' });
    expect(() => router.register({ combo: 'ctrl+z', handler: vi.fn() }))
      .toThrow(/already registered/);
  });

  it('rejects a binding with no handler', () => {
    expect(() => router.register({ combo: 'Ctrl+Z' })).toThrow(TypeError);
  });

  it('lists its bindings for a future keymap sheet', () => {
    router.register({ combo: 'Ctrl+Z', handler: vi.fn(), description: 'Undo' });
    router.register({ combo: 'Ctrl+Y', handler: vi.fn(), description: 'Redo' });
    expect(router.list()).toEqual([
      { combo: 'ctrl+y', context: GLOBAL_CONTEXT, description: 'Redo' },
      { combo: 'ctrl+z', context: GLOBAL_CONTEXT, description: 'Undo' },
    ]);
  });
});

describe('keyboard router -- contexts', () => {
  let router;

  beforeEach(() => {
    router = createKeyboardRouter();
  });

  afterEach(() => {
    router.detach();
    router.clear();
  });

  it('starts in the global context', () => {
    expect(router.getContext()).toBe(GLOBAL_CONTEXT);
  });

  it('prefers the active context over global for the same combo', () => {
    const globalHandler = vi.fn();
    const timelineHandler = vi.fn();
    router.register({ combo: 'Ctrl+Z', handler: globalHandler });
    router.register({ combo: 'Ctrl+Z', context: 'timeline', handler: timelineHandler });

    router.handle(keydown({ key: 'z', ctrlKey: true }));
    expect(globalHandler).toHaveBeenCalledTimes(1);
    expect(timelineHandler).not.toHaveBeenCalled();

    router.setContext('timeline');
    router.handle(keydown({ key: 'z', ctrlKey: true }));
    expect(timelineHandler).toHaveBeenCalledTimes(1);
    expect(globalHandler).toHaveBeenCalledTimes(1);
  });

  it('falls back to global for a combo the active context does not claim', () => {
    const handler = vi.fn();
    router.register({ combo: 'Ctrl+Z', handler });
    router.setContext('timeline');
    router.handle(keydown({ key: 'z', ctrlKey: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('keyboard router -- text entry wins over everything (AC-38)', () => {
  let router;
  let input;

  beforeEach(() => {
    router = createKeyboardRouter();
    input = document.createElement('input');
    document.body.appendChild(input);
  });

  afterEach(() => {
    router.detach();
    router.clear();
    document.body.removeChild(input);
  });

  it('does not fire a binding while focus is in a text input', () => {
    const handler = vi.fn();
    router.register({ combo: 'Ctrl+Z', handler });
    router.attach();
    input.dispatchEvent(keydown({ key: 'z', ctrlKey: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('leaves the event alone in a text input, so the field keeps its own undo', () => {
    router.register({ combo: 'Ctrl+Z', handler: vi.fn() });
    router.attach();
    const event = keydown({ key: 'z', ctrlKey: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('honours allowInEditable for a binding that opts in', () => {
    const handler = vi.fn();
    router.register({ combo: 'Escape', handler, allowInEditable: true });
    router.attach();
    input.dispatchEvent(keydown({ key: 'Escape' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('keyboard router -- reclaiming a combo from the legacy listeners', () => {
  let router;
  let legacy;

  beforeEach(() => {
    router = createKeyboardRouter();
    legacy = vi.fn();
    window.addEventListener('keydown', legacy);
  });

  afterEach(() => {
    window.removeEventListener('keydown', legacy);
    router.detach();
    router.clear();
  });

  it('stops a claimed combo before any bubble-phase window listener sees it', () => {
    // This is the whole Ctrl+Z reclaim, proven: uikit.menu.vue:88 and
    // plugins/visualizer/controls.js:195 both listen on window in the bubble
    // phase, and neither may see a key the router has claimed.
    const handler = vi.fn();
    router.register({ combo: 'Ctrl+Z', handler });
    router.attach();
    const event = keydown({ key: 'z', ctrlKey: true });
    document.body.dispatchEvent(event);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(legacy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets every unclaimed key through to the legacy listeners', () => {
    // The transform gizmo's T and R (controls.js:212-220) must keep working.
    router.register({ combo: 'Ctrl+Z', handler: vi.fn() });
    router.attach();
    document.body.dispatchEvent(keydown({ key: 't' }));
    document.body.dispatchEvent(keydown({ key: 'r' }));
    document.body.dispatchEvent(keydown({ key: ' ' }));
    document.body.dispatchEvent(keydown({ key: 'Delete' }));
    expect(legacy).toHaveBeenCalledTimes(4);
  });

  it('releases every key again after detach', () => {
    router.register({ combo: 'Ctrl+Z', handler: vi.fn() });
    router.attach();
    router.detach();
    document.body.dispatchEvent(keydown({ key: 'z', ctrlKey: true }));
    expect(legacy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /c/dev/swietlik && npx vitest run test/keyboard/keyboard.router.spec.js
```

Expected: FAIL — `Failed to resolve import "@/views/keyboard/keyboard.router"`.

- [ ] **Step 3: Write the router**

Create `src/views/keyboard/keyboard.router.js`:

```js
/**
 * The application's single keyboard router.
 *
 * Świetlik already has eight uncoordinated `window` keydown listeners (see
 * docs/superpowers/plans/2026-09-10-phase2b-workspace-shell.md, Task 4's
 * coexistence map). Phase 2 adds more shortcuts, so scope draft section 6 pays
 * the tax now: one router, registered ALONGSIDE the existing listeners, that
 * claims only what it is asked to claim.
 *
 * How it coexists, in three rules:
 *
 * 1. It listens on `window` in the CAPTURE phase. All eight existing listeners
 *    are bubble-phase, so the router sees every key first.
 * 2. It calls `preventDefault()` + `stopImmediatePropagation()` ONLY for a
 *    combo it has a binding for. Everything else is untouched, so the transform
 *    gizmo's T/R/H/Escape (`plugins/visualizer/controls.js:203-227`), the
 *    toolbar's Space and the pools' Delete keep working.
 * 3. Text entry wins over everything (scope draft AC-38): an event whose target
 *    is an input, textarea, select or contenteditable is returned untouched,
 *    before any stopping happens.
 *
 * @module views/keyboard/keyboard.router
 */

/**
 * The context every binding lives in unless it names another one.
 *
 * @constant {String}
 */
export const GLOBAL_CONTEXT = 'global';

/**
 * Modifier tokens, in the canonical order a normalised combo prints them.
 *
 * @constant {Array<String>}
 * @private
 */
const MODIFIER_ORDER = ['ctrl', 'alt', 'shift', 'meta'];

/**
 * Spellings this router accepts for a key or modifier, mapped to its canonical
 * token. `KeyboardEvent#key` values are lower-cased before the lookup.
 *
 * @constant {Object}
 * @private
 */
const KEY_ALIASES = {
  ' ': 'space',
  spacebar: 'space',
  esc: 'escape',
  del: 'delete',
  control: 'ctrl',
  command: 'meta',
  cmd: 'meta',
  option: 'alt',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
};

/**
 * Elements that own their keystrokes outright.
 *
 * @constant {Array<String>}
 * @private
 */
const EDITABLE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * Selector matching any text-entry ancestor. `isContentEditable` is not
 * implemented by jsdom, so the attribute selector carries the tests.
 *
 * @constant {String}
 * @private
 */
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/**
 * Canonicalises a combo string: lower case, modifiers in a fixed order, one
 * non-modifier key.
 *
 * @param {String} combo eg. `'Ctrl+Shift+Z'`
 * @return {String} eg. `'ctrl+shift+z'`
 * @throws {TypeError} when `combo` is not a non-empty string
 * @throws {RangeError} when it does not name exactly one non-modifier key
 * @public
 */
export function normalizeCombo(combo) {
  if (typeof combo !== 'string' || combo.trim().length === 0) {
    throw new TypeError('A key combo must be a non-empty string');
  }
  const parts = combo
    .split('+')
    .map((part) => {
      const token = part.trim().toLowerCase();
      return KEY_ALIASES[token] || token;
    })
    .filter((part) => part.length > 0);
  const modifiers = MODIFIER_ORDER.filter((modifier) => parts.includes(modifier));
  const keys = parts.filter((part) => !MODIFIER_ORDER.includes(part));
  if (keys.length !== 1) {
    throw new RangeError(`Combo "${combo}" must name exactly one non-modifier key`);
  }
  return modifiers.concat(keys[0]).join('+');
}

/**
 * Reads a canonical combo off a keyboard event.
 *
 * @param {KeyboardEvent} event a keydown event
 * @return {String|null} the combo, or null for a bare modifier press
 * @public
 */
export function comboFromEvent(event) {
  const raw = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  const key = KEY_ALIASES[raw] || raw;
  if (key.length === 0 || MODIFIER_ORDER.includes(key)) {
    return null;
  }
  const modifiers = [];
  if (event.ctrlKey) {
    modifiers.push('ctrl');
  }
  if (event.altKey) {
    modifiers.push('alt');
  }
  if (event.shiftKey) {
    modifiers.push('shift');
  }
  if (event.metaKey) {
    modifiers.push('meta');
  }
  return modifiers.concat(key).join('+');
}

/**
 * Whether a key event's target owns its own keystrokes.
 *
 * @param {EventTarget} target the event target
 * @return {Boolean} whether text entry has focus
 * @public
 */
export function isEditableTarget(target) {
  if (!target || typeof target !== 'object') {
    return false;
  }
  if (target.isContentEditable === true) {
    return true;
  }
  const tag = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
  if (EDITABLE_TAGS.includes(tag)) {
    return true;
  }
  if (typeof target.closest === 'function') {
    return Boolean(target.closest(EDITABLE_SELECTOR));
  }
  return false;
}

/**
 * Creates a keyboard router.
 *
 * @param {Object} [options] router options
 * @param {EventTarget} [options.target=window] where the capture listener goes
 * @param {Function} [options.isEditable=isEditableTarget] text-entry predicate
 * @return {Object} the router
 * @public
 */
export function createKeyboardRouter({
  target = window,
  isEditable = isEditableTarget,
} = {}) {
  const bindings = new Map();
  let activeContext = GLOBAL_CONTEXT;
  let attached = false;

  /**
   * @param {String} context a context name
   * @param {String} combo a canonical combo
   * @return {String} the map key
   * @private
   */
  function keyOf(context, combo) {
    return `${context} ${combo}`;
  }

  /**
   * @param {String} combo a canonical combo
   * @return {Object|null} the binding that should run, if any
   * @private
   */
  function resolve(combo) {
    return bindings.get(keyOf(activeContext, combo))
      || bindings.get(keyOf(GLOBAL_CONTEXT, combo))
      || null;
  }

  /**
   * Runs the matching binding, if any, and claims the event when it does.
   *
   * @param {KeyboardEvent} event a keydown event
   * @return {Boolean} whether a binding fired
   * @public
   */
  function handle(event) {
    if (!event || event.repeat) {
      return false;
    }
    const combo = comboFromEvent(event);
    if (!combo) {
      return false;
    }
    const binding = resolve(combo);
    if (!binding) {
      return false;
    }
    if (!binding.allowInEditable && isEditable(event.target)) {
      return false;
    }
    if (binding.preventDefault && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    binding.handler(event);
    return true;
  }

  return {
    handle,

    /**
     * Registers one binding.
     *
     * @param {Object} binding the binding
     * @param {String} binding.combo eg. `'Ctrl+Shift+Z'`
     * @param {String} [binding.context='global'] the context it belongs to
     * @param {Function} binding.handler called with the keyboard event
     * @param {String} [binding.description=''] shown in a future keymap sheet
     * @param {Boolean} [binding.preventDefault=true] suppress the browser default
     * @param {Boolean} [binding.allowInEditable=false] fire inside text entry
     * @return {Function} unregisters this binding
     * @throws {TypeError} when no handler is supplied
     * @throws {Error} when the combo is already bound in that context
     * @public
     */
    register({
      combo,
      context = GLOBAL_CONTEXT,
      handler,
      description = '',
      preventDefault = true,
      allowInEditable = false,
    }) {
      if (typeof handler !== 'function') {
        throw new TypeError(`Key binding "${combo}" needs a handler function`);
      }
      const normalized = normalizeCombo(combo);
      const mapKey = keyOf(context, normalized);
      if (bindings.has(mapKey)) {
        const existing = bindings.get(mapKey).description || '(no description)';
        throw new Error(
          `Key binding "${normalized}" is already registered in context "${context}": ${existing}`,
        );
      }
      bindings.set(mapKey, {
        combo: normalized, context, handler, description, preventDefault, allowInEditable,
      });
      return function unregister() {
        bindings.delete(mapKey);
      };
    },

    /**
     * Starts listening, in the capture phase so the router sees every key
     * before the app's bubble-phase listeners do.
     *
     * @public
     */
    attach() {
      if (attached) {
        return;
      }
      target.addEventListener('keydown', handle, true);
      attached = true;
    },

    /**
     * Stops listening. Bindings survive.
     *
     * @public
     */
    detach() {
      if (!attached) {
        return;
      }
      target.removeEventListener('keydown', handle, true);
      attached = false;
    },

    /**
     * @param {String} name the context to activate
     * @public
     */
    setContext(name) {
      activeContext = name || GLOBAL_CONTEXT;
    },

    /**
     * @return {String} the active context
     * @public
     */
    getContext() {
      return activeContext;
    },

    /**
     * @return {Array<Object>} `{ combo, context, description }`, sorted
     * @public
     */
    list() {
      return Array.from(bindings.values())
        .map(({ combo, context, description }) => ({ combo, context, description }))
        .sort((a, b) => (a.context === b.context
          ? a.combo.localeCompare(b.combo)
          : a.context.localeCompare(b.context)));
    },

    /**
     * Drops every binding. Test and hot-reload hygiene.
     *
     * @public
     */
    clear() {
      bindings.clear();
    },
  };
}

/**
 * The app-wide router, bound to `window`.
 *
 * @constant {Object}
 */
const keyboardRouter = createKeyboardRouter();

export default keyboardRouter;
```

- [ ] **Step 4: Run the router test to verify it passes**

```bash
cd /c/dev/swietlik && npx vitest run test/keyboard/keyboard.router.spec.js
```

Expected: PASS, ~22 tests. The load-bearing one is *"stops a claimed combo before any bubble-phase window listener sees it"* — if it fails, the capture flag is missing from `addEventListener`/`removeEventListener`, or `stopImmediatePropagation` is not being called.

- [ ] **Step 5: Write the failing bindings test**

Create `test/keyboard/keyboard.bindings.spec.js`:

```js
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { createKeyboardRouter } from '@/views/keyboard/keyboard.router';
import registerCoreKeyBindings, {
  UNDO_COMBO,
  REDO_COMBOS,
} from '@/views/keyboard/keyboard.bindings';

/**
 * @param {Object} init KeyboardEvent init overrides
 * @return {KeyboardEvent} a bubbling, cancellable keydown
 */
function keydown(init) {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

describe('core key bindings', () => {
  let router;
  let showClass;
  let unregister;

  beforeEach(() => {
    router = createKeyboardRouter();
    showClass = { undo: vi.fn(), redo: vi.fn() };
    unregister = registerCoreKeyBindings(router, { showClass });
  });

  afterEach(() => {
    unregister();
    router.detach();
    router.clear();
  });

  it('binds exactly the three Phase 2 combos, and nothing else', () => {
    expect(router.list().map((binding) => binding.combo))
      .toEqual(['ctrl+shift+z', 'ctrl+y', 'ctrl+z'].sort());
  });

  it('routes Ctrl+Z to the static Show.undo', () => {
    expect(router.handle(keydown({ key: 'z', ctrlKey: true }))).toBe(true);
    expect(showClass.undo).toHaveBeenCalledTimes(1);
    expect(showClass.redo).not.toHaveBeenCalled();
  });

  it('routes Ctrl+Shift+Z and Ctrl+Y to the static Show.redo', () => {
    router.handle(keydown({ key: 'z', ctrlKey: true, shiftKey: true }));
    router.handle(keydown({ key: 'y', ctrlKey: true }));
    expect(showClass.redo).toHaveBeenCalledTimes(2);
    expect(showClass.undo).not.toHaveBeenCalled();
  });

  it('does not claim the gizmo keys', () => {
    expect(router.handle(keydown({ key: 't' }))).toBe(false);
    expect(router.handle(keydown({ key: 'r' }))).toBe(false);
    expect(router.handle(keydown({ key: 'h' }))).toBe(false);
    expect(router.handle(keydown({ key: 'Escape' }))).toBe(false);
  });

  it('does not claim Space -- P2-1 and the toolbar own it', () => {
    expect(router.handle(keydown({ key: ' ' }))).toBe(false);
  });

  it('gives every binding a human-readable description for the keymap sheet', () => {
    router.list().forEach((binding) => {
      expect(binding.description.length).toBeGreaterThan(3);
    });
  });

  it('unbinds everything through the function it returns', () => {
    unregister();
    expect(router.list()).toHaveLength(0);
    expect(router.handle(keydown({ key: 'z', ctrlKey: true }))).toBe(false);
    unregister = () => {};
  });

  it('exports the combos it binds, so a keymap sheet can be generated', () => {
    expect(UNDO_COMBO).toBe('Ctrl+Z');
    expect(REDO_COMBOS).toEqual(['Ctrl+Shift+Z', 'Ctrl+Y']);
  });
});
```

- [ ] **Step 6: Write the bindings module**

Create `src/views/keyboard/keyboard.bindings.js`:

```js
import Show from '@/models/DMX/show.model';
import keyboardRouter from './keyboard.router';

/**
 * The Phase 2 keyboard binding table.
 *
 * Deliberately tiny. Scope draft section 6 says: introduce the router
 * ALONGSIDE the existing listeners and migrate only what Phase 2 needs, with no
 * big-bang refactor. Phase 2B needs undo and redo; `Space`, `Ctrl+Space`,
 * `Shift+Space`, `\`, `C` and `Del` arrive with P2-1 and P2-3 and must be
 * registered from those features, not smuggled in here.
 *
 * @module views/keyboard/keyboard.bindings
 */

/**
 * The most sacred shortcut in computing, reclaimed from
 * `plugins/visualizer/controls.js:221` where it currently means "apply the
 * gizmo transform". The router's capture-phase listener takes the event before
 * that bubble-phase handler can see it, so `controls.js` needs no edit.
 *
 * @constant {String}
 */
export const UNDO_COMBO = 'Ctrl+Z';

/**
 * Both redo spellings. `Ctrl+Y` is already advertised by the EDIT menu
 * (`toolbar.fragment.vue:192`) and is broken there for the same reason as undo.
 *
 * @constant {Array<String>}
 */
export const REDO_COMBOS = ['Ctrl+Shift+Z', 'Ctrl+Y'];

/**
 * Registers the Phase 2 bindings on a router.
 *
 * `undo` and `redo` are STATIC members of `Show` (`show.model.js:171` and
 * `:179`), so they must be called on the class, never on the `$show` instance.
 * `toolbar.fragment.vue:187` and `:195` get this wrong today and throw a
 * TypeError; `mcp-bridge/commands/show.commands.js:138` gets it right. This
 * module follows the bridge.
 *
 * @param {Object} [router=keyboardRouter] the router to bind on
 * @param {Object} [options] injection point for tests
 * @param {Object} [options.showClass=Show] the Show CLASS, not the singleton
 * @return {Function} unregisters every binding this call made
 * @public
 */
export default function registerCoreKeyBindings(router = keyboardRouter, { showClass = Show } = {}) {
  const unregisters = [
    router.register({
      combo: UNDO_COMBO,
      description: 'Undo the last tracked show mutation',
      handler: () => { showClass.undo(); },
    }),
  ];

  REDO_COMBOS.forEach((combo) => {
    unregisters.push(router.register({
      combo,
      description: 'Redo the last undone show mutation',
      handler: () => { showClass.redo(); },
    }));
  });

  return function unregisterCoreKeyBindings() {
    unregisters.forEach((unregister) => unregister());
    unregisters.length = 0;
  };
}
```

- [ ] **Step 7: Run both keyboard tests**

```bash
cd /c/dev/swietlik && npx vitest run test/keyboard
```

Expected: PASS, ~30 tests across two files.

Note: importing `@/models/DMX/show.model` pulls in the import-time singletons (`Live`, `ProxifySingleton`, `EntityManager`) — that is expected and already happens in `test/mcp-bridge/*.spec.js`; the worker is stubbed inert by `vitest.config.mjs`'s `swietlik:worker-stub`.

- [ ] **Step 8: Lint, full suite, commit**

```bash
npm run lint:ci
npm run test:run
```

Expected: 0 lint errors; **408 + 24 (Task 2) + 11 (Task 3) + ~30 = ~473 tests, 0 failures.**

```bash
git add src/views/keyboard test/keyboard
git commit -m "feat(keyboard): additive keyboard router and the Ctrl+Z reclaim

One window-level CAPTURE-phase keydown listener in front of the app's eight
uncoordinated bubble-phase listeners. Claims only registered combos, so the
transform gizmo's T/R/H/Escape (controls.js), the toolbar's Space and the
pools' Delete are untouched -- and controls.js needs no edit at all.

Binds Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y to the STATIC Show.undo/redo; the
EDIT menu calls them on the \$show instance today, which throws (they are
static: show.model.js:171/179).

Text entry short-circuits before anything is stopped -- scope draft AC-38.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hisrh377ZdkTp4Kupbhhpf"
```

> **CHECKPOINT REVIEW 1** — review the accumulated diff of Tasks 1–4 before starting Task 5. Check against [`review-checklist.md`](../../swietlik/review-checklist.md): additive-only, ledger current for `package.json`, 0 lint errors, all tests green, no component-test harness sneaked in.

---
