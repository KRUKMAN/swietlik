# Świetlik UI design brief — for Claude Design sessions

Companion screenshots: `docs/swietlik/evidence/ui-audit/` (current state, captured
live). Deep evidence: [`ux-audit.md`](ux-audit.md). Product direction:
[`product-vision.md`](product-vision.md). Phase 2 scope (what's being built now):
[`phase2-scope-draft.md`](phase2-scope-draft.md).

## Design language

- **Benchmarks**: Apple Logic (transport, timeline, automation), Lightroom
  (approachable-pro panels, presets, hover-preview), Vectorworks Spotlight
  (data-rich rig quality bar). Dark console aesthetic stays — it's correct for a
  lighting tool used in dark rooms; the current near-black palette with pink/violet
  accents is a keepable foundation.
- **Layered simple→pro**: every surface has a simple layer (Jake, non-LD, busking a
  party) and a pro layer (console concepts underneath). Modes-as-tabs is the ruling:
  **Build · Look · Show · Present** workspace presets instead of free-floating panels.
- **No console jargon in the simple layer**: "How fast things fade when you stop
  them", not "release time". Units on every number (s, ms, °, %).

## Per-surface: current → target

### 1. Main console (`main-console.jpg`)
Current: fixed layout; visualizer ~70% of window; all editing crammed into a 239px
ribbon of 9 panels 3318px wide; nothing resizable; zero tooltips anywhere.
Target (Phase 2 builds this): resizable panes (patch | groups | visualizer over a
resizable bottom editor), workspace mode tabs, tooltips everywhere, a visible
**transport cluster** in the toolbar: `Go / Freeze / Let go / BLACKOUT` + the one
slider "How fast things fade when you stop them" (2s default). BLACKOUT reads as a
guarded, latching control (distinct color, latched state obvious at distance).

### 2. Toolbar transport (`toolbar-transport.jpg`, `latched-output.jpg`)
Current: "▶ PLAYING" is a static heading — there is NO stop/pause control in the app.
Target: real transport (see above) + per-playback state pills in the group pool
(running / armed-quantized pulse / releasing fade-out animation / held).

### 3. Chase timeline (`chase-timeline-1/2.png`)
Current: cue clips resizable but not movable; ~5% of window height; unitless
numbers (Duration: 31); no playhead.
Target v1 (Phase 2 P2-3): a real timeline pane — tracks = groups, regions =
looks/chases with drag/resize/copy + fade handles, playhead, bars⇄time ruler, snap.
Logic is the explicit reference. One automation lane type (intensity) in v1.

### 4. Effect tool (`effect-tool.png`, `group-modifier.png`)
Current: 7 raw unitless params, three named some variant of "phase"; no presets;
colliding fixture markers.
Target: named waveform presets with **hover-preview** (Lightroom pattern — hover
shows the effect on the rig live, click applies), plain-language params (Speed,
Size, Spread across fixtures), units everywhere. Pro layer exposes raw phase/curve.

### 5. Patch flow (`patch-fixture-popup.png`, `new-project-popup.png`)
Current: 4-step unsignposted flow; "+ NEW" does something unrelated; popup shows
`Stop:`, `*Rot`, `*Offset` labels; DMX addressing exposed by default.
Target: search-first fixture browser (manufacturer/model/mode with thumbnails),
auto-address by default (pro layer can override chStart), sane labels, and the
fixture's **data record** (purpose / unit # / color / notes — Spotlight-grade
fields, Phase 2 P2-4) editable at patch time.

### 6. Presets/palettes system (future phase, design now)
Current: concept exists only in the color picker (Presets · Custom · SAVE).
Target: that exact pattern cloned across positions, movements, looks; a look =
recallable card with hover-preview; "Create from current" always visible.

### 7. MIDI play overlay (Phase 2 P2-6)
Target: a thin "performance" overlay/state — keyboard split visual (below middle C =
groups, above = playback slots), pressed-key highlights on the mapped cells,
MIDI-learn mode ("press a control, touch the thing, done").

## Hard constraints for any design

- Dark UI, WCAG-legible text on near-black; existing accent hues acceptable.
- The five existing fragments keep their internal structure in Phase 2 (only the
  shell around them changes) — full redesign of panel internals is Phase 4.
- Every control keyboard-reachable eventually; Ctrl+K command palette is on the
  roadmap; tooltips are mandatory, not decorative.
- No free-floating windows (ruled out); docked panes + mode tabs only.
