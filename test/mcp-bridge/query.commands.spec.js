import {
  describe, it, expect, beforeEach,
} from 'vitest';
import { dispatch } from '@/mcp-bridge/commands/registry';
import '@/mcp-bridge/commands/query.commands';
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

beforeEach(() => {
  MovingHead.reset();
  Controls.reset();
});

describe('get_show_state', () => {
  it('summarises an empty show', async () => {
    const show = makeShowDouble();
    const state = resultOf(await dispatch(show, { id: 'q1', cmd: 'get_show_state', args: {} }));

    expect(state).toEqual({
      name: 'test_show',
      bpm: 120,
      saved: true,
      fixtureCount: 0,
      groupCount: 0,
      universes: [{
        id: 0,
        name: 'Universe 0',
        color: expect.any(String),
        fixtureCount: 0,
        usedChannels: 0,
      }],
      fixtures: [],
      groups: [],
    });
  });

  it('reports patched fixtures and per-universe channel usage', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const state = resultOf(await dispatch(show, { id: 'q2', cmd: 'get_show_state', args: {} }));

    expect(state.fixtureCount).toBe(1);
    expect(state.fixtures).toEqual([{
      id: fixture.id,
      name: 'Sharpy',
      manufacturer: 'clay-paky',
      model: 'sharpy',
      mode: 'Standard',
      universe: 0,
      chStart: 0,
      chCount: fixture.channels.length,
    }]);
    expect(state.universes[0].fixtureCount).toBe(1);
    expect(state.universes[0].usedChannels).toBe(fixture.channels.length);
  });

  it('summarises groups with their cues and chases', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const group = show.groupPool.addRaw({ name: 'Movers', color: '#ff0000' });
    group.addFixture(fixture);
    // DEVIATION from plan: `id` is passed explicitly here. Without it,
    // `CuePool.addRaw` falls through to `CuePool.genCueId()`, which reads
    // `this.chases` instead of `this.cues` (src/models/DMX/cue.pool.model.js:122)
    // -- a pre-existing upstream bug (present on `develop` too, introduced by
    // ASLS-org's own "lint, reformat and refactor everything" commit), out of
    // scope for Task 3's file list and for the additive-first/no-upstream-edit
    // Global Constraint. The real app never trips it because every UI call
    // site precomputes an id before calling `addCue`; this MCP query test
    // does the same to stay green without touching cue.pool.model.js.
    const cue = group.addCue({
      id: 0, type: 0, name: 'Blackout', duration: 2, relative: 0,
    });
    const chase = group.addChase({ name: 'Row 0', gridIndex: 0, duration: 4 });

    const state = resultOf(await dispatch(show, { id: 'q3', cmd: 'get_show_state', args: {} }));

    expect(state.groupCount).toBe(1);
    expect(state.groups[0]).toMatchObject({
      id: group.id,
      name: 'Movers',
      color: '#ff0000',
      fixtureIds: [fixture.id],
    });
    expect(state.groups[0].cues).toEqual([{
      id: cue.id, name: 'Blackout', type: 0, duration: 2, state: 0,
    }]);
    expect(state.groups[0].chases).toEqual([{
      id: chase.id, name: 'Row 0', gridIndex: 0, duration: 4, cueCount: 1,
    }]);
  });

  it('rejects unexpected arguments', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'q5', cmd: 'get_show_state', args: { verbose: true },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'get_show_state: Unknown argument "verbose". Accepted: (none)',
    });
  });
});

describe('get_fixture', () => {
  it('returns the full detail of a patched fixture', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    fixture.setChannel(0, 200);

    const detail = resultOf(await dispatch(show, {
      id: 'q6', cmd: 'get_fixture', args: { id: fixture.id },
    }));

    expect(detail).toMatchObject({
      id: fixture.id,
      name: 'Sharpy',
      manufacturer: 'clay-paky',
      model: 'sharpy',
      mode: 'Standard',
      universe: 0,
      chStart: 0,
      chStop: fixture.chStop,
      chCount: fixture.channels.length,
      position: { x: 0, y: 0, z: 10 },
      rotation: { x: 180, y: 0, z: 0 },
    });
    expect(detail.quickAccessors).toContain('Pan');
    expect(detail.quickAccessors).toContain('Tilt');
    expect(detail.channels).toHaveLength(fixture.channels.length);
    expect(detail.channels[0]).toEqual({
      index: 0,
      name: fixture.channels[0].name,
      type: fixture.channels[0].type,
      value: 200,
    });
  });

  it('sorts the quick accessor list so output is stable', async () => {
    const show = makeShowDouble();
    const fixture = patchSharpy(show);
    const detail = resultOf(await dispatch(show, {
      id: 'q7', cmd: 'get_fixture', args: { id: fixture.id },
    }));
    expect(detail.quickAccessors).toEqual([...detail.quickAccessors].sort());
  });

  it('returns COMMAND_ERROR for an unknown fixture id', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'q8', cmd: 'get_fixture', args: { id: 99 },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('COMMAND_ERROR');
    expect(envelope.error.message).toContain('get_fixture:');
  });

  it('requires the id argument', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'q9', cmd: 'get_fixture', args: {},
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'get_fixture: Missing required argument "id"',
    });
  });
});

describe('search_fixture_library', () => {
  it('matches on model name, case-insensitively', async () => {
    const found = resultOf(await dispatch(makeShowDouble(), {
      id: 'q10', cmd: 'search_fixture_library', args: { query: 'SHARPY' },
    }));

    expect(found).toEqual({
      total: 1,
      truncated: false,
      results: [{ manufacturer: 'clay-paky', model: 'sharpy', path: 'clay-paky/sharpy' }],
    });
  });

  it('matches on manufacturer name and strips the .json suffix', async () => {
    const found = resultOf(await dispatch(makeShowDouble(), {
      id: 'q11', cmd: 'search_fixture_library', args: { query: 'clay-paky' },
    }));
    expect(found.total).toBe(2);
    expect(found.results.map((item) => item.model)).toEqual(['sharpy', 'alpha-beam-700']);
  });

  it('truncates at the limit and flags it', async () => {
    const found = resultOf(await dispatch(makeShowDouble(), {
      id: 'q12', cmd: 'search_fixture_library', args: { query: 'a', limit: 1 },
    }));
    expect(found.results).toHaveLength(1);
    expect(found.truncated).toBe(true);
    expect(found.total).toBeGreaterThan(1);
  });

  it('returns an empty result set rather than an error', async () => {
    const found = resultOf(await dispatch(makeShowDouble(), {
      id: 'q13', cmd: 'search_fixture_library', args: { query: 'zzzznope' },
    }));
    expect(found).toEqual({ total: 0, truncated: false, results: [] });
  });

  it('errors when the fixture library has not been preloaded', async () => {
    const show = makeShowDouble({ rawOFLFixtures: [] });
    const envelope = await dispatch(show, {
      id: 'q14', cmd: 'search_fixture_library', args: { query: 'sharpy' },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.message).toContain('fixture library is empty');
  });

  it('rejects a limit above 100', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'q15', cmd: 'search_fixture_library', args: { query: 'a', limit: 500 },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'search_fixture_library: Argument "limit" must be <= 100',
    });
  });
});
