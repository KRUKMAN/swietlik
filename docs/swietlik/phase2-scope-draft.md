# Świetlik — Phase 2 scope draft (input to the spec)

> Author: lighting design & production consultancy pass, 2026-09-10.
> Status: **scope proposal, not approved scope.** This is the input the Phase 2
> spec is written from. It supersedes [`roadmap.md`](roadmap.md)'s Phase 2
> ("stage builder") on sequencing only — the stage builder is not cancelled, it
> is moved. Ranks and vocabulary follow [`product-vision.md`](product-vision.md) §0.
>
> Sources this document is accountable to: `product-vision.md` §2 (owner
> findings), §3 (playback feel), §4 (programming surface), §5 (shell), §6 (stage
> builder), §12 (Spotlight benchmark); [`ux-audit.md`](ux-audit.md) §4 ranked
> issues; [`code-review-2026-09-09.md`](code-review-2026-09-09.md) §3
> (stop-semantics root cause); GitHub issues #2 and #3.

---

## 0. The cut, in one sentence

**Phase 2 makes the app an instrument you can operate: real transport semantics
(Pause holds · Release fades · Blackout cuts, with resume-from-position), a
workspace whose panels you can actually size, a timeline whose regions you can
actually drag, and the one-day fixture-metadata record that unblocks every
document Phase 3 will generate — and it builds no venue geometry at all.**

### IN — ranked, with effort

| # | Feature | Rank | Agent-weeks | Why it's in |
| --- | --- | --- | --- | --- |
| **P2-1** | **Transport & release semantics** (§3 of the vision) | MUST | 2.0 | Issue #2. Jake's own words are the product spec. Nothing else in the app is worth using until stopping something stops feeling like a crash. |
| **P2-2** | **Workspace layout shell v1** (splitters, collapse, one tabbed editor pane, persisted sizes) | MUST | 1.5 | Issue #3, and ux-audit #1/#8 — the two ranked *Blockers* that are pure geometry. Also the physical prerequisite for P2-3: a timeline in a fixed 60 px lane is not a timeline. |
| **P2-3** | **Timeline v1 — show arrange surface** (tracks = groups, regions = chases/cues, drag/resize/snap/playhead/cycle) | MUST | 2.5 | Issue #2's serious half: there is no front door to the automation the demo performs. ux-audit #4 (clips resize but cannot move) is a false affordance sitting on the exact surface we need. |
| **P2-4** | **Data-rich fixture records** (§12.2 #1) | MUST | 0.5 | The cheapest unblocking item in the whole vision, and it independently kills ux-audit #12 ("all 16 fixtures are called MAC Aura"). Nothing in Phase 3's paperwork can start without it. |
| **P2-5** | **Keyboard router seed + `Ctrl+Z` reclaim** (rider on P2-1/P2-2) | MUST | 0.5 | Transport needs `Space`; timeline drags need undo; the app already has five uncoordinated `window` keydown listeners and `Ctrl+Z` bound to "apply gizmo transform". Adding a sixth listener in Phase 2 is how this becomes unfixable. |

**Total: 7.0 agent-weeks.** Cut line and de-scope order in §6.

### OUT — with the reason each one loses

| Feature | Verdict | Reason |
| --- | --- | --- |
| **(e) Venue templates + drape** | **OUT — first item of Phase 3** | It hurts, because vision §6.1 calls it "the single highest-leverage item in Phase 2". It still is — of the *stage builder*. But its payoff is render believability, and render believability is Phase 3's job (bloom, exposure, haze). A ballroom lit by today's beam shader is a nicer diagram, not a sellable render. Ship venue + drape as the opening move of Phase 3 where it compounds with §10.1–10.4 instead of standing alone. |
| **(f) Truss + hang positions** | **OUT — Phase 3** | My own ruling (§6.1) is templates before truss, and (e) is out. Beyond ordering: hang positions are *the* data-model decision of the stage builder (§6.2) — parent transforms, world-matrix composition, `InstancedMesh` slot updates at ~200 fixtures. That deserves its own brainstorm → spec → plan and one throwaway spike, not the tail end of a phase already carrying three surfaces. |
| **(g) Drag-drop placement + auto-patch/auto-number** | **OUT — Phase 3, after (f)** | It is defined as *drop onto a truss*. With no truss and no positions it degrades to "drag a light around a void", which is ux-audit #18 (make the visualizer clickable) wearing a costume — a real want, but a different feature with a different spec. Auto-numbering also depends on P2-4's `unitNumber` field existing, which is exactly why P2-4 is in. |
| Presets / palettes (§7.3), looks (§7.5) | OUT | The timeline wants to hold *looks*; in Phase 2 it holds chases and cues instead. Palettes-as-references is a data-model commitment (§7.3) that must not be rushed in behind a UI deadline. |
| Automation lanes under tracks (§4.1) | OUT | The single largest sub-feature of the timeline. v1 ships regions only. Lanes are additive on top and are Phase 3/4. |
| Audio timeline / tempo map (§11.9) | OUT | Needs Web Audio, beat detection, and a tempo-map model. Phase 3. The timeline ruler must be *built* to accept one (§P2-3 AC-14). |
| Busking grid, cue stack rework (§7.7) | OUT | Same model, third presentation. Not until looks exist. |
| Full docking, tear-off panels, named workspaces, `Alt+1–9` screensets (§5.1 pro layer) | OUT | See P2-2. Splitters get 80% of issue #3 for 20% of the work. |
| Presentation mode / `F11` (§5.2) | OUT — but cheap | Genuinely one afternoon. If P2-2 lands early, take it as a bonus; do not plan around it. |
| Full undo history UI (§4.3 rule 6) | OUT | Phase 2 *binds* undo and requires every new mutation to be one undo step. The labelled history list is Phase 4. |
| Art-Net/sACN input, MVR, share links, paperwork PDFs | OUT | post-v1, unchanged. |

### Phase 2 does NOT do — say it out loud

1. **No room.** No venue templates, no walls, no ceiling, no trim height, no
   drape, no decks, no LED walls, no band, no PA. The floor stays a
   checkerboard. Anyone who reads this doc and builds a `venue.model.js` has
   gone off scope.
2. **No rigging.** No truss, no towers, no hang positions, no parenting, no
   drag-drop placement, no auto-patch, no auto-numbering *assignment* (the
   `unitNumber` **field** ships; the tool that fills it in does not).
3. **No new rendering.** `postprocessing` stays unwired. No bloom, no haze
   changes, no gobos, no shadows. The visualizer is untouched except that it
   gets smaller when you drag a splitter.
4. **No paperwork.** No instrument schedule, no hookup, no power summary, no
   export. P2-4 ships the *data*, Phase 3 ships the *documents*.
5. **No palettes, looks, presets or effect-preset library.** Vocabulary work on
   the effects engine (§7.6) is Phase 4.
6. **No output-arbitration rewrite.** See §4.7 — this is the phase's sharpest
   boundary and its biggest risk.
7. **No Electron, no router change, no `.asls` breaking change.** Everything
   Phase 2 persists is an optional additive key with a safe default when absent
   ([`contract-surfaces.md`](contract-surfaces.md) §1 — ADDITIVE-ONLY, no
   Ask First required, and old showfiles must still load; assert it in a test).

---

## 1. Why this cut and not another

Three arguments, in order of weight.

**1. The owner could not get value out of the app he already has.** That is the
whole finding of `product-vision.md` §2, and no amount of truss geometry
addresses it. A tool that feels like an instrument with a plain rig beats a tool
with a beautiful rig that feels like a form. Phase 2 is therefore about the
*hands*, not the *room*.

**2. These four items are one story; venue geometry is a different one.** A
coherent phase should be summarisable in a sentence an outsider believes.
"Świetlik became operable" is one. "Świetlik became operable and also got a
ballroom" is two phases sharing a branch. Ship one story, ship it whole.

**3. Dependency order is respected in both directions.** Records before
paperwork (P2-4 before Phase 3's schedules). Templates before truss — and since
templates are out, truss is out. Shell before timeline (P2-2 before P2-3),
because the ux-audit measured the current automation editor at 60 px inside a
fixed 239 px strip: building a great timeline into that hole is building it
twice.

The one genuine loss: Phase 2 produces **no new screenshot a client would care
about**. Everything here is felt, not seen. That is the correct trade this once —
but it means Phase 3 must open with venue + drape + bloom and produce the
"before/after" image, or the project goes two phases without a visible win.

---

## 2. P2-1 — Transport and release semantics

**Rank: MUST. Build: crisp. Effort: 2.0 agent-weeks.**
Vision §3.2–§3.4 · issue #2 · ux-audit #3 (Blocker) · code-review §3.

### 2.1 User story (Jake's seat)

> I have a chase running on the band group. I press **Freeze** and the stage
> holds — the lights stay exactly where they are, nothing goes dark, nothing
> moves. I press it again and the chase carries on from where it was, in time,
> instead of snapping back to bar one. I press **Let go** and the look fades
> away over two seconds like a real rig releasing. The only thing in the app
> that cuts to black is the black button.

### 2.2 Simple layer

- **One transport cluster, always in the same place** in the toolbar, replacing
  the read-only `▶ PLAYING` chip: `Go` · `Freeze` · `Let go` · **`BLACKOUT`**.
  The first three are one shape and one colour; Blackout is visually separate,
  larger, and latches with an unmissable indicator (vision §5.4 — the accent
  colour means "this is live", and blackout is the loudest live state there is).
- **The ONE new simple-layer control is a single slider: "How fast things fade
  when you stop them"**, range 0–10 s, default **2 s**, sitting under the
  cluster. That slider *is* the release-time concept made touchable, and it is
  the first pro concept a non-LD will ever knowingly reach for. Everything else
  in this section is defaults the simple layer never mentions.
- `Space` = Freeze/Continue. That is the only key the simple layer teaches.
- Restart mode, quantize, release mask, per-playback release times: **not shown.**

### 2.3 Pro layer

- Per-playback **release time** override, and a **release mask** (which
  attributes release, which hold — the MA/Eos concept). Default mask in §2.5.
- Per-playback **restart mode**: `Continue` / `Next boundary` / `From the top`
  (vision §3.3), defaults per playback type in §2.6.
- Per-playback **quantize**: `off / beat / bar / 2 bars`, made *visible* — today
  it is a silent property that produces the "delayed computed visualisation"
  sensation (defect #3).
- Global release time for "clear the stage" (default 3 s), separate from the
  per-playback default.
- An **armed** state with its own visual: pulsing outline, in tempo. Nothing may
  ever be silently pending.

### 2.4 The verb × scope matrix — normative

Six verbs. Four scopes. Every cell is defined; empty cells are not allowed.

| Verb | Cue | Chase | Group | Master / global |
| --- | --- | --- | --- | --- |
| **GO** | Start from restart mode; fade in over the cue's existing `fadeIn` across `durationMS`. If quantized, enter `ARMED` and fire on the boundary. | Same, on the chase clock. Starting a chase releases the group's other chases over their release times (today: hard-stops them). | Fire the group's selected playback. | `Master.cueRow(n)` — start row *n* in every group **first**, then release the outgoing row (see §2.7). |
| **Pause** (*Freeze*) | Time stops. The cue **stays registered with `Live` and keeps writing its held values every tick.** Nothing goes dark; nothing drifts; nothing else can stomp it. | Same, plus every child cue freezes at its current output. | Pause every running playback in the group. | `Live.state = PAUSED` — the existing, already-correct global pause. |
| **Resume** (*Continue*) | `deltaStart = now − heldElapsed`. Phase preserved. | Same. With quantize on, re-enter on the next boundary rather than mid-beat. | Resume all frozen playbacks in the group, in phase with each other. | `Live.state = PLAYING`. |
| **Release** (*Let go*) | Snapshot current output → interpolate to release target over `releaseMs` (default 2 s) → deregister. **Never a cut.** | One shared envelope for the whole chase's channel set — not one envelope per child cue, which would stack and stutter. | Release every running playback in the group over the group's release time. | — |
| **Stop all** (*Clear the stage*) | — | — | — | Release every running playback everywhere over the **global** release time (default 3 s); `master.playingRow = -1`. |
| **Blackout** | — | — | — | **Instant, both directions.** Output stage forced to zero; **no playback state changes.** Un-blackout reveals whatever is running *now*. It is the panic button; it does not fade, and it does not stop the show. |

### 2.5 The release target — the LD detail that makes it read as real

A releasing fixture **does not move**. Default release mask:

- **Intensity / dimmer channels** → interpolate snapshot → **0** over `releaseMs`.
- **Every other attribute** (pan, tilt, colour, gobo, zoom, prism, shutter…) →
  **hold at its snapshot value** until intensity reaches 0, then release
  ownership without writing.

This is what a real rig does when a fader comes down, and it is the difference
between "the look fades away" and "the look fades away while all sixteen heads
swing home", which reads as a bug to everyone including people who cannot say
why. Pro layer can invert any attribute class in the mask.

### 2.6 Defaults — normative

| Setting | Default | Scope |
| --- | --- | --- |
| Per-playback release time | **2000 ms** | cue, chase |
| Global "clear the stage" release time | **3000 ms** | master |
| Blackout in / out | **0 ms / 0 ms** | global |
| Restart mode — chase | **Continue** | per chase, overridable |
| Restart mode — cue | **From the top** | per cue, overridable |
| Restart mode — master row | **From the top**, with crossfade | master |
| Quantize on newly created playbacks | **off** | new objects only; showfiles keep their stored value |
| Release mask | intensity releases, everything else holds | per playback |

### 2.7 How it maps onto the existing model (per code-review §3)

The code review found four defects; here is the ruling on each.

1. **"Stop removes the driver, it does not reset the output"** (§3.1). Correct,
   and Pause exploits it deliberately — but Pause must go further and keep
   *asserting*, not merely stop updating, so a paused playback cannot be
   silently overwritten. Release is the new path that drives values before
   deregistering.
2. **"The fadeOut machinery is dead code from the caller's perspective"** (§3.2).
   True, and **do not resurrect it as-is.** Read `scene.model.js:453–463`
   carefully: with `direction === OUT` and `relative === false`,
   `finalValue = 0` and `value = 0 * fadeFactor` — the "fade out" writes zero on
   the first tick. It only actually fades when `relative` is true *and*
   `prepareStartValues()` has run. `relative` is a user-facing cue property and
   must not be hijacked.
   **Ruling: build a new additive `ReleaseEnvelope`** (proposed
   `src/models/DMX/transport/release.envelope.js`) that owns
   `snapshot → target` interpolation over `releaseMs`, registers itself with
   `Live`, and is a **pure function of the tick time it is handed**. Cue and
   chase then need only: capture channel handles, hand them to an envelope,
   deregister themselves. This keeps the upstream edit surface to a few lines in
   `cue.model.js` / `chase.model.js` / `master.model.js` (all logged in
   `upstream-diff.md`) and makes the whole thing testable with no clock, no fake
   timers and no worker.
3. **"The cut comes from `Master#cueRow` freezing everything then hard-cueing
   the target"** (§3.3). **Ruling: reverse the order and overlap.** Start the
   incoming row, then release the outgoing row. The crossfade is the overlap of
   the incoming fade-in and the outgoing release. Same ruling for
   `Group#stopAllChases(except)`.
4. **"Timing state is destroyed, not paused"** (§3.4). `Chase#cue(false)` sets
   `elapsed = 0`; `Cue#cue(false)` sets `deltaStart = null`. **Ruling: preserve
   them** and reconstruct `deltaStart = now − elapsed` on re-entry, exactly the
   trick `Live` already uses with `pauseStartTime` / `pauseTimeOffset`. This is a
   completion job, not an invention job — the pattern is already in the file
   next door.

### 2.8 Acceptance criteria (TDD-ready)

Model-layer, no WebGL, no worker, no fake timers required — the envelope is a
function of the `t` it is given.

- **AC-1 Release fades.** Given a scene cue holding dimmer at 255, calling
  `release()` and then driving the envelope at `t = 0 / 500 / 1000 / 1500 / 2000`
  with `releaseMs = 2000` yields dimmer `255 / 191 / 128 / 64 / 0` (±2, linear
  default).
- **AC-2 Release does not move the rig.** Same fixture holding pan 200 / tilt 90
  / colour wheel 30: those three channels read **unchanged** at every tick of the
  release, and are still unchanged at `t = releaseMs`.
- **AC-3 Release deregisters exactly once.** At `t ≥ releaseMs` the playback is
  removed from `Live.animations`, its `state` is IDLE, and a second tick of the
  envelope is a no-op (no negative values, no re-registration).
- **AC-4 Pause holds levels.** Pausing a running chase and advancing `Live` by
  5000 ms leaves every channel the chase owns bit-identical to the pre-pause
  frame, and `chase.elapsed` unchanged.
- **AC-5 Pause keeps asserting.** While a cue is paused, a second playback that
  writes then releases the same channels must not leave those channels changed
  after the paused cue's next tick.
- **AC-6 Resume continues.** Chase with `restartMode = 'continue'`, paused at
  `elapsed = 1234 ms`, resumed at wall-clock `T`: the next `update(T)` computes
  `deltaStart = T − 1234` and `elapsed` continues from 1234, not 0.
- **AC-7 From-the-top still exists.** Same chase with
  `restartMode = 'fromTop'` resumes at `elapsed = 0`.
- **AC-8 Nothing cuts on row change.** `master.cueRow(1)` while row 0 is
  playing: for every tick in `[0, releaseMs]`, no channel owned by both rows
  changes by more than `255 / (releaseMs / tickMs)` per tick — i.e. there is no
  single-tick jump. This is the direct regression test for issue #2's "cut".
- **AC-9 Blackout is instant and non-destructive.** `blackout(true)` → every
  output channel reads 0 within one tick, **and** every running playback's
  `state` and `elapsed` are unchanged. `blackout(false)` → the previous frame's
  values return within one tick.
- **AC-10 Blackout survives nothing.** Blackout is not serialised into `.asls`;
  a loaded show is never blacked out.
- **AC-11 Armed state is observable.** Starting a chase with `quantize = 'bar'`
  sets `state = 'ARMED'` synchronously on the same turn as the call, before any
  tick, and transitions to `RUNNING` only on the boundary. (This is the one-frame
  rule, vision §3.4, expressed as something a test can catch.)
- **AC-12 Live parameter control is never quantized.** `set_channels` (and the
  UI faders it mirrors) applies on the same turn regardless of any quantize
  setting anywhere.
- **AC-13 Defaults.** A newly created cue/chase reports `releaseMs = 2000`; a
  chase reports `restartMode = 'continue'`; a cue reports `'fromTop'`; a new
  chase reports `quantize = 'off'`.
- **AC-14 Old showfiles.** A `.asls` saved before Phase 2 loads with every
  transport field at its default and no console error. Assert with a fixture
  file checked into `test/`.

### 2.9 MCP surface

| Command | Args | Notes |
| --- | --- | --- |
| `transport_go` | `scope` (`cue\|chase\|group\|master`), `group_id?`, `cue_id?`, `chase_id?`, `row?`, `fade_ms?` | Returns `{ state: 'ARMED'\|'RUNNING', firesAtMs? }` so a script can await the boundary. |
| `transport_pause` | `scope`, ids | `scope: 'global'` maps to `Live.state = PAUSED`. |
| `transport_resume` | `scope`, ids | |
| `transport_release` | `scope`, ids, `release_ms?`, `mask?` | |
| `transport_release_all` | `release_ms?` | Default 3000. |
| `transport_blackout` | `state` (bool) | |
| `set_playback_options` | ids, `release_ms?`, `restart_mode?`, `quantize?`, `release_mask?` | One command for all four pro settings; keeps the catalogue small. |
| `get_transport_state` | — | Per-playback `{ id, scope, state, elapsedMs, quantize, armedUntilMs }`, plus `blackout`, `bpm`, `liveState`. **This is the read model that makes transport testable from the MCP side and lets Claude verify its own work.** |

Existing commands stay, as thin aliases, so Phase 1 scripts do not break:
`play_cue` / `play_chase` → `transport_go` / `transport_release`;
**`stop_all` → `transport_release_all({ release_ms: 0 })`**, preserving its
documented "panic stop" meaning exactly.
`get_show_state` gains the transport block. `test/mcp/tool-parity.spec.js` must
be updated in the same PR — it will fail the build otherwise, which is the
intended behaviour.

---

## 3. P2-2 — Workspace layout shell v1

**Rank: MUST. Build: crisp. Effort: 1.5 agent-weeks.**
Vision §5.1 · issue #3 · ux-audit #1 and #8 (both Blocker/Major, both measured).

### 3.1 User story

> The timeline is the thing I'm working in, so I drag it up until it's half the
> screen and the 3D view shrinks. Tomorrow I'm placing lights, so I drag it back
> down. The app remembers which way I left it. When I'm not using the colour
> picker, it isn't taking up 540 pixels.

### 3.2 Scope — exactly this, and no more

The ux-audit's measurement is the spec: the editing surface is a fixed 239 px
tall, 3318 px wide ribbon of nine fixed panels inside a 3127 px container, while
the visualizer holds ~70% of the window and cannot be shrunk. Fix that, only.

- **Draggable splitters** between (a) left column ⇄ centre, (b) centre ⇄
  visualizer, (c) visualizer ⇄ bottom editor pane. Minimum sizes enforced;
  double-click a splitter to reset to default.
- **The bottom strip becomes one tabbed editor pane** showing **one task editor
  at a time** — `Patch · Channels · Colour · Position · Timeline` — chosen by a
  tab strip, full width, no horizontal overflow. This is the Logic editor-pane
  pattern the ux-audit benchmarks against, and it deletes issue #1's off-screen
  Pan/Tilt panel by construction.
- **Collapse/expand** each region, with the collapsed state showing a labelled
  stub you can click (never a disappearing panel).
- **Sizes and the active tab persist** per show, additive `.asls` key
  `workspace`, and fall back to defaults when absent.
- Every panel gets an accessible name while we are in here (ux-audit #23 is
  otherwise never getting fixed, and it is one prop per panel).

**Not in v1:** free docking, tab-merging, tear-off windows, named workspaces,
`Alt+1–9` screensets, the four `Build/Look/Show/Present` mode tabs. Those are
the §5.1 pro layer and they are Phase 4. **KILL, permanently: free-floating MDI
windows** (vision §5.1).

### 3.3 Simple vs pro

- **Simple:** splitters and tabs, nothing to configure, nothing to learn. Defaults
  chosen so a first run looks deliberate.
- **Pro:** keyboard focus of the editor pane, double-click-to-reset, and the
  layout exposed over MCP (see below) so a workspace can be scripted.

### 3.4 Acceptance criteria

Put the layout logic in a **headless layout model** (`src/views/shell/layout.model.js`
or similar) so these are unit tests, not component tests. See §7 on the test-harness
dependency.

- **AC-15** Dragging splitter *X* by *n* px changes the two adjacent regions'
  sizes by *+n* / *−n* and leaves total width/height invariant (±1 px).
- **AC-16** No region can be dragged below its declared minimum; the drag clamps
  rather than jumping.
- **AC-17** Collapsing a region returns its space to its neighbour and restores
  the exact previous size on expand.
- **AC-18** The editor pane renders exactly one editor; switching tabs does not
  change the pane's size.
- **AC-19** `scrollWidth <= clientWidth` for the editor pane at a 1280 px
  viewport — the direct regression test for ux-audit #1.
- **AC-20** Layout round-trips through `.asls`; a showfile with no `workspace`
  key loads at defaults with no error.
- **AC-21** Restoring a saved layout whose total exceeds the current viewport
  (smaller monitor) rescales proportionally instead of pushing content
  off-screen.

### 3.5 MCP surface

| Command | Args |
| --- | --- |
| `get_workspace` | — → region tree with sizes, collapsed flags, active tab |
| `set_workspace` | `layout` (whole tree) |
| `set_panel` | `region`, `size?`, `collapsed?` |
| `set_editor_tab` | `tab` |

Why this is not gold-plating: **`screenshot_visualizer` is only reproducible if
the layout is deterministic.** Letting Claude set the workspace before it takes a
picture is what makes visual verification (and every future regression
screenshot) trustworthy. It is also how an agent runs the
[`verification.md`](verification.md) checklist without a human.

---

## 4. P2-3 — Timeline v1 (show arrange surface)

**Rank: MUST. Build: crisp, largest item in the phase. Effort: 2.5 agent-weeks.**
Vision §4.1 · issue #2 · ux-audit #4 (Blocker), #26, #28.

### 4.1 User story

> I can see my whole show at once. Each group is a row. The things it plays are
> blocks I can drag left and right, stretch, and copy. There's a playhead I can
> drag to hear— to *see* — any moment. When I want the chorus to last eight bars
> instead of four, I pull the edge of the block.

### 4.2 Scope

- **Tracks = groups**, generated from `GroupPool` (not hand-created). One row per
  group, in group order, with the group's colour.
- **Regions = chases and cues** placed at a start time. This requires one
  additive field, `startTime`, on chase and cue — the model already has
  `duration`, `barLength`, `durationMSec` and a quantize concept, so the maths
  exists.
- **Interactions, all of them:** drag body to move, drag edge to resize,
  `Alt`-drag to copy, `Del` to remove, marquee-select, multi-drag. Fixing
  ux-audit #4 (clips resize but do not move) is the single most-quoted item.
- **Playhead** that scrubs, snaps, and is bound to the P2-1 transport: dragging
  it while playing is a seek; `Space` freezes it in place.
- **Cycle/loop region**, `C` to toggle (Logic idiom).
- **Ruler** in bars.beats **counting from 1** (`1.1 1.2 1.3 1.4 2.1…`) with a
  seconds toggle. ux-audit #26: the current `1.0 1.1 1.2 1.3` will make a
  musician mis-place cues.
- **Snap selector**: off / beat / bar / second. **Zoom**: fit, and
  `Ctrl`-scroll.
- **Units on every timing field** in this surface (ux-audit #10) and real
  overflow copy where the duration-overflow overlay currently renders silently
  (ux-audit #28).

**Not in v1:** automation lanes, per-fixture drill-down, curve editing, audio
track, markers, looks-as-regions (looks don't exist yet), the cue-stack
presentation.

**State it in the spec so it is not built twice** (vision §4.1): the timeline and
the future cue stack are two views of one model — a cue stack is a timeline whose
regions are butted end-to-end and advanced by GO instead of by a clock. The
Phase 2 region model must not encode "advanced by clock" as an assumption.

### 4.3 Simple vs pro

- **Simple:** one visible track per group, blocks with names and colours, drag
  and stretch, playhead, snap on by default at `bar`. No lanes, no drill-down,
  no disclosure triangles opened.
- **Pro:** multi-select and nudge by keyboard, numeric start/length entry on the
  selected region, snap override with a held modifier, zoom-to-selection, and the
  disclosure triangle that will later reveal automation lanes (ship the triangle
  disabled with a "coming in Phase 3" tooltip, or ship no triangle — do not ship
  a triangle that opens an empty panel).

### 4.4 Acceptance criteria

Again: put px↔time mapping, snapping and drag resolution in a **headless timeline
geometry module**; these become unit tests.

- **AC-22** `timeToPx(pxToTime(x)) === x` for all x in range at every zoom level
  (±0.5 px).
- **AC-23** With snap = `bar` at 120 BPM (bar = 2000 ms), dropping a region at
  3100 ms lands at 4000 ms; at 2900 ms lands at 2000 ms.
- **AC-24** Dragging a region body by +*n* px moves `startTime` by
  `pxToTime(n)` and leaves `duration` unchanged. **This is the ux-audit #4
  regression test — write it first.**
- **AC-25** Dragging the right edge changes `duration` only; the left edge
  changes `startTime` and `duration` such that the end time is invariant.
- **AC-26** Regions cannot be dragged to a negative start time (clamps at 0).
- **AC-27** `Alt`-drag produces a new region with a new id and identical
  content; the original is unmoved.
- **AC-28** Ruler labels for bar 1 at 120 BPM are exactly `1.1, 1.2, 1.3, 1.4,
  2.1`.
- **AC-29** Moving the playhead to time *t* and pressing GO starts playback such
  that a region whose `[start, start+duration)` contains *t* is running within
  one tick, at the correct internal offset (not from its own bar one).
- **AC-30** A cycle region loops: with cycle `[2000, 6000]`, the playhead at
  5999 + one tick is inside the cycle, not past it.
- **AC-31** Every timeline mutation (move/resize/copy/delete) is exactly one
  undo step and `Ctrl+Z` restores the prior `startTime`/`duration`.
- **AC-32** Old showfiles: chases with no `startTime` load laid out end-to-end in
  their existing pool order (deterministic, documented), not stacked at 0.

### 4.5 MCP surface

| Command | Args |
| --- | --- |
| `get_timeline` | — → `{ tracks: [{ groupId, name, regions: [{ id, type, refId, startMs, durationMs }] }], playheadMs, cycle, snap, bpm }` |
| `timeline_add_region` | `group_id`, `chase_id \| cue_id`, `start_ms \| start_bar` |
| `timeline_move_region` | `region_id`, `start_ms \| start_bar` |
| `timeline_resize_region` | `region_id`, `duration_ms \| duration_bars` |
| `timeline_duplicate_region` | `region_id`, `start_ms` |
| `timeline_delete_region` | `region_id` |
| `timeline_set_playhead` | `ms \| bar` |
| `timeline_set_cycle` | `start_ms`, `end_ms`, `enabled` |
| `timeline_set_snap` | `off \| beat \| bar \| second` |

This is the command set that makes "Claude, lay the show out against this
running order" possible, and it is the first place the co-designer story pays
real rent: arranging fifteen regions is exactly the tedious-with-a-verifiable-
answer work vision §9 says to give the AI.

---

## 5. P2-4 — Data-rich fixture records

**Rank: MUST. Build: crisp. Effort: 0.5 agent-weeks.**
Vision §6.11 / §12.2 #1 · ux-audit #12.

### 5.1 User story

> Every light has a name I chose and a plain sentence saying what it's for —
> "key light on the lectern". I stop reading `U0 - CH28` and doing address
> arithmetic to work out which one is stage left.

### 5.2 Scope

Add one optional metadata object to `Fixture`, serialised as an additive `.asls`
key:

`name` · `unitNumber` · `purpose` · `positionName` (a free-text string in
Phase 2 — it becomes a real reference when hang positions land) · `circuit` ·
`colorNote` · `goboNote` · `notes` · `weightKg` · `powerW`.

Surface it in exactly two places in Phase 2: the patch list shows
`{unitNumber}: {name}` instead of the profile name, and the fixture inspector
gains `name` + `purpose`. That is all the UI this feature gets — the spreadsheet
view (§12.1) and every report is Phase 3.

Seed `weightKg` / `powerW` from OFL where present, leave null where not, and
**never invent a number** — a null that says "unknown" is worth more than a
guess that ends up in a power summary.

### 5.3 Simple vs pro

- **Simple:** two fields — `name` and `purpose`, in plain words. Purpose is also
  what lets a future "check my show" reason about *intent*, which is worth far
  more than its cost.
- **Pro:** the full record, bulk edit deferred to Phase 3.

### 5.4 Acceptance criteria

- **AC-33** A fixture with no metadata serialises no `meta` key and round-trips
  byte-identically to a pre-Phase-2 showfile.
- **AC-34** A fixture with metadata round-trips every field through
  save → load.
- **AC-35** Loading a pre-Phase-2 showfile yields `meta` defaults with a
  `name` derived from the profile and a `unitNumber` assigned by patch order
  (stable and deterministic), so no fixture is ever nameless.
- **AC-36** `unitNumber` uniqueness is validated per show; a collision is
  reported, not silently renumbered.
- **AC-37** Unknown/absent OFL weight and power produce `null`, never `0`.

### 5.5 MCP surface

| Command | Args |
| --- | --- |
| `set_fixture_meta` | `fixture_id`, any subset of the fields |
| `list_fixtures` | `sort_by?`, `filter?` → the tabular read model (id, unit, name, purpose, manufacturer/model, universe, address, footprint, position, weight, power) |

`get_fixture` gains `meta`. `list_fixtures` is deliberately shaped like a
report row now, so Phase 3's instrument schedule is a formatter over an existing
command rather than a new query.

---

## 6. P2-5 — Keyboard router seed and the `Ctrl+Z` reclaim

**Rank: MUST (rider). Build: crisp. Effort: 0.5 agent-weeks.** Vision §8.2–§8.3.

Not a feature — a tax that must be paid now because Phase 2 adds `Space`,
`Ctrl+Space`, `Shift+Space`, `\`, `C`, `Del` and `Ctrl+Z` to an app that already
has five uncoordinated `window` keydown listeners.

- Introduce the single additive keyboard router **alongside** the existing
  listeners; migrate only what Phase 2 needs. No big-bang refactor.
- **`Ctrl+Z` becomes undo, `Ctrl+Shift+Z` / `Ctrl+Y` redo.** Gizmo commit moves
  to `Enter` (it already happens implicitly on mouse-up). This is an upstream
  edit to `plugins/visualizer/controls.js` — log it in `upstream-diff.md` and
  pay the merge debt; leaving the most sacred shortcut in computing bound to
  "apply transform" while shipping a drag-based timeline is not defensible.
- **Camera pan moves from bare arrows to `Alt`+arrows** by setting
  OrbitControls' `.keys` from our own init code — **no upstream edit needed**,
  which is why this one is cheap.
- Bindings shipped: `Space` (freeze/continue), `Ctrl+Space` (release all),
  `Shift+Space` (release selected), `\` (blackout), `C` (cycle), `Del`
  (delete in context), `Ctrl+Z`/`Ctrl+Shift+Z`.
- Text-entry context wins over everything. `uikit.input.textbox.*` already use
  `@keydown.stop` — preserve that hygiene, and assert it.

**AC-38** With focus in a text input, none of the above bindings fire.
**AC-39** Every Phase 2 mutation — transport option change, region move, panel
resize, metadata edit — is exactly one undo step with a human-readable label.
**AC-40** `get_keymap` (MCP) returns the binding registry, and the `?` sheet is
generated from it rather than hand-written.

---

## 7. Sequencing, the cut line, and risks

### 7.1 Order

1. **Week 1–2 — P2-1 model layer.** `ReleaseEnvelope`, pause/resume state
   preservation, `master.cueRow` overlap, defaults, AC-1..AC-14. Pure model, no
   UI, fully testable today with the existing harness. **This is the highest-value
   and lowest-risk work in the phase — start here and do not let UI work start
   until AC-1..AC-8 are green.**
2. **Week 2 — P2-4** in parallel (different files, half a week, unblocks Phase 3).
3. **Week 3 — P2-2 shell** + **P2-5 router**, and the toolbar transport cluster
   lands on top of the now-green model.
4. **Week 4–6 — P2-3 timeline** in the pane the shell just created.
5. **Week 7 — verification**, [`verification.md`](verification.md) run, demo-show
   pass, `upstream-diff.md` reconciliation.

### 7.2 The cut line — decide it now, not in week 6

If at the end of **week 4** P2-1 and P2-2 are not both verified done, **P2-3
drops to Phase 3 in its entirety** — not partially. A half-built timeline is
worse than the current one, because the current one at least does not promise
drag. De-scope order within P2-3 if it is close: cycle region → `Alt`-drag copy →
seconds ruler → marquee select. **Never** cut region *dragging* (AC-24); that is
the whole feature.

### 7.3 Risks, ranked

1. **There is no output arbitration layer, and "release" implies one.** Vision
   §3.2 says a release should fade "to whatever the next-priority source says".
   In this codebase there is no mixing stage: `Live` iterates `animations` and
   the last write per tick wins. Phase 2 therefore ships the pragmatic version —
   *a playback releases its own contribution toward zero* — and gets ordering
   right by **moving releasing playbacks to the front of `Live.animations` so
   still-running playbacks write last and win**. That is crisp and testable
   (AC-5, AC-8). The risk is that it looks perfect in a one-playback demo and
   frays the moment two playbacks share fixtures, which is precisely what the
   shipped demo show does. **Mitigation: write AC-5 and AC-8 against a
   two-playback overlap on day one, before any UI exists.** A real HTP/LTP
   arbitration stage is a rewrite of the write path and would eat the entire
   phase — explicitly out, explicitly logged as the Phase 3/4 decision it is.
2. **No Vue component test harness exists** (`CLAUDE.md` §5: no
   `@vue/test-utils`, no testing-library). Two of the three headline items are
   UI. **Mitigation and standing instruction: all layout and timeline *logic*
   goes in headless modules with unit tests (AC-15..AC-32 are written to be
   satisfiable that way); the SFCs stay thin.** Installing a component harness is
   an `Ask First` dependency decision — raise it, don't drive-by it.
3. **Upstream merge debt.** P2-1 touches `cue.model.js`, `chase.model.js`,
   `master.model.js`, `group.model.js`; P2-5 touches `controls.js`; P2-2 touches
   the app activity and the modifier fragments. That is the largest upstream
   surface any phase has taken. Every one goes in `upstream-diff.md` in the same
   change (the Stop hook enforces it), and every one should first be interrogated
   for an additive alternative.
4. **Scope creep from the timeline into looks/palettes.** The moment someone says
   "a region should be a *look*", the phase doubles. Regions reference existing
   chases and cues. Full stop.
5. **Phase 2 produces no new pretty screenshot.** Manage the expectation up
   front, and open Phase 3 with venue + drape + bloom.

---

## 8. Open questions for Jake

Five, and only ones whose answers change what gets built.

1. **Does the playhead run the show, or edit it?** Two different products.
   (a) *Linear*: the timeline is the show — one playhead drives everything, like
   Logic. (b) *Editor*: the timeline arranges chases that are still fired
   independently by hand, and the playhead is a rehearsal tool. **My assumption
   is (b) for Phase 2** — it is additive over the existing model and does not
   force a show-level clock — but (a) is what "put my show together against the
   track" eventually means, and choosing it now changes the region model.
2. **When you press the toolbar's Freeze with nothing selected, what should
   freeze — the whole show, or the last thing you touched?** Global is safer and
   matches `Live`'s existing pause; last-touched is what a console operator
   expects. Whichever you pick becomes the meaning of `Space`, and it is hard to
   change later without retraining you.
3. **Should Blackout kill real DMX output too, or only the preview?** For a
   previz-first tool "blackout the picture" is arguably right; for anyone with a
   gateway plugged in, a blackout button that doesn't black out the actual rig is
   dangerous. My default: **both**, always, no setting.
4. **Bottom pane: one editor at a time behind tabs (Logic), or several
   collapsible panels stacked in a rail (Lightroom)?** I have specified tabs
   because it structurally kills the 3318 px overflow. The rail keeps more
   visible at once if you'd rather see the colour picker and the channels
   together. This changes the shell build, not just its skin.
5. **The trade, if week 4 goes badly:** would you rather have (a) transport +
   shell + timeline and nothing visual, or (b) transport + shell + **venue
   templates and drape** — a room, black legs, and renders that suddenly look
   like a show — with the timeline slipping a phase? I have specified (a) and I
   stand behind it, but (b) is the version that gives you something to show a
   client at the end of Phase 2, and you are the one who has to show clients
   things.
