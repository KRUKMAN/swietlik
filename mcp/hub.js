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
 * Close code sent to a handshake from a disallowed Origin.
 *
 * @constant {Number}
 */
const CLOSE_ORIGIN_REJECTED = 4003;

/**
 * Origins allowed to open a WebSocket connection to the hub, beyond the Vite
 * dev-server defaults.
 *
 * ADVERSARIAL REVIEW FINDING (MEDIUM): the hub binds to loopback but, before
 * this fix, accepted a WebSocket handshake from ANY Origin. A hostile page
 * open in the same browser could `new WebSocket('ws://127.0.0.1:5215')`,
 * win newest-tab-wins adoption over the real app tab, and forge tool results
 * back to the MCP server / the Claude session driving it. A browser always
 * sends an `Origin` header on this kind of cross-origin handshake and a page
 * cannot spoof it, so checking it here is a real boundary, not security
 * theatre. A missing Origin header is allowed through deliberately: it is
 * how every non-browser client speaks to this hub -- this repo's own tests,
 * `mcp/server.js`'s own fake-app harness, and any future CLI tooling -- none
 * of which a hostile web page can puppet. `SWIETLIK_MCP_ALLOWED_ORIGIN` lets
 * an operator add exactly one more trusted origin (eg. a non-default dev
 * port) without editing source.
 *
 * @constant {Set<String>}
 * @private
 */
const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

/**
 * Decides whether a WebSocket handshake's Origin header may adopt the hub.
 *
 * @param {String|undefined} origin the `Origin` header value, if any
 * @param {Object} [env=process.env] environment bag, injectable for tests
 * @return {Boolean} true when the connection should be allowed
 */
export function isOriginAllowed(origin, env = process.env) {
  if (!origin) {
    return true;
  }
  if (DEFAULT_ALLOWED_ORIGINS.has(origin)) {
    return true;
  }
  return Boolean(env.SWIETLIK_MCP_ALLOWED_ORIGIN) && origin === env.SWIETLIK_MCP_ALLOWED_ORIGIN;
}

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
    server.on('connection', (socket, request) => this.handleConnection(socket, request));
    server.on('error', (err) => {
      this.logger.error(`[swietlik-mcp] hub error: ${err.message}`);
    });
    return this.boundPort;
  }

  /**
   * Gatekeeper for a raw WebSocket handshake: checks the Origin allowlist
   * before the socket is ever adopted, then hands off to `attach`.
   *
   * @param {Object} socket ws socket
   * @param {Object} request the underlying HTTP upgrade request
   * @private
   */
  handleConnection(socket, request) {
    const origin = request && request.headers ? request.headers.origin : undefined;
    if (!isOriginAllowed(origin)) {
      this.logger.warn(`[swietlik-mcp] rejected a WebSocket handshake from disallowed Origin "${origin}"`);
      socket.close(CLOSE_ORIGIN_REJECTED, 'origin not allowed');
      return;
    }
    this.attach(socket);
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
      // Whatever was in flight to the old socket can never be answered --
      // fail it now instead of leaving it to die as a misleading TIMEOUT.
      this.rejectPending('a newer Świetlik tab took over the bridge');
      this.logger.warn('[swietlik-mcp] a newer Świetlik tab took over the bridge');
    }
    this.socket = socket;
    this.logger.log('[swietlik-mcp] Świetlik app connected');
    socket.on('message', (raw) => this.handleMessage(socket, raw));
    socket.on('close', () => {
      if (this.socket === socket) {
        this.socket = null;
        this.rejectPending('the Świetlik app disconnected');
        this.logger.warn('[swietlik-mcp] Świetlik app disconnected');
      }
    });
    socket.on('error', () => {
      // A close event always follows.
    });
  }

  /**
   * Rejects every pending call with APP_NOT_CONNECTED and clears its timer.
   *
   * Called when the socket those calls were sent to is no longer able to
   * answer them -- either it closed, or a newer tab superseded it -- so a
   * caller gets a prompt, accurate error instead of riding out the full
   * command deadline as a misleading TIMEOUT.
   *
   * @param {String} detail short human-readable reason, appended to the remedy
   * @private
   */
  rejectPending(detail) {
    if (!this.pending.size) {
      return;
    }
    this.pending.forEach((entry) => {
      clearTimeout(entry.timer);
      entry.reject(new HubError(
        ERROR_CODES.APP_NOT_CONNECTED,
        `${APP_NOT_CONNECTED_REMEDY} (${detail}.)`,
      ));
    });
    this.pending.clear();
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
