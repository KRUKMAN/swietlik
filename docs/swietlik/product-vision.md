# Świetlik — Product Vision (end state)

> Author: lighting design & production consultancy pass, 2026-09-09.
> Status: **opinion, not commitment.** This is the destination the phased roadmap
> is walking towards. Nothing here is approved scope; each item still owes a
> brainstorm → spec → plan cycle per [`roadmap.md`](roadmap.md).

---

## 0. How to read this document

**Rank** — my verdict on whether the end state needs it:

| Rank | Meaning |
| --- | --- |
| **MUST** | Without this, the product does not do its job. Cut other things first. |
| **STRONG** | Clear, defensible value. Build it once the MUSTs are standing. |
| **NICE** | Real but marginal. Build it when it's nearly free, or when a user asks twice. |
| **KILL** | Looks attractive, is a trap. Documented so nobody re-proposes it in six months. |

**Phase** — `P2` stage builder · `P3` rendering · `P4` layered UX · `P1+` needs MCP
surface extension · `post-v1` after first real client use.
`P2-parallel` means **do it now, alongside Phase 2, don't wait for P4** — used only
for the playback-feel work in §3, which the owner's first session showed cannot
wait. `P4 (pull forward)` / `P4 (first)` likewise mark Phase 4 items that the
session moved ahead of most of Phase 2. See §2 for why.

**Build** — `crisp` = spec-able and unit-testable today, no unknowns.
`research-y` = needs a throwaway spike before anyone estimates it.

**Layers** — every feature states **Simple** (Jake, non-LD, Monday morning, wants
a picture) and **Pro** (a programmer who has sat behind an MA3 for a decade).
Per the roadmap these are *progressive disclosure on one object graph*, not two
apps. Rule I'd enforce: **the simple layer never writes anything the pro layer
cannot see and edit.** Simple mode is a lens, never a separate data model.

---

## 1. The positioning bet (read this before the feature lists)

Four bets, ranked by how much they change the product. **Bet 0 was added after
the owner's first hands-on session (§2) and it outranks the other three** — the
other three are about *who the product is for*; bet 0 is about whether it is worth
using at all.

0. **It has to feel like an instrument, not a renderer.** Jake's words —
   *"a responsive stage in front of you, not a delayed computed visualisation"* —
   are the best one-line spec of this product anyone has written. Everything
   downstream depends on it: an AI that generates looks is worthless if recalling
   one snaps ugly; a timeline is worthless if the transport lies to you; a
   beautiful render nobody enjoys touching gets opened once. **Fix playback feel
   (§3) before building anything new.**
1. **Świetlik's fastest route to credibility with working LDs is being a great
   *visualizer*, not a great console.** MA3, Avolites and MagicQ have thirty
   years of muscle memory behind their programmer. Nobody will relearn that in a
   browser tab. But every one of those LDs wants a previz they can point their
   own console at, that opens in a browser, that costs less than Depence R4's
   €2,395-per-module Windows-only licence, and that their client can look at
   without installing anything. **Art-Net/sACN input + MVR/GDTF import are worth
   more for LD adoption than any programming feature we could build** (§11.1,
   §11.2).
2. **Świetlik's fastest route to Jake using it weekly is the client-facing
   deliverable, not the rig.** An events agency does not get paid for a patch
   sheet; it gets paid for winning the pitch and surviving the site visit. So:
   render, MP4, shareable read-only link, kit list, power/weight sanity check
   (§11.3–§11.6). And the deliverable is only convincing if the stage is *occupied*
   — band, backline, PA, haze in the air (§6.9, §6.10). An empty room full of
   beams is a lighting diagram; a room with a band in it is the event.
3. **"Claude as co-designer" is the genuine differentiator and it is strongest at
   the boring end.** Natural-language look generation demos well. *Fixture
   substitution, show doctoring and paperwork generation* are what make it
   indispensable (§9). Build the boring ones first; they are also the ones with
   verifiable correct answers, which means they are testable.

Corollary to (3), and the most important architectural opinion in this document:
**everything the UI can do, the MCP surface must be able to do, and vice versa.**
The Phase 1 registry is not a side door — it is the app's actual API, and the UI
is one client of it. If the stage builder (P2) grows mutation paths that bypass
the command registry, Claude becomes a second-class operator and the whole
differentiator rots. Budget for `stage_*` commands *in the same PR* as the
builder feature, not in a catch-up phase.

---

## 2. Owner feedback — first hands-on session (2026-09-09)

Jake sat down with the current app and came back with three findings, filed as
issues **#2** and **#3** in `KRUKMAN/swietlik`. I've weighted them above my own
priors, and they've moved the sequencing in this document. My verdict on each:

| # | What he hit | My verdict | Where it's addressed |
| --- | --- | --- | --- |
| 1 | **Playback doesn't feel live.** Stopping a playing group freezes, then cuts to black. Restarting begins from scratch. He wants "a responsive stage in front of you", not "a delayed computed visualisation". | **He's right, it's a real defect, and it's three defects wearing one coat.** I can point at the exact lines. Fixing this is worth more than any new feature in this document. | **§3** (new headline section) |
| 2 | **"I hate the UI."** Group Pool is acceptable; adding or editing anything is "crazy non intuitive". There is **no discoverable interface** for authoring the automation the demo show performs. | **Right, and the second half is the serious one.** The domain model can express the demo show's automation; the UI gives you no path to author it. That's not a polish problem, it's a missing surface. | **§4** (new headline section) |
| 3 | **No way to resize or rearrange panels/windows.** | Right. Table stakes, and its absence signals "unfinished" faster than any missing feature does. | **§5** (new headline section) |

**Sequencing consequence — this is the part that changes the roadmap.** The
roadmap runs P2 stage builder → P3 rendering → P4 UX. Jake's session says that
ordering is wrong. **Playback feel (§3), the layout shell (§5.1) and the timeline
(§4.1) should be pulled forward, ahead of most of the stage builder.** The
reasoning is simple: he could not get value out of the app he already has, and no
amount of truss geometry fixes that. A tool that feels like an instrument with a
plain rig beats a tool with a beautiful rig that feels like a form.

I'd also read finding #1 as the sharpest product insight in the whole engagement.
"Responsive stage, not delayed computed visualisation" is a better articulation of
what previz is *for* than anything currently written in the roadmap — and it is
exactly the quality that separates the tools LDs love from the ones they tolerate.

---

## 3. Playback feel and transport semantics

**The single highest-priority item in this document.** Everything else here is
features; this is whether the thing feels alive.

### 3.1 Diagnosis — what is actually happening

Three separate defects, all currently reaching the user as one bad feeling:

1. **There is no release fade. At all.** `Chase.cue(false)`
   (`src/models/DMX/chase.model.js`) does this on stop:

   ```js
   this.elapsed = 0;
   this.cues.forEach((cueItemPool) => {
     cueItemPool.cue.state = 0;
     cueItemPool.cue.cue(false);
   });
   Live.remove(this.animationId);
   ```

   Elapsed is zeroed, every cue is snapped to state 0, and the animation is torn
   out of the `Live` loop in the same tick. There is no fade-out path anywhere in
   that call — the hard cut to black is not a bug in the fade, it is the *absence
   of the concept*. **This is defect #1 and it is the entire "cuts to black"
   complaint.**

2. **Restart always rewinds.** `Chase.cue(true)` sets `elapsed = 0` and
   `deltaStart = null`, so a chase can only ever re-enter from bar one. There is
   no notion of retaining phase. **Defect #2 — "restarting begins from scratch".**

3. **The start is silently deferred.** Chases register with
   `Live.add(fn, this.quantize, 60, onReadyCallback)` and `Live` holds them until
   the next quantize boundary (`QUANTIZATION_TOLERANCE`, `live.model.js`).
   Musically that is *correct* console behaviour — but with no visual indication
   that a playback is armed and waiting, and at slow tempi, it reads as lag.
   **Defect #3, and it is the direct cause of the "delayed computed
   visualisation" sensation.**

The encouraging part: **the codebase already contains the correct pattern.**
`Live` itself does phase-preserving pause properly, with `pauseStartTime` /
`pauseTimeOffset`. The global transport is right; the per-playback transport never
got the same treatment. This is a completion job, not an invention job.

### 3.2 What each transport verb should mean — **MUST** · P2-parallel · crisp

Six verbs. Borrowed from MA's Off Time, Eos's release/assert, Hog and MagicQ
release times, and Logic's distinction between *stop* and *pause*. Stated so a
non-LD can operate them:

| Verb | Plain-English label | Behaviour | Default |
| --- | --- | --- | --- |
| **GO** | *Go* | Start or advance. Content fades in over the incoming fade time. If quantized, the button **arms and pulses**, then fires on the boundary. | fade 2 s |
| **Pause** | *Freeze* | Time stops; **levels hold exactly where they are.** Nothing goes dark. This is Logic's stop-in-place. | — |
| **Resume** | *Continue* | Carries on from the frozen phase. With a tempo map, re-enters on the next musical boundary rather than mid-beat. | continue |
| **Release / Off** | *Let go* | Hands control back, fading out over a **release time** to whatever the next-priority source says (usually out). **Never a cut.** | 2 s |
| **Stop all** | *Clear the stage* | Release everything, using the global release time. | 3 s |
| **Blackout** | *Blackout* | Instant. The **only** verb allowed to be instantaneous — that is its entire job. Separate, loud, visibly latched. | 0 s |

The distinction Jake hit is exactly this: **Pause holds, Release fades, Blackout
cuts.** Today all three collapse into "cut to black", which is why the app feels
computational rather than physical. Real lights have thermal and mechanical
inertia; a virtual stage that snaps to zero reads as a spreadsheet.

- **Simple:** three buttons — *Go*, *Freeze*, *Let go* — plus a big Blackout, and
  one slider labelled **"How fast things fade when you stop them"**, defaulting to
  2 s. That slider *is* the release-time concept, and it will be the first control
  a non-LD reaches for once they understand what it does.
- **Pro:** per-playback release time and **release mask** (which attributes release
  and which hold — the MA/Eos concept), out-fade vs out-delay, priority and
  HTP/LTP resolution so a release lands on the underlying state rather than on
  zero, and an assert/steal control.
- **Build:** crisp. A release envelope on `Cue`/`Chase` plus an out-time on the
  existing `Fade` model. **Testable at the model layer with fake timers in the
  current Vitest harness** — write those tests, because playback feel regresses
  silently and no screenshot catches it.

### 3.3 Resume-from-position and musically sane re-entry — **MUST** · P2-parallel · crisp

One-line: stopping and restarting a running effect must not throw away where it
was.

Three per-playback restart modes behind a single three-way control:

| Mode | Behaviour | Right default for |
| --- | --- | --- |
| **Continue** | Retain phase; re-enter exactly where it left off | **Looping chases and effects** — this is what "responsive stage" means |
| **Next boundary** | Retain phase, but re-enter on the next beat/bar so it lands in time | Anything running against a tempo map (§11.9) |
| **From the top** | Rewind to zero | **Cue stacks** — a running order is meant to run in order |

The implementation is small: retain `elapsed` and reconstruct
`deltaStart = now - elapsed` on re-entry instead of nulling it. `Live` already
proves the pattern works in this codebase.

- **Simple:** invisible — the sensible default per playback type, with a single
  "Restart from the beginning" checkbox in the inspector for the day someone
  wants it.
- **Pro:** the three-way control, plus a phase-offset nudge and "sync to playhead"
  for timeline work.

### 3.4 Immediate acknowledgement — the one-frame rule — **MUST** · P2-parallel · crisp

One-line: **a user gesture must produce a visible change within one frame; musical
alignment applies to the content, not to the acknowledgement.**

This is the rule that resolves defect #3 without throwing away quantization. Press
a busking tile: the tile lights *immediately* and pulses in tempo while armed; the
look lands on the beat. Today the tile does nothing until the boundary arrives, so
the app feels like it did not hear you.

Corollaries — all cheap, all mandatory:

- Quantize becomes a **visible** per-playback control (`off / beat / bar / 2 bars`),
  defaulting to **off** in simple mode — immediate *is* responsive — and to `1 bar`
  once a tempo map exists.
- An armed-but-not-yet-fired playback gets its own visual state (pulsing outline).
  Nothing may ever be silently pending.
- Faders, wheels, colour pickers and intensity keys **bypass quantization
  entirely. Live parameter control is never quantized.** That is the difference
  between an instrument and a render queue.
- Never block the render loop on a mutation. Anything slow gets an optimistic
  visual response and reconciles afterwards.

### 3.5 Crossfade by default, not snap — **MUST** · P4 · crisp

One-line: recalling look B while look A is up should *dissolve* over B's fade
time, not cut.

Non-LDs expect this (it is how every consumer app transitions) and LDs demand it.
It also makes AI look-iteration (§9.5) feel like design rather than like a page
reload. Pair it with:

- **A manual crossfade fader** — grab it and scrub the transition by hand. The
  most satisfying control on any console and nearly free to build.
- **A global rate / size master** — scale every running effect at once (MagicQ's
  fader-controls-FX trick, §7.6). This is *the* busking move.
- **Fade time as a visible per-look property**, named rather than numeric in
  simple mode: *Snap / Fast 0.5 s / Normal 2 s / Slow 5 s / Very slow 15 s*.

### 3.6 What I would *not* do here — **KILL**

- **Detailed fixture mechanical inertia** (pan/tilt acceleration curves,
  colour-wheel spin-up, lamp thermal decay). Real, tempting, and a rabbit hole
  that makes the previz *less* controllable. A single global "movement smoothing"
  easing on pan/tilt buys 90 % of the feel for 1 % of the work. Do that instead.
- **Frame-accurate timecode-locked playback.** Different product (§7.2).
- **Making Blackout fade.** It is the panic button. It cuts. Leave it alone.

---

## 4. The programming surface — timeline, automation lanes, presets

Jake's sharpest UI finding was not "it's ugly". It was *"there is no discoverable
interface for programming the automation the demo show performs."* That is correct
and it is the most serious gap in the product. The domain model already expresses
everything the demo does — FX with per-channel waveform, frequency, amplitude and
per-fixture phase; chases with cue items and fades. The **authoring surface for it
does not exist** outside a deep modifier pane you have to already know about. You
cannot ask a user to discover an editor that has no front door.

### 4.1 A show timeline with automation lanes — **MUST, headline** · P4 (pull forward) · crisp

One-line: a Logic-style multitrack timeline where **tracks are groups**, **regions
are looks/effects/chases**, and **automation lanes underneath hold editable
parameter curves**.

Logic is the right thing to steal from because its metaphor maps onto lighting
almost perfectly:

| Logic | Świetlik | Note |
| --- | --- | --- |
| Track list, one per instrument | One track per **group**; drill in for positions, then fixtures | Groups are already the domain's selection unit (§7.4) |
| Regions on a track | A **look**, **effect** or **chase** with a start, a length and draggable edges | Drag edge = duration, drag body = move, Alt-drag = copy. Universally understood. |
| **Automation lanes** under a track | `Intensity / Pan / Tilt / Colour / Zoom / Focus` lanes with breakpoint curves | **This is the direct answer to Jake's complaint.** Disclosure triangle → the automation is right there, visible and editable. |
| Bars/beats vs. time ruler | Same toggle | Essential — corporate work thinks in minutes, band work in bars |
| Playhead, cycle region, markers | Same, with markers as song sections | Feeds §11.9's audio timeline directly |
| Snap / grid | Snap to beat, bar or second | — |

Two things already in the repo are the seed and should be **promoted rather than
rebuilt**: `chase.modifier.widget.timeline.vue` is a single-chase timeline that
wants to become a show-level multitrack view, and `modifier.widget.curve.vue` /
`group.scene.modifier.widget.curve.vue` are already breakpoint-curve editors — the
right primitive, in the wrong place, behind the wrong door.

- **Simple:** one **Show** track. Drag looks onto it in order; it reads like a
  video editor's storyboard with thumbnails. Automation lanes exist but stay
  collapsed and unmentioned — a beginner never needs to open one.
- **Pro:** full multitrack, per-group automation lanes, per-fixture drill-down,
  curve shapes (linear / ease / S-curve / step / hold), copy-paste of automation
  between tracks, and **the effects engine writing into lanes** so a generated
  effect can be hand-edited afterwards. That last point matters enormously: an
  effect you can convert to curves is an effect you can fix.
- **Build:** crisp, but it is the largest single UI item in this document. Scope
  v1 to: track list generated from groups, regions with drag/resize/copy, one lane
  type (intensity), playhead and snap. Add lane types incrementally.

**State this explicitly so it does not get built twice: the timeline and the cue
stack (§7.7) are two views of the same data.** A cue stack is a timeline whose
regions are butted end-to-end and advanced by GO instead of by a clock. One model,
two presentations, switchable per show. Building them as separate systems is the
most likely expensive mistake in Phase 4.

### 4.2 Presets as a visible, hover-previewable pool — **MUST** · P4 · crisp

One-line: Lightroom's Presets panel, for palettes, looks and effects.

Lightroom solved exactly this problem for exactly this user: a named, grouped list
down one side; **hover to preview the result live**; click to commit;
`Create preset from current` permanently at the top. Non-professionals already know
this interaction, and it turns "browsing presets" into a visual conversation
instead of a guessing game.

Steal specifically:

- **Hover-preview in the viewport.** The best single interaction to lift in this
  entire document. Hover a look, see it on stage; move away, it restores. It makes
  a library of forty looks explorable in fifteen seconds.
- **Folders with user naming**, plus a favourites star.
- **`Create from current` always visible.** The reason nobody can find "how do I
  make a preset" in most tools is that the create affordance lives somewhere else.
- **An amount/strength slider on apply** — push the selection 50 % of the way
  toward a colour palette rather than all the way. Lightroom's preset-amount
  slider, and a genuinely novel and useful idea in a lighting context.

This is the UI for §7.3 (palettes) and §7.5 (looks).

### 4.3 Discoverability rules — **MUST** · P4 · crisp

The root cause of "adding/editing anything is crazy non intuitive" is not any one
control, it is the absence of consistent affordances. Six rules to hold the P4 work
to, all testable by watching one person use the app for ten minutes:

1. **Every pool has one obvious `+`; every object has one obvious inspector.**
   Nothing important may require knowing about a small icon in a corner.
2. **Empty states teach.** An empty group pool should read *"No groups yet —
   [Create from selection] · [Auto-generate from the rig]"*, never be blank. Empty
   states are the cheapest onboarding in software and this app currently has none.
3. **Right-click everywhere**, exposing the same verbs as the toolbar.
4. **Direct manipulation first.** Drag a look onto the timeline; a fixture onto a
   group; a colour onto a selection. If the *only* route to something is a modal
   dialog, the design is wrong.
5. **A persistent "what am I editing" breadcrumb.** The router-driven modifier
   panes swap context invisibly today, which is disorienting even once you know
   the app.
6. **Undo everywhere, labelled and visible** — with `Ctrl+Z` actually bound to it
   (§8.2). Reversibility is what gives a beginner permission to experiment, and
   permission to experiment is this app's most-needed feature.

### 4.4 A demo show that explains itself — **STRONG** · P4 · crisp

One-line: click anything moving in the demo, land on the thing that made it move.

Jake's complaint literally began with the demo doing things he could not author.
Turn that into the tutorial: every element in the shipped demo named, reachable and
annotated, with a **"How was this made?"** button that selects the driving
effect/cue and opens its editor. Cheap to build, and it converts the demo from a
source of frustration into the best onboarding asset in the product.

---

## 5. Workspace, layout and the UI shell

> Finding #3: *"no way to change or resize panels/windows."*

Correct, and it is the finding with the shortest path to done. The roadmap already
says Phase 4 is where "upstream's UI assumptions get genuinely reconsidered" —
Jake's session is the evidence that **a layout shell should be the first P4
deliverable**. It is additive (a new shell hosting the existing fragments) and it
unblocks everything in §4.

### 5.1 Resizable, dockable panels with saved workspaces — **MUST** · P4 (first) · crisp

One-line: drag any panel edge; rearrange panels into docking zones; save the
arrangement as a named workspace.

- **Simple:** four **modes as tabs across the top — `Build · Look · Show ·
  Present`** — each a curated, fixed layout. This is Lightroom's module switcher,
  and for a non-LD it is strictly better than freeform docking: you cannot get
  lost, and the app teaches you the phases of the job just by existing. Panel edges
  are still draggable within a mode.
- **Pro:** real docking (drag a panel to a zone, tab panels together, tear one
  off), user-named workspaces, and **`Alt+1`–`Alt+9` to recall a whole layout** —
  Logic's screensets, one of the best power-user features ever shipped. (`Alt`
  because bare digits are group selection, §8.4.)
- **Build:** crisp and known-shape — splitters, a persisted layout tree, a
  slot-based shell. Sizes persist per workspace, per show.
- **KILL: free-floating MDI windows.** Docking zones only. Free windows get lost
  off-screen, break when monitors change, and generate support load forever.

### 5.2 Presentation mode — **MUST** · P4 · crisp

One-line: `F11` (or `Shift+V`) and the viewport is the whole screen, chrome gone.

You will show this to clients on a large screen constantly, and a previz tool that
cannot get out of its own way for that is embarrassing in the room. Minimal
overlay: look name, next/previous, nothing else.

### 5.3 Detachable visualizer window — **STRONG** · post-v1 · crisp

One-line: the 3D view on the second monitor, controls on the laptop.

Standard working posture for anyone doing this seriously. The seed exists —
`src/views/activities/visualizer/visualizer.activity.vue` is already a separate
route — but `createMemoryHistory()` blocks the popout. Same blocker as §11.3's
shareable link, which is an argument for answering the router question once,
properly, rather than twice.

### 5.4 Visual design direction — **STRONG** · P4 · research-y

Not a feature list, a stance — since "I hate the UI" is partly aesthetic:

- **Keep it dark.** Every tool in this domain is dark because operators work in
  dark rooms and because a bright UI destroys your read of the render next to it.
  Do not light-mode this app.
- **Let the render be the brightest thing on screen.** Chrome should recede to
  near-monochrome so the only saturated colour in the window is the stage. Amateur
  lighting UIs fail exactly here — coloured buttons competing with the viewport.
- **Density is a setting**, comfortable by default. Pros want compact; a beginner
  drowning in 11 px labels quits.
- **One accent colour, used only for "this is live".** In a tool where things play
  back, *what is running right now* must be unmissable and must never compete with
  decoration.
- **A single spacing and type scale** applied across the existing UI kit will do
  more perceived-quality work than any individual screen redesign.

---

## 6. Stage builder end state

**Target:** a non-LD goes from empty app to a venue a client recognises, with a
believable rig in it, in **under ten minutes**, having never typed a DMX address.

Today: a 50 × 50 m checkerboard `BoxGeometry` floor and an infinite grid helper
(`visualizer.js` ~L254–300), fixtures placed by numeric field or `TransformControls`
gizmo. There is no room, no truss, no hang-position concept.

### 6.1 Venue templates — **MUST** · P2 · crisp

One-line: pick `club / ballroom / theatre / festival stage / outdoor / white box`,
get a parameterised room with correct-feeling dimensions, trim heights, stage
position and camera start.

This is the single highest-leverage item in Phase 2 and it should ship *first*,
before truss. A generic ballroom with a 6 m trim and a 10 × 6 m stage instantly
makes every existing beam look ten times better than the same beam over a
checkerboard, at near-zero rendering cost.

- **Simple:** six template cards with a photo. Pick one, then three sliders:
  room size, stage size, trim height. Done.
- **Pro:** every template is an editable parameter set — wall/ceiling heights,
  proscenium width, FOH distance, balcony rail, column grid, surface materials,
  floor reflectivity. Templates are *savable as user templates* ("Hala Stulecia
  ballroom config") — that's the repeat-business feature for an agency that
  works the same ten venues.
- **Buildability:** crisp. A venue is a JSON parameter object → procedural
  geometry. No new rendering tech. Unit-testable: given params, assert generated
  bounding boxes, trim heights and fixture-attachable anchor list.
- **Note:** make venue a first-class model (`venue.model.js` under a new
  `src/models/stage/`), serialised into `.asls` as an *additive* key so old
  showfiles still load. Do not touch the existing DMX model tree.

### 6.2 Hang positions as the core abstraction — **MUST** · P2 · crisp

One-line: fixtures attach to a named *position* (truss, boom, ladder, floor, set,
tower), and the position owns the transform — move the truss, the lights come
with it, rotation and all.

This is not a convenience, it is **the** data-model decision of Phase 2, and
getting it wrong is expensive to unwind. Every console and every previz tool in
the industry is organised around positions: MA3 has layers and classes, Capture
and WYSIWYG both model fixtures as children of rigging objects, MVR encodes the
parent-child hierarchy explicitly. A flat `fixture.position = {x,y,z}` list — what
exists today — cannot express "drop the downstage truss 300 mm", which is the most
common note a designer gets on site.

- **Simple:** invisible. The user drags a light onto a truss; it sticks. Dragging
  the truss drags the lights. Nobody says the word "parent".
- **Pro:** a Positions list (rename, reorder, lock, hide, solo-in-view), per-position
  trim height readout, offset-from-parent numeric entry, and the ability to
  re-parent by drag in the list. Positions are the natural grouping unit for the
  patch ("FOH Truss 1–8") and for paperwork.
- **Buildability:** crisp as a data model (parent transform composition), fiddly
  in the existing visualizer because moving heads are `InstancedMesh` slots
  rather than scene-graph children. Expect to compute world transforms in the
  model layer and push matrices down — *not* to reparent Three.js objects. That
  keeps the two-import boundary in `fixture.model.js` intact, which CLAUDE.md
  correctly treats as sacred. Flag: one spike to confirm instanced-matrix update
  cost at ~200 fixtures.

### 6.3 Truss assembly — **MUST** · P2 · crisp

One-line: draw truss like you draw a line — click start, click end, get a span
with correct section type, length rounded to real stock lengths, and legal corner
blocks where spans meet.

- **Simple:** three tools — *straight span*, *rectangle/box truss grid*, *circle*.
  Click-drag in plan view, snapped to 0.5 m. Type defaults to a generic 300 mm
  square truss. One "add tower/goalpost" button that generates uprights + base
  plates at the right height automatically.
- **Pro:** section library (250/300/400/520 mm, triangular/square, ladder, pre-rig),
  real stock lengths (0.5/1/1.5/2/2.5/3/4 m) with the leftover shown so the rig is
  *buildable*, corner block types, hoist/motor points with chain drawn up to the
  ceiling, span-between-points loading readout (§11.5), sub-hung secondary truss.
- **Steal from:** Capture's and Vectorworks' *click-click-done* line tool with
  live numeric readout in the cursor (length and angle follow the mouse, and you
  can type the length mid-drag to commit exactly). That "type to override the
  drag" behaviour is the single interaction that separates pro CAD from toy
  builders and it is cheap to implement.
- **Buildability:** crisp. Truss is a generated geometry + a metadata record.
  Keep the rendered truss as cheap instanced chord/diagonal geometry; resist the
  urge to import manufacturer CAD until P3.

### 6.4 Drag-and-drop fixture placement with auto-patch — **MUST** · P2 · crisp

One-line: drag a fixture type from the library onto a truss; it snaps to the
nearest legal hang point, gets a DMX address, and appears in the patch — no
addressing dialog ever shown.

Already named in the roadmap; I'd sharpen it:

- **Drop on truss** = snap to truss, hang downward, under-hung clamp orientation.
  **Drop on floor** = floor base, aimed up. **Drop on a wall/set face** = surface
  mount. The drop target infers the mounting, which is how an actual electrician
  thinks.
- **Multi-drop / array on drop:** drag with a count — drop "6 × wash" onto a
  span and get them evenly distributed along it with consistent spacing. This is
  the *one* interaction that turns a ten-minute job into a ten-second job, and it
  is where most cheap builders stop short.
- **Auto-*numbering*, not just auto-addressing (scope extended after §12).**
  The same drop order that assigns DMX addresses should also assign **unit numbers
  and circuits**, using Spotlight's linear / circular pattern idea ("number these
  left-to-right along the truss", "clockwise around the circle", skip ambiguous
  characters). Unit numbers matter as much as addresses the moment paperwork exists
  (§9.6), and they cost nothing extra here.
- **Auto-patch rules:** fill the current universe in drop order, respect
  footprint, never straddle a universe boundary, keep same-type fixtures
  contiguous, optional gap-per-position padding ("leave 20 channels after each
  truss"), warn on collision rather than silently reshuffling. Re-addressing must
  be a *visible, undoable* batch operation, never a side effect.
- **Simple:** addresses are never shown. The fixture has a *name* ("Wash 3") and
  lives on a *position*. A single "Addresses" toggle reveals them for the day the
  venue tech asks.
- **Pro:** the full patch bay that exists today, plus universe/offset override on
  drop, a re-patch tool with preview-before-apply, and an "export addresses"
  path (§10.4).
- **Buildability:** crisp. `findChStartAutoPatch` already exists and the Phase 1
  `patch_fixture` composite already owns the two-step OFL→`addRaw`→`patchFixture`
  dance. Auto-patch-on-drop is mostly a policy object over that. Unit-testable
  exhaustively, which is rare and valuable — write those tests.

### 6.5 LED walls as first-class emissive surfaces — **MUST** · P2/P3 · crisp→research-y

One-line: a wall/panel object defined in *panels* (e.g. 12 × 7 of 500 × 500 mm),
carrying content, that lights the room.

For Jake's market (corporate, conference, awards, brand events) the LED wall *is
the set*. A previz that renders lights beautifully but shows the screen as a grey
rectangle will lose every pitch. This ranks above gobo projection for his work.

- **Simple:** pick panel pitch and a grid size, drop an image or MP4 on it, done.
  Presets: "16:9 backdrop", "two side screens", "DJ booth front".
- **Pro:** panel pitch/bezel/curve (arc and serpentine), per-panel mapping,
  brightness in nits, colour temperature, a processor-latency-free "content is
  just a texture" model, *and* the wall acting as an actual light source in the
  scene (area-light approximation driven by the content's average colour —
  cheap, and the effect on believability is enormous).
- **KILL (for v1):** real media-server emulation, pixel-mapping the wall from
  DMX, NDI input. Depence does NDI from Resolume and that is a whole product.
  Post-v1 at the earliest, and only if a client asks.
- **Buildability:** geometry + texture is crisp. "Wall illuminates the room" is
  research-y (one spike: average-colour area light vs. a handful of sampled
  point lights vs. baked irradiance).

### 6.6 Drape, decks and set — **STRONG** · P2 · crisp

One-line: soft goods (black serge, wool, sharkstooth, starcloth), risers/decks at
real heights, and simple set blocks — the things that make a room read as *this*
room.

Drape earns its rank for a specific LD reason: **black drape is what makes beams
visible and contrast believable.** A rig over a white infinite grid looks washed
out and amateur; the same rig in front of black serge looks like a show photo.
This is the cheapest "render quality" win in the whole document and it lives in
the builder, not the renderer.

- **Simple:** "black back wall", "side legs", "star cloth", "white cyc" buttons,
  plus deck blocks you drag and set a height on (200/400/600/800 mm — real deck
  heights).
- **Pro:** fabric type with fullness (flat vs 50 % vs 100 %), IR/backlit cyc,
  scrim transparency, tracked curtain with open/close as an animatable property,
  custom deck shapes, stair units.
- **Buildability:** crisp for flats and boxes; fullness/folds is a shader or a
  pre-made geometry variant — do the geometry variant, not a cloth sim.

### 6.7 Parametric rig templates ("the obvious festival rig") — **STRONG** · P2 · crisp

One-line: one click produces a complete, conventional, *sane* rig for the chosen
venue template — FOH truss, mid truss, upstage truss, floor package — correctly
counted and addressed.

Blank-page paralysis is the real failure mode for a non-LD. Giving Jake a
defensible starting rig he then edits is worth more than any number of individual
placement tools. This is also the best possible input to §9.2 (Claude suggesting
rigs) — the AI picks and parameterises a template rather than inventing geometry
from nothing, which is both better and far more testable.

- **Simple:** "Suggest a rig" → three options labelled in client language
  ("tight budget", "looks expensive", "festival energy") with fixture counts.
- **Pro:** templates are editable, savable, shareable; counts and spacings are
  parameters; positions come out correctly named.
- **Buildability:** crisp. Templates are data. This is an afternoon of JSON plus
  a generator, and it will do more for first-run experience than a month of
  gizmo polish.

### 6.8 2D plan/section view alongside 3D — **STRONG** · P2/P4 · crisp

One-line: an orthographic top-down (and front) view with snapping, because
**nobody can place objects accurately in a perspective viewport**.

Every serious tool in this space is primarily a 2D plan with a 3D preview, not
the reverse. Capture, WYSIWYG and Vectorworks all work this way. Attempting the
whole builder in a perspective orbit camera will feel bad no matter how good the
gizmo is.

- **Simple:** a "Top view" button that locks the camera to plan and turns on grid
  snap. That alone fixes 80 % of the problem.
- **Pro:** true ortho plan/front/side with dimensions, a measure tool, layer
  visibility, and eventually a printable plot (§10.3).
- **Buildability:** crisp (an ortho camera and a snap mode). Printable plot is a
  separate, larger item.

### 6.9 Stage population — band, instruments, backline and PA — **MUST** · P2 · crisp

> *Owner directive, 2026-09-09: "we need the ability to generate band
> visualisations — 3D models of humans and instruments in the scene alongside
> speakers, trusses etc."* Agreed, and I'd rank it higher than the roadmap
> currently implies. This promotes what was going to be a §10 "silhouettes for
> scale" nicety into a first-class builder feature.

One-line: a **Stage Plot** object — drummer behind a kit, bass and guitar at their
mic positions, keys, horns, a DJ booth, backline amps, wedges, side-fill, and a
flown or ground-stacked PA — placed as one preset and then nudged.

Why this is a MUST and not decoration:

1. **It's what the client is actually looking at.** A render of an empty stage
   with beams on it is a lighting diagram. The same render with a five-piece band,
   a drum riser, backline and PA hanging where PA actually hangs is *a photograph
   of their event*. For an agency pitching, that gap is the whole deliverable.
2. **It makes the lighting correct, not just pretty.** You cannot judge whether
   faces are lit, whether the drummer is sitting in a hole, whether the
   guitarist's backlight is blinding row one, or whether the PA hang is eating the
   SL tower's beam path — without bodies and boxes in the room. Half the notes an
   LD gets on site are about occlusion by things that are not lights.
3. **It's the target set for auto-focus.** §9.4 aims fixtures at semantic targets.
   "Point these four at the drummer" needs a drummer to exist as an object with a
   head height. Stage population and position palettes are the same feature seen
   from two ends — build them together.

- **Simple:** a **Band preset** picker — `Solo artist / Duo / 4-piece / 5-piece /
  8-piece with horns / DJ / Orchestra / Panel (4 chairs) / Lectern + presenter /
  Awards (host + winner)`. Pick one, it lands on the stage laid out sensibly, drag
  to adjust. Each performer arrives as a posed figure with their instrument, mic
  stand and wedge already attached. One `PA: flown / ground-stacked / none` toggle
  and one `backline: yes/no`.
- **Pro:** individual placement of every element; performer height, facing and
  posed variant (standing / seated / at-mic / at-kit); real kit geometry (riser
  size, keyboard stand, amp stacks); PA as a proper array with box count, splay
  and trim, plus a **coverage cone** so you can see what it blocks; and mic/DI
  positions feeding an actual **stage plot + input list** in the paperwork pack
  (§11.6) — a document production managers ask for by name.
- **Buildability:** crisp, and cheaper than it sounds — this is asset sourcing plus
  placement presets, no new rendering technology. The real work is a small curated
  glTF library (low-poly, instanced) and a preset format. **Settle the asset
  licensing question before anyone models anything:** this is a GPL-3.0 repo, so
  every human/instrument/PA asset needs a documented, compatible licence, and
  "found it on Sketchfab" is not one.
- **KILL — and be firm: rigged, animated, performing musicians.** Dancing drummers
  is a character-animation product, and mediocre humanoid animation drops straight
  into the uncanny valley and makes the whole render look *worse* than static
  figures. Ship **static posed figures**, at most with a whisper of idle motion
  (breathing sway, drummer's arms at ~2 % amplitude). A still, well-lit, well-posed
  figure reads as a photograph; a badly animated one reads as a games demo from
  2004. Same ruling on the audience: a crowd *plane* of a few hundred instanced
  silhouettes with subtle bob is convincing and costs nothing; individually
  animated people are a money pit.

### 6.10 Atmospherics as placeable machines — **MUST** · P2/P3 · research-y

> *Owner directive, 2026-09-09: "also realistic smoke from smoke generators".*
> Agreed on the goal. This is the most expensive item in the document, so it needs
> to be sequenced honestly rather than treated as one feature.

One-line: hazers, foggers, low-fog units and CO₂ jets are **objects you place and
trigger**, and what they emit is a real volume that moves through the room and
that beams scatter inside.

The distinction between the four matters technically *and* matters to LDs, who
treat them as completely different tools:

| Device | Behaviour | Visual job |
| --- | --- | --- |
| **Hazer** | Fine, even, slow-settling; fills the whole room over minutes | Makes *every* beam visible. The baseline state of any show. |
| **Fogger / smoke machine** | Dense billowing plume from a nozzle, dissipating over ~30 s | A *moment*. Bursts on a hit, rolls across the deck, thins. |
| **Low fog / dry ice / CO₂ fog** | Heavy, hugs the floor, pools and spills off the deck edge | Ballads, reveals, first dance. Pure client-pleaser. |
| **CO₂ jet / cryo** | Sharp white column fired upward for ~2 s | Drops and chorus hits. Extremely photogenic, trivially cheap to fake. |

- **Simple:** a **Haze slider** (`none → light → heavy`), on by default at "light",
  plus draggable machines with a big **Fire** button and a `puff / blast /
  continuous` choice. Fog machines get a direction arrow you drag. No fluid
  parameters, no solver settings, ever.
- **Pro:** per-machine output rate, plume velocity and cone, density, dissipation
  time, a room **air-movement vector** ("HVAC drift" — the thing that actually
  decides whether haze behaves on a real gig), machines triggerable from cues and
  from the busking grid, and a **timeline pre-roll** so a fog cue fired at −4 s
  looks right when the light cue lands. That pre-roll detail is exactly what a
  working LD will check for.
- **Buildability: research-y, and the hardest thing in this vision.** Ship it as
  three explicitly separate deliverables, evaluating after each:
  1. **Global haze done properly** (§10.1) — scene-wide density with a height
     gradient and slow drift. Medium effort, delivers roughly 70 % of the total
     perceived benefit. Do this first, in P3, then stop and look.
  2. **Localised static volumes** — a low-fog "pool" primitive on the deck and a
     soft plume cone at each machine, animated by a noise field rather than
     simulated. Cheap, fakeable, and for a **still render** essentially
     indistinguishable from the real thing. The effort/impact curve peaks here.
  3. **Actual advecting simulation** (GPU fluid or particle-advected froxels) with
     beams scattering correctly inside it — beautiful, genuinely expensive, a real
     frame-rate risk on a laptop at FOH, and only worth it for **video** export.
     Post-v1, and only once (1) and (2) are earning their keep.
- **The thing not to lose sight of:** what sells a smoke render is not the smoke,
  it's the **light scattering inside it**. A gorgeous fluid sim that doesn't
  interact with the beams looks worse than crude geometry that does. Whatever
  volume representation wins the spike must be the *same* volume the beams are
  evaluated against. **Do not build two atmospheres.**

### 6.11 Data-rich fixture records — **MUST** · P2 · crisp

> Added after the Spotlight benchmark (§12.2 #1). It was absent from this document
> entirely, which was a gap: it is the cheapest unblocking item in the whole vision.

One-line: every fixture carries `purpose`, `color`, `gobo`, `unit number`,
`channel`, `dimmer`, `circuit`, `position`, `notes`, `weight` and `power` — not just
DMX channels and an XYZ.

Spotlight's Lighting Device object is the reason its paperwork works, and the
reason its plot and its schedule can never disagree. Ours currently has an OFL
profile and a transform. Adding a small metadata object to `Fixture` is perhaps a
day of work and it is the **hard prerequisite for every document in §9.6** — you
cannot generate an instrument schedule from fixtures that have no purpose field.

- **Simple:** two fields surface — a **name** ("Wash 3") and a **purpose** in plain
  words ("key light on the lectern"). Everything else is derived or hidden. The
  purpose field is also what makes §9.3's show doctoring and §9.2's rig suggestions
  able to reason about *intent* rather than just geometry — worth far more than its
  cost.
- **Pro:** the full record, bulk-editable in a spreadsheet view of the patch
  (§12.1), with user-definable custom fields for house conventions.
- **Build:** crisp, additive, and trivially unit-testable. Serialise into `.asls`
  as an additive key so existing showfiles still load.

### 6.12 What else to steal, interaction-wise

| Source | Behaviour worth copying | Rank |
| --- | --- | --- |
| Capture / Vectorworks | Type a number mid-drag to commit an exact length/angle | **MUST** |
| Capture | Drag from the console-patch list onto an existing fixture to associate it (their 2026 "Import At Position" idea) — our version: drag an MVR/console fixture onto a placed one | STRONG |
| WYSIWYG | Fixture *symbols* carrying their own paperwork metadata, so the plot and the patch can never disagree | STRONG |
| Depence R3/R4 | Plot pages with fixture symbols annotated with DMX/circuit/ID, multi-page PDF export in one click | STRONG (§10.3) |
| Capture 2026 | Pinning "Generic" fixtures/truss to the top of the library list — trivial, and makes first-run vastly faster | NICE |
| Blender/Maya | `F` to frame selection; modifier-held snapping | **MUST** (§3) |
| SketchUp | Inference lines / guides while drawing | NICE |
| **KILL** | Full CAD (booleans, NURBS, constraint solving, DWG import). Świetlik is not a drafting tool. If someone needs that, they should draft in Vectorworks and bring in MVR. |

---

## 7. Show design end state

**Target:** someone who has never touched a console builds a look they are proud
of, and a programmer can still work fast enough not to be insulted.

The honest framing: Świetlik is a **previz and design tool, not a show-control
console**. That licence lets me drop a large amount of console machinery, and
dropping it is what makes the simple layer possible.

### 7.1 What I borrow from real consoles

| Borrowed | From | Why it survives |
| --- | --- | --- |
| **Palettes / presets** (position, colour, beam, gobo) as *referenced* values | MA2/MA3 presets, Eos palettes | The single most important programming concept there is. Change "Drum Riser" once, every cue that used it updates. Non-negotiable. |
| **Groups as the primary selection unit** | every console | Already in the app. Keep. |
| **Selection-then-action ordering** | every console | "pick who, then say what" is universal and beginner-intuitive. |
| **`@` intensity entry** | Hog / Eos | `@ 50 ⏎` is muscle memory for every programmer and genuinely faster than a slider for non-programmers too. |
| **Highlight / solo** | MA "Highlight", Eos "Hilite" | "which light is this?" is the #1 question in a rig. Cheap, enormous. |
| **Flash-on-hold vs latch** for playback buttons | Avolites / MagicQ | The core busking primitive. |
| **FX with size / speed / spread-between-heads** | MagicQ FX engine | The three-parameter mental model is the right one (§7.5). |
| **Tracking-free cue lists** | Hog/Chamsys cue-only behaviour | See the kill list. |
| **Executor grid / playback pages** | MA executors, Chamsys playbacks | The busking surface (§7.6). |

### 7.2 What I deliberately drop

| Dropped | Why |
| --- | --- |
| **Tracking and cue-only/track-through semantics** | The #1 source of "why did that light come on" confusion. For previz, every cue stores an explicit, complete state. Snapshot semantics. Slower to program, impossible to misunderstand. If a pro needs tracking, they're programming on their console anyway. |
| **Command-line syntax as the *primary* input** | `Group 4 At 50 Please` is fast and unlearnable. Offer it in pro mode as an accelerator (§7.8), never as the path of least resistance. |
| **Multi-user / session / backup-gateway machinery** | Not a show-critical system. |
| **Timecode chasing, MSC, MIDI show control, macros, plugins** | Show-control surface area with zero previz value. (An audio-file timeline for previz-against-the-track is different and is a MUST — §11.9.) |
| **Parking, inhibitive masters, grand-master law nuance, DMX curves per channel** | Pro-console hygiene features for a live rig we do not have. |
| **Fixture profile *editing*** | Profiles come from OFL/GDTF. Hand-editing invites exactly the kind of silent error that ruins trust. Report bad profiles upstream instead. |

### 7.3 Palettes and presets — **MUST** · P1+/P4 · crisp

One-line: named, reusable, referenced values for position / colour / beam / gobo,
stored once and pointed at by looks and cues.

- **Simple:** they're just "Spots" with human names, created by a button that
  says **"Save this as…"** after the user has made something they like. Colour
  palettes ship pre-populated with *named theatrical colours* ("Congo Blue",
  "Bastard Amber", "Open White", "3200 K", "Hot Pink") — not RGB sliders. Position
  palettes get *semantic* names tied to the venue ("Drum Riser", "Lectern",
  "Centre Stage", "Audience", "Back Wall") and §9.4 fills them automatically.
- **Pro:** per-fixture-type and per-fixture storage granularity (the MA distinction
  that makes palettes portable across rig changes), "update preset" propagation
  with a preview of affected cues, hard/soft value inspection.
- **Buildability:** crisp *if* done as references not copies. This is a data-model
  decision that must happen before cues get rich, or retrofitting it is a rewrite.
  Put it early.

### 7.4 Newcomer-sensible groups — **MUST** · P2/P4 · crisp

One-line: groups that exist before the user makes any, named the way people
actually talk.

When fixtures are placed on positions (§6.2), groups can be *generated*:
`All Fixtures`, `All Spots`, `All Washes`, `All Beams`, `FOH Truss`,
`Mid Truss`, `Floor Package`, `Odds / Evens`, `Stage Left / Right / Centre`,
`Inner / Outer pairs`. That last family (odds/evens, symmetrical pairs, inside-out
ordering) is what LDs actually use all day and no beginner would ever think to
create them.

- **Simple:** auto-groups appear as soon as fixtures exist; user never creates one.
- **Pro:** manual groups, fixture *order within* a group (critical — FX spread and
  "next fixture" both follow group order), reverse/shuffle order tools, nested
  groups, and a 2D *grid layout* per group for pixel-style FX (MagicQ's Pix Map
  idea — the group's grid is what makes 2D effects possible at all).
- **Buildability:** crisp. Generated groups are a pure function of the rig.

### 7.5 Look building — **MUST** · P2/P4 · crisp

One-line: a *look* is a named, complete stage state, assembled from
"who + what" sentences, and it is the primary unit of design — above cues.

Concretely, "warm wash + beams on the drummer" becomes:

```
Look: "Ballad — verse 2"
  ├ All Washes        → Amber 3200K @ 40%        (colour palette · intensity)
  ├ Mid Truss Spots   → @ Drum Riser, 70%, narrow, soft edge
  ├ Floor Beams       → Deep Blue @ 80%, tilt 15°, prism on
  └ LED Wall          → "slow blue drift"
```

Each row is a group + a palette reference + an intensity. That's it. No channels,
no DMX, readable by anyone, and it round-trips perfectly to the pro layer because
each row *is* a selection + parameter set.

- **Simple:** a look is rows in a list with big friendly value chips. Add a row by
  picking a group and a colour. A "Looks" shelf of thumbnails (rendered from the
  actual viewport — cheap and delightful) that you click to recall.
- **Pro:** the look inspector reveals the full channel state it resolves to,
  per-fixture overrides, hard/soft/tracked indication, and the existing
  scene/cue editor as the deep view. Looks are what get dropped into cue stacks
  and onto the busking grid.
- **Buildability:** crisp, and it maps nearly 1:1 onto the existing `Scene`/`Cue`
  model. The work is naming and UI, not new domain logic. **This is the single
  highest-value Phase 4 item.**

### 7.6 Effects engine UX without the jargon — **MUST** · P3/P4 · crisp

One-line: effects described by *behaviour* first, parameters second.

The app already has a competent FX engine (`effect.model.js`: waveform, frequency,
amplitude, phase per channel, per-fixture phase offset). The model is fine; the
*vocabulary* is the problem. Mapping:

| User-facing | Internal | Control |
| --- | --- | --- |
| **Speed** | `frequency` | slider + "sync to beat: 1/1, 1/2, 1/4, 1/8, 2 bars" |
| **Size** | `amplitude` | slider 0–100 % |
| **Spread** | per-fixture `phase` step across group order | slider 0–100 %, plus shape buttons |
| **Shape** | `waveform` | icons, not words: ∿ ⎍ ⩗ |
| **Direction** | phase sign / group order | ← → ↔ ⟳ buttons |

And then a **preset library named after what it looks like**, not what it is:
*Slow Breathe, Pulse on Beat, Chase Left→Right, Ping-Pong, Sweep, Figure-8,
Circle, Fan Out, Wave, Random Twinkle, Strobe Bursts, Colour Rainbow, Fire,
Water*. A newcomer picks "Fan Out" and then drags two sliders. That is the entire
requirement.

- **Simple:** preset + Speed + Size + Spread, with a live 2 s preview loop in the
  viewport so you see it before committing.
- **Pro:** the existing per-channel wave editor, phase-per-fixture table, custom
  waveform curves, FX stacking with priority, fader-controls-size/speed (the
  MagicQ trick — one slider scales a running effect, which is *the* busking move).
- **Buildability:** crisp. Vocabulary layer + preset JSON over existing maths.
- **Watch out:** "Spread" must be defined against **group order** (§7.4), so
  group-order tooling is a prerequisite, not a nice-to-have.

### 7.7 Cue stacks *and* a busking grid — both **MUST**, different jobs · P4 · crisp

Don't choose. They answer different questions:

- **Cue stack** answers *"walk me through the show in order"* — for corporate,
  theatre, awards, anything scripted, and for the render/video deliverable. Needs:
  ordered list, fade/delay per cue, follow/wait for auto-sequences, GO/Back/Pause,
  a cue *name and note* column (the note column is what makes it a communication
  document), and jump-to-cue.
- **Busking grid** answers *"give me that look right now"* — for bands, DJs, and
  for design exploration. Needs: a paged grid of tiles (looks, effects, chases,
  colour overrides), latch vs flash-on-hold, a rate/size master, a blackout and a
  strobe tile that are always in the same place, and a visible "what's active now"
  state.

- **Simple:** grid only, by default. Looks as tiles, one row of global controls
  (dimmer, speed, blackout). A cue stack appears the moment the user presses
  "Make a running order".
- **Pro:** both surfaces, simultaneously, with the grid able to fire into the
  stack and a proper release/priority model (HTP for intensity, LTP for
  everything else — the one piece of console theory worth keeping).
- **Buildability:** crisp; the `CuePool`/`ChasePool`/`Master` models already cover
  most of it. Mostly a UI and a keymap (§8).
- **Do not build a third thing.** The cue stack is the timeline (§4.1) advanced by
  GO instead of by a clock; the busking grid is the same looks addressed by
  hotkey instead of by order. Three surfaces, one model. And all three inherit
  the transport semantics of §3.2 — a look released from the grid fades exactly
  the way a cue released from the stack does.

### 7.8 Pro accelerators — **STRONG** · P4 · crisp

One-line: an optional command line and a command palette, so speed is available
without being mandatory.

- **Command palette (`Ctrl+K`)** — fuzzy, natural-language-tolerant, the bridge
  between UI and AI. "blue wash" / "add 6 spots to mid truss" / "export render".
  This is *also* the honest front door for §4, because it lets an AI request look
  exactly like a UI action. **MUST**, see §3 keymap.
- **Terse command line (backtick)** — `g4 @ 50`, `pos drums`, `rec look 12`.
  A pro-mode affordance. STRONG, not MUST.

### 7.9 Save / recall — **MUST** · P2 · crisp

One-line: autosave, named versions, and never lose work.

- **Simple:** it's just saved. Always. A "Versions" list with timestamps and
  auto-generated thumbnails. "Before the client call" restore points.
- **Pro:** explicit save-as, showfile diff (§10.7), per-element import ("bring the
  looks from last year's gala into this show" — *very* high value for an agency
  with repeating events).
- **Buildability:** crisp locally (the `.asls` format and `persistLocally` exist).
  The multi-user/SaaS story is a deliberately deferred architectural concern the
  roadmap already flags — just don't assume a filesystem anywhere new.
- **KILL:** a bespoke binary format. Keep `.asls` JSON; it is the thing that makes
  versioning, diffing and AI editing possible at all.

---

## 8. Keyboard control

A concrete proposal. The app currently has **five uncoordinated `window`-level
`keydown` listeners** and they already conflict with each other; any keymap work
must start by fixing that.

### 8.1 Existing bindings (verified in source)

| Key | Current behaviour | Where |
| --- | --- | --- |
| `T` | gizmo → translate mode, show helpers | `plugins/visualizer/controls.js` `handleKeydown` |
| `R` | gizmo → rotate mode | same |
| `H` | hide helpers / discrete mode | same |
| `Esc` | detach gizmo, clear highlighting, unfocus | same |
| **`Ctrl+Z`** | **`applyTransformation()` — commits the gizmo transform. NOT undo.** | same |
| `Space` | play/pause show | `toolbar.fragment.vue` `handleKeydownEvent` |
| `Delete` / `Backspace` | delete selected (group / chase / cue / list item) | 4 separate fragments |
| `Esc` | clear list highlight | `uikit.list.vue` |
| `↑ ↓ ← →` | **pan the camera** | `orbitcontrol.zup.patch.js` (keyCode-based) |

### 8.2 The three real conflicts, and my ruling

1. **`Ctrl+Z` is taken by "apply transform".** This is the worst of the three: it
   is the most sacred shortcut in computing, bound to something that is not undo,
   globally, with no focus guard. The Phase 1 MCP surface already exposes
   `undo`/`redo` tools, so the app has an undo concept — it just has no key.
   **Ruling: `Ctrl+Z` becomes undo, `Ctrl+Shift+Z` / `Ctrl+Y` redo.** Gizmo commit
   moves to `⏎` (and happens implicitly on mouse-up anyway). This *is* an upstream
   edit to `controls.js` — log it in `upstream-diff.md` and pay the merge debt;
   it's worth it.
2. **Bare arrow keys pan the camera, but arrows are the natural pan/tilt nudge.**
   Position nudge is used constantly; camera pan by keyboard almost never (people
   use the mouse). **Ruling: arrows belong to the selection. Camera pan moves to
   `Alt+arrows`.** Implement by setting OrbitControls' `.keys` map / `enableKeys`
   from our own init code — *no upstream edit needed*, which is the deciding
   factor.
3. **`T` / `R` / `H` are single-letter globals with no context guard**, which
   blocks the whole letter space. **Ruling: keep `T`/`R` (they match Unreal,
   Unity, and most LDs' 3D habits), promote them into a context-aware router,
   retire `H` in favour of `Shift+H`** (freeing `H` for Highlight, which is a far
   more valuable binding for a lighting tool).

### 8.3 The prerequisite: one keyboard router — **MUST** · P4 (do it first) · crisp

One-line: a single additive module owns `window` keydown, resolves the active
*context*, and dispatches; existing fragment listeners migrate behind it.

Contexts, in priority order: `text-entry` → `modal` → `palette` → `busk` →
`builder` → `program` → `global`. Bindings declare their context, so `Q` can be a
busking tile in Busk mode and nothing in Builder mode without either handler
knowing about the other.

Two facts that make this safe and cheap:
- `uikit.input.textbox.*` already use `@keydown.stop`, so text entry is already
  isolated from window handlers. Good inherited hygiene — preserve it.
- The router can be introduced *alongside* the existing listeners and take them
  over one at a time, so it is not a big-bang refactor.

Also **MUST**: a discoverable shortcut sheet (`?`) generated from the binding
registry, and **STRONG**: user-rebindable keys (pro users will want their console's
muscle memory; an MA operator and a Hog operator disagree about everything).

### 8.4 Proposed keymap

**Selection**

| Key | Action |
| --- | --- |
| `1`–`9`, `0` | Select group 1–10 (simple); in pro mode, digits feed the numeric buffer |
| `Ctrl+F` | Find/select fixture by number or name |
| `Ctrl+A` | Select all in context · `Shift+Ctrl+A` invert |
| `Esc` | Clear selection / clear programmer / close palette (panic key — keep it) |
| `[` / `]` | Previous / next single fixture within selection (console "Next/Prev" — essential for focusing) |
| `Shift+[` / `Shift+]` | Extend selection by one |
| `Ctrl+G` | Record selection as a group |
| `H` | **Highlight** selected (full, open, white, home position) |
| `Shift+S` | Solo selected (everything else out) |

**Intensity**

| Key | Action |
| --- | --- |
| `@` then digits then `⏎` | Set intensity %, e.g. `@ 50 ⏎` (Hog/Eos idiom) |
| `@` `@` | Full · `@` `⏎` | Out |
| `+` / `-` | ±5 % · with `Shift` ±1 % · with `Ctrl` ±20 % |
| `Shift+Wheel` over viewport | Intensity wheel on selection |
| `\` | Toggle blackout (sticky, loudly indicated) |

**Position**

| Key | Action |
| --- | --- |
| `↑ ↓ ← →` | Pan/tilt nudge 1° · `Shift` 0.1° · `Ctrl` 10° |
| `Alt+arrows` | Camera pan (moved from bare arrows) |
| `F` | Frame camera on selection (universal 3D idiom — outranks every other use of `F`) |
| `Shift+F` | Fan the selection's current parameter across group order |
| `Home` | Send selection to home position (pan/tilt centre) |
| `Ctrl+P` | Store current positions as a position palette |

**Playback**

| Key | Action |
| --- | --- |
| `⏎` (Enter) | **GO** on the selected cue stack |
| `Shift+⏎` | Back one cue |
| `Space` | Pause / resume (closest to today's meaning — minimal retraining) |
| `Ctrl+Space` | Release all / stop all (fades over the global release time — §3.2) |
| `Shift+Space` | Release the *selected* playback only ("let go") |
| `Ctrl+Home` / `Ctrl+End` | Playhead to start / end of the timeline (§4.1) |
| `C` | Toggle cycle/loop region on the timeline (Logic idiom) |
| `B` | Tap tempo (tap four times, BPM locks) |
| `<` / `>` | BPM −1 / +1 · with `Shift` ±10 |
| `Ctrl+1`–`9` | Fire executor 1–9 (outside Busk mode) |

**Busk mode** (`Ctrl+Shift+B` toggles; viewport gets a coloured border so the
mode is never ambiguous — the single most important UX detail in a modal keymap)

| Key | Action |
| --- | --- |
| `Q W E R T Y U I O P` | Tiles 1–10 (latch) |
| `A S D F G H J K L ;` | Tiles 11–20 |
| `Z X C V B N M , . /` | Tiles 21–30 |
| `Shift+<tile>` | Momentary flash instead of latch |
| `PgUp` / `PgDn` | Previous / next page of tiles |
| `Esc` | Leave Busk mode |

Busk mode is what resolves the `T`/`R`/`H`/`B`/`F` collisions: in Busk mode the
builder bindings are suspended entirely. Precedent: MA3's command-vs-executor
distinction and MagicQ's playback layouts.

**Builder**

| Key | Action |
| --- | --- |
| `T` / `R` / `S` | Translate / rotate / scale gizmo (`T`,`R` preserved from today) |
| `Shift+H` | Hide helpers (was `H`) |
| `Ctrl+D` | Duplicate in place |
| `Shift+Ctrl+D` | Duplicate + mirror across stage centreline (symmetric rigs in one keystroke) |
| `Ctrl+Shift+R` | Array / repeat tool (count, spacing, direction) |
| `Ctrl+Alt+X/Y/Z` | Align selection on axis · `Ctrl+Alt+E` distribute evenly |
| `Ctrl` (held, dragging) | Snap to grid · `Shift` constrain axis · `Alt` snap to truss node |
| `L` / `Shift+L` | Lock selection / unlock all |
| `Tab` | Cycle plan → front → 3D view |
| `G` | Toggle grid / snap |

**Global**

| Key | Action |
| --- | --- |
| `Ctrl+K` | **Command palette** (fuzzy + natural language → the AI front door) |
| `Alt+1`–`Alt+9` | Recall workspace layout 1–9 (Logic screensets — §5.1) |
| `Alt+Q/W/E/R` | Jump to mode: Build / Look / Show / Present (§5.1) |
| `` ` `` | Terse command line (pro) |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo (**reclaimed**) |
| `Ctrl+S` | Save version · `Ctrl+Shift+S` save as |
| `Del` / `Backspace` | Delete in context (unify the four existing handlers) |
| `?` | Shortcut sheet |
| `F11` or `Shift+V` | Full-screen visualizer (presentation mode — you will use this in front of clients constantly) |

**KILL:** a numeric-keypad console emulation layer, and encoder-wheel MIDI
mapping for v1. Both are pro-operator comforts for a product whose pros will be
using their own console as the input device anyway (§10.1).

---

## 9. AI-native features

Where "ask Claude" genuinely beats any UI — and where it's theatre. The test I
apply: *does the task have a verifiable correct answer, is it tedious, and does it
require holding a lot of context at once?* Three yeses = build it. Mostly
aesthetic judgement with no verifiable answer = suspicious.

### 9.1 Fixture substitution — **MUST** · P1+ · crisp

One-line: "the rental house is out of Mac Auras, they have Rush PAR 2s — swap
them and tell me what I lose."

Ranked first deliberately, against instinct. This is the highest-value AI feature
in the product because: it happens on *every single job*, it is pure tedium, it
needs cross-referencing photometrics / footprint / channel layout / palette
remapping, and **it has a checkable right answer**. Claude re-patches, remaps
channel functions, rebuilds colour palettes to the new fixture's mixing system,
flags what can't transfer ("the substitute has no framing shutters — your three
lectern cues relied on them"), and re-renders a before/after.

- **Simple:** "Swap fixture" → pick the replacement → a plain-English impact list.
- **Pro:** per-channel mapping table, diff view, selective accept.
- **Build:** crisp, given palettes are *references* (§7.3). Testable: assert
  channel-function coverage and palette validity after a swap.

### 9.2 Rig suggestion from a venue / brief description — **MUST** · P1+ · crisp

One-line: paste the client brief, get a rig.

*With one hard constraint:* Claude selects and parameterises the **rig templates
from §6.7**, it does not free-form geometry. That makes it reliable, inspectable,
fast, and testable. Free-form generation produces trusses floating at 11.3 m in a
room with a 6 m ceiling and destroys trust in one shot.

- **Simple:** paste brief → three named options with fixture counts and a render.
- **Pro:** Claude explains its reasoning and *cites the constraints it respected*
  (trim, sightlines, power, count budget), and every choice is editable.
- **Build:** crisp once templates exist. Validate output against venue geometry
  *programmatically* — never trust the model's arithmetic about clearances.

### 9.3 Show doctoring / design critique — **MUST** · P1+ · crisp

One-line: "review this show" → a numbered list of real problems.

This is where Claude's ability to hold the whole show at once genuinely beats a
human, and it is *the* feature that would make a working LD raise an eyebrow.
Findings worth having: fixtures that are patched but never used in any cue; two
cues that look identical; a group with no intensity anywhere; a cue with a 0 s
fade that should be 3 s; colour palettes referenced by nothing; a position palette
pointing off-stage; beams that cross the LED wall and will wash it out; front
light missing entirely (the classic non-LD mistake — gorgeous backlight, faces in
the dark); two fixtures sharing a DMX address; a hang with no data path.

Note the key property: **most of these are deterministic lint rules.** Build them
as a rule engine and let Claude *explain and prioritise* the findings. That makes
it reliable, fast, and free to run on every save.

- **Simple:** a "Check my show" button with a traffic-light list and one-click fixes.
- **Pro:** rule severity configuration, suppressions, CI-style report.
- **Build:** crisp. Highest value-per-effort ratio of any AI feature here.

### 9.4 Auto-focus positions — **STRONG** · P1+ · crisp

One-line: "point the mid-truss spots at the drum riser" → correct pan/tilt for
every fixture, from actual geometry.

Trigonometry from hang position to target, which the app already has all the
inputs for. Works brilliantly *because the answer is computable* — Claude picks
the target and the fixtures, the app does the maths. Auto-generating a standard
position-palette set (Centre / Drums / Lectern / Audience / Back Wall / Each Deck)
at rig-build time is an excellent default.

- **Simple:** click a spot on the 3D stage, pick a group, "aim here".
- **Pro:** beam-angle-aware coverage (overlap, pools, even-wash solving), offset
  per fixture, store as palette.
- **Build:** crisp for aiming. Even-coverage *solving* is research-y — defer.

### 9.5 Natural-language look generation — **STRONG** (not MUST) · P1+ · crisp

One-line: "warm intimate ballad look, faces lit, drummer in a blue beam" → a look.

The headline demo, and it does work — but I rank it below the three above on
purpose. It produces *a* defensible look, not *the* look, and the value decays
fast once the user knows the UI. Its real job is **breaking the blank page** and
**being a fast iteration partner** ("same but colder", "lose the backlight",
"half as bright") — which is genuinely excellent and is how it should be framed in
the UI: a *conversation about the current look*, not a one-shot generator.

- **Simple:** a text box under the Looks shelf. Variations offered as thumbnails.
- **Pro:** generated looks land in the programmer as a normal, fully editable
  selection + parameter state — never an opaque blob.
- **Build:** crisp (it's §7.5 look-rows + §7.4 groups + §7.3 palettes via MCP).
- **Essential guard rail:** every AI mutation must be **one undo step** and
  visibly attributed ("generated by Claude — accept / tweak / discard"). Trust in
  an AI-native tool is built entirely out of reversibility.

### 9.6 Paperwork and deliverable generation — **REVISED: split** · see §12.6

> **Ranking revised after the Vectorworks Spotlight benchmark (§12).** Was a single
> *STRONG · post-v1*. Now split, because Spotlight's entire market position is
> evidence that documentation is the billable artefact — and because tables are
> both cheaper to build and more used than drawings:
>
> - **Paperwork tables — MUST · P2/P3 · crisp:** instrument schedule, channel
>   hookup, circuit/power summary, hoist report, kit list. Venues and rental houses
>   act on these.
> - **Graphical plot PDF — STRONG · post-v1 · crisp:** the A3 landscape plot with a
>   legend and title block. Impresses other lighting people; bounded per §12.5.

One-line: "produce the pack" → instrument schedule, channel hookup, power summary,
kit list, cue list with notes, and (later) the plot PDF.

Boring, tedious, verifiable, and it is literally the billable artefact. Claude
assembles and writes the prose — the cue-note column, the scope paragraph for the
client — while the app generates every number from the model. **Prerequisite: the
data-rich fixture record (§12.2 #1).** Without `purpose` and `unit number` on each
fixture there is nothing to put in a schedule. See also §11.4 (console patch
export) and §11.6 (kit list and quote).

### 9.7 Gimmick list — **KILL**, with reasons

| Idea | Why it's a trap |
| --- | --- |
| **"Drop an MP3, get a programmed show"** | Beat detection is easy; *taste* and *structure* are the job. It will produce something that strobes the chorus and reads as an AI toy. Ship beat-grid + section markers + "suggest a cue per section" as an *assist* (§10.9) and never as the headline. |
| **AI busking the show live** | Latency, non-determinism, and no LD will ever hand over the faders. Also there is no undo during a show. |
| **Chat as the only interface** | Chat is a great accelerator and a terrible primary UI for spatial, continuous, and comparative work. Every AI action must have a UI equivalent. |
| **AI-generated fixture profiles** | A hallucinated DMX map is a *dangerous* artefact — it can send a real fixture to a real position at a real venue. Profiles come from OFL/GDTF only. Hard rule. |
| **"AI lighting designer" as the product positioning** | Working LDs will reject the tool on sight and Jake's clients don't care who drew it. Position it as *your* tool that happens to have an extremely fast assistant. |
| **Auto-colour-matching from a brand logo** | Sounds great, is two clicks in a colour picker, and brand hex values map badly to fixture gamuts anyway. Tiny NICE at best. |

---

## 10. Rendering priorities from an LD's eye

Ranked by **client-impact per unit of effort** — i.e. what makes a client say
"yes, that's the show", not what's technically impressive. Capture's 2026 release
notes are instructive here: their headline realism work was *smoke, bloom, lens
flare and image settings*. Not global illumination.

| # | Item | Impact | Effort | Phase | Build |
| --- | --- | --- | --- | --- | --- |
| 1 | **Haze that behaves like haze** | Enormous | Medium | P3 | research-y |
| 2 | **Bloom + exposure + tone mapping** | Very high | Low | P3 | crisp |
| 3 | **Dark room + drape** (§6.6) | Very high | Low | P2 | crisp |
| 4 | **Emissive fixture faces / lens glow** | High | Low | P3 | crisp |
| 5 | **Beam falloff + shape fidelity** | High | Medium | P3 | crisp |
| 6 | **Camera presets & lens control** | High | Low | P3/P4 | crisp |
| 7 | **Still + video export** | High | Medium | P3 | crisp |
| 6b | **Band, instruments, backline & PA in the scene** (§6.9) | Very high | Low-medium | P2 | crisp |
| 7 | **Still + video export** | High | Medium | P3 | crisp |
| 8 | **LED wall content** (§6.5) | High (Jake's market) | Medium | P2/P3 | crisp |
| 9 | **Localised fog/low-fog/CO₂ volumes** (§6.10 step 2) | High | Medium-high | P3 | research-y |
| 10 | **Gobo projection + rotation + prism** | Medium-high | High | P3 | research-y |
| 11 | **Shadows from truss/set/people** | Medium | Medium | P3 | research-y |
| 12 | **Advecting smoke simulation** (§6.10 step 3) | Medium (high for video) | Very high | post-v1 | research-y |
| **+** | **False-colour / coverage view** — intensity heat map (**added after §12**, stolen from Showcase 2026) | Medium for clients, **high for LD credibility** | Low | P3 | crisp |
| — | Path-traced / GI offline renderer; photometric lux reporting; rigged performer animation | — | — | **KILL** | — |

Note the deliberate ordering upset: **populating the stage (6b) outranks every
remaining rendering feature**, including gobos and localised smoke. Given equal
effort, a mid-quality render of a *full* stage beats a high-quality render of an
*empty* one every single time, because the client is not evaluating your renderer
— they're trying to picture their event.

Detail on the ones that need it:

**1. Haze — MUST.** Beams are only visible because of particulate in the air, and
*how* the haze behaves is what separates previz that reads as a photograph from
previz that reads as a video game. Today's implementation is a per-fixture beam
shader with a global `fogDensity` / `fogTurbulence` uniform (`visualizer.js`
L96–144) — which is a decent foundation but it's a per-beam trick, not an
atmosphere. What's needed: density as a *scene* property; a **height gradient**
(haze pools low and drifts — this single detail is startlingly convincing); slow
turbulent drift so the beam edges shimmer; beams *occluding* and *scattering
within* the same volume so crossing beams interact; and a "hazer just fired"
vs. "settled" preset because those look completely different and LDs think in
exactly those terms. Research-y: spike a froxel/raymarched volume against the
existing shader before committing.

**2. Bloom / exposure — MUST, do it first.** `postprocessing@^6.36.4` is already
in `package.json` and imported nowhere; `ACESFilmicToneMapping` is already set.
An `EffectComposer` with selective bloom, a film-grain whisper, a subtle vignette
and an **exposure slider** is the cheapest transformation of perceived quality in
the entire roadmap — and the exposure slider specifically, because real show
photos are *underexposed* relative to a naive render, which is why naive renders
look flat and milky. One afternoon. Do it before anything else in P3.

**4. Emissive fixture faces — MUST.** The lens of a lit fixture should be a
blown-out bright disc with bloom. Absurdly cheap, and it is the detail that makes
a wide shot of a rig read as "lights that are on" rather than "grey props with
cones attached". Disproportionate payoff.

**5. Beam falloff and shape — MUST.** Inverse-square-ish intensity falloff so
beams fade with distance instead of terminating in a hard cone; zoom changing
intensity as well as angle (narrow = brighter — LDs *feel* this); soft vs hard
edge differentiated by fixture class (wash/spot/beam/hybrid); correct beam angles
from the profile. **Flag:** OFL beam-angle and lumen data is inconsistent in
quality. A curated, verified subset of ~100 fixtures that render *right* beats
190 manufacturer folders that render *approximately* (§10.8).

**6. Camera presets — MUST.** Named views: `FOH` (centre, eye height, ~35 mm),
`Audience 3/4`, `Truss-eye`, `Side stage`, `Drum riser POV`, `Plan`. Plus focal
length, a little depth of field, and a save-your-own-view list. LDs and clients
talk about looks *from a position*; without presets every screenshot comes from a
different random angle and the deck looks sloppy. **Strongly STRONG:** a
camera-path walkthrough for video export, and a **"shot list"** that renders the
same five named angles for every look in one click — that's the pitch deck,
assembled automatically.

**7. Export — MUST.** PNG at 1×/2×/4× with an optional title-safe frame; MP4/WebM
of a cue-stack walk or a camera orbit; a contact sheet of every look. The export
*is* the deliverable, and it's also how Claude sees its own work (the Phase 1
`screenshot_visualizer` tool is the seed of this — note it already needs
`preserveDrawingBuffer` or a forced render, so solve that once, properly, for both
callers).

**6b. Band, instruments, backline and PA — MUST.** Full treatment in §6.9. From
the renderer's side the only requirements are: figures and cabinets must **receive
light and cast shadows** (otherwise they float and look pasted on), skin needs a
non-plastic response so faces don't go waxy under saturated colour, and PA/backline
should be genuinely matte black — a black box that reads as black in a bright beam
is what makes the rest of the frame look correctly exposed. This is also the only
honest way to judge whether faces are lit, which is the note clients give most
often and non-LDs get wrong most often.

**9. Localised fog volumes — STRONG.** Full treatment in §6.10. The ranking here
is the important part: **global haze (item 1) is a MUST and localised machine
smoke is a STRONG.** Do not let a fog-machine plume jump the queue ahead of
room-wide haze, bloom, or putting a band on the stage — a room with beautiful even
haze and no fog plumes looks like a professional show; a room with a gorgeous CO₂
jet and no haze looks like a screensaver.

**10. Gobos — STRONG but expensive.** Textured beams, projection onto floor/drape
with correct keystone, rotation, and prism splitting. High visual value, genuinely
hard (projective texturing + volumetric interaction). Sequence it *after* haze and
bloom; a rig with great haze and no gobos sells better than the reverse.

**KILL: offline path tracing and photometric accuracy.** A "final render" mode
that takes 90 seconds per frame breaks the iteration loop that is the whole point
of previz, and lux-accurate reporting is Dialux/AGi32's job. If the realtime
render is good enough for a client to sign off — the roadmap's own stated goal —
it is good enough. Full stop.

---

## 11. Things not yet on the roadmap

Ordered by strategic weight.

### 11.1 Art-Net / sACN **input** — visualize from a real console — **MUST** · post-v1 · crisp

One-line: Świetlik listens on the network and renders whatever a real MA3/Avo/Hog/
MagicQ is outputting.

**The single most strategically important item in this document.** It converts
Świetlik from "an app that asks an LD to abandon their console" into "an app that
makes an LD's existing console better", which is the only adoption story that has
ever worked in this market — it's exactly why Capture, Depence and WYSIWYG all
exist primarily as DMX *sinks*. It also means Świetlik never has to win the
programmer war to be valuable. And the cost is low: the DMX-in path is simpler
than the Art-Net *out* path the app already has via WSC, and the model layer
already has `Live` consuming values. For SaaS, the same seam becomes a
cloud-renderer-fed-by-a-local-bridge story.

- **Simple:** "Connect a console" → pick universes → it just renders.
- **Pro:** universe/subnet mapping, multiple sources with priority, merge modes,
  a DMX monitor, and a record-to-cue "snapshot what the console is doing now".
- **Build:** crisp (sACN/Art-Net listener in the sidecar that already exists for
  MCP — note the nice symmetry: the Phase 1 bridge architecture is already the
  right shape to host this).

### 11.2 MVR / GDTF import and export — **MUST** · post-v1 · research-y

One-line: open the MVR the production's drafter sent; export one the console can
eat.

MVR (My Virtual Rig) is the industry's scene-interchange format — fixtures,
trusses, video screens, groups, layers, DMX addresses, hierarchy — and it's
supported across Vectorworks, Capture, WYSIWYG, grandMA3, Eos and Depence. Without
it, Świetlik is an island, and "rebuild the rig by hand" is a non-starter for any
job that already has a drawing. With it, Świetlik slots into existing workflows as
a *better-looking, cheaper, browser-based* stop on the pipeline. Note GDTF also
supersedes OFL as a fixture source with real geometry and photometrics, which
directly feeds §10.5.

- **Simple:** "Open a rig file" → it appears.
- **Pro:** layer/class mapping, selective import, export with console-ready
  addressing.
- **Build:** research-y. MVR is a zip of XML plus GDTF assets plus 3DS/glTF
  geometry; the spec is large and the real-world files are messy. Budget a proper
  spike, and scope v1 to *import fixtures + truss + addresses* only.

### 11.3 Shareable client link — **MUST** · post-v1 · crisp

One-line: send the client a URL, they see the rig and click through the looks in a
browser — no install, no account, no editing.

**This is what makes Jake open Świetlik weekly instead of monthly**, and it is the
SaaS wedge the roadmap already hints at. An events agency lives or dies on
approval cycles; replacing "here are six JPEGs in a PowerPoint" with "here's a
link where you can spin the room and press the buttons" wins work. Note the
router currently uses `createMemoryHistory()` — a shared, linkable, read-only
viewer is the first genuine reason to revisit that.

- **Simple:** "Share" → link, optional password, optional expiry.
- **Pro:** per-look comments from the client (threaded notes pinned to a look —
  this is the feature that eats the email chain), view analytics, version pinning.
- **Build:** crisp as a product, but it's the first feature that requires hosting.
  Do not bolt it on; it's the thing the persistence layer should be designed
  *towards*, per the roadmap's "nothing should hard-block SaaS".

### 11.4 Console patch export — **STRONG** · post-v1 · crisp

One-line: previz at the desk, export the patch, import it on the console at the
venue.

Even a plain CSV/XLSX patch sheet plus an MVR export saves an hour of error-prone
typing on every load-in. Low effort, instantly respected.

### 11.5 Physical sanity checks — **MUST** · P2 · crisp

> **Ranking revised after §12** (was STRONG). A paperwork pack is only worth sending
> if the numbers on it are trustworthy, so these figures stop being an ambient badge
> and become **columns in the circuit/power and hoist reports** (§12.2 #3, #9).
> Re-scoped explicitly as *indicative, not engineering* — see §12.3 on Braceworks
> and liability.

One-line: the app refuses to let you design something that can't be built.

Truss span loading vs point loads (with a published-table lookup, clearly labelled
as *indicative only, not an engineering calculation* — be precise about that
disclaimer), total weight per hoist, power draw per fixture type, amps per phase,
universe/channel budget, data runs and DMX daisy-chain limits, fixture-to-fixture
and fixture-to-truss collisions, and beam angles that clear the stage.

Two reasons this punches above its weight: it's what makes a **working LD trust
the tool** (a pretty render that ignores physics is a toy), and it's what stops a
**non-LD embarrassing himself** (Jake designing a rig that needs three-phase the
venue doesn't have). Deterministic rules, fully unit-testable, and it feeds §9.3
directly.

### 11.6 Kit list, quote and rental integration — **STRONG** · post-v1 · crisp

One-line: the rig generates the gear list, and the gear list generates the number.

Fixture counts, truss lengths and stock, hoists, cabling, consumables, crew and
truck space — priced from a user-maintained rate card, exported as a quote. This is
the closest thing to a feature that *directly makes Jake money*, and the data all
already exists in the rig. (Hard KILL for v1: integrating with any specific rental
system's API — Rentman, Current RMS et al. Export CSV and stop.)

### 11.7 Show versioning and diff — **STRONG** · post-v1 · crisp

One-line: "what changed between v4 and v5?" in plain English.

Ordinarily a nice-to-have; here it's elevated by the AI story. If Claude can
restructure a show in one command, the user **must** be able to see exactly what
it did and roll back precisely. `.asls` being JSON makes a semantic diff
tractable. Treat this as a *safety* feature for §9, not a convenience.

### 11.8 Curated fixture library — **STRONG** · P3 · crisp

One-line: ~100 fixtures that are verified to render correctly, surfaced first;
the other ~190 manufacturer folders still there behind search.

Also: a "generic" set (Generic Spot / Wash / Beam / Strobe / Blinder / PAR /
Batten) pinned to the top for early design before the kit is known — exactly the
move Capture made in 2026 by pinning their Generic section. Beginners should not
have to choose between 40 near-identical Chinese moving heads on their first run,
and a fixture whose beam angle is wrong in the profile undermines §10 silently.
Cheap to do, and it raises the floor on every render.

### 11.9 Audio timeline for previz-against-the-track — **MUST** · P3/post-v1 · crisp

> *Owner directive, 2026-09-09: "we should have the option to generate or import
> any effects/songs etc. into it."* Promoted from STRONG to MUST on that basis —
> and it's the right call: for band work, the track **is** the design brief.

One-line: import the MP3/WAV, mark the sections, scrub the show against it, and
export video with the track under it.

Distinct from the "AI programs your show from audio" gimmick (§9.7). This is a
waveform, an automatic beat grid, section markers (`intro / verse / chorus /
breakdown / drop / outro`), and a transport that drives the cue stack and the
effects engine's beat-sync (§7.6's `1/1, 1/2, 1/4` speed divisions become *real*
once there's a tempo map). For any band/DJ/awards work, *designing against the
actual track* is how the job is really done. It also transforms the deliverable:
a silent MP4 of a cue walk sells far worse than the same MP4 with the music under
it, and it costs nothing extra to mux.

- **Simple:** drag an MP3 onto the timeline. Tempo and downbeats are detected.
  Drop a look at a marker; it fires there. Press play, watch the show.
- **Pro:** manual tempo map and beat nudging, multiple tracks/setlist, per-section
  cue assignment, offset compensation, and export with the audio embedded.
- **Build:** crisp. Web Audio gives the waveform and playback; beat detection is a
  solved, library-shaped problem; the transport already exists in `Live`.
- **Licensing note:** copyrighted audio embedded in an exported MP4 that gets
  shared with a client is the user's problem legally, but the app should not make
  it invisible — a quiet "audio is embedded in this export" line is enough.

### 11.9b Importable and shareable content — **STRONG** · post-v1 · crisp

The other half of the owner's directive. Four import surfaces, ranked:

1. **Media for LED walls and gobos** (`PNG/JPG/MP4/WebM`, plus custom gobo
   patterns) — **MUST**, and effectively already implied by §6.5. Client artwork
   arriving as a PNG is the single most common asset in this business.
2. **Effect presets as portable files** — an effect (§7.6) is already a small JSON
   blob of waveform/speed/size/spread. Make that exportable and importable so
   Jake can carry his favourites between shows, and so a library can be shipped,
   grown, and eventually shared between users. Cheap, and it compounds.
3. **Looks and cue stacks lifted from another showfile** — "bring last year's gala
   looks into this show" (also listed under §7.9). High value for repeat events.
4. **3D models** (`glTF/OBJ`) for set pieces, custom scenery, client-branded
   props, unusual backline. **STRONG but guard it:** an import path is easy, a
   *well-behaved* import (scale, up-axis, materials, poly budget, licence
   provenance) is not. Ship with a validating importer and a poly-count warning,
   or the first 40 MB Sketchfab download will tank the frame rate and it'll read
   as the app's fault.

On "generate": for effects and media, generation belongs to §9 — Claude composing
an effect preset from a description is just §7.6 parameters over the MCP surface
(crisp, genuinely useful). Generating *video content* for LED walls is a different
product entirely; **KILL for v1**, revisit never unless a client pays for it.

### 11.10 Small things that buy disproportionate goodwill — **NICE** (build them on quiet afternoons)

- **Metric/imperial toggle**, and trim heights everywhere rather than raw Z.
- **Mirror mode:** edit stage-left, stage-right follows. Every LD wants this.
- **Named colour picker** with gel references (Lee/Rosco numbers), not just RGB.
- **A "show me the DMX" inspector** — the thing that converts a curious non-LD
  into someone who understands their rig, and it costs almost nothing.
- **Notes pinned to fixtures and positions** ("this one flickers", "cable runs SL").
- **Undo history as a visible, labelled list** — doubly valuable with an AI
  operator.
- **Fixture count / weight / power badge always visible** in a corner. Ambient
  awareness beats a report nobody opens.
- **"Explain this look"** — Claude writes the paragraph that goes in the client
  deck. Two minutes of work, used every single time.

---

## 12. Benchmark: Vectorworks Spotlight

> *Owner directive: "we should take some features and inspo as to the quality from
> Vectorworks Spotlight."* Good instinct, right benchmark — with one hard caveat
> stated up front, because it frames everything below.

**Spotlight is a CAD suite with lighting intelligence on top. Świetlik is a previz
tool with documentation on the side.** Those are different products, and we lose
every fight we pick on Vectorworks' own ground — a 2D drafting engine with design
and sheet layers, classes, viewports, dimensioning, titleblocks, DWG interop and
BIM is *decades* of work and it is their actual moat. So the rule for this entire
section: **steal what Spotlight does with rig *data*; decline everything it does
with *drawings*.**

Where Spotlight genuinely is the industry standard — and where we should copy it
without embarrassment — is that it treats a lighting rig as a **database that
happens to have a 3D view**, and generates every document from that database. That
is the benchmark, and it is entirely achievable for us.

### 12.1 The one architectural lesson — **MUST** · P2 · crisp

**One source of truth; every document is a view of it; no number is ever typed
twice.** Vectorworks' whole value proposition in this market is that the plot and
the paperwork *cannot disagree*, because both are generated from the same Lighting
Device objects. Change a fixture's purpose in the model and the plot label, the
instrument schedule and the channel hookup all change with it.

This is a commitment, not a feature. Concretely, for us:

- The paperwork generator reads the **same `$show` model** the renderer reads.
  There is no "documentation mode", no export-then-edit step, and no field on a
  report that a user can type into.
- Reports are **live views** — which in a reactive Vue app is nearly free.
  Vectorworks had to build bidirectional database worksheets to get what
  `reactive(ShowSingleton)` hands us by default. This is one of the few places our
  architecture is *ahead* of theirs, and we should exploit it: a spreadsheet view
  of the patch that edits the rig when you type in it.
- Combined with §1's MCP rule, Claude can author paperwork and fix the rig through
  the same surface, and the documents follow automatically.

### 12.2 ADOPT — steal these

| # | Spotlight feature | Why | Rank | Phase | Build |
| --- | --- | --- | --- | --- | --- |
| 1 | **Data-rich fixture record** — `purpose`, `color`, `gobo`, `channel`, `dimmer`, `circuit`, `unit number`, `position`, `notes`, `weight`, `power` as first-class fields on every fixture | **The enabling data model for all paperwork.** We have OFL channels and an XYZ and nothing else. Without `purpose` and `unit number` there is no schedule, no hookup, no plot label — no documentation at all. | **MUST** | P2 | crisp |
| 2 | **Instrument Schedule / Channel Hookup reports** — generated tables of the rig, sortable by position, channel, address or type | The billable artefact. Venues and rental houses consume **tables**, not drawings. | **MUST** | P2/P3 | crisp |
| 3 | **Circuit / power summary** — Spotlight's Instrument Summary takes amperage and voltage per device type and reports the circuit provision needed | Turns §11.5's ambient badge into a document a venue's technical manager can act on. | **MUST** | P2 | crisp |
| 4 | **Label Legends → audience-specific documents** — Spotlight defines which fields appear on a plot label, with labels organised by class so the *electrician's* plot can hide the *designer's* purpose labels | **The best single idea in Spotlight.** One rig, three documents: the electrician sees address/dimmer/circuit, the designer sees purpose/colour/gobo, the client sees a clean picture with no numbers at all. Ship as presets, not as a legend editor. | **MUST** | P3 | crisp |
| 5 | **Auto-numbering with patterns** — 2026 added manual / linear / circular numbering directions plus an exclude-ambiguous-characters field | Unit numbers matter as much as DMX addresses for paperwork, and "number these left-to-right along the truss" *is* our §6.4 drop order. Extends auto-patch rather than adding a system. | **STRONG** | P2 | crisp |
| 6 | **LED wall reports** — the 2026 LED Video Wall tool reports size, pixel resolution, power and data requirements | Nearly free once §6.5 exists, and it is the number every AV supplier asks Jake for. | **STRONG** | P2/P3 | crisp |
| 7 | **False-colour rendering** — Showcase 2026 added a false-colour mode | **A feature I missed and should not have.** An intensity/coverage heat map answers "is the stage evenly lit, are faces lit, is there a hole at the drum riser" *objectively*. Cheap in a shader, and it reads as serious engineering to a working LD. | **STRONG** | P3 | crisp |
| 8 | **Showcase's fog vocabulary** — `Scale`, `Pocket Density`, `Turbulence`, `Directional Velocity` | Direct validation of §6.10, and it is becoming the industry's shared vocabulary. Adopt the **terms** in pro mode; keep the simple layer's single slider. | **NICE** (vocabulary only) | P3 | crisp |
| 9 | **Hoist report** — a generated list of hoist loads and positions | Pairs with §11.5. A table of points with indicative loads is a real pre-production document. | **STRONG** | P2 | crisp |
| 10 | **Reusable, shareable resource styles** — label legends, tag styles and symbols saved to a Resource Manager for reuse across projects and offices | Exactly §11.9b's portable content, applied to *document templates*. "Our house paperwork format" is a genuine agency asset. | **NICE** | post-v1 | crisp |
| 11 | **MVR-xchange** — 2026's networked MVR sharing between applications and team members | Upgrades §11.2's ambition from "open the file someone emailed" to "stay in sync with the drafter". Note it; don't build it until MVR import works. | **NICE** | post-v1 | research-y |

### 12.3 ADAPT — take the idea, not the implementation

- **Event design / seating layouts.** Spotlight drafts seating areas, tables and
  space plans. We take only what serves lighting: **audience and table blocks for
  sightlines, scale and occlusion** (already §6.6/§6.9). We do *not* become a
  floor-plan or seating-chart product — different buyer, bottomless feature set.
- **Braceworks structural analysis.** Adapt to **indicative** load awareness
  (§11.5) and stop there. Braceworks is certified-engineering territory with real
  liability attached, and shipping numbers that *look* like an engineering sign-off
  without being one is the single genuinely reckless thing we could do in this
  product. The disclaimer must be prominent and every figure labelled
  *indicative*.
- **Power planning and cable schematics.** Adapt to a **power summary** (amps per
  phase, distro count, total load) plus a data/universe summary. Skip schematic
  drawing entirely.
- **Data Tag tool.** Adopt the *output* — labels pulling live object data — and
  skip the *authoring environment*. A user-scriptable tag-style editor with report
  formulas is a power-user tool our primary user will never open. Ship a handful of
  excellent built-in label presets (#4 above) instead.

### 12.4 SKIP — ruthlessly, listed so nobody re-litigates it

| Skipped | Why |
| --- | --- |
| **A 2D drafting engine** — design/sheet layers, classes, viewports, dimensioning, annotation, titleblocks with revision management, line-weight control | Years of work, their moat, and beside the point for previz. We **generate** documents; we are not a drafting environment. |
| **DWG / DXF / IFC / BIM interop** | MVR is our interchange format (§11.2). Architectural interop is a different business. |
| **General CAD modelling** — solids, NURBS, site models, walls/doors/windows | Import a glTF (§11.9b) or model it elsewhere. |
| **Certified structural analysis** | See §12.3. Liability. |
| **ConnectCAD / AV signal-flow schematics** | Separate product, separate buyer. |
| **Project Sharing (multi-user file check-out)** | Our multi-user story is the hosted, shareable model of §11.3, not file locking. |
| **2D manufacturer symbol libraries for audio/video/staging** | We need **3D assets** (§6.9), not plan symbols. Different artefact — don't conflate them. |
| **A worksheet formula language** | Generate the reports. Do not ship a spreadsheet DSL. |
| **Previz as a separate application** (their Vision / Showcase split) | Our whole premise is that design and previz are the same window. Here we are *structurally better*, not behind. |

### 12.5 What "Spotlight quality" means as a bar for us — honestly

Not render quality. Our Three.js path plus §10 will comfortably out-pretty
Spotlight's viewport. The bar Spotlight actually sets is **documentation that
survives contact with a venue**, and the honest test is three questions:

1. **Could Jake email the generated instrument schedule and power summary to a
   hotel's technical manager and get back "fine" instead of three clarifying
   questions?** That is the acceptance criterion for §9.6, and it is testable with
   one real venue.
2. **Does everything update from one edit?** Move a fixture in 3D → schedule,
   hookup, kit list, power summary and plot all change, with no manual step and no
   stale PDF. If any document can go out of date, we built the wrong thing.
3. **Is every number derived, never typed?** If a user can type a value into a
   report, the report is a document rather than a view, and it will eventually lie.

Two honest caveats, so nobody over-promises:

- **We will not match Spotlight's printed plot, and should not try.** A properly
  drafted 1:50 plot with correct line weights, a keyed symbol legend, a titleblock
  and revision clouds is a drafting achievement, and chasing it drags us straight
  into §12.4. **Our realistic bar: a clear, correctly-scaled, accurate A3 landscape
  PDF with a legend and a title block.** Good enough that a venue can hang from it;
  not good enough to win a drafting award. Write that into the spec so it doesn't
  quietly expand.
- **For Jake specifically, the tables matter more than the drawing.** Rental houses
  and venues act on schedules, kit lists and power figures. A beautiful plot mostly
  impresses *other lighting people*. Rank accordingly — which is exactly the change
  below.

### 12.6 Ranking changes this forces

Four material revisions to earlier verdicts, each noted inline at its own site:

1. **§9.6 Paperwork and deliverable generation: STRONG → MUST**, and **split in
   two** — paperwork **tables** (instrument schedule, channel hookup, circuit/power
   summary, hoist report, kit list) = **MUST, P2/P3**; the **graphical plot PDF** =
   **STRONG, post-v1**. Spotlight's market position is the proof that documentation
   is the billable artefact, and tables are both cheaper to build and more used
   than drawings.
2. **New MUST, previously absent entirely: the data-rich fixture record**
   (§12.2 #1). A prerequisite that existed nowhere in this document, *tiny* to
   build — a metadata object on `Fixture` — and nothing in §9.6 can exist without
   it. Belongs in P2 alongside auto-patch (§6.4). **Cheapest unblocking item in the
   whole vision.**
3. **§11.5 Physical sanity checks: STRONG → MUST**, re-scoped as explicitly
   *indicative, not engineering*. A paperwork pack is only worth sending if its
   numbers are trustworthy, so weight and power stop being an ambient badge and
   become **report columns**.
4. **§10 rendering: add false-colour / coverage view as a new STRONG** (P3). It was
   missing, it is cheap, and it is the most LD-credible idea to come out of this
   benchmark.

Plus one scope extension at unchanged rank: **§6.4's auto-patch becomes
auto-*numbering***, assigning unit numbers and circuits alongside DMX addresses,
using Spotlight's linear/circular pattern idea over our drop order.

**Sources:** [Spotlight overview](https://www.vectorworks.net/en-US/spotlight) ·
[Spotlight capabilities](https://www.vectorworks.net/en-US/spotlight/capabilities) ·
[Entertainment features in 2026](https://www.vectorworks.net/en-US/newsroom/entertainment-vectorworks-2026) ·
[Label legends](https://app-help.vectorworks.net/2021/eng/VW2021_Guide/LightingDesign1/Setting_up_label_legends.htm) ·
[Instrument summaries](https://app-help.vectorworks.net/2021/eng/VW2021_Guide/LightingDesign2/Creating_instrument_summaries.htm) ·
[Data tags](https://app-help.vectorworks.net/2025/eng/VW2025_Guide/Annotation2/Concept__Data_tags.htm) ·
[Event design](https://app-help.vectorworks.net/2026/eng/VW2026_Guide/EventDesign1/Advanced_event_design.htm) ·
[Cables and power planning](https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Cables/Cables_and_power_planning.htm)

---

## 13. North star — Jake's Monday

> It's Monday, 09:40. The brief landed on Friday: a 400-person awards dinner at a
> hotel ballroom, client branding is deep blue and gold, there's a stage with a
> lectern and a 6 × 3 m LED wall, an eight-piece band for the after-party, and the
> client wants to see "something impressive" by Wednesday.

**09:41 — The room.** Jake opens Świetlik. It comes up in **Build** mode, the
panels exactly the width he dragged them to last week. He clicks **Ballroom**. He types the
three numbers off the venue's spec sheet: 28 × 18 m, 5.8 m to the ceiling. He
drags the stage block to 12 × 6 m and sets it 600 mm high. The viewport is already
a room with a dark floor and a back wall, not a checkerboard. He adds black legs
on both sides with one click. *Elapsed: four minutes.*

**09:45 — The rig.** He types into the command palette: *"awards dinner, blue and
gold branding, lectern plus an 8-piece band later, mid-range budget."* Claude
comes back with three options. He picks **"Looks expensive"**: an upstage truss on
four hoists, two side goalposts, a floor package behind the band, and a small FOH
bar on the ballroom's existing rail. 34 fixtures. They are placed, addressed
across two universes, and sorted into positions named `Upstage`, `SL Tower`,
`SR Tower`, `Floor`, `FOH`. Jake has not seen a DMX address and does not know that
universe 2 starts at channel 1 of a Robe. A badge in the corner reads
**34 fixtures · 412 kg · 18.4 A · 2 universes**, in green. *Elapsed: nine minutes.*

**09:54 — The wall.** He drops an LED wall object upstage-centre, types `12 × 6
panels @ 500 mm`, and drags the client's key visual onto it. The wall lights the
back of the stage. The render stops looking like a lighting diagram and starts
looking like an event. *Elapsed: twelve minutes.*

**09:58 — The people.** He picks the **8-piece with horns** band preset. A drummer
appears on a riser behind a kit, bass and guitar at their mics, keys stage-left,
three horns upstage-right, wedges in front of each of them, backline against the
upstage drape, and a ground-stacked PA either side because the ballroom won't take
a flown hang. He nudges the drum riser 800 mm stage-right. Immediately he can see
that the SL tower's lowest fixture is firing straight into the guitarist's face,
so he raises it two rungs. He also drops in a **lectern + presenter** figure for
the awards section. The viewport has stopped being a diagram. *Elapsed: eighteen
minutes.*

**10:04 — The air.** Haze slider to **light** — every beam in the room becomes
visible and the render gains a stop of depth for one click. He drags two fog
machines into the wings and a low-fog unit under the front of the deck, because
the client's brief said "something impressive" and a first-dance reveal out of low
fog is what that phrase always means. *Elapsed: twenty-four minutes.*

**10:10 — The looks.** "Give me a walk-in look: warm, low, elegant, faces lit at
the lectern." Claude builds it from the amber palette, aims four FOH units at the
lectern by geometry — the lectern being an actual object with an actual head
height — and puts a soft gold wash on the drape. Jake drags the intensity of the
back wall down 15 % because he can see it's fighting the screen, and presses
**Save this as → "Walk-in"**. A thumbnail appears on the Looks shelf.

Then: *"same but for the awards moment — big, gold, a shaft of light on the
winner"*, and he fires the low fog under it to see the shaft actually read. Then
*"now the band"* — he drags the client's walk-in track and the band's opener onto
the **timeline**, the beat grid snaps in, and he adds **Chase Left→Right** from the
effects presets with Speed on `1/4` and Spread at 60 %. It runs in time with the
music. He puts a CO₂ hit on the first chorus marker because he can, and because
the client will screenshot exactly that frame. Six looks on the shelf. *Elapsed:
fifty-one minutes.*

He switches to **Show** mode — `Alt+E` — and the workspace becomes a timeline.
Each group is a track; he drags the six looks onto them and pulls their edges
until the awards moment lasts as long as the speech will. He opens the automation
lane under `Floor Beams` and drags a single breakpoint so the tilt creeps up
through the last eight bars, because Claude's version moved too fast. That lane
is the thing he could never find before, and it took him one disclosure triangle
to reach.

And it *feels* right. He hits **Freeze** mid-chase and the stage holds — lights
stay where they are, nothing goes dark. He hits it again and the chase carries on
from where it was, in time, instead of snapping back to bar one. He hits **Let go**
and the whole look fades away over two seconds like a real rig releasing. Nothing
in the app cuts to black unless he presses the black button.

**10:37 — The check.** Jake clicks **Check my show**. Four findings: two fixtures
on the SR tower are in no look at all; the awards look has no front light on the
lectern (faces will be dark on the broadcast feed); one floor beam crosses the LED
wall and will wash it out; the walk-in look's 0 s fade should probably be 5 s. He
accepts three fixes, rejects one — he *wants* that beam grazing the screen. Every
change is one undo step, labelled, in a list.

**10:46 — The deliverable.** He picks the **Shot List**: four named cameras ×
six looks = 24 renders, exposure set one stop down so they look like show photos
rather than product shots. Then a 40-second MP4 walking the cue stack with the
client's walk-in track underneath. Then **Share** → a link with the client's name
on it, where they can orbit the room and press the six looks themselves.

**10:58 — The paperwork.** One more palette command: *"produce the pack"*.
Instrument schedule and channel hookup, both sorted by position; a circuit and
power summary that says exactly what the ballroom has to provide; a hoist report;
a kit list priced off his rate card; and a cue list whose note column is written in
sentences a client can read. Every number on every page came from the model — he
typed none of them, and when he moves a fixture tomorrow they all change by
themselves. He picks the **electrician's** label preset for the plot, so it shows
addresses and circuits instead of the designer's colour notes. He pastes the kit
list straight into the rental enquiry, the power summary into the venue email, and
the shareable link into the client's.

**11:06.** Jake closes the laptop. Eighty-five minutes from brief to a client-ready
pitch, a buildable rig, a costed kit list, and a link. On Wednesday the client
asks for "more blue, less gold" and it takes four minutes. On the Thursday of the
show, the LD hired for the day imports the MVR into her grandMA3, points her
console's Art-Net back at Świetlik on Jake's laptop at FOH, and busks the band off
a rig she did not have to design — from a previz that already matched the room.

That last paragraph is the whole product: **Jake gets paid on Monday, and the
professional on Thursday finds the tool useful rather than insulting.** Every
ranking in this document is an attempt to serve both of those people with one app.

But note where the story actually turns. It is not the venue template, or the AI,
or the render. It's the sentence *"and it feels right"* — freeze holds, resume
continues, release fades. If that paragraph isn't true, none of the rest of the
Monday happens, because Jake closes the laptop at 09:50 and opens PowerPoint
instead. **Build §3 first.**
