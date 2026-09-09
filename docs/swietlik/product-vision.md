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

**Build** — `crisp` = spec-able and unit-testable today, no unknowns.
`research-y` = needs a throwaway spike before anyone estimates it.

**Layers** — every feature states **Simple** (Jake, non-LD, Monday morning, wants
a picture) and **Pro** (a programmer who has sat behind an MA3 for a decade).
Per the roadmap these are *progressive disclosure on one object graph*, not two
apps. Rule I'd enforce: **the simple layer never writes anything the pro layer
cannot see and edit.** Simple mode is a lens, never a separate data model.

---

## 1. The positioning bet (read this before the feature lists)

Three bets, ranked by how much they change the product:

1. **Świetlik's fastest route to credibility with working LDs is being a great
   *visualizer*, not a great console.** MA3, Avolites and MagicQ have thirty
   years of muscle memory behind their programmer. Nobody will relearn that in a
   browser tab. But every one of those LDs wants a previz they can point their
   own console at, that opens in a browser, that costs less than Depence R4's
   €2,395-per-module Windows-only licence, and that their client can look at
   without installing anything. **Art-Net/sACN input + MVR/GDTF import are worth
   more for LD adoption than any programming feature we could build** (§6.1,
   §6.2).
2. **Świetlik's fastest route to Jake using it weekly is the client-facing
   deliverable, not the rig.** An events agency does not get paid for a patch
   sheet; it gets paid for winning the pitch and surviving the site visit. So:
   render, MP4, shareable read-only link, kit list, power/weight sanity check
   (§6.3–§6.6).
3. **"Claude as co-designer" is the genuine differentiator and it is strongest at
   the boring end.** Natural-language look generation demos well. *Fixture
   substitution, show doctoring and paperwork generation* are what make it
   indispensable (§4). Build the boring ones first; they are also the ones with
   verifiable correct answers, which means they are testable.

Corollary to (3), and the most important architectural opinion in this document:
**everything the UI can do, the MCP surface must be able to do, and vice versa.**
The Phase 1 registry is not a side door — it is the app's actual API, and the UI
is one client of it. If the stage builder (P2) grows mutation paths that bypass
the command registry, Claude becomes a second-class operator and the whole
differentiator rots. Budget for `stage_*` commands *in the same PR* as the
builder feature, not in a catch-up phase.

---

## 2. Stage builder end state

**Target:** a non-LD goes from empty app to a venue a client recognises, with a
believable rig in it, in **under ten minutes**, having never typed a DMX address.

Today: a 50 × 50 m checkerboard `BoxGeometry` floor and an infinite grid helper
(`visualizer.js` ~L254–300), fixtures placed by numeric field or `TransformControls`
gizmo. There is no room, no truss, no hang-position concept.

### 2.1 Venue templates — **MUST** · P2 · crisp

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

### 2.2 Hang positions as the core abstraction — **MUST** · P2 · crisp

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

### 2.3 Truss assembly — **MUST** · P2 · crisp

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
  ceiling, span-between-points loading readout (§6.5), sub-hung secondary truss.
- **Steal from:** Capture's and Vectorworks' *click-click-done* line tool with
  live numeric readout in the cursor (length and angle follow the mouse, and you
  can type the length mid-drag to commit exactly). That "type to override the
  drag" behaviour is the single interaction that separates pro CAD from toy
  builders and it is cheap to implement.
- **Buildability:** crisp. Truss is a generated geometry + a metadata record.
  Keep the rendered truss as cheap instanced chord/diagonal geometry; resist the
  urge to import manufacturer CAD until P3.

### 2.4 Drag-and-drop fixture placement with auto-patch — **MUST** · P2 · crisp

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
  path (§6.4).
- **Buildability:** crisp. `findChStartAutoPatch` already exists and the Phase 1
  `patch_fixture` composite already owns the two-step OFL→`addRaw`→`patchFixture`
  dance. Auto-patch-on-drop is mostly a policy object over that. Unit-testable
  exhaustively, which is rare and valuable — write those tests.

### 2.5 LED walls as first-class emissive surfaces — **MUST** · P2/P3 · crisp→research-y

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

### 2.6 Drape, decks and set — **STRONG** · P2 · crisp

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

### 2.7 Parametric rig templates ("the obvious festival rig") — **STRONG** · P2 · crisp

One-line: one click produces a complete, conventional, *sane* rig for the chosen
venue template — FOH truss, mid truss, upstage truss, floor package — correctly
counted and addressed.

Blank-page paralysis is the real failure mode for a non-LD. Giving Jake a
defensible starting rig he then edits is worth more than any number of individual
placement tools. This is also the best possible input to §4.2 (Claude suggesting
rigs) — the AI picks and parameterises a template rather than inventing geometry
from nothing, which is both better and far more testable.

- **Simple:** "Suggest a rig" → three options labelled in client language
  ("tight budget", "looks expensive", "festival energy") with fixture counts.
- **Pro:** templates are editable, savable, shareable; counts and spacings are
  parameters; positions come out correctly named.
- **Buildability:** crisp. Templates are data. This is an afternoon of JSON plus
  a generator, and it will do more for first-run experience than a month of
  gizmo polish.

### 2.8 2D plan/section view alongside 3D — **STRONG** · P2/P4 · crisp

One-line: an orthographic top-down (and front) view with snapping, because
**nobody can place objects accurately in a perspective viewport**.

Every serious tool in this space is primarily a 2D plan with a 3D preview, not
the reverse. Capture, WYSIWYG and Vectorworks all work this way. Attempting the
whole builder in a perspective orbit camera will feel bad no matter how good the
gizmo is.

- **Simple:** a "Top view" button that locks the camera to plan and turns on grid
  snap. That alone fixes 80 % of the problem.
- **Pro:** true ortho plan/front/side with dimensions, a measure tool, layer
  visibility, and eventually a printable plot (§6.3).
- **Buildability:** crisp (an ortho camera and a snap mode). Printable plot is a
  separate, larger item.

### 2.9 What else to steal, interaction-wise

| Source | Behaviour worth copying | Rank |
| --- | --- | --- |
| Capture / Vectorworks | Type a number mid-drag to commit an exact length/angle | **MUST** |
| Capture | Drag from the console-patch list onto an existing fixture to associate it (their 2026 "Import At Position" idea) — our version: drag an MVR/console fixture onto a placed one | STRONG |
| WYSIWYG | Fixture *symbols* carrying their own paperwork metadata, so the plot and the patch can never disagree | STRONG |
| Depence R3/R4 | Plot pages with fixture symbols annotated with DMX/circuit/ID, multi-page PDF export in one click | STRONG (§6.3) |
| Capture 2026 | Pinning "Generic" fixtures/truss to the top of the library list — trivial, and makes first-run vastly faster | NICE |
| Blender/Maya | `F` to frame selection; modifier-held snapping | **MUST** (§3) |
| SketchUp | Inference lines / guides while drawing | NICE |
| **KILL** | Full CAD (booleans, NURBS, constraint solving, DWG import). Świetlik is not a drafting tool. If someone needs that, they should draft in Vectorworks and bring in MVR. |

---

## 3. Show design end state

**Target:** someone who has never touched a console builds a look they are proud
of, and a programmer can still work fast enough not to be insulted.

The honest framing: Świetlik is a **previz and design tool, not a show-control
console**. That licence lets me drop a large amount of console machinery, and
dropping it is what makes the simple layer possible.

### 3.1 What I borrow from real consoles

| Borrowed | From | Why it survives |
| --- | --- | --- |
| **Palettes / presets** (position, colour, beam, gobo) as *referenced* values | MA2/MA3 presets, Eos palettes | The single most important programming concept there is. Change "Drum Riser" once, every cue that used it updates. Non-negotiable. |
| **Groups as the primary selection unit** | every console | Already in the app. Keep. |
| **Selection-then-action ordering** | every console | "pick who, then say what" is universal and beginner-intuitive. |
| **`@` intensity entry** | Hog / Eos | `@ 50 ⏎` is muscle memory for every programmer and genuinely faster than a slider for non-programmers too. |
| **Highlight / solo** | MA "Highlight", Eos "Hilite" | "which light is this?" is the #1 question in a rig. Cheap, enormous. |
| **Flash-on-hold vs latch** for playback buttons | Avolites / MagicQ | The core busking primitive. |
| **FX with size / speed / spread-between-heads** | MagicQ FX engine | The three-parameter mental model is the right one (§3.5). |
| **Tracking-free cue lists** | Hog/Chamsys cue-only behaviour | See the kill list. |
| **Executor grid / playback pages** | MA executors, Chamsys playbacks | The busking surface (§3.6). |

### 3.2 What I deliberately drop

| Dropped | Why |
| --- | --- |
| **Tracking and cue-only/track-through semantics** | The #1 source of "why did that light come on" confusion. For previz, every cue stores an explicit, complete state. Snapshot semantics. Slower to program, impossible to misunderstand. If a pro needs tracking, they're programming on their console anyway. |
| **Command-line syntax as the *primary* input** | `Group 4 At 50 Please` is fast and unlearnable. Offer it in pro mode as an accelerator (§3.8), never as the path of least resistance. |
| **Multi-user / session / backup-gateway machinery** | Not a show-critical system. |
| **Timecode chasing, MSC, MIDI show control, macros, plugins** | Show-control surface area with zero previz value. (An audio-file timeline for previz-against-the-track is different and is STRONG — §6.9.) |
| **Parking, inhibitive masters, grand-master law nuance, DMX curves per channel** | Pro-console hygiene features for a live rig we do not have. |
| **Fixture profile *editing*** | Profiles come from OFL/GDTF. Hand-editing invites exactly the kind of silent error that ruins trust. Report bad profiles upstream instead. |

### 3.3 Palettes and presets — **MUST** · P1+/P4 · crisp

One-line: named, reusable, referenced values for position / colour / beam / gobo,
stored once and pointed at by looks and cues.

- **Simple:** they're just "Spots" with human names, created by a button that
  says **"Save this as…"** after the user has made something they like. Colour
  palettes ship pre-populated with *named theatrical colours* ("Congo Blue",
  "Bastard Amber", "Open White", "3200 K", "Hot Pink") — not RGB sliders. Position
  palettes get *semantic* names tied to the venue ("Drum Riser", "Lectern",
  "Centre Stage", "Audience", "Back Wall") and §4.3 fills them automatically.
- **Pro:** per-fixture-type and per-fixture storage granularity (the MA distinction
  that makes palettes portable across rig changes), "update preset" propagation
  with a preview of affected cues, hard/soft value inspection.
- **Buildability:** crisp *if* done as references not copies. This is a data-model
  decision that must happen before cues get rich, or retrofitting it is a rewrite.
  Put it early.

### 3.4 Newcomer-sensible groups — **MUST** · P2/P4 · crisp

One-line: groups that exist before the user makes any, named the way people
actually talk.

When fixtures are placed on positions (§2.2), groups can be *generated*:
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

### 3.5 Look building — **MUST** · P2/P4 · crisp

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

### 3.6 Effects engine UX without the jargon — **MUST** · P3/P4 · crisp

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
- **Watch out:** "Spread" must be defined against **group order** (§3.4), so
  group-order tooling is a prerequisite, not a nice-to-have.

### 3.7 Cue stacks *and* a busking grid — both **MUST**, different jobs · P4 · crisp

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
  most of it. Mostly a UI and a keymap (§3).

### 3.8 Pro accelerators — **STRONG** · P4 · crisp

One-line: an optional command line and a command palette, so speed is available
without being mandatory.

- **Command palette (`Ctrl+K`)** — fuzzy, natural-language-tolerant, the bridge
  between UI and AI. "blue wash" / "add 6 spots to mid truss" / "export render".
  This is *also* the honest front door for §4, because it lets an AI request look
  exactly like a UI action. **MUST**, see §3 keymap.
- **Terse command line (backtick)** — `g4 @ 50`, `pos drums`, `rec look 12`.
  A pro-mode affordance. STRONG, not MUST.

### 3.9 Save / recall — **MUST** · P2 · crisp

One-line: autosave, named versions, and never lose work.

- **Simple:** it's just saved. Always. A "Versions" list with timestamps and
  auto-generated thumbnails. "Before the client call" restore points.
- **Pro:** explicit save-as, showfile diff (§6.7), per-element import ("bring the
  looks from last year's gala into this show" — *very* high value for an agency
  with repeating events).
- **Buildability:** crisp locally (the `.asls` format and `persistLocally` exist).
  The multi-user/SaaS story is a deliberately deferred architectural concern the
  roadmap already flags — just don't assume a filesystem anywhere new.
- **KILL:** a bespoke binary format. Keep `.asls` JSON; it is the thing that makes
  versioning, diffing and AI editing possible at all.

---

## 4. Keyboard control

A concrete proposal. The app currently has **five uncoordinated `window`-level
`keydown` listeners** and they already conflict with each other; any keymap work
must start by fixing that.

### 4.1 Existing bindings (verified in source)

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

### 4.2 The three real conflicts, and my ruling

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

### 4.3 The prerequisite: one keyboard router — **MUST** · P4 (do it first) · crisp

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

### 4.4 Proposed keymap

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
| `Ctrl+Space` | Release all / stop all |
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
| `` ` `` | Terse command line (pro) |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo (**reclaimed**) |
| `Ctrl+S` | Save version · `Ctrl+Shift+S` save as |
| `Del` / `Backspace` | Delete in context (unify the four existing handlers) |
| `?` | Shortcut sheet |
| `F11` or `Shift+V` | Full-screen visualizer (presentation mode — you will use this in front of clients constantly) |

**KILL:** a numeric-keypad console emulation layer, and encoder-wheel MIDI
mapping for v1. Both are pro-operator comforts for a product whose pros will be
using their own console as the input device anyway (§6.1).

---

## 5. AI-native features

Where "ask Claude" genuinely beats any UI — and where it's theatre. The test I
apply: *does the task have a verifiable correct answer, is it tedious, and does it
require holding a lot of context at once?* Three yeses = build it. Mostly
aesthetic judgement with no verifiable answer = suspicious.

### 5.1 Fixture substitution — **MUST** · P1+ · crisp

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
- **Build:** crisp, given palettes are *references* (§3.3). Testable: assert
  channel-function coverage and palette validity after a swap.

### 5.2 Rig suggestion from a venue / brief description — **MUST** · P1+ · crisp

One-line: paste the client brief, get a rig.

*With one hard constraint:* Claude selects and parameterises the **rig templates
from §2.7**, it does not free-form geometry. That makes it reliable, inspectable,
fast, and testable. Free-form generation produces trusses floating at 11.3 m in a
room with a 6 m ceiling and destroys trust in one shot.

- **Simple:** paste brief → three named options with fixture counts and a render.
- **Pro:** Claude explains its reasoning and *cites the constraints it respected*
  (trim, sightlines, power, count budget), and every choice is editable.
- **Build:** crisp once templates exist. Validate output against venue geometry
  *programmatically* — never trust the model's arithmetic about clearances.

### 5.3 Show doctoring / design critique — **MUST** · P1+ · crisp

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

### 5.4 Auto-focus positions — **STRONG** · P1+ · crisp

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

### 5.5 Natural-language look generation — **STRONG** (not MUST) · P1+ · crisp

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
- **Build:** crisp (it's §3.5 look-rows + §2.4 groups + §3.3 palettes via MCP).
- **Essential guard rail:** every AI mutation must be **one undo step** and
  visibly attributed ("generated by Claude — accept / tweak / discard"). Trust in
  an AI-native tool is built entirely out of reversibility.

### 5.6 Paperwork and deliverable generation — **STRONG** · post-v1 · crisp

One-line: "produce the pack" → plot PDF, patch sheet, instrument schedule, kit
list, power summary, cue list with notes.

Boring, tedious, verifiable, and it is literally the billable artefact. Claude
assembles and writes the prose (the cue-note column, the scope paragraph for the
client); the app generates the numbers. See §6.3/§6.6.

### 5.7 Gimmick list — **KILL**, with reasons

| Idea | Why it's a trap |
| --- | --- |
| **"Drop an MP3, get a programmed show"** | Beat detection is easy; *taste* and *structure* are the job. It will produce something that strobes the chorus and reads as an AI toy. Ship beat-grid + section markers + "suggest a cue per section" as an *assist* (§6.9) and never as the headline. |
| **AI busking the show live** | Latency, non-determinism, and no LD will ever hand over the faders. Also there is no undo during a show. |
| **Chat as the only interface** | Chat is a great accelerator and a terrible primary UI for spatial, continuous, and comparative work. Every AI action must have a UI equivalent. |
| **AI-generated fixture profiles** | A hallucinated DMX map is a *dangerous* artefact — it can send a real fixture to a real position at a real venue. Profiles come from OFL/GDTF only. Hard rule. |
| **"AI lighting designer" as the product positioning** | Working LDs will reject the tool on sight and Jake's clients don't care who drew it. Position it as *your* tool that happens to have an extremely fast assistant. |
| **Auto-colour-matching from a brand logo** | Sounds great, is two clicks in a colour picker, and brand hex values map badly to fixture gamuts anyway. Tiny NICE at best. |

---

## 6. Rendering priorities from an LD's eye

Ranked by **client-impact per unit of effort** — i.e. what makes a client say
"yes, that's the show", not what's technically impressive. Capture's 2026 release
notes are instructive here: their headline realism work was *smoke, bloom, lens
flare and image settings*. Not global illumination.

| # | Item | Impact | Effort | Phase | Build |
| --- | --- | --- | --- | --- | --- |
| 1 | **Haze that behaves like haze** | Enormous | Medium | P3 | research-y |
| 2 | **Bloom + exposure + tone mapping** | Very high | Low | P3 | crisp |
| 3 | **Dark room + drape** (§2.6) | Very high | Low | P2 | crisp |
| 4 | **Emissive fixture faces / lens glow** | High | Low | P3 | crisp |
| 5 | **Beam falloff + shape fidelity** | High | Medium | P3 | crisp |
| 6 | **Camera presets & lens control** | High | Low | P3/P4 | crisp |
| 7 | **Still + video export** | High | Medium | P3 | crisp |
| 8 | **LED wall content** (§2.5) | High (Jake's market) | Medium | P2/P3 | crisp |
| 9 | **Human figures for scale** | Medium-high | Low | P2 | crisp |
| 10 | **Gobo projection + rotation + prism** | Medium-high | High | P3 | research-y |
| 11 | **Shadows from truss/set/people** | Medium | Medium | P3 | research-y |
| — | Path-traced / GI offline renderer; photometric lux reporting | — | — | **KILL** | — |

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
190 manufacturer folders that render *approximately* (§6.8).

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

**9. Human figures — STRONG, and cheaper than it sounds.** Simple silhouette
figures: band positions, a lectern presenter, a crowd plane. A render with no
people in it reads as a CAD drawing; the *same* render with four silhouettes reads
as a show. Also the only honest way to judge whether faces are actually lit —
which is the note clients give most often and non-LDs get wrong most often.

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

## 7. Things not yet on the roadmap

Ordered by strategic weight.

### 7.1 Art-Net / sACN **input** — visualize from a real console — **MUST** · post-v1 · crisp

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

### 7.2 MVR / GDTF import and export — **MUST** · post-v1 · research-y

One-line: open the MVR the production's drafter sent; export one the console can
eat.

MVR (My Virtual Rig) is the industry's scene-interchange format — fixtures,
trusses, video screens, groups, layers, DMX addresses, hierarchy — and it's
supported across Vectorworks, Capture, WYSIWYG, grandMA3, Eos and Depence. Without
it, Świetlik is an island, and "rebuild the rig by hand" is a non-starter for any
job that already has a drawing. With it, Świetlik slots into existing workflows as
a *better-looking, cheaper, browser-based* stop on the pipeline. Note GDTF also
supersedes OFL as a fixture source with real geometry and photometrics, which
directly feeds §6.5.

- **Simple:** "Open a rig file" → it appears.
- **Pro:** layer/class mapping, selective import, export with console-ready
  addressing.
- **Build:** research-y. MVR is a zip of XML plus GDTF assets plus 3DS/glTF
  geometry; the spec is large and the real-world files are messy. Budget a proper
  spike, and scope v1 to *import fixtures + truss + addresses* only.

### 7.3 Shareable client link — **MUST** · post-v1 · crisp

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

### 7.4 Console patch export — **STRONG** · post-v1 · crisp

One-line: previz at the desk, export the patch, import it on the console at the
venue.

Even a plain CSV/XLSX patch sheet plus an MVR export saves an hour of error-prone
typing on every load-in. Low effort, instantly respected.

### 7.5 Physical sanity checks — **STRONG** · P2 · crisp

One-line: the app refuses to let you design something that can't be built.

Truss span loading vs point loads (with a published-table lookup, clearly labelled
as *indicative only, not an engineering calculation* — be precise about that
disclaimer), total weight per hoist, power draw per fixture type, amps per phase,
universe/channel budget, data runs and DMX daisy-chain limits, fixture-to-fixture
and fixture-to-truss collisions, and beam angles that clear the stage.

Two reasons this punches above its weight: it's what makes a **working LD trust
the tool** (a pretty render that ignores physics is a toy), and it's what stops a
**non-LD embarrassing himself** (Jake designing a rig that needs three-phase the
venue doesn't have). Deterministic rules, fully unit-testable, and it feeds §5.3
directly.

### 7.6 Kit list, quote and rental integration — **STRONG** · post-v1 · crisp

One-line: the rig generates the gear list, and the gear list generates the number.

Fixture counts, truss lengths and stock, hoists, cabling, consumables, crew and
truck space — priced from a user-maintained rate card, exported as a quote. This is
the closest thing to a feature that *directly makes Jake money*, and the data all
already exists in the rig. (Hard KILL for v1: integrating with any specific rental
system's API — Rentman, Current RMS et al. Export CSV and stop.)

### 7.7 Show versioning and diff — **STRONG** · post-v1 · crisp

One-line: "what changed between v4 and v5?" in plain English.

Ordinarily a nice-to-have; here it's elevated by the AI story. If Claude can
restructure a show in one command, the user **must** be able to see exactly what
it did and roll back precisely. `.asls` being JSON makes a semantic diff
tractable. Treat this as a *safety* feature for §5, not a convenience.

### 7.8 Curated fixture library — **STRONG** · P3 · crisp

One-line: ~100 fixtures that are verified to render correctly, surfaced first;
the other ~190 manufacturer folders still there behind search.

Also: a "generic" set (Generic Spot / Wash / Beam / Strobe / Blinder / PAR /
Batten) pinned to the top for early design before the kit is known — exactly the
move Capture made in 2026 by pinning their Generic section. Beginners should not
have to choose between 40 near-identical Chinese moving heads on their first run,
and a fixture whose beam angle is wrong in the profile undermines §6 silently.
Cheap to do, and it raises the floor on every render.

### 7.9 Audio timeline for previz-against-the-track — **STRONG** · post-v1 · crisp

One-line: load the MP3, mark the sections, scrub the show against it.

Distinct from the "AI programs your show from audio" gimmick (§5.7). This is just
a waveform, a beat grid, section markers and a transport that drives the cue
stack. For any band/DJ/awards work, *designing against the actual track* is how
the job is really done, and it makes video export dramatically more convincing
(a silent MP4 of a cue walk sells far worse than the same MP4 with the track
under it).

### 7.10 Small things that buy disproportionate goodwill — **NICE** (build them on quiet afternoons)

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

## 8. North star — Jake's Monday

> It's Monday, 09:40. The brief landed on Friday: a 400-person awards dinner at a
> hotel ballroom, client branding is deep blue and gold, there's a stage with a
> lectern and a 6 × 3 m LED wall, an eight-piece band for the after-party, and the
> client wants to see "something impressive" by Wednesday.

**09:41 — The room.** Jake opens Świetlik and clicks **Ballroom**. He types the
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

**09:58 — The looks.** "Give me a walk-in look: warm, low, elegant, faces lit at
the lectern." Claude builds it from the amber palette, aims four FOH units at the
lectern by geometry, and puts a soft gold wash on the drape. Jake drags the
intensity of the back wall down 15 % because he can see it's fighting the screen,
and presses **Save this as → "Walk-in"**. A thumbnail appears on the Looks shelf.

Then: *"same but for the awards moment — big, gold, a shaft of light on the
winner"*. Then *"now the band"* — and he adds **Chase Left→Right** from the effects
presets, sets Speed to `1/4` and Spread to 60 %, and watches it run. Six looks on
the shelf. *Elapsed: thirty-one minutes.*

**10:31 — The check.** Jake clicks **Check my show**. Four findings: two fixtures
on the SR tower are in no look at all; the awards look has no front light on the
lectern (faces will be dark on the broadcast feed); one floor beam crosses the LED
wall and will wash it out; the walk-in look's 0 s fade should probably be 5 s. He
accepts three fixes, rejects one — he *wants* that beam grazing the screen. Every
change is one undo step, labelled, in a list.

**10:40 — The deliverable.** He picks the **Shot List**: four named cameras ×
six looks = 24 renders, exposure set one stop down so they look like show photos
rather than product shots. Then a 40-second MP4 walking the cue stack with the
client's walk-in track underneath. Then **Share** → a link with the client's name
on it, where they can orbit the room and press the six looks themselves.

**10:52 — The paperwork.** One more palette command: *"produce the pack"*. Plot
PDF with fixture symbols and addresses, patch sheet, kit list priced off his rate
card, power summary, and a cue list whose note column is written in sentences a
client can read. He pastes the kit list straight into the rental enquiry and the
shareable link straight into the email.

**10:58.** Jake closes the laptop. Eighty minutes from brief to a client-ready
pitch, a buildable rig, a costed kit list, and a link. On Wednesday the client
asks for "more blue, less gold" and it takes four minutes. On the Thursday of the
show, the LD hired for the day imports the MVR into her grandMA3, points her
console's Art-Net back at Świetlik on Jake's laptop at FOH, and busks the band off
a rig she did not have to design — from a previz that already matched the room.

That last paragraph is the whole product: **Jake gets paid on Monday, and the
professional on Thursday finds the tool useful rather than insulting.** Every
ranking in this document is an attempt to serve both of those people with one app.
