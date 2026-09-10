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
