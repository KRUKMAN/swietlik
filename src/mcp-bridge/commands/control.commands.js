import { registerCommand } from './registry';
import { ValidationError } from './validate';

/**
 * Live control: channel values, groups, cues, chases, playback and tempo.
 *
 * Every command validates its full payload -- including nested array entries --
 * and resolves every referenced model BEFORE mutating anything, so a request
 * that names one bad id leaves the show exactly as it was.
 *
 * @module mcp-bridge/commands/control.commands
 */

/**
 * Minimum and maximum DMX channel value.
 *
 * @constant {Number}
 * @private
 */
const DMX_MAX = 255;

/**
 * Shared argument schema for create_scene and create_effect.
 *
 * @constant {Object}
 * @private
 */
const CUE_ARGS = {
  group_id: {
    type: 'number', required: true, integer: true, min: 0,
  },
  name: { type: 'string' },
  color: { type: 'string' },
  duration: { type: 'number', min: 0, default: 1 },
  trigger_style: {
    type: 'number', integer: true, min: 0, max: 1, default: 0,
  },
  loop_style: {
    type: 'number', integer: true, min: 0, max: 1, default: 0,
  },
  relative: {
    type: 'number', integer: true, min: 0, max: 1, default: 0,
  },
};

/**
 * Validates the structure of a `channels` entry list.
 *
 * @param {Array<Object>} channels raw entries
 * @throws {ValidationError} on any malformed entry
 * @private
 */
function assertChannelEntries(channels) {
  channels.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new ValidationError(`Argument "channels[${index}]" must be an object`);
    }
    if (!Number.isInteger(entry.index) || entry.index < 0) {
      throw new ValidationError(
        `Argument "channels[${index}].index" must be a non-negative integer`,
      );
    }
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
      throw new ValidationError(`Argument "channels[${index}].value" must be a number`);
    }
    if (entry.value < 0 || entry.value > DMX_MAX) {
      throw new ValidationError(
        `Argument "channels[${index}].value" must be between 0 and ${DMX_MAX}`,
      );
    }
  });
}

/**
 * Validates the structure of an `accessors` entry list.
 *
 * @param {Array<Object>} accessors raw entries
 * @throws {ValidationError} on any malformed entry
 * @private
 */
function assertAccessorEntries(accessors) {
  accessors.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new ValidationError(`Argument "accessors[${index}]" must be an object`);
    }
    if (typeof entry.type !== 'string' || !entry.type.length) {
      throw new ValidationError(
        `Argument "accessors[${index}].type" must be a non-empty string`,
      );
    }
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
      throw new ValidationError(`Argument "accessors[${index}].value" must be a number`);
    }
    if (entry.value < 0 || entry.value > DMX_MAX) {
      throw new ValidationError(
        `Argument "accessors[${index}].value" must be between 0 and ${DMX_MAX}`,
      );
    }
    if (entry.index !== undefined && (!Number.isInteger(entry.index) || entry.index < 0)) {
      throw new ValidationError(
        `Argument "accessors[${index}].index" must be a non-negative integer`,
      );
    }
  });
}

registerCommand('set_channels', {
  description: 'Sets DMX values on one or more patched fixtures, either by '
    + 'fixture-relative channel index or by named quick accessor (Dimmer, Pan, '
    + 'Tilt, Zoom, Color, ...). Accessors a fixture lacks are reported as skipped.',
  args: {
    fixture_ids: {
      type: 'array', required: true, items: 'number', minLength: 1,
    },
    channels: { type: 'array' },
    accessors: { type: 'array' },
  },
  handler: (show, args) => {
    if (args.channels === undefined && args.accessors === undefined) {
      throw new ValidationError('Provide at least one of "channels" or "accessors"');
    }
    const channels = args.channels || [];
    const accessors = args.accessors || [];
    assertChannelEntries(channels);
    assertAccessorEntries(accessors);

    // Resolve and bounds-check everything first -- no partial application.
    const fixtures = args.fixture_ids.map((id) => show.fixturePool.getFromId(id));
    fixtures.forEach((fixture) => {
      channels.forEach((entry) => {
        if (entry.index >= fixture.channels.length) {
          throw new Error(
            `Fixture ${fixture.id} has no channel at index ${entry.index} `
            + `(it has ${fixture.channels.length}).`,
          );
        }
      });
    });

    const updated = fixtures.map((fixture) => {
      const appliedChannels = [];
      const appliedAccessors = [];
      const skipped = [];
      channels.forEach((entry) => {
        fixture.setChannel(entry.index, entry.value);
        appliedChannels.push(entry.index);
      });
      accessors.forEach((entry) => {
        const selector = { type: entry.type, qaIndex: entry.index || 0 };
        if (fixture.hasQuickAccessor(selector)) {
          fixture.setQuickAccessor(selector, entry.value);
          appliedAccessors.push(entry.type);
        } else {
          skipped.push(entry.type);
        }
      });
      return {
        id: fixture.id,
        channels: appliedChannels,
        accessors: appliedAccessors,
        skipped,
      };
    });

    return { updated };
  },
});

registerCommand('create_group', {
  description: 'Creates an empty fixture group. Groups own the cues and chases '
    + 'that drive their fixtures.',
  args: {
    name: { type: 'string', required: true },
    color: { type: 'string' },
  },
  handler: (show, args) => {
    const group = show.groupPool.addRaw({ name: args.name, color: args.color });
    return { id: group.id, name: group.name, color: group.color };
  },
});

registerCommand('add_fixtures_to_group', {
  description: 'Adds patched fixtures to an existing group. Existing cues in '
    + 'the group pick the new fixtures up automatically.',
  args: {
    group_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    fixture_ids: {
      type: 'array', required: true, items: 'number', minLength: 1,
    },
  },
  handler: (show, args) => {
    const group = show.groupPool.getFromId(args.group_id);
    const fixtures = args.fixture_ids.map((id) => show.fixturePool.getFromId(id));
    fixtures.forEach((fixture) => group.addFixture(fixture));
    return {
      groupId: group.id,
      fixtureIds: fixtures.map((fixture) => fixture.id),
      fixtureCount: group.fixturePool.fixtures.length,
    };
  },
});

/**
 * Shared implementation for create_scene (type 0) and create_effect (type 1).
 *
 * @param {Number} type cue type -- 0 scene, 1 effect
 * @return {Function} registry handler
 * @private
 */
function makeCueHandler(type) {
  return (show, args) => {
    const group = show.groupPool.getFromId(args.group_id);
    const cue = group.addCue({
      type,
      name: args.name,
      color: args.color,
      triggerStyle: args.trigger_style,
      loopStyle: args.loop_style,
      duration: args.duration,
      relative: args.relative,
    });
    return {
      id: cue.id,
      groupId: group.id,
      type: cue.type,
      name: cue.name,
      duration: cue.duration,
    };
  };
}

registerCommand('create_scene', {
  description: 'Creates a scene cue (a static look that fades in over its '
    + 'duration) on a group. The group fixtures are injected automatically.',
  args: CUE_ARGS,
  handler: makeCueHandler(0),
});

registerCommand('create_effect', {
  description: 'Creates an effect cue (a time-varying modulation) on a group. '
    + 'The group fixtures are injected automatically.',
  args: CUE_ARGS,
  handler: makeCueHandler(1),
});

registerCommand('create_chase', {
  description: 'Creates a chase on a group -- a sequence of its cues triggered '
    + 'over time. Without cue_ids the chase takes every cue in the group.',
  args: {
    group_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    name: { type: 'string' },
    grid_index: { type: 'number', integer: true, min: 0 },
    color: { type: 'string' },
    duration: { type: 'number', min: 0, default: 1 },
    trigger: {
      type: 'number', integer: true, min: 0, max: 1, default: 0,
    },
    cue_ids: { type: 'array', items: 'number' },
  },
  handler: (show, args) => {
    const group = show.groupPool.getFromId(args.group_id);
    // getFromId throws for an id the group does not own -- resolve up front so
    // an unknown cue id fails before the chase is created.
    const cues = args.cue_ids
      ? args.cue_ids.map((id) => ({ cue: group.cuePool.getFromId(id).id }))
      : undefined;
    const chase = group.addChase({
      name: args.name,
      gridIndex: args.grid_index,
      color: args.color,
      duration: args.duration,
      trigger: args.trigger,
      cues,
    });
    return {
      id: chase.id,
      groupId: group.id,
      name: chase.name,
      gridIndex: chase.gridIndex,
      duration: chase.duration,
      cueCount: chase.cues.length,
    };
  },
});

registerCommand('play_cue', {
  description: 'Starts or stops a single cue on a group.',
  args: {
    group_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    cue_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    state: { type: 'boolean', default: true },
  },
  handler: (show, args) => {
    const group = show.groupPool.getFromId(args.group_id);
    const cue = group.cuePool.getFromId(args.cue_id);
    cue.cue(args.state);
    return {
      groupId: group.id,
      cueId: cue.id,
      state: args.state,
      cueState: cue.state,
    };
  },
});

registerCommand('play_chase', {
  description: 'Starts or stops a chase on a group. Starting one stops the '
    + 'other chases in the same group.',
  args: {
    group_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    chase_id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    state: { type: 'boolean', default: true },
  },
  handler: (show, args) => {
    const group = show.groupPool.getFromId(args.group_id);
    const chase = group.chasePool.getFromId(args.chase_id);
    group.cueChase(chase, args.state);
    return { groupId: group.id, chaseId: chase.id, state: args.state };
  },
});

registerCommand('stop_all', {
  description: 'Panic stop: stops every chase and every cue in every group and '
    + 'clears the master playing row.',
  args: {},
  handler: (show) => {
    let cuesStopped = 0;
    show.groupPool.groups.forEach((group) => {
      group.stopAllChases();
      group.cuePool.cues.forEach((cue) => {
        if (cue.state) {
          cuesStopped += 1;
        }
        cue.cue(false);
      });
    });
    show.master.playingRow = -1;
    return { groups: show.groupPool.groups.length, cuesStopped };
  },
});

registerCommand('master_row', {
  description: 'Triggers the master chase row across every group -- the '
    + 'equivalent of pressing a row button on the master grid. Toggles off when '
    + 'the row is already playing.',
  args: {
    row: {
      type: 'number', required: true, integer: true, min: 0,
    },
  },
  handler: (show, args) => ({
    row: args.row,
    playingRow: show.master.cueRow(args.row),
  }),
});

registerCommand('set_bpm', {
  description: 'Sets the show tempo in beats per minute. Drives every '
    + 'beat-quantised cue and chase.',
  args: {
    bpm: {
      type: 'number', required: true, min: 20, max: 400,
    },
  },
  handler: (show, args) => {
    show.bpm = args.bpm;
    return { bpm: show.bpm };
  },
});
