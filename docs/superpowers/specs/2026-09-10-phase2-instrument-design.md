# Świetlik Phase 2 — "An instrument you can operate" (design spec)

Status: approved under Jake's standing delegation, 2026-09-10. Jake may override
any decision here; the **Open questions** section lists the ones that genuinely
want his input.

This spec is deliberately thin: the substance lives in two committed documents
that it binds together and arbitrates —

- **Product**: [`docs/swietlik/phase2-scope-draft.md`](../../swietlik/phase2-scope-draft.md)
  (consultant; user stories, simple/pro split, AC-1..AC-59, transport verb×scope
  matrix, MIDI §7, de-scope ladder)
- **Architecture**: [`docs/swietlik/phase2-architecture-options.md`](../../swietlik/phase2-architecture-options.md)
  (options + recommendations with file:line evidence, §0 cross-cutting findings,
  sequencing, 64–80 task rollup)

Where the two disagree, this spec's rulings win.

## Goal

After Phase 2, Jake can *operate* Świetlik like a live instrument: playback
starts, holds, resumes and fades the way a stage does; the workspace resizes to
the task; a MIDI keyboard plays the rig; and every fixture carries the data a
schedule needs. All of it scriptable through MCP.

## Scope (in ranked order)

| # | Item | Weeks | Source of truth |
|---|---|---|---|
| P2-0 | Housekeeping: drop unused `@vue/compat`; land the `ShowSingleton` serialisation seam | 0.2 | arch §0.1, §4.2-B |
| P2-1 | Transport / live-feel playback (GO · Pause · Resume · Release · Stop-all · Blackout) | 2.0 | scope §3 + arch §1 (Option B) |
| P2-2 | Workspace layout shell v1 (`splitpanes` behind `uk-workspace` wrapper) | 1.5 | scope §4 + arch §2 |
| P2-4 | Data-rich fixture records (`Fixture.meta`, Option B) | 0.5 | scope §5 + arch §3 |
| P2-5 | Keyboard-router seed + reclaim `Ctrl+Z` for undo | 0.5 | scope §6 |
| P2-6 | MIDI play (stretch; starts only after P2-1 + P2-2 verify green) | 1.0 | scope §7 |
| P2-3 | Timeline v1 (largest item; starts only after P2-1 + P2-2 land) | 2.5 | scope §5 + arch §5 |

Total 8.2 agent-weeks — top of the window, zero slack. **De-scope ladder** (in
order, if reality bites): timeline stretch interactions → P2-4 inspector UI →
the whole timeline (P2-3) drops before MIDI does; transport AC-1..AC-8 never
give.

**Out** (Phase 3+): venue templates/drape/truss/hang positions, drag-drop
placement + auto-patch, palettes/looks, automation lanes beyond one type,
paperwork, all rendering work, the true mixing bus (arch §1 Option C — recorded
successor), busk-recording to timeline (the prize, Phase 3), MIDI
clock/out/SysEx/MPE.

## Binding rulings (decisions taken)

1. **Transport = arch Option B**: additive `src/transport/` singleton; snapshot
   + release envelopes as `Live` animations; release mask fades Dimmer/colour
   intensity and **holds** Pan/Tilt/Gobo/Zoom; blackout is a latched
   last-in-line zero-writer, never faded; resume rebases `deltaStart` on first
   real tick. Known-approximate overlap semantics documented, not hidden;
   two-playback overlap tests (AC-5/AC-8) plus a four-note-chord MIDI case are
   written on day one.
2. **Upstream edits budget is the plan's contract**: ~22–23 lines across 6
   files (arch §7). Any task pushing past its area's line budget stops and
   re-plans. No monkey-patching upstream prototypes, ever — the ledger hook
   can't see it (arch §1.4/§4.2-A rationale).
3. **`splitpanes@4` adopted** (MIT, 82.7 KB, zero deps) behind `uk-workspace`;
   dockview deferred to Phase 4 behind the same wrapper.
4. **Root activity**: new additive `workspace.activity.vue` + 2-line `App.vue`
   change; the bootstrap logic in `app.activity.vue`'s `setup()` is extracted
   into an additive composable used by both activities so nothing is duplicated
   (resolves arch §8-Q4 by dissolving the trade).
5. **Serialisation seam**: `ShowSingleton` overrides (`showData` spread +
   `loadFromData` restore ordering per arch §4.2-B). One seam serves workspace
   layouts now, venue and hang positions later.
6. **Fixture records = arch Option B** (`Fixture.meta` + `FixtureMeta` class);
   prerequisite id-stability and `modeNam` fixes already landed (commit
   0197c36).
7. **MIDI**: Web MIDI adapter dispatching into the existing command registry —
   same bus as MCP and UI; the default map is the consultant's middle-C split;
   `simulate_midi` MCP command makes it testable and demoable without hardware.
   Velocity-0 note-on is a note-off (AC-43). Port disconnect releases held
   notes (AC-53).
8. **Consultant Q2 (Freeze scope)** ruled: **global** when nothing is selected
   — a MIDI key has no selection context and the same rule must hold everywhere.
9. **Consultant Q3 (does Blackout kill real DMX output)** ruled: **yes** —
   blackout means blackout on every output; previz-first does not mean
   output-second. Overridable by Jake.
10. **Timeline playhead (Q1)** ruled: v1 playhead *runs* the show
    (linear-vs-editor first); editing-while-running is Phase 3 with
    busk-recording.
11. **MCP surface**: every P2 feature ships its MCP commands in the same task
    that ships the feature (transport_*, get_transport_state, set/get_workspace,
    set_fixture_meta, simulate_midi, …); `tool-parity.spec.js` extended in the
    same PR. `get_transport_state` is the phase's testability linchpin.

## Verification gate (phase done means)

- All non-stretch ACs green in the model-layer suite (fake timers; no WebGL).
- `verification.md` gains a §9 transport/MIDI checklist, executed against the
  live app via MCP with committed screenshot/state evidence, incl.:
  stop a running chase → visible smooth fade (not freeze-cut); resume → phase
  preserved (`get_transport_state`); blackout latches over a running cue;
  `simulate_midi` note plays a slot; two playbacks sharing fixtures release
  without a snap.
- Existing 408 tests stay green; lint 0 errors; upstream-edit ledger current;
  Fable adversarial review passes (findings fixed) before merge.
- Jake's issues [#2] (playback feel) closes with evidence; [#7] (MIDI) closes
  or carries only the ruled-out v1 KILLs.

## Open questions for Jake (non-blocking; defaults stand until answered)

1. **Which MIDI controller do you actually own?** If it's a grid/pad controller
   (Launchpad-style) rather than a keyboard, the no-MIDI-out ruling and default
   map change (scope §7/Q5).
2. Blackout also zeroes real DMX output (ruling 9) — confirm or veto.
3. The de-scope ladder sacrifices the timeline before MIDI — confirm or flip.

## Non-goals restated

No HTP/LTP mixing bus, no venue geometry, no MIDI hardware feedback, no
timeline automation lanes beyond one intensity lane, no Electron work.
