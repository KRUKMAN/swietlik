# Świetlik code review — 2026-09-09

Scope: `git diff develop...main` (the fork's full divergence from upstream `ASLS-org/studio`), plus a targeted pass over the engine areas named in the review brief (`live.model.js`, `cue.model.js`, `chase.model.js`, `fixture.model.js`, `universe.model.js`) even though those files are unmodified upstream code. Every finding below was verified by reading the cited lines and, where the bug is a logic error rather than a style issue, by reproducing it in an isolated Node snippet (shown inline).

Findings are split into **Our code** (the fork's own diff — these are ours to fix) and **Upstream inherited** (present verbatim in `develop`, unaffected by anything in this fork's diff — these inform phasing, not immediate action per the review brief).

---

## 1. Ranked findings — Our code (the fork's diff)

### 1.1 MAJOR — `??` fallback plus an empty-string localStorage value produces an uncaught crash on app startup, silently defeating the very migration it implements

**File:** `src/models/DMX/show.model.js:337-343`

```js
async loadFromLocalStorage() {
  const ls_showdata = localStorage.getItem(LOCALSTORAGE_SHOWFILE_KEY)
    ?? localStorage.getItem(LEGACY_LOCALSTORAGE_SHOWFILE_KEY);
  if (ls_showdata != null) {
    await this.loadFromData(JSON.parse(ls_showdata));
    return true;
  }
  return false;
}
```

`??` only falls through on `null`/`undefined`, never on an empty string. If `localStorage.getItem('SWIETLIK_SHOWFILE')` returns `""` — a browser privacy extension that neutralizes storage reads, a user clearing the value (not the key) in DevTools' Application tab, or a future code path that ever calls `setItem(KEY, '')` — the legacy fallback is **not** consulted (verified: `"" ?? "legacy"` evaluates to `""`, confirmed via Node), and `ls_showdata` is `""`. The `!= null` guard passes (empty string is not null), so `JSON.parse("")` runs and throws `SyntaxError: Unexpected end of JSON input` (reproduced).

Nothing catches it:

- `loadFromLocalStorage` has no try/catch.
- Its only caller, `src/views/activities/app/app.activity.vue:101-108` (`setup()`), also has no try/catch around `await this.$show.loadFromLocalStorage()`.
- `setup()` itself is invoked from an `EventBus.on('visualizer_loaded', this.setup)` listener (`app.activity.vue:87`) with no wrapping handler either.

Net effect: the promise rejection is unhandled, `setup()` never reaches `this.loader.state = false` / `EventBus.emit('app_ready')`, and the app is stuck on the loading screen indefinitely with no user-facing error (the `app_error` EventBus handler that exists for exactly this purpose, `app.activity.vue:88-92`, is never reached because nothing calls it). The only recovery is a user who knows to open DevTools and clear `localStorage` by hand.

This is a **regression surface introduced by the migration**, not merely inherited: upstream's original single-key version has the identical missing-try/catch gap, but it can't have this specific failure mode, because there is no second key whose presence/absence interacts with the first. The fork's fallback logic added a new way to reach the same unhandled-exception cliff, and does so *silently defeating the fallback it was written to provide* — a corrupted-but-present primary key permanently hides a perfectly good legacy autosave instead of falling back to it.

**Failure scenario:** any mechanism that leaves `localStorage['SWIETLIK_SHOWFILE']` set to `""` (privacy tooling, manual DevTools edit, a future bug) → next app load hangs forever on "Preparing Environment" / "Waiting for views to settle", with a legacy `ASLS_STUDIO_SHOWFILE` autosave sitting right there, unreachable.

**Test coverage gap:** `test/models/show.spec.js`'s `describe('Show#loadFromLocalStorage', ...)` block (lines 188-249) covers "neither key present", "current key present", "legacy key present", "both present" — but not "current key present as `''`". This is the one case that would have caught the bug; it should be added as a regression test alongside any fix.

**Fix direction (not applied — review only):** treat an empty string the same as absent (`|| localStorage.getItem(...)` instead of `??`, or an explicit `if (!ls_showdata)` check before either read), and/or wrap `loadFromLocalStorage`'s body (and its call site in `app.activity.vue`) in a try/catch that routes to the existing `app_error` EventBus channel instead of hanging.

---

### 1.2 MINOR — `pools.spec.js`'s universe/fixture-pool test double-adds a fixture via a call pattern the real app never uses, then documents the artifact as if it were `patchFixture` behaviour

**File:** `test/models/pools.spec.js:323-345`

```js
it('nests the patched fixtures under the universe chunk', () => {
  const pool = new UniversePool();
  const universe = pool.addRaw({ id: 3, name: 'Front', color: '#ff0000' });
  const fixture = universe.fixturePool.addRaw(sharpyData({ name: 'Sharpy A', chStart: 1 }));
  universe.patchFixture(fixture);
  ...
  // patchFixture pushes the fixture a second time via addExisting, so the
  // nested list mirrors the pool contents rather than the patch map.
  expect(showData.fixtures.every((chunk) => chunk.name === 'Sharpy A')).toBe(true);
```

The test calls `universe.fixturePool.addRaw(...)` directly and then `universe.patchFixture(fixture)`, which internally also does `this.fixturePool.addExisting(fixture)` (`src/models/DMX/universe.model.js:191`) — on the **same** local pool, so the fixture really is pushed twice. But every real call site does it differently: `show.model.js:427` and the patch popup (`universe.modifier.popup.patch.vue:337`) always call `addRaw` on the **Show's global** `fixturePool`, then pass the resulting fixture into `universe.patchFixture(fixture)`, which adds it to the *universe's separate, local* pool via `addExisting`. In that real path each fixture lands in each pool exactly once — no duplication.

The test's own comment attributes the doubling to `patchFixture`'s behaviour, which will read to a future maintainer as "this is how patching works," when it's actually an artifact of the test calling the wrong pool's `addRaw`. Because the fixture's `name` is identical on both entries, `every(chunk => chunk.name === ...)` passes trivially either way and can't tell a maintainer whether patching-then-reading-showData produces one entry or two.

**Failure scenario:** a future contributor reads this test to understand `Universe#showData`, believes duplicate fixture entries are normal, and either ships a real duplication bug elsewhere without noticing, or wastes time "fixing" `patchFixture` for behaviour that only exists because of this test's non-representative setup.

**Suggested fix direction:** build the fixture via `show.fixturePool.addRaw(...)` (or a bare `FixturePool` standing in for the Show's global pool) to mirror the real call path, and assert `showData.fixtures` has length 1.

---

### 1.3 Positive note — test suite quality

Across all 10 spec files (`capability`, `channel`, `cueItem`, `entityManager`, `fade`, `fixture`, `master`, `pools`, `proxify`, `show`), assertions are anchored to real OFL fixture data (`test/helpers/ofl.js` loads actual `public/fixtures/**` JSON rather than hand-rolled fixtures) and, notably, several tests *intentionally pin down real upstream bugs with an explanatory comment* rather than asserting the "intended" behaviour:

- `test/models/cueItem.spec.js:158-199` documents that `CueItem`'s `fadeOut` setter is misnamed internally and clobbers `_fadeIn` instead of `_fadeOut` (see §2.1 below — this is the same bug, independently rediscovered from the test side).
- `test/models/entityManager.spec.js:65-70` documents that `parseValueUnit`'s regex leaks `-` and `.` into the returned "unit" string.
- `test/models/proxify.spec.js:80-90` documents that `undo()` is a silent no-op when `regenHash()` was never called.
- `test/models/channel.spec.js:70-86` documents that `Channel#value` has no clamping (clamping lives one layer up, in `Fixture#setChannel`).

This is exactly the right way to write characterization tests against inherited code — it gives Phase 1 a truthful map of what the engine actually does, not what its doc comments claim. No wrong-assertion or stub-drift bugs were found in any of the 10 files or the 3 stubs; the `moving_head`/`controls`/`wsc.connection` stubs' surfaces were cross-checked line-by-line against the real modules (`src/plugins/visualizer/moving_head.js`, `controls.js`, `src/plugins/wsc.connection.js`) and match every property/method `fixture.model.js` and `output.pool.model.js` actually touch.

---

### 1.4 Verified clean — mechanical lint fixes, license plumbing, rebrand strings

- **`modifier.widget.colorpicker.vue`** (`src/views/activities/app/fragments/modifiers/_widgets/`): diffed against `develop`. The comma-operator → semicolon rewrite in `rgbValue()`'s HSV→RGB switch (`case 0: r = v, g = t, b = p;` → `case 0: r = v; g = t; b = p;`) is value-identical — the comma operator's return value was never used (the statements were bare assignment statements, not consumed as an expression), so splitting them changes nothing observable. The two removed variables (`lightnessPickerWidth`, `lightnessPickerRadius`) were confirmed dead in the original (grep shows no read after their declaration in `develop`'s version of `dragLightnessTick`).
- **`uikit.list.vue`**: `handleFocusOut(e)` → `handleFocusOut()`. Confirmed the only call sites (`@focusout="handleFocusOut"` template binding and an internal `this.handleFocusOut()` call at line 384) never depended on the event object; Vue silently drops the unused argument on the template-bound path. Behaviour-neutral.
- **`public/COPYING.txt`**: byte-for-byte identical to root `COPYING` (diffed, 674/674 lines match). The splash popup's `href="/COPYING.txt"` (`popup.splash.vue:59`) resolves correctly and doesn't collide with the `@root/COPYING?raw` Vite import used by `popup.license.vue:18`, which was the whole point of the `public/COPYING` → `public/COPYING.txt` rename (commit `6c0bc3d`).
- **`.eslintrc.js`**, **`vitest.config.mjs`**, **`ci.yaml`**: no correctness issues. The `?worker` suffix check in the worker-stub plugin (`vitest.config.mjs:54`) matches the only two real usages (`src/worker-api.js:1`, `src/models/DMX/live.model.js:1`), both plain `?worker` with no `&inline` variant in use, so the stub redirection is exhaustive for the current codebase (it would silently miss a future `?worker&inline` import that doesn't also end in `?worker` — worth a comment, not a bug today).
- **Rebrand link edits** (`popup.splash.vue`, `toolbar.fragment.vue`, `popup.newshow.vue`, `popup.saveas.vue`): all URLs/strings changed to plausible KRUKMAN/swietlik targets with no obvious typos or dead links found in a manual read.

---

## 2. Ranked findings — Upstream inherited (present verbatim in `develop`; inform phasing, not immediate fixes)

These are pre-existing in `ASLS-org/studio` and untouched by the fork's diff (confirmed via `git diff develop main -- <file>` returning empty / `git show develop:<file>` matching). They matter for this review because (a) two of them are the mechanical cause of the "freeze then cut" behaviour tracked as GitHub issue #2 (see §3), and (b) Phase 1's whole premise is exposing `$show` to an MCP-driven agent, which is a much more adversarial/mechanical caller than a human clicking buttons — several of these "nobody actually triggers this from the UI" caveats stop applying once an agent can call `$show.*` methods directly with arbitrary arguments.

### 2.1 MAJOR (latent, zero current UI exposure) — `CueItem#fadeOut` setter writes to the wrong backing field

**File:** `src/models/DMX/cue.item.model.js:68-74`

```js
set fadeOut(fadeIn) {
  this._fadeIn = fadeIn;
}

get fadeOut() {
  return this._fadeOut || DEFAULT_CUE_FADEOUT;
}
```

The setter parameter is named `fadeIn` and assigns `this._fadeIn`. `_fadeOut` is never assigned anywhere in the class. Verified in isolation:

```
fadeIn readback: 800 (expected 250, actually clobbered by fadeOut assignment)
fadeOut readback: 0 (expected 800, always reads default)
```

Because the constructor runs `this.fadeIn = data.fadeIn;` immediately followed by `this.fadeOut = data.fadeOut;` (`cue.item.model.js:40-41`), any showfile or caller that supplies both fields ends up with `fadeIn` silently overwritten by whatever `fadeOut` was (or `undefined`, collapsing to the default `0`), and `fadeOut` permanently unreadable.

**Current blast radius is small**: grepped every read of `.fadeIn`/`.fadeOut` in `src/`. The only consumer of `CueItem`'s *numeric* fadeIn/fadeOut is its own `showData` round-trip; the chase-timeline widget (`chase.modifier.widget.timeline.vue:325-326`) reads `cue.fadeIn`, but `cue` there is the `Cue`/`Scene` handle (a different class with its own, correctly-implemented `Fade`-object `fadeIn`/`fadeOut`, `scene.model.js:250-260`) — not the `CueItem` wrapper. No UI writes a `CueItem`'s `fadeIn`/`fadeOut` today, so nothing currently visibly breaks.

**Why this belongs in the Phase 1 risk list**: the moment the MCP command surface exposes anything like "set this cue item's fade timing" (a natural, likely command for chase editing), this bug activates immediately and will look like "fade-out settings don't stick / get swapped with fade-in," and will be very confusing to debug without this note, since the getter *looks* correct in isolation.

### 2.2 MAJOR — `Universe#checkPatchCapability` always returns `true`; overlapping fixture patches are never rejected

**File:** `src/models/DMX/universe.model.js:224-234`

```js
checkPatchCapability(chStart, chCount) {
  const chStop = chStart + chCount;
  // eslint-disable-next-line consistent-return
  Object.keys(this._patch).forEach((fixtureAddress) => {
    const fixture = this._patch[fixtureAddress];
    if (chStart <= fixture.chStop && fixture.chStart <= chStop) {
      return false;
    }
  });
  return true;
}
```

`return false` inside an `Array.prototype.forEach` callback only returns from that one callback invocation — it does not stop the loop and has zero effect on `checkPatchCapability`'s own return value. The function unconditionally falls through to `return true` after the (uninterruptible) loop finishes, regardless of whether an overlap was detected. Reproduced directly:

```
Overlapping patch allowed? true   // fixture at chStart=5,chCount=10 overlapping an existing 1-16 patch
```

`patchFixture` (`universe.model.js:187-198`) uses this as its **only** guard:

```js
patchFixture(fixture) {
  if (this.checkPatchCapability(fixture.chStart, fixture.chCount)) {
    ...
  } else {
    throw new Error('Cannot patch fixture on this interval');
  }
}
```

Since the guard is a permanent no-op, the `throw` branch is dead code — two fixtures can be patched onto overlapping DMX addresses in the same universe with no error, silently. `patchFixture`'s address-map write (`for (let i = fixture.chStart; i < fixture.chStop; i++) { this._addressMap[i] = fixture.chStart; }`) then has the later-patched fixture's `chStart` win for every overlapping address, so the earlier fixture's overlapping channels silently resolve to the *wrong* fixture at render/output time (`DMX512Data` getter, `universe.model.js:151-164`, and the DMX buffer write path at `universe.model.js:140-148`).

Two call sites reach `patchFixture`:

1. **`show.model.js:213`** (`prepareUniverses`, part of the showfile-load pipeline) — calls `universe.patchFixture(fixture)` unconditionally for every fixture in every universe in the loaded showfile, with **no separate collision pre-check**. This is the direct hostile/malformed-showfile path the review brief asked about: any showfile (hand-edited, generated by a future tool, or corrupted) with overlapping `chStart`/`chStart+chCount` ranges loads without any error, and produces silently wrong channel-to-fixture mapping.
2. **`universe.modifier.popup.patch.vue:342`** (interactive "Patch" UI) — also calls `patchFixture`, but this path is protected in practice because the *UI's own* pre-check, `checkPatch()` (line 385-394), uses a **different, correctly-implemented** method, `canPatchMany` (`universe.model.js:245-253`, a plain `for` loop with an early, effective `return false`), to gate the Save button before `patchFixture` is ever called. So the interactive path degrades gracefully today only because of an independent, working guard — `patchFixture`'s own defense is still dead.

**Failure scenario:** load a showfile (via file open, URL template, or a Phase 1 MCP "load show" command) containing two fixtures on the same universe with overlapping channel ranges → no error, no warning, and one fixture's channels are silently driven by the other fixture's cue data from then on.

**Relevance to Phase 1:** an MCP agent constructing or editing patch data programmatically (e.g., "patch 12 more fixtures starting at channel X" without first computing free address space) is exactly the kind of caller that will hit this where a human, guided by the working `canPatchMany`-gated UI, mostly won't.

### 2.3 Latent (paired with 2.2) — `Fixture#setChannel` has no bounds check on the channel index

**File:** `src/models/DMX/fixture.model.js:642-680`

```js
setChannel(id, value) {
  const channel = this.channels[id]; // Getting channel instance from ID
  if (channel.fineChannels.length > 0) { ...
```

If `id` is out of range for `this.channels` (negative, or ≥ `channels.length`), `channel` is `undefined` and the very next line throws `TypeError: Cannot read properties of undefined (reading 'fineChannels')`. Reachable whenever a scene/cue/effect references a channel index that doesn't exist on the fixture actually loaded at render time — e.g. a showfile saved against one fixture mode (channel count N) and replayed after the fixture's mode was changed to a shorter mode, or a malformed/hand-edited showfile with an out-of-range `channelValues[].id`. Not exercised by the current test suite (`test/models/fixture.spec.js`'s `setChannel` tests all use in-range Dimmer/Pan/Color-Wheel indices).

**Relevance to Phase 1:** same shape of risk as 2.2 — an MCP command like "set channel N to value V" with an agent-supplied `N` has no server-side validation today; the first line of defense would need to live in `setChannel` itself or in whatever Phase 1 wrapper calls it.

---

## 3. GitHub issue #2 — "stopping freezes, then cuts" — root-cause analysis

**Symptom (as filed):** stopping a running cue/chase visually freezes the fixtures at their last rendered values for a moment, then the lights abruptly jump ("cut") to a different state, instead of either holding cleanly or fading out.

**Root cause, traced through the actual call graph (all inherited/upstream, unmodified by this fork):**

1. **"Stop" removes the driver, it does not reset the output.** `Cue#cue(false)` (`cue.model.js:222-227`) and `Chase#cue(false)` (`chase.model.js:229-239`) both do the same thing at bottom: `Live.remove(this.animationId)`. `Live.remove` (`live.model.js:277-284`) simply splices the animation out of `Live.animations`. Nothing about "remove" writes any channel value. The channel/fixture objects (`Channel#value`, `Fixture._3DModel.*`) are plain mutable state — whatever `Scene#update()`/`FXChannel#update()` last wrote into them via `Fixture#setChannel` (`scene.model.js:465` → `fixture.model.js:642`) simply **stays there**, because nothing is calling `update()` on that cue any more. That is the "freeze": the visual output is not being driven to any particular value, it's just not being updated at all.

2. **The class *has* a fade-out mechanism, but nothing ever triggers it.** `Scene` carries a `fadeOut` `Fade` instance and a `direction` flag specifically for this purpose (`scene.model.js:22-25, 247, 453-454, 460`): when `direction === SCENE_DIRECTIONS.OUT`, `update()` fades every active channel down through `fadeOut`'s curve instead of holding the preset value. But `direction` is set to `SCENE_DIRECTIONS.IN` once, in the constructor (`scene.model.js:247`), and **grepping the entire `src/` tree finds no other assignment to `.direction` anywhere** — not in `Cue#cue()`, not in `Chase#cue()`, not in any UI stop handler. `SCENE_DIRECTIONS.OUT` is reachable only by a caller manually flipping `scene.direction = 1` before the animation is removed, and no such caller exists. So the fade-out path is fully-built, wired-up, dead code from the caller's perspective — stopping a scene never fades it, it just stops updating it (step 1).

3. **Where the "cut" comes from.** Nothing explicitly zeroes the output on stop. The abrupt jump users see is whatever the *next* write to those same channels happens to be — and the two real call sites that drive multi-chase/-cue transitions guarantee there will be one immediately:
   - `Master#cueRow(rowIndex)` (`master.model.js:21-45`): on **every** call, it unconditionally does `chase.cue(false)` on *every* chase in *every* group first (freezing all of them per step 1), then — if a different row is being cued in — calls `chase.cue(state)` on the target row's chase. The moment that new chase's first `Live` tick fires, `Scene#update()`/`FXChannel#update()` write the new cue's values directly over whatever was frozen, with zero interpolation between the two. That direct overwrite, landing on top of values that were sitting frozen a tick earlier, *is* the "cut."
   - `Group#stopAllChases(except)` (`group.model.js:246-250`) is the same pattern one level down: freeze everything except one exception, no reset step.

4. **Timing state is destroyed, not paused, on stop** — this is the concrete reason "resume" doesn't work today. `Cue#cue(false)` sets `this.deltaStart = null` (`cue.model.js:226`); `Chase#cue(false)` sets `this.elapsed = 0` (`chase.model.js:230`). Contrast this with `Live`'s own genuine pause mechanism: setting `Live.state = PAUSED` (`live.model.js:125-127`) freezes `pauseStartTime` and, on the next `update()` tick, continuously grows `pauseTimeOffset` (`live.model.js:232-234`) so that when playback resumes, `this.time = time - this.pauseTimeOffset` picks up exactly where it left off (`live.model.js:227`). That mechanism works correctly for a *global* pause/resume (verified by reading `Live#update`) — but per-cue/per-chase "stop" is a completely different, one-way code path that deletes the very state (`deltaStart`, `elapsed`) that would be needed to resume from where it stopped, rather than freezing it the way `Live`'s own pause does.

**What resume would actually require** (for scoping Phase 1/2 work, not proposed as a fix here):

- A stop path that does **not** null out `deltaStart`/`elapsed`, but instead preserves them (mirroring `Live`'s `pauseTimeOffset` trick) so a subsequent "resume" can re-derive an equivalent `deltaStart` rather than restarting the cue's timeline at t=0.
- A stop path that, before removing the animation, either (a) makes exactly one final `update()` call with `direction = SCENE_DIRECTIONS.OUT` (i.e., actually uses the existing `fadeOut` machinery, which today is unreachable) so the visible transition is a fade rather than an instant freeze, or (b) explicitly writes the fixture's default/off channel values before releasing control, so nothing is left in an undefined "last cue wins forever" state.
- `Master#cueRow`/`Group#stopAllChases` would need to stop composing "freeze everything, then hard-cue the target" and instead either cross-fade or sequence the stop-then-start so the new cue's first frame doesn't land directly on top of still-frozen old values.

None of this is fork-introduced; it is the mechanical shape of upstream's cue engine as shipped. It is documented here because it is the load-bearing analysis issue #2 needs, and because any Phase 1/2 work that wants "resume" or "smooth stop" as a feature is starting from "the state doesn't exist to resume from" and "the fade machinery exists but is never invoked," not from a small bug fix.

---

## 4. Security/quality quick scan

- **axios usage** (`show.model.js:423, 441`): URLs are built via template-string concatenation of `import.meta.env.VITE_STATIC_URL` with fixed path segments and, for `prepareFixtures`, `fixtureData.manufacturer`/`fixtureData.model` taken straight from showfile data (`${import.meta.env.VITE_STATIC_URL}fixtures/${fixtureData.manufacturer}/${fixtureData.model}.json`). No path-traversal validation on `manufacturer`/`model`, so a hostile showfile could request `../../../whatever` relative to the static fixture root — but since this only ever produces a `GET` (never used to write, and `VITE_STATIC_URL` is a fixed, non-authenticated local/CDN origin per `CLAUDE.md`), the worst case is fetching an unintended same-origin-adjacent static file, not an actual SSRF (no `VITE_STATIC_URL` is attacker-controlled) — low severity, inherited, not fork-introduced.
- **localStorage `JSON.parse` without try/catch**: covered in depth in §1.1. Also present, same shape, in `loadShowFile`/`_parseShowData` (`show.model.js:470-479`, `JSON.parse(showFile)` for the `.asls`/`.json` branch) — but that path *is* wrapped in a try/catch at its only caller, `loadFromFile` (`show.model.js:319-326`), so a malformed on-disk showfile opened via the toolbar fails silently (console.log only, no user-facing error — a UX quality gap, not a crash) rather than crashing the app. `loadFromUrl` (`show.model.js:305-309`, used by the "load demo template" popup) has no try/catch at all, matching the same unhandled-rejection shape as §1.1 if the demo showfile ever 404s or returns invalid JSON.
- **Prototype pollution / blind `Object.assign` on showfile data**: checked every `*.pool.model.js` `addRaw` and the `Fixture`/`Cue`/`Scene`/`Chase`/`Universe` constructors. None of them do `Object.assign(this, data)` or spread untrusted data directly onto `this`; every constructor reads specific named fields off the input object (e.g. `fixture.model.js:143-183`: `this.id = parseInt(data.id, 10); this.manufacturer = data.manufacturer; ...`, one field at a time). A showfile containing a `"__proto__"` or `"constructor"` key in any of its objects is never assigned wholesale anywhere in `src/models/DMX/`, so this specific vector is not present. (The one blanket `Object.assign(this, options)` found anywhere near this code is in `test/stubs/moving_head.stub.js:30` — test-only code, not shipped, not a concern.)
- **Malformed/hostile showfile handling overall**: the load pipeline (`loadFromData`, `show.model.js:370-409`) has no schema validation at any stage — it assumes `showData.universes`, `.fixtures`, `.groups`, `.outputs` are arrays and iterates them with `.forEach`/`.map` unconditionally. A showfile missing any of those keys throws a plain `TypeError` (`Cannot read properties of undefined (reading 'forEach')`) partway through, leaving the show in a partially-cleared, partially-loaded state (since `clearShowData()` already ran before the failure). This is inherited upstream behaviour, not fork-introduced, but is worth flagging given Phase 1 will make `loadFromData`-adjacent methods programmatically callable.

---

## 5. What to fix before Phase 1 code lands

In priority order — these are the items that either (a) are fork-introduced, or (b) sit directly on the Phase 1 MCP surface (`$show.*`) and will be reachable by an agent in ways they mostly aren't reachable by a human today:

1. **Fix the empty-string/uncaught-crash gap in `Show#loadFromLocalStorage`** (§1.1). This is the one fork-introduced correctness bug with real user-facing blast radius (app hangs on load), and it's a small, well-scoped fix (swap `??` for a truthiness check, add a try/catch that routes to the existing `app_error` channel). Add the missing "primary key is `''`" regression test alongside it.
2. **Decide what `$show`'s Phase 1 wrapper does about `Universe#checkPatchCapability`'s no-op collision guard** (§2.2) before exposing any "patch fixture" command. An MCP agent computing its own addresses without the UI's `canPatchMany` gate in front of it will silently corrupt the address map on any overlap. Either fix `checkPatchCapability` (trivial — replace the `forEach` with a `for`/`some` that can actually short-circuit) or have the Phase 1 wrapper call `canPatchMany` itself before ever calling `patchFixture`.
3. **Add a bounds check to `Fixture#setChannel`** (§2.3), or have the Phase 1 wrapper validate the channel index before calling it — an agent-driven "set channel N" command is the first caller likely to pass an out-of-range `N`.
4. **Decide the fade/stop semantics question before designing any Phase 1 "stop"/"resume" command** (§3). Don't build a `resumeCue`/`resumeChase` MCP command against the current model layer without first deciding whether it needs the deeper fix (preserve timing state, wire up the dead `fadeOut` path) described in §3 — otherwise the MCP surface will just be a more convenient way to trigger the freeze-then-cut behaviour issue #2 already tracks.
5. **Lower priority, not blocking:** the `CueItem#fadeOut` setter bug (§2.1) only matters once a Phase 1 command touches per-cue-item fade timing in a chase — fix it then, or fix it opportunistically now since it's a one-line, well-isolated correction (`this._fadeIn = fadeIn` → `this._fadeOut = fadeIn` in the `fadeOut` setter) with an existing test (`cueItem.spec.js:158-199`) that will need its assertions flipped from "documents the bug" to "asserts the fix" in the same change.
