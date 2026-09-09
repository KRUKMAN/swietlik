import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import Bridge from '@/mcp-bridge/bridge';
import { registerCommand, dispatch } from '@/mcp-bridge/commands/registry';
import { makeRequest, makeSuccess, makeDetach } from '@root/mcp/protocol';

/**
 * Test-only command whose result cannot survive `JSON.stringify`. Registered
 * here rather than in a `*.commands.js` so no shipped command has to misbehave
 * to prove the bridge survives one that does.
 */
registerCommand('circular_probe', {
  description: 'Test-only command returning a self-referential object.',
  args: {},
  handler: () => {
    const loop = { name: 'loop' };
    loop.self = loop;
    return loop;
  },
});

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

  it('answers with an error envelope when the result cannot be serialised', async () => {
    // A circular result makes `send`'s JSON.stringify throw. Without a guard
    // around dispatch+send that surfaces as an unhandled rejection and the
    // caller waits out its timeout with no response at all.
    const { bridge } = buildBridge({ dispatchFn: dispatch });
    bridge.connect();
    FakeWebSocket.last.open();

    await expect(bridge.handleMessage(
      JSON.stringify(makeRequest('r6', 'circular_probe', {})),
    )).resolves.toBeUndefined();

    expect(FakeWebSocket.last.sent).toHaveLength(1);
    expect(FakeWebSocket.last.sent[0]).toMatchObject({
      type: 'response',
      id: 'r6',
      ok: false,
      error: { code: 'COMMAND_ERROR' },
    });
  });

  it('answers with an error envelope when the dispatcher itself rejects', async () => {
    const dispatchFn = vi.fn(() => Promise.reject(new Error('dispatcher exploded')));
    const { bridge } = buildBridge({ dispatchFn });
    bridge.connect();
    FakeWebSocket.last.open();

    await bridge.handleMessage(JSON.stringify(makeRequest('r7', 'undo', {})));

    expect(FakeWebSocket.last.sent).toHaveLength(1);
    expect(FakeWebSocket.last.sent[0].id).toBe('r7');
    expect(FakeWebSocket.last.sent[0].error.code).toBe('COMMAND_ERROR');
    expect(FakeWebSocket.last.sent[0].error.message).toContain('dispatcher exploded');
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
