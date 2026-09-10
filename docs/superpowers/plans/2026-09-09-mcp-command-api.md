# Świetlik Phase 1 — MCP Command API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give any Claude session full programmatic control of a running Świetlik instance — patch/position fixtures, set channels, build groups/scenes/effects/chases, run playback, manage the show, and screenshot the 3D visualizer — through a native MCP server registered in this repo's `.mcp.json`.

**Architecture:** A sidecar bridge. A plain-Node package `mcp/` runs an MCP stdio server that embeds a WebSocket hub on `ws://127.0.0.1:5215`. A fully additive in-app module `src/mcp-bridge/` connects to that hub as a WS client when the existing `app_ready` EventBus event fires, and executes incoming commands against a command registry bound to `reactive(ShowSingleton)` — the same Vue proxy `main.js` installs as `$show`, so every mutation renders live. Requests and responses share one dependency-free envelope module (`mcp/protocol.js`) imported by both sides.

**Tech Stack:** Vue 3 (`@vue/compat`) + Vite 5, plain-JS DMX domain models, Three.js visualizer, Vitest 3 + jsdom, `@modelcontextprotocol/sdk` (stdio transport), `ws`, `axios` (already a dependency), `mitt` EventBus.

**Spec:** [`docs/superpowers/specs/2026-09-09-mcp-command-api-design.md`](../specs/2026-09-09-mcp-command-api-design.md)

**Execution model:** Run this plan with the **ultracode** workflow, **≤5 concurrent agents**. Use **opus** for Tasks 7 and 8 (async reconnect logic and the cross-process MCP/WS integration), **sonnet** for Tasks 3–6 and 9. Tasks 1 and 2 are foundational — run them first, sequentially, on either model. **Every test must be written from this plan's code blocks**, not improvised: the code blocks are the contract that keeps signatures identical across tasks.

**Dependency order:**

```
Task 1 (protocol)  ─┬─> Task 2 (registry) ─┬─> Task 3 (queries)
                    │                       ├─> Task 4 (patch)
                    │                       ├─> Task 5 (control)
                    │                       ├─> Task 6 (show + vision)
                    │                       └─> Task 7 (bridge + hook)
                    └─────────────────────────> Task 8 (MCP server + hub)
                                                        │
   Tasks 3,4,5,6,7,8 ───────────────────────────────────┴─> Task 9 (wiring & docs)
```

Tasks 3, 4, 5, 6 are mutually independent (each creates its own `*.commands.js` file — there is **no shared aggregator file to edit**, see Task 2's `import.meta.glob` loader) and may run concurrently. Task 7 needs only Task 2. Task 8 needs only Task 1 — it talks the envelope to a scripted fake app, never to the real browser.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Additive-first.** No upstream `src/` edits except **exactly one** line: the bridge import hook in `src/App.vue` (Task 7). Every upstream file touched **MUST** be logged in `docs/swietlik/upstream-diff.md` with a one-line reason — that ledger entry is part of Task 7's commit, not deferred to Task 9.
- **`npm run lint:ci` must stay at 0 errors.** It lints `src` only (`eslint --ext .js,.vue --ignore-path .gitignore src`), so everything under `src/mcp-bridge/` is subject to `airbnb-base` + `plugin:vue/vue3-recommended`. Concretely: `max-len` 100 chars, no `for...of` (`no-restricted-syntax`), `import/extensions` is `js: 'never'` so **in-app imports of the shared protocol file must be written `@root/mcp/protocol`, never `@root/mcp/protocol.js`**, `class-methods-use-this` is an error, and `no-console` is a warning — the repo tolerates 12 pre-existing warnings, so guard any bridge logging with `// eslint-disable-next-line no-console`. Files under `mcp/` and `test/` are outside the lint path.
- **All 156 existing tests stay green.** `npm run test:run` must report 156 + the new tests, 0 failures. Never modify `vitest.config.mjs`'s existing aliases or the `test/stubs/` contents.
- **REACTIVITY INVARIANT.** The bridge obtains the show handle as `reactive(ShowSingleton)` — `import { reactive } from 'vue'` plus `import ShowSingleton from '@/singletons/show.singleton'`. Vue's proxy cache returns the *same* proxy `src/main.js` installed as `$show`, so external mutations re-render the UI. Calling the raw singleton bypasses Vue's traps and silently desyncs the UI. This must never be "optimised away".
- **Port rules.** Default `5215`. Overridable via `SWIETLIK_MCP_PORT` (Node side) / `VITE_SWIETLIK_MCP_PORT` (app side). Port `5214` is the DMX gateway (`VITE_APP_DMX2WS_SERVER_URL="127.0.0.1:5214"`) and is **rejected** by `resolvePort`. Loopback `127.0.0.1` only — no auth, no remote binding.
- **Token-compact query results.** Query commands return summaries (ids, names, key values), never raw model dumps. `get_show_state` never includes per-channel values; `get_fixture` is the drill-down.
- **GPL-3.0 applies to the whole repo including `mcp/`.** No attribution removal, no new file that strips the licence context.
- **Naming convention:** MCP-facing argument names are `snake_case` (`fixture_ids`, `group_id`, `ch_start`); result payload keys are `camelCase` (`fixtureCount`, `chStart`). Command names are `snake_case` verbs. This split is deliberate and enforced by the Task 9 parity test.
- **Never commit** `node_modules/`, `dist/`, `out/`.

---

## File Structure

| Path | Responsibility | Task |
| --- | --- | --- |
| `mcp/protocol.js` | Shared, dependency-free envelope: message constructors, parser, error codes, port resolution. Imported by both `mcp/` (Node) and `src/mcp-bridge/` (browser). | 1 |
| `mcp/package.json` | `{"type": "module"}` marker so `mcp/*.js` are ESM under Node. | 1 |
| `src/mcp-bridge/commands/validate.js` | `ValidationError`, `validateArgs`, `assertVec3`. | 2 |
| `src/mcp-bridge/commands/registry.js` | `registerCommand` / `getCommand` / `hasCommand` / `listCommands` / `getCommandSchema` / `dispatch`. | 2 |
| `src/mcp-bridge/commands/index.js` | `import.meta.glob` loader that pulls in every `*.commands.js`, plus registry re-exports. Written once; **never edited again**. | 2 |
| `src/mcp-bridge/commands/query.commands.js` | `get_show_state`, `get_fixture`, `search_fixture_library`. | 3 |
| `src/mcp-bridge/ofl.js` | `fetchOFL` / `clearOFLCache` — axios OFL fetch with the same cache pattern as `Show.prepareFixtures`. | 4 |
| `src/mcp-bridge/commands/patch.commands.js` | `patch_fixture`, `unpatch_fixture`, `move_fixture`. | 4 |
| `src/mcp-bridge/commands/control.commands.js` | `set_channels`, `create_group`, `add_fixtures_to_group`, `create_scene`, `create_effect`, `create_chase`, `play_cue`, `play_chase`, `stop_all`, `master_row`, `set_bpm`. | 5 |
| `src/mcp-bridge/commands/show.commands.js` | `new_show`, `save_show`, `load_show`, `undo`, `redo`. | 6 |
| `src/mcp-bridge/commands/vision.commands.js` | `screenshot_visualizer`. | 6 |
| `src/mcp-bridge/bridge.js` | WS client class: connect, reconnect backoff, message → `dispatch` → reply. | 7 |
| `src/mcp-bridge/index.js` | `startMcpBridge` / `stopMcpBridge`, `reactive(ShowSingleton)` binding, `app_ready` subscription. | 7 |
| `src/App.vue` | **THE ONE UPSTREAM EDIT** — a single `import '@/mcp-bridge';` line. | 7 |
| `mcp/tools.js` | `TOOLS` catalogue (name, description, JSON Schema) + `TOOL_NAMES`. | 8 |
| `mcp/hub.js` | `AppHub` WS server: newest-tab-wins, correlation ids, 10 s timeout, `HubError`. | 8 |
| `mcp/server.js` | MCP stdio server wiring `TOOLS` → `hub.call`. | 8 |
| `.mcp.json` | Registers the server for Claude Code sessions in this repo. | 9 |
| `test/helpers/show-double.js` | Minimal show stand-in built from real pools. | 3 |

---

## Task 1: Shared protocol envelope

**Files:**
- Create: `mcp/protocol.js`
- Create: `mcp/package.json`
- Test: `test/mcp/protocol.spec.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all named exports of `mcp/protocol.js`):
  - `PROTOCOL_VERSION: 1`
  - `DEFAULT_MCP_PORT: 5215`, `DMX_GATEWAY_PORT: 5214`, `COMMAND_TIMEOUT_MS: 10000`
  - `ERROR_CODES: { APP_NOT_CONNECTED, TIMEOUT, VALIDATION, COMMAND_ERROR, UNKNOWN_COMMAND }` (each value equals its key)
  - `MESSAGE_TYPES: { REQUEST: 'request', RESPONSE: 'response', DETACH: 'detach' }`
  - `APP_NOT_CONNECTED_REMEDY: String`
  - `makeRequest(id: string, cmd: string, args?: object) -> { v, type: 'request', id, cmd, args }`
  - `makeSuccess(id: string, result: any) -> { v, type: 'response', id, ok: true, result }`
  - `makeError(id: string, code: string, message: string) -> { v, type: 'response', id, ok: false, error: { code, message } }`
  - `makeDetach(reason: string) -> { v, type: 'detach', reason }`
  - `parseMessage(raw: string|Buffer) -> object | null`
  - `isRequest(msg) -> boolean`, `isResponse(msg) -> boolean`
  - `resolvePort(env?: object) -> number`

- [ ] **Step 1: Write the failing test**

Create `test/mcp/protocol.spec.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION,
  DEFAULT_MCP_PORT,
  DMX_GATEWAY_PORT,
  COMMAND_TIMEOUT_MS,
  ERROR_CODES,
  MESSAGE_TYPES,
  APP_NOT_CONNECTED_REMEDY,
  makeRequest,
  makeSuccess,
  makeError,
  makeDetach,
  parseMessage,
  isRequest,
  isResponse,
  resolvePort,
} from '@root/mcp/protocol';

describe('protocol constants', () => {
  it('pins the wire version, ports and timeout', () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(DEFAULT_MCP_PORT).toBe(5215);
    expect(DMX_GATEWAY_PORT).toBe(5214);
    expect(COMMAND_TIMEOUT_MS).toBe(10000);
  });

  it('exposes every error code as a self-named string', () => {
    expect(ERROR_CODES).toEqual({
      APP_NOT_CONNECTED: 'APP_NOT_CONNECTED',
      TIMEOUT: 'TIMEOUT',
      VALIDATION: 'VALIDATION',
      COMMAND_ERROR: 'COMMAND_ERROR',
      UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
    });
  });

  it('names the three message types', () => {
    expect(MESSAGE_TYPES).toEqual({
      REQUEST: 'request',
      RESPONSE: 'response',
      DETACH: 'detach',
    });
  });

  it('gives the caller an actionable remedy for a missing app', () => {
    expect(APP_NOT_CONNECTED_REMEDY).toContain('localhost:5173');
  });
});

describe('message constructors', () => {
  it('builds a request envelope', () => {
    expect(makeRequest('r1', 'set_bpm', { bpm: 128 })).toEqual({
      v: 1, type: 'request', id: 'r1', cmd: 'set_bpm', args: { bpm: 128 },
    });
  });

  it('defaults request args to an empty object', () => {
    expect(makeRequest('r2', 'stop_all').args).toEqual({});
  });

  it('builds a success envelope', () => {
    expect(makeSuccess('r1', { bpm: 128 })).toEqual({
      v: 1, type: 'response', id: 'r1', ok: true, result: { bpm: 128 },
    });
  });

  it('builds an error envelope', () => {
    expect(makeError('r1', ERROR_CODES.TIMEOUT, 'too slow')).toEqual({
      v: 1,
      type: 'response',
      id: 'r1',
      ok: false,
      error: { code: 'TIMEOUT', message: 'too slow' },
    });
  });

  it('builds a detach envelope', () => {
    expect(makeDetach('superseded')).toEqual({
      v: 1, type: 'detach', reason: 'superseded',
    });
  });
});

describe('parseMessage', () => {
  it('parses a JSON string into an object', () => {
    expect(parseMessage('{"v":1,"type":"request","id":"a","cmd":"undo","args":{}}'))
      .toEqual({
        v: 1, type: 'request', id: 'a', cmd: 'undo', args: {},
      });
  });

  it('parses a Buffer payload (ws delivers Buffers by default)', () => {
    const buffer = Buffer.from(JSON.stringify(makeSuccess('a', 1)), 'utf8');
    expect(parseMessage(buffer)).toEqual(makeSuccess('a', 1));
  });

  it('returns null for malformed JSON instead of throwing', () => {
    expect(parseMessage('not json')).toBeNull();
  });

  it('returns null for a JSON scalar or array', () => {
    expect(parseMessage('42')).toBeNull();
    expect(parseMessage('[1,2]')).toBeNull();
  });
});

describe('message predicates', () => {
  it('recognises a well-formed request', () => {
    expect(isRequest(makeRequest('a', 'undo'))).toBe(true);
  });

  it('rejects a request with no cmd', () => {
    expect(isRequest({ v: 1, type: 'request', id: 'a' })).toBe(false);
  });

  it('rejects a request carrying the wrong protocol version', () => {
    expect(isRequest({
      v: 2, type: 'request', id: 'a', cmd: 'undo', args: {},
    })).toBe(false);
  });

  it('recognises both response shapes', () => {
    expect(isResponse(makeSuccess('a', null))).toBe(true);
    expect(isResponse(makeError('a', 'TIMEOUT', 'x'))).toBe(true);
    expect(isResponse(makeRequest('a', 'undo'))).toBe(false);
    expect(isResponse(null)).toBe(false);
  });
});

describe('resolvePort', () => {
  it('falls back to the default when no env var is set', () => {
    expect(resolvePort({})).toBe(5215);
    expect(resolvePort()).toBe(5215);
  });

  it('prefers SWIETLIK_MCP_PORT over VITE_SWIETLIK_MCP_PORT', () => {
    expect(resolvePort({
      SWIETLIK_MCP_PORT: '6000',
      VITE_SWIETLIK_MCP_PORT: '7000',
    })).toBe(6000);
  });

  it('accepts the VITE_ prefixed variant on its own', () => {
    expect(resolvePort({ VITE_SWIETLIK_MCP_PORT: '7000' })).toBe(7000);
  });

  it('accepts 0 so tests can bind an ephemeral port', () => {
    expect(resolvePort({ SWIETLIK_MCP_PORT: '0' })).toBe(0);
  });

  it('rejects the DMX gateway port', () => {
    expect(() => resolvePort({ SWIETLIK_MCP_PORT: '5214' }))
      .toThrow(/5214 is the DMX gateway port/);
  });

  it('rejects non-numeric and out-of-range values', () => {
    expect(() => resolvePort({ SWIETLIK_MCP_PORT: 'abc' })).toThrow(/must be an integer/);
    expect(() => resolvePort({ SWIETLIK_MCP_PORT: '70000' })).toThrow(/0 and 65535/);
    expect(() => resolvePort({ SWIETLIK_MCP_PORT: '-1' })).toThrow(/0 and 65535/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- test/mcp/protocol.spec.js`
Expected: FAIL — `Failed to resolve import "@root/mcp/protocol"`.

- [ ] **Step 3: Write the implementation**

Create `mcp/package.json`:

```json
{
  "name": "swietlik-mcp",
  "private": true,
  "type": "module"
}
```

Create `mcp/protocol.js`:

```js
/**
 * Świetlik MCP wire protocol.
 *
 * Shared verbatim by the Node MCP server (`mcp/`) and the in-app WebSocket
 * bridge (`src/mcp-bridge/`). It must therefore stay dependency-free: no npm
 * imports, no Node built-ins, no `import.meta.env` access — callers pass their
 * own env object into `resolvePort`.
 *
 * @module mcp/protocol
 */

/**
 * Wire format version. Bumped only on a breaking envelope change.
 *
 * @constant {Number}
 */
export const PROTOCOL_VERSION = 1;

/**
 * Default loopback port for the MCP WebSocket hub.
 *
 * @constant {Number}
 */
export const DEFAULT_MCP_PORT = 5215;

/**
 * Port already owned by the WSC DMX gateway. Reserved, never usable.
 *
 * @constant {Number}
 */
export const DMX_GATEWAY_PORT = 5214;

/**
 * Per-command deadline, in milliseconds.
 *
 * @constant {Number}
 */
export const COMMAND_TIMEOUT_MS = 10000;

/**
 * Structured error codes carried in a failure response.
 *
 * @constant {Object}
 * @enum {String}
 */
export const ERROR_CODES = {
  APP_NOT_CONNECTED: 'APP_NOT_CONNECTED',
  TIMEOUT: 'TIMEOUT',
  VALIDATION: 'VALIDATION',
  COMMAND_ERROR: 'COMMAND_ERROR',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
};

/**
 * Envelope discriminators.
 *
 * @constant {Object}
 * @enum {String}
 */
export const MESSAGE_TYPES = {
  REQUEST: 'request',
  RESPONSE: 'response',
  DETACH: 'detach',
};

/**
 * Human remedy attached to every APP_NOT_CONNECTED error.
 *
 * @constant {String}
 */
export const APP_NOT_CONNECTED_REMEDY = 'Świetlik is not connected. Start the app with '
  + '`npm start` and open http://localhost:5173, then retry the command.';

/**
 * Builds a command request envelope.
 *
 * @param {String} id correlation id
 * @param {String} cmd command name
 * @param {Object} [args={}] command arguments
 * @return {Object} request envelope
 */
export function makeRequest(id, cmd, args = {}) {
  return {
    v: PROTOCOL_VERSION,
    type: MESSAGE_TYPES.REQUEST,
    id,
    cmd,
    args,
  };
}

/**
 * Builds a success response envelope.
 *
 * @param {String} id correlation id of the request being answered
 * @param {*} result serializable command result
 * @return {Object} response envelope
 */
export function makeSuccess(id, result) {
  return {
    v: PROTOCOL_VERSION,
    type: MESSAGE_TYPES.RESPONSE,
    id,
    ok: true,
    result,
  };
}

/**
 * Builds a failure response envelope.
 *
 * @param {String} id correlation id of the request being answered
 * @param {String} code one of ERROR_CODES
 * @param {String} message human-readable explanation
 * @return {Object} response envelope
 */
export function makeError(id, code, message) {
  return {
    v: PROTOCOL_VERSION,
    type: MESSAGE_TYPES.RESPONSE,
    id,
    ok: false,
    error: { code, message },
  };
}

/**
 * Builds a detach notice, sent to an app socket superseded by a newer tab.
 *
 * @param {String} reason detach reason
 * @return {Object} detach envelope
 */
export function makeDetach(reason) {
  return {
    v: PROTOCOL_VERSION,
    type: MESSAGE_TYPES.DETACH,
    reason,
  };
}

/**
 * Parses a raw WebSocket payload into a plain object.
 *
 * @param {String|Buffer|ArrayBuffer} raw payload as delivered by the socket
 * @return {Object|null} parsed object, or null when the payload is unusable
 */
export function parseMessage(raw) {
  try {
    const text = typeof raw === 'string' ? raw : String(raw);
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

/**
 * @param {*} msg candidate message
 * @return {Boolean} true when msg is a well-formed request of this version
 */
export function isRequest(msg) {
  return Boolean(msg)
    && msg.v === PROTOCOL_VERSION
    && msg.type === MESSAGE_TYPES.REQUEST
    && typeof msg.id === 'string'
    && typeof msg.cmd === 'string';
}

/**
 * @param {*} msg candidate message
 * @return {Boolean} true when msg is a well-formed response of this version
 */
export function isResponse(msg) {
  return Boolean(msg)
    && msg.v === PROTOCOL_VERSION
    && msg.type === MESSAGE_TYPES.RESPONSE
    && typeof msg.id === 'string'
    && typeof msg.ok === 'boolean';
}

/**
 * Resolves the hub port from an environment bag.
 *
 * `SWIETLIK_MCP_PORT` (Node) wins over `VITE_SWIETLIK_MCP_PORT` (browser).
 * Port 0 is allowed so tests can bind an ephemeral port.
 *
 * @param {Object} [env={}] environment bag (`process.env` or `import.meta.env`)
 * @return {Number} port number
 * @throws {Error} when the configured value is not a usable port
 */
export function resolvePort(env = {}) {
  const raw = env.SWIETLIK_MCP_PORT ?? env.VITE_SWIETLIK_MCP_PORT;
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_MCP_PORT;
  }
  const port = Number(raw);
  if (!Number.isInteger(port)) {
    throw new Error(`MCP port "${raw}" must be an integer.`);
  }
  if (port < 0 || port > 65535) {
    throw new Error(`MCP port ${port} must be between 0 and 65535.`);
  }
  if (port === DMX_GATEWAY_PORT) {
    throw new Error(`MCP port ${DMX_GATEWAY_PORT} is the DMX gateway port; pick another.`);
  }
  return port;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- test/mcp/protocol.spec.js`
Expected: PASS — 24 tests.

- [ ] **Step 5: Confirm nothing regressed**

Run: `npm run test:run && npm run lint:ci`
Expected: every suite green, including the original 156 Phase 0 tests; ESLint 0 errors (nothing under `src/` changed yet).

- [ ] **Step 6: Commit**

```bash
git add mcp/protocol.js mcp/package.json test/mcp/protocol.spec.js
git commit -m "$(cat <<'EOF'
feat(mcp): add shared MCP wire protocol module

Dependency-free envelope, error codes and port resolution shared by the
Node MCP server and the in-app WebSocket bridge.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Command registry core

**Files:**
- Create: `src/mcp-bridge/commands/validate.js`
- Create: `src/mcp-bridge/commands/registry.js`
- Create: `src/mcp-bridge/commands/index.js`
- Test: `test/mcp-bridge/validate.spec.js`
- Test: `test/mcp-bridge/registry.spec.js`

**Interfaces:**
- Consumes: `ERROR_CODES`, `makeSuccess`, `makeError` from `@root/mcp/protocol`.
- Produces:
  - `src/mcp-bridge/commands/validate.js`:
    - `class ValidationError extends Error` (`name === 'ValidationError'`)
    - `validateArgs(schema: object, args: object) -> object` — strict; returns a normalised copy with defaults applied.
    - `assertVec3(name: string, value: object) -> { x, y, z }`
  - `src/mcp-bridge/commands/registry.js`:
    - `registerCommand(name: string, spec: { description: string, args: object, handler: (show, args) => any })`
    - `getCommand(name) -> spec | undefined`
    - `getCommandSchema(name) -> object` (throws when unknown)
    - `hasCommand(name) -> boolean`
    - `listCommands() -> string[]` (sorted)
    - `dispatch(show, request: { id, cmd, args }) -> Promise<responseEnvelope>` — never throws.
  - `src/mcp-bridge/commands/index.js`: re-exports `dispatch`, `listCommands`, `hasCommand`, `getCommandSchema`, plus `loadedCommandModules: string[]`.
- **Schema rule vocabulary** (used by every later task, do not invent new keys):
  `{ type: 'number'|'string'|'boolean'|'object'|'array', required?: true, default?: any, integer?: true, min?: number, max?: number, minLength?: number, items?: 'number'|'string'|'object', enum?: any[] }`

- [ ] **Step 1: Write the failing validator test**

Create `test/mcp-bridge/validate.spec.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  validateArgs,
  assertVec3,
} from '@/mcp-bridge/commands/validate';

describe('validateArgs -- shape', () => {
  it('rejects a non-object argument bag', () => {
    expect(() => validateArgs({}, null)).toThrow(ValidationError);
    expect(() => validateArgs({}, [])).toThrow(/must be an object/);
  });

  it('rejects unknown arguments and lists the accepted ones', () => {
    const schema = { id: { type: 'number' }, name: { type: 'string' } };
    expect(() => validateArgs(schema, { nope: 1 }))
      .toThrow(/Unknown argument "nope". Accepted: id, name/);
  });

  it('reports "(none)" when the command takes no arguments', () => {
    expect(() => validateArgs({}, { x: 1 }))
      .toThrow(/Unknown argument "x". Accepted: \(none\)/);
  });
});

describe('validateArgs -- presence and defaults', () => {
  it('throws when a required argument is missing', () => {
    expect(() => validateArgs({ id: { type: 'number', required: true } }, {}))
      .toThrow('Missing required argument "id"');
  });

  it('treats explicit null as absent', () => {
    expect(() => validateArgs({ id: { type: 'number', required: true } }, { id: null }))
      .toThrow('Missing required argument "id"');
  });

  it('applies defaults for absent optional arguments', () => {
    const schema = { state: { type: 'boolean', default: true } };
    expect(validateArgs(schema, {})).toEqual({ state: true });
  });

  it('omits optional arguments that have no default', () => {
    expect(validateArgs({ name: { type: 'string' } }, {})).toEqual({});
  });
});

describe('validateArgs -- types and ranges', () => {
  it('enforces the declared type', () => {
    expect(() => validateArgs({ bpm: { type: 'number' } }, { bpm: '128' }))
      .toThrow('Argument "bpm" must be of type number');
  });

  it('rejects NaN and Infinity as numbers', () => {
    expect(() => validateArgs({ bpm: { type: 'number' } }, { bpm: NaN }))
      .toThrow('Argument "bpm" must be of type number');
    expect(() => validateArgs({ bpm: { type: 'number' } }, { bpm: Infinity }))
      .toThrow('Argument "bpm" must be of type number');
  });

  it('rejects arrays where an object is expected', () => {
    expect(() => validateArgs({ position: { type: 'object' } }, { position: [] }))
      .toThrow('Argument "position" must be of type object');
  });

  it('enforces integer, min and max', () => {
    const schema = { id: { type: 'number', integer: true, min: 0, max: 10 } };
    expect(() => validateArgs(schema, { id: 1.5 })).toThrow('Argument "id" must be an integer');
    expect(() => validateArgs(schema, { id: -1 })).toThrow('Argument "id" must be >= 0');
    expect(() => validateArgs(schema, { id: 11 })).toThrow('Argument "id" must be <= 10');
    expect(validateArgs(schema, { id: 7 })).toEqual({ id: 7 });
  });

  it('enforces minLength on arrays and strings', () => {
    expect(() => validateArgs({ ids: { type: 'array', minLength: 1 } }, { ids: [] }))
      .toThrow('Argument "ids" must contain at least 1 item(s)');
  });

  it('enforces array item types with an indexed message', () => {
    const schema = { ids: { type: 'array', items: 'number' } };
    expect(() => validateArgs(schema, { ids: [1, 'two'] }))
      .toThrow('Argument "ids[1]" must be of type number');
  });

  it('enforces enums', () => {
    const schema = { mime_type: { type: 'string', enum: ['image/png', 'image/jpeg'] } };
    expect(() => validateArgs(schema, { mime_type: 'image/gif' }))
      .toThrow('Argument "mime_type" must be one of: image/png, image/jpeg');
  });
});

describe('assertVec3', () => {
  it('returns a plain copy of the three axes', () => {
    expect(assertVec3('position', {
      x: 1, y: 2, z: 3, extra: 9,
    })).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('names the offending axis', () => {
    expect(() => assertVec3('position', { x: 1, y: 'up', z: 3 }))
      .toThrow('Argument "position.y" must be a number');
  });

  it('throws a ValidationError, not a plain Error', () => {
    expect(() => assertVec3('rotation', {})).toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp-bridge/validate.spec.js`
Expected: FAIL — `Failed to resolve import "@/mcp-bridge/commands/validate"`.

- [ ] **Step 3: Implement the validator**

Create `src/mcp-bridge/commands/validate.js`:

```js
/**
 * Argument validation for the MCP command registry.
 *
 * Validation runs before a command touches any model, so a malformed request
 * can never leave the show in a half-mutated state.
 *
 * @module mcp-bridge/commands/validate
 */

/**
 * @class ValidationError
 * @classdesc Raised when a command argument fails its schema rule. Mapped to
 * the VALIDATION error code by the dispatcher.
 * @extends {Error}
 */
export class ValidationError extends Error {
  /**
   * @param {String} message explanation naming the offending argument
   */
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Per-type predicates. `number` rejects NaN/Infinity, `object` rejects arrays.
 *
 * @constant {Object}
 * @private
 */
const TYPE_CHECKS = {
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  string: (value) => typeof value === 'string',
  boolean: (value) => typeof value === 'boolean',
  object: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  array: (value) => Array.isArray(value),
};

/**
 * Validates and normalises a command's argument bag.
 *
 * Strict: unknown keys are rejected rather than ignored, so an agent that
 * misspells an argument gets told instead of silently getting a no-op.
 *
 * @param {Object} schema map of argument name to rule object
 * @param {Object} args raw arguments from the wire
 * @return {Object} normalised arguments with defaults applied
 * @throws {ValidationError} on any rule violation
 */
export function validateArgs(schema, args) {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new ValidationError('Arguments must be an object.');
  }
  const known = Object.keys(schema);
  const accepted = known.length ? known.join(', ') : '(none)';
  Object.keys(args).forEach((key) => {
    if (!known.includes(key)) {
      throw new ValidationError(`Unknown argument "${key}". Accepted: ${accepted}`);
    }
  });

  const out = {};
  known.forEach((key) => {
    const rule = schema[key];
    const value = args[key];
    if (value === undefined || value === null) {
      if (rule.required) {
        throw new ValidationError(`Missing required argument "${key}"`);
      }
      if (rule.default !== undefined) {
        out[key] = rule.default;
      }
      return;
    }
    if (!TYPE_CHECKS[rule.type](value)) {
      throw new ValidationError(`Argument "${key}" must be of type ${rule.type}`);
    }
    if (rule.integer && !Number.isInteger(value)) {
      throw new ValidationError(`Argument "${key}" must be an integer`);
    }
    if (rule.min !== undefined && value < rule.min) {
      throw new ValidationError(`Argument "${key}" must be >= ${rule.min}`);
    }
    if (rule.max !== undefined && value > rule.max) {
      throw new ValidationError(`Argument "${key}" must be <= ${rule.max}`);
    }
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      throw new ValidationError(
        `Argument "${key}" must contain at least ${rule.minLength} item(s)`,
      );
    }
    if (rule.items && rule.type === 'array') {
      value.forEach((item, index) => {
        if (!TYPE_CHECKS[rule.items](item)) {
          throw new ValidationError(`Argument "${key}[${index}]" must be of type ${rule.items}`);
        }
      });
    }
    if (rule.enum && !rule.enum.includes(value)) {
      throw new ValidationError(`Argument "${key}" must be one of: ${rule.enum.join(', ')}`);
    }
    out[key] = value;
  });
  return out;
}

/**
 * Validates a 3D vector argument and strips any extra keys.
 *
 * @param {String} name argument name, used in the error message
 * @param {Object} value candidate `{ x, y, z }` object
 * @return {Object} `{ x, y, z }` copy
 * @throws {ValidationError} when any axis is missing or not finite
 */
export function assertVec3(name, value) {
  ['x', 'y', 'z'].forEach((axis) => {
    if (typeof value[axis] !== 'number' || !Number.isFinite(value[axis])) {
      throw new ValidationError(`Argument "${name}.${axis}" must be a number`);
    }
  });
  return { x: value.x, y: value.y, z: value.z };
}
```

- [ ] **Step 4: Run the validator test**

Run: `npm run test:run -- test/mcp-bridge/validate.spec.js`
Expected: PASS — 17 tests.

- [ ] **Step 5: Write the failing registry test**

Create `test/mcp-bridge/registry.spec.js`:

```js
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import {
  registerCommand,
  getCommand,
  getCommandSchema,
  hasCommand,
  listCommands,
  dispatch,
  __resetRegistryForTests,
} from '@/mcp-bridge/commands/registry';
import { ValidationError } from '@/mcp-bridge/commands/validate';

beforeEach(() => {
  __resetRegistryForTests();
});

describe('registerCommand', () => {
  it('stores the spec and exposes it by name', () => {
    const handler = vi.fn();
    registerCommand('set_bpm', {
      description: 'Sets the show BPM.',
      args: { bpm: { type: 'number', required: true } },
      handler,
    });

    expect(hasCommand('set_bpm')).toBe(true);
    expect(getCommand('set_bpm').handler).toBe(handler);
    expect(getCommandSchema('set_bpm')).toEqual({
      bpm: { type: 'number', required: true },
    });
  });

  it('lists commands in sorted order', () => {
    registerCommand('undo', { description: 'u', args: {}, handler: () => null });
    registerCommand('add_fixtures_to_group', {
      description: 'a', args: {}, handler: () => null,
    });
    expect(listCommands()).toEqual(['add_fixtures_to_group', 'undo']);
  });

  it('refuses to register the same name twice', () => {
    registerCommand('undo', { description: 'u', args: {}, handler: () => null });
    expect(() => registerCommand('undo', {
      description: 'u', args: {}, handler: () => null,
    })).toThrow('Command "undo" is already registered');
  });

  it('rejects a spec without a callable handler', () => {
    expect(() => registerCommand('bad', { description: 'b', args: {} }))
      .toThrow('Command "bad" needs a handler function');
  });

  it('rejects a spec without a description', () => {
    expect(() => registerCommand('bad', { args: {}, handler: () => null }))
      .toThrow('Command "bad" needs a description');
  });

  it('throws when asked for the schema of an unknown command', () => {
    expect(() => getCommandSchema('nope')).toThrow('Unknown command "nope"');
  });
});

describe('dispatch', () => {
  beforeEach(() => {
    registerCommand('set_bpm', {
      description: 'Sets the show BPM.',
      args: { bpm: { type: 'number', required: true, min: 20, max: 400 } },
      handler: (show, args) => {
        show.bpm = args.bpm;
        return { bpm: show.bpm };
      },
    });
  });

  it('returns a success envelope carrying the handler result', async () => {
    const show = { bpm: 120 };
    await expect(dispatch(show, { id: 'r1', cmd: 'set_bpm', args: { bpm: 128 } }))
      .resolves.toEqual({
        v: 1, type: 'response', id: 'r1', ok: true, result: { bpm: 128 },
      });
    expect(show.bpm).toBe(128);
  });

  it('awaits async handlers', async () => {
    registerCommand('slow', {
      description: 'async',
      args: {},
      handler: async () => ({ done: true }),
    });
    const res = await dispatch({}, { id: 'r2', cmd: 'slow', args: {} });
    expect(res.result).toEqual({ done: true });
  });

  it('normalises an undefined handler result to null', async () => {
    registerCommand('quiet', { description: 'q', args: {}, handler: () => undefined });
    const res = await dispatch({}, { id: 'r3', cmd: 'quiet', args: {} });
    expect(res).toEqual({
      v: 1, type: 'response', id: 'r3', ok: true, result: null,
    });
  });

  it('treats a missing args key as an empty bag', async () => {
    registerCommand('noargs', { description: 'n', args: {}, handler: () => 'ok' });
    const res = await dispatch({}, { id: 'r4', cmd: 'noargs' });
    expect(res.ok).toBe(true);
  });

  it('returns UNKNOWN_COMMAND naming the known commands', async () => {
    const res = await dispatch({}, { id: 'r5', cmd: 'nope', args: {} });
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('UNKNOWN_COMMAND');
    expect(res.error.message).toContain('Unknown command "nope"');
    expect(res.error.message).toContain('set_bpm');
  });

  it('returns VALIDATION for a bad argument, without calling the handler', async () => {
    const res = await dispatch({ bpm: 120 }, { id: 'r6', cmd: 'set_bpm', args: { bpm: 5 } });
    expect(res.ok).toBe(false);
    expect(res.error).toEqual({
      code: 'VALIDATION',
      message: 'set_bpm: Argument "bpm" must be >= 20',
    });
  });

  it('returns COMMAND_ERROR when the handler throws', async () => {
    registerCommand('boom', {
      description: 'b',
      args: {},
      handler: () => { throw new Error('universe is full'); },
    });
    const res = await dispatch({}, { id: 'r7', cmd: 'boom', args: {} });
    expect(res.error).toEqual({
      code: 'COMMAND_ERROR',
      message: 'boom: universe is full',
    });
  });

  it('maps a ValidationError thrown inside a handler to VALIDATION', async () => {
    registerCommand('picky', {
      description: 'p',
      args: {},
      handler: () => { throw new ValidationError('Argument "mode" must be one of: A, B'); },
    });
    const res = await dispatch({}, { id: 'r8', cmd: 'picky', args: {} });
    expect(res.error.code).toBe('VALIDATION');
    expect(res.error.message).toBe('picky: Argument "mode" must be one of: A, B');
  });

  it('returns COMMAND_ERROR when an async handler rejects', async () => {
    registerCommand('async_boom', {
      description: 'ab',
      args: {},
      handler: async () => { throw new Error('network down'); },
    });
    const res = await dispatch({}, { id: 'r9', cmd: 'async_boom', args: {} });
    expect(res.error).toEqual({
      code: 'COMMAND_ERROR',
      message: 'async_boom: network down',
    });
  });

  it('never rejects, whatever the handler does', async () => {
    registerCommand('nasty', {
      description: 'n',
      args: {},
      // eslint-disable-next-line prefer-promise-reject-errors
      handler: () => Promise.reject('a bare string'),
    });
    const res = await dispatch({}, { id: 'r10', cmd: 'nasty', args: {} });
    expect(res.ok).toBe(false);
    expect(res.error.message).toBe('nasty: a bare string');
  });
});
```

- [ ] **Step 6: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp-bridge/registry.spec.js`
Expected: FAIL — `Failed to resolve import "@/mcp-bridge/commands/registry"`.

- [ ] **Step 7: Implement the registry**

Create `src/mcp-bridge/commands/registry.js`:

```js
import {
  ERROR_CODES,
  makeSuccess,
  makeError,
} from '@root/mcp/protocol';
import { ValidationError, validateArgs } from './validate';

/**
 * Command registry for the in-app MCP bridge.
 *
 * Commands are pure `(show, args) -> serializable result` functions. Every
 * failure path is converted into a structured error envelope: a bad command
 * must never crash the app.
 *
 * @module mcp-bridge/commands/registry
 */

/**
 * Registered command specs, keyed by command name.
 *
 * @constant {Map<String, Object>}
 * @private
 */
const registry = new Map();

/**
 * Registers a command. Called at module load time by every `*.commands.js`.
 *
 * @param {String} name snake_case command name, matching the MCP tool name
 * @param {Object} spec command specification
 * @param {String} spec.description one-line description, mirrored in mcp/tools.js
 * @param {Object} spec.args argument schema, see ./validate.js
 * @param {Function} spec.handler `(show, args) => result | Promise<result>`
 * @public
 */
export function registerCommand(name, spec) {
  if (registry.has(name)) {
    throw new Error(`Command "${name}" is already registered`);
  }
  if (!spec || typeof spec.handler !== 'function') {
    throw new Error(`Command "${name}" needs a handler function`);
  }
  if (typeof spec.description !== 'string' || !spec.description.length) {
    throw new Error(`Command "${name}" needs a description`);
  }
  registry.set(name, {
    description: spec.description,
    args: spec.args || {},
    handler: spec.handler,
  });
}

/**
 * @param {String} name command name
 * @return {Object|undefined} the registered spec
 * @public
 */
export function getCommand(name) {
  return registry.get(name);
}

/**
 * @param {String} name command name
 * @return {Boolean} whether the command exists
 * @public
 */
export function hasCommand(name) {
  return registry.has(name);
}

/**
 * @return {Array<String>} every registered command name, sorted
 * @public
 */
export function listCommands() {
  return Array.from(registry.keys()).sort();
}

/**
 * @param {String} name command name
 * @return {Object} the command's argument schema
 * @throws {Error} when the command is not registered
 * @public
 */
export function getCommandSchema(name) {
  const command = registry.get(name);
  if (!command) {
    throw new Error(`Unknown command "${name}"`);
  }
  return command.args;
}

/**
 * Executes a request envelope against the show, returning a response envelope.
 *
 * Never throws and never rejects.
 *
 * @param {Object} show reactive show handle
 * @param {Object} request `{ id, cmd, args }`
 * @return {Promise<Object>} response envelope
 * @async
 * @public
 */
export async function dispatch(show, request) {
  const { id, cmd } = request;
  const command = registry.get(cmd);
  if (!command) {
    return makeError(
      id,
      ERROR_CODES.UNKNOWN_COMMAND,
      `Unknown command "${cmd}". Known commands: ${listCommands().join(', ')}`,
    );
  }

  let args;
  try {
    args = validateArgs(command.args, request.args || {});
  } catch (err) {
    return makeError(id, ERROR_CODES.VALIDATION, `${cmd}: ${err.message}`);
  }

  try {
    const result = await command.handler(show, args);
    return makeSuccess(id, result === undefined ? null : result);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const code = err instanceof ValidationError
      ? ERROR_CODES.VALIDATION
      : ERROR_CODES.COMMAND_ERROR;
    return makeError(id, code, `${cmd}: ${message}`);
  }
}

/**
 * Empties the registry. Test-only; the app never calls this.
 *
 * @private
 */
export function __resetRegistryForTests() {
  registry.clear();
}
```

- [ ] **Step 8: Run the registry test**

Run: `npm run test:run -- test/mcp-bridge/registry.spec.js`
Expected: PASS — 16 tests.

- [ ] **Step 9: Create the command loader**

Create `src/mcp-bridge/commands/index.js`:

```js
/**
 * Command registry entry point.
 *
 * Every `*.commands.js` sibling registers its commands as an import side
 * effect. The glob is eager so registration completes before the bridge sends
 * its first response, and its result is exported so bundlers keep the modules.
 *
 * IMPORTANT: this file is written once and never edited again. New command
 * groups are added by creating a new `<group>.commands.js` file next to it.
 *
 * @module mcp-bridge/commands
 */

const modules = import.meta.glob('./*.commands.js', { eager: true });

/**
 * Paths of the command modules that were loaded, sorted. Used by the tool
 * parity test to prove no command group was silently dropped.
 *
 * @constant {Array<String>}
 */
export const loadedCommandModules = Object.keys(modules).sort();

export {
  dispatch,
  listCommands,
  hasCommand,
  getCommandSchema,
} from './registry';
```

- [ ] **Step 10: Run the full suite and lint**

Run: `npm run test:run && npm run lint:ci`
Expected: every suite green, including the original 156 Phase 0 tests; ESLint 0 errors.

- [ ] **Step 11: Commit**

```bash
git add src/mcp-bridge/commands test/mcp-bridge/validate.spec.js test/mcp-bridge/registry.spec.js
git commit -m "$(cat <<'EOF'
feat(mcp): add in-app command registry and argument validator

Strict schema validation, structured error envelopes and a glob-based
command loader so command groups register without a shared aggregator.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Query commands

**Files:**
- Create: `test/helpers/show-double.js`
- Create: `src/mcp-bridge/commands/query.commands.js`
- Test: `test/mcp-bridge/query.commands.spec.js`

**Interfaces:**
- Consumes: `registerCommand` from `./registry`.
- Produces three registered commands:
  - `get_show_state` — args `{}` → `{ name, bpm, saved, fixtureCount, groupCount, universes: [{ id, name, color, fixtureCount, usedChannels }], fixtures: [{ id, name, manufacturer, model, mode, universe, chStart, chCount }], groups: [{ id, name, color, fixtureIds, cues: [{ id, name, type, duration, state }], chases: [{ id, name, gridIndex, duration, cueCount }] }] }`
  - `get_fixture` — args `{ id: number (int, >=0, required) }` → `{ id, name, manufacturer, model, mode, category, universe, chStart, chStop, chCount, position: {x,y,z}, rotation: {x,y,z}, quickAccessors: string[], channels: [{ index, name, type, value }] }`
  - `search_fixture_library` — args `{ query: string (required), limit: number (int, 1..100, default 20) }` → `{ total, truncated, results: [{ manufacturer, model, path }] }`
- Produces `test/helpers/show-double.js`: `makeShowDouble(overrides?) -> object`, `sharpyFixtureData(overrides?) -> object`, `patchSharpy(show, overrides?) -> Fixture`, `SHARPY` (the parsed OFL definition). **Re-used verbatim by Tasks 4, 5 and 6 — do not fork it.**

- [ ] **Step 1: Write the show double helper**

Create `test/helpers/show-double.js`:

```js
import { vi } from 'vitest';
import FixturePool from '@/models/DMX/fixture.pool.model';
import UniversePool from '@/models/DMX/universe.pool.model';
import GroupPool from '@/models/DMX/group.pool.model';
import Master from '@/models/DMX/master.model';
import loadOFL from './ofl';

/**
 * Real Clay Paky Sharpy OFL definition, loaded from `public/fixtures`.
 *
 * @constant {Object}
 */
export const SHARPY = loadOFL('clay-paky/sharpy');

/**
 * Fixture-pool constructor payload built from the real Sharpy definition.
 *
 * The OFL payload is deep-cloned per call: `Fixture.prepareChannels` rewrites
 * `availableChannels[...].capability.type` when resolving fine aliases, so a
 * shared object would leak state between tests.
 *
 * @param {Object} [overrides={}] constructor-data overrides
 * @return {Object} fixture configuration object
 */
export function sharpyFixtureData(overrides = {}) {
  return {
    OFLData: JSON.parse(JSON.stringify(SHARPY)),
    universe: 0,
    manufacturer: 'clay-paky',
    model: 'sharpy',
    mode: 'Standard',
    name: 'Sharpy',
    chStart: 0,
    position: { x: 0, y: 0, z: 10 },
    rotation: { x: 180, y: 0, z: 0 },
    ...overrides,
  };
}

/**
 * Builds a plain stand-in for the reactive Show singleton.
 *
 * The pools are the REAL model classes -- only the members commands actually
 * touch are faked (`visualizerHandle`, `persistLocally`, `genShowFile`). A
 * plain object is used deliberately: `reactive()` wrapping is the bridge's job
 * (Task 7) and is asserted there, not here.
 *
 * @param {Object} [overrides={}] show-member overrides
 * @return {Object} show stand-in
 */
export function makeShowDouble(overrides = {}) {
  const fixturePool = new FixturePool();
  const universePool = new UniversePool();
  const groupPool = new GroupPool();
  universePool.addRaw();
  return {
    name: 'test_show',
    bpm: 120,
    isSaved: true,
    ready: true,
    rawOFLFixtures: [
      { name: 'clay-paky', fixtures: ['sharpy.json', 'alpha-beam-700.json'] },
      { name: 'american-dj', fixtures: ['dotz-par.json'] },
    ],
    fixturePool,
    universePool,
    groupPool,
    master: new Master(groupPool),
    visualizerHandle: {
      preferences: null,
      showData: { camera: 'default' },
      render: vi.fn(),
      renderer: {
        domElement: {
          width: 1280,
          height: 720,
          toDataURL: vi.fn(() => 'data:image/png;base64,UE5HREFUQQ=='),
        },
      },
    },
    persistLocally: vi.fn(),
    genShowFile: vi.fn(() => '{"name":"test_show"}'),
    ...overrides,
  };
}

/**
 * Adds a Sharpy to the show's fixture pool and patches it into its universe.
 *
 * @param {Object} show show stand-in from makeShowDouble
 * @param {Object} [overrides={}] fixture-data overrides
 * @return {Object} the patched Fixture instance
 */
export function patchSharpy(show, overrides = {}) {
  const fixture = show.fixturePool.addRaw(sharpyFixtureData(overrides));
  show.universePool.getFromId(fixture.universe).patchFixture(fixture);
  return fixture;
}
```

- [ ] **Step 2: Write the failing test**

Create `test/mcp-bridge/query.commands.spec.js`:

```js
import {
  describe, it, expect, beforeEach,
} from 'vitest';
import { dispatch } from '@/mcp-bridge/commands/registry';
import '@/mcp-bridge/commands/query.commands';
import MovingHead from '../stubs/moving_head.stub';
import Controls from '../stubs/controls.stub';
import { makeShowDouble, patchSharpy } from '../helpers/show-double';

/**
 * Unwraps a success envelope, failing loudly on an error envelope.
 *
 * @param {Object} envelope response envelope from dispatch
 * @return {*} the result payload
 */
function resultOf(envelope) {
  if (!envelope.ok) {
    throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
  }
  return envelope.result;
}

beforeEach(() => {
  MovingHead.reset();
  Controls.reset();
});

describe('get_show_state', () => {
  it('summarises an empty show', async () => {
    const show = makeShowDouble();
    const state = resultOf(await dispatch(show, { id: 'q1', cmd: 'get_show_state', args: {} }));

    expect(state).toEqual({
      name: 'test_show',
      bpm: 120,
      saved: true,
      fixtureCount: 0,
      groupCount: 0,
      universes: [{
        id: 0,
        name: 'Universe 0',
        color: expect.any(String),
        fixtureCount: 0,
        usedChannels: 0,
      }],
      fixtures: [],
      groups: [],
    });
  });

  it('reports patched fixtures and per-universe channel usage', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const state = resultOf(await dispatch(show, { id: 'q2', cmd: 'get_show_state', args: {} }));

    expect(state.fixtureCount).toBe(1);
    expect(state.fixtures).toEqual([{
      id: fixture.id,
      name: 'Sharpy',
      manufacturer: 'clay-paky',
      model: 'sharpy',
      mode: 'Standard',
      universe: 0,
      chStart: 0,
      chCount: fixture.channels.length,
    }]);
    expect(state.universes[0].fixtureCount).toBe(1);
    expect(state.universes[0].usedChannels).toBe(fixture.channels.length);
  });

  it('summarises groups with their cues and chases', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const group = show.groupPool.addRaw({ name: 'Movers', color: '#ff0000' });
    group.addFixture(fixture);
    const cue = group.addCue({
      type: 0, name: 'Blackout', duration: 2, relative: 0,
    });
    const chase = group.addChase({ name: 'Row 0', gridIndex: 0, duration: 4 });

    const state = resultOf(await dispatch(show, { id: 'q3', cmd: 'get_show_state', args: {} }));

    expect(state.groupCount).toBe(1);
    expect(state.groups[0]).toMatchObject({
      id: group.id,
      name: 'Movers',
      color: '#ff0000',
      fixtureIds: [fixture.id],
    });
    expect(state.groups[0].cues).toEqual([{
      id: cue.id, name: 'Blackout', type: 0, duration: 2, state: 0,
    }]);
    expect(state.groups[0].chases).toEqual([{
      id: chase.id, name: 'Row 0', gridIndex: 0, duration: 4, cueCount: 1,
    }]);
  });

  it('rejects unexpected arguments', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'q5', cmd: 'get_show_state', args: { verbose: true },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'get_show_state: Unknown argument "verbose". Accepted: (none)',
    });
  });
});

describe('get_fixture', () => {
  it('returns the full detail of a patched fixture', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    fixture.setChannel(0, 200);

    const detail = resultOf(await dispatch(show, {
      id: 'q6', cmd: 'get_fixture', args: { id: fixture.id },
    }));

    expect(detail).toMatchObject({
      id: fixture.id,
      name: 'Sharpy',
      manufacturer: 'clay-paky',
      model: 'sharpy',
      mode: 'Standard',
      universe: 0,
      chStart: 0,
      chStop: fixture.chStop,
      chCount: fixture.channels.length,
      position: { x: 0, y: 0, z: 10 },
      rotation: { x: 180, y: 0, z: 0 },
    });
    expect(detail.quickAccessors).toContain('Pan');
    expect(detail.quickAccessors).toContain('Tilt');
    expect(detail.channels).toHaveLength(fixture.channels.length);
    expect(detail.channels[0]).toEqual({
      index: 0,
      name: fixture.channels[0].name,
      type: fixture.channels[0].type,
      value: 200,
    });
  });

  it('sorts the quick accessor list so output is stable', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const detail = resultOf(await dispatch(show, {
      id: 'q7', cmd: 'get_fixture', args: { id: fixture.id },
    }));
    expect(detail.quickAccessors).toEqual([...detail.quickAccessors].sort());
  });

  it('returns COMMAND_ERROR for an unknown fixture id', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'q8', cmd: 'get_fixture', args: { id: 99 },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
    expect(envelope.error.message).toContain('get_fixture:');
  });

  it('requires the id argument', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'q9', cmd: 'get_fixture', args: {},
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'get_fixture: Missing required argument "id"',
    });
  });
});

describe('search_fixture_library', () => {
  it('matches on model name, case-insensitively', async () => {
    const found = resultOf(await dispatch(makeShowDouble(), {
      id: 'q10', cmd: 'search_fixture_library', args: { query: 'SHARPY' },
    }));

    expect(found).toEqual({
      total: 1,
      truncated: false,
      results: [{ manufacturer: 'clay-paky', model: 'sharpy', path: 'clay-paky/sharpy' }],
    });
  });

  it('matches on manufacturer name and strips the .json suffix', async () => {
    const found = resultOf(await dispatch(makeShowDouble(), {
      id: 'q11', cmd: 'search_fixture_library', args: { query: 'clay-paky' },
    }));
    expect(found.total).toBe(2);
    expect(found.results.map((item) => item.model)).toEqual(['sharpy', 'alpha-beam-700']);
  });

  it('truncates at the limit and flags it', async () => {
    const found = resultOf(await dispatch(makeShowDouble(), {
      id: 'q12', cmd: 'search_fixture_library', args: { query: 'a', limit: 1 },
    }));
    expect(found.results).toHaveLength(1);
    expect(found.truncated).toBe(true);
    expect(found.total).toBeGreaterThan(1);
  });

  it('returns an empty result set rather than an error', async () => {
    const found = resultOf(await dispatch(makeShowDouble(), {
      id: 'q13', cmd: 'search_fixture_library', args: { query: 'zzzznope' },
    }));
    expect(found).toEqual({ total: 0, truncated: false, results: [] });
  });

  it('errors when the fixture library has not been preloaded', async () => {
    const show = makeShowDouble({ rawOFLFixtures: [] });
    const envelope = await dispatch(show, {
      id: 'q14', cmd: 'search_fixture_library', args: { query: 'sharpy' },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.message).toContain('fixture library is empty');
  });

  it('rejects a limit above 100', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'q15', cmd: 'search_fixture_library', args: { query: 'a', limit: 500 },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'search_fixture_library: Argument "limit" must be <= 100',
    });
  });
});
```

- [ ] **Step 3: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp-bridge/query.commands.spec.js`
Expected: FAIL — `Failed to resolve import "@/mcp-bridge/commands/query.commands"`.

- [ ] **Step 4: Implement the query commands**

Create `src/mcp-bridge/commands/query.commands.js`:

```js
import { registerCommand } from './registry';

/**
 * Read-only state queries.
 *
 * Results are deliberately compact summaries -- ids, names and key values --
 * because the consumer is an LLM paying for every token. Per-channel detail
 * lives behind `get_fixture`, never in `get_show_state`.
 *
 * @module mcp-bridge/commands/query.commands
 */

/**
 * Compact per-fixture summary used by get_show_state.
 *
 * @param {Object} fixture fixture instance
 * @return {Object} summary
 * @private
 */
function summariseFixture(fixture) {
  return {
    id: fixture.id,
    name: fixture.name,
    manufacturer: fixture.manufacturer,
    model: fixture.model,
    mode: fixture.modeName,
    universe: fixture.universe,
    chStart: fixture.chStart,
    chCount: fixture.channels.length,
  };
}

/**
 * Compact per-group summary used by get_show_state.
 *
 * @param {Object} group group instance
 * @return {Object} summary
 * @private
 */
function summariseGroup(group) {
  return {
    id: group.id,
    name: group.name,
    color: group.color,
    fixtureIds: group.fixturePool.fixtures.map((fixture) => fixture.id),
    cues: group.cuePool.cues.map((cue) => ({
      id: cue.id,
      name: cue.name,
      type: cue.type,
      duration: cue.duration,
      state: cue.state,
    })),
    chases: group.chasePool.chases.map((chase) => ({
      id: chase.id,
      name: chase.name,
      gridIndex: chase.gridIndex,
      duration: chase.duration,
      cueCount: chase.cueItemPools.length,
    })),
  };
}

registerCommand('get_show_state', {
  description: 'Returns a compact summary of the whole show: name, BPM, save '
    + 'state, universes, patched fixtures and groups with their cues and chases.',
  args: {},
  handler: (show) => ({
    name: show.name,
    bpm: show.bpm,
    saved: Boolean(show.isSaved),
    fixtureCount: show.fixturePool.fixtures.length,
    groupCount: show.groupPool.groups.length,
    universes: show.universePool.universes.map((universe) => ({
      id: universe.id,
      name: universe.name,
      color: universe.color,
      fixtureCount: universe.fixturePool.fixtures.length,
      usedChannels: universe.fixturePool.fixtures.reduce(
        (total, fixture) => total + fixture.channels.length,
        0,
      ),
    })),
    fixtures: show.fixturePool.fixtures.map(summariseFixture),
    groups: show.groupPool.groups.map(summariseGroup),
  }),
});

registerCommand('get_fixture', {
  description: 'Returns full detail for one patched fixture: addressing, 3D '
    + 'position and rotation, available quick accessors and every channel value.',
  args: {
    id: {
      type: 'number', required: true, integer: true, min: 0,
    },
  },
  handler: (show, args) => {
    const fixture = show.fixturePool.getFromId(args.id);
    return {
      id: fixture.id,
      name: fixture.name,
      manufacturer: fixture.manufacturer,
      model: fixture.model,
      mode: fixture.modeName,
      category: fixture.category,
      universe: fixture.universe,
      chStart: fixture.chStart,
      chStop: fixture.chStop,
      chCount: fixture.channels.length,
      position: {
        x: fixture.position.x,
        y: fixture.position.y,
        z: fixture.position.z,
      },
      rotation: {
        x: fixture.rotation.x,
        y: fixture.rotation.y,
        z: fixture.rotation.z,
      },
      quickAccessors: Object.keys(fixture.quickChannelsAccessors).sort(),
      channels: fixture.channels.map((channel, index) => ({
        index,
        name: channel.name,
        type: channel.type,
        value: channel.value.DMX,
      })),
    };
  },
});

registerCommand('search_fixture_library', {
  description: 'Searches the bundled Open Fixture Library index by '
    + 'manufacturer or model substring. Returns manufacturer/model pairs ready '
    + 'to hand to patch_fixture.',
  args: {
    query: { type: 'string', required: true },
    limit: {
      type: 'number', integer: true, min: 1, max: 100, default: 20,
    },
  },
  handler: (show, args) => {
    const library = show.rawOFLFixtures || [];
    if (!library.length) {
      throw new Error('The OFL fixture library is empty -- the app has not '
        + 'finished preloading fixture_list.json yet.');
    }
    const needle = args.query.toLowerCase();
    const matches = [];
    library.forEach((entry) => {
      const manufacturer = entry.name;
      const manufacturerHit = manufacturer.toLowerCase().includes(needle);
      (entry.fixtures || []).forEach((file) => {
        const model = String(file).replace(/\.json$/i, '');
        if (manufacturerHit || model.toLowerCase().includes(needle)) {
          matches.push({ manufacturer, model, path: `${manufacturer}/${model}` });
        }
      });
    });
    return {
      total: matches.length,
      truncated: matches.length > args.limit,
      results: matches.slice(0, args.limit),
    };
  },
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- test/mcp-bridge/query.commands.spec.js`
Expected: PASS — 14 tests.

Note: `summariseGroup` reads `chase.cueItemPools` for `cueCount`. `Chase` stores one `CueItemPool` per cue; if the property is named differently in `src/models/DMX/chase.model.js`, read that file and use the real name. The assertion `cueCount: 1` pins the behaviour — a chase created without an explicit `cues` array inherits the group's whole cue pool, which holds exactly one cue at that point in the test.

- [ ] **Step 6: Run the full suite and lint**

Run: `npm run test:run && npm run lint:ci`
Expected: every suite green, including the original 156 Phase 0 tests; ESLint 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/mcp-bridge/commands/query.commands.js test/mcp-bridge/query.commands.spec.js test/helpers/show-double.js
git commit -m "feat(mcp): add get_show_state, get_fixture and search_fixture_library

Token-compact state queries over the \$show facade, plus the shared show
double the remaining command tests build on.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Patch commands (the composite two-step)

**Files:**
- Create: `src/mcp-bridge/ofl.js`
- Create: `src/mcp-bridge/commands/patch.commands.js`
- Test: `test/mcp-bridge/ofl.spec.js`
- Test: `test/mcp-bridge/patch.commands.spec.js`

**Interfaces:**
- Consumes: `registerCommand` from `./registry`; `ValidationError`, `assertVec3` from `./validate`; `makeShowDouble`, `patchSharpy`, `SHARPY` from `test/helpers/show-double`.
- Produces `src/mcp-bridge/ofl.js`:
  - `fetchOFL(manufacturer: string, model: string) -> Promise<object>` — axios GET `${import.meta.env.VITE_STATIC_URL}fixtures/<manufacturer>/<model>.json`, memoised per `manufacturer/model`.
  - `clearOFLCache() -> void`
- Produces three registered commands:
  - `patch_fixture` — args `{ manufacturer: string (req), model: string (req), mode?: string, name?: string, universe?: number (int, >=0, default 0), ch_start?: number (int, 0..511), position?: object, rotation?: object }` → `{ id, name, manufacturer, model, mode, universe, chStart, chCount, autoAddressed }`
  - `unpatch_fixture` — args `{ id: number (int, >=0, req) }` → `{ id, universe, chStart, unpatched: true }`
  - `move_fixture` — args `{ id: number (int, >=0, req), position?: object, rotation?: object }` → `{ id, position: {x,y,z}, rotation: {x,y,z} }`

**WHY THIS TASK EXISTS (read before writing code):** `fixturePool.addRaw(fixtureData)` constructs a `Fixture`, whose constructor parses the OFL definition **synchronously** (`fixture.model.js:174 parseFromOFLData`). A fixture added without `fixtureData.OFLData` already attached is permanently broken. The registry therefore owns the two-step — fetch OFL JSON → attach as `OFLData` → `addRaw` → `universe.patchFixture(fixture)` — so no caller can get the order wrong.

- [ ] **Step 1: Write the failing OFL-helper test**

Create `test/mcp-bridge/ofl.spec.js`:

```js
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

// eslint-disable-next-line import/first
import axios from 'axios';
// eslint-disable-next-line import/first
import { fetchOFL, clearOFLCache } from '@/mcp-bridge/ofl';

beforeEach(() => {
  clearOFLCache();
  axios.get.mockReset();
});

describe('fetchOFL', () => {
  it('fetches the per-fixture OFL JSON from the static fixtures path', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Sharpy', modes: [] } });

    const data = await fetchOFL('clay-paky', 'sharpy');

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toMatch(/fixtures\/clay-paky\/sharpy\.json$/);
    expect(data).toEqual({ name: 'Sharpy', modes: [] });
  });

  it('tolerates a model name that already carries the .json suffix', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Sharpy' } });
    await fetchOFL('clay-paky', 'sharpy.json');
    expect(axios.get.mock.calls[0][0]).toMatch(/fixtures\/clay-paky\/sharpy\.json$/);
  });

  it('memoises per manufacturer/model so a second patch costs no request', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Sharpy' } });

    await fetchOFL('clay-paky', 'sharpy');
    await fetchOFL('clay-paky', 'sharpy');

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('hands out an independent deep copy each call', async () => {
    axios.get.mockResolvedValue({ data: { modes: [{ name: 'Standard', channels: ['Dimmer'] }] } });

    const first = await fetchOFL('clay-paky', 'sharpy');
    first.modes[0].channels.push('MUTATED');
    const second = await fetchOFL('clay-paky', 'sharpy');

    expect(second.modes[0].channels).toEqual(['Dimmer']);
  });

  it('does not cache a failed fetch', async () => {
    axios.get.mockRejectedValueOnce(new Error('404'));
    await expect(fetchOFL('nope', 'nope')).rejects.toThrow(
      'Could not load OFL definition for nope/nope: 404',
    );

    axios.get.mockResolvedValue({ data: { name: 'Later' } });
    await expect(fetchOFL('nope', 'nope')).resolves.toEqual({ name: 'Later' });
  });

  it('rejects a response with no usable payload', async () => {
    axios.get.mockResolvedValue({ data: null });
    await expect(fetchOFL('clay-paky', 'sharpy')).rejects.toThrow(
      'Could not load OFL definition for clay-paky/sharpy: empty response',
    );
  });

  it('clearOFLCache forces a refetch', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Sharpy' } });
    await fetchOFL('clay-paky', 'sharpy');
    clearOFLCache();
    await fetchOFL('clay-paky', 'sharpy');
    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp-bridge/ofl.spec.js`
Expected: FAIL — `Failed to resolve import "@/mcp-bridge/ofl"`.

- [ ] **Step 3: Implement the OFL helper**

Create `src/mcp-bridge/ofl.js`:

```js
import axios from 'axios';

/**
 * Open Fixture Library loader for the MCP bridge.
 *
 * Mirrors the fetch path and cache strategy of `Show.prepareFixtures` so a
 * bridge-patched fixture is indistinguishable from a showfile-loaded one.
 *
 * @module mcp-bridge/ofl
 */

/**
 * Serialised OFL payloads keyed by `manufacturer/model`.
 *
 * Stored as JSON strings, exactly like `show.model.js`'s `fixtureDataCache`:
 * `Fixture.prepareChannels` mutates the definition it is handed, so every
 * caller must receive its own copy.
 *
 * @constant {Object<String, String>}
 * @private
 */
const oflCache = {};

/**
 * Normalises a model name to its bare form, without the `.json` suffix.
 *
 * @param {String} model model name as supplied by the caller
 * @return {String} bare model name
 * @private
 */
function bareModel(model) {
  return String(model).replace(/\.json$/i, '');
}

/**
 * Loads an OFL fixture definition, memoised per manufacturer/model.
 *
 * @param {String} manufacturer manufacturer folder name, eg. `clay-paky`
 * @param {String} model fixture file name, with or without `.json`
 * @return {Promise<Object>} a fresh deep copy of the OFL definition
 * @throws {Error} when the definition cannot be loaded
 * @async
 * @public
 */
export async function fetchOFL(manufacturer, model) {
  const key = `${manufacturer}/${bareModel(model)}`;
  if (oflCache[key]) {
    return JSON.parse(oflCache[key]);
  }
  let payload;
  try {
    const base = import.meta.env.VITE_STATIC_URL || '';
    const res = await axios.get(`${base}fixtures/${key}.json`);
    payload = res ? res.data : null;
  } catch (err) {
    throw new Error(`Could not load OFL definition for ${key}: ${err.message}`);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Could not load OFL definition for ${key}: empty response`);
  }
  oflCache[key] = JSON.stringify(payload);
  return JSON.parse(oflCache[key]);
}

/**
 * Empties the OFL cache. Used by tests and by `new_show`.
 *
 * @public
 */
export function clearOFLCache() {
  Object.keys(oflCache).forEach((key) => {
    delete oflCache[key];
  });
}
```

- [ ] **Step 4: Run the OFL test**

Run: `npm run test:run -- test/mcp-bridge/ofl.spec.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Write the failing patch-command test**

Create `test/mcp-bridge/patch.commands.spec.js`:

```js
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

// eslint-disable-next-line import/first
import axios from 'axios';
// eslint-disable-next-line import/first
import { dispatch } from '@/mcp-bridge/commands/registry';
// eslint-disable-next-line import/first
import { clearOFLCache } from '@/mcp-bridge/ofl';
// eslint-disable-next-line import/first, import/no-unresolved
import '@/mcp-bridge/commands/patch.commands';
// eslint-disable-next-line import/first
import MovingHead from '../stubs/moving_head.stub';
// eslint-disable-next-line import/first
import Controls from '../stubs/controls.stub';
// eslint-disable-next-line import/first
import { makeShowDouble, patchSharpy, SHARPY } from '../helpers/show-double';

/**
 * Unwraps a success envelope, failing loudly on an error envelope.
 *
 * @param {Object} envelope response envelope from dispatch
 * @return {*} the result payload
 */
function resultOf(envelope) {
  if (!envelope.ok) {
    throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
  }
  return envelope.result;
}

/**
 * Channel footprint of the Sharpy's Standard mode, read from the real OFL file.
 *
 * @constant {Number}
 */
const STANDARD_MODE_CHANNELS = SHARPY.modes
  .find((mode) => mode.name === 'Standard').channels.length;

beforeEach(() => {
  MovingHead.reset();
  Controls.reset();
  clearOFLCache();
  axios.get.mockReset();
  axios.get.mockResolvedValue({ data: JSON.parse(JSON.stringify(SHARPY)) });
});

describe('patch_fixture', () => {
  it('fetches OFL data, builds the fixture and patches it into the universe', async () => {
    const show = makeShowDouble();

    const patched = resultOf(await dispatch(show, {
      id: 'p1',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', mode: 'Standard' },
    }));

    expect(patched).toEqual({
      id: 0,
      name: 'Sharpy',
      manufacturer: 'clay-paky',
      model: 'sharpy',
      mode: 'Standard',
      universe: 0,
      chStart: 0,
      chCount: STANDARD_MODE_CHANNELS,
      autoAddressed: true,
    });
    expect(show.fixturePool.fixtures).toHaveLength(1);
    expect(show.universePool.getFromId(0).fixturePool.fixtures).toHaveLength(1);
  });

  it('attaches OFLData BEFORE addRaw, so the fixture parses its channels', async () => {
    const show = makeShowDouble();
    await dispatch(show, {
      id: 'p2',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy' },
    });

    const fixture = show.fixturePool.fixtures[0];
    expect(fixture.OFLData).toBeTruthy();
    expect(fixture.channels.length).toBe(STANDARD_MODE_CHANNELS);
    expect(Object.keys(fixture.quickChannelsAccessors)).toContain('Pan');
  });

  it('defaults to the first OFL mode when mode is omitted', async () => {
    const show = makeShowDouble();
    const patched = resultOf(await dispatch(show, {
      id: 'p3',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy' },
    }));
    expect(patched.mode).toBe(SHARPY.modes[0].name);
  });

  it('auto-addresses the next free slot for a second fixture', async () => {
    const show = makeShowDouble();
    await dispatch(show, {
      id: 'p4a', cmd: 'patch_fixture', args: { manufacturer: 'clay-paky', model: 'sharpy' },
    });
    const second = resultOf(await dispatch(show, {
      id: 'p4b', cmd: 'patch_fixture', args: { manufacturer: 'clay-paky', model: 'sharpy' },
    }));

    expect(second.chStart).toBe(STANDARD_MODE_CHANNELS);
    expect(second.autoAddressed).toBe(true);
  });

  it('honours an explicit ch_start and reports autoAddressed false', async () => {
    const show = makeShowDouble();
    const patched = resultOf(await dispatch(show, {
      id: 'p5',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', ch_start: 100 },
    }));
    expect(patched.chStart).toBe(100);
    expect(patched.autoAddressed).toBe(false);
  });

  it('applies name, position and rotation', async () => {
    const show = makeShowDouble();
    resultOf(await dispatch(show, {
      id: 'p6',
      cmd: 'patch_fixture',
      args: {
        manufacturer: 'clay-paky',
        model: 'sharpy',
        name: 'Stage Left Mover',
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 10, y: 20, z: 30 },
      },
    }));

    const fixture = show.fixturePool.fixtures[0];
    expect(fixture.name).toBe('Stage Left Mover');
    expect(fixture.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(fixture.rotation).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('reuses the OFL cache across two patches of the same model', async () => {
    const show = makeShowDouble();
    await dispatch(show, {
      id: 'p7a', cmd: 'patch_fixture', args: { manufacturer: 'clay-paky', model: 'sharpy' },
    });
    await dispatch(show, {
      id: 'p7b', cmd: 'patch_fixture', args: { manufacturer: 'clay-paky', model: 'sharpy' },
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown mode, naming the available ones', async () => {
    const show = makeShowDouble();
    const envelope = await dispatch(show, {
      id: 'p8',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', mode: 'Turbo' },
    });

    expect(envelope.error.code).toBe('VALIDATION');
    expect(envelope.error.message).toContain('Argument "mode" must be one of:');
    expect(envelope.error.message).toContain(SHARPY.modes[0].name);
    expect(show.fixturePool.fixtures).toHaveLength(0);
  });

  it('reports a COMMAND_ERROR for an unknown universe and patches nothing', async () => {
    const show = makeShowDouble();
    const envelope = await dispatch(show, {
      id: 'p9',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', universe: 7 },
    });

    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
    expect(show.fixturePool.fixtures).toHaveLength(0);
  });

  it('surfaces an OFL fetch failure as a COMMAND_ERROR', async () => {
    axios.get.mockRejectedValue(new Error('Request failed with status code 404'));
    const show = makeShowDouble();
    const envelope = await dispatch(show, {
      id: 'p10', cmd: 'patch_fixture', args: { manufacturer: 'nope', model: 'nope' },
    });

    expect(envelope.error.code).toBe('COMMAND_ERROR');
    expect(envelope.error.message).toContain('Could not load OFL definition for nope/nope');
    expect(show.fixturePool.fixtures).toHaveLength(0);
  });

  it('errors when the universe has no contiguous space left', async () => {
    const show = makeShowDouble();
    const envelope = await dispatch(show, {
      id: 'p11',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', ch_start: 511 },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
  });

  it('rolls the fixture back out of the pool when patching throws', async () => {
    const show = makeShowDouble();
    const universe = show.universePool.getFromId(0);
    vi.spyOn(universe, 'patchFixture').mockImplementation(() => {
      throw new Error('Cannot patch fixture on this interval');
    });

    const envelope = await dispatch(show, {
      id: 'p12', cmd: 'patch_fixture', args: { manufacturer: 'clay-paky', model: 'sharpy' },
    });

    expect(envelope.error.message).toContain('Cannot patch fixture on this interval');
    expect(show.fixturePool.fixtures).toHaveLength(0);
  });

  it('requires manufacturer and model', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'p13', cmd: 'patch_fixture', args: { model: 'sharpy' },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'patch_fixture: Missing required argument "manufacturer"',
    });
  });

  it('validates the position vector', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'p14',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', position: { x: 0, y: 0 } },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'patch_fixture: Argument "position.z" must be a number',
    });
  });
});

describe('unpatch_fixture', () => {
  it('removes the fixture from both the universe and the show pool', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);

    const removed = resultOf(await dispatch(show, {
      id: 'u1', cmd: 'unpatch_fixture', args: { id: fixture.id },
    }));

    expect(removed).toEqual({
      id: fixture.id, universe: 0, chStart: 0, unpatched: true,
    });
    expect(show.fixturePool.fixtures).toHaveLength(0);
    expect(show.universePool.getFromId(0).fixturePool.fixtures).toHaveLength(0);
  });

  it('frees the address range for a later patch', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    await dispatch(show, { id: 'u2', cmd: 'unpatch_fixture', args: { id: fixture.id } });

    expect(show.universePool.getFromId(0).findChStartAutoPatch(1, 1)).toBe(0);
  });

  it('errors on an unknown fixture id', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'u3', cmd: 'unpatch_fixture', args: { id: 42 },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
  });
});

describe('move_fixture', () => {
  it('sets position through the per-axis setters so the 3D model follows', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);

    const moved = resultOf(await dispatch(show, {
      id: 'm1',
      cmd: 'move_fixture',
      args: { id: fixture.id, position: { x: 4, y: -2, z: 6 } },
    }));

    expect(moved.position).toEqual({ x: 4, y: -2, z: 6 });
    expect(fixture.posX).toBe(4);
    expect(fixture.posY).toBe(-2);
    expect(fixture.posZ).toBe(6);
  });

  it('sets rotation independently of position', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);

    const moved = resultOf(await dispatch(show, {
      id: 'm2',
      cmd: 'move_fixture',
      args: { id: fixture.id, rotation: { x: 90, y: 45, z: 0 } },
    }));

    expect(moved.rotation).toEqual({ x: 90, y: 45, z: 0 });
    expect(moved.position).toEqual({ x: 0, y: 0, z: 10 });
    expect(fixture.rotX).toBe(90);
  });

  it('requires at least one of position or rotation', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const envelope = await dispatch(show, {
      id: 'm3', cmd: 'move_fixture', args: { id: fixture.id },
    });

    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'move_fixture: Provide at least one of "position" or "rotation"',
    });
  });

  it('validates the rotation vector', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const envelope = await dispatch(show, {
      id: 'm4',
      cmd: 'move_fixture',
      args: { id: fixture.id, rotation: { x: 0, y: 0, z: 'spin' } },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'move_fixture: Argument "rotation.z" must be a number',
    });
  });
});
```

- [ ] **Step 6: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp-bridge/patch.commands.spec.js`
Expected: FAIL — `Failed to resolve import "@/mcp-bridge/commands/patch.commands"`.

- [ ] **Step 7: Implement the patch commands**

Create `src/mcp-bridge/commands/patch.commands.js`:

```js
import { registerCommand } from './registry';
import { ValidationError, assertVec3 } from './validate';
import { fetchOFL } from '../ofl';

/**
 * Fixture patching, unpatching and 3D placement.
 *
 * `patch_fixture` is a deliberate composite: the `Fixture` constructor parses
 * its OFL definition synchronously, so the definition MUST be attached as
 * `fixtureData.OFLData` before `fixturePool.addRaw`. Patching into the universe
 * is a second, separate step. Owning both here is what stops a caller from
 * producing a silently broken fixture.
 *
 * @module mcp-bridge/commands/patch.commands
 */

/**
 * Picks the requested OFL mode, or the first one when none was asked for.
 *
 * @param {Object} oflData parsed OFL definition
 * @param {String} [requested] mode name from the caller
 * @return {Object} the selected OFL mode
 * @throws {Error} when the definition declares no modes
 * @throws {ValidationError} when the requested mode does not exist
 * @private
 */
function selectMode(oflData, requested) {
  const modes = Array.isArray(oflData.modes) ? oflData.modes : [];
  if (!modes.length) {
    throw new Error('This OFL definition declares no modes and cannot be patched.');
  }
  if (requested === undefined) {
    return modes[0];
  }
  const mode = modes.find((candidate) => candidate.name === requested);
  if (!mode) {
    const names = modes.map((candidate) => candidate.name).join(', ');
    throw new ValidationError(`Argument "mode" must be one of: ${names}`);
  }
  return mode;
}

registerCommand('patch_fixture', {
  description: 'Patches a fixture from the Open Fixture Library into a '
    + 'universe. Fetches the OFL definition, builds the fixture and addresses '
    + 'it automatically unless ch_start is given.',
  args: {
    manufacturer: { type: 'string', required: true },
    model: { type: 'string', required: true },
    mode: { type: 'string' },
    name: { type: 'string' },
    universe: {
      type: 'number', integer: true, min: 0, default: 0,
    },
    ch_start: {
      type: 'number', integer: true, min: 0, max: 511,
    },
    position: { type: 'object' },
    rotation: { type: 'object' },
  },
  handler: async (show, args) => {
    const position = args.position ? assertVec3('position', args.position) : undefined;
    const rotation = args.rotation ? assertVec3('rotation', args.rotation) : undefined;

    const universe = show.universePool.getFromId(args.universe);
    const oflData = await fetchOFL(args.manufacturer, args.model);
    const mode = selectMode(oflData, args.mode);
    const chCount = mode.channels.length;

    const autoAddressed = args.ch_start === undefined;
    const chStart = autoAddressed
      ? universe.findChStartAutoPatch(chCount, 1)
      : args.ch_start;
    if (chStart < 0) {
      throw new Error(`Universe ${args.universe} has no free block of ${chCount} channels.`);
    }
    if (chStart + chCount > 512) {
      throw new Error(
        `A ${chCount}-channel fixture does not fit at address ${chStart} (universe is 512 wide).`,
      );
    }

    // OFLData MUST be attached before addRaw -- the Fixture constructor parses
    // it synchronously (see fixture.model.js:174).
    const fixtureData = {
      OFLData: oflData,
      universe: args.universe,
      manufacturer: args.manufacturer,
      model: args.model,
      mode: mode.name,
      name: args.name,
      category: Array.isArray(oflData.categories) ? oflData.categories[0] : undefined,
      chStart,
      position,
      rotation,
    };

    const fixture = show.fixturePool.addRaw(fixtureData);
    try {
      universe.patchFixture(fixture);
    } catch (err) {
      show.fixturePool.delete(fixture, true);
      throw err;
    }

    return {
      id: fixture.id,
      name: fixture.name,
      manufacturer: fixture.manufacturer,
      model: fixture.model,
      mode: fixture.modeName,
      universe: fixture.universe,
      chStart: fixture.chStart,
      chCount: fixture.channels.length,
      autoAddressed,
    };
  },
});

registerCommand('unpatch_fixture', {
  description: 'Removes a fixture from its universe and from the show, freeing '
    + 'its DMX address range.',
  args: {
    id: {
      type: 'number', required: true, integer: true, min: 0,
    },
  },
  handler: (show, args) => {
    const fixture = show.fixturePool.getFromId(args.id);
    const summary = {
      id: fixture.id,
      universe: fixture.universe,
      chStart: fixture.chStart,
      unpatched: true,
    };
    show.universePool.getFromId(fixture.universe).unpatchFixture(fixture);
    show.fixturePool.delete(fixture, true);
    return summary;
  },
});

registerCommand('move_fixture', {
  description: 'Sets a patched fixture 3D position (metres) and/or rotation '
    + '(degrees) in the visualizer. At least one of the two is required.',
  args: {
    id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    position: { type: 'object' },
    rotation: { type: 'object' },
  },
  handler: (show, args) => {
    if (args.position === undefined && args.rotation === undefined) {
      throw new ValidationError('Provide at least one of "position" or "rotation"');
    }
    const position = args.position ? assertVec3('position', args.position) : null;
    const rotation = args.rotation ? assertVec3('rotation', args.rotation) : null;
    const fixture = show.fixturePool.getFromId(args.id);

    if (position) {
      fixture.posX = position.x;
      fixture.posY = position.y;
      fixture.posZ = position.z;
    }
    if (rotation) {
      fixture.rotX = rotation.x;
      fixture.rotY = rotation.y;
      fixture.rotZ = rotation.z;
    }

    return {
      id: fixture.id,
      position: {
        x: fixture.position.x,
        y: fixture.position.y,
        z: fixture.position.z,
      },
      rotation: {
        x: fixture.rotation.x,
        y: fixture.rotation.y,
        z: fixture.rotation.z,
      },
    };
  },
});
```

- [ ] **Step 8: Run the patch test to verify it passes**

Run: `npm run test:run -- test/mcp-bridge/patch.commands.spec.js`
Expected: PASS — 21 tests.

- [ ] **Step 9: Run the full suite and lint**

Run: `npm run test:run && npm run lint:ci`
Expected: all tests pass; ESLint 0 errors.

- [ ] **Step 10: Commit**

```bash
git add src/mcp-bridge/ofl.js src/mcp-bridge/commands/patch.commands.js test/mcp-bridge/ofl.spec.js test/mcp-bridge/patch.commands.spec.js
git commit -m "feat(mcp): add patch_fixture, unpatch_fixture and move_fixture

patch_fixture owns the OFL-fetch/addRaw/patchFixture two-step and rolls
the fixture back out of the pool if patching fails, so a bad request can
never leave a half-built fixture behind.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Control commands

**Files:**
- Create: `src/mcp-bridge/commands/control.commands.js`
- Test: `test/mcp-bridge/control.commands.spec.js`

**Interfaces:**
- Consumes: `registerCommand` from `./registry`; `ValidationError` from `./validate`; `makeShowDouble`, `patchSharpy` from `test/helpers/show-double`.
- Produces eleven registered commands:
  - `set_channels` — args `{ fixture_ids: array<number> (req, minLength 1), channels?: array<object>, accessors?: array<object> }` → `{ updated: [{ id, channels: number[], accessors: string[], skipped: string[] }] }`. `channels` entries are `{ index: int, value: 0..255 }` where `index` is the **fixture-relative** 0-based channel index (the argument `Fixture.setChannel` takes). `accessors` entries are `{ type: string, value: 0..255, index?: int }` where `type` is a quick-accessor name (`Dimmer`, `Pan`, `Tilt`, `Zoom`, `Color`, …) and `index` selects the nth accessor of that type.
  - `create_group` — args `{ name: string (req), color?: string }` → `{ id, name, color }`
  - `add_fixtures_to_group` — args `{ group_id: int (req), fixture_ids: array<number> (req, minLength 1) }` → `{ groupId, fixtureIds, fixtureCount }`
  - `create_scene` — args `{ group_id: int (req), name?: string, color?: string, duration?: number (default 1, min 0), trigger_style?: int 0..1 (default 0), loop_style?: int 0..1 (default 0), relative?: int 0..1 (default 0) }` → `{ id, groupId, type: 0, name, duration }`
  - `create_effect` — identical args → `{ id, groupId, type: 1, name, duration }`
  - `create_chase` — args `{ group_id: int (req), name?: string, grid_index?: int (min 0), color?: string, duration?: number (default 1, min 0), trigger?: int 0..1 (default 0), cue_ids?: array<number> }` → `{ id, groupId, name, gridIndex, duration, cueCount }`
  - `play_cue` — args `{ group_id: int (req), cue_id: int (req), state?: boolean (default true) }` → `{ groupId, cueId, state, cueState }`
  - `play_chase` — args `{ group_id: int (req), chase_id: int (req), state?: boolean (default true) }` → `{ groupId, chaseId, state }`
  - `stop_all` — args `{}` → `{ groups, cuesStopped }`
  - `master_row` — args `{ row: int (req, min 0) }` → `{ row, playingRow }`
  - `set_bpm` — args `{ bpm: number (req, 20..400) }` → `{ bpm }`

- [ ] **Step 1: Write the failing test**

Create `test/mcp-bridge/control.commands.spec.js`:

```js
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { dispatch } from '@/mcp-bridge/commands/registry';
import '@/mcp-bridge/commands/control.commands';
import MovingHead from '../stubs/moving_head.stub';
import Controls from '../stubs/controls.stub';
import { makeShowDouble, patchSharpy } from '../helpers/show-double';

/**
 * Unwraps a success envelope, failing loudly on an error envelope.
 *
 * @param {Object} envelope response envelope from dispatch
 * @return {*} the result payload
 */
function resultOf(envelope) {
  if (!envelope.ok) {
    throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
  }
  return envelope.result;
}

/**
 * Builds a show with one patched Sharpy already in one group.
 *
 * @return {Object} `{ show, fixture, group }`
 */
function showWithGroup() {
  const show = makeShowDouble();
  const fixture = patchSharpy(show);
  const group = show.groupPool.addRaw({ name: 'Movers', color: '#00ff00' });
  group.addFixture(fixture);
  return { show, fixture, group };
}

beforeEach(() => {
  MovingHead.reset();
  Controls.reset();
});

describe('set_channels -- raw channel indices', () => {
  it('sets a raw channel on one fixture', async () => {
    const { show, fixture } = showWithGroup();

    const applied = resultOf(await dispatch(show, {
      id: 'c1',
      cmd: 'set_channels',
      args: { fixture_ids: [fixture.id], channels: [{ index: 0, value: 255 }] },
    }));

    expect(applied).toEqual({
      updated: [{
        id: fixture.id, channels: [0], accessors: [], skipped: [],
      }],
    });
    expect(fixture.channels[0].value.DMX).toBe(255);
  });

  it('applies the same channel set to several fixtures', async () => {
    const show = makeShowDouble();
    const first = patchSharpy(show);
    const second = patchSharpy(show, { chStart: 100 });

    const applied = resultOf(await dispatch(show, {
      id: 'c2',
      cmd: 'set_channels',
      args: { fixture_ids: [first.id, second.id], channels: [{ index: 0, value: 128 }] },
    }));

    expect(applied.updated.map((entry) => entry.id)).toEqual([first.id, second.id]);
    expect(first.channels[0].value.DMX).toBe(128);
    expect(second.channels[0].value.DMX).toBe(128);
  });

  it('rejects a channel index the fixture does not have, mutating nothing', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c3',
      cmd: 'set_channels',
      args: {
        fixture_ids: [fixture.id],
        channels: [{ index: 0, value: 255 }, { index: 999, value: 255 }],
      },
    });

    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
    expect(envelope.error.message).toContain('has no channel at index 999');
    expect(fixture.channels[0].value.DMX).toBe(0);
  });

  it('rejects an out-of-range DMX value', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c4',
      cmd: 'set_channels',
      args: { fixture_ids: [fixture.id], channels: [{ index: 0, value: 300 }] },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'set_channels: Argument "channels[0].value" must be between 0 and 255',
    });
  });

  it('rejects a non-integer channel index', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c5',
      cmd: 'set_channels',
      args: { fixture_ids: [fixture.id], channels: [{ index: 1.5, value: 10 }] },
    });
    expect(envelope.error.message)
      .toBe('set_channels: Argument "channels[0].index" must be a non-negative integer');
  });

  it('requires at least one of channels or accessors', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c6', cmd: 'set_channels', args: { fixture_ids: [fixture.id] },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'set_channels: Provide at least one of "channels" or "accessors"',
    });
  });

  it('rejects an empty fixture_ids list', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'c7',
      cmd: 'set_channels',
      args: { fixture_ids: [], channels: [{ index: 0, value: 1 }] },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'set_channels: Argument "fixture_ids" must contain at least 1 item(s)',
    });
  });

  it('fails before mutating anything when one fixture id is unknown', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c8',
      cmd: 'set_channels',
      args: { fixture_ids: [fixture.id, 404], channels: [{ index: 0, value: 255 }] },
    });
    expect(envelope.ok).toBe(false);
    expect(fixture.channels[0].value.DMX).toBe(0);
  });
});

describe('set_channels -- quick accessors', () => {
  it('sets Pan and Tilt by name', async () => {
    const { show, fixture } = showWithGroup();

    const applied = resultOf(await dispatch(show, {
      id: 'c9',
      cmd: 'set_channels',
      args: {
        fixture_ids: [fixture.id],
        accessors: [{ type: 'Pan', value: 200 }, { type: 'Tilt', value: 100 }],
      },
    }));

    expect(applied.updated[0].accessors).toEqual(['Pan', 'Tilt']);
    expect(applied.updated[0].skipped).toEqual([]);
    expect(fixture.getQuickAccessor({ type: 'Pan' }).value.DMX).toBe(200);
    expect(fixture.getQuickAccessor({ type: 'Tilt' }).value.DMX).toBe(100);
  });

  it('reports an accessor the fixture lacks as skipped, not as an error', async () => {
    const { show, fixture } = showWithGroup();

    const applied = resultOf(await dispatch(show, {
      id: 'c10',
      cmd: 'set_channels',
      args: {
        fixture_ids: [fixture.id],
        accessors: [{ type: 'Pan', value: 10 }, { type: 'NoSuchAccessor', value: 10 }],
      },
    }));

    expect(applied.updated[0].accessors).toEqual(['Pan']);
    expect(applied.updated[0].skipped).toEqual(['NoSuchAccessor']);
  });

  it('rejects an accessor entry with no type', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c11',
      cmd: 'set_channels',
      args: { fixture_ids: [fixture.id], accessors: [{ value: 10 }] },
    });
    expect(envelope.error.message)
      .toBe('set_channels: Argument "accessors[0].type" must be a non-empty string');
  });

  it('combines raw channels and accessors in one call', async () => {
    const { show, fixture } = showWithGroup();
    const applied = resultOf(await dispatch(show, {
      id: 'c12',
      cmd: 'set_channels',
      args: {
        fixture_ids: [fixture.id],
        channels: [{ index: 0, value: 64 }],
        accessors: [{ type: 'Pan', value: 32 }],
      },
    }));
    expect(applied.updated[0]).toEqual({
      id: fixture.id, channels: [0], accessors: ['Pan'], skipped: [],
    });
  });
});

describe('create_group and add_fixtures_to_group', () => {
  it('creates a group with the given name and colour', async () => {
    const show = makeShowDouble();
    const created = resultOf(await dispatch(show, {
      id: 'g1', cmd: 'create_group', args: { name: 'Back Truss', color: '#123456' },
    }));

    expect(created).toEqual({ id: 0, name: 'Back Truss', color: '#123456' });
    expect(show.groupPool.groups).toHaveLength(1);
  });

  it('falls back to the pool colour palette when no colour is given', async () => {
    const show = makeShowDouble();
    const created = resultOf(await dispatch(show, {
      id: 'g2', cmd: 'create_group', args: { name: 'Front' },
    }));
    expect(created.color).toMatch(/^#/);
  });

  it('requires a name', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'g3', cmd: 'create_group', args: {},
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'create_group: Missing required argument "name"',
    });
  });

  it('adds fixtures to an existing group', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const group = show.groupPool.addRaw({ name: 'Movers' });

    const added = resultOf(await dispatch(show, {
      id: 'g4',
      cmd: 'add_fixtures_to_group',
      args: { group_id: group.id, fixture_ids: [fixture.id] },
    }));

    expect(added).toEqual({ groupId: group.id, fixtureIds: [fixture.id], fixtureCount: 1 });
    expect(group.fixturePool.fixtures).toHaveLength(1);
  });

  it('errors on an unknown group id without adding anything', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const envelope = await dispatch(show, {
      id: 'g5',
      cmd: 'add_fixtures_to_group',
      args: { group_id: 9, fixture_ids: [fixture.id] },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
  });
});

describe('create_scene and create_effect', () => {
  it('creates a scene cue of type 0 on the group', async () => {
    const { show, group } = showWithGroup();

    const created = resultOf(await dispatch(show, {
      id: 's1',
      cmd: 'create_scene',
      args: { group_id: group.id, name: 'Warm Wash', duration: 4 },
    }));

    expect(created).toEqual({
      id: 0, groupId: group.id, type: 0, name: 'Warm Wash', duration: 4,
    });
    expect(group.cuePool.cues[0].type).toBe(0);
  });

  it('injects the group fixtures into the new cue', async () => {
    const { show, group, fixture } = showWithGroup();
    await dispatch(show, {
      id: 's2', cmd: 'create_scene', args: { group_id: group.id, name: 'Wash' },
    });
    const cue = group.cuePool.cues[0];
    expect(cue.fixtureValues.map((value) => value.fixture.id)).toEqual([fixture.id]);
  });

  it('creates an effect cue of type 1', async () => {
    const { show, group } = showWithGroup();
    const created = resultOf(await dispatch(show, {
      id: 's3', cmd: 'create_effect', args: { group_id: group.id, name: 'Sine Pan' },
    }));
    expect(created.type).toBe(1);
    expect(group.cuePool.cues[0].type).toBe(1);
  });

  it('defaults duration to 1 and both styles to 0', async () => {
    const { show, group } = showWithGroup();
    const created = resultOf(await dispatch(show, {
      id: 's4', cmd: 'create_scene', args: { group_id: group.id },
    }));
    expect(created.duration).toBe(1);
    expect(group.cuePool.cues[0].triggerStyle).toBe(0);
    expect(group.cuePool.cues[0].loopStyle).toBe(0);
  });

  it('rejects a trigger_style outside 0..1', async () => {
    const { show, group } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 's5', cmd: 'create_scene', args: { group_id: group.id, trigger_style: 5 },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'create_scene: Argument "trigger_style" must be <= 1',
    });
  });
});

describe('create_chase', () => {
  it('creates a chase that inherits every cue in the group', async () => {
    const { show, group } = showWithGroup();
    group.addCue({ type: 0, name: 'A' });
    group.addCue({ type: 0, name: 'B' });

    const created = resultOf(await dispatch(show, {
      id: 'h1',
      cmd: 'create_chase',
      args: {
        group_id: group.id, name: 'Row 0', grid_index: 0, duration: 8,
      },
    }));

    expect(created).toEqual({
      id: 0, groupId: group.id, name: 'Row 0', gridIndex: 0, duration: 8, cueCount: 2,
    });
  });

  it('restricts the chase to the named cue ids', async () => {
    const { show, group } = showWithGroup();
    const first = group.addCue({ type: 0, name: 'A' });
    group.addCue({ type: 0, name: 'B' });

    const created = resultOf(await dispatch(show, {
      id: 'h2',
      cmd: 'create_chase',
      args: { group_id: group.id, name: 'Only A', cue_ids: [first.id] },
    }));

    expect(created.cueCount).toBe(1);
  });

  it('errors when a named cue id is not in the group', async () => {
    const { show, group } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'h3',
      cmd: 'create_chase',
      args: { group_id: group.id, cue_ids: [77] },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
  });
});

describe('playback', () => {
  it('play_cue starts and stops a cue', async () => {
    const { show, group } = showWithGroup();
    const cue = group.addCue({ type: 0, name: 'Wash' });

    const started = resultOf(await dispatch(show, {
      id: 'pb1', cmd: 'play_cue', args: { group_id: group.id, cue_id: cue.id },
    }));
    expect(started).toEqual({
      groupId: group.id, cueId: cue.id, state: true, cueState: 1,
    });

    const stopped = resultOf(await dispatch(show, {
      id: 'pb2',
      cmd: 'play_cue',
      args: { group_id: group.id, cue_id: cue.id, state: false },
    }));
    expect(stopped.cueState).toBe(0);
  });

  it('play_chase forwards to Group#cueChase', async () => {
    const { show, group } = showWithGroup();
    group.addCue({ type: 0, name: 'A' });
    const chase = group.addChase({ name: 'Row 0' });
    const spy = vi.spyOn(group, 'cueChase');

    const played = resultOf(await dispatch(show, {
      id: 'pb3', cmd: 'play_chase', args: { group_id: group.id, chase_id: chase.id },
    }));

    expect(played).toEqual({ groupId: group.id, chaseId: chase.id, state: true });
    expect(spy).toHaveBeenCalledWith(chase, true);
  });

  it('stop_all stops every chase and every cue in every group', async () => {
    const { show, group } = showWithGroup();
    const cue = group.addCue({ type: 0, name: 'A' });
    const chase = group.addChase({ name: 'Row 0' });
    const chaseSpy = vi.spyOn(group, 'stopAllChases');
    cue.cue(true);
    expect(cue.state).toBe(1);

    const stopped = resultOf(await dispatch(show, {
      id: 'pb4', cmd: 'stop_all', args: {},
    }));

    expect(stopped).toEqual({ groups: 1, cuesStopped: 1 });
    expect(chaseSpy).toHaveBeenCalled();
    expect(cue.state).toBe(0);
    expect(chase.id).toBe(0);
    expect(show.master.playingRow).toBe(-1);
  });

  it('master_row triggers the chase row and reports the playing row', async () => {
    const { show, group } = showWithGroup();
    group.addCue({ type: 0, name: 'A' });
    group.addChase({ name: 'Row 0' });

    const fired = resultOf(await dispatch(show, {
      id: 'pb5', cmd: 'master_row', args: { row: 0 },
    }));

    expect(fired).toEqual({ row: 0, playingRow: 0 });
  });

  it('master_row reports -1 when no group has a chase on that row', async () => {
    const { show } = showWithGroup();
    const fired = resultOf(await dispatch(show, {
      id: 'pb6', cmd: 'master_row', args: { row: 3 },
    }));
    expect(fired).toEqual({ row: 3, playingRow: -1 });
  });
});

describe('set_bpm', () => {
  it('sets the show BPM', async () => {
    const show = makeShowDouble();
    const set = resultOf(await dispatch(show, {
      id: 'b1', cmd: 'set_bpm', args: { bpm: 128 },
    }));
    expect(set).toEqual({ bpm: 128 });
    expect(show.bpm).toBe(128);
  });

  it('rejects a BPM below 20', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'b2', cmd: 'set_bpm', args: { bpm: 1 },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'set_bpm: Argument "bpm" must be >= 20',
    });
  });

  it('rejects a BPM above 400', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'b3', cmd: 'set_bpm', args: { bpm: 900 },
    });
    expect(envelope.error.message).toBe('set_bpm: Argument "bpm" must be <= 400');
  });
});
```

- [ ] **Step 2: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp-bridge/control.commands.spec.js`
Expected: FAIL — `Failed to resolve import "@/mcp-bridge/commands/control.commands"`.

- [ ] **Step 3: Implement the control commands**

Create `src/mcp-bridge/commands/control.commands.js`:

```js
import { registerCommand } from './registry';
import { ValidationError } from './validate';

/**
 * Live control: channel values, groups, cues, chases, playback and tempo.
 *
 * Every command validates its full payload -- including nested array entries --
 * and resolves every referenced model BEFORE mutating anything, so a request
 * that names one bad id leaves the show exactly as it was.
 *
 * @module mcp-bridge/commands/control.commands
 */

/**
 * Minimum and maximum DMX channel value.
 *
 * @constant {Number}
 * @private
 */
const DMX_MAX = 255;

/**
 * Shared argument schema for create_scene and create_effect.
 *
 * @constant {Object}
 * @private
 */
const CUE_ARGS = {
  group_id: {
    type: 'number', required: true, integer: true, min: 0,
  },
  name: { type: 'string' },
  color: { type: 'string' },
  duration: { type: 'number', min: 0, default: 1 },
  trigger_style: {
    type: 'number', integer: true, min: 0, max: 1, default: 0,
  },
  loop_style: {
    type: 'number', integer: true, min: 0, max: 1, default: 0,
  },
  relative: {
    type: 'number', integer: true, min: 0, max: 1, default: 0,
  },
};

/**
 * Validates the structure of a `channels` entry list.
 *
 * @param {Array<Object>} channels raw entries
 * @throws {ValidationError} on any malformed entry
 * @private
 */
function assertChannelEntries(channels) {
  channels.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new ValidationError(`Argument "channels[${index}]" must be an object`);
    }
    if (!Number.isInteger(entry.index) || entry.index < 0) {
      throw new ValidationError(
        `Argument "channels[${index}].index" must be a non-negative integer`,
      );
    }
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
      throw new ValidationError(`Argument "channels[${index}].value" must be a number`);
    }
    if (entry.value < 0 || entry.value > DMX_MAX) {
      throw new ValidationError(
        `Argument "channels[${index}].value" must be between 0 and ${DMX_MAX}`,
      );
    }
  });
}

/**
 * Validates the structure of an `accessors` entry list.
 *
 * @param {Array<Object>} accessors raw entries
 * @throws {ValidationError} on any malformed entry
 * @private
 */
function assertAccessorEntries(accessors) {
  accessors.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new ValidationError(`Argument "accessors[${index}]" must be an object`);
    }
    if (typeof entry.type !== 'string' || !entry.type.length) {
      throw new ValidationError(
        `Argument "accessors[${index}].type" must be a non-empty string`,
      );
    }
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
      throw new ValidationError(`Argument "accessors[${index}].value" must be a number`);
    }
    if (entry.value < 0 || entry.value > DMX_MAX) {
      throw new ValidationError(
        `Argument "accessors[${index}].value" must be between 0 and ${DMX_MAX}`,
      );
    }
    if (entry.index !== undefined && (!Number.isInteger(entry.index) || entry.index < 0)) {
      throw new ValidationError(
        `Argument "accessors[${index}].index" must be a non-negative integer`,
      );
    }
  });
}

registerCommand('set_channels', {
  description: 'Sets DMX values on one or more patched fixtures, either by '
    + 'fixture-relative channel index or by named quick accessor (Dimmer, Pan, '
    + 'Tilt, Zoom, Color, ...). Accessors a fixture lacks are reported as skipped.',
  args: {
    fixture_ids: {
      type: 'array', required: true, items: 'number', minLength: 1,
    },
    channels: { type: 'array' },
    accessors: { type: 'array' },
  },
  handler: (show, args) => {
    if (args.channels === undefined && args.accessors === undefined) {
      throw new ValidationError('Provide at least one of "channels" or "accessors"');
    }
    const channels = args.channels || [];
    const accessors = args.accessors || [];
    assertChannelEntries(channels);
    assertAccessorEntries(accessors);

    // Resolve and bounds-check everything first -- no partial application.
    const fixtures = args.fixture_ids.map((id) => show.fixturePool.getFromId(id));
    fixtures.forEach((fixture) => {
      channels.forEach((entry) => {
        if (entry.index >= fixture.channels.length) {
          throw new Error(
            `Fixture ${fixture.id} has no channel at index ${entry.index} `
            + `(it has ${fixture.channels.length}).`,
          );
        }
      });
    });

    const updated = fixtures.map((fixture) => {
      const appliedChannels = [];
      const appliedAccessors = [];
      const skipped = [];
      channels.forEach((entry) => {
        fixture.setChannel(entry.index, entry.value);
        appliedChannels.push(entry.index);
      });
      accessors.forEach((entry) => {
        const selector = { type: entry.type, qaIndex: entry.index || 0 };
        if (fixture.hasQuickAccessor(selector)) {
          fixture.setQuickAccessor(selector, entry.value);
          appliedAccessors.push(entry.type);
        } else {
          skipped.push(entry.type);
        }
      });
      return {
        id: fixture.id,
        channels: appliedChannels,
        accessors: appliedAccessors,
        skipped,
      };
    });

    return { updated };
  },
});

registerCommand('create_group', {
  description: 'Creates an empty fixture group. Groups own the cues and chases '
    + 'that drive their fixtures.',
  args: {
    name: { type: 'string', required: true },
    color: { type: 'string' },
  },
  handler: (show, args) => {
    const group = show.groupPool.addRaw({ name: args.name, color: args.color });
    return { id: group.id, name: group.name, color: group.color };
  },
});

registerCommand('add_fixtures_to_group', {
  description: 'Adds patched fixtures to an existing group. Existing cues in '
    + 'the group pick the new fixtures up automatically.',
  args: {
    group_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    fixture_ids: {
      type: 'array', required: true, items: 'number', minLength: 1,
    },
  },
  handler: (show, args) => {
    const group = show.groupPool.getFromId(args.group_id);
    const fixtures = args.fixture_ids.map((id) => show.fixturePool.getFromId(id));
    fixtures.forEach((fixture) => group.addFixture(fixture));
    return {
      groupId: group.id,
      fixtureIds: fixtures.map((fixture) => fixture.id),
      fixtureCount: group.fixturePool.fixtures.length,
    };
  },
});

/**
 * Shared implementation for create_scene (type 0) and create_effect (type 1).
 *
 * @param {Number} type cue type -- 0 scene, 1 effect
 * @return {Function} registry handler
 * @private
 */
function makeCueHandler(type) {
  return (show, args) => {
    const group = show.groupPool.getFromId(args.group_id);
    const cue = group.addCue({
      type,
      name: args.name,
      color: args.color,
      triggerStyle: args.trigger_style,
      loopStyle: args.loop_style,
      duration: args.duration,
      relative: args.relative,
    });
    return {
      id: cue.id,
      groupId: group.id,
      type: cue.type,
      name: cue.name,
      duration: cue.duration,
    };
  };
}

registerCommand('create_scene', {
  description: 'Creates a scene cue (a static look that fades in over its '
    + 'duration) on a group. The group fixtures are injected automatically.',
  args: CUE_ARGS,
  handler: makeCueHandler(0),
});

registerCommand('create_effect', {
  description: 'Creates an effect cue (a time-varying modulation) on a group. '
    + 'The group fixtures are injected automatically.',
  args: CUE_ARGS,
  handler: makeCueHandler(1),
});

registerCommand('create_chase', {
  description: 'Creates a chase on a group -- a sequence of its cues triggered '
    + 'over time. Without cue_ids the chase takes every cue in the group.',
  args: {
    group_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    name: { type: 'string' },
    grid_index: { type: 'number', integer: true, min: 0 },
    color: { type: 'string' },
    duration: { type: 'number', min: 0, default: 1 },
    trigger: {
      type: 'number', integer: true, min: 0, max: 1, default: 0,
    },
    cue_ids: { type: 'array', items: 'number' },
  },
  handler: (show, args) => {
    const group = show.groupPool.getFromId(args.group_id);
    // getFromId throws for an id the group does not own -- resolve up front so
    // an unknown cue id fails before the chase is created.
    const cues = args.cue_ids
      ? args.cue_ids.map((id) => ({ cue: group.cuePool.getFromId(id).id }))
      : undefined;
    const chase = group.addChase({
      name: args.name,
      gridIndex: args.grid_index,
      color: args.color,
      duration: args.duration,
      trigger: args.trigger,
      cues,
    });
    return {
      id: chase.id,
      groupId: group.id,
      name: chase.name,
      gridIndex: chase.gridIndex,
      duration: chase.duration,
      cueCount: chase.cueItemPools.length,
    };
  },
});

registerCommand('play_cue', {
  description: 'Starts or stops a single cue on a group.',
  args: {
    group_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    cue_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    state: { type: 'boolean', default: true },
  },
  handler: (show, args) => {
    const group = show.groupPool.getFromId(args.group_id);
    const cue = group.cuePool.getFromId(args.cue_id);
    cue.cue(args.state);
    return {
      groupId: group.id,
      cueId: cue.id,
      state: args.state,
      cueState: cue.state,
    };
  },
});

registerCommand('play_chase', {
  description: 'Starts or stops a chase on a group. Starting one stops the '
    + 'other chases in the same group.',
  args: {
    group_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    chase_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    state: { type: 'boolean', default: true },
  },
  handler: (show, args) => {
    const group = show.groupPool.getFromId(args.group_id);
    const chase = group.chasePool.getFromId(args.chase_id);
    group.cueChase(chase, args.state);
    return { groupId: group.id, chaseId: chase.id, state: args.state };
  },
});

registerCommand('stop_all', {
  description: 'Panic stop: stops every chase and every cue in every group and '
    + 'clears the master playing row.',
  args: {},
  handler: (show) => {
    let cuesStopped = 0;
    show.groupPool.groups.forEach((group) => {
      group.stopAllChases();
      group.cuePool.cues.forEach((cue) => {
        if (cue.state) {
          cuesStopped += 1;
        }
        cue.cue(false);
      });
    });
    show.master.playingRow = -1;
    return { groups: show.groupPool.groups.length, cuesStopped };
  },
});

registerCommand('master_row', {
  description: 'Triggers the master chase row across every group -- the '
    + 'equivalent of pressing a row button on the master grid. Toggles off when '
    + 'the row is already playing.',
  args: {
    row: {
      type: 'number', required: true, integer: true, min: 0,
    },
  },
  handler: (show, args) => ({
    row: args.row,
    playingRow: show.master.cueRow(args.row),
  }),
});

registerCommand('set_bpm', {
  description: 'Sets the show tempo in beats per minute. Drives every '
    + 'beat-quantised cue and chase.',
  args: {
    bpm: {
      type: 'number', required: true, min: 20, max: 400,
    },
  },
  handler: (show, args) => {
    show.bpm = args.bpm;
    return { bpm: show.bpm };
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- test/mcp-bridge/control.commands.spec.js`
Expected: PASS — 33 tests.

Two property names in this file are read from models rather than written: `cue.fixtureValues` (asserted in the "injects the group fixtures" test) and `chase.cueItemPools`. If either is named differently in `src/models/DMX/scene.model.js` / `chase.model.js`, read the file and use the real name — the assertions, not the names, are the contract.

- [ ] **Step 5: Run the full suite and lint**

Run: `npm run test:run && npm run lint:ci`
Expected: all tests pass; ESLint 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/mcp-bridge/commands/control.commands.js test/mcp-bridge/control.commands.spec.js
git commit -m "feat(mcp): add channel, group, cue, chase and playback commands

set_channels supports both raw fixture-relative indices and named quick
accessors, validating every entry before touching a model so a partially
bad request mutates nothing.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Show-management and vision commands

**Files:**
- Create: `src/mcp-bridge/commands/show.commands.js`
- Create: `src/mcp-bridge/commands/vision.commands.js`
- Test: `test/mcp-bridge/show.commands.spec.js`
- Test: `test/mcp-bridge/vision.commands.spec.js`

**Interfaces:**
- Consumes: `registerCommand` from `./registry`; `ValidationError` from `./validate`; `Show` from `@/models/DMX/show.model` (for the `undo`/`redo` statics).
- Produces six registered commands:
  - `new_show` — args `{}` → `{ name, universes, fixtureCount }`
  - `save_show` — args `{}` → `{ saved: true, name, bytes }`
  - `load_show` — args `{ data?: object, from_local_storage?: boolean (default false) }` → `{ name, fixtureCount, groupCount }`. Exactly one source must be given.
  - `undo` — args `{}` → `{ undone: true }`
  - `redo` — args `{}` → `{ redone: true }`
  - `screenshot_visualizer` — args `{ mime_type?: 'image/png'|'image/jpeg' (default 'image/png') }` → `{ mimeType, width, height, dataBase64 }`

**Why a forced render:** the Three.js renderer is created without `preserveDrawingBuffer`, so the WebGL colour buffer is cleared after each composite and `toDataURL` on a stale canvas returns a blank image. `screenshot_visualizer` therefore calls `visualizerHandle.render()` immediately before reading the canvas.

- [ ] **Step 1: Write the failing show-command test**

Create `test/mcp-bridge/show.commands.spec.js`:

```js
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [] })) },
}));

// eslint-disable-next-line import/first
import axios from 'axios';
// eslint-disable-next-line import/first
import Show from '@/models/DMX/show.model';
// eslint-disable-next-line import/first
import { ProxifySingleton } from '@/models/utils/proxify.utils';
// eslint-disable-next-line import/first
import { dispatch } from '@/mcp-bridge/commands/registry';
// eslint-disable-next-line import/first
import '@/mcp-bridge/commands/show.commands';
// eslint-disable-next-line import/first
import MovingHead from '../stubs/moving_head.stub';
// eslint-disable-next-line import/first
import Controls from '../stubs/controls.stub';

/**
 * localStorage key Świetlik writes its autosave to.
 *
 * @constant {String}
 */
const SHOWFILE_KEY = 'SWIETLIK_SHOWFILE';

/**
 * Unwraps a success envelope, failing loudly on an error envelope.
 *
 * @param {Object} envelope response envelope from dispatch
 * @return {*} the result payload
 */
function resultOf(envelope) {
  if (!envelope.ok) {
    throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
  }
  return envelope.result;
}

/**
 * Minimal but complete showfile payload. `Show#loadFromData` walks visualizer
 * -> fixtures -> universes -> groups -> outputs unconditionally, so every key
 * has to be present even when empty.
 *
 * @param {Object} [overrides={}] show-data overrides
 * @return {Object} show data object
 */
function showFileData(overrides = {}) {
  return {
    name: 'loaded_show',
    bpm: 128,
    visualizer: { fog: false },
    fixtures: [],
    universes: [{
      id: 0, name: 'Universe 0', color: '#ffffff', fixtures: [],
    }],
    groups: [],
    outputs: [],
    ...overrides,
  };
}

/**
 * Builds a Show with the visualizer handle stubbed out.
 *
 * @return {Show} show instance
 */
function buildShow() {
  const show = new Show();
  show.visualizerHandle = {
    preferences: null,
    showData: { camera: 'default' },
  };
  return show;
}

beforeEach(() => {
  MovingHead.reset();
  Controls.reset();
  localStorage.clear();
  axios.get.mockResolvedValue({ data: [] });
  // Every `new Show()` subscribes to the module-level ProxifySingleton and
  // nothing ever unsubscribes -- drop the listeners and stacks between tests.
  ProxifySingleton.removeAllListeners('changed');
  ProxifySingleton.undoStack = [];
  ProxifySingleton.redoStack = [];
  ProxifySingleton.hash = null;
});

describe('new_show', () => {
  it('clears the show and leaves exactly one empty universe', async () => {
    const show = buildShow();

    const created = resultOf(await dispatch(show, { id: 'n1', cmd: 'new_show', args: {} }));

    expect(created).toEqual({
      name: 'new_project.asls',
      universes: 1,
      fixtureCount: 0,
    });
    expect(show.universePool.universes).toHaveLength(1);
    expect(show.fixturePool.fixtures).toHaveLength(0);
  });

  it('persists the blank show so a reload does not resurrect the old one', async () => {
    const show = buildShow();
    await dispatch(show, { id: 'n2', cmd: 'new_show', args: {} });

    const persisted = JSON.parse(localStorage.getItem(SHOWFILE_KEY));
    expect(persisted.fixtures).toEqual([]);
    expect(persisted.universes).toHaveLength(1);
  });
});

describe('save_show', () => {
  it('writes the autosave and reports its size', async () => {
    const show = buildShow();

    const saved = resultOf(await dispatch(show, { id: 'sv1', cmd: 'save_show', args: {} }));

    expect(saved.saved).toBe(true);
    expect(saved.name).toBe(show.name);
    expect(saved.bytes).toBeGreaterThan(0);
    expect(localStorage.getItem(SHOWFILE_KEY)).not.toBeNull();
  });

  it('marks the show as saved', async () => {
    const show = buildShow();
    show.isSaved = false;
    await dispatch(show, { id: 'sv2', cmd: 'save_show', args: {} });
    expect(show.isSaved).toBe(true);
  });
});

describe('load_show', () => {
  it('loads a show from an inline data object', async () => {
    const show = buildShow();

    const loaded = resultOf(await dispatch(show, {
      id: 'l1', cmd: 'load_show', args: { data: showFileData() },
    }));

    expect(loaded).toEqual({ name: 'loaded_show', fixtureCount: 0, groupCount: 0 });
    expect(show.bpm).toBe(128);
  });

  it('loads the autosave from localStorage', async () => {
    localStorage.setItem(SHOWFILE_KEY, JSON.stringify(showFileData({ name: 'autosaved' })));
    const show = buildShow();

    const loaded = resultOf(await dispatch(show, {
      id: 'l2', cmd: 'load_show', args: { from_local_storage: true },
    }));

    expect(loaded.name).toBe('autosaved');
  });

  it('errors when localStorage holds no show', async () => {
    const show = buildShow();
    const envelope = await dispatch(show, {
      id: 'l3', cmd: 'load_show', args: { from_local_storage: true },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.message).toContain('No autosaved show found');
  });

  it('requires exactly one source', async () => {
    const show = buildShow();
    const envelope = await dispatch(show, { id: 'l4', cmd: 'load_show', args: {} });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'load_show: Provide exactly one of "data" or "from_local_storage"',
    });
  });

  it('rejects both sources at once', async () => {
    const show = buildShow();
    const envelope = await dispatch(show, {
      id: 'l5',
      cmd: 'load_show',
      args: { data: showFileData(), from_local_storage: true },
    });
    expect(envelope.error.message)
      .toBe('load_show: Provide exactly one of "data" or "from_local_storage"');
  });

  it('surfaces a malformed payload as a COMMAND_ERROR', async () => {
    const show = buildShow();
    const envelope = await dispatch(show, {
      id: 'l6', cmd: 'load_show', args: { data: { name: 'broken' } },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
  });
});

describe('undo and redo', () => {
  it('undo forwards to the Show undo static', async () => {
    const spy = vi.spyOn(Show, 'undo').mockImplementation(() => {});
    const show = buildShow();

    const undone = resultOf(await dispatch(show, { id: 'ur1', cmd: 'undo', args: {} }));

    expect(undone).toEqual({ undone: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('redo forwards to the Show redo static', async () => {
    const spy = vi.spyOn(Show, 'redo').mockImplementation(() => {});
    const show = buildShow();

    const redone = resultOf(await dispatch(show, { id: 'ur2', cmd: 'redo', args: {} }));

    expect(redone).toEqual({ redone: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('reports an undo failure as a COMMAND_ERROR instead of crashing', async () => {
    vi.spyOn(Show, 'undo').mockImplementation(() => {
      throw new Error('nothing to undo');
    });
    const show = buildShow();
    const envelope = await dispatch(show, { id: 'ur3', cmd: 'undo', args: {} });
    expect(envelope.error).toEqual({
      code: 'COMMAND_ERROR',
      message: 'undo: nothing to undo',
    });
  });
});
```

- [ ] **Step 2: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp-bridge/show.commands.spec.js`
Expected: FAIL — `Failed to resolve import "@/mcp-bridge/commands/show.commands"`.

- [ ] **Step 3: Implement the show commands**

Create `src/mcp-bridge/commands/show.commands.js`:

```js
import Show from '@/models/DMX/show.model';
import { registerCommand } from './registry';
import { ValidationError } from './validate';

/**
 * Show lifecycle: new, save, load, undo, redo.
 *
 * These wrap the `Show` facade rather than reimplementing it, so a
 * bridge-driven save is byte-identical to one made from the toolbar.
 *
 * @module mcp-bridge/commands/show.commands
 */

registerCommand('new_show', {
  description: 'Discards the current show and starts a blank one with a single '
    + 'empty universe. The blank show is autosaved immediately.',
  args: {},
  handler: (show) => {
    show.clearShowData();
    show.universePool.addRaw();
    show.persistLocally();
    return {
      name: show.name,
      universes: show.universePool.universes.length,
      fixtureCount: show.fixturePool.fixtures.length,
    };
  },
});

registerCommand('save_show', {
  description: 'Autosaves the current show to browser localStorage under the '
    + 'SWIETLIK_SHOWFILE key and reports the serialised size.',
  args: {},
  handler: (show) => {
    show.persistLocally();
    return {
      saved: true,
      name: show.name,
      bytes: show.genShowFile().length,
    };
  },
});

registerCommand('load_show', {
  description: 'Replaces the current show, either from an inline showfile '
    + 'object or from the browser autosave. Exactly one source is required.',
  args: {
    data: { type: 'object' },
    from_local_storage: { type: 'boolean', default: false },
  },
  handler: async (show, args) => {
    const hasData = args.data !== undefined;
    if (hasData === args.from_local_storage) {
      throw new ValidationError('Provide exactly one of "data" or "from_local_storage"');
    }
    if (hasData) {
      await show.loadFromData(args.data);
    } else {
      const loaded = await show.loadFromLocalStorage();
      if (!loaded) {
        throw new Error('No autosaved show found in localStorage.');
      }
    }
    return {
      name: show.name,
      fixtureCount: show.fixturePool.fixtures.length,
      groupCount: show.groupPool.groups.length,
    };
  },
});

registerCommand('undo', {
  description: 'Undoes the last tracked show mutation.',
  args: {},
  handler: () => {
    Show.undo();
    return { undone: true };
  },
});

registerCommand('redo', {
  description: 'Redoes the last undone show mutation.',
  args: {},
  handler: () => {
    Show.redo();
    return { redone: true };
  },
});
```

- [ ] **Step 4: Run the show-command test**

Run: `npm run test:run -- test/mcp-bridge/show.commands.spec.js`
Expected: PASS — 13 tests.

- [ ] **Step 5: Write the failing vision test**

Create `test/mcp-bridge/vision.commands.spec.js`:

```js
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { dispatch } from '@/mcp-bridge/commands/registry';
import '@/mcp-bridge/commands/vision.commands';
import { makeShowDouble } from '../helpers/show-double';

/**
 * Unwraps a success envelope, failing loudly on an error envelope.
 *
 * @param {Object} envelope response envelope from dispatch
 * @return {*} the result payload
 */
function resultOf(envelope) {
  if (!envelope.ok) {
    throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
  }
  return envelope.result;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('screenshot_visualizer', () => {
  it('forces a render before reading the canvas', async () => {
    const show = makeShowDouble();
    const shot = resultOf(await dispatch(show, {
      id: 'v1', cmd: 'screenshot_visualizer', args: {},
    }));

    expect(show.visualizerHandle.render).toHaveBeenCalledTimes(1);
    expect(shot).toEqual({
      mimeType: 'image/png',
      width: 1280,
      height: 720,
      dataBase64: 'UE5HREFUQQ==',
    });
  });

  it('renders before, not after, reading the canvas', async () => {
    const show = makeShowDouble();
    const order = [];
    show.visualizerHandle.render = vi.fn(() => order.push('render'));
    show.visualizerHandle.renderer.domElement.toDataURL = vi.fn(() => {
      order.push('capture');
      return 'data:image/png;base64,QQ==';
    });

    await dispatch(show, { id: 'v2', cmd: 'screenshot_visualizer', args: {} });

    expect(order).toEqual(['render', 'capture']);
  });

  it('passes the requested mime type through to toDataURL', async () => {
    const show = makeShowDouble();
    show.visualizerHandle.renderer.domElement.toDataURL = vi.fn(
      () => 'data:image/jpeg;base64,SlBH',
    );

    const shot = resultOf(await dispatch(show, {
      id: 'v3', cmd: 'screenshot_visualizer', args: { mime_type: 'image/jpeg' },
    }));

    expect(show.visualizerHandle.renderer.domElement.toDataURL)
      .toHaveBeenCalledWith('image/jpeg');
    expect(shot.mimeType).toBe('image/jpeg');
    expect(shot.dataBase64).toBe('SlBH');
  });

  it('falls back to visualizerHandle.domElement when no renderer is attached', async () => {
    const show = makeShowDouble();
    show.visualizerHandle.renderer = null;
    show.visualizerHandle.domElement = {
      width: 800,
      height: 600,
      toDataURL: vi.fn(() => 'data:image/png;base64,RkFMTA=='),
    };

    const shot = resultOf(await dispatch(show, {
      id: 'v4', cmd: 'screenshot_visualizer', args: {},
    }));

    expect(shot).toEqual({
      mimeType: 'image/png',
      width: 800,
      height: 600,
      dataBase64: 'RkFMTA==',
    });
  });

  it('errors when the visualizer is not mounted yet', async () => {
    const show = makeShowDouble({ visualizerHandle: null });
    const envelope = await dispatch(show, {
      id: 'v5', cmd: 'screenshot_visualizer', args: {},
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.message).toContain('visualizer is not mounted');
  });

  it('errors when no canvas can be found on the handle', async () => {
    const show = makeShowDouble();
    show.visualizerHandle.renderer = null;
    const envelope = await dispatch(show, {
      id: 'v6', cmd: 'screenshot_visualizer', args: {},
    });
    expect(envelope.error.message).toContain('no WebGL canvas');
  });

  it('errors when the canvas returns something that is not a data URL', async () => {
    const show = makeShowDouble();
    show.visualizerHandle.renderer.domElement.toDataURL = vi.fn(() => '');
    const envelope = await dispatch(show, {
      id: 'v7', cmd: 'screenshot_visualizer', args: {},
    });
    expect(envelope.error.message).toContain('did not return an image');
  });

  it('rejects an unsupported mime type', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'v8', cmd: 'screenshot_visualizer', args: { mime_type: 'image/gif' },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'screenshot_visualizer: Argument "mime_type" must be one of: '
        + 'image/png, image/jpeg',
    });
  });
});
```

- [ ] **Step 6: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp-bridge/vision.commands.spec.js`
Expected: FAIL — `Failed to resolve import "@/mcp-bridge/commands/vision.commands"`.

- [ ] **Step 7: Implement the vision command**

Create `src/mcp-bridge/commands/vision.commands.js`:

```js
import { registerCommand } from './registry';

/**
 * Visualizer capture -- the command that lets an agent SEE the rig.
 *
 * The Three.js renderer is built without `preserveDrawingBuffer`, so the WebGL
 * colour buffer is gone by the time an external caller asks for it. A forced
 * `render()` immediately before `toDataURL` is what makes the capture non-blank.
 *
 * @module mcp-bridge/commands/vision.commands
 */

/**
 * Locates the renderer canvas on a visualizer handle.
 *
 * @param {Object} handle visualizer instance
 * @return {Object|null} canvas element, or null when none is attached
 * @private
 */
function findCanvas(handle) {
  if (handle.renderer && handle.renderer.domElement) {
    return handle.renderer.domElement;
  }
  if (handle.domElement && typeof handle.domElement.toDataURL === 'function') {
    return handle.domElement;
  }
  return null;
}

registerCommand('screenshot_visualizer', {
  description: 'Captures the 3D visualizer viewport as a PNG or JPEG image. '
    + 'Forces a render first, so the frame is current.',
  args: {
    mime_type: {
      type: 'string',
      enum: ['image/png', 'image/jpeg'],
      default: 'image/png',
    },
  },
  handler: (show, args) => {
    const handle = show.visualizerHandle;
    if (!handle) {
      throw new Error('The visualizer is not mounted yet -- open the app and '
        + 'wait for the 3D viewport before taking a screenshot.');
    }
    const canvas = findCanvas(handle);
    if (!canvas) {
      throw new Error('The visualizer handle exposes no WebGL canvas to capture.');
    }
    if (typeof handle.render === 'function') {
      handle.render();
    }
    const dataUrl = canvas.toDataURL(args.mime_type);
    const commaIndex = typeof dataUrl === 'string' ? dataUrl.indexOf(',') : -1;
    if (commaIndex < 0) {
      throw new Error('The visualizer canvas did not return an image data URL.');
    }
    return {
      mimeType: args.mime_type,
      width: canvas.width,
      height: canvas.height,
      dataBase64: dataUrl.slice(commaIndex + 1),
    };
  },
});
```

- [ ] **Step 8: Run the vision test**

Run: `npm run test:run -- test/mcp-bridge/vision.commands.spec.js`
Expected: PASS — 8 tests.

- [ ] **Step 9: Run the full suite and lint**

Run: `npm run test:run && npm run lint:ci`
Expected: all tests pass; ESLint 0 errors.

- [ ] **Step 10: Commit**

```bash
git add src/mcp-bridge/commands/show.commands.js src/mcp-bridge/commands/vision.commands.js test/mcp-bridge/show.commands.spec.js test/mcp-bridge/vision.commands.spec.js
git commit -m "feat(mcp): add show lifecycle commands and visualizer screenshot

new_show/save_show/load_show/undo/redo wrap the Show facade;
screenshot_visualizer forces a render before toDataURL because the
renderer runs without preserveDrawingBuffer.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: In-app WebSocket bridge and the single upstream hook

**Files:**
- Create: `src/mcp-bridge/bridge.js`
- Create: `src/mcp-bridge/index.js`
- Modify: `src/App.vue` (**the one and only upstream edit in this whole plan** — one `import` plus its explanatory comment, after the existing `AppActivity` import on line 8)
- Modify: `docs/swietlik/upstream-diff.md` (add one row to the **Application source** table, §"Modified upstream files")
- Test: `test/mcp-bridge/bridge.spec.js`
- Test: `test/mcp-bridge/index.spec.js`

**Interfaces:**
- Consumes: `dispatch` from `./commands`; `PROTOCOL_VERSION`, `MESSAGE_TYPES`, `ERROR_CODES`, `parseMessage`, `isRequest`, `makeError` (in `bridge.js`) and `resolvePort` (in `index.js`) from `@root/mcp/protocol`; `reactive` from `vue`; `ShowSingleton` from `@/singletons/show.singleton`; `EventBus` from `@/plugins/eventbus`.
- Produces `src/mcp-bridge/bridge.js` — `export default class Bridge`:
  - `constructor({ show, url, dispatchFn?, WebSocketImpl?, setTimeoutFn?, clearTimeoutFn?, logger? })`
  - `connect() -> void`, `disconnect() -> void`, `send(envelope) -> void`, `handleMessage(raw) -> Promise<void>`
  - getter `connected -> boolean`
  - statics `INITIAL_RECONNECT_DELAY_MS = 500`, `MAX_RECONNECT_DELAY_MS = 10000`
- Produces `src/mcp-bridge/index.js`:
  - `startMcpBridge(env?: object) -> Bridge | null`
  - `stopMcpBridge() -> void`
  - `getActiveBridge() -> Bridge | null`
  - side effect: `EventBus.on('app_ready', ...)` → `startMcpBridge()`

**THE INVARIANT THIS TASK ENFORCES:** `startMcpBridge` must hand the bridge `reactive(ShowSingleton)`. Vue's proxy cache returns the same proxy object `src/main.js` installed as `$show`, so mutations made by a command re-render the UI and the visualizer. Passing the raw `ShowSingleton` bypasses Vue's traps and produces a silently desynced UI — the app looks unchanged while the model has moved. `test/mcp-bridge/index.spec.js` asserts the proxy identity; do not weaken that test.

- [ ] **Step 1: Write the failing bridge test**

Create `test/mcp-bridge/bridge.spec.js`:

```js
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import Bridge from '@/mcp-bridge/bridge';
import { makeRequest, makeSuccess, makeDetach } from '@root/mcp/protocol';

/**
 * Minimal scriptable WebSocket stand-in. Instances register themselves so the
 * test can drive the lifecycle callbacks by hand.
 *
 * @class FakeWebSocket
 */
class FakeWebSocket {
  static instances = [];

  static reset() {
    FakeWebSocket.instances = [];
  }

  static get last() {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  }

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this.closeCalls = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }

  deliver(payload) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(payload) });
  }

  deliverRaw(data) {
    if (this.onmessage) this.onmessage({ data });
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.closeCalls += 1;
    this.readyState = 3;
    if (this.onclose) this.onclose({ code: 1000 });
  }
}

/**
 * Builds a bridge wired to the fake socket and a stub dispatcher.
 *
 * @param {Object} [options={}] `{ dispatchFn, show }` overrides
 * @return {Object} `{ bridge, dispatchFn, logger }`
 */
function buildBridge(options = {}) {
  const dispatchFn = options.dispatchFn
    || vi.fn(async (show, request) => makeSuccess(request.id, { echoed: request.cmd }));
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const bridge = new Bridge({
    show: options.show || { name: 'show' },
    url: 'ws://127.0.0.1:5215',
    dispatchFn,
    WebSocketImpl: FakeWebSocket,
    logger,
  });
  return { bridge, dispatchFn, logger };
}

beforeEach(() => {
  FakeWebSocket.reset();
  vi.useRealTimers();
});

describe('Bridge -- connection', () => {
  it('opens a socket at the configured url', () => {
    const { bridge } = buildBridge();
    bridge.connect();

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.last.url).toBe('ws://127.0.0.1:5215');
  });

  it('reports connected only once the socket is open', () => {
    const { bridge } = buildBridge();
    bridge.connect();
    expect(bridge.connected).toBe(false);

    FakeWebSocket.last.open();
    expect(bridge.connected).toBe(true);
  });

  it('does not open a second socket when already connecting', () => {
    const { bridge } = buildBridge();
    bridge.connect();
    bridge.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('disconnect closes the socket and stops reconnecting', () => {
    vi.useFakeTimers();
    const { bridge } = buildBridge();
    bridge.connect();
    FakeWebSocket.last.open();

    bridge.disconnect();
    expect(FakeWebSocket.last.closeCalls).toBe(1);

    vi.advanceTimersByTime(60000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(bridge.connected).toBe(false);
  });
});

describe('Bridge -- reconnect backoff', () => {
  it('reconnects after the initial delay when the socket closes', () => {
    vi.useFakeTimers();
    const { bridge } = buildBridge();
    bridge.connect();
    FakeWebSocket.last.open();
    FakeWebSocket.last.close();

    vi.advanceTimersByTime(Bridge.INITIAL_RECONNECT_DELAY_MS - 1);
    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('doubles the delay on each successive failure', () => {
    vi.useFakeTimers();
    const { bridge } = buildBridge();
    bridge.connect();
    FakeWebSocket.last.close();

    vi.advanceTimersByTime(500);
    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.last.close();

    vi.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it('caps the delay at MAX_RECONNECT_DELAY_MS', () => {
    vi.useFakeTimers();
    const { bridge } = buildBridge();
    bridge.connect();
    for (let i = 0; i < 12; i++) {
      FakeWebSocket.last.close();
      vi.advanceTimersByTime(Bridge.MAX_RECONNECT_DELAY_MS);
    }
    const before = FakeWebSocket.instances.length;
    FakeWebSocket.last.close();
    vi.advanceTimersByTime(Bridge.MAX_RECONNECT_DELAY_MS);
    expect(FakeWebSocket.instances.length).toBe(before + 1);
  });

  it('resets the delay after a successful open', () => {
    vi.useFakeTimers();
    const { bridge } = buildBridge();
    bridge.connect();
    FakeWebSocket.last.close();
    vi.advanceTimersByTime(500);
    FakeWebSocket.last.close();
    vi.advanceTimersByTime(1000);

    // Third socket opens successfully, so the next failure waits 500ms again.
    FakeWebSocket.last.open();
    FakeWebSocket.last.close();
    const before = FakeWebSocket.instances.length;
    vi.advanceTimersByTime(500);
    expect(FakeWebSocket.instances.length).toBe(before + 1);
  });
});

describe('Bridge -- message handling', () => {
  it('dispatches a request and sends the response envelope back', async () => {
    const { bridge, dispatchFn } = buildBridge();
    bridge.connect();
    FakeWebSocket.last.open();

    await bridge.handleMessage(JSON.stringify(makeRequest('r1', 'get_show_state', {})));

    expect(dispatchFn).toHaveBeenCalledWith(
      bridge.show,
      expect.objectContaining({ id: 'r1', cmd: 'get_show_state' }),
    );
    expect(FakeWebSocket.last.sent).toEqual([makeSuccess('r1', { echoed: 'get_show_state' })]);
  });

  it('answers a socket-delivered request without the test calling handleMessage', async () => {
    const { bridge } = buildBridge();
    bridge.connect();
    FakeWebSocket.last.open();

    FakeWebSocket.last.deliver(makeRequest('r2', 'undo', {}));
    await vi.waitFor(() => expect(FakeWebSocket.last.sent).toHaveLength(1));

    expect(FakeWebSocket.last.sent[0].id).toBe('r2');
  });

  it('ignores malformed payloads without sending anything', async () => {
    const { bridge, dispatchFn } = buildBridge();
    bridge.connect();
    FakeWebSocket.last.open();

    await bridge.handleMessage('not json at all');

    expect(dispatchFn).not.toHaveBeenCalled();
    expect(FakeWebSocket.last.sent).toEqual([]);
  });

  it('ignores a response envelope -- the app never receives those', async () => {
    const { bridge, dispatchFn } = buildBridge();
    bridge.connect();
    FakeWebSocket.last.open();

    await bridge.handleMessage(JSON.stringify(makeSuccess('r3', null)));

    expect(dispatchFn).not.toHaveBeenCalled();
  });

  it('rejects a request from an incompatible protocol version, by id', async () => {
    const { bridge, dispatchFn } = buildBridge();
    bridge.connect();
    FakeWebSocket.last.open();

    await bridge.handleMessage(JSON.stringify({
      v: 99, type: 'request', id: 'r4', cmd: 'undo', args: {},
    }));

    expect(dispatchFn).not.toHaveBeenCalled();
    expect(FakeWebSocket.last.sent[0]).toEqual({
      v: 1,
      type: 'response',
      id: 'r4',
      ok: false,
      error: {
        code: 'VALIDATION',
        message: 'Unsupported protocol version 99; this app speaks version 1.',
      },
    });
  });

  it('detaches without reconnecting when the hub supersedes this tab', async () => {
    vi.useFakeTimers();
    const { bridge, logger } = buildBridge();
    bridge.connect();
    FakeWebSocket.last.open();

    await bridge.handleMessage(JSON.stringify(makeDetach('superseded')));

    expect(FakeWebSocket.last.closeCalls).toBe(1);
    vi.advanceTimersByTime(60000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('drops the response when the socket closed mid-dispatch', async () => {
    let release;
    const dispatchFn = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const { bridge } = buildBridge({ dispatchFn });
    bridge.connect();
    FakeWebSocket.last.open();
    const socket = FakeWebSocket.last;

    const pending = bridge.handleMessage(JSON.stringify(makeRequest('r5', 'undo', {})));
    socket.readyState = 3;
    release(makeSuccess('r5', null));
    await pending;

    expect(socket.sent).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp-bridge/bridge.spec.js`
Expected: FAIL — `Failed to resolve import "@/mcp-bridge/bridge"`.

- [ ] **Step 3: Implement the bridge**

Create `src/mcp-bridge/bridge.js`:

```js
import {
  PROTOCOL_VERSION,
  MESSAGE_TYPES,
  ERROR_CODES,
  parseMessage,
  isRequest,
  makeError,
} from '@root/mcp/protocol';
import { dispatch } from './commands';

/**
 * WebSocket socket state meaning "open". Mirrors the DOM constant without
 * depending on a global `WebSocket` being present (it is not, under Node).
 *
 * @constant {Number}
 * @private
 */
const READY_STATE_OPEN = 1;

/**
 * @class Bridge
 * @classdesc In-app WebSocket client for the MCP sidecar. Receives command
 * requests from the hub, executes them against the reactive show handle via the
 * command registry, and writes the response envelope back. Reconnects with
 * exponential backoff so a restarted server, an HMR cycle or a page reload all
 * heal on their own.
 */
export default class Bridge {
  /**
   * First reconnect delay, in milliseconds.
   *
   * @constant {Number}
   */
  static INITIAL_RECONNECT_DELAY_MS = 500;

  /**
   * Reconnect delay ceiling, in milliseconds.
   *
   * @constant {Number}
   */
  static MAX_RECONNECT_DELAY_MS = 10000;

  /**
   * @param {Object} options bridge options
   * @param {Object} options.show reactive show handle -- MUST be reactive(ShowSingleton)
   * @param {String} options.url hub url, eg. `ws://127.0.0.1:5215`
   * @param {Function} [options.dispatchFn] registry dispatcher, injected by tests
   * @param {Function} [options.WebSocketImpl] WebSocket constructor, injected by tests
   * @param {Function} [options.setTimeoutFn] timer scheduler, injected by tests
   * @param {Function} [options.clearTimeoutFn] timer canceller, injected by tests
   * @param {Object} [options.logger] console-like logger
   */
  constructor({
    show,
    url,
    dispatchFn = dispatch,
    WebSocketImpl = globalThis.WebSocket,
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
    logger = console,
  }) {
    this.show = show;
    this.url = url;
    this.dispatchFn = dispatchFn;
    this.WebSocketImpl = WebSocketImpl;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.logger = logger;
    this.socket = null;
    this.reconnectTimer = null;
    this.reconnectDelay = Bridge.INITIAL_RECONNECT_DELAY_MS;
    this.stopped = false;
  }

  /**
   * @return {Boolean} whether the socket is open
   */
  get connected() {
    return Boolean(this.socket) && this.socket.readyState === READY_STATE_OPEN;
  }

  /**
   * Opens the socket, unless one already exists.
   *
   * @public
   */
  connect() {
    if (this.socket) {
      return;
    }
    this.stopped = false;
    const socket = new this.WebSocketImpl(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.reconnectDelay = Bridge.INITIAL_RECONNECT_DELAY_MS;
      // eslint-disable-next-line no-console
      this.logger.log(`[mcp-bridge] connected to ${this.url}`);
    };
    socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    socket.onerror = () => {
      // A close event always follows, which is where reconnection is handled.
      this.logger.warn(`[mcp-bridge] socket error on ${this.url}`);
    };
    socket.onclose = () => {
      this.socket = null;
      if (!this.stopped) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Closes the socket and cancels any pending reconnect.
   *
   * @public
   */
  disconnect() {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      this.clearTimeoutFn(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  }

  /**
   * Queues the next reconnect attempt and doubles the delay.
   *
   * @private
   */
  scheduleReconnect() {
    if (this.reconnectTimer !== null) {
      return;
    }
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(delay * 2, Bridge.MAX_RECONNECT_DELAY_MS);
    this.reconnectTimer = this.setTimeoutFn(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Writes an envelope to the hub, if the socket is still open.
   *
   * @param {Object} envelope response or notification envelope
   * @public
   */
  send(envelope) {
    if (!this.connected) {
      return;
    }
    this.socket.send(JSON.stringify(envelope));
  }

  /**
   * Handles one inbound payload.
   *
   * Unparseable payloads and response envelopes are ignored in silence -- the
   * app is the responder, never the requester.
   *
   * @param {String} raw payload as delivered by the socket
   * @return {Promise<void>}
   * @async
   * @public
   */
  async handleMessage(raw) {
    const message = parseMessage(raw);
    if (!message) {
      return;
    }
    if (message.type === MESSAGE_TYPES.DETACH) {
      this.logger.warn(`[mcp-bridge] detached by hub (${message.reason}); `
        + 'a newer Świetlik tab has taken over.');
      this.disconnect();
      return;
    }
    if (message.type !== MESSAGE_TYPES.REQUEST) {
      return;
    }
    if (!isRequest(message)) {
      if (typeof message.id === 'string') {
        this.send(makeError(
          message.id,
          ERROR_CODES.VALIDATION,
          `Unsupported protocol version ${message.v}; this app speaks version `
          + `${PROTOCOL_VERSION}.`,
        ));
      }
      return;
    }
    const response = await this.dispatchFn(this.show, message);
    this.send(response);
  }
}
```

- [ ] **Step 4: Run the bridge test**

Run: `npm run test:run -- test/mcp-bridge/bridge.spec.js`
Expected: PASS — 15 tests.

- [ ] **Step 5: Write the failing entry-point test**

Create `test/mcp-bridge/index.spec.js`:

```js
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [] })) },
}));

// eslint-disable-next-line import/first
import { reactive } from 'vue';
// eslint-disable-next-line import/first
import ShowSingleton from '@/singletons/show.singleton';
// eslint-disable-next-line import/first
import EventBus from '@/plugins/eventbus';
// eslint-disable-next-line import/first
import { startMcpBridge, stopMcpBridge, getActiveBridge } from '@/mcp-bridge';
// eslint-disable-next-line import/first
import { listCommands } from '@/mcp-bridge/commands';

/**
 * Inert WebSocket stand-in -- the entry point must never open a real socket in
 * a test run.
 *
 * @class NoopWebSocket
 */
class NoopWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    NoopWebSocket.instances.push(this);
  }

  // eslint-disable-next-line class-methods-use-this
  send() {}

  close() {
    this.readyState = 3;
  }
}

let originalWebSocket;

beforeEach(() => {
  NoopWebSocket.instances = [];
  originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = NoopWebSocket;
});

afterEach(() => {
  stopMcpBridge();
  globalThis.WebSocket = originalWebSocket;
});

describe('startMcpBridge -- enablement', () => {
  it('stays dormant outside dev unless explicitly enabled', () => {
    expect(startMcpBridge({ DEV: false })).toBeNull();
    expect(NoopWebSocket.instances).toHaveLength(0);
  });

  it('starts in a dev build', () => {
    const bridge = startMcpBridge({ DEV: true });
    expect(bridge).not.toBeNull();
    expect(NoopWebSocket.instances).toHaveLength(1);
  });

  it('can be forced on in a production build', () => {
    const bridge = startMcpBridge({ DEV: false, VITE_SWIETLIK_MCP: 'true' });
    expect(bridge).not.toBeNull();
  });

  it('can be forced off in a dev build', () => {
    expect(startMcpBridge({ DEV: true, VITE_SWIETLIK_MCP: 'false' })).toBeNull();
  });

  it('is idempotent -- a second call returns the same bridge', () => {
    const first = startMcpBridge({ DEV: true });
    const second = startMcpBridge({ DEV: true });
    expect(second).toBe(first);
    expect(NoopWebSocket.instances).toHaveLength(1);
  });
});

describe('startMcpBridge -- url and port', () => {
  it('connects to the default loopback port', () => {
    startMcpBridge({ DEV: true });
    expect(NoopWebSocket.instances[0].url).toBe('ws://127.0.0.1:5215');
  });

  it('honours VITE_SWIETLIK_MCP_PORT', () => {
    startMcpBridge({ DEV: true, VITE_SWIETLIK_MCP_PORT: '6123' });
    expect(NoopWebSocket.instances[0].url).toBe('ws://127.0.0.1:6123');
  });

  it('refuses to start on the DMX gateway port', () => {
    expect(startMcpBridge({ DEV: true, VITE_SWIETLIK_MCP_PORT: '5214' })).toBeNull();
    expect(NoopWebSocket.instances).toHaveLength(0);
  });
});

describe('REACTIVITY INVARIANT', () => {
  it('binds the bridge to the SAME reactive proxy main.js installs as $show', () => {
    const bridge = startMcpBridge({ DEV: true });

    // Vue's proxy cache dedups reactive() per target, so this identity check
    // proves the bridge mutates the object the UI renders from.
    expect(bridge.show).toBe(reactive(ShowSingleton));
  });

  it('does not hand the bridge the raw singleton', () => {
    const bridge = startMcpBridge({ DEV: true });
    expect(bridge.show).not.toBe(ShowSingleton);
  });
});

describe('command loading', () => {
  it('registers every command group by importing the entry point', () => {
    expect(listCommands()).toEqual([
      'add_fixtures_to_group',
      'create_chase',
      'create_effect',
      'create_group',
      'create_scene',
      'get_fixture',
      'get_show_state',
      'load_show',
      'master_row',
      'move_fixture',
      'new_show',
      'patch_fixture',
      'play_chase',
      'play_cue',
      'redo',
      'save_show',
      'screenshot_visualizer',
      'search_fixture_library',
      'set_bpm',
      'set_channels',
      'stop_all',
      'undo',
      'unpatch_fixture',
    ]);
  });
});

describe('app_ready hook', () => {
  it('starts the bridge when the app emits app_ready', () => {
    expect(getActiveBridge()).toBeNull();
    EventBus.emit('app_ready');
    expect(getActiveBridge()).not.toBeNull();
  });
});

describe('stopMcpBridge', () => {
  it('clears the active bridge so a later start creates a new one', () => {
    const first = startMcpBridge({ DEV: true });
    stopMcpBridge();
    expect(getActiveBridge()).toBeNull();
    const second = startMcpBridge({ DEV: true });
    expect(second).not.toBe(first);
  });
});
```

Note: the `app_ready` test relies on `import.meta.env.DEV` being true under Vitest, which it is — the listener calls `startMcpBridge()` with no argument.

- [ ] **Step 6: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp-bridge/index.spec.js`
Expected: FAIL — `Failed to resolve import "@/mcp-bridge"`.

- [ ] **Step 7: Implement the entry point**

Create `src/mcp-bridge/index.js`:

```js
import { reactive } from 'vue';
import ShowSingleton from '@/singletons/show.singleton';
import EventBus from '@/plugins/eventbus';
import { resolvePort } from '@root/mcp/protocol';
import Bridge from './bridge';
import './commands';

/**
 * MCP bridge entry point.
 *
 * Importing this module is the whole integration: it subscribes to the
 * existing `app_ready` EventBus event (emitted by `app.activity.vue` once the
 * show and the OFL fixture list are loaded) and starts the WebSocket bridge.
 *
 * @module mcp-bridge
 */

/**
 * The single live bridge, or null when the bridge is dormant.
 *
 * @type {Bridge|null}
 * @private
 */
let activeBridge = null;

/**
 * Decides whether the bridge should run at all.
 *
 * On by default in a dev build, off in a production build unless
 * `VITE_SWIETLIK_MCP=true`. `VITE_SWIETLIK_MCP=false` forces it off everywhere.
 *
 * @param {Object} env environment bag
 * @return {Boolean} whether to start
 * @private
 */
function isEnabled(env) {
  if (env.VITE_SWIETLIK_MCP === 'false') {
    return false;
  }
  return Boolean(env.DEV) || env.VITE_SWIETLIK_MCP === 'true';
}

/**
 * Starts the MCP bridge, if it is enabled and not already running.
 *
 * @param {Object} [env=import.meta.env] environment bag
 * @return {Bridge|null} the live bridge, or null when dormant
 * @public
 */
export function startMcpBridge(env = import.meta.env) {
  if (activeBridge) {
    return activeBridge;
  }
  if (!isEnabled(env)) {
    return null;
  }
  if (typeof globalThis.WebSocket !== 'function') {
    return null;
  }
  let port;
  try {
    port = resolvePort(env);
  } catch (err) {
    console.warn(`[mcp-bridge] not starting: ${err.message}`);
    return null;
  }

  // REACTIVITY INVARIANT: Vue's proxy cache returns the same proxy that
  // src/main.js installed as `$show`, so mutations made by a command render in
  // the UI and the visualizer immediately. Never pass the raw singleton.
  const show = reactive(ShowSingleton);

  activeBridge = new Bridge({ show, url: `ws://127.0.0.1:${port}` });
  activeBridge.connect();
  return activeBridge;
}

/**
 * Stops and clears the bridge.
 *
 * @public
 */
export function stopMcpBridge() {
  if (activeBridge) {
    activeBridge.disconnect();
    activeBridge = null;
  }
}

/**
 * @return {Bridge|null} the live bridge, or null
 * @public
 */
export function getActiveBridge() {
  return activeBridge;
}

EventBus.on('app_ready', () => {
  startMcpBridge();
});
```

- [ ] **Step 8: Run the entry-point test**

Run: `npm run test:run -- test/mcp-bridge/index.spec.js`
Expected: PASS — 13 tests. The `command loading` test doubles as the proof that the `import.meta.glob` loader picked up all five command modules — if a name is missing, the glob or a file name is wrong.

- [ ] **Step 9: Make the single upstream edit**

Modify `src/App.vue`. The `<script>` block currently opens with one import; add the bridge import immediately after it:

```js
import AppActivity from './views/activities/app/app.activity.vue';
// Świetlik fork: starts the MCP command bridge on the existing `app_ready`
// EventBus event. Side-effect import only -- see docs/swietlik/upstream-diff.md.
import '@/mcp-bridge';
```

Nothing else in `App.vue` changes. This is the only upstream file this plan is permitted to touch.

- [ ] **Step 10: Log the edit in the divergence ledger**

Modify `docs/swietlik/upstream-diff.md`. In §"Modified upstream files" → "### Application source", add this row to the end of the table:

```markdown
| `src/App.vue` | Phase 1 MCP bridge: one side-effect import (`import '@/mcp-bridge';`) that subscribes the bridge to the existing `app_ready` EventBus event. Chosen over `app.activity.vue` because it is the smaller diff — three lines, no change to any existing statement. |
```

Also bump the section heading count from `## Modified upstream files (20)` to `## Modified upstream files (21)`.

- [ ] **Step 11: Verify the app still builds and nothing regressed**

Run: `npm run test:run && npm run lint:ci && npm run build`
Expected: all tests pass; ESLint 0 errors; `vite build` completes. The build is the check that `@root/mcp/protocol` resolves outside the test config too.

- [ ] **Step 12: Commit**

```bash
git add src/mcp-bridge/bridge.js src/mcp-bridge/index.js src/App.vue docs/swietlik/upstream-diff.md test/mcp-bridge/bridge.spec.js test/mcp-bridge/index.spec.js
git commit -m "feat(mcp): add in-app WebSocket bridge and app_ready hook

Bridge reconnects with exponential backoff, answers request envelopes via
the command registry and detaches when a newer tab supersedes it. The
bridge is bound to reactive(ShowSingleton) -- the same proxy main.js
installs as \$show -- so external mutations render immediately.

One upstream line added to src/App.vue, logged in the divergence ledger.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: MCP server, WebSocket hub and tool catalogue

**Files:**
- Modify: `package.json` (add `@modelcontextprotocol/sdk` + `ws` to `devDependencies`, add the `mcp` script)
- Create: `mcp/tools.js`
- Create: `mcp/hub.js`
- Create: `mcp/server.js`
- Test: `test/mcp/hub.spec.js`
- Test: `test/mcp/server.spec.js`

**Interfaces:**
- Consumes: everything `mcp/protocol.js` exports (Task 1). **Nothing from `src/`** — this task talks the envelope to a scripted fake app and never needs a browser.
- Produces `mcp/tools.js`:
  - `TOOLS: Array<{ name, description, inputSchema }>` — one entry per registry command, JSON Schema draft-07 shaped, `additionalProperties: false` everywhere (the in-app validator is strict, so the schema must be too).
  - `TOOL_NAMES: Array<String>` — sorted tool names.
- Produces `mcp/hub.js`:
  - `class HubError extends Error` with `.code`
  - `default class AppHub`: `constructor({ port?, host?, timeoutMs?, logger? })`, `start() -> Promise<number>`, `stop() -> Promise<void>`, `call(cmd, args?) -> Promise<any>`, getters `connected`, `port`.
- Produces `mcp/server.js`:
  - `createServer(hub) -> Server` (the MCP `Server` with both request handlers installed)
  - `main() -> Promise<void>` (starts the hub, connects stdio; runs only when the file is executed directly)

**Testing environment note:** both spec files start with `// @vitest-environment node` so they run under Node instead of jsdom, inside the **existing** `vitest.config.mjs` (its `include` is already `test/**/*.spec.js`). No second config file, no second npm script.

- [ ] **Step 1: Install the two dependencies and add the script**

Run:

```bash
npm install --save-dev @modelcontextprotocol/sdk ws
```

Expect and ignore the `EBADENGINE` warning from `@asls/wsc-client` (documented in CLAUDE.md §3). Then confirm `package.json` gained entries at or above these floors — if npm resolved higher, keep what it resolved:

```json
    "@modelcontextprotocol/sdk": "^1.12.0",
    "ws": "^8.18.0",
```

Both go in `devDependencies`: the MCP server is developer tooling and is never bundled into the app.

Add the run script to `package.json` `scripts`, immediately after `"lint:ci"`:

```json
    "mcp": "node mcp/server.js",
```

- [ ] **Step 2: Write the tool catalogue**

Create `mcp/tools.js`:

```js
/**
 * MCP tool catalogue.
 *
 * One entry per command registered by `src/mcp-bridge/commands/*.commands.js`.
 * Names, argument names and required-ness MUST match the in-app registry
 * exactly -- `test/mcp/tool-parity.spec.js` fails the build if they drift.
 *
 * `additionalProperties: false` everywhere, because the in-app validator
 * rejects unknown arguments rather than ignoring them.
 *
 * @module mcp/tools
 */

/**
 * Reusable 3D vector schema (metres for positions, degrees for rotations).
 *
 * @constant {Object}
 * @private
 */
const VEC3 = {
  type: 'object',
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    z: { type: 'number' },
  },
  required: ['x', 'y', 'z'],
  additionalProperties: false,
};

/**
 * Builds an object input schema.
 *
 * @param {Object} properties JSON Schema properties map
 * @param {Array<String>} [required=[]] required property names
 * @return {Object} JSON Schema object
 * @private
 */
function schema(properties, required = []) {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * Shared cue-creation properties for create_scene and create_effect.
 *
 * @constant {Object}
 * @private
 */
const CUE_PROPERTIES = {
  group_id: { type: 'integer', minimum: 0, description: 'Target group id.' },
  name: { type: 'string', description: 'Cue name. Defaults to "Cue <id>".' },
  color: { type: 'string', description: 'Hex colour, eg. "#ff8800".' },
  duration: {
    type: 'number', minimum: 0, default: 1, description: 'Duration in beats.',
  },
  trigger_style: {
    type: 'integer', enum: [0, 1], default: 0, description: '0 toggle, 1 temporary.',
  },
  loop_style: {
    type: 'integer', enum: [0, 1], default: 0, description: '0 one-shot, 1 loop.',
  },
  relative: {
    type: 'integer',
    enum: [0, 1],
    default: 0,
    description: '1 makes the cue start from the current live values.',
  },
};

/**
 * Every MCP tool exposed by the Świetlik server.
 *
 * @constant {Array<Object>}
 */
export const TOOLS = [
  {
    name: 'get_show_state',
    description: 'Compact summary of the whole show: name, BPM, save state, '
      + 'universes, patched fixtures and groups with their cues and chases. '
      + 'Start here to orient yourself.',
    inputSchema: schema({}),
  },
  {
    name: 'get_fixture',
    description: 'Full detail for one patched fixture: addressing, 3D position '
      + 'and rotation, available quick accessors and every channel value.',
    inputSchema: schema({
      id: { type: 'integer', minimum: 0, description: 'Fixture id from get_show_state.' },
    }, ['id']),
  },
  {
    name: 'search_fixture_library',
    description: 'Search the bundled Open Fixture Library (~190 manufacturers) '
      + 'by manufacturer or model substring. Returns manufacturer/model pairs '
      + 'ready to pass to patch_fixture.',
    inputSchema: schema({
      query: { type: 'string', description: 'Case-insensitive substring.' },
      limit: {
        type: 'integer', minimum: 1, maximum: 100, default: 20,
      },
    }, ['query']),
  },
  {
    name: 'patch_fixture',
    description: 'Patch a fixture from the Open Fixture Library into a universe. '
      + 'Fetches the OFL definition, builds the fixture and auto-addresses it '
      + 'unless ch_start is given.',
    inputSchema: schema({
      manufacturer: { type: 'string', description: 'OFL manufacturer folder, eg. "clay-paky".' },
      model: { type: 'string', description: 'OFL model name, eg. "sharpy".' },
      mode: { type: 'string', description: 'OFL mode name. Defaults to the first mode.' },
      name: { type: 'string', description: 'Display name for this fixture.' },
      universe: { type: 'integer', minimum: 0, default: 0 },
      ch_start: {
        type: 'integer',
        minimum: 0,
        maximum: 511,
        description: 'Explicit universe address slot. Omit to auto-address.',
      },
      position: { ...VEC3, description: 'Position in metres (Z is up).' },
      rotation: { ...VEC3, description: 'Rotation in degrees.' },
    }, ['manufacturer', 'model']),
  },
  {
    name: 'unpatch_fixture',
    description: 'Remove a fixture from its universe and from the show, freeing '
      + 'its DMX address range.',
    inputSchema: schema({
      id: { type: 'integer', minimum: 0 },
    }, ['id']),
  },
  {
    name: 'move_fixture',
    description: 'Set a patched fixture position (metres, Z up) and/or rotation '
      + '(degrees) in the 3D visualizer. At least one of the two is required.',
    inputSchema: schema({
      id: { type: 'integer', minimum: 0 },
      position: VEC3,
      rotation: VEC3,
    }, ['id']),
  },
  {
    name: 'set_channels',
    description: 'Set DMX values on one or more fixtures, either by '
      + 'fixture-relative channel index or by named quick accessor (Dimmer, '
      + 'Pan, Tilt, Zoom, Color, ...). Accessors a fixture lacks are reported '
      + 'as skipped rather than failing the call.',
    inputSchema: schema({
      fixture_ids: {
        type: 'array',
        minItems: 1,
        items: { type: 'integer', minimum: 0 },
      },
      channels: {
        type: 'array',
        description: 'Raw channel writes. index is 0-based and fixture-relative.',
        items: schema({
          index: { type: 'integer', minimum: 0 },
          value: { type: 'integer', minimum: 0, maximum: 255 },
        }, ['index', 'value']),
      },
      accessors: {
        type: 'array',
        description: 'Named quick-accessor writes.',
        items: schema({
          type: { type: 'string', description: 'Accessor name, eg. "Dimmer", "Pan".' },
          value: { type: 'integer', minimum: 0, maximum: 255 },
          index: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Which accessor of that type, for fixtures with several.',
          },
        }, ['type', 'value']),
      },
    }, ['fixture_ids']),
  },
  {
    name: 'create_group',
    description: 'Create an empty fixture group. Groups own the cues and chases '
      + 'that drive their fixtures.',
    inputSchema: schema({
      name: { type: 'string' },
      color: { type: 'string', description: 'Hex colour, eg. "#00ccff".' },
    }, ['name']),
  },
  {
    name: 'add_fixtures_to_group',
    description: 'Add patched fixtures to an existing group. Cues already in the '
      + 'group pick the new fixtures up automatically.',
    inputSchema: schema({
      group_id: { type: 'integer', minimum: 0 },
      fixture_ids: {
        type: 'array',
        minItems: 1,
        items: { type: 'integer', minimum: 0 },
      },
    }, ['group_id', 'fixture_ids']),
  },
  {
    name: 'create_scene',
    description: 'Create a scene cue (a static look that fades in over its '
      + 'duration) on a group. The group fixtures are injected automatically.',
    inputSchema: schema(CUE_PROPERTIES, ['group_id']),
  },
  {
    name: 'create_effect',
    description: 'Create an effect cue (a time-varying modulation) on a group. '
      + 'The group fixtures are injected automatically.',
    inputSchema: schema(CUE_PROPERTIES, ['group_id']),
  },
  {
    name: 'create_chase',
    description: 'Create a chase on a group -- a sequence of its cues triggered '
      + 'over time. Without cue_ids the chase takes every cue in the group.',
    inputSchema: schema({
      group_id: { type: 'integer', minimum: 0 },
      name: { type: 'string' },
      grid_index: {
        type: 'integer',
        minimum: 0,
        description: 'Column in the master grid.',
      },
      color: { type: 'string' },
      duration: { type: 'number', minimum: 0, default: 1 },
      trigger: {
        type: 'integer', enum: [0, 1], default: 0, description: '0 loop, 1 one-shot.',
      },
      cue_ids: {
        type: 'array',
        items: { type: 'integer', minimum: 0 },
      },
    }, ['group_id']),
  },
  {
    name: 'play_cue',
    description: 'Start or stop a single cue on a group.',
    inputSchema: schema({
      group_id: { type: 'integer', minimum: 0 },
      cue_id: { type: 'integer', minimum: 0 },
      state: { type: 'boolean', default: true },
    }, ['group_id', 'cue_id']),
  },
  {
    name: 'play_chase',
    description: 'Start or stop a chase on a group. Starting one stops the other '
      + 'chases in the same group.',
    inputSchema: schema({
      group_id: { type: 'integer', minimum: 0 },
      chase_id: { type: 'integer', minimum: 0 },
      state: { type: 'boolean', default: true },
    }, ['group_id', 'chase_id']),
  },
  {
    name: 'stop_all',
    description: 'Panic stop: stop every chase and every cue in every group and '
      + 'clear the master playing row.',
    inputSchema: schema({}),
  },
  {
    name: 'master_row',
    description: 'Trigger a master chase row across every group -- the '
      + 'equivalent of pressing a row button on the master grid. Toggles off '
      + 'when that row is already playing.',
    inputSchema: schema({
      row: { type: 'integer', minimum: 0 },
    }, ['row']),
  },
  {
    name: 'set_bpm',
    description: 'Set the show tempo in beats per minute (20-400). Drives every '
      + 'beat-quantised cue and chase.',
    inputSchema: schema({
      bpm: { type: 'number', minimum: 20, maximum: 400 },
    }, ['bpm']),
  },
  {
    name: 'new_show',
    description: 'Discard the current show and start a blank one with a single '
      + 'empty universe. Autosaves immediately -- this is destructive.',
    inputSchema: schema({}),
  },
  {
    name: 'save_show',
    description: 'Autosave the current show to browser localStorage and report '
      + 'the serialised size.',
    inputSchema: schema({}),
  },
  {
    name: 'load_show',
    description: 'Replace the current show, either from an inline showfile '
      + 'object or from the browser autosave. Exactly one source is required.',
    inputSchema: schema({
      data: {
        type: 'object',
        description: 'Showfile object: name, bpm, visualizer, fixtures, '
          + 'universes, groups, outputs.',
      },
      from_local_storage: { type: 'boolean', default: false },
    }),
  },
  {
    name: 'undo',
    description: 'Undo the last tracked show mutation.',
    inputSchema: schema({}),
  },
  {
    name: 'redo',
    description: 'Redo the last undone show mutation.',
    inputSchema: schema({}),
  },
  {
    name: 'screenshot_visualizer',
    description: 'Capture the 3D visualizer viewport as an image and return it '
      + 'as MCP image content. Use this to SEE the rig after changing it.',
    inputSchema: schema({
      mime_type: {
        type: 'string',
        enum: ['image/png', 'image/jpeg'],
        default: 'image/png',
      },
    }),
  },
];

/**
 * Sorted tool names.
 *
 * @constant {Array<String>}
 */
export const TOOL_NAMES = TOOLS.map((tool) => tool.name).sort();
```

- [ ] **Step 3: Write the failing hub test**

Create `test/mcp/hub.spec.js`:

```js
// @vitest-environment node
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import WebSocket from 'ws';
import AppHub, { HubError } from '@root/mcp/hub';
import {
  makeSuccess,
  makeError,
  parseMessage,
  isRequest,
  MESSAGE_TYPES,
} from '@root/mcp/protocol';

/**
 * Silent logger so the test output stays readable.
 *
 * @constant {Object}
 */
const QUIET = { log: () => {}, warn: () => {}, error: () => {} };

let hub;
const sockets = [];

/**
 * Connects a scripted fake app to the hub.
 *
 * @param {Function} onRequest `(request) => responseEnvelope | null` -- return
 *   null to stay silent (used for the timeout test)
 * @return {Promise<WebSocket>} the open client socket
 */
function connectFakeApp(onRequest) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${hub.port}`);
    sockets.push(socket);
    socket.on('message', (raw) => {
      const message = parseMessage(raw);
      if (!isRequest(message)) {
        return;
      }
      const response = onRequest(message);
      if (response) {
        socket.send(JSON.stringify(response));
      }
    });
    socket.on('open', () => resolve(socket));
    socket.on('error', reject);
  });
}

/**
 * Waits until the hub reports a connected app.
 *
 * @return {Promise<void>}
 */
async function waitForAttach() {
  for (let i = 0; i < 200; i++) {
    if (hub.connected) {
      return;
    }
    await new Promise((resolve) => { setTimeout(resolve, 5); });
  }
  throw new Error('hub never attached an app socket');
}

beforeEach(async () => {
  hub = new AppHub({ port: 0, timeoutMs: 300, logger: QUIET });
  await hub.start();
});

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.terminate());
  await hub.stop();
});

describe('AppHub -- lifecycle', () => {
  it('binds an ephemeral port when asked for port 0', () => {
    expect(hub.port).toBeGreaterThan(0);
  });

  it('starts with no app connected', () => {
    expect(hub.connected).toBe(false);
  });

  it('reports connected once an app attaches', async () => {
    await connectFakeApp(() => null);
    await waitForAttach();
    expect(hub.connected).toBe(true);
  });

  it('start() is idempotent and returns the bound port', async () => {
    const port = await hub.start();
    expect(port).toBe(hub.port);
  });
});

describe('AppHub -- call', () => {
  it('rejects with APP_NOT_CONNECTED and a remedy when no app is attached', async () => {
    await expect(hub.call('get_show_state')).rejects.toMatchObject({
      code: 'APP_NOT_CONNECTED',
    });
    await expect(hub.call('get_show_state')).rejects.toThrow(/localhost:5173/);
  });

  it('round-trips a command and returns the result payload', async () => {
    await connectFakeApp((request) => makeSuccess(request.id, { cmd: request.cmd, args: request.args }));
    await waitForAttach();

    await expect(hub.call('set_bpm', { bpm: 128 })).resolves.toEqual({
      cmd: 'set_bpm',
      args: { bpm: 128 },
    });
  });

  it('defaults args to an empty object', async () => {
    await connectFakeApp((request) => makeSuccess(request.id, request.args));
    await waitForAttach();
    await expect(hub.call('stop_all')).resolves.toEqual({});
  });

  it('sends a well-formed request envelope with a correlation id', async () => {
    const seen = [];
    await connectFakeApp((request) => {
      seen.push(request);
      return makeSuccess(request.id, null);
    });
    await waitForAttach();

    await hub.call('undo');
    await hub.call('redo');

    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ v: 1, type: MESSAGE_TYPES.REQUEST, cmd: 'undo' });
    expect(seen[0].id).not.toBe(seen[1].id);
  });

  it('turns an error envelope into a HubError carrying its code', async () => {
    await connectFakeApp((request) => makeError(request.id, 'COMMAND_ERROR', 'set_bpm: nope'));
    await waitForAttach();

    const rejection = await hub.call('set_bpm', { bpm: 1 }).catch((err) => err);
    expect(rejection).toBeInstanceOf(HubError);
    expect(rejection.code).toBe('COMMAND_ERROR');
    expect(rejection.message).toBe('set_bpm: nope');
  });

  it('times out when the app never answers', async () => {
    await connectFakeApp(() => null);
    await waitForAttach();

    const rejection = await hub.call('undo').catch((err) => err);
    expect(rejection.code).toBe('TIMEOUT');
    expect(rejection.message).toContain('300');
  });

  it('runs two calls concurrently, matching answers by id', async () => {
    await connectFakeApp((request) => makeSuccess(request.id, request.cmd));
    await waitForAttach();

    await expect(Promise.all([hub.call('undo'), hub.call('redo')]))
      .resolves.toEqual(['undo', 'redo']);
  });
});

describe('AppHub -- newest tab wins', () => {
  it('detaches the older socket and routes traffic to the newer one', async () => {
    const detachNotices = [];
    const first = await connectFakeApp(() => null);
    first.on('message', (raw) => {
      const message = parseMessage(raw);
      if (message && message.type === MESSAGE_TYPES.DETACH) {
        detachNotices.push(message);
      }
    });
    await waitForAttach();

    await connectFakeApp((request) => makeSuccess(request.id, 'from-second-tab'));
    await new Promise((resolve) => { setTimeout(resolve, 50); });

    await expect(hub.call('get_show_state')).resolves.toBe('from-second-tab');
    expect(detachNotices).toHaveLength(1);
    expect(detachNotices[0].reason).toBe('superseded');
  });

  it('ignores late answers from a superseded socket', async () => {
    const first = await connectFakeApp(() => null);
    await waitForAttach();
    await connectFakeApp((request) => makeSuccess(request.id, 'second'));
    await new Promise((resolve) => { setTimeout(resolve, 50); });

    // The superseded socket replies to an id it invented; the hub must not care.
    first.send(JSON.stringify(makeSuccess('r0', 'stale')));

    await expect(hub.call('undo')).resolves.toBe('second');
  });
});

describe('AppHub -- stop', () => {
  it('rejects in-flight calls and stops accepting new ones', async () => {
    await connectFakeApp(() => null);
    await waitForAttach();

    const pending = hub.call('undo').catch((err) => err);
    await hub.stop();

    const rejection = await pending;
    expect(rejection.code).toBe('APP_NOT_CONNECTED');
    await expect(hub.call('undo')).rejects.toMatchObject({ code: 'APP_NOT_CONNECTED' });
  });
});
```

- [ ] **Step 4: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp/hub.spec.js`
Expected: FAIL — `Failed to resolve import "@root/mcp/hub"`.

- [ ] **Step 5: Implement the hub**

Create `mcp/hub.js`:

```js
import { WebSocketServer } from 'ws';
import {
  COMMAND_TIMEOUT_MS,
  DEFAULT_MCP_PORT,
  ERROR_CODES,
  APP_NOT_CONNECTED_REMEDY,
  MESSAGE_TYPES,
  makeRequest,
  makeDetach,
  parseMessage,
  isResponse,
} from './protocol.js';

/**
 * WebSocket OPEN ready state.
 *
 * @constant {Number}
 */
const READY_STATE_OPEN = 1;

/**
 * Close code sent to a socket that a newer tab has superseded.
 *
 * @constant {Number}
 */
const CLOSE_SUPERSEDED = 4000;

/**
 * @class HubError
 * @classdesc Error carrying one of the protocol error codes, so the MCP layer
 * can pass the code straight through to the caller.
 * @extends {Error}
 */
export class HubError extends Error {
  /**
   * @param {String} code one of ERROR_CODES
   * @param {String} message human-readable explanation
   */
  constructor(code, message) {
    super(message);
    this.name = 'HubError';
    this.code = code;
  }
}

/**
 * @class AppHub
 * @classdesc WebSocket server the Świetlik app connects back to. Holds exactly
 * one active app socket -- a newer tab supersedes the older one, which is told
 * to detach -- and correlates request/response pairs by id with a deadline.
 */
export default class AppHub {
  /**
   * @param {Object} [options={}] hub options
   * @param {Number} [options.port=DEFAULT_MCP_PORT] port to bind; 0 picks a free one
   * @param {String} [options.host='127.0.0.1'] interface to bind (loopback only)
   * @param {Number} [options.timeoutMs=COMMAND_TIMEOUT_MS] per-command deadline
   * @param {Object} [options.logger=console] console-like logger; MUST NOT write
   *   to stdout, which belongs to the MCP stdio transport
   */
  constructor({
    port = DEFAULT_MCP_PORT,
    host = '127.0.0.1',
    timeoutMs = COMMAND_TIMEOUT_MS,
    logger = console,
  } = {}) {
    this.requestedPort = port;
    this.host = host;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
    this.server = null;
    this.socket = null;
    this.boundPort = null;
    this.pending = new Map();
    this.nextId = 1;
  }

  /**
   * @return {Boolean} whether an app socket is attached and open
   */
  get connected() {
    return Boolean(this.socket) && this.socket.readyState === READY_STATE_OPEN;
  }

  /**
   * @return {Number|null} the bound port, once started
   */
  get port() {
    return this.boundPort;
  }

  /**
   * Starts listening. Idempotent.
   *
   * @return {Promise<Number>} the bound port
   * @async
   */
  async start() {
    if (this.server) {
      return this.boundPort;
    }
    const server = new WebSocketServer({ host: this.host, port: this.requestedPort });
    await new Promise((resolve, reject) => {
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      const onError = (err) => {
        server.off('listening', onListening);
        reject(err);
      };
      server.once('listening', onListening);
      server.once('error', onError);
    });
    this.server = server;
    this.boundPort = server.address().port;
    server.on('connection', (socket) => this.attach(socket));
    server.on('error', (err) => {
      this.logger.error(`[swietlik-mcp] hub error: ${err.message}`);
    });
    return this.boundPort;
  }

  /**
   * Adopts a new app socket, superseding any existing one.
   *
   * @param {Object} socket ws socket
   * @private
   */
  attach(socket) {
    const previous = this.socket;
    if (previous && previous !== socket) {
      this.socket = null;
      try {
        previous.send(JSON.stringify(makeDetach('superseded')));
      } catch (err) {
        // The old tab may already be gone; nothing to do.
      }
      previous.close(CLOSE_SUPERSEDED, 'superseded');
      this.logger.warn('[swietlik-mcp] a newer Świetlik tab took over the bridge');
    }
    this.socket = socket;
    this.logger.log('[swietlik-mcp] Świetlik app connected');
    socket.on('message', (raw) => this.handleMessage(socket, raw));
    socket.on('close', () => {
      if (this.socket === socket) {
        this.socket = null;
        this.logger.warn('[swietlik-mcp] Świetlik app disconnected');
      }
    });
    socket.on('error', () => {
      // A close event always follows.
    });
  }

  /**
   * Resolves or rejects the pending call a response belongs to.
   *
   * @param {Object} socket the socket the payload arrived on
   * @param {String|Buffer} raw payload
   * @private
   */
  handleMessage(socket, raw) {
    if (socket !== this.socket) {
      return;
    }
    const message = parseMessage(raw);
    if (!isResponse(message)) {
      return;
    }
    const entry = this.pending.get(message.id);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    this.pending.delete(message.id);
    if (message.ok) {
      entry.resolve(message.result);
    } else {
      entry.reject(new HubError(message.error.code, message.error.message));
    }
  }

  /**
   * Sends a command to the connected app and awaits its answer.
   *
   * @param {String} cmd command name
   * @param {Object} [args={}] command arguments
   * @return {Promise<*>} the command result
   * @throws {HubError} APP_NOT_CONNECTED, TIMEOUT, or whatever the app reported
   * @async
   */
  async call(cmd, args = {}) {
    if (!this.connected) {
      throw new HubError(ERROR_CODES.APP_NOT_CONNECTED, APP_NOT_CONNECTED_REMEDY);
    }
    const id = `r${this.nextId}`;
    this.nextId += 1;
    const payload = JSON.stringify(makeRequest(id, cmd, args));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new HubError(
          ERROR_CODES.TIMEOUT,
          `Command "${cmd}" timed out after ${this.timeoutMs} ms. The app may be `
          + 'busy loading or the tab may be in the background.',
        ));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(payload);
    });
  }

  /**
   * Rejects every in-flight call, drops the app socket and closes the server.
   *
   * @return {Promise<void>}
   * @async
   */
  async stop() {
    this.pending.forEach((entry) => {
      clearTimeout(entry.timer);
      entry.reject(new HubError(ERROR_CODES.APP_NOT_CONNECTED, 'The MCP hub was stopped.'));
    });
    this.pending.clear();
    this.socket = null;
    const server = this.server;
    this.server = null;
    if (!server) {
      return;
    }
    server.clients.forEach((client) => client.terminate());
    await new Promise((resolve) => { server.close(resolve); });
  }
}

/**
 * Re-exported so callers can discriminate detach notices without importing the
 * protocol module separately.
 */
export { MESSAGE_TYPES };
```

- [ ] **Step 6: Run the hub test**

Run: `npm run test:run -- test/mcp/hub.spec.js`
Expected: PASS — 14 tests.

- [ ] **Step 7: Write the failing server integration test**

Create `test/mcp/server.spec.js`:

```js
// @vitest-environment node
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TOOL_NAMES } from '@root/mcp/tools';
import { makeSuccess, makeError, parseMessage, isRequest } from '@root/mcp/protocol';

/**
 * Absolute path to the server entry point.
 *
 * @constant {String}
 */
const SERVER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'mcp',
  'server.js',
);

/**
 * Asks the OS for a free TCP port.
 *
 * @return {Promise<Number>} a port nobody is listening on
 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

let client;
let transport;
let port;
const sockets = [];

/**
 * Connects a scripted fake Świetlik app to the server hub.
 *
 * @param {Function} onRequest `(request) => responseEnvelope | null`
 * @return {Promise<WebSocket>} the open client socket
 */
function connectFakeApp(onRequest) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    sockets.push(socket);
    socket.on('message', (raw) => {
      const message = parseMessage(raw);
      if (!isRequest(message)) {
        return;
      }
      const response = onRequest(message);
      if (response) {
        socket.send(JSON.stringify(response));
      }
    });
    socket.on('open', () => resolve(socket));
    socket.on('error', reject);
  });
}

beforeEach(async () => {
  port = await findFreePort();
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_PATH],
    env: { ...process.env, SWIETLIK_MCP_PORT: String(port) },
    stderr: 'ignore',
  });
  client = new Client({ name: 'swietlik-test', version: '0.0.0' });
  await client.connect(transport);
}, 30000);

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.terminate());
  await client.close();
}, 30000);

describe('MCP server -- tool surface', () => {
  it('advertises every tool from the catalogue', async () => {
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
  }, 30000);

  it('gives every tool a description and an object input schema', async () => {
    const listed = await client.listTools();
    listed.tools.forEach((tool) => {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe('object');
    });
  }, 30000);
});

describe('MCP server -- no app connected', () => {
  it('returns a structured APP_NOT_CONNECTED error with a remedy', async () => {
    const res = await client.callTool({ name: 'get_show_state', arguments: {} });

    expect(res.isError).toBe(true);
    const payload = JSON.parse(res.content[0].text);
    expect(payload.code).toBe('APP_NOT_CONNECTED');
    expect(payload.message).toContain('localhost:5173');
  }, 30000);
});

describe('MCP server -- with a connected app', () => {
  it('round-trips a query tool end to end', async () => {
    await connectFakeApp((request) => makeSuccess(request.id, {
      name: 'fake_show', bpm: 128, fixtureCount: 2,
    }));
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const res = await client.callTool({ name: 'get_show_state', arguments: {} });

    expect(res.isError).toBeFalsy();
    expect(JSON.parse(res.content[0].text)).toEqual({
      name: 'fake_show', bpm: 128, fixtureCount: 2,
    });
  }, 30000);

  it('forwards tool arguments verbatim to the app', async () => {
    const seen = [];
    await connectFakeApp((request) => {
      seen.push(request);
      return makeSuccess(request.id, { ok: true });
    });
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    await client.callTool({
      name: 'patch_fixture',
      arguments: { manufacturer: 'clay-paky', model: 'sharpy', universe: 0 },
    });

    expect(seen[0].cmd).toBe('patch_fixture');
    expect(seen[0].args).toEqual({ manufacturer: 'clay-paky', model: 'sharpy', universe: 0 });
  }, 30000);

  it('returns image content for screenshot_visualizer', async () => {
    await connectFakeApp((request) => makeSuccess(request.id, {
      mimeType: 'image/png',
      width: 1280,
      height: 720,
      dataBase64: 'UE5HREFUQQ==',
    }));
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const res = await client.callTool({ name: 'screenshot_visualizer', arguments: {} });

    expect(res.content[0]).toEqual({
      type: 'image',
      data: 'UE5HREFUQQ==',
      mimeType: 'image/png',
    });
    expect(res.content[1].text).toContain('1280x720');
  }, 30000);

  it('surfaces an app-side command error as an MCP tool error', async () => {
    await connectFakeApp((request) => makeError(
      request.id,
      'COMMAND_ERROR',
      'patch_fixture: Cannot patch fixture on this interval',
    ));
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const res = await client.callTool({
      name: 'patch_fixture',
      arguments: { manufacturer: 'clay-paky', model: 'sharpy' },
    });

    expect(res.isError).toBe(true);
    const payload = JSON.parse(res.content[0].text);
    expect(payload.code).toBe('COMMAND_ERROR');
    expect(payload.message).toContain('Cannot patch fixture on this interval');
  }, 30000);
});
```

- [ ] **Step 8: Run it to confirm the failure**

Run: `npm run test:run -- test/mcp/server.spec.js`
Expected: FAIL — the child process exits because `mcp/server.js` does not exist.

- [ ] **Step 9: Implement the MCP server**

Create `mcp/server.js`:

```js
#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import AppHub, { HubError } from './hub.js';
import { TOOLS, TOOL_NAMES } from './tools.js';
import { ERROR_CODES, resolvePort } from './protocol.js';

/**
 * Świetlik MCP server.
 *
 * Exposes the in-app command registry as MCP tools. Tool call -> JSON request
 * over the WebSocket hub -> the connected Świetlik tab executes it against
 * `reactive(ShowSingleton)` -> response -> MCP result.
 *
 * stdout belongs to the stdio transport: every log line goes to stderr.
 *
 * @module mcp/server
 */

/**
 * Logger that keeps stdout clean for the MCP transport.
 *
 * @constant {Object}
 */
const stderrLogger = {
  log: (...args) => console.error(...args),
  warn: (...args) => console.error(...args),
  error: (...args) => console.error(...args),
};

/**
 * Formats a successful command result as MCP tool content.
 *
 * @param {String} name tool name
 * @param {*} result command result payload
 * @return {Object} MCP tool result
 * @private
 */
function toolResult(name, result) {
  if (name === 'screenshot_visualizer' && result && result.dataBase64) {
    return {
      content: [
        { type: 'image', data: result.dataBase64, mimeType: result.mimeType },
        {
          type: 'text',
          text: `Visualizer capture ${result.width}x${result.height} (${result.mimeType}).`,
        },
      ],
    };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}

/**
 * Formats a failure as an MCP tool error, preserving the structured code.
 *
 * @param {Error} err thrown error, usually a HubError
 * @return {Object} MCP tool result with isError set
 * @private
 */
function toolError(err) {
  const code = err instanceof HubError ? err.code : ERROR_CODES.COMMAND_ERROR;
  return {
    isError: true,
    content: [{
      type: 'text',
      text: JSON.stringify({ code, message: err.message }, null, 2),
    }],
  };
}

/**
 * Builds the MCP server around a hub.
 *
 * @param {AppHub} hub the WebSocket hub to forward calls to
 * @return {Server} configured MCP server
 * @public
 */
export function createServer(hub) {
  const server = new Server(
    { name: 'swietlik', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = request.params.arguments || {};
    if (!TOOL_NAMES.includes(name)) {
      return toolError(new HubError(
        ERROR_CODES.UNKNOWN_COMMAND,
        `Unknown tool "${name}". Available: ${TOOL_NAMES.join(', ')}`,
      ));
    }
    try {
      return toolResult(name, await hub.call(name, args));
    } catch (err) {
      return toolError(err);
    }
  });

  return server;
}

/**
 * Starts the hub and the stdio MCP server.
 *
 * @return {Promise<void>}
 * @async
 * @public
 */
export async function main() {
  const port = resolvePort(process.env);
  const hub = new AppHub({ port, logger: stderrLogger });
  await hub.start();
  stderrLogger.log(`[swietlik-mcp] hub listening on ws://127.0.0.1:${hub.port}`);

  const server = createServer(hub);
  await server.connect(new StdioServerTransport());

  const shutdown = async () => {
    await hub.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run only when executed directly -- importing this file from a test must not
// bind a port.
const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main().catch((err) => {
    stderrLogger.error(`[swietlik-mcp] fatal: ${err.message}`);
    process.exit(1);
  });
}
```

- [ ] **Step 10: Run the server integration test**

Run: `npm run test:run -- test/mcp/server.spec.js`
Expected: PASS — 7 tests. If the SDK rejects the import paths, check the installed version's `exports` map (`node -e "console.log(require('@modelcontextprotocol/sdk/package.json').exports)"`) and adjust the three subpath imports; the low-level `Server` + `setRequestHandler` API is what this plan depends on, not `McpServer`.

- [ ] **Step 11: Verify the server starts by hand**

Run: `npm run mcp`
Expected: stderr prints `[swietlik-mcp] hub listening on ws://127.0.0.1:5215` and the process stays up waiting on stdin. Stop it with Ctrl-C.

- [ ] **Step 12: Run the full suite and lint**

Run: `npm run test:run && npm run lint:ci`
Expected: all tests pass; ESLint 0 errors (`mcp/` is outside the lint path).

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json mcp/tools.js mcp/hub.js mcp/server.js test/mcp/hub.spec.js test/mcp/server.spec.js
git commit -m "feat(mcp): add MCP stdio server, WebSocket hub and tool catalogue

23 tools mirroring the in-app command registry, a loopback hub with
correlation ids, a 10s per-command deadline and newest-tab-wins handover.
Integration tested end to end against a scripted fake app over real WS.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 9: Registration, parity guard, docs and final verification

**Files:**
- Create: `.mcp.json`
- Test: `test/mcp/tool-parity.spec.js`
- Modify: `CLAUDE.md` (§3 Commands table, §4 Architecture map, §5 Testing count, §9/§10 pointers)
- Modify: `docs/swietlik/verification.md` (add the MCP-driven verification path)
- Modify: `docs/swietlik/upstream-diff.md` ("Additive files" list)

**Interfaces:**
- Consumes: `listCommands`, `getCommandSchema`, `loadedCommandModules` from `@/mcp-bridge/commands`; `TOOLS`, `TOOL_NAMES` from `@root/mcp/tools`.
- Produces: no new runtime code — this task locks the two sides together and documents the result.

- [ ] **Step 1: Write the failing parity test**

Create `test/mcp/tool-parity.spec.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  listCommands,
  getCommandSchema,
  loadedCommandModules,
} from '@/mcp-bridge/commands';
import { TOOLS, TOOL_NAMES } from '@root/mcp/tools';

/**
 * Registry argument names that are marked required.
 *
 * @param {String} name command name
 * @return {Array<String>} sorted required argument names
 */
function registryRequired(name) {
  const schema = getCommandSchema(name);
  return Object.keys(schema).filter((key) => schema[key].required === true).sort();
}

describe('tool/command parity', () => {
  it('loads all five command modules through the glob', () => {
    expect(loadedCommandModules).toEqual([
      './control.commands.js',
      './patch.commands.js',
      './query.commands.js',
      './show.commands.js',
      './vision.commands.js',
    ]);
  });

  it('exposes exactly one MCP tool per registered command', () => {
    expect(TOOL_NAMES).toEqual(listCommands());
  });

  it('declares the same argument names on both sides', () => {
    TOOLS.forEach((tool) => {
      const registryArgs = Object.keys(getCommandSchema(tool.name)).sort();
      const toolArgs = Object.keys(tool.inputSchema.properties).sort();
      expect(toolArgs, `argument names for ${tool.name}`).toEqual(registryArgs);
    });
  });

  it('declares the same required arguments on both sides', () => {
    TOOLS.forEach((tool) => {
      const toolRequired = [...(tool.inputSchema.required || [])].sort();
      expect(toolRequired, `required args for ${tool.name}`)
        .toEqual(registryRequired(tool.name));
    });
  });

  it('closes every tool schema to unknown arguments', () => {
    TOOLS.forEach((tool) => {
      expect(tool.inputSchema.additionalProperties, `${tool.name} schema`).toBe(false);
    });
  });

  it('gives every tool a usable description', () => {
    TOOLS.forEach((tool) => {
      expect(tool.description.length, `${tool.name} description`).toBeGreaterThan(20);
    });
  });
});
```

- [ ] **Step 2: Run it and fix whichever side is wrong**

Run: `npm run test:run -- test/mcp/tool-parity.spec.js`
Expected: PASS — 6 tests, because Tasks 3–6 and 8 were written from the same interface blocks. If it fails, the failure message names the command and which side drifted: correct the *tool catalogue* to match the registry (the registry is the behaviour, the catalogue is the description of it) unless the registry itself contradicts this plan's Interfaces block.

- [ ] **Step 3: Register the server with Claude Code**

Create `.mcp.json`:

```json
{
  "mcpServers": {
    "swietlik": {
      "type": "stdio",
      "command": "node",
      "args": ["mcp/server.js"],
      "env": {}
    }
  }
}
```

- [ ] **Step 4: Confirm Claude Code can see the tools**

Run: `npx --yes @modelcontextprotocol/inspector --cli node mcp/server.js --method tools/list`
Expected: a JSON listing of 23 tools. If the inspector is unavailable offline, `npm run test:run -- test/mcp/server.spec.js` already proves `tools/list` over real stdio — treat that as the evidence and note the substitution.

- [ ] **Step 5: Update CLAUDE.md §3 (Commands)**

Add one row to the commands table, after the `lint` row:

```markdown
| `npm run mcp` | Starts the Phase 1 MCP server (stdio) + its WebSocket hub on `ws://127.0.0.1:5215`. Claude Code sessions in this repo start it automatically via `.mcp.json` — run it by hand only to debug. Logs go to **stderr**; stdout is the MCP transport. |
```

- [ ] **Step 6: Update CLAUDE.md §4 (Architecture map)**

Add this subsection immediately after "The facade — THIS IS THE PHASE 1 MCP SURFACE":

```markdown
### The MCP command API (Phase 1)

```
Claude session ──stdio (MCP)──> mcp/server.js
                                  │  embeds the ws hub on 127.0.0.1:5215
                                  ▼
                       src/mcp-bridge/ (in-app WS client)
                                  │  executes via the command registry
                                  ▼
                       reactive(ShowSingleton)  →  live UI + visualizer
```

- **`mcp/`** — plain Node ESM (`mcp/package.json` carries `{"type":"module"}`), no build step. `protocol.js` is the shared, dependency-free envelope imported by **both** sides; `tools.js` is the tool catalogue; `hub.js` is the WS server; `server.js` is the MCP stdio entry point. Registered in `.mcp.json`.
- **`src/mcp-bridge/`** — fully additive except the one-line hook in `App.vue`. `commands/registry.js` maps `commandName → (show, args) → serializable result` with strict argument validation and a uniform `{ ok, result } | { ok, error: { code, message } }` envelope. Command groups live in `commands/*.commands.js` and self-register; `commands/index.js` picks them up with `import.meta.glob`, so **adding a command group means adding a file, never editing the index**.
- **REACTIVITY INVARIANT** — the bridge binds to `reactive(ShowSingleton)`. Vue's proxy cache dedups that to the same proxy `main.js` installs as `$show`, so external mutations render immediately. Calling the raw singleton silently desyncs the UI. `test/mcp-bridge/index.spec.js` asserts the proxy identity; never weaken it.
- **Error codes** — `APP_NOT_CONNECTED`, `TIMEOUT` (10 s per command), `VALIDATION`, `COMMAND_ERROR`, `UNKNOWN_COMMAND`.
- **Ports** — 5215 default, `SWIETLIK_MCP_PORT` / `VITE_SWIETLIK_MCP_PORT` to override. **5214 is the DMX gateway and is rejected.** Loopback only, no auth (Phase 1 non-goal).
- **Patching is a two-step composite.** `patch_fixture` fetches the OFL JSON and attaches it as `fixtureData.OFLData` *before* `fixturePool.addRaw` (the `Fixture` constructor parses synchronously), then calls `universe.patchFixture`. The registry owns this so no caller can produce a half-built fixture.
```

- [ ] **Step 7: Update CLAUDE.md §5 (Testing)**

Replace the "Phase 0 close" line with:

```markdown
**Phase 0 close: 156 tests across 10 files, all passing.**

**Phase 1 close:** `test/mcp-bridge/**` covers the registry, the validator, every command group and the WS bridge under jsdom; `test/mcp/**` covers the protocol, the hub and the MCP server under Node (`// @vitest-environment node` at the top of those files — there is still only **one** vitest config). `test/mcp/tool-parity.spec.js` fails the build if the MCP tool catalogue and the in-app registry drift apart. `test/helpers/show-double.js` is the shared show stand-in for command tests.
```

- [ ] **Step 8: Add the MCP path to the verification checklist**

Modify `docs/swietlik/verification.md`. Append this section before the final "## Result" block:

```markdown
---

## 8. MCP-driven verification (Phase 1 onward — the preferred path)

From Phase 1 the checklist above can be driven through the MCP tools instead of by hand, and **this is the standing verification method for later phases**. It needs the app running (`npm start`, <http://localhost:5173> open) and a Claude Code session in this repo, which starts the server from `.mcp.json` automatically.

- [ ] `get_show_state` returns a show summary. (If it errors with `APP_NOT_CONNECTED`, the app is not open or the bridge did not start — check the browser console for `[mcp-bridge] connected to ws://127.0.0.1:5215`.)
- [ ] `search_fixture_library` with query `sharpy` returns `clay-paky/sharpy`.
- [ ] `patch_fixture` with `{ manufacturer: "clay-paky", model: "sharpy" }` returns an id and a `chStart`, **and the fixture appears in the 3D viewport without a page reload** — that is the reactivity invariant proving itself.
- [ ] `set_channels` with the new fixture id and `accessors: [{ type: "Dimmer", value: 255 }]` succeeds.
- [ ] `screenshot_visualizer` returns an image in which **the beam is visible**. This replaces "look at the screen" with evidence you can attach to the work.
- [ ] `move_fixture` with a new `position` moves the fixture in the next screenshot.
- [ ] `unpatch_fixture` removes it, and the following screenshot shows an empty stage.
- [ ] The browser console still shows **zero uncaught errors** (§6 is still the gate).
- [ ] Closing the tab and reopening it reconnects the bridge on its own; with two tabs open, the **newest** one serves the tools and the older logs `detached by hub`.

A screenshot is evidence. "The tools returned ok" is not evidence that anything rendered — §5 and §6 still decide.
```

Also add a row to the "## Result" table:

```markdown
| 8 | MCP path: patch → screenshot shows a beam → unpatch | ☐ |
```

- [ ] **Step 9: Record the additive files in the divergence ledger**

Modify `docs/swietlik/upstream-diff.md`, "## Additive files (no merge debt)" list. Append:

```markdown
- `.mcp.json` — registers the Phase 1 MCP server for Claude Code sessions in this repo.
- `mcp/package.json`, `mcp/protocol.js`, `mcp/tools.js`, `mcp/hub.js`, `mcp/server.js` — Phase 1 MCP server package (plain Node ESM, no build step). GPL-3.0 like the rest of the repo.
- `src/mcp-bridge/` — in-app WS bridge and command registry: `index.js`, `bridge.js`, `ofl.js`, `commands/{index,registry,validate}.js`, `commands/{query,patch,control,show,vision}.commands.js`.
- `test/mcp-bridge/*.spec.js`, `test/mcp/*.spec.js`, `test/helpers/show-double.js` — Phase 1 test suites and the shared show double.
```

- [ ] **Step 10: Full verification run**

Run each, in order, and record the actual output:

```bash
npm run test:run
npm run lint:ci
npm run build
```

Expected:
- `test:run` — every suite green, **including the original 156 Phase 0 tests**. If any Phase 0 test now fails, the cause is almost certainly module-level singleton leakage from a new spec file — fix the new spec, never the Phase 0 one.
- `lint:ci` — **0 errors** (12 pre-existing warnings are tolerated; do not add more).
- `build` — `vite build` completes, proving `@root/mcp/protocol` resolves in the app build and that the `App.vue` hook does not break the bundle.

- [ ] **Step 11: Manual end-to-end checklist**

Work `docs/swietlik/verification.md` §8 against the real app, in a Claude Code session in this repo:

1. `npm start`, open <http://localhost:5173>, dismiss the splash.
2. Confirm the browser console logs `[mcp-bridge] connected to ws://127.0.0.1:5215`.
3. Run the §8 checklist end to end, keeping the `patch → set Dimmer 255 → screenshot` image.
4. Note anything that failed. A partial pass is a partial pass.

- [ ] **Step 12: Commit**

```bash
git add .mcp.json test/mcp/tool-parity.spec.js CLAUDE.md docs/swietlik/verification.md docs/swietlik/upstream-diff.md
git commit -m "feat(mcp): register the MCP server, guard tool parity and document Phase 1

.mcp.json wires the server into Claude Code sessions; tool-parity.spec.js
fails the build if the catalogue and the in-app registry drift. CLAUDE.md
gains the architecture section and the mcp script; verification.md gains
the MCP-driven render-verification path.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review

Checked against `docs/superpowers/specs/2026-09-09-mcp-command-api-design.md`:

| Spec requirement | Task |
| --- | --- |
| `mcp/` plain-Node package, SDK stdio server + `ws` hub, no build step | 1 (package marker, protocol), 8 (hub, server, tools) |
| Registered in `.mcp.json` | 9 |
| Structured error telling the caller to open localhost:5173 when no app | 1 (`APP_NOT_CONNECTED_REMEDY`), 8 (hub `call`, server `toolError`) |
| `src/mcp-bridge/` additive WS client with reconnect/backoff | 7 |
| Started on the existing `app_ready` EventBus event | 7 |
| Exactly one active app connection, newer tab supersedes | 8 (hub `attach`, detach notice), 7 (bridge honours detach) |
| Survives HMR/reload by reconnecting | 7 (backoff, capped at 10 s) |
| `reactive(ShowSingleton)` invariant | 7 (asserted by `index.spec.js`), Global Constraints, 9 (CLAUDE.md) |
| `commandName → (show, args) → serializable result` modules | 2 (registry), 3–6 (groups) |
| Uniform `{ ok, result } \| { ok, error: { code, message } }` envelope | 1, 2 |
| Arg validation before touching models; exceptions caught, never crash | 2 (`dispatch`), 4 (pre-resolve + rollback), 5 (pre-validate all entries) |
| Composite `patchFixture` with OFL fetch + cache + `findChStartAutoPatch` | 4 |
| Compact, token-friendly query summaries | 3 |
| 21-tool surface: 3 queries, 3 patch, 11 control, 5 show, 1 vision = 23 | 3, 4, 5, 6; catalogued in 8 |
| `screenshot_visualizer` → MCP image content, forced render | 6 (command), 8 (image content) |
| Correlation ids, 10 s timeout | 1 (`COMMAND_TIMEOUT_MS`), 8 (hub) |
| Validation errors name the offending argument | 2 (`validate.js` messages) |
| Command errors carry the thrown message + command name | 2 (`${cmd}: ${message}`) |
| Registry unit tests in the existing Vitest harness, axios mocked | 2–6 |
| Integration: server as a child process, scripted fake app over real WS | 8 (`test/mcp/server.spec.js`) |
| E2E: Claude drives the app and screenshots; becomes the standing method | 9 (verification.md §8) |
| Additive-first, one hook line, logged in the ledger | 7 |
| Port 5215, env-overridable, must not collide with 5214 | 1 (`resolvePort`), 7, 8 |
| GPL-3.0 covers `mcp/` | Global Constraints, 9 (ledger entry) |
| Non-goals untouched (auth, remote, SaaS, stage builder, chat UI, Electron) | none — deliberately absent |

**Deviations from the spec, and why:**

1. **23 tools, not ~21.** The spec's own lists enumerate 23 once counted; no tool was added beyond them.
2. **The shared protocol lives in exactly one file, `mcp/protocol.js`**, imported by the app as `@root/mcp/protocol` (no `.js` — `import/extensions` forbids the extension under `airbnb-base`). A second copy under `src/` was rejected: duplicated wire constants are how protocols drift.
3. **The command loader uses `import.meta.glob`** rather than an aggregator file with one import line per group. This removes the only file Tasks 3–6 would all have had to edit, so those four tasks are genuinely independent and parallel-safe.
4. **The bridge is dormant in production builds** unless `VITE_SWIETLIK_MCP=true`. The spec does not ask for this; shipping a build that dials a loopback socket on every page load would be worse than the small amount of gating code.
5. **Node-environment tests use `// @vitest-environment node` inside the existing config** instead of a second vitest config and a second npm script. One config, one `npm run test:run`, as CLAUDE.md §5 requires.
