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

    // Deviation from the plan's literal expectation: Show's `name` setter
    // maps any falsy value (clearShowData sets `this.name = ''`) to the
    // literal string 'Untitled project', not the DEFAULT_PROJECT_NAME
    // ('new_project.asls') the getter only ever returns when `_name` itself
    // is falsy -- which the setter never leaves it as. This is pre-existing
    // behaviour on `develop`, unrelated to the 2026-09-09 hardening commit.
    expect(created).toEqual({
      name: 'Untitled project',
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
