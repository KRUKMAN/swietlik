# Świetlik — UX/UI Audit

**Auditor:** senior UX/UI researcher (independent pass)
**Date:** 2026-09-09
**Build under test:** `v1.0.0-rc.1`, build date 2024-08-28, branch `phase-1-mcp`, served at `http://localhost:5173`
**Show under test:** auto-loaded "Demo" — 16× MAC Aura on Universe 0, 4 groups, "Amber Rainbow" chase in Group 0.

---

## 1. Method note

This audit was performed by **driving the running app in Chrome**, not by reading source. Every finding below is
backed by an observed interaction, a screenshot, or a DOM measurement taken live from the page.

What I did:

- Toured every major surface: toolbar + its four menus, patch bay, group pool, visualizer, and the bottom modifier
  strip in all four of its contexts (universe / group / scene-cue / chase).
- Ran the four workflows Jake flagged as painful: add a fixture, create a group, create a cue, resize a panel.
- Opened every popup I could reach (New Project, Create Group, Patch Fixture, Visualizer Settings, Input/Outputs),
  screenshotted each, and **cancelled** every one. No `Save`, `Export`, or `Create` was ever confirmed.
- Took DOM measurements in the page context to turn subjective impressions into numbers (panel heights, widget
  counts, overflow, cursor affordances, tooltip coverage, UI vocabulary).

Two methodological caveats, stated so the evidence can be trusted:

- **Coordinate frames.** The browser's screenshot frame and the page's CSS pixel space are different scales
  (screenshots came back at 1247×795 / 1425×517 / 1568×569 at different moments; the live CSS viewport is
  **3127×1135**). Early in the session two clicks landed off-target because of this. Every finding that depends on
  "I clicked X and Y happened" was re-verified either by clicking the element **by DOM reference** or by reading the
  element's computed state directly. Findings I could not re-verify are marked *(low confidence)* and excluded from
  the ranked list.
- **Two claims were checked against source** rather than by re-triggering a destructive action:
  `FILE ▸ New Showfile` and the transport state machine. Those are the only two places source was consulted, and
  both are cited by file and line.

**Nothing in the repository was modified.** No commit was made.

---

## 2. Global observations (apply to every surface)

These cut across the whole product and are the substrate under most of the per-surface findings.

### 2.1 There are zero tooltips in the entire application

Measured live:

```
document.querySelectorAll('[title]').length          → 0
document.querySelectorAll('[aria-label]').length     → 0
document.querySelectorAll('[data-tooltip],[data-tip]').length → 0
```

Not "few". **Zero.** The app is dense with icon-only controls — the CHANNELS fader strip alone has 14 unlabeled
glyphs (iris, half-disc, triangle, four near-identical arrow pairs, wrench, star, R, G, B, W, ✕) — and not one of
them can be hovered to find out what it does. There is no legend, no status-bar hint, no help menu
(`"help"` appears 0 times in the rendered UI).

This single gap is the largest multiplier on "crazy non intuitive". Every other affordance problem in this document
is made unrecoverable by it, because there is no way for the user to ask the app what something is.

**Heuristics violated:** recognition rather than recall; help and documentation; visibility of system status.
**Severity: Blocker.**

### 2.2 No panel is resizable, movable, collapsible, or hideable

Measured live:

```
elements with class matching /resiz|splitter|gutter|drag-handle|divider/  → 0
elements with cursor col-resize / row-resize / ew-resize / ns-resize      → 0 (outside one timeline clip handle)
```

There is no splitter anywhere in the layout. The patch bay / group pool / visualizer column widths and the modifier
strip height are all fixed by the stylesheet. Jake's report is confirmed exactly: **panel resizing is not
"undiscoverable", it is absent.**

**Heuristic violated:** flexibility and efficiency of use; user control and freedom. **Severity: Major.**

### 2.3 The app has no vocabulary for the things Jake wants to do

Word frequency in the rendered UI (menus open):

| term | occurrences | term | occurrences |
|---|---|---|---|
| song | **0** | palette | **0** |
| setlist | **0** | preset | **1** (only "Color Presets") |
| automation | **0** | snapshot | **0** |
| stop | **0** | pause | **0** |
| blackout | **0** | fade out | **0** |
| help / tutorial | **0** | undo / redo | **0** (outside the EDIT dropdown) |

A user looking for "make the lights do a thing to this song" finds no word in the interface that matches their
mental model. The only preset mechanism that exists in the entire product is the colour swatch row in the colour
picker. There are **no position presets, no movement presets, no group palettes, no snapshots**.

**Heuristic violated:** match between system and the real world. **Severity: Blocker** (this is Jake's issue #2).

### 2.4 Accessibility and keyboard support are effectively nil

The accessibility tree is a flat list of unnamed `generic`/`button`/`textbox` nodes — no headings hierarchy, no
labels, no roles. 56 elements carry `tabindex`, but with zero accessible names a keyboard or screen-reader user
gets an untraversable wall. **Severity: Major** (Minor if the product is explicitly mouse-only forever, but it
also blocks power-user keyboard workflows, which is the opposite of what a console app wants).

### 2.5 Startup is slow, and leaks developer language

The splash screen was still up **>9 seconds** after navigation, displaying the progress string
*"Waiting for views to settle…"* — over a UI that had already fully rendered behind it. It also shows build branch
(`phase-1-mcp`) and build date to an end user.

A Vue render exception is thrown on every load:

```
NotFoundError: Failed to execute 'insertBefore' on 'Node':
  The node before which the new node is to be inserted is not a child of this node.
  at processCommentNode → patch → componentUpdateFn
```

Separately, one screenshot request timed out after 30 s with *"the renderer may be frozen or unresponsive"* — the
main thread does stall under normal interaction. Likely contributor: the group pool renders **1,200
`empty_cue` DOM nodes** (4 groups × 100 rows, plus master and modifier grids) for a show that uses one cue.

**Severity: Major** (perf + trust).

> Screenshot: `screenshot-1788985073599-9.jpg` (splash still up at 9 s over a rendered UI).

---

## 3. Per-surface findings

### 3.1 Toolbar and menus

> `screenshot-1788984997103-3.jpg` (FILE menu) · `screenshot-1788985534788-25.png` region ·
> `screenshot-1788985599756-30.png` (transport)

**What it's for:** file lifecycle, preferences, global tempo, and the play-state readout.

| Menu | Contents |
|---|---|
| FILE | New Showfile *(Shift+N)*, Load Showfile *(Ctrl+O)*, Save Showfile Locally *(Ctrl+S)*, Export Showfile *(Ctrl+Shift+S)* |
| EDIT | Undo *(Ctrl+Z)*, Redo *(Ctrl+Y)* — **the entire edit menu** |
| PREFERENCES | Visualizer *(Ctrl+Shift+V)*, Outputs *(Ctrl+Shift+o)* |
| ABOUT | licence / about popup |

Findings:

- **The transport is a read-only label.** The `▶ PLAYING` indicator is an `<h3>` inside
  `div.state_container` whose computed `cursor` is **`auto`** — it has no click handler and is not a button.
  There is no play, stop, or pause control anywhere in the toolbar. The only interactive things in that whole
  region are the BPM number field and `TAP TEMPO`.
  The source *does* define three states (`toolbar.fragment.vue:264–277` → `stopped` / `playing` / `paused`, each with
  its own colour and icon), so the states exist in the model — **nothing in the UI can reach them.**
  This is Jake's issue #4, and it is worse than "feels dead": there is nothing to press.
  **Heuristics:** user control and freedom; visibility of system status. **Severity: Blocker.**
- **`Shift+N` for New Showfile** is inconsistent with the other three (all `Ctrl`-prefixed) and is a bare
  shift-letter chord — dangerous next to the many free-text name fields in the app.
  **Heuristics:** consistency and standards; error prevention. **Severity: Minor.**
- `(Ctrl+Shift+o)` renders lowercase where every sibling is uppercase. **Severity: Cosmetic.**
- **Undo is invisible.** It exists only as a dropdown item two clicks deep. There is no undo button, no
  history, no indication of what would be undone, and no undo affordance anywhere near the destructive
  operations (deleting cues, re-patching, changing a chase). **Heuristic:** user control and freedom.
  **Severity: Major.**
- The dirty marker is a single `*` prefixed to the show name (`* Demo`) in 11px type in the centre of the toolbar.
  It appeared during the session without an edit I could attribute, and cleared again after cancelling an unrelated
  dialog *(low confidence on the trigger; high confidence that the marker is easy to miss)*.

**Benchmark:** Logic Pro puts a real transport — play, stop, record, cycle, and a bar/beat position readout — in a
fixed, always-visible control bar, and the play button visibly changes state. Świetlik has the readout and none of
the controls. *Instead of a static `▶ PLAYING` chip, give the toolbar a real Logic-style transport cluster:
Play / Stop / Blackout, a bar.beat position display, and a Tap Tempo — with Space bound to play-stop.*

### 3.2 New Project popup (FILE ▸ New Showfile)

> `screenshot-1788985841536-35.png`

One of only two dialogs in the app with explanatory copy. Shows a 3D preview thumbnail, a `Template:` heading with
the sentence *"Please select a new project template from the list below in order to get your new project started."*,
a search box, and two templates: **Blank** and **Demo Show**. CANCEL / CREATE.

- **Good:** preview + prose + named templates. This is the right pattern; it is used in only two places.
- **No unsaved-changes guard.** The show was dirty (`* Demo`) while this dialog was open and the dialog says
  nothing about it. `CREATE` would discard unsaved work with no warning, and undo does not span a project reload.
  **Heuristic:** error prevention. **Severity: Major.**
- Two templates only. No rig/venue starting points ("4-bar wash", "small club", "16× moving head") — the exact
  scaffolding a non-console-trained owner needs. **Severity: Minor.**

### 3.3 Patch bay (left column)

> `screenshot-1788985468290-22.jpg`

**What it's for:** the universe tree, and the fixture list under each universe.

- **`+ NEW` in the patch bay header is a dead button.** Clicked twice — once by coordinate, once by resolved DOM
  reference. Universe count stayed at 4 (`Universe 0..3`), no popup opened, no toast, no error, no console output,
  nothing changed. Whether it is capped at four universes or simply broken, the user gets **zero feedback from the
  most prominent "add something" button on the screen.**
  Meanwhile the **visually identical `+ NEW` button 250px to its right (group pool) opens a proper modal.** Two
  identical affordances, one works and one does nothing.
  **Heuristics:** visibility of system status; consistency and standards; error recovery. **Severity: Blocker.**
- **`+ NEW` here does not add a fixture.** It is scoped to universes. To add a fixture the user must:
  click a universe in the tree → notice the bottom strip changed → find the `FIXTURE POOL` widget among nine
  side-by-side widgets → click its `ADD`. That is a **4-step path with no signposting**, and step 2 is invisible
  (the bottom strip mutates silently with no title change or transition). This is the single clearest mechanical
  explanation for "adding is crazy non intuitive".
  **Heuristic:** recognition rather than recall. **Severity: Blocker.**
- **Every fixture is named "MAC Aura".** All 16 rows read `MAC Aura` and are distinguished only by DMX address
  (`U0 - CH0`, `U0 - CH14`, `U0 - CH28`…). To know which physical light is stage-left, the user must do DMX
  address arithmetic in their head. There are no fixture IDs, no user-editable per-unit names in the list, and no
  hover-to-highlight-in-visualizer.
  **Heuristic:** match between system and the real world. **Severity: Major.**

**Benchmark:** grandMA and every modern console give each unit a **Fixture ID** (1, 2, 3…) independent of its DMX
address, and selecting in the patch highlights the unit in the 3D view. Capture does the same in reverse — click the
fixture in the stage view, it selects in the patch. *Instead of an address-only list, give every fixture an ID and a
name, and cross-highlight patch ⇄ visualizer on hover.*

### 3.4 Patch Fixture popup (FIXTURE POOL ▸ ADD)

> `screenshot-1788985553197-27.png`

**What it's for:** choosing a fixture profile from the library and patching one or many.

- Left pane is an **alphabetical folder tree of manufacturers** (`5star-systems`, `abstract`, `acoustic-control`,
  `adb`, `afx`, `alien-pro`, `american-dj`, `ape-labs`, `arri`, `astera`, `audibax`, …) — roughly eleven rows
  visible out of hundreds. There is a search box, but **no "recently used", no favourites, no filter by fixture
  type** (moving head / wash / par / strobe). A user who knows they want "a moving wash" but not the brand cannot
  get there. **Severity: Major.**
- Right pane is **18 numeric spinners**, all disabled until a model is chosen, with several labels that are
  undecodable without documentation:
  - **`Stop:`** — sitting between `Address:` and `Amount:`, this is presumably the address *increment* between
    consecutive fixtures. "Stop" does not mean that in any lighting vocabulary.
  - **`*Rot X` / `*Rot Y` / `*Rot Z`** and **`*Offset X/Y/Z`**, duplicating the unprefixed `Rot`/`Offset` fields
    directly above them. **The asterisk is never explained** — no legend, no footnote, and (per §2.1) no tooltip.
  **Heuristics:** match to real world; recognition rather than recall; help. **Severity: Major.**
- **No preview.** The popup floats over the visualizer and covers it. You type six position numbers and three
  rotation numbers blind, press OK, and only then find out where the fixtures went.
  **Heuristic:** visibility of system status. **Severity: Major.**
- **Good:** `Amount` + address-increment batch patching is genuinely powerful and is the right primitive. It is
  simply unlabeled.

**Benchmark:** Capture and Vectorworks patch with a **live ghost preview** in the stage view as you set count,
spacing, and rotation. *Instead of nine blind numeric fields, show the fixtures materialising in the visualizer
live as `Amount`/spacing/rotation change, and rename `Stop` → `Address step`.*

### 3.5 Create Group popup (GROUP POOL ▸ + NEW)

> `screenshot-1788985511221-24.png`

**What it's for:** naming a group and choosing its member fixtures.

- Works, and is the most conventional dialog in the app: universe tree with `Check All 0/16`, per-fixture
  checkboxes, `Name`, `Color`, CANCEL/OK.
- **Only ~4 of 16 fixtures fit in the list.** Building a 16-fixture group means scrolling a ~120px-tall list and
  ticking 16 boxes that all read "MAC Aura". No shift-click range select, no drag select, no "select by type".
  **Severity: Major.**
- **You cannot see what you are selecting.** The popup covers the visualizer, so ticking fixtures produces no
  visual confirmation of which lights are in the group. **Heuristic:** visibility of system status.
  **Severity: Major.**
- Checkbox rendering is ambiguous: unchecked boxes render as filled grey squares that read as checked at a glance,
  contradicted only by the `0/16` counter. **Heuristic:** visibility of system status. **Severity: Minor.**

**Benchmark:** grandMA group-building is done *by selecting fixtures in the stage view or on the fixture bar and
pressing Store Group* — selection is always visible on the rig. *Instead of a checkbox list in a modal, let the user
click fixtures in the visualizer (or rubber-band them) and hit "Group from selection".*

### 3.6 Group pool (centre)

> `screenshot-1788984952147-1.jpg`

**What it's for:** the live playback surface — a grid of cue slots per group, plus master.

- Four group columns × **100 rows** (`C-0` … `C-99`), plus a Master column, all empty except one cell. This
  renders **1,200 empty cue DOM nodes** for a show with one cue — the clutter is both a visual and a performance
  problem (§2.5). A grandMA executor page shows ~15 usefully-labeled playbacks, not 400 blank cells.
  **Heuristic:** aesthetic and minimalist design. **Severity: Major.**
- Empty slots reveal a `+` only on hover, and clicking one did **not** create a cue. Cue creation therefore has no
  working entry point on the main surface — the user must open the group modifier's own cue pool.
  *(Confidence: I confirmed the click produced no new cue and no feedback; I did not exhaustively test every
  modifier of the click.)* **Severity: Major.**
- Group headers are `Group 0..Group 3` — index-named, not role-named ("Front wash", "Back trusses"). Renaming is
  possible but only after discovering the modifier strip. **Severity: Minor.**
- Clicking a group header silently swaps the entire bottom strip to the group modifier with **no title change, no
  transition, and no breadcrumb**. The user is given no cue that the bottom third of the screen now means something
  different. **Heuristic:** visibility of system status. **Severity: Major.**

### 3.7 Bottom modifier strip — the core structural problem

> `screenshot-1788985317619-13.png` + `-14.png` (group context) ·
> `screenshot-1788985710357-32.png` + `-33.png` (scene-cue context)

This is where *all editing in the product happens*, and it is the source of most of Jake's pain. Measured live in
the scene-cue context:

```
strip height        : 239 px  (21% of the 1135px viewport) — fixed, non-resizable
widgets in strip    : 9
total widget width  : 3318 px
container width     : 3127 px   →  horizontal overflow, Pan/Tilt runs off-screen
overflow-x          : auto (no visible scrollbar affordance)
```

The nine widgets in scene-cue context, with their fixed widths:

| Widget | Width |
|---|---|
| Group Settings | 150 px |
| Fixture Pool | 250 px |
| Cue Pool | 440 px |
| Cue Settings | 220 px |
| Fade In | 341 px |
| Scene Fixtures | 250 px |
| Channels | 741 px |
| Color Picker | 540 px |
| Pan/Tilt | 387 px (**runs past the viewport edge**) |

So: **the entire creative surface of the application is a 239-pixel-tall, 3318-pixel-wide horizontally-scrolling
ribbon of nine fixed-size panels, on a screen that cannot show all of them, with no way to resize, reorder, hide,
detach, or prioritise any of them.** Meanwhile the visualizer — the panel that needs the *least* pixel precision —
occupies roughly 70% of the window.

Everything else follows from this. The timeline gets 60px. The colour picker gets 540px whether or not you're
picking a colour. The cue you clicked is ~1000px away from the Cue Settings panel that describes it.

**Heuristics:** flexibility and efficiency of use; aesthetic and minimalist design; user control and freedom.
**Severity: Blocker.**

**Benchmark:** This is precisely the problem Lightroom solved. Lightroom stacks task panels in a **vertical rail**
where each is independently collapsible, the whole rail is draggable-wide, and only the panels relevant to your
current task are expanded — while the image gets the rest. Logic does the same with its editor pane: one editor at
a time, full width, switchable by tab, resizable against the arrange area.
*Instead of nine fixed panels in a 239px horizontal ribbon, make the bottom area a resizable pane containing
**one** task editor at a time (Patch / Channels / Colour / Position / Timeline) chosen by a tab strip, with a
draggable splitter against the visualizer.* That one change addresses Jake's "non intuitive" and "no panel
resizing" complaints simultaneously.

### 3.8 Universe modifier (default context)

> `screenshot-1788985534788-25.png` (CHANNELS zoom)

Widgets: `UNIVERSE` (Name / ID / Color / Output / CONFIG), `FIXTURE POOL`, `FIXTURE SETTINGS` (Name / Address /
Model / Mode), `POSITION TOOL` (Pos X/Y/Z, Rot X/Y/Z), `CHANNELS`, `COLOR PICKER`, `PAN/TILT`.

- **CHANNELS labels its faders `CH1`…`CH14` — raw DMX offsets.** Above each is an unlabeled glyph (iris, half-disc,
  triangle, four near-identical arrow pairs, wrench, star, R, G, B, W, ✕). The user must know that CH3 is dimmer
  and CH8 is… something.
  **The app already knows the real names.** In the group modifier, the `MODULATED CHANNELS` widget lists them
  properly: *Dimmer, Pan, Tilt, Green, Blue, Zoom.* So the fixture profile carries function names, and the fader
  strip throws them away.
  **Heuristics:** recognition rather than recall; consistency and standards; match to real world.
  **Severity: Major — and a quick win**, since the data is already in hand.
- `PAN/TILT` has `Pan`, `Fine`, `Tilt`, `Fine`, and a `Set fine channels` checkbox, all greyed. Two fields both
  labeled `Fine` with no parent grouping. **Severity: Minor.**
- `COLOR PICKER` is the one genuinely approachable widget: wheel, `Color Presets`, `Custom` + `SAVE`, `HSL` mode,
  hex field with `COPY`, HUE/SAT/VAL sliders. It is also the **only preset mechanism in the product** (§2.3).
  This is the pattern to generalise — the exact same "presets + custom + save" row is what position presets,
  movement presets, and group palettes need.

### 3.9 Group modifier

> `screenshot-1788985317619-13.png` (left) · `screenshot-1788985317619-14.png` (Effect Tool)

Widgets: `GROUP SETTINGS`, `FIXTURE POOL`, `CUE POOL`, `CUE SETTINGS`, `MODULATED CHANNELS`,
`CHANNEL FIXTURES ACTIVITY`, `EFFECT TOOL`.

- **The cue pool uses two incompatible numbering systems at once.** Slots are labeled `C-0`…`C-15`; the cues
  inside them are named `Cue 0`, `Cue 9`, `Cue 6`, `Cue 4`, `Cue 5` — in slots 0, 1, 2, 4 and 6. So "Cue 9" lives
  in slot C-1. Nothing explains which number the user should reference, and the cue pool grid holds **126 slots**
  for a group with six cues.
  **Heuristics:** consistency and standards; match to real world. **Severity: Major.**
- **Cue type is conveyed only by a tiny unlabeled glyph** — a waveform mark for effect cues, a slider mark for
  scene cues — with no legend and no tooltip. **Severity: Major.**
- **`Duration: 6` carries no unit.** Beats? Bars? Seconds? Likewise the chase's `Duration: 31`. Every timing field
  in the product is unitless. **Heuristic:** match to real world; error prevention. **Severity: Major — quick win.**
- `Trigger Style: Toggle`, `Start: Absolute`/`Relative`, `Loop Style: Loop` — three enum dropdowns with
  console-native semantics and no explanation of the difference between Absolute and Relative start.
  **Severity: Major.**
- `CHANNEL FIXTURES ACTIVITY` shows `Check All  0/16` while all 16 visible checkboxes render as ticked — the
  counter and the checkboxes disagree. *(Confidence: observed twice; possible rendering-state mismatch.)*
  **Severity: Minor.**
- **EFFECT TOOL** — `Waveform: TRIANGLE`, `Direction: LTR`, `Min 0`, `Max 255`, `Phase start 0`, `Freq 10`,
  `Phase 0`, `Phase stop 360`, plus a waveform graph.
  - Three separate fields contain the word "phase" (`Phase start`, `Phase`, `Phase stop`) with no explanation of
    how they relate. `Freq: 10` has no unit. `LTR` is unexpanded.
  - The graph's per-fixture markers (`F5`, `F7`, `F14`, `F15`) **collide into an illegible stack** at the left edge.
  - There are **no effect presets**. Every movement effect must be dialled in from seven raw numbers.
  **Severity: Major** (this is the heart of Jake's issue #2).

**Benchmark:** grandMA ships a library of named effects (Circle, Ballyhoo, Figure-8, PanSine, Fan) that you apply to
a selection and then tune; Logic's LFO/modulators likewise start from a named shape. *Instead of seven raw numeric
fields, ship a named movement-preset library — Circle, Fan, Wave, Ballyhoo, Chase — applied to a group in one click,
with Size / Speed / Spread as the only three exposed knobs and the raw parameters behind an "Advanced" disclosure.*

### 3.10 Scene-cue modifier

> `screenshot-1788985710357-32.png` · `-33.png`

Adds `FADE IN`, `SCENE FIXTURES`, `CHANNELS`, `COLOR PICKER` to the group widgets.

- **`FADE IN` exposes raw cubic-bézier control points**: `Type: CUSTOM`, `CP1 X: 0.25`, `CP1 Y: 0.25`, and a
  draggable `CP2` handle on a curve plot. A user who wants "fade in over two beats, gently" is asked to type bézier
  coordinates. There are no named curves (Linear / Ease In / Ease Out / S-curve) visible in the collapsed state.
  **Heuristic:** match between system and the real world. **Severity: Major.**
- **The selected cue is not clearly indicated**, and `CUE SETTINGS` sits ~1000 CSS px to the right of the cue pool
  cell it describes — the user clicks a cell on the left and must scan a third of the way across a 3127px screen to
  see what they selected. During testing, clicking a cell left `Cue Settings` showing a cue name that did not
  obviously correspond to the cell clicked. *(Low confidence on the mismatch itself; high confidence on the
  spatial disconnect, which is measured.)* **Severity: Major.**

**Benchmark:** Logic keeps the inspector for the selected region **immediately adjacent** to the selection and shows
a strong selection outline. *Instead of a distant Cue Settings panel, put cue properties in a popover anchored to the
cue cell, or move Cue Settings adjacent to the Cue Pool.*

### 3.11 Chase modifier and timeline — the automation editor

> `screenshot-1788985398371-17.png` (left) · `-18.png` (right) · `screenshot-1788985425405-19.png` (post-drag)

**What it's for:** arranging cues in time — the closest thing the app has to Jake's "programming automation".

`CHASE` panel: `Name: Amber Rainbow`, `Duration: 31`, `Color: Maroon`, `Quantize: 1/1`, `Trigger: Loop`.
`TIMELINE`: a `FOLD CUES` toggle, a bar ruler, and one lane per cue with clip bars.

- **Cue clips cannot be moved in time.** Measured: the clip body
  (`.widget_pool_timeline_item_cue_body`) has `cursor: pointer`; the **only** drag affordance in the whole timeline
  is `.widget_pool_timeline_item_cue_resize` with `cursor: col-resize`. Confirmed by dragging the "Cue 4" clip
  120px to the right — it did not move (before/after screenshots `-17.png` vs `-19.png` are identical).
  So a clip can be **lengthened but never repositioned**. In an editor that looks exactly like a DAW arrange
  window, this is a severe false affordance.
  **Heuristics:** match to real world; user control and freedom; consistency and standards. **Severity: Blocker.**
- **The timeline is 60 px tall** — roughly three lanes visible out of six-plus cues — because it lives inside the
  fixed 239px strip alongside the Chase panel (§3.7). The automation editor gets ~5% of the window while the
  visualizer gets ~70%. **Severity: Blocker.**
- **The bar ruler is zero-indexed within the bar**: `1.0, 1.1, 1.2, 1.3, 2.0, 2.1, …`. Every musician and every DAW
  counts beats from 1 (`1.1, 1.2, 1.3, 1.4`). A non-console-trained musician reading `1.0` will mis-place cues.
  **Heuristic:** match between system and the real world. **Severity: Major — quick win.**
- **No transport, no playhead scrub, no zoom, no snap control** inside the timeline. There is a static pink marker
  at 1.0 and nothing else. There is no way to audition a section, loop a range, or zoom to fit — and the "Cue 4"
  clip extends past the visible edge with no zoom-out.
  **Severity: Major.**
- **`FOLD CUES`** is unexplained jargon behind a crossed-eye icon. `Quantize: 1/1` and `Duration: 31` are both
  unitless. **Severity: Minor.**
- A `widget_pool_timeline_duration_overflow_overlay` element is rendered — the chase content overflows its declared
  duration and the UI draws an overlay about it, but with no message explaining what is wrong or how to fix it.
  **Heuristic:** help users recognise, diagnose and recover from errors. **Severity: Major.**

**Benchmark:** Logic's arrange window is the reference implementation of this exact surface: regions drag freely,
snap to a selectable grid, the ruler is bar.beat counting from 1, the playhead scrubs, ⌘-drag zooms, and the whole
editor is resizable against everything else. *Instead of a fixed 60px lane strip with immovable clips, make the
timeline a resizable, zoomable arrange view with draggable regions, a scrubbing playhead, cycle markers, and a
snap-resolution selector.*

### 3.12 Visualizer (right)

> `screenshot-1788985452723-21.jpg`

Controls: `RECORD 00:00`, `AUTO-ROTATE`, `AUTO-FOCUS`, `HIDE`.

- **It takes ~70% of the window and cannot be shrunk.** It is the least interaction-dense surface in the app and
  the most generously sized. `HIDE` is all-or-nothing; there is no in-between. **Severity: Major** (this is §3.7
  seen from the other side).
- **It is display-only.** You cannot click a fixture in the 3D view to select it, cannot rubber-band a selection,
  cannot drag a fixture to reposition it. All positioning is done by typing numbers into `POSITION TOOL`
  (`Pos X: -7.5`, `Rot X: 179`, …) while looking at the result somewhere else on screen.
  **Heuristic:** match to real world; recognition rather than recall. **Severity: Major.**
- `RECORD 00:00` gives no indication of what it records (video? DMX? show state?) or where the output goes.
  **Severity: Minor.**

**Benchmark:** Capture's stage view is the primary *selection* surface — you click lights in the render to select
them, and drag to aim. *Instead of a passive render, make the visualizer clickable: click/marquee to select
fixtures, drag to position, and highlight-on-hover synced with the patch bay.*

### 3.13 Preferences ▸ Visualizer

> `screenshot-1788985570333-28.jpg`

**The best-designed dialog in the application.** Sections (`FOGGING`, `LIGHTING`), and every single control has a
label *and a one-line description* — *"Sets the global scene fog density amount."*, *"Turn global scene fogging
on/off."*, *"Global scene brightness."*

This proves the team can do explanatory UI. It exists on four settings, and nowhere else in a product with several
hundred controls. **Recommendation: this is the house style — generalise it.**

Minor: it is a CANCEL/OK modal, so fog and brightness changes cannot be previewed live against the scene.
Lightroom applies slider changes live and lets Escape revert. **Severity: Minor.**

### 3.14 Preferences ▸ Outputs

> `screenshot-1788985583094-29.jpg`

An empty panel reading **"NOTHING TO DISPLAY"** with `+ ADD NEW CONNECTION`.

For a DMX app, this is *the* screen that connects the software to real lights, and its empty state explains nothing:
no mention of Art-Net or sACN, no "you have no output configured — your show is preview-only", no link to help. A
first-time user cannot tell whether they are missing something important. **Heuristic:** help and documentation;
visibility of system status. **Severity: Major — quick win** (empty-state copy).

---

## 4. Ranked master issue list

Ranked by (severity × frequency of encounter × how much it blocks Jake specifically).

| # | Sev | Issue | Where | Heuristic | Evidence |
|---|---|---|---|---|---|
| 1 | **Blocker** | The entire editing surface is a fixed 239px-tall, 3318px-wide horizontal ribbon of 9 non-resizable, non-reorderable, non-hideable panels inside a 3127px viewport — while the visualizer takes ~70% of the window | Bottom modifier strip | Flexibility; minimalism; user control | Measured: `stripH 239 / vh 1135 = 21%`; 9 widgets; `scrollW 3318 > clientW 3127`; Pan/Tilt off-screen. §3.7 |
| 2 | **Blocker** | Zero tooltips app-wide (`title`/`aria-label`/`data-tooltip` all = 0) across dozens of icon-only controls; no help menu | Global | Recognition over recall; help | DOM query, §2.1 |
| 3 | **Blocker** | No transport controls exist. `▶ PLAYING` is a read-only `<h3>` with `cursor: auto` and no handler; the words "stop" and "pause" appear 0 times in the UI. Source defines stopped/playing/paused but nothing can set them | Toolbar | User control and freedom; visibility of status | Computed style + `toolbar.fragment.vue:264–277`. §3.1 |
| 4 | **Blocker** | Timeline cue clips cannot be moved in time — only resized. Clip body is `cursor: pointer`; the sole drag handle is `col-resize`. A 120px drag produced no movement | Chase timeline | Match to real world; false affordance | §3.11, screenshots `-17` vs `-19` |
| 5 | **Blocker** | Patch bay `+ NEW` is a dead button: two clicks (coordinate + DOM ref), no universe added, no popup, no message — while the identical-looking group pool `+ NEW` works | Patch bay | Visibility of status; consistency | §3.3 |
| 6 | **Blocker** | Adding a fixture requires an unsignposted 4-step path (universe → silent bottom-strip swap → find Fixture Pool among 9 widgets → ADD); the obvious "+ NEW" does something else | Patch bay → modifier | Recognition over recall | §3.3 |
| 7 | **Blocker** | No vocabulary or mechanism for automation authoring: song/setlist/palette/preset/snapshot/automation all = 0 occurrences; the only preset in the product is the colour swatch row | Global | Match to real world | §2.3 |
| 8 | **Major** | No panel anywhere is resizable, movable, or collapsible — 0 splitter elements, 0 resize cursors | Global layout | Flexibility; user control | §2.2 |
| 9 | **Major** | Effect Tool exposes 7 raw numeric parameters (3 of them containing "phase") with no units, no presets, and colliding fixture markers on the graph | Group modifier | Match to real world; recognition | §3.9 |
| 10 | **Major** | Every timing field is unitless — `Duration: 6`, `Duration: 31`, `Freq: 10`, `Quantize: 1/1` | Cue / Chase / Effect | Match to real world; error prevention | §3.9, §3.11 |
| 11 | **Major** | CHANNELS faders labeled `CH1..CH14` with unlabeled glyphs, although the app already holds the real names (Dimmer/Pan/Tilt/Green/Blue/Zoom, shown in Modulated Channels) | Universe & scene modifier | Recognition; consistency | §3.8 |
| 12 | **Major** | All 16 fixtures are named "MAC Aura", distinguishable only by DMX address; no fixture IDs, no visualizer cross-highlight | Patch bay, Create Group | Match to real world | §3.3, §3.5 |
| 13 | **Major** | Undo/Redo exist only as EDIT dropdown items — no button, no history, no visible affordance near any destructive action | Toolbar | User control and freedom | §3.1 |
| 14 | **Major** | New Project offers no unsaved-changes warning even when the show is dirty (`* Demo`) | New Project popup | Error prevention | §3.2 |
| 15 | **Major** | Fade In exposes raw cubic-bézier control points (`CP1 X: 0.25`) instead of named curves | Scene modifier | Match to real world | §3.10 |
| 16 | **Major** | Group pool renders 1,200 empty cue nodes (4 × 100 slots) for a one-cue show; contributes to a main-thread stall (30 s screenshot timeout) and heavy visual noise | Group pool | Minimalism; performance | §2.5, §3.6 |
| 17 | **Major** | Cue pool uses two numbering systems simultaneously — slots `C-0..C-15` vs cues named `Cue 0/4/5/6/9` in non-matching slots; cue type shown only by an unlabeled glyph | Group modifier | Consistency; recognition | §3.9 |
| 18 | **Major** | Visualizer is display-only — no click-to-select, no drag-to-position; all positioning is blind numeric entry | Visualizer | Match to real world | §3.12 |
| 19 | **Major** | Patch Fixture dialog: `Stop:` mislabeled, unexplained `*Rot`/`*Offset` duplicates, no fixture-type filter, no live preview | Patch Fixture popup | Match to real world; help | §3.4 |
| 20 | **Major** | Outputs empty state says only "NOTHING TO DISPLAY" — no explanation that the show is preview-only without a connection | Preferences ▸ Outputs | Help; visibility of status | §3.14 |
| 21 | **Major** | Selecting a group/cue silently mutates the bottom third of the screen with no title, transition, or breadcrumb | Group pool → modifier | Visibility of status | §3.6 |
| 22 | **Major** | Cue Settings sits ~1000 px from the cue cell it describes; selected cue is not clearly outlined | Scene modifier | Visibility of status | §3.10 |
| 23 | **Major** | Accessibility: zero accessible names across the whole tree; 56 tabbable elements with no labels | Global | Accessibility / flexibility | §2.4 |
| 24 | **Major** | Startup: splash >9 s showing "Waiting for views to settle…" over an already-rendered UI; a Vue `insertBefore` exception on every load | Startup | Visibility of status; error prevention | §2.5 |
| 25 | **Major** | Create Group: ~4 of 16 fixtures visible, no range-select, and the popup covers the visualizer so selection is invisible | Create Group popup | Efficiency; visibility of status | §3.5 |
| 26 | **Minor** | Timeline ruler is zero-indexed within the bar (`1.0, 1.1, 1.2, 1.3`) against the universal `1.1–1.4` convention | Chase timeline | Match to real world | §3.11 |
| 27 | **Minor** | `Shift+N` for New Showfile is inconsistent with the Ctrl-prefixed siblings and unsafe near text fields | FILE menu | Consistency; error prevention | `toolbar.fragment.vue:147` |
| 28 | **Minor** | Timeline duration-overflow overlay renders with no message explaining the problem or the fix | Chase timeline | Error recovery | §3.11 |
| 29 | **Minor** | `FOLD CUES`, `LTR`, `Absolute`/`Relative` start, `RECORD` — unexplained jargon | Various | Match to real world | §3.9, §3.11, §3.12 |
| 30 | **Minor** | Unchecked checkboxes render as filled grey squares that read as checked | Create Group | Visibility of status | §3.5 |
| 31 | **Minor** | Visualizer Settings is a CANCEL/OK modal with no live preview of fog/brightness | Preferences ▸ Visualizer | Visibility of status | §3.13 |
| 32 | **Cosmetic** | `(Ctrl+Shift+o)` lowercase among uppercase siblings; build branch `phase-1-mcp` shown to end users on the splash | Toolbar, splash | Consistency | §3.1, §2.5 |

---

## 5. Quick wins vs. Phase 4 redesign

### Quick wins — fixable without redesign

These are label, copy, default, and small-affordance changes. None requires re-architecting the layout.

1. **Add tooltips everywhere** (#2). One `title` (or a shared hover-hint component) on every icon-only control.
   Highest value-per-hour change in the entire list.
2. **Use the channel function names you already have** (#11). `MODULATED CHANNELS` already renders
   *Dimmer / Pan / Tilt / Green / Blue / Zoom*; feed the same names to the CHANNELS fader strip instead of
   `CH1..CH14`. Pure data plumbing.
3. **Put units on every timing field** (#10) — `Duration: 6 beats`, `Freq: 10 Hz`, `Duration: 31 bars`.
4. **Fix the timeline ruler to 1-indexed beats** (#26) — `1.1, 1.2, 1.3, 1.4`.
5. **Rename the confusing patch fields** (#19) — `Stop` → `Address step`; give the `*Rot`/`*Offset` rows a group
   heading that explains what the asterisk means (or delete the duplicate rows).
6. **Fix or hide the patch bay `+ NEW`** (#5). If universes are capped at 4, disable it and say so on hover. A
   dead button in the most prominent position is worse than no button.
7. **Write real empty-state copy for Outputs** (#20) — "No DMX output configured. Your show runs in preview only.
   Add an Art-Net or sACN connection to drive real fixtures."
8. **Add an unsaved-changes guard to New Project** (#14).
9. **Surface Undo/Redo as toolbar buttons** with a disabled state when the stack is empty (#13).
10. **Generalise the Visualizer-Settings pattern** — label + one-line description — to Cue Settings, Chase, and
    Effect Tool. The component already exists (§3.13).
11. **Fix the load-time Vue exception and shorten/hide the splash** (#24); replace "Waiting for views to settle…"
    with either nothing or plain language.
12. **Give fixtures IDs and editable names** (#12) — even just `1: MAC Aura (U0-CH0)` in the list.
13. **Add a selection outline to the active cue cell** (#22).
14. **Virtualise the group pool grid, or drop it from 100 rows to ~16** (#16) — a clutter and perf win in one.
15. Cosmetic sweep: shortcut casing, hide build branch from the splash (#32).

### Needs the Phase 4 redesign

These cannot be fixed by relabelling; they are structural.

1. **The modifier-strip architecture** (#1, #8). The 239px × 3318px nine-panel ribbon has to become a resizable
   pane with one task editor at a time (Lightroom-style collapsible rail, or Logic-style tabbed editor pane) and a
   real splitter against the visualizer. Every "it's cramped / I can't find it" complaint traces back here.
2. **A real transport and playback model** (#3). Play / Stop / Blackout / cycle, a bar.beat position readout, Space
   to toggle, and a defined behaviour for what happens to DMX output on stop (hold vs. release vs. blackout).
3. **A real timeline** (#4). Draggable regions with snap, a scrubbing playhead, zoom, and cycle markers. Resizing
   clips but not moving them is not a bug to patch — the interaction model needs rebuilding.
4. **A preset / palette system** (#7, #9, #15). Position presets, movement presets, colour palettes, and named fade
   curves, all built on the "Presets + Custom + SAVE" row that already works in the colour picker. This is the
   whole of Jake's issue #2 and it is a feature, not a fix.
5. **A song/setlist layer** (#7). There is currently no container above "chase". If the product is for running a
   band's set, the top-level object should be a Song with a tempo map, and shows should be ordered lists of songs.
6. **An interactive visualizer** (#18). Click-to-select, marquee-select, drag-to-position, and bidirectional
   highlight with the patch bay. This changes the visualizer from a 70%-of-screen passenger into the primary
   selection surface, which also relieves pressure on #1.
7. **A guided first-run path.** Nothing in the product teaches the model (universe → fixture → group → cue → chase).
   Rig templates in New Project plus a first-run walkthrough would carry a non-console-trained owner across the
   gap that tooltips alone cannot.
8. **Accessibility and keyboard command model** (#23). Names, roles, focus order, and a shortcut scheme — which is
   also what makes the app fast for an expert, not just usable for a screen reader.

---

## 6. Validating and refining Jake's four reported issues

### Issue 1 — "adding/editing is crazy non intuitive" → **Confirmed, and now mechanically explained**

Jake's instinct is right, and the audit isolates three specific causes rather than a general vibe:

- **The obvious button does the wrong thing, and its twin is dead.** The `+ NEW` at the top of the patch bay — the
  most prominent "add" affordance on screen — adds universes, not fixtures, and in testing it did nothing at all
  with zero feedback. The identical `+ NEW` 250px to its right works fine. (#5, #6)
- **The real add path is four unsignposted steps** through a bottom strip that mutates silently when you select
  something. (#6, #21)
- **The editing surface itself is hostile geometry**: nine fixed panels totalling 3318px inside a 3127px container,
  239px tall, no resizing. (#1)

**Refinement:** this is not primarily a "learn the console model" problem. It is a *navigation and feedback*
problem. A user who understood the model perfectly would still struggle, because the buttons lie and the workspace
cannot be shaped to the task.

### Issue 2 — "no discoverable interface for programming automation" → **Confirmed, and stronger than reported**

It is not that the interface is undiscoverable. For the things Jake named, **it does not exist**:

- `song` = 0, `setlist` = 0, `palette` = 0, `snapshot` = 0, `automation` = 0 occurrences in the UI.
- `preset` = **1** — the colour swatch row. There are **no position presets and no movement presets** at all.
- The one automation authoring surface that does exist — the chase timeline — is 60px tall and **its clips cannot
  be moved in time** (#4).
- Movement effects exist only as seven raw numbers in the Effect Tool, three of which are called some variant of
  "phase", none with units, and with no preset library. (#9)

**Refinement:** Jake asked for discoverability; the honest answer is that discoverability is the second problem.
The first is that the preset/palette/song layer is missing and needs to be built (§5, Phase 4 items 4 and 5). The
good news is that the correct interaction pattern already ships in this app — the colour picker's
"Presets · Custom · SAVE" row is exactly the right template to clone for positions, movements, and groups.

### Issue 3 — "no panel resizing" → **Confirmed, definitively**

Not hidden, not hard — **absent**. Zero elements with resize/splitter/gutter semantics, zero resize cursors in the
whole document. Nothing can be resized, reordered, collapsed, or detached. (#8)

**Refinement:** the reason this hurts so much is the ratio it locks in. The visualizer — the panel needing the least
precision — is frozen at ~70% of the window, while the timeline (the precision-critical surface) is frozen at ~5%.
Even a single draggable splitter between the visualizer and the modifier strip would be a disproportionate
improvement, and it is arguably a quick win on its own.

### Issue 4 — "playback stop feels dead" → **Confirmed, and the cause is now precise**

It feels dead because **there is nothing to press**. The `▶ PLAYING` chip is an `<h3>` inside a plain div with
computed `cursor: auto` and no click handler — a read-only status label. The words "stop" and "pause" occur zero
times anywhere in the rendered interface. The only interactive controls in that region are the BPM number field and
`TAP TEMPO`.

The state machine exists in code (`toolbar.fragment.vue:264–277` returns `stopped` / `playing` / `paused` with
distinct colours and icons) — **but no UI control can drive it.** So the label is permanently stuck on "playing",
which also means the indicator would be misleading even if playback did stop by some other route.

**Refinement:** Jake described a dead-feeling button; it is actually a missing feature wearing a button's clothes,
which is worse, because the user's model ("I pressed stop and nothing happened") is unfalsifiable from the UI. The
fix is not a bug fix but the transport work in §5 Phase 4 item 2 — and it must include an explicit decision about
what happens to DMX output on stop (hold last frame / release to zero / blackout), because "the rig freezes on
whatever it was last doing" is itself a bad default for live use.

---

## 7. Screenshot index

All files in `C:\Users\jakub\AppData\Local\Temp\claude-chrome-screenshots-mr72O3\`.

| File | Surface |
|---|---|
| `screenshot-1788984952147-1.jpg` | Main console at rest — patch bay, group pool, visualizer, universe modifier |
| `screenshot-1788984997103-3.jpg` | FILE menu open |
| `screenshot-1788985073599-9.jpg` | Splash still up at 9 s ("Waiting for views to settle…") over a rendered UI |
| `screenshot-1788985275517-12.jpg` | Group modifier open (bottom strip swapped silently) |
| `screenshot-1788985317619-13.png` | Group modifier zoom — Group Settings / Fixture Pool / Cue Pool / Cue Settings / Modulated Channels |
| `screenshot-1788985317619-14.png` | Effect Tool zoom — 7 raw params, colliding F5/F7/F14/F15 markers |
| `screenshot-1788985398371-17.png` | Chase timeline (left) — ruler `1.0/1.1/1.2/1.3`, FOLD CUES, Cue 4 clip |
| `screenshot-1788985398371-18.png` | Chase timeline (right) — clip running past the visible edge |
| `screenshot-1788985425405-19.png` | Timeline after a 120px drag — **unchanged** (clips cannot be moved) |
| `screenshot-1788985468290-22.jpg` | Patch bay `+ NEW` clicked by DOM ref — no effect, no feedback |
| `screenshot-1788985495626-23.jpg` | Create Group popup |
| `screenshot-1788985511221-24.png` | Create Group zoom — 16 identically-named "MAC Aura" rows, `0/16` |
| `screenshot-1788985534788-25.png` | CHANNELS zoom — `CH1..CH14` with unlabeled glyphs |
| `screenshot-1788985534789-26.jpg` | Patch Fixture popup in context |
| `screenshot-1788985553197-27.png` | Patch Fixture zoom — `Stop:`, `*Rot`, `*Offset`, 18 disabled spinners |
| `screenshot-1788985570333-28.jpg` | Preferences ▸ Visualizer — the one dialog with helper text |
| `screenshot-1788985583094-29.jpg` | Preferences ▸ Outputs — "NOTHING TO DISPLAY" |
| `screenshot-1788985599756-30.png` | Transport zoom — BPM, dot, `▶ PLAYING`, TAP TEMPO (no stop) |
| `screenshot-1788985666107-31.jpg` | Output frozen with one fixture latched lit while the label still reads PLAYING |
| `screenshot-1788985710357-32.png` | Scene-cue modifier (left) — Cue Settings, Fade In bézier CP1 X/Y |
| `screenshot-1788985710357-33.png` | Scene-cue modifier (right) — Scene Fixtures, Channels, Color Picker |
| `screenshot-1788985841536-35.png` | New Project popup — Blank / Demo Show, no unsaved-changes warning |
