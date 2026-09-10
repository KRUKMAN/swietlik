import { registerCommand } from './registry';
import { ValidationError, assertVec3 } from './validate';
import { fetchOFL } from '../ofl';

/**
 * Fixture patching, unpatching and 3D placement.
 *
 * `patch_fixture` is a deliberate composite: the `Fixture` constructor parses
 * its OFL definition synchronously, so the definition MUST be attached as
 * `fixtureData.OFLData` before `fixturePool.addRaw`. Patching into the universe
 * is a second, separate step. Owning both here is what stops a caller from
 * producing a silently broken fixture.
 *
 * @module mcp-bridge/commands/patch.commands
 */

/**
 * Picks the requested OFL mode, or the first one when none was asked for.
 *
 * @param {Object} oflData parsed OFL definition
 * @param {String} [requested] mode name from the caller
 * @return {Object} the selected OFL mode
 * @throws {Error} when the definition declares no modes
 * @throws {ValidationError} when the requested mode does not exist
 * @private
 */
function selectMode(oflData, requested) {
  const modes = Array.isArray(oflData.modes) ? oflData.modes : [];
  if (!modes.length) {
    throw new Error('This OFL definition declares no modes and cannot be patched.');
  }
  if (requested === undefined) {
    return modes[0];
  }
  const mode = modes.find((candidate) => candidate.name === requested);
  if (!mode) {
    const names = modes.map((candidate) => candidate.name).join(', ');
    throw new ValidationError(`Argument "mode" must be one of: ${names}`);
  }
  return mode;
}

/**
 * Builds a fresh zeroed 3D vector.
 *
 * A new object every call, never a shared constant: `Fixture`'s constructor
 * keeps `data.position` by reference (`fixture.model.js:164`), so one shared
 * literal would alias every unplaced fixture's coordinates together.
 *
 * @return {Object} `{ x: 0, y: 0, z: 0 }`
 * @private
 */
function origin() {
  return { x: 0, y: 0, z: 0 };
}

registerCommand('patch_fixture', {
  description: 'Patches a fixture from the Open Fixture Library into a '
    + 'universe. Fetches the OFL definition, builds the fixture and addresses '
    + 'it automatically unless ch_start is given.',
  args: {
    manufacturer: { type: 'string', required: true },
    model: { type: 'string', required: true },
    mode: { type: 'string' },
    name: { type: 'string' },
    universe: {
      type: 'number', integer: true, min: 0, default: 0,
    },
    ch_start: {
      type: 'number', integer: true, min: 0, max: 511,
    },
    position: { type: 'object' },
    rotation: { type: 'object' },
  },
  handler: async (show, args) => {
    // Concrete defaults, never `undefined`. `Fixture`'s constructor falls back
    // to `position = { x: this.id, ... }` when `data.position` is missing, and
    // `this.id` is `parseInt(data.id, 10)` -- NaN here, because `addRaw`
    // assigns the real id only AFTER construction (fixture.pool.model.js:96).
    // An omitted position would otherwise land the fixture at x: NaN.
    const position = args.position ? assertVec3('position', args.position) : origin();
    const rotation = args.rotation ? assertVec3('rotation', args.rotation) : origin();

    const universe = show.universePool.getFromId(args.universe);
    const oflData = await fetchOFL(args.manufacturer, args.model);
    const mode = selectMode(oflData, args.mode);
    const chCount = mode.channels.length;

    const autoAddressed = args.ch_start === undefined;
    const chStart = autoAddressed
      ? universe.findChStartAutoPatch(chCount, 1)
      : args.ch_start;
    if (chStart < 0) {
      throw new Error(`Universe ${args.universe} has no free block of ${chCount} channels.`);
    }
    if (chStart + chCount > 512) {
      throw new Error(
        `A ${chCount}-channel fixture does not fit at address ${chStart} (universe is 512 wide).`,
      );
    }

    // OFLData MUST be attached before addRaw -- the Fixture constructor parses
    // it synchronously (see fixture.model.js:174).
    const fixtureData = {
      OFLData: oflData,
      universe: args.universe,
      manufacturer: args.manufacturer,
      model: args.model,
      mode: mode.name,
      // Falls back to the OFL definition's own name, matching the patch popup's
      // default (universe.modifier.popup.patch.vue: `name: res.data.name`) --
      // otherwise Fixture's constructor defaults an unnamed patch to the
      // generic "Unknown Fixture".
      name: args.name || oflData.name,
      category: Array.isArray(oflData.categories) ? oflData.categories[0] : undefined,
      chStart,
      position,
      rotation,
    };

    const fixture = show.fixturePool.addRaw(fixtureData);
    try {
      universe.patchFixture(fixture);
    } catch (err) {
      show.fixturePool.delete(fixture, true);
      throw err;
    }

    return {
      id: fixture.id,
      name: fixture.name,
      manufacturer: fixture.manufacturer,
      model: fixture.model,
      mode: fixture.modeName,
      universe: fixture.universe,
      chStart: fixture.chStart,
      chCount: fixture.channels.length,
      autoAddressed,
    };
  },
});

registerCommand('unpatch_fixture', {
  description: 'Removes a fixture from its universe and from the show, freeing '
    + 'its DMX address range.',
  args: {
    id: {
      type: 'number', required: true, integer: true, min: 0,
    },
  },
  handler: (show, args) => {
    const fixture = show.fixturePool.getFromId(args.id);
    const summary = {
      id: fixture.id,
      universe: fixture.universe,
      chStart: fixture.chStart,
      unpatched: true,
    };
    show.universePool.getFromId(fixture.universe).unpatchFixture(fixture);
    show.fixturePool.delete(fixture, true);
    return summary;
  },
});

registerCommand('move_fixture', {
  description: 'Sets a patched fixture 3D position (metres) and/or rotation '
    + '(degrees) in the visualizer. At least one of the two is required.',
  args: {
    id: {
      type: 'number', required: true, integer: true, min: 0,
    },
    position: { type: 'object' },
    rotation: { type: 'object' },
  },
  handler: (show, args) => {
    if (args.position === undefined && args.rotation === undefined) {
      throw new ValidationError('Provide at least one of "position" or "rotation"');
    }
    const position = args.position ? assertVec3('position', args.position) : null;
    const rotation = args.rotation ? assertVec3('rotation', args.rotation) : null;
    const fixture = show.fixturePool.getFromId(args.id);

    if (position) {
      fixture.posX = position.x;
      fixture.posY = position.y;
      fixture.posZ = position.z;
    }
    if (rotation) {
      fixture.rotX = rotation.x;
      fixture.rotY = rotation.y;
      fixture.rotZ = rotation.z;
    }

    return {
      id: fixture.id,
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
    };
  },
});
