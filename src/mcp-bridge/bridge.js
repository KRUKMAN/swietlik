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
    // Destructured (not `const socket = this.socket`) to satisfy airbnb's
    // prefer-destructuring rule; `lint:ci` must stay at 0 errors.
    const { socket } = this;
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
    try {
      const response = await this.dispatchFn(this.show, message);
      this.send(response);
    } catch (err) {
      // `dispatch` converts command failures into envelopes itself, so what
      // lands here is the envelope never making it onto the wire -- a result
      // holding a circular reference or a live model object, which only fails
      // once `send` reaches JSON.stringify. Letting that escape would be an
      // unhandled rejection AND leave the caller waiting out its timeout with
      // no answer, so reply by id instead.
      const detail = err && err.message ? err.message : String(err);
      this.logger.warn(`[mcp-bridge] could not answer request ${message.id}: ${detail}`);
      this.send(makeError(message.id, ERROR_CODES.COMMAND_ERROR, detail));
    }
  }
}
