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
