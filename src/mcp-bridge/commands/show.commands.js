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

/**
 * Deep-copies the show's current state into a plain showfile object.
 *
 * `show.showData` already walks the pools through their own `showData` getters,
 * so it is plain data -- but it still holds live nested objects, and the
 * restore path must not alias anything the failed load is about to mutate.
 * Serialising it detaches the copy completely.
 *
 * @param {Object} show reactive show handle
 * @return {Object|null} a detached showfile object, or null when the show
 * cannot be serialised (no visualizer handle attached yet, most likely)
 * @private
 */
function snapshotShow(show) {
  try {
    return JSON.parse(JSON.stringify(show.showData));
  } catch {
    return null;
  }
}

/**
 * Puts a snapshot back after a load failed, never throwing.
 *
 * @param {Object} show reactive show handle
 * @param {Object|null} snapshot the value returned by snapshotShow
 * @return {Promise<String>} a sentence describing what happened to the old
 * show, for appending to the caller's error message
 * @async
 * @private
 */
async function restoreSnapshot(show, snapshot) {
  if (!snapshot) {
    return 'The previous show could not be snapshotted, so nothing was restored.';
  }
  try {
    await show.loadFromData(snapshot);
    return 'The previous show has been restored.';
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    return `Restore failed as well (${detail}); the show is now empty.`;
  }
}

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
    // `Show#loadFromData` clears the show BEFORE it reads a single field of the
    // payload, so anything malformed leaves the caller with no show at all and
    // `loading.state` wedged true -- there is no `finally` upstream. Snapshot,
    // then put it back.
    const snapshot = snapshotShow(show);
    try {
      if (hasData) {
        await show.loadFromData(args.data);
      } else {
        const loaded = await show.loadFromLocalStorage();
        if (!loaded) {
          throw new Error('No autosaved show found in localStorage.');
        }
      }
    } catch (err) {
      const detail = err && err.message ? err.message : String(err);
      throw new Error(`${detail} ${await restoreSnapshot(show, snapshot)}`);
    } finally {
      // Upstream never lowers this flag; the toolbar's new-show popup clears it
      // by hand after `loadFromUrl` (popup.newshow.vue:121). Do the same, on
      // both the success and the failure path, or the app is left showing its
      // loading screen forever.
      if (show.loading) {
        show.loading.state = false;
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
