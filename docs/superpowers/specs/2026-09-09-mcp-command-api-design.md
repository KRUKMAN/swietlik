# Świetlik Phase 1 — MCP Command API (design spec)

Status: approved 2026-09-09 (design approved in chat; details delegated to Claude).

## Goal

Claude (any session, any agent) can control the running Świetlik app in full —
patch and position fixtures, set channels, build groups/scenes/effects/chases,
run playback, manage the show — through a native MCP server, and can *see* the
result via a visualizer screenshot tool. The same surface doubles as the
verification tooling for Phases 2–4.

## Architecture: sidecar bridge

```
Claude session ──stdio (MCP)──> mcp/server (Node)
                                   │  embeds WS hub ws://127.0.0.1:5215
                                   ▼
                        src/mcp-bridge/ (in-app WS client)
                                   │  executes via command registry
                                   ▼
                        reactive(ShowSingleton)  →  live UI + visualizer
```

- **`mcp/`** (new top-level package, plain Node, no build step):
  `@modelcontextprotocol/sdk` stdio server + `ws` hub. Registered in the
  repo's `.mcp.json` so Claude Code sessions in this repo get the tools
  automatically. Tool call → JSON request over WS to the connected app →
  response → MCP result. If no app is connected: structured error telling the
  caller to open Świetlik at localhost:5173.
- **`src/mcp-bridge/`** (new, fully additive): WS client with
  reconnect/backoff, started on the existing `app_ready` EventBus event
  (fires after show + OFL data are loaded — `app.activity.vue`). Exactly one
  active app connection; a newer tab supersedes the older one (server tells
  the old to detach). Survives HMR/reload by reconnecting.
- **Critical invariant**: the bridge obtains the show handle as
  `reactive(ShowSingleton)` — Vue's proxy cache dedups this to the same
  reactive proxy `main.js` installed as `$show`, so external mutations render
  in the UI immediately. Never call the raw singleton (silent UI desync).

## Command registry (in-app)

`src/mcp-bridge/commands/*.js`: pure modules mapping
`commandName → (show, args) → serializable result`.

- Uniform envelope: `{ ok: true, result } | { ok: false, error: { code, message } }`.
- Arg validation before touching models; command exceptions caught and
  returned as errors — the app never crashes from a bad command.
- Composite `patchFixture`: fetch OFL JSON (same axios path + cache pattern
  as `Show.prepareFixtures`) → `fixturePool.addRaw` → `universe.patchFixture`,
  with auto channel addressing (`findChStartAutoPatch`) when `chStart`
  omitted. Raw `addRaw` without OFL data produces a broken fixture — the
  registry owns this two-step so callers can't get it wrong.
- State queries return compact summaries (ids, names, key values), not raw
  model dumps — deliberately token-friendly for agent callers.

## MCP tool surface (v1, ~21 tools)

Queries: `get_show_state`, `get_fixture`, `search_fixture_library`.
Patch: `patch_fixture`, `unpatch_fixture`, `move_fixture` (position+rotation).
Control: `set_channels` (named quick-accessors — Intensity/Pan/Tilt/Color… —
or raw channel/value pairs), `create_group`, `add_fixtures_to_group`,
`create_scene`, `create_effect`, `create_chase`, `play_cue`, `play_chase`,
`stop_all`, `master_row`, `set_bpm`.
Show: `new_show`, `save_show`, `load_show`, `undo`, `redo`.
Vision: `screenshot_visualizer` — Three.js canvas `toDataURL` → MCP image
content (requires `preserveDrawingBuffer` or a forced render before capture).

## Error handling

- Request/response correlation ids over WS; 10 s timeout per command.
- Bridge-down / app-closed → `{ code: 'APP_NOT_CONNECTED' }` with remedy text.
- Command errors carry the thrown message + command name; validation errors
  name the offending argument.

## Testing

1. Registry unit tests in the existing Vitest harness (jsdom + stubs; axios
   mocked for OFL fetch) — every command, success + failure paths.
2. Integration: MCP server started as a child process, a scripted fake app
   connects over real WS, tools exercised end-to-end (no browser needed).
3. E2E: Claude drives the real app via the tools and screenshots the
   visualizer — becomes the standing verification method for later phases.

## Non-goals (v1)

Auth (loopback only), multi-user/remote access, SaaS deployment,
stage-builder commands (Phase 2), embedded chat UI, Electron packaging.

## Constraints

- Additive-first: no upstream `src/` edits except the one-line bridge import
  hook (logged in `docs/swietlik/upstream-diff.md`). `App.vue` or
  `app.activity.vue` hook point — whichever needs the smaller diff.
- Port 5215 default, overridable via env (`SWIETLIK_MCP_PORT` /
  `VITE_SWIETLIK_MCP_PORT`); must not collide with the DMX gateway (5214).
- GPL-3.0 applies to the whole repo including `mcp/`.
