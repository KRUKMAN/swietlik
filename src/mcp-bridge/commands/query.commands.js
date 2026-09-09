import { registerCommand } from './registry';

/**
 * Read-only state queries.
 *
 * Results are deliberately compact summaries -- ids, names and key values --
 * because the consumer is an LLM paying for every token. Per-channel detail
 * lives behind `get_fixture`, never in `get_show_state`.
 *
 * @module mcp-bridge/commands/query.commands
 */

/**
 * Compact per-fixture summary used by get_show_state.
 *
 * @param {Object} fixture fixture instance
 * @return {Object} summary
 * @private
 */
function summariseFixture(fixture) {
  return {
    id: fixture.id,
    name: fixture.name,
    manufacturer: fixture.manufacturer,
    model: fixture.model,
    mode: fixture.modeName,
    universe: fixture.universe,
    chStart: fixture.chStart,
    chCount: fixture.channels.length,
  };
}

/**
 * Compact per-group summary used by get_show_state.
 *
 * @param {Object} group group instance
 * @return {Object} summary
 * @private
 */
function summariseGroup(group) {
  return {
    id: group.id,
    name: group.name,
    color: group.color,
    fixtureIds: group.fixturePool.fixtures.map((fixture) => fixture.id),
    cues: group.cuePool.cues.map((cue) => ({
      id: cue.id,
      name: cue.name,
      type: cue.type,
      duration: cue.duration,
      state: cue.state,
    })),
    chases: group.chasePool.chases.map((chase) => ({
      id: chase.id,
      name: chase.name,
      gridIndex: chase.gridIndex,
      duration: chase.duration,
      cueCount: chase.cues.length,
    })),
  };
}

registerCommand('get_show_state', {
  description: 'Returns a compact summary of the whole show: name, BPM, save '
    + 'state, universes, patched fixtures and groups with their cues and chases.',
  args: {},
  handler: (show) => ({
    name: show.name,
    bpm: show.bpm,
    saved: Boolean(show.isSaved),
    fixtureCount: show.fixturePool.fixtures.length,
    groupCount: show.groupPool.groups.length,
    universes: show.universePool.universes.map((universe) => ({
      id: universe.id,
      name: universe.name,
      color: universe.color,
      fixtureCount: universe.fixturePool.fixtures.length,
      usedChannels: universe.fixturePool.fixtures.reduce(
        (total, fixture) => total + fixture.channels.length,
        0,
      ),
    })),
    fixtures: show.fixturePool.fixtures.map(summariseFixture),
    groups: show.groupPool.groups.map(summariseGroup),
  }),
});

registerCommand('get_fixture', {
  description: 'Returns full detail for one patched fixture: addressing, 3D '
    + 'position and rotation, available quick accessors and every channel value.',
  args: {
    id: {
      type: 'number', required: true, integer: true, min: 0,
    },
  },
  handler: (show, args) => {
    const fixture = show.fixturePool.getFromId(args.id);
    return {
      id: fixture.id,
      name: fixture.name,
      manufacturer: fixture.manufacturer,
      model: fixture.model,
      mode: fixture.modeName,
      category: fixture.category,
      universe: fixture.universe,
      chStart: fixture.chStart,
      chStop: fixture.chStop,
      chCount: fixture.channels.length,
      position: {
        x: fixture.position.x,
        y: fixture.position.y,
        z: fixture.position.z,
      },
      rotation: {
        x: fixture.rotation.x,
        y: fixture.rotation.y,
        z: fixture.rotation.z,
      },
      quickAccessors: Object.keys(fixture.quickChannelsAccessors).sort(),
      channels: fixture.channels.map((channel, index) => ({
        index,
        name: channel.name,
        type: channel.type,
        value: channel.value.DMX,
      })),
    };
  },
});

registerCommand('search_fixture_library', {
  description: 'Searches the bundled Open Fixture Library index by '
    + 'manufacturer or model substring. Returns manufacturer/model pairs ready '
    + 'to hand to patch_fixture.',
  args: {
    query: { type: 'string', required: true },
    limit: {
      type: 'number', integer: true, min: 1, max: 100, default: 20,
    },
  },
  handler: (show, args) => {
    const library = show.rawOFLFixtures || [];
    if (!library.length) {
      throw new Error('The OFL fixture library is empty -- the app has not '
        + 'finished preloading fixture_list.json yet.');
    }
    const needle = args.query.toLowerCase();
    const matches = [];
    library.forEach((entry) => {
      const manufacturer = entry.name;
      const manufacturerHit = manufacturer.toLowerCase().includes(needle);
      (entry.fixtures || []).forEach((file) => {
        const model = String(file).replace(/\.json$/i, '');
        if (manufacturerHit || model.toLowerCase().includes(needle)) {
          matches.push({ manufacturer, model, path: `${manufacturer}/${model}` });
        }
      });
    });
    return {
      total: matches.length,
      truncated: matches.length > args.limit,
      results: matches.slice(0, args.limit),
    };
  },
});
