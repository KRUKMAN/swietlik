import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';

// Show#preloadFixtureList / #prepareFixtures reach for the bundled fixture
// library over HTTP. Nothing in these tests exercises the network, so axios is
// replaced wholesale by a resolved-empty stub.
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

// eslint-disable-next-line import/first
import axios from 'axios';
// eslint-disable-next-line import/first
import Show from '@/models/DMX/show.model';
// eslint-disable-next-line import/first
import { ProxifySingleton } from '@/models/utils/proxify.utils';

/**
 * localStorage key Świetlik writes its autosave to.
 *
 * @constant {String}
 */
const SHOWFILE_KEY = 'SWIETLIK_SHOWFILE';

/**
 * Upstream ASLS Studio key, still read (never written) for migration.
 *
 * @constant {String}
 */
const LEGACY_SHOWFILE_KEY = 'ASLS_STUDIO_SHOWFILE';

/**
 * Minimal but complete showfile payload.
 *
 * `Show#loadFromData` walks visualizer -> fixtures -> universes -> groups ->
 * outputs unconditionally, so every one of those keys has to be present even
 * when empty.
 *
 * @param {Object} [overrides={}] show-data overrides
 * @return {Object} show data object
 */
function showFileData(overrides = {}) {
  return {
    name: 'legacy_show',
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
 * The real handle is injected by the Vue visualizer plugin; `showData` and
 * `preferences` are the only two members the model touches.
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
  localStorage.clear();
  axios.get.mockResolvedValue({ data: [] });
  // Every `new Show()` subscribes to the module-level ProxifySingleton and
  // nothing ever unsubscribes. Drop the listeners (and the undo/redo stacks)
  // between tests so state cannot leak and Node stops warning about a leak.
  ProxifySingleton.removeAllListeners('changed');
  ProxifySingleton.undoStack = [];
  ProxifySingleton.redoStack = [];
  ProxifySingleton.hash = null;
});

describe('Show -- construction', () => {
  it('wires up every sub-pool and the master', () => {
    const show = new Show();

    expect(show.fixturePool).toBeDefined();
    // NOTE: proxify attaches pushAndStackUndo/spliceAndStackUndo as own
    // enumerable properties on pooled arrays, so a bare `toEqual([])` would
    // fail on those extra keys -- assert the length instead.
    expect(show.fixturePool.fixtures).toHaveLength(0);
    expect(show.universePool).toBeDefined();
    expect(show.groupPool).toBeDefined();
    expect(show.groupPool.groups).toHaveLength(0);
    expect(show.outputPool).toBeDefined();
    expect(show.outputPool.outputs).toHaveLength(0);
    expect(show.master).toBeDefined();
    // Master is built around the very same group pool instance.
    expect(show.master.groupPool).toBe(show.groupPool);
  });

  it('adds one default universe', () => {
    const show = new Show();

    expect(show.universePool.universes).toHaveLength(1);
    expect(show.universePool.universes[0].id).toBe(0);
    expect(show.universePool.universes[0].name).toBe('Universe 0');
  });

  it('starts in a saved, not-yet-ready loading state', () => {
    const show = new Show();

    expect(show.isSaved).toBe(true);
    expect(show.ready).toBe(false);
    expect(show.loading.state).toBe(true);
  });

  it('preloads the fixture list through axios', async () => {
    axios.get.mockResolvedValue({ data: [{ manufacturer: 'clay-paky' }] });
    const show = new Show();

    await show.preloadFixtureList();

    expect(axios.get).toHaveBeenCalled();
    expect(axios.get.mock.calls[0][0]).toContain('fixtures/fixture_list.json');
    expect(show.rawOFLFixtures).toEqual([{ manufacturer: 'clay-paky' }]);
  });

  it('swallows a failed fixture-list fetch', async () => {
    // preloadFixtureList console.logs the failure; keep the test output quiet.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    axios.get.mockRejectedValue(new Error('offline'));
    const show = new Show();

    await expect(show.preloadFixtureList()).resolves.toBeUndefined();
    expect(show.rawOFLFixtures).toEqual([]);
  });
});

describe('Show#persistLocally', () => {
  it('writes the serialized show under the SWIETLIK_SHOWFILE key', () => {
    const show = buildShow();

    show.persistLocally();

    const raw = localStorage.getItem(SHOWFILE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw);
    expect(parsed).toMatchObject({
      fixtures: [],
      groups: [],
      outputs: [],
      visualizer: { camera: 'default' },
    });
    expect(parsed.universes).toHaveLength(1);
    expect(parsed.universes[0].id).toBe(0);
    expect(typeof parsed.bpm).toBe('number');
  });

  it('never writes the legacy ASLS_STUDIO_SHOWFILE key', () => {
    const show = buildShow();

    show.persistLocally();

    expect(localStorage.getItem(LEGACY_SHOWFILE_KEY)).toBeNull();
  });

  it('flips the show back to saved and emits saveState', () => {
    const show = buildShow();
    const saveStates = [];
    show.on('saveState', (state) => saveStates.push(state));
    show.isSaved = false;

    show.persistLocally();

    expect(show.isSaved).toBe(true);
    expect(saveStates).toContain(true);
  });
});

describe('Show#loadFromLocalStorage', () => {
  it('returns false when neither key is present', async () => {
    const show = buildShow();

    await expect(show.loadFromLocalStorage()).resolves.toBe(false);
  });

  it('loads a showfile stored under the current SWIETLIK_SHOWFILE key', async () => {
    const show = buildShow();
    localStorage.setItem(SHOWFILE_KEY, JSON.stringify(showFileData({ name: 'current_show' })));

    await expect(show.loadFromLocalStorage()).resolves.toBe(true);

    expect(show.name).toBe('current_show');
    expect(show.ready).toBe(true);
  });

  // The T8 migration regression test: an autosave written by upstream ASLS
  // Studio (same localStorage origin on localhost) must still load after the
  // key rename, without the caller having to migrate anything by hand.
  it('falls back to the legacy ASLS_STUDIO_SHOWFILE key', async () => {
    const show = buildShow();
    localStorage.setItem(LEGACY_SHOWFILE_KEY, JSON.stringify(showFileData()));
    expect(localStorage.getItem(SHOWFILE_KEY)).toBeNull();

    let loaded;
    await expect(
      (async () => { loaded = await show.loadFromLocalStorage(); })(),
    ).resolves.toBeUndefined();

    expect(loaded).toBe(true);
    expect(show.name).toBe('legacy_show');
    expect(show.bpm).toBe(128);
    expect(show.visualizerHandle.preferences).toEqual({ fog: false });
    expect(show.universePool.universes).toHaveLength(1);
    expect(show.universePool.universes[0].id).toBe(0);
  });

  it('re-persists a legacy autosave under the new key, leaving the legacy one intact', async () => {
    const show = buildShow();
    const legacyRaw = JSON.stringify(showFileData());
    localStorage.setItem(LEGACY_SHOWFILE_KEY, legacyRaw);

    await show.loadFromLocalStorage();

    // loadFromData finishes with persistLocally(), so the migration completes
    // on first load ...
    expect(localStorage.getItem(SHOWFILE_KEY)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(SHOWFILE_KEY)).name).toBe('legacy_show');
    // ... while the legacy entry is deliberately never rewritten or removed.
    expect(localStorage.getItem(LEGACY_SHOWFILE_KEY)).toBe(legacyRaw);
  });

  it('prefers the current key when both are present', async () => {
    const show = buildShow();
    localStorage.setItem(LEGACY_SHOWFILE_KEY, JSON.stringify(showFileData({ name: 'legacy_show' })));
    localStorage.setItem(SHOWFILE_KEY, JSON.stringify(showFileData({ name: 'current_show' })));

    await expect(show.loadFromLocalStorage()).resolves.toBe(true);

    expect(show.name).toBe('current_show');
  });
});

describe('Show#clearShowData', () => {
  it('empties every pool and resets the project name', () => {
    const show = buildShow();
    show.name = 'something.json';

    show.clearShowData();

    expect(show.fixturePool.fixtures).toHaveLength(0);
    expect(show.universePool.universes).toHaveLength(0);
    expect(show.groupPool.groups).toHaveLength(0);
    expect(show.outputPool.outputs).toHaveLength(0);
    expect(show.name).toBe('Untitled project');
    expect(show.isSaved).toBe(true);
    expect(show.bpm).toBe(120);
  });
});

describe('Show#genShowFile', () => {
  it('serializes the same payload persistLocally writes', () => {
    const show = buildShow();

    show.persistLocally();

    expect(show.genShowFile()).toBe(localStorage.getItem(SHOWFILE_KEY));
  });
});
