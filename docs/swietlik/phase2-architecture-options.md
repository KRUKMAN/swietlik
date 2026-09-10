# Świetlik — Phase 2 architecture options

Status: research, not a plan. Produced 2026-09-10 by reading the code, not the docs.
Inputs: `roadmap.md` §Phase 2, `product-vision.md` §3/§4.1/§5.1/§6.1/§6.11, `ux-audit.md`
§2.2/§3.7, `code-review-2026-09-09.md` §3, `contract-surfaces.md`.

Every claim below carries a `file:line`. Where a claim is a code-read that has not been
executed, it says so.

---

## 0. Cross-cutting findings that change the answers

These were discovered while researching the five areas and each one moves at least one
recommendation. They are stated up front because three of them are load-bearing.

### 0.1 The app does **not** run the Vue compat build

`@vue/compat` is a declared dependency (`package.json:36`) but **nothing aliases `vue` to it**:
`vite.config.mjs` has only `@` and `@root` aliases, `vitest.config.mjs` likewise, and a repo-wide
grep finds `@vue/compat` in `package.json` and nowhere else. The installed runtime is plain
`vue@3.5.32`. The `compatConfig: { MODE: 3 }` blocks scattered through the SFCs
(`app.activity.vue:41-44`, `uikit.container.flex.vue:20-23`, …) are inert options the
non-compat runtime ignores.

**Consequence:** "compat-mode risk" is not a real constraint on third-party Vue 3 components.
That removes the strongest argument against using a library for the layout shell (§2).
It is also worth an owner decision to drop the unused dependency.

### 0.2 There is no output-mixing stage — the channel object *is* the bus

`Fixture#setChannel` writes straight into `this.channels[id].value`
(`fixture.model.js:663`) and pushes attributes into `_3DModel`. DMX output is *pulled* from the
same place at send time: `Universe#DMX512Data` reads `fixture.channels[i].value.DMX`
(`universe.model.js:158`). There is no accumulator, no priority, no HTP/LTP resolution anywhere
in `src/models/`. Every playback writes the same field, and the winner is whichever animation
`Live.animations.forEach` (`live.model.js:228-230`) reaches last in the tick.

**Consequence:** any crossfade design must either (a) live entirely inside the last-write-wins
model, or (b) introduce a mixing stage — which is a rewrite of the write path, not a Phase 2
item. §1 chooses (a) and states exactly where it is honest and where it is approximate.

### 0.3 "Stop" freezes; it never zeroes — and that is what makes an additive release possible

`Cue#cue(false)` (`cue.model.js:222-227`) and `Chase#cue(false)` (`chase.model.js:229-239`)
only call `Live.remove(...)` and reset timing state. Nothing writes a value. The channels keep
whatever the last tick put there. The visible "cut" is the *next* writer landing on top
(`master.model.js:26` stops every chase, then `:33` starts the new one).

**Consequence — the key architectural unlock for §1:** because a stop leaves the levels
standing, a release envelope can be attached *after* the existing hard stop has already run.
The Transport does not need to prevent `cue(false)` from executing, intercept it, or modify it.
It snapshots the standing values and fades them down. **That is why §1 needs zero edits in
`src/models/`.**

### 0.4 Every transport button in the UI lives in one file

`grep` across `src/views/` for `cueRow|stopAllChases|cueChase|\.cue(`:

| Call | File:line |
|---|---|
| `this.group.cueChase(chase)` | `uikit.cue.container.vue:305` |
| `this.group.cueChase(chase, !chase.state)` | `uikit.cue.container.vue:324` |
| `this.$show.master.cueRow(rowIndex)` | `uikit.cue.container.vue:337` |
| `this.group.stopAllChases()` | `uikit.cue.container.vue:346` |
| `cue.cue(true)` | `group.modifier.widget.cuepool.vue:281` |

Five call sites, two files, one line each. Routing the whole existing UI through a new
Transport is a ~7-line upstream diff, not a refactor.

### 0.5 Fixture ids are positional and are **not** stable across save→load

`FixturePool#addRaw` constructs the fixture from data (which sets `this.id = parseInt(data.id)`,
`fixture.model.js:146`) and then **overwrites it**: `fixture.id = this.genFixtureId()`
(`fixture.pool.model.js:97`). `genFixtureId` (`:142-148`) returns *last element's id* + 1. Our
own characterization tests already pin this: `test/models/pools.spec.js:44-49` ("addRaw
overwrites whatever id the caller passed") and `:52-63` (after deleting the middle of `[0,1,2]`
the next id is `3`, leaving the pool `[0,2,3]`).

Now follow a round trip. Delete a fixture mid-show → pool ids `[0,2]` → `Show#showData`
serialises those ids (`show.model.js:99`, `universe.model.js:180`, `group.model.js:87`) →
reload → `prepareFixtures` (`show.model.js:441`) re-adds them and they become `[0,1]` →
`prepareUniverses` calls `this.fixturePool.getFromId(fixtureData.id)` with `2`
(`show.model.js:212`) → `FixturePool#getFromId` **throws** `Cannot find fixture in pool`
(`fixture.pool.model.js:58`).

**Code-read finding; a repro should be run before acting on it** (delete a fixture, reload the
page, watch the load pipeline). If it reproduces, it is a data-integrity bug that predates
Phase 2 and it is a **hard prerequisite for §3**: there is no point attaching paperwork to a
fixture whose identity does not survive a save.

### 0.6 `Show#showData` is a flat object literal with one existing plugin seam

`show.model.js:95-105` composes the showfile from six getters. Line 102 is
`visualizer: this.visualizerHandle.showData` — an *externally-attached* handle
(`visualizer.fragment.vue:131`) whose `showData`/`preferences` pair (`visualizer.js:93-100`,
`:194-202`) is already a working precedent for "a subsystem outside the model tree that
serialises itself into the showfile". §3 and §4 both reuse that shape.

### 0.7 The router renders nothing; all modifier panels are permanently mounted

There is **no `<router-view>` anywhere in `src/`** (grep: zero matches). `App.vue` renders
`<app-activity />` directly; the route components declared in `plugins/router.js:16-46` are
never instantiated by the router. `modifier.fragment.vue:3-5` mounts all three modifiers at
once and toggles them with `v-show`, keyed off `$route.name`. The router is a state machine
with a URL-shaped API.

**Consequence for §2:** a dock shell does not have to solve route-driven panel mounting. All
panels already exist in the DOM at all times; the shell only has to place them. It also
explains the ux-audit's 3318 px ribbon (`ux-audit.md:297-300`).

### 0.8 `Live` self-removal inside a tick skips one sibling

`Live.remove` splices `this.animations` (`live.model.js:280`) while `update` is mid-`forEach`
(`:228`). Upstream already does this from inside a tick (`cue.model.js:243`,
`chase.model.js:261`), so one animation is skipped for one frame on every one-shot end. New
transport code must **not** add to this: defer removals to a `setTimeout(0)` so they land after
the `forEach` completes. `Live.remove` also **throws** when the id is absent
(`live.model.js:282`) — every Transport call must be guarded.

---

## 1. Transport / live-feel playback

### 1.1 What the engine does today

| Behaviour | Evidence |
|---|---|
| Stop removes the driver, writes nothing | `cue.model.js:222-227`, `chase.model.js:229-239`, `live.model.js:277-284` |
| Stop destroys phase | `cue.model.js:226` (`deltaStart = null`), `chase.model.js:230` (`elapsed = 0`) |
| Restart always rewinds | `chase.model.js:226-227` |
| The fade-out machinery exists and is unreachable | `scene.model.js:255-259` builds `fadeOut`; `:453` selects it by `direction`; `direction` is assigned exactly once, in the constructor (`:247`) — no other assignment in `src/` |
| Master row = freeze-all-then-hard-cue | `master.model.js:24-42` |
| Group stop-others = same shape | `group.model.js:246-250`, wired as the quantize-ready callback at `:235` |
| Global pause/resume is done *correctly* | `live.model.js:119-127` (`pauseStartTime`), `:227` (`time - pauseTimeOffset`), `:233` |

**One correction to the standing analysis.** `code-review-2026-09-09.md` §3 suggests reviving
the dead `SCENE_DIRECTIONS.OUT` path. Read `scene.model.js:460-463`: with `direction === OUT`,
`finalValue` is `0`, so a **non-relative** scene computes `0 * fadeFactor` — an instant zero,
i.e. still a cut. The OUT path only fades for `relative` scenes, and only after
`prepareStartValues()` (`:420-431`) has captured live values. Reviving it therefore means
forcing relative mode and capturing start values at release time — which is the same work as a
snapshot envelope, but done *inside* upstream classes. That kills the "just wire up the
existing fade" option.

### 1.2 Options

**Option A — revive `Scene.direction = OUT` inside `Cue`/`Chase`.**
Edits `cue.model.js`, `chase.model.js`, `scene.model.js`, and `effect.model.js` (Effect has no
equivalent fade at all — `effect.model.js:828`). Four upstream files in the hottest part of the
engine, and per above it does not even work for non-relative scenes without further surgery.
**Reject.**

**Option B — a `Transport` singleton beside `Live`, owning release *envelopes* as ordinary
`Live` animations.** Zero edits to `src/models/`. Detailed below.

**Option C — a real mixing bus (per-source contribution buffers, HTP/LTP resolution at the
`Universe` boundary).** This is what a console actually does and it is the only way to get a
*true* crossfade. It requires rewriting the write path (`Fixture#setChannel` and every
`setQuickAccessor` caller) so cues write to a *source layer* rather than to the channel.
Correct destination, wrong phase — it is a Phase 3/4 item and it should be recorded as the
known end state so Option B is not mistaken for it.

### 1.3 Recommendation — Option B, with Option C written down as the successor

New module tree, all additive:

```
src/transport/
  transport.js            # the singleton; owns state per playback handle
  release.envelope.js     # a Live animation that fades a snapshot to a target
  release.mask.js         # which quick-accessor types release vs hold
  snapshot.js             # read current values off a fixture set
  transport.constants.js  # DEFAULT_RELEASE_MS = 2000, STOP_ALL_MS = 3000, modes
```

**How each verb is built (all on `Live.add`/`Live.remove` + `Fixture` accessors only):**

- **GO** — `cue.cue(true)` / `chase.cue(true)` unchanged; Transport records `{ status:
  'running' }` and, when `chase.quantize` is set, an `armed` status that the UI can pulse
  (`Live.add`'s 4th argument `quantizeReadyCallback`, `live.model.js:249/258`, is exactly the
  "it fired" signal §3.4 of the vision asks for and is currently thrown away by
  `group.cueChase`, `group.model.js:235`).
- **Pause (holds)** — do **not** call `cue(false)`. Call `Live.remove(handle.animationId)`,
  null `animationId`, and stash `held = { time: cue.time }` / `{ elapsed: chase.elapsed }`.
  `deltaStart` is left alone. Nothing writes afterwards, so levels stand — pause-in-place comes
  out for free from §0.3.
- **Resume (phase-preserving)** — re-register with a wrapper that applies the `Live`
  `pauseTimeOffset` trick per playback:
  ```js
  let rebase = true;
  handle.animationId = Live.add((t) => {
    if (rebase) { handle.deltaStart = t - held; rebase = false; }
    handle.update(t);           // Chase#update, public
  }, handle.quantize, 60, onReady);
  ```
  For a `Cue` the delegate is `cue._update(t)` (`cue.model.js:236`) — underscore-private by
  JSDoc only, a normal method. **Flag this as the single riskiest coupling in the design** and
  pin it with a test. Rebasing on the *first real tick* (not at `add` time) is required because
  the quantize wrapper swaps the update function in only at the boundary
  (`live.model.js:252-260`).
  Three modes per the vision §3.3: `continue` (rebase to held), `next_boundary` (rebase, but
  add via the quantize path), `from_top` (delegate to the existing `cue(true)`).
- **Release (fades, never cuts)** — three steps:
  1. `snapshot(fixtures)` — for each fixture, read `getQuickAccessor({type}).value.DMX`
     (`fixture.model.js:629-634`) for every type in the release mask.
  2. Hard-stop the playback the existing way (`cue.cue(false)` / `chase.cue(false)`), which is
     safe because it freezes rather than zeroes (§0.3).
  3. `Live.add` a **release envelope**: for `t` in `[0, releaseMs]`, write
     `max(currentValue, snapshot * (1 - ease(t/releaseMs)))` via `setQuickAccessor`. The
     `max()` is the "HTP-ish" part and it is what lets an incoming cue's fade-in coexist with
     an outgoing release. Self-remove via `setTimeout(0)` (§0.8).
- **Release mask (v1)** — release `Dimmer`; if the fixture has no `Dimmer`, release its
  `Color`-family intensity channels; **hold** `Pan`/`Tilt`/`Gobo`/`Zoom`/`Prism`. This is what
  a console's default release mask does, and it is the honest answer to "HTP on a
  last-write-wins bus": HTP is only ever applied to attributes for which HTP is meaningful.
  `quickChannelsAccessors` (`fixture.model.js:624-634`) makes the mask a one-line lookup.
- **Blackout (cuts, latched)** — a latched envelope registered last in `Live.animations` that
  writes `0` to every `Dimmer` every tick, so a running cue cannot punch through. Unlatch =
  remove it; the next cue tick restores levels. Vision §3.6 explicitly forbids fading it.
- **Stop all / master row** — `Transport.cueRow(row)` = snapshot the outgoing groups → call
  `show.master.cueRow(row)` unchanged → start release envelopes on the outgoing fixtures. The
  incoming chase fades in over its own `Fade` while the outgoing envelope fades out, `max()`
  resolves the overlap on intensity, and the freeze-then-cut of `master.model.js:26-33`
  becomes a crossfade **without touching `master.model.js`**.

**Where this is approximate, stated plainly.** A playback started *after* a release envelope
begins is appended after it in `Live.animations` and therefore wins the tick, so its raw write
overrides the `max()` on shared channels. Two mitigations, in order of preference:
(a) route every start through Transport, so Transport can re-register its envelopes last
(remove + re-add, deferred by `setTimeout(0)`); (b) accept it and document it. Either way this
is the seam that Option C eventually removes.

### 1.4 Unavoidable upstream edits

| File | Lines | Why unavoidable |
|---|---|---|
| `src/views/components/uikit/cues/uikit.cue.container.vue` | 4 (`:305`, `:324`, `:337`, `:346`) + 1 import | The existing chase/master buttons must call Transport or the feature is invisible in the UI. No wrapper can intercept a method call a component makes on a prop. |
| `src/views/activities/app/fragments/modifiers/group/_widgets/group.modifier.widget.cuepool.vue` | 1 (`:281`) + 1 import | Same, for cue triggering. |

**That is the whole list. Zero edits in `src/models/`, zero in `src/plugins/`.**

Rejected zero-edit alternative: monkey-patching `Group.prototype.cueChase` and
`Master.prototype.cueRow` from the Transport module. It works and costs no ledger entries, but
it makes two upstream methods lie about what they do, it is invisible to anyone reading
`group.model.js`, and — decisively — `.claude/hooks/upstream-diff-check.mjs` cannot see it, so
the merge debt exists without being recorded. Seven logged lines beat an unlogged patch.

Additive-but-ours (no merge debt): a new `mcp/tools.js` block and a new
`src/mcp-bridge/commands/transport.commands.js`. `commands/index.js` picks the latter up via
`import.meta.glob` and must not be edited (`commands/index.js:8-14`).

### 1.5 MCP-ready API sketch

House style is flat snake_case args with in-handler assertions for anything the generic
validator cannot express (`control.commands.js:60-127`). `mcp/tools.js` must mirror names,
argument names and required-ness or `test/mcp/tool-parity.spec.js` fails the build.

```
transport_go        { target: 'cue'|'chase'|'master_row', group_id?, cue_id?, chase_id?,
                      row?, quantize?: 0|1|2|4 }
transport_pause     { target, group_id?, cue_id?, chase_id? }
transport_resume    { target, group_id?, cue_id?, chase_id?,
                      mode: 'continue'|'next_boundary'|'from_top' = 'continue' }
transport_release   { target, group_id?, cue_id?, chase_id?, release_ms = 2000 }
transport_release_all { release_ms = 3000 }
transport_blackout  { state: boolean = true }
set_release_time    { scope: 'global'|'group'|'chase'|'cue', ms, group_id?, ... }
get_transport_state { }  ->  { blackout, playbacks: [{ kind, groupId, id, status,
                              phaseMs, durationMs, quantizePending, releaseMs }] }
```

`get_transport_state` is the one that makes the rest testable from an agent: it is the only way
to assert "resume preserved phase" without a screenshot.

**Model-layer tests with fake timers.** `Live` drives off `performance.now()`
(`live.model.js:224`) and a Web Worker message (`:151`), and the worker is already stubbed inert
by `vitest.config.mjs`'s `swietlik:worker-stub`. So a test can call `Live.update()` by hand
under `vi.useFakeTimers()` + a `performance.now` spy and step the envelope deterministically.
This is the vision's §3.2 "write those tests, because playback feel regresses silently".

### 1.6 Rough task count

**14–18 tasks.** Envelope + snapshot + mask modules (3, `standard`); Transport state machine and
the six verbs (4, `capable` — this is where the phase/quantize judgement lives); model-layer
tests with fake timers (3, `standard`); MCP command group + `mcp/tools.js` entries + parity
(2, `cheap` once the registry shape is fixed); the 7-line UI routing + ledger entries (1,
`standard`); a transport bar in the uikit (2, `standard`); verification pass per
`verification.md` (1, `inline`).

---

## 2. Resizable / dockable workspace shell

### 2.1 Starting position

Confirmed absent, not hidden: `ux-audit.md:66-76` measured **0** splitter/gutter elements and
**0** resize cursors outside one timeline clip handle. The geometry is hard-coded:
`app.activity.vue:144-157` fixes the top row at `calc(100% - 280px)`; `patch-bay.fragment.vue:87`
is `width: 200px`; `group-pool.fragment.vue:271-273` is `width: 480px; max-width: calc(100vw -
920px)`. One partial exception: `app.activity.vue:146` already sets `resize: vertical` on
`.top_fragments`, clamped between `calc(100% - 500px)` and `calc(100% - 280px)` — a native
browser handle nobody finds.

Two facts from §0 change the shape of this problem: the compat build is not in play (§0.1), and
every panel is permanently mounted with no `<router-view>` to fight (§0.7).

### 2.2 Options

| Option | Bundle | Vue 3 | Licence | Maintained | Verdict |
|---|---|---|---|---|---|
| **`splitpanes@4.1.2`** | 82.7 KB unpacked, **zero runtime deps** | peer `^3.2.0` (we run 3.5.32) | MIT (GPL-compatible) | published 2026-05-26 | **Recommended for v1** |
| Hand-rolled `uk-splitter` in the uikit | ~150–250 lines | native | ours | ours | Viable; see below |
| `dockview-vue@8.3.0` | 235 KB + `dockview` 1.62 MB | peer `^3.4.0` (ok) | MIT | published 2026-09-09 | Right shape for the *pro* mode, wrong size for v1 |
| `grid-layout-plus@1.1.1` | 2.17 MB, pulls `interactjs` + 2 `@vexip-ui` packages | peer `^3.0.0` | MIT | 2026-08-04 | Reject — dashboard-grid metaphor, not a dock; heaviest option |
| `vue-grid-layout@2.4.0` | — | Vue **2** | MIT | last publish 2022 | Reject — dead, wrong major |
| CSS Grid + bare drag handles | ~80 lines | native | ours | ours | This *is* the hand-rolled option, minus reusability |

(Versions/licences/sizes read from the npm registry on 2026-09-10.)

Two things worth noting about the hand-rolled option: the repo already ships
`src/views/utils/setcapture.utils.js`, a transparent full-viewport overlay with a settable
cursor — precisely the pointer-capture primitive a splitter drag needs, already used by
`chase.modifier.widget.timeline.vue:437` — and the uikit has a `containers/` family
(`containers/index.js`) that a `uikit.splitter.vue` slots into naturally. A minimum splitter is
genuinely ~150 lines. What `splitpanes` buys over that is keyboard resize, min/max clamping,
double-click-to-reset, RTL, touch, and the ~30 edge cases nobody writes tests for.

### 2.3 Recommendation

**Two-layer answer.**

1. **v1 (Phase 2): `splitpanes` behind our own `uk-workspace` wrapper.** New additive tree:
   ```
   src/views/components/workspace/
     workspace.shell.vue        # panes + persisted sizes; wraps splitpanes
     workspace.pane.vue         # one slot + a header/collapse affordance
     workspace.layout.store.js  # the layout tree; serialises via the §3 seam
   ```
   The wrapper matters more than the library choice: every consumer imports `uk-workspace`, so
   swapping `splitpanes` for `dockview` (or for our own) in Phase 4 is one file. `splitpanes`
   at 82 KB with zero dependencies and no build-step requirements is a cheap bet to make and a
   cheap bet to lose.
   **`Ask First` applies** — this is a new production dependency (`CLAUDE.md` §2).
2. **Deferred: real docking.** `dockview` is the right library for tab-together/tear-off, and
   the vision KILLs free-floating MDI (`product-vision.md:398`) which is exactly dockview's
   constrained model. Revisit in Phase 4 behind the same wrapper.

### 2.4 Unavoidable upstream edits — smaller than expected

The obvious move is to rewrite `app.activity.vue`'s template (`:2-24`) and scoped styles
(`:144-157`) — ~35 lines in an upstream file that currently has **zero** fork divergence.

The cheaper move, available only because of §0.7: build an additive
`src/views/activities/workspace/workspace.activity.vue` that owns the same `setup()` logic and
arranges the same five fragments inside the shell, then change **one line in `App.vue`**
(`App.vue:3`, `<app-activity />` → `<workspace-activity />`). `App.vue` is *already* an edited
upstream file (ledger: the `@/mcp-bridge` side-effect import), so this adds one line to an
existing ledger entry instead of opening a new one. No router change is needed because the
router renders nothing (§0.7); `modifier.fragment.vue`'s `$route.name` watcher keeps working
untouched.

The fragments' hard-coded widths (`patch-bay.fragment.vue:87`,
`group-pool.fragment.vue:271-273`) are neutralised from the shell with
`:deep(.patch_bay) { width: 100% !important; }` — no edits to the fragment files.

| File | Lines | Why |
|---|---|---|
| `src/App.vue` | 2 (import + tag) | The only place the root activity is chosen. Already a ledger entry. |

Cost of the alternative, recorded so the trade is explicit: keeping `app.activity.vue` as the
root and editing it in place is ~35 lines and a new ledger entry, but it avoids duplicating
`setup()` (`app.activity.vue:101-122`) into a second file — real duplication, since that method
owns the load-or-demo bootstrap. **If the owner prefers one root activity over zero duplicated
bootstrap, edit `app.activity.vue` instead; both are defensible and the ledger cost differs by
one entry.**

### 2.5 Rough task count

**10–12 tasks.** Dependency decision + install (1, `inline`, `Ask First`);
`uk-workspace` wrapper + pane component (2, `standard`); workspace activity assembling the five
fragments (2, `capable` — the `setup()` duplication decision lives here); width-override CSS
(1, `cheap`); layout persistence through the §3 seam (2, `standard`); named-mode presets
(`Build · Look · Show`, `product-vision.md:383`) (1–2, `standard`); MCP `set_workspace` /
`get_workspace` (1, `cheap`); render verification (1, `inline`).

---

## 3. Data-rich fixture records

### 3.1 The prerequisite nobody has costed

See §0.5. A parallel store keyed by fixture id is keyed on a value that
`FixturePool#addRaw` reassigns on every load (`fixture.pool.model.js:97`), and that the existing
tests already document as unstable after a delete (`test/models/pools.spec.js:52-63`). Attaching
`purpose`, `circuit` and `weight` to a key like that produces paperwork that silently attributes
"key light on the lectern" to the wrong lamp after one delete-and-reload.

**Either option below therefore depends on a 1-line fix to `fixture.pool.model.js:97`:**

```js
fixture.id = Number.isInteger(fixtureData?.id) ? fixtureData.id : this.genFixtureId();
```

with `genFixtureId` left alone. This is an upstream edit, it is unavoidable for §3, and it also
fixes the load-time throw in §0.5. Run the repro first; if it reproduces, this is arguably a
bug fix that should land before Phase 2 rather than inside it.

### 3.2 Options

**Option A — parallel additive store keyed by fixture id** (`src/models/stage/fixture.meta.pool.js`),
serialised through a new top-level showfile key. Zero edits to `fixture.model.js`. Costs: the
identity problem above; orphan pruning on delete (`FixturePool#delete`,
`fixture.pool.model.js:112-123`, emits nothing, so orphans can only be reaped at serialise
time); and every consumer needs two lookups instead of one.

**Option B — extend `Fixture` with a `meta` sub-object.** Three lines in `fixture.model.js`:
one field in the constructor (`this.meta = new FixtureMeta(data.meta)` beside `:153`) and one
key in `showData` (`:216-227`). `FixtureMeta` itself is a new additive class with all the
validation, defaults and derived fields. Metadata then travels with the object through
`addExisting`, group membership, delete, and undo, for free.

**Option C — Option B, but store the record on the Show keyed by a *new, stable* `uid`** the
fixture generates once. Best long-term identity story; also the largest change (a new field
that every existing showfile lacks, so a migration path is needed).

### 3.3 Recommendation — **Option B**

Reasons, in order:

1. Identity. §0.5 makes the "keyed by id" premise unsafe, and Option B does not need the key at
   all — the metadata is a property of the object it describes.
2. Lifecycle. Delete, copy, group-add and the `Proxify` undo stack all already move `Fixture`
   objects around. Option A has to shadow all of it; Option B gets it by construction.
3. The showfile contract permits it: adding an **optional** field with a safe default when
   absent is explicitly ADDITIVE-ONLY (`contract-surfaces.md:35`). Old showfiles load with an
   empty `meta`; new showfiles opened by upstream ASLS Studio ignore the unknown key.
4. Cost. Three upstream lines versus a permanent second index.

Note a wart to design around, not fix blindly: fixture chunks are serialised **twice** — once at
`show.model.js:99` and again nested per-universe via `universe.model.js:180` →
`fixture.pool.model.js:43`. Metadata will appear in both. That is pre-existing duplication
(`pools.spec.js:323-345` documents the shape); leave it, and let `prepareUniverses` keep
resolving by id.

Also found in passing: `Fixture#showData` line 224 reads `mode: this.modeNam` — a typo for
`modeName` (assigned at `:151`, used at `:416/:424`). **Every showfile written today records
`mode: undefined`, so a fixture saved in a non-default mode reloads in the default one.** Code-read
finding; worth a repro. If it holds, fix it in the same edit that adds `meta` — same getter,
same ledger entry.

### 3.4 Unavoidable upstream edits

| File | Lines | Why |
|---|---|---|
| `src/models/DMX/fixture.model.js` | 2 (constructor field + `showData` key), +1 if the `modeNam` typo is fixed alongside | The record must live on the object and round-trip with it. No wrapper can add a key to a getter that returns an object literal. |
| `src/models/DMX/fixture.pool.model.js` | 1 (`:97`) | Fixture identity must survive a save. Prerequisite, not a nicety. |

### 3.5 Rough task count

**8–10 tasks.** Repro + fix for the id instability, with a regression test (2, `capable` —
touches a contract surface); `FixtureMeta` class + defaults + unit tests (2, `standard`); the
`fixture.model.js` edit + round-trip test + ledger (1, `standard`); `mode` typo repro/fix (1,
`standard`); MCP `set_fixture_meta` / `get_fixture_meta` / extend `list_fixtures` (2, `cheap`);
an inspector panel binding (1–2, `standard`).

---

## 4. Venue geometry

### 4.1 The boundary question, answered

`contract-surfaces.md:54-71` freezes **two** imports from `src/models/` into
`src/plugins/visualizer/` and both are in `fixture.model.js:5-6` (verified: a grep over
`src/models` returns exactly those two lines). The same surface states the inverse direction is
**unconstrained** (`:69`).

So the shape is forced and it is a good shape:

```
src/models/stage/venue.model.js       # pure data: params, derived dimensions, anchors.
src/models/stage/venue.pool.model.js  # follows the *.pool.model.js convention (CLAUDE.md §6)
src/plugins/visualizer/venue/         # imports the model, builds THREE geometry
  venue.renderer.js
  templates/{club,ballroom,theatre,festival,outdoor,whitebox}.js
```

The renderer attaches with **zero upstream edits** by subscribing to the event the visualizer
already emits: `EventBus.emit('visualizer_loaded', true)` (`visualizer.fragment.vue:136`), then
calling `SceneManager.add(...)`. `SceneManager` is a `THREE.Scene` singleton exported from
`scene_manager.js:24-25` and `visualizer.js:266/300` already uses exactly that call to add the
grid, floor and light. Z-up is inherited (`visualizer.js:332`), so trim heights are `+z` — the
model can express them in metres with no axis conversion.

### 4.2 Serialisation

Reuse the precedent in §0.6. `Show#showData` already delegates one key to an externally-attached
subsystem: `visualizer: this.visualizerHandle.showData` (`show.model.js:102`), restored by
`this.visualizerHandle.preferences = showData.visualizer` (`:392`).

Three ways to add a `venue` key:

- **A — prototype/instance monkey-patch of `showData` / `loadFromData` / `clearShowData`** from
  a new module. Zero upstream lines. Rejected for the same reason as §1.4: unlogged merge debt
  the ledger hook cannot see, plus an ordering hazard (`loadFromData` calls `persistLocally()`
  at `:422`, so a post-hoc restore writes a stale autosave and needs a second write).
- **B — override in `ShowSingleton`** (`src/singletons/show.singleton.js`, 23 lines, upstream,
  currently unmodified). A subclass already exists; `get showData() { return { ...super.showData,
  ...StageExtensions.serialize() }; }` plus an async `loadFromData` override is idiomatic OOP,
  legible, and lands in a tiny file upstream is unlikely to touch. **Recommended.**
- **C — a named seam inside `show.model.js`** (`:95-105`, `:384-423`, `:281-289`). Most visible,
  but it edits the 556-line file most likely to conflict on a merge.

Option B gives **one** extension point that §2 (workspace layouts), §3 (if it ever needs a
show-level key), §4 (venue) and later hang-positions all share. Pay it once.

Restore ordering under B: stash the incoming `showData` in the override, `await super
.loadFromData(...)`, apply extensions, then call `this.persistLocally()` once more so the
autosave written during load is not stale. One extra `localStorage` write per load; acceptable.

### 4.3 GLTF vs procedural for v1 templates

**Procedural, and it is not close.**

- The vision already specifies it: "A venue is a JSON parameter object → procedural geometry. No
  new rendering tech… Unit-testable: given params, assert generated bounding boxes, trim heights
  and fixture-attachable anchor list" (`product-vision.md:466-468`).
- A parameterised room is the *product*: three sliders (`:459-460`) mean the geometry must be
  regenerated at interactive rates. A GLTF is a fixed room.
- Testability. Procedural geometry is generated by a pure function in
  `src/models/stage/`, which the existing Vitest harness runs with no WebGL. A GLTF asset can
  only be tested by rendering it.
- Payload. The whole current model library is 37 KB
  (`public/visualizer/models/`, one `.glb`). Six venue GLTFs would dwarf the app.
- Materials, not meshes, are what make a room read as a room: `visualizer.js:282-295` already
  builds `MeshStandardMaterial` floors from a texture in `public/visualizer/textures/`. Venue
  v1 wants boxes/planes plus good materials.

**GLTF earns its place later**, for irregular set pieces and props, and the loader is already
there: `model_instancer.js:1-18` (GLTFLoader + DRACO, manifest-driven from
`public/visualizer/models/model_list.json`). Adding venue props via that manifest is a data-file
edit, or — better — a second manifest loaded by our own instancer, keeping it additive.

Drape is the one v1 element that is not a box. Procedural still wins: a subdivided plane with a
sine-fold displacement plus a double-sided matte material reads correctly at previz distance and
stays parameterisable (fullness, height, colour).

### 4.4 Unavoidable upstream edits

| File | Lines | Why |
|---|---|---|
| `src/singletons/show.singleton.js` | ~10 (two overrides) | The showfile is composed by an object literal in the model layer; nothing outside can add a key without either patching or overriding. The subclass is the smallest honest override point, and it is the shared seam for §2/§3/§4. |

Everything else — the venue models, the renderer, the templates, the pool, the MCP commands — is
new files.

### 4.5 MCP surface

```
list_venue_templates {}
apply_venue_template { template: 'club'|'ballroom'|'theatre'|'festival'|'outdoor'|'whitebox',
                       room_w?, room_d?, trim_h?, stage_w?, stage_d?, stage_h? }
set_venue_params     { ...same numeric params }
get_venue            {}  -> params + derived bounds + anchor list
add_venue_object     { kind: 'drape'|'deck'|'wall'|'riser', ...transform }
```

`get_venue`'s anchor list is what §6.2 of the vision (hang positions) will consume, and what
§9.2 (rig suggestion from a venue) needs to reason against. Design the anchor shape now even if
positions ship later.

### 4.6 Rough task count

**14–16 tasks.** `venue.model.js` + pool + params/derived-bounds tests (3, `standard`); the
`show.singleton.js` extension seam + round-trip test + ledger (2, `capable` — contract surface);
renderer skeleton + `visualizer_loaded` wiring (2, `standard`); room shell + floor/deck (2,
`standard`); drape (1, `standard`); six templates as data (2, `cheap` once one exists); MCP
command group + tools + parity (2, `cheap`); template picker UI (1–2, `standard`); render
verification per `verification.md` (1, `inline`).

---

## 5. Timeline surface

### 5.1 What `chase.modifier.widget.timeline.vue` actually is

1108 lines: template + script to `:771`, then 336 lines of scoped CSS. Its coupling:

| Coupling | Evidence |
|---|---|
| Its `pool` prop is a **`Chase`**, not a pool | bound as `:pool="chase"` at `chase.modifier.fragment.vue:43-45` |
| X axis is **chase-relative ticks**, at a hard-coded 64 subdivisions per bar | `computeCueStyle` `:cue.tick * this.cellWidth` (`:275-281`); `pool.barSubDiv` is `return 64` (`chase.model.js:196-198`) |
| Rows are the **cues of one chase**, one per `CueItemPool` | `v-for="(cueItemPool, cueIndex) in pool.cues"` (`:30`) |
| Writes through `CueItemPool` | `cueItemPool.addRaw({ tickStart, tickDuration, subDiv })` (`:423-427`), `cueItemPool.delete(cueItem)` |
| Reads `Fade` control points directly for the clip curve | `cue.fadeIn.controlPoints[0].x …` (`:319-322`) |
| Coupled to the router | `watch: '$route.params.chaseId'` (`:238-240`) |
| Uses the app's drag-capture util | `this.$utils.setCapture(e.currentTarget, 'col-resize')` (`:437`) |
| No tests | no component test harness exists (`CLAUDE.md` §5, "Untestable in Phase 0") |

A show timeline needs: X = **show-absolute** time or bars (with a bars/time toggle); rows =
**groups** (`product-vision.md:277`); regions = looks/effects/chases with independent start,
length and *fade handles*; plus a playhead, cycle region, markers, snap, and automation lanes
holding **N breakpoints**.

Every one of those is a different axis model, a different row model, and a different write
target from what the widget has. The second "seed" the vision names,
`modifier.widget.curve.vue`, is bound to a `Fade` with exactly **two** bezier control points
(`modifier.widget.curve.vue:84-104`, `fade.model.js:132-139`) — an automation lane is an
arbitrary breakpoint list. Also a different data model.

### 5.2 Verdict: **a fresh component, built on primitives harvested from the widget**

The vision's "promote rather than rebuild" (`product-vision.md:291-294`) is right about *where
the value is* and imprecise about *what to move*. What is genuinely reusable is the **interaction
layer**, roughly 250 of the widget's lines and the hardest 250 to get right:

- `startZoom` / `handleZoom` / `stopZoom` (`:364-395`) — drag-to-zoom with double-click reset
- `startResizeCue` / `resizeCue` (`:438-479`) — snap-to-grid edge drag
- `startDragCue` / `dragCue` (`:487-544`) — snap-to-grid body drag
- `doesCollide` / `computeCueResizeCollision` / `computeCuePositionCollision` — neighbour
  collision resolution
- the `setCapture` overlay idiom

Extract those into `src/views/components/timeline/` as composables
(`useTimelineAxis`, `useClipDrag`, `useClipResize`, `collision.js`) — written fresh but ported
line-by-line, with the `cellWidth`/`$refs` dependencies turned into arguments — then build the
show timeline on top of them. **Leave `chase.modifier.widget.timeline.vue` untouched**: zero
upstream edits, zero regression risk to the existing chase editor, and the 405-test suite is not
even adjacent. Re-basing the chase widget onto the shared composables later is a separate,
optional, purely-mechanical step that can be judged on its own.

Calling this "promotion" would be dishonest. Calling it "a rewrite that steals the hard parts"
is accurate, and it is what the vision's own build note describes: "Scope v1 to: track list
generated from groups, regions with drag/resize/copy, one lane type (intensity), playhead and
snap" (`product-vision.md:305-307`).

One design constraint to fix before any code, per `product-vision.md:308-311`: **the timeline
and the cue stack are two views of one model.** Whatever backs a "region" must not be
`CueItem` (which is chase-tick-relative by construction, `cue.item.model.js:120-143`,
`:180-183`). It needs a new `Region` model in `src/models/stage/` (or `src/models/show/`) with
absolute start/length in ms *and* a bars representation, from which both presentations render.
Getting this wrong is the "most likely expensive mistake" the vision names.

### 5.3 Unavoidable upstream edits

**None**, if the show timeline is a new panel placed by the §2 workspace shell. It becomes a
sixth pane; `App.vue` already points at the workspace activity by then.

### 5.4 Rough task count

**18–24 tasks** — the largest item in Phase 2 by a wide margin, and the vision agrees
(`product-vision.md:305`). Region model + tests (3, `capable`); composable extraction with unit
tests where possible (4, `standard`); ruler/axis + bars⇄time (2, `standard`); track list from
groups (2, `standard`); region drag/resize/copy (3, `standard`); playhead + transport
integration with §1 (2, `capable`); snap/grid (1, `standard`); one automation lane type (3,
`capable`); MCP `add_region`/`move_region`/`get_timeline` (2, `cheap`); verification (1,
`inline`).

**This is the one area where the honest recommendation is: do not start it in Phase 2 unless
§1 and §2 have landed.** A timeline without a working transport is, in the vision's own words,
worthless (`product-vision.md:50`), and a timeline without a resizable shell has nowhere to live
(`ux-audit.md:432` — the current automation editor gets ~5% of the window).

---

## 6. Sequencing

```
§3 fixture-id repro/fix ─┐
                         ├─> §3 fixture records ─┐
§0.5 (prerequisite)  ────┘                       │
                                                 ├─> paperwork, rig suggestion (P3+)
§4 show.singleton seam ──┬─> §4 venue ───────────┘
                         └─> §2 layout persistence
§1 transport  (independent; ships first, highest value/effort ratio)
§2 layout shell (independent of §1; needed before §5)
§5 timeline   (needs §1 for the playhead, §2 for the space)
```

Recommended order: **§1 → §2 → §4 → §3 → §5**, which matches the vision's revised sequencing
(`product-vision.md:99-101`) with one change: the `show.singleton.js` extension seam is pulled
forward into §4's first task because §2's layout persistence wants it too.

## 7. Estimate rollup

| Area | Tasks | Upstream files touched | Upstream lines | New ledger entries |
|---|---|---|---|---|
| §1 Transport | 14–18 | 2 (views) | ~7 | 2 |
| §2 Layout shell | 10–12 | 1 (`App.vue`, already logged) | 2 | 0 |
| §3 Fixture records | 8–10 | 2 (`fixture.model.js`, `fixture.pool.model.js`) | 3–4 | 2 |
| §4 Venue | 14–16 | 1 (`show.singleton.js`) | ~10 | 1 |
| §5 Timeline | 18–24 | 0 | 0 | 0 |
| **Total** | **64–80** | **6 distinct files** | **~22–23 lines** | **5** |

Twenty-odd lines of permanent merge debt for the whole of Phase 2, in six files, none of them
in `src/models/DMX/`'s hot cue engine. That is the number to hold the plan to.

## 8. Open questions for the owner

1. **`Ask First` — new production dependency**: `splitpanes` (§2). MIT, 82 KB, zero deps.
2. **`Ask First` — contract surface**: the `showData` extension seam in `show.singleton.js`
   (§4.2 Option B) and the `meta` key on `Fixture#showData` (§3.3). Both are ADDITIVE-ONLY under
   `contract-surfaces.md:35`, but both touch the frozen showfile format.
3. **Run two repros before planning**: the fixture-id round-trip throw (§0.5) and the
   `mode: this.modeNam` typo (§3.3). Both are code-read findings with real user-facing blast
   radius, and both are cheap to confirm.
4. **§2's root-activity trade** (§2.4): duplicate `setup()` into a new activity for a 2-line
   `App.vue` diff, or edit `app.activity.vue` in place for ~35 lines and no duplication.
5. **Drop `@vue/compat`?** (§0.1) — an unused dependency that misleads every future reader
   about what runtime this app is on.
