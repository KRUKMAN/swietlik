import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

// eslint-disable-next-line import/first
import axios from 'axios';
// eslint-disable-next-line import/first
import { dispatch } from '@/mcp-bridge/commands/registry';
// eslint-disable-next-line import/first
import { clearOFLCache } from '@/mcp-bridge/ofl';
// eslint-disable-next-line import/first, import/no-unresolved
import '@/mcp-bridge/commands/patch.commands';
// eslint-disable-next-line import/first
import MovingHead from '../stubs/moving_head.stub';
// eslint-disable-next-line import/first
import Controls from '../stubs/controls.stub';
// eslint-disable-next-line import/first
import { makeShowDouble, patchSharpy, SHARPY } from '../helpers/show-double';

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
 * Channel footprint of the Sharpy's Standard mode, read from the real OFL file.
 *
 * @constant {Number}
 */
const STANDARD_MODE_CHANNELS = SHARPY.modes
  .find((mode) => mode.name === 'Standard').channels.length;

beforeEach(() => {
  MovingHead.reset();
  Controls.reset();
  clearOFLCache();
  axios.get.mockReset();
  axios.get.mockResolvedValue({ data: JSON.parse(JSON.stringify(SHARPY)) });
});

describe('patch_fixture', () => {
  it('fetches OFL data, builds the fixture and patches it into the universe', async () => {
    const show = makeShowDouble();

    const patched = resultOf(await dispatch(show, {
      id: 'p1',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', mode: 'Standard' },
    }));

    expect(patched).toEqual({
      id: 0,
      name: 'Sharpy',
      manufacturer: 'clay-paky',
      model: 'sharpy',
      mode: 'Standard',
      universe: 0,
      chStart: 0,
      chCount: STANDARD_MODE_CHANNELS,
      autoAddressed: true,
    });
    expect(show.fixturePool.fixtures).toHaveLength(1);
    expect(show.universePool.getFromId(0).fixturePool.fixtures).toHaveLength(1);
  });

  it('attaches OFLData BEFORE addRaw, so the fixture parses its channels', async () => {
    const show = makeShowDouble();
    await dispatch(show, {
      id: 'p2',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy' },
    });

    const fixture = show.fixturePool.fixtures[0];
    expect(fixture.OFLData).toBeTruthy();
    expect(fixture.channels.length).toBe(STANDARD_MODE_CHANNELS);
    expect(Object.keys(fixture.quickChannelsAccessors)).toContain('Pan');
  });

  it('defaults to the first OFL mode when mode is omitted', async () => {
    const show = makeShowDouble();
    const patched = resultOf(await dispatch(show, {
      id: 'p3',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy' },
    }));
    expect(patched.mode).toBe(SHARPY.modes[0].name);
  });

  it('auto-addresses the next free slot for a second fixture', async () => {
    const show = makeShowDouble();
    await dispatch(show, {
      id: 'p4a', cmd: 'patch_fixture', args: { manufacturer: 'clay-paky', model: 'sharpy' },
    });
    const second = resultOf(await dispatch(show, {
      id: 'p4b', cmd: 'patch_fixture', args: { manufacturer: 'clay-paky', model: 'sharpy' },
    }));

    expect(second.chStart).toBe(STANDARD_MODE_CHANNELS);
    expect(second.autoAddressed).toBe(true);
  });

  it('honours an explicit ch_start and reports autoAddressed false', async () => {
    const show = makeShowDouble();
    const patched = resultOf(await dispatch(show, {
      id: 'p5',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', ch_start: 100 },
    }));
    expect(patched.chStart).toBe(100);
    expect(patched.autoAddressed).toBe(false);
  });

  it('applies name, position and rotation', async () => {
    const show = makeShowDouble();
    resultOf(await dispatch(show, {
      id: 'p6',
      cmd: 'patch_fixture',
      args: {
        manufacturer: 'clay-paky',
        model: 'sharpy',
        name: 'Stage Left Mover',
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 10, y: 20, z: 30 },
      },
    }));

    const fixture = show.fixturePool.fixtures[0];
    expect(fixture.name).toBe('Stage Left Mover');
    expect(fixture.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(fixture.rotation.x).toBe(10);
    expect(fixture.rotation.y).toBe(20);
    // Fixture's rotation getter round-trips through degToRad/radToDeg
    // (Math.PI/180, 180/Math.PI); 30 does not survive that round trip exactly
    // (yields 29.999999999999996) even though 0/10/20/45/90/180/270 do. This
    // is pre-existing upstream float behaviour, not a patch.commands defect.
    expect(fixture.rotation.z).toBeCloseTo(30, 10);
  });

  it('reuses the OFL cache across two patches of the same model', async () => {
    const show = makeShowDouble();
    await dispatch(show, {
      id: 'p7a', cmd: 'patch_fixture', args: { manufacturer: 'clay-paky', model: 'sharpy' },
    });
    await dispatch(show, {
      id: 'p7b', cmd: 'patch_fixture', args: { manufacturer: 'clay-paky', model: 'sharpy' },
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown mode, naming the available ones', async () => {
    const show = makeShowDouble();
    const envelope = await dispatch(show, {
      id: 'p8',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', mode: 'Turbo' },
    });

    expect(envelope.error.code).toBe('VALIDATION');
    expect(envelope.error.message).toContain('Argument "mode" must be one of:');
    expect(envelope.error.message).toContain(SHARPY.modes[0].name);
    expect(show.fixturePool.fixtures).toHaveLength(0);
  });

  it('reports a COMMAND_ERROR for an unknown universe and patches nothing', async () => {
    const show = makeShowDouble();
    const envelope = await dispatch(show, {
      id: 'p9',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', universe: 7 },
    });

    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
    expect(show.fixturePool.fixtures).toHaveLength(0);
  });

  it('surfaces an OFL fetch failure as a COMMAND_ERROR', async () => {
    axios.get.mockRejectedValue(new Error('Request failed with status code 404'));
    const show = makeShowDouble();
    const envelope = await dispatch(show, {
      id: 'p10', cmd: 'patch_fixture', args: { manufacturer: 'nope', model: 'nope' },
    });

    expect(envelope.error.code).toBe('COMMAND_ERROR');
    expect(envelope.error.message).toContain('Could not load OFL definition for nope/nope');
    expect(show.fixturePool.fixtures).toHaveLength(0);
  });

  it('errors when the universe has no contiguous space left', async () => {
    const show = makeShowDouble();
    const envelope = await dispatch(show, {
      id: 'p11',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', ch_start: 511 },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
  });

  it('rolls the fixture back out of the pool when patching throws', async () => {
    const show = makeShowDouble();
    const universe = show.universePool.getFromId(0);
    vi.spyOn(universe, 'patchFixture').mockImplementation(() => {
      throw new Error('Cannot patch fixture on this interval');
    });

    const envelope = await dispatch(show, {
      id: 'p12', cmd: 'patch_fixture', args: { manufacturer: 'clay-paky', model: 'sharpy' },
    });

    expect(envelope.error.message).toContain('Cannot patch fixture on this interval');
    expect(show.fixturePool.fixtures).toHaveLength(0);
  });

  it('requires manufacturer and model', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'p13', cmd: 'patch_fixture', args: { model: 'sharpy' },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'patch_fixture: Missing required argument "manufacturer"',
    });
  });

  it('validates the position vector', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'p14',
      cmd: 'patch_fixture',
      args: { manufacturer: 'clay-paky', model: 'sharpy', position: { x: 0, y: 0 } },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'patch_fixture: Argument "position.z" must be a number',
    });
  });
});

describe('unpatch_fixture', () => {
  it('removes the fixture from both the universe and the show pool', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);

    const removed = resultOf(await dispatch(show, {
      id: 'u1', cmd: 'unpatch_fixture', args: { id: fixture.id },
    }));

    expect(removed).toEqual({
      id: fixture.id, universe: 0, chStart: 0, unpatched: true,
    });
    expect(show.fixturePool.fixtures).toHaveLength(0);
    expect(show.universePool.getFromId(0).fixturePool.fixtures).toHaveLength(0);
  });

  it('frees the address range for a later patch', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    await dispatch(show, { id: 'u2', cmd: 'unpatch_fixture', args: { id: fixture.id } });

    expect(show.universePool.getFromId(0).findChStartAutoPatch(1, 1)).toBe(0);
  });

  it('errors on an unknown fixture id', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'u3', cmd: 'unpatch_fixture', args: { id: 42 },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
  });
});

describe('move_fixture', () => {
  it('sets position through the per-axis setters so the 3D model follows', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);

    const moved = resultOf(await dispatch(show, {
      id: 'm1',
      cmd: 'move_fixture',
      args: { id: fixture.id, position: { x: 4, y: -2, z: 6 } },
    }));

    expect(moved.position).toEqual({ x: 4, y: -2, z: 6 });
    expect(fixture.posX).toBe(4);
    expect(fixture.posY).toBe(-2);
    expect(fixture.posZ).toBe(6);
  });

  it('sets rotation independently of position', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);

    const moved = resultOf(await dispatch(show, {
      id: 'm2',
      cmd: 'move_fixture',
      args: { id: fixture.id, rotation: { x: 90, y: 45, z: 0 } },
    }));

    expect(moved.rotation).toEqual({ x: 90, y: 45, z: 0 });
    expect(moved.position).toEqual({ x: 0, y: 0, z: 10 });
    expect(fixture.rotX).toBe(90);
  });

  it('requires at least one of position or rotation', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const envelope = await dispatch(show, {
      id: 'm3', cmd: 'move_fixture', args: { id: fixture.id },
    });

    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'move_fixture: Provide at least one of "position" or "rotation"',
    });
  });

  it('validates the rotation vector', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const envelope = await dispatch(show, {
      id: 'm4',
      cmd: 'move_fixture',
      args: { id: fixture.id, rotation: { x: 0, y: 0, z: 'spin' } },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'move_fixture: Argument "rotation.z" must be a number',
    });
  });
});
