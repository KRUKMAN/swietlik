/**
 * Test stub for `src/plugins/wsc.connection.js`.
 *
 * The real module imports `@asls/wsc-client` / `@asls/wsc-sdk` and instantiates
 * a `WscClientManager` at import time, and pulls in `live.model.js` (which in
 * turn imports `@/worker?worker`). Consumers only need three things:
 *
 *   - `src/models/DMX/output.pool.model.js`: `new WscConnection(remote, port, name)`
 *     (default import) plus `handleClosure()` on delete.
 *   - `universe.modifier.widget.connection.vue`: named `{ STREAM_STATE }`.
 *   - `WscConnection#setupStream(...)` returning a `WscConnectionStream`.
 *
 * Everything below stores its constructor data and no-ops.
 */

/**
 * Ordered log of every stubbed side-effecting call since the last `reset()`.
 *
 * @type {Array<{method: String, args: Array, target: Object}>}
 */
export const calls = [];

/**
 * Every WscConnection stub instance created since the last `reset()`.
 *
 * @type {Array<WscConnection>}
 */
export const connections = [];

/**
 * Every WscConnectionStream stub instance created since the last `reset()`.
 *
 * @type {Array<WscConnectionStream>}
 */
export const streams = [];

export const STREAM_STATE = Object.freeze({
  IDLE: 0,
  RUNNING: 1,
});

export class WscConnectionStream {
  constructor(wscConnectionHandle, targetId, getFrame, protocol, address) {
    this.connectionHandle = wscConnectionHandle;
    this.targetId = targetId;
    this.getFrame = getFrame;
    this.protocol = protocol;
    this.address = address;
    this.state = STREAM_STATE.IDLE;
    this.streamId = null;
    this.transport = null;
    streams.push(this);
  }

  start() {
    this.state = STREAM_STATE.RUNNING;
    this.streamId = streams.indexOf(this);
    calls.push({ method: 'start', args: [], target: this });
  }

  forward() {
    calls.push({ method: 'forward', args: [], target: this });
  }

  stop() {
    this.state = STREAM_STATE.IDLE;
    this.streamId = null;
    calls.push({ method: 'stop', args: [], target: this });
  }
}

class WscConnection {
  constructor(remote, port, name) {
    this.remote = remote;
    this.port = port;
    this.name = name;
    this.client = null;
    connections.push(this);
  }

  setupStream(targetId, protocol, address, dataStreamHandle) {
    calls.push({
      method: 'setupStream',
      args: [targetId, protocol, address, dataStreamHandle],
      target: this,
    });
    return new WscConnectionStream(this, targetId, dataStreamHandle, protocol, address);
  }

  async connect() {
    this.client = { send: () => {}, connect: async () => {}, close: () => {} };
    calls.push({ method: 'connect', args: [], target: this });
  }

  sendLighting(universe, channelsData, transport) {
    calls.push({ method: 'sendLighting', args: [universe, channelsData, transport], target: this });
  }

  handleClosure() {
    calls.push({ method: 'handleClosure', args: [], target: this });
  }

  // eslint-disable-next-line class-methods-use-this
  onOpen() {}

  // eslint-disable-next-line class-methods-use-this
  onMessage() {}

  // eslint-disable-next-line class-methods-use-this
  onError() {}

  /**
   * Clears every recorded stub array. Call from `beforeEach`.
   */
  static reset() {
    calls.length = 0;
    connections.length = 0;
    streams.length = 0;
  }
}

export default WscConnection;
