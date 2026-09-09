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
    if (hasData) {
      await show.loadFromData(args.data);
    } else {
      const loaded = await show.loadFromLocalStorage();
      if (!loaded) {
        throw new Error('No autosaved show found in localStorage.');
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
