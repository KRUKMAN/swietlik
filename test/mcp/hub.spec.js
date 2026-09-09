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
