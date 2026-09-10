import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { dispatch } from '@/mcp-bridge/commands/registry';
import '@/mcp-bridge/commands/control.commands';
import MovingHead from '../stubs/moving_head.stub';
import Controls from '../stubs/controls.stub';
import { makeShowDouble, patchSharpy } from '../helpers/show-double';

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
 * Builds a show with one patched Sharpy already in one group.
 *
 * @return {Object} `{ show, fixture, group }`
 */
function showWithGroup() {
  const show = makeShowDouble();
  const fixture = patchSharpy(show);
  const group = show.groupPool.addRaw({ name: 'Movers', color: '#00ff00' });
  group.addFixture(fixture);
  return { show, fixture, group };
}

beforeEach(() => {
  MovingHead.reset();
  Controls.reset();
});

describe('set_channels -- raw channel indices', () => {
  it('sets a raw channel on one fixture', async () => {
    const { show, fixture } = showWithGroup();

    const applied = resultOf(await dispatch(show, {
      id: 'c1',
      cmd: 'set_channels',
      args: { fixture_ids: [fixture.id], channels: [{ index: 0, value: 255 }] },
    }));

    expect(applied).toEqual({
      updated: [{
        id: fixture.id, channels: [0], accessors: [], skipped: [],
      }],
    });
    expect(fixture.channels[0].value.DMX).toBe(255);
  });

  it('applies the same channel set to several fixtures', async () => {
    const show = makeShowDouble();
    const first = patchSharpy(show);
    const second = patchSharpy(show, { chStart: 100 });

    const applied = resultOf(await dispatch(show, {
      id: 'c2',
      cmd: 'set_channels',
      args: { fixture_ids: [first.id, second.id], channels: [{ index: 0, value: 128 }] },
    }));

    expect(applied.updated.map((entry) => entry.id)).toEqual([first.id, second.id]);
    expect(first.channels[0].value.DMX).toBe(128);
    expect(second.channels[0].value.DMX).toBe(128);
  });

  it('rejects a channel index the fixture does not have, mutating nothing', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c3',
      cmd: 'set_channels',
      args: {
        fixture_ids: [fixture.id],
        channels: [{ index: 0, value: 255 }, { index: 999, value: 255 }],
      },
    });

    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
    expect(envelope.error.message).toContain('has no channel at index 999');
    expect(fixture.channels[0].value.DMX).toBe(0);
  });

  it('rejects an out-of-range DMX value', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c4',
      cmd: 'set_channels',
      args: { fixture_ids: [fixture.id], channels: [{ index: 0, value: 300 }] },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'set_channels: Argument "channels[0].value" must be between 0 and 255',
    });
  });

  it('rejects a non-integer channel index', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c5',
      cmd: 'set_channels',
      args: { fixture_ids: [fixture.id], channels: [{ index: 1.5, value: 10 }] },
    });
    expect(envelope.error.message)
      .toBe('set_channels: Argument "channels[0].index" must be a non-negative integer');
  });

  it('requires at least one of channels or accessors', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c6', cmd: 'set_channels', args: { fixture_ids: [fixture.id] },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'set_channels: Provide at least one of "channels" or "accessors"',
    });
  });

  it('rejects an empty fixture_ids list', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'c7',
      cmd: 'set_channels',
      args: { fixture_ids: [], channels: [{ index: 0, value: 1 }] },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'set_channels: Argument "fixture_ids" must contain at least 1 item(s)',
    });
  });

  it('fails before mutating anything when one fixture id is unknown', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c8',
      cmd: 'set_channels',
      args: { fixture_ids: [fixture.id, 404], channels: [{ index: 0, value: 255 }] },
    });
    expect(envelope.ok).toBe(false);
    expect(fixture.channels[0].value.DMX).toBe(0);
  });

  it('rejects a non-integer fixture id, mutating nothing', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c13',
      cmd: 'set_channels',
      args: { fixture_ids: [1.5], channels: [{ index: 0, value: 255 }] },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'set_channels: Argument "fixture_ids[0]" must be a non-negative integer',
    });
    expect(fixture.channels[0].value.DMX).toBe(0);
  });
});

describe('set_channels -- quick accessors', () => {
  it('sets Pan and Tilt by name', async () => {
    const { show, fixture } = showWithGroup();

    const applied = resultOf(await dispatch(show, {
      id: 'c9',
      cmd: 'set_channels',
      args: {
        fixture_ids: [fixture.id],
        accessors: [{ type: 'Pan', value: 200 }, { type: 'Tilt', value: 100 }],
      },
    }));

    expect(applied.updated[0].accessors).toEqual(['Pan', 'Tilt']);
    expect(applied.updated[0].skipped).toEqual([]);
    expect(fixture.getQuickAccessor({ type: 'Pan' }).value.DMX).toBe(200);
    expect(fixture.getQuickAccessor({ type: 'Tilt' }).value.DMX).toBe(100);
  });

  it('reports an accessor the fixture lacks as skipped, not as an error', async () => {
    const { show, fixture } = showWithGroup();

    const applied = resultOf(await dispatch(show, {
      id: 'c10',
      cmd: 'set_channels',
      args: {
        fixture_ids: [fixture.id],
        accessors: [{ type: 'Pan', value: 10 }, { type: 'NoSuchAccessor', value: 10 }],
      },
    }));

    expect(applied.updated[0].accessors).toEqual(['Pan']);
    expect(applied.updated[0].skipped).toEqual(['NoSuchAccessor']);
  });

  it('rejects an accessor entry with no type', async () => {
    const { show, fixture } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'c11',
      cmd: 'set_channels',
      args: { fixture_ids: [fixture.id], accessors: [{ value: 10 }] },
    });
    expect(envelope.error.message)
      .toBe('set_channels: Argument "accessors[0].type" must be a non-empty string');
  });

  it('combines raw channels and accessors in one call', async () => {
    const { show, fixture } = showWithGroup();
    const applied = resultOf(await dispatch(show, {
      id: 'c12',
      cmd: 'set_channels',
      args: {
        fixture_ids: [fixture.id],
        channels: [{ index: 0, value: 64 }],
        accessors: [{ type: 'Pan', value: 32 }],
      },
    }));
    expect(applied.updated[0]).toEqual({
      id: fixture.id, channels: [0], accessors: ['Pan'], skipped: [],
    });
  });
});

describe('create_group and add_fixtures_to_group', () => {
  it('creates a group with the given name and colour', async () => {
    const show = makeShowDouble();
    const created = resultOf(await dispatch(show, {
      id: 'g1', cmd: 'create_group', args: { name: 'Back Truss', color: '#123456' },
    }));

    expect(created).toEqual({ id: 0, name: 'Back Truss', color: '#123456' });
    expect(show.groupPool.groups).toHaveLength(1);
  });

  it('falls back to the pool colour palette when no colour is given', async () => {
    const show = makeShowDouble();
    const created = resultOf(await dispatch(show, {
      id: 'g2', cmd: 'create_group', args: { name: 'Front' },
    }));
    // ukColors resolves CSS custom properties via getComputedStyle, which jsdom
    // never populates -- every palette entry is '' under Vitest. The existing
    // suite already works around this the same way (test/models/pools.spec.js
    // -- "falls back to a generated name and colour when none were supplied").
    // Assert the fallback path was taken (a string, not undefined/null), not a
    // literal hex value.
    expect(typeof created.color).toBe('string');
  });

  it('requires a name', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'g3', cmd: 'create_group', args: {},
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'create_group: Missing required argument "name"',
    });
  });

  it('adds fixtures to an existing group', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const group = show.groupPool.addRaw({ name: 'Movers' });

    const added = resultOf(await dispatch(show, {
      id: 'g4',
      cmd: 'add_fixtures_to_group',
      args: { group_id: group.id, fixture_ids: [fixture.id] },
    }));

    expect(added).toEqual({ groupId: group.id, fixtureIds: [fixture.id], fixtureCount: 1 });
    expect(group.fixturePool.fixtures).toHaveLength(1);
  });

  it('errors on an unknown group id without adding anything', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const envelope = await dispatch(show, {
      id: 'g5',
      cmd: 'add_fixtures_to_group',
      args: { group_id: 9, fixture_ids: [fixture.id] },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
  });

  it('rejects a non-integer fixture id, adding nothing', async () => {
    const show = makeShowDouble();
    const group = show.groupPool.addRaw({ name: 'Movers' });
    const envelope = await dispatch(show, {
      id: 'g6',
      cmd: 'add_fixtures_to_group',
      args: { group_id: group.id, fixture_ids: [2.2] },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'add_fixtures_to_group: Argument "fixture_ids[0]" must be a non-negative integer',
    });
    expect(group.fixturePool.fixtures).toHaveLength(0);
  });
});

describe('create_scene and create_effect', () => {
  it('creates a scene cue of type 0 on the group', async () => {
    const { show, group } = showWithGroup();

    const created = resultOf(await dispatch(show, {
      id: 's1',
      cmd: 'create_scene',
      args: { group_id: group.id, name: 'Warm Wash', duration: 4 },
    }));

    expect(created).toEqual({
      id: 0, groupId: group.id, type: 0, name: 'Warm Wash', duration: 4,
    });
    expect(group.cuePool.cues[0].type).toBe(0);
  });

  it('injects the group fixtures into the new cue', async () => {
    const { show, group, fixture } = showWithGroup();
    await dispatch(show, {
      id: 's2', cmd: 'create_scene', args: { group_id: group.id, name: 'Wash' },
    });
    const cue = group.cuePool.cues[0];
    expect(cue.fixtureValues.map((value) => value.fixture.id)).toEqual([fixture.id]);
  });

  it('creates an effect cue of type 1', async () => {
    const { show, group } = showWithGroup();
    const created = resultOf(await dispatch(show, {
      id: 's3', cmd: 'create_effect', args: { group_id: group.id, name: 'Sine Pan' },
    }));
    expect(created.type).toBe(1);
    expect(group.cuePool.cues[0].type).toBe(1);
  });

  it('defaults duration to 1 and both styles to 0', async () => {
    const { show, group } = showWithGroup();
    const created = resultOf(await dispatch(show, {
      id: 's4', cmd: 'create_scene', args: { group_id: group.id },
    }));
    expect(created.duration).toBe(1);
    expect(group.cuePool.cues[0].triggerStyle).toBe(0);
    expect(group.cuePool.cues[0].loopStyle).toBe(0);
  });

  it('rejects a trigger_style outside 0..1', async () => {
    const { show, group } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 's5', cmd: 'create_scene', args: { group_id: group.id, trigger_style: 5 },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'create_scene: Argument "trigger_style" must be <= 1',
    });
  });
});

describe('create_chase', () => {
  it('creates a chase that inherits every cue in the group', async () => {
    const { show, group } = showWithGroup();
    group.addCue({ type: 0, name: 'A' });
    group.addCue({ type: 0, name: 'B' });

    const created = resultOf(await dispatch(show, {
      id: 'h1',
      cmd: 'create_chase',
      args: {
        group_id: group.id, name: 'Row 0', grid_index: 0, duration: 8,
      },
    }));

    expect(created).toEqual({
      id: 0, groupId: group.id, name: 'Row 0', gridIndex: 0, duration: 8, cueCount: 2,
    });
  });

  it('restricts the chase to the named cue ids', async () => {
    const { show, group } = showWithGroup();
    const first = group.addCue({ type: 0, name: 'A' });
    group.addCue({ type: 0, name: 'B' });

    const created = resultOf(await dispatch(show, {
      id: 'h2',
      cmd: 'create_chase',
      args: { group_id: group.id, name: 'Only A', cue_ids: [first.id] },
    }));

    expect(created.cueCount).toBe(1);
  });

  it('errors when a named cue id is not in the group', async () => {
    const { show, group } = showWithGroup();
    const envelope = await dispatch(show, {
      id: 'h3',
      cmd: 'create_chase',
      args: { group_id: group.id, cue_ids: [77] },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
  });

  it('rejects a non-integer cue id, creating nothing', async () => {
    const { show, group } = showWithGroup();
    group.addCue({ type: 0, name: 'A' });

    const envelope = await dispatch(show, {
      id: 'h4',
      cmd: 'create_chase',
      args: { group_id: group.id, cue_ids: [0.5] },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'create_chase: Argument "cue_ids[0]" must be a non-negative integer',
    });
    expect(group.chasePool.chases).toHaveLength(0);
  });
});

describe('playback', () => {
  it('play_cue starts and stops a cue', async () => {
    const { show, group } = showWithGroup();
    const cue = group.addCue({ type: 0, name: 'Wash' });

    const started = resultOf(await dispatch(show, {
      id: 'pb1', cmd: 'play_cue', args: { group_id: group.id, cue_id: cue.id },
    }));
    expect(started).toEqual({
      groupId: group.id, cueId: cue.id, state: true, cueState: 1,
    });

    const stopped = resultOf(await dispatch(show, {
      id: 'pb2',
      cmd: 'play_cue',
      args: { group_id: group.id, cue_id: cue.id, state: false },
    }));
    expect(stopped.cueState).toBe(0);
  });

  it('play_chase forwards to Group#cueChase', async () => {
    const { show, group } = showWithGroup();
    group.addCue({ type: 0, name: 'A' });
    const chase = group.addChase({ name: 'Row 0' });
    const spy = vi.spyOn(group, 'cueChase');

    const played = resultOf(await dispatch(show, {
      id: 'pb3', cmd: 'play_chase', args: { group_id: group.id, chase_id: chase.id },
    }));

    expect(played).toEqual({ groupId: group.id, chaseId: chase.id, state: true });
    expect(spy).toHaveBeenCalledWith(chase, true);
  });

  it('stop_all stops every chase and every cue in every group', async () => {
    const { show, group } = showWithGroup();
    const cue = group.addCue({ type: 0, name: 'A' });
    const chase = group.addChase({ name: 'Row 0' });
    const chaseSpy = vi.spyOn(group, 'stopAllChases');
    cue.cue(true);
    expect(cue.state).toBe(1);

    const stopped = resultOf(await dispatch(show, {
      id: 'pb4', cmd: 'stop_all', args: {},
    }));

    expect(stopped).toEqual({ groups: 1, cuesStopped: 1 });
    expect(chaseSpy).toHaveBeenCalled();
    expect(cue.state).toBe(0);
    expect(chase.id).toBe(0);
    expect(show.master.playingRow).toBe(-1);
  });

  it('master_row triggers the chase row and reports the playing row', async () => {
    const { show, group } = showWithGroup();
    group.addCue({ type: 0, name: 'A' });
    group.addChase({ name: 'Row 0' });

    const fired = resultOf(await dispatch(show, {
      id: 'pb5', cmd: 'master_row', args: { row: 0 },
    }));

    expect(fired).toEqual({ row: 0, playingRow: 0 });
  });

  it('master_row reports -1 when no group has a chase on that row', async () => {
    const { show } = showWithGroup();
    const fired = resultOf(await dispatch(show, {
      id: 'pb6', cmd: 'master_row', args: { row: 3 },
    }));
    expect(fired).toEqual({ row: 3, playingRow: -1 });
  });
});

describe('set_bpm', () => {
  it('sets the show BPM', async () => {
    const show = makeShowDouble();
    const set = resultOf(await dispatch(show, {
      id: 'b1', cmd: 'set_bpm', args: { bpm: 128 },
    }));
    expect(set).toEqual({ bpm: 128 });
    expect(show.bpm).toBe(128);
  });

  it('rejects a BPM below 20', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'b2', cmd: 'set_bpm', args: { bpm: 1 },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'set_bpm: Argument "bpm" must be >= 20',
    });
  });

  it('rejects a BPM above 400', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'b3', cmd: 'set_bpm', args: { bpm: 900 },
    });
    expect(envelope.error.message).toBe('set_bpm: Argument "bpm" must be <= 400');
  });
});
