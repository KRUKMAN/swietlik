# Świetlik — Phase 2 scope draft (input to the spec)

> Author: lighting design & production consultancy pass, 2026-09-10.
> Revised 2026-09-10 to add **§7 MIDI play** (GitHub issue #7).
> Status: **scope proposal, not approved scope.** This is the input the Phase 2
> spec is written from. It supersedes [`roadmap.md`](roadmap.md)'s Phase 2
> ("stage builder") on sequencing only — the stage builder is not cancelled, it
> is moved. Ranks and vocabulary follow [`product-vision.md`](product-vision.md) §0.
>
> Sources this document is accountable to: `product-vision.md` §2 (owner
> findings), §3 (playback feel), §4 (programming surface), §5 (shell), §6 (stage
> builder), §12 (Spotlight benchmark); [`ux-audit.md`](ux-audit.md) §4 ranked
> issues; [`code-review-2026-09-09.md`](code-review-2026-09-09.md) §3
> (stop-semantics root cause); GitHub issues #2, #3 and #7.

---

## 0. The cut, in one sentence

**Phase 2 makes the app an instrument you can operate — and, if the stretch
lands, an instrument you can literally play: real transport semantics (Pause
holds · Release fades · Blackout cuts, with resume-from-position), a workspace
whose panels you can actually size, a timeline whose regions you can actually
drag, the one-day fixture-metadata record that unblocks every document Phase 3
will generate, and a MIDI keyboard wired to the transport verbs — and it builds
no venue geometry at all.**

### IN — ranked, with effort

| # | Feature | Rank | Agent-weeks | Why it's in |
| --- | --- | --- | --- | --- |
| **P2-1** | **Transport & release semantics** (§3 of the vision) | MUST | 2.0 | Issue #2. Jake's own words are the product spec. Nothing else in the app is worth using until stopping something stops feeling like a crash. |
| **P2-2** | **Workspace layout shell v1** (splitters, collapse, one tabbed editor pane, persisted sizes) | MUST | 1.5 | Issue #3, and ux-audit #1/#8 — the two ranked *Blockers* that are pure geometry. Also the physical prerequisite for P2-3: a timeline in a fixed 60 px lane is not a timeline. |
| **P2-3** | **Timeline v1 — show arrange surface** (tracks = groups, regions = chases/cues, drag/resize/snap/playhead/cycle) | MUST | 2.5 | Issue #2's serious half: there is no front door to the automation the demo performs. ux-audit #4 (clips resize but cannot move) is a false affordance sitting on the exact surface we need. |
| **P2-4** | **Data-rich fixture records** (§12.2 #1) | MUST | 0.5 | The cheapest unblocking item in the whole vision, and it independently kills ux-audit #12 ("all 16 fixtures are called MAC Aura"). Nothing in Phase 3's paperwork can start without it. |
| **P2-5** | **Keyboard router seed + `Ctrl+Z` reclaim** (rider on P2-1/P2-2) | MUST | 0.5 | Transport needs `Space`; timeline drags need undo; the app already has five uncoordinated `window` keydown listeners and `Ctrl+Z` bound to "apply gizmo transform". Adding a sixth listener in Phase 2 is how this becomes unfixable. |
| **P2-6** | **MIDI play v1** (issue #7 — notes → transport verbs, velocity → level, sustain → latch, learn) | **STRONG, stretch** | 1.0 | On-thesis: a note-on *is* GO and a note-off *is* Release, so this is a thin adapter over P2-1 rather than a new subsystem. It is also the only item in the phase that produces a **demoable** win, which is the phase's stated weakness. Ruling and trade in §7.1. |

**Total: 8.0 agent-weeks** (7.0 without P2-6) — the top of the 4–8 week window,
with zero slack. Cut line and de-scope order in §8.2.

### OUT — with the reason each one loses

| Feature | Verdict | Reason |
| --- | --- | --- |
| **(e) Venue templates + drape** | **OUT — first item of Phase 3** | It hurts, because vision §6.1 calls it "the single highest-leverage item in Phase 2". It still is — of the *stage builder*. But its payoff is render believability, and render believability is Phase 3's job (bloom, exposure, haze). A ballroom lit by today's beam shader is a nicer diagram, not a sellable render. Ship venue + drape as the opening move of Phase 3 where it compounds with §10.1–10.4 instead of standing alone. |
| **(f) Truss + hang positions** | **OUT — Phase 3** | My own ruling (§6.1) is templates before truss, and (e) is out. Beyond ordering: hang positions are *the* data-model decision of the stage builder (§6.2) — parent transforms, world-matrix composition, `InstancedMesh` slot updates at ~200 fixtures. That deserves its own brainstorm → spec → plan and one throwaway spike, not the tail end of a phase already carrying four surfaces. |
| **(g) Drag-drop placement + auto-patch/auto-number** | **OUT — Phase 3, after (f)** | It is defined as *drop onto a truss*. With no truss and no positions it degrades to "drag a light around a void", which is ux-audit #18 (make the visualizer clickable) wearing a costume — a real want, but a different feature with a different spec. Auto-numbering also depends on P2-4's `unitNumber` field existing, which is exactly why P2-4 is in. |
| Presets / palettes (§7.3), looks (§7.5) | OUT | The timeline wants to hold *looks*; in Phase 2 it holds chases and cues instead. Palettes-as-references is a data-model commitment (vision §7.3) that must not be rushed in behind a UI deadline. |
| Automation lanes under tracks (§4.1) | OUT | The single largest sub-feature of the timeline. v1 ships regions only. Lanes are additive on top and are Phase 3/4. |
| Audio timeline / tempo map (§11.9) | OUT | Needs Web Audio, beat detection, and a tempo-map model. Phase 3. The timeline ruler must be *built* to accept one. |
| MIDI clock sync, MIDI output/LED feedback, busk-recording into the timeline | OUT — see §7.5 | The three things everyone will ask for the day after P2-6 ships. All three are named, ranked and deferred there so they are not smuggled in. |
| Busking grid, cue stack rework (§7.7) | OUT | Same model, third presentation. Not until looks exist. **Note:** P2-6 makes the *existing* grid the busking surface by giving it a physical controller, which buys most of the value without the rework. |
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
   the effects engine (vision §7.6) is Phase 4.
6. **No output-arbitration rewrite.** See §8.3 risk 1 — this is the phase's
   sharpest boundary and its biggest risk.
7. **No MIDI clock, no MIDI out, no SysEx, no MIDI-to-DMX passthrough.** §7.5.
8. **No Electron, no router change, no `.asls` breaking change.** Everything
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

**2. These items are one story; venue geometry is a different one.** A coherent
phase should be summarisable in a sentence an outsider believes. "Świetlik
became operable" is one. "Świetlik became operable and also got a ballroom" is
two phases sharing a branch. Ship one story, ship it whole. Issue #7 arrived
*inside* that story rather than beside it, which is the strongest argument for
taking it now (§7.1).

**3. Dependency order is respected in both directions.** Records before
paperwork (P2-4 before Phase 3's schedules). Templates before truss — and since
templates are out, truss is out. Shell before timeline (P2-2 before P2-3),
because the ux-audit measured the current automation editor at 60 px inside a
fixed 239 px strip: building a great timeline into that hole is building it
twice. Transport before MIDI (P2-1 before P2-6), because a MIDI note-off with no
release envelope behind it is just the existing cut-to-black with a nicer trigger.

The one genuine loss: without P2-6, Phase 2 produces **no new screenshot a client
would care about**. Everything else here is felt, not seen. That is the correct
trade — but it is exactly why the MIDI stretch is worth its week (§7.1) and why
Phase 3 must open with venue + drape + bloom.

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
  in this section is defaults the simple layer never mentions. It is also the
  control that does the musical work under a MIDI note-off (§7.2).
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
or similar) so these are unit tests, not component tests. See §8.3 on the
test-harness dependency.

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
> drag to see any moment. When I want the chorus to last eight bars instead of
> four, I pull the edge of the block.

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
presentation, recording a MIDI busk into regions (§7.5).

**State it in the spec so it is not built twice** (vision §4.1): the timeline and
the future cue stack are two views of one model — a cue stack is a timeline whose
regions are butted end-to-end and advanced by GO instead of by a clock. The
Phase 2 region model must not encode "advanced by clock" as an assumption; that
constraint is also what makes §7.5's busk-recording possible later.

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
view (vision §12.1) and every report is Phase 3.

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
(Exception, deliberate: live MIDI performance — see AC-57.)
**AC-40** `get_keymap` (MCP) returns the binding registry, and the `?` sheet is
generated from it rather than hand-written.

---

## 7. P2-6 — MIDI play v1 (issue #7)

**Rank: STRONG, stretch. Build: crisp. Effort: 1.0 agent-weeks.**
New owner requirement, 2026-09-10: *"it should support using a MIDI keyboard to
'play' the lights."*

### 7.1 Ruling on placement — take it now, at a stated price

**It belongs in Phase 2, as a ranked stretch item taken only after P2-1 and P2-2
are verified done.** Four reasons, then the honest cost.

1. **It is the same thesis, not an adjacent one.** Phase 2's sentence is "make
   the app an instrument you can operate". A MIDI keyboard is the literal reading
   of that sentence, and the mapping is close to 1:1 with the verbs specified two
   sections ago: **note-on = GO, note-off = Release, and the release slider does
   the musical work.** Velocity is an intensity scalar. Sustain is the
   flash-vs-latch primitive every busking console has. There is nothing to invent.
2. **It is a thin adapter, not a subsystem** — *provided* it dispatches into the
   existing command registry (§7.4). Web MIDI gives events; the adapter turns an
   event into a command name plus args and calls the same bus MCP calls. If it
   ever grows its own control path into the models, it has become a subsystem and
   the estimate is wrong.
3. **It is the only demoable thing in the phase.** Risk 5 said Phase 2 produces
   no screenshot a client cares about. MIDI play produces something better than a
   screenshot: Jake at a party, playing the lights off a keyboard, filmed on a
   phone. It is also the most convincing possible *proof* that the P2-1 work is
   real — a note-off that cuts to black is instantly, publicly obvious.
4. **Deferring it costs more than taking it.** Built later, it lands on top of a
   busking grid, looks, and palettes that do not exist yet, and someone will
   redesign the mapping around them. Built now against cues/chases/groups, the
   mapping is *targets in the command registry* and survives all three.

**The honest cost.** The phase was 7.0 agent-weeks in a 4–8 week window. This
makes it **8.0 — the top of the window, no slack.** If something must give, in
this order:

1. **P2-3's stretch interactions go first** — cycle region, `Alt`-drag copy,
   seconds ruler, marquee select (≈0.5 week). This is already the stated
   de-scope order and it does not damage the feature.
2. **P2-4's inspector UI slips to Phase 3** (≈0.2 week); the data model and the
   MCP commands stay, because they are the part Phase 3 needs.
3. **If more must give, P2-3 drops whole and P2-6 stays.** I want that ruling on
   the record, because it inverts what I wrote yesterday. *Transport + shell +
   MIDI* is a coherent, demonstrable, shippable phase — "an instrument you can
   play". *Transport + shell + a timeline missing its drag* is not a phase, it is
   a regression with extra steps. The timeline is a MUST; it is not a MUST *this
   phase* if the phase would ship it broken.
4. **What must never give:** P2-1's AC-1..AC-8. MIDI without release semantics is
   issue #2 with a nicer trigger, and it would make the problem *more* visible,
   not less.

**Not a Phase 3 item.** The only argument for deferring is calendar, and the
answer to calendar is the de-scope ladder above, not a phase boundary.

### 7.2 The v1 interaction, defended to both audiences

**To a working LD:** this is a flash/latch playback surface with a release time —
the Avolites/MagicQ busking primitive, on a controller that happens to have
velocity. Nothing here is novel and nothing here is wrong.
**To Jake at a party:** you hold a key, lights happen; you let go, they fade; you
hit it harder, it's brighter.

**The out-of-the-box map, in one sentence Jake can remember:**
*Split at middle C — below it the keys bump your groups, above it the keys fire
your playback slots, hold the sustain pedal to latch instead of flash, and the
mod wheel bends the speed of everything that's running.*

| Control | Default binding | Semantics |
| --- | --- | --- |
| **Notes 48–59** (C3–B3, below the split) | Groups 1–12 in group order | **Bump.** Note-on brings the group to `velocity%` intensity immediately (never quantized — this is a live gesture). Note-off releases it over the group release time. Works on a brand-new show that contains nothing but groups, which is the whole point: zero programming required to make it fun. |
| **Notes 60+** (C4 and up, above the split) | Playback slots 1..N — the cue/chase grid in the order it reads on screen (left-to-right, top-to-bottom) | **Flash.** Note-on = `transport_go` on that slot; note-off = `transport_release`. Honours that playback's quantize if set (arms and pulses — the one-frame rule applies identically to a key and a mouse click). |
| **Sustain pedal (CC64)** | Latch modifier | ≥64 = held. Notes released while the pedal is down are *collected* and released together on pedal-up, exactly like a piano damper. This is flash-vs-latch expressed in an idiom a keyboard player already owns, and it is the best single idea in this section. |
| **Velocity** | Intensity scalar, 0–127 → 0–100% of the playback's programmed level | Scales output; **never rewrites programmed values.** A "velocity sensitivity: off" toggle forces 100% — cheap keybeds and non-players both need it, and a client demo should not fail because someone tapped a key gently. |
| **Mod wheel (CC1)** | Global rate/size master | Vision §3.5's busking move: one continuous control scales every running effect. The mod wheel is the one continuous controller every keyboard has, and "wobble the effects with the wheel" is what "play the lights" means to a musician. |
| **CC7** | Grand master intensity | Most controllers send CC7 from their fader. |
| **Pitch bend** | Momentary master dip; springs back to unity | The wheel is spring-loaded, so it must only ever drive something that *should* return. Bend down to duck the stage on a breakdown, release, it comes back. **Rule: never bind a spring-return control to a value that must persist.** |
| **Program change** | Slot page up / down | Standard, free. |
| **Transport verbs (Freeze / Release all / Blackout)** | **Unmapped by default** | Deliberate. A mis-hit blackout in front of a client is unrecoverable embarrassment; blackout in particular must be a decision, not an accident. All three are the first things offered in Learn, and binding Blackout asks once for confirmation. |
| **Tap tempo** | Unmapped, learnable | Five lines, since `set_bpm`/tap already exist. This is the sanctioned alternative to MIDI clock (§7.5). |
| **Pads** | Land in the note map like any other note, plus a one-click **"MPC pads" preset** remapping notes 36–51 → slots 1–16 | No device sniffing, no per-vendor dialects. One preset covers the common Akai/Novation layout; everything else is Learn. |

**MIDI Learn flow** — steal Ableton's, unchanged, because it is the one every
musician already knows:

1. Click **MIDI Learn** (one toggle, in the MIDI panel and in the toolbar).
2. Every mappable target in the UI gets a dashed outline. This is also, usefully,
   a map of what the app can do.
3. Click a target → it highlights → **touch the physical control** (press the
   key, move the wheel) → bound. The target now wears a chip reading `C4` or
   `CC1·ch1`. Click the chip to clear.
4. **Range learn:** click the first grid slot, then play a run of keys — they
   bind sequentially. Twenty bindings in one gesture; this is the fanning move,
   and it is what stops Learn being tedious.
5. Exit Learn. Bindings are live immediately.

Binding a control that is already bound **moves** it and tells you what it took
it from. Silent double-binding is how a busk goes wrong at 1 a.m.

**Storage:** additive `.asls` key `midiMap` (per show), plus export/import as a
small standalone JSON. Jake takes the same keyboard to every gig; he should not
re-learn it per showfile, and a file he can carry is the SaaS-safe answer (no new
filesystem assumptions, per the roadmap's product goals).

### 7.3 Simple vs pro

- **Simple:** plug the keyboard in, a toast says *"Launchkey 49 connected — play
  the keys below middle C to bump your groups."* No panel, no setup, no
  vocabulary. Velocity sensitivity on. That is the entire simple layer, and it is
  a working product for a party.
- **Pro:** the MIDI panel — device selector, channel filter, split-point control,
  velocity curve (linear / soft / hard / fixed), per-binding release-time
  override, Learn, range-learn, map export/import, and a live **MIDI monitor**
  (last 20 messages, decoded). The monitor exists because every MIDI support
  question in history is answered by "what is it actually sending", and it costs
  an afternoon.

### 7.4 Architecture — the constraint that keeps this at one week

**The adapter dispatches into the existing command registry — the same bus MCP
uses — and nowhere else.** Proposed additive layout: `src/midi/` with
`midi.adapter.js` (Web MIDI access, device lifecycle), `midi.map.js` (bindings,
pure), `midi.dispatch.js` (event → command name + args, pure). Zero upstream
edits; one hook in `App.vue` alongside the existing MCP bridge hook.

Consequences, all good:

- Tests fake MIDI events as plain objects (`{ data: [0x90, 60, 100] }`) and spy
  on the registry. **No hardware, no Web MIDI, no jsdom shim needed.**
- Everything a MIDI key can do, Claude can do, and vice versa — the vision §1
  corollary holds by construction rather than by discipline.
- `simulate_midi` (§7.6) lets the verification checklist and any agent exercise
  the whole feature headlessly.

**Browser reality, verified:** Web MIDI is on by default in Chrome, Edge, Opera
and Samsung Internet; Firefox 108+ supports it but requires a one-time site
permission add-on; **Safari does not support it at all** (WebKit has declined it
over device-fingerprinting concerns), so iPhone/iPad Safari is out. Chrome now
prompts for permission even without SysEx. Request access with `sysex: false`,
and treat "no Web MIDI" and "permission denied" as first-class UI states with
plain-language copy, not console errors. Also expect that on Windows a port held
by another application (a DAW) may fail to open — surface that as a named error,
not a silent no-op.

### 7.5 What v1 explicitly does NOT do

| Not doing | Ruling |
| --- | --- |
| **MIDI clock / MTC / MMC sync** | **KILL for v1.** Tempting ("take BPM from the DJ") and a genuine rabbit hole: clock jitter, drift correction, start/stop/continue semantics — and vision §7.2 already dropped timecode as a different product. The sanctioned 95% answer is a **learnable tap-tempo target**: tap a key four times, BPM locks. Revisit clock only after a real gig asks. |
| **MIDI output / LED feedback** | **KILL for v1**, and therefore: do not advertise grid controllers. A Launchpad with unlit pads is a worse experience than no Launchpad, so v1 targets *keyboards*. Feedback needs per-vendor SysEx dialects; it is the obvious v2 and should be scoped as its own item. |
| **SysEx, NRPN, 14-bit CC pairs, MPE, MIDI 2.0** | **KILL.** YAGNI. 14-bit CC arrives as two independent 7-bit CCs and is documented as such (AC-56), not "handled". |
| **MIDI → DMX channel passthrough** | **KILL.** The hobbyist request ("note 60 sets channel 12"). Wrong granularity, unmusical results, and it bypasses every abstraction the product is built on. Groups and playbacks are the correct unit. |
| **Note-to-colour mapping** ("C is red, D is orange"; chords make colour chords) | **KILL, named so nobody re-proposes it.** It is a toy, it is unbounded, and it produces looks no designer would choose. |
| **Recording a MIDI busk into timeline regions** | **Deferred to Phase 3 — and it is the prize.** "Busk it, then keep it" is genuinely excellent and the natural marriage of P2-3 and P2-6. It needs a show clock and a record model, which is exactly the decision in open question 1. Do not sneak it in; do keep the region model free of clock assumptions (§4.2) so it stays possible. |
| **Multiple simultaneous controllers, per-device profiles** | Out. One active input device in v1, selectable. |
| **OSC, hardware consoles, DMX-in** | Out — vision §11.1, post-v1, different feature. |

### 7.6 Acceptance criteria

All model-layer. MIDI events are plain objects; assertions are made against the
command registry, so no hardware and no Web MIDI implementation is required.

- **AC-41 Note-on fires GO.** A note-on on a bound slot dispatches exactly one
  `transport_go` for that slot, synchronously, in the same turn — no timer, no
  `await`.
- **AC-42 Note-off releases.** The matching note-off dispatches exactly one
  `transport_release` with the target's `releaseMs` (default 2000). Re-pressing
  the same key applies the target's restart mode.
- **AC-43 Velocity-0 note-on is a note-off.** `[0x90, 60, 0]` must behave
  identically to `[0x80, 60, 64]`. (Running-status convention; a naive
  implementation gets this wrong and leaves lights stuck on.)
- **AC-44 Velocity scales.** With sensitivity on: velocity 127 → 100%, 64 → 50%
  ±1%, 1 → 1% ±1%. The playback's stored programmed values are unchanged after
  the gesture.
- **AC-45 Sensitivity off.** Any velocity yields 100%.
- **AC-46 Sustain latches.** With CC64 ≥ 64 held, note-offs dispatch nothing; on
  CC64 < 64 every note released during the hold is released in one batch, and
  notes still physically held are not.
- **AC-47 Spring-return returns.** Pitch bend to 0x2000 (centre) restores the
  master to unity within one dispatch turn, from any prior bend value.
- **AC-48 Continuous controls are never quantized.** CC1 and CC7 changes apply on
  the turn they arrive, regardless of any quantize setting (mirrors AC-12).
- **AC-49 Default map.** With no `midiMap` present: notes 48–59 resolve to groups
  1–12 in group order; notes 60+ resolve to playback slots in grid order;
  unmapped notes dispatch nothing and log nothing (a 61-key controller must not
  spam the console).
- **AC-50 Learn binds on press, not release.** While learning target T, the next
  note-on or CC binds; a note-off does not. Binding a control that is already
  bound moves it and reports the displaced target.
- **AC-51 Range learn.** Learning from slot *k* and receiving *n* ascending
  note-ons binds slots *k..k+n−1* to those notes in order.
- **AC-52 One gesture, one command, same bus.** A registry spy sees exactly one
  command per MIDI gesture, with the same command name and argument shape an MCP
  call would produce. **This is the architectural invariant — assert it
  explicitly, in its own test.**
- **AC-53 Disconnect is safe.** Simulating a port disconnect while three notes
  are held releases all three over their release times. **No stuck lights, ever —
  this is the one that matters at a real party.**
- **AC-54 Panic messages.** CC123 (all notes off) and CC120 (all sound off)
  release everything MIDI is currently holding, and nothing it is not.
- **AC-55 Clock is ignored, not mishandled.** 0xF8 (clock), 0xFA/0xFB/0xFC
  (start/continue/stop), 0xFE (active sensing) and 0xF0 (SysEx) dispatch nothing
  and throw nothing. Active sensing arrives roughly three times a second; it must
  not appear in the monitor's default view or in the log.
- **AC-56 14-bit CC is two CCs.** MSB/LSB pairs produce two independent CC
  events; documented behaviour, not a bug.
- **AC-57 Performance is not undo.** MIDI note and CC gestures produce **no undo
  entries** (a three-minute busk would otherwise destroy the stack). **Binding
  changes made in Learn *are* one undo step each.** Explicit, deliberate
  exception to AC-39.
- **AC-58 Map round-trip.** `midiMap` round-trips through `.asls`; a showfile
  without it loads on the default map; export → import reproduces bindings
  exactly.
- **AC-59 No device, no drama.** With Web MIDI unavailable or permission denied,
  the app runs normally and the MIDI panel shows plain-language copy naming the
  cause. No unhandled rejection, no console error.

### 7.7 MCP surface

| Command | Args |
| --- | --- |
| `get_midi_devices` | — → available inputs, active input, permission/support state |
| `set_midi_device` | `device_id \| null` |
| `get_midi_map` | — → bindings, split point, velocity settings |
| `set_midi_binding` | `control` (`{ type: note\|cc\|bend\|pc, number, channel? }`), `target` (`{ command, args }`) |
| `clear_midi_binding` | `control \| target` |
| `midi_learn` | `state`, `target?` |
| `set_midi_options` | `velocity_sensitivity?`, `velocity_curve?`, `split_note?`, `channel_filter?` |
| **`simulate_midi`** | `bytes` (e.g. `[144, 60, 100]`) — injects an event as if from hardware |

`simulate_midi` is the load-bearing one. It makes the whole feature testable and
demonstrable **without a keyboard plugged in**, lets an agent drive the
[`verification.md`](verification.md) checklist for MIDI, and — not incidentally —
means Claude can play the lights too, which is the product's thesis taken to its
logical end. `get_show_state` gains a `midi` block;
`test/mcp/tool-parity.spec.js` updates in the same PR.

---

## 8. Sequencing, the cut line, and risks

### 8.1 Order

1. **Week 1–2 — P2-1 model layer.** `ReleaseEnvelope`, pause/resume state
   preservation, `master.cueRow` overlap, defaults, AC-1..AC-14. Pure model, no
   UI, fully testable today with the existing harness. **This is the highest-value
   and lowest-risk work in the phase — start here and do not let UI work start
   until AC-1..AC-8 are green.**
2. **Week 2 — P2-4** in parallel (different files, half a week, unblocks Phase 3).
3. **Week 3 — P2-2 shell** + **P2-5 router**, and the toolbar transport cluster
   lands on top of the now-green model.
4. **Week 4 — P2-6 MIDI play.** Deliberately placed *before* the timeline: it
   depends only on P2-1 plus a small panel, it is the phase's proof-of-life demo,
   and putting a stretch item after the largest item is how stretch items die.
   Its dispatch and map modules are pure, so it can also proceed in parallel with
   week 3 if a second agent is free.
5. **Week 5–7 — P2-3 timeline** in the pane the shell created.
6. **Week 8 — verification**, [`verification.md`](verification.md) run, demo-show
   pass, `upstream-diff.md` reconciliation.

### 8.2 The cut line — decide it now, not in week 7

If at the end of **week 4** P2-1, P2-2 and P2-6 are not all verified done, **P2-3
drops to Phase 3 in its entirety** — not partially. A half-built timeline is
worse than the current one, because the current one at least does not promise
drag. De-scope order within P2-3 if it is close: cycle region → `Alt`-drag copy →
seconds ruler → marquee select. **Never** cut region *dragging* (AC-24); that is
the whole feature.

Within P2-6, the de-scope order is: MIDI monitor → velocity curves → range-learn
→ pads preset. **Never** cut AC-53 (disconnect releases held notes) or AC-43
(velocity-0 note-on); both leave lights stuck on, which is the worst failure this
feature has.

### 8.3 Risks, ranked

1. **There is no output arbitration layer, and "release" implies one.** Vision
   §3.2 says a release should fade "to whatever the next-priority source says".
   In this codebase there is no mixing stage: `Live` iterates `animations` and
   the last write per tick wins. Phase 2 therefore ships the pragmatic version —
   *a playback releases its own contribution toward zero* — and gets ordering
   right by **moving releasing playbacks to the front of `Live.animations` so
   still-running playbacks write last and win**. That is crisp and testable
   (AC-5, AC-8). The risk is that it looks perfect in a one-playback demo and
   frays the moment two playbacks share fixtures, which is precisely what the
   shipped demo show does — **and MIDI play makes it far more likely, because
   holding a chord means four playbacks running at once by design.**
   **Mitigation: write AC-5 and AC-8 against a two-playback overlap on day one,
   before any UI exists, and add a four-note-chord case to the P2-6 test set.** A
   real HTP/LTP arbitration stage is a rewrite of the write path and would eat
   the entire phase — explicitly out, explicitly logged as the Phase 3/4 decision
   it is. **If chord-play looks wrong in week 4, that is the signal that
   arbitration has become Phase 3's headline item.**
2. **No Vue component test harness exists** (`CLAUDE.md` §5: no
   `@vue/test-utils`, no testing-library). Two of the four headline items are UI.
   **Mitigation and standing instruction: all layout, timeline and MIDI-map
   *logic* goes in headless modules with unit tests (AC-15..AC-32 and
   AC-41..AC-59 are written to be satisfiable that way); the SFCs stay thin.**
   Installing a component harness is an `Ask First` dependency decision — raise
   it, don't drive-by it.
3. **Upstream merge debt.** P2-1 touches `cue.model.js`, `chase.model.js`,
   `master.model.js`, `group.model.js`; P2-5 touches `controls.js`; P2-2 touches
   the app activity and the modifier fragments. P2-6 should touch **nothing**
   upstream except one hook line in `App.vue` — if a MIDI PR starts editing
   models, the design has drifted from §7.4 and the estimate is void. Every
   upstream edit goes in `upstream-diff.md` in the same change (the Stop hook
   enforces it).
4. **Scope creep from the timeline into looks/palettes, and from MIDI into clock
   sync.** The moment someone says "a region should be a *look*", or "we could
   just read MIDI clock", the phase doubles. Regions reference existing chases
   and cues; MIDI reads notes and CCs. Full stop.
5. **Browser and permission surface for MIDI.** Safari has no Web MIDI at all and
   Chrome now prompts even without SysEx (§7.4). A demo that dies on a permission
   dialog in front of a client is a bad day. Mitigation: explicit UI states,
   `simulate_midi` as the hardware-free fallback path, and a line in the release
   notes that Safari is unsupported.
6. **Phase 2 still produces no new *render*.** P2-6 gives it a demo, not a
   picture. Open Phase 3 with venue + drape + bloom.

---

## 9. Open questions for Jake

Five, and only ones whose answers change what gets built. Issue #7 sharpened
three of them.

1. **Does the playhead run the show, or edit it?** Two different products.
   (a) *Linear*: the timeline is the show — one playhead drives everything, like
   Logic. (b) *Editor*: the timeline arranges chases that are still fired
   independently by hand, and the playhead is a rehearsal tool. **My assumption
   is (b) for Phase 2.**
   **MIDI angle:** busking with a keyboard is inherently (b), which strengthens
   the assumption — but "record what I just played into the timeline" (§7.5) is
   the single most attractive Phase 3 follow-on and it needs a show clock. So the
   real question is *which one first*, not which one ever.
2. **When you press Freeze with nothing selected, what should freeze — the whole
   show, or the last thing you touched?**
   **MIDI angle, and it now tips the answer:** a MIDI transport key has *no
   selection context at all*, and during a busk "the last thing you touched"
   changes every bar. That makes last-touched semantics genuinely dangerous under
   a keyboard and pushes me toward **global**. Confirm, because it fixes the
   meaning of `Space` and of any learned transport key.
3. **Should Blackout kill real DMX output too, or only the preview?** My default:
   **both, always, no setting.**
   **MIDI angle:** this is also why Blackout is *unmapped by default* and asks
   for confirmation when you bind it (§7.2) — a mis-hit black key in front of a
   client is the worst outcome this feature can produce. Flag it if you disagree
   with either half.
4. **Bottom pane: one editor at a time behind tabs (Logic), or several
   collapsible panels stacked in a rail (Lightroom)?** I have specified tabs
   because it structurally kills the 3318 px overflow. The rail keeps more
   visible at once if you'd rather see the colour picker and the channels
   together. This changes the shell build, not just its skin.
5. **The trade, and the controller.** Two halves of one decision.
   (a) If week 4 goes badly, which **two** of these three land in Phase 2 — the
   **timeline**, **MIDI play**, or **venue templates + drape** (a room, black
   legs, renders that look like a show)? My ruling is transport + shell + MIDI,
   with the timeline slipping, because it is the only combination that is both
   coherent and demonstrable — but you are the one who has to show clients
   things.
   (b) **Which controller are you actually plugging in** — a 25/49/61-key
   keyboard, something with pads, or a grid controller? The default map in §7.2
   assumes a keyboard with a mod wheel; if it is a Launchpad, v1's "no MIDI out /
   no LED feedback" ruling makes it a poor experience and I would change both the
   defaults and the scope.
