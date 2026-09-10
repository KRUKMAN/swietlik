import {
  describe, it, expect, beforeEach,
} from 'vitest';
import FixturePool from '@/models/DMX/fixture.pool.model';
import UniversePool from '@/models/DMX/universe.pool.model';
import Fixture from '@/models/DMX/fixture.model';
import MovingHead from '../stubs/moving_head.stub';
import Controls, { calls as controlsCalls } from '../stubs/controls.stub';
import loadOFL from '../helpers/ofl';

const SHARPY = loadOFL('clay-paky/sharpy');

/**
 * Fixture-pool constructor payload built from the real Sharpy definition.
 *
 * The OFL payload is cloned per call: `Fixture.prepareChannels` rewrites
 * `availableChannels[...].capability.type` when resolving fine aliases.
 *
 * @param {Object} [overrides={}] constructor-data overrides
 * @return {Object} fixture configuration object
 */
function sharpyData(overrides = {}) {
  return {
    OFLData: JSON.parse(JSON.stringify(SHARPY)),
    universe: 0,
    manufacturer: 'clay-paky',
    model: 'sharpy.json',
    mode: 'Standard',
    name: 'Sharpy',
    chStart: 1,
    ...overrides,
  };
}

beforeEach(() => {
  MovingHead.reset();
  Controls.reset();
});

describe('FixturePool#addRaw', () => {
  it('preserves a caller-supplied id, generating one on absence or collision', () => {
    const pool = new FixturePool();

    // Preserving serialized ids keeps universe/group cross-references valid
    // across a save -> load round trip (see fixtureIdStability.spec.js).
    const first = pool.addRaw(sharpyData({ id: 77 }));
    const second = pool.addRaw(sharpyData({ id: 77 })); // collision -> generated
    const third = pool.addRaw(sharpyData());

    expect(first.id).toBe(77);
    expect(second.id).not.toBe(77);
    expect(Number.isInteger(third.id)).toBe(true);
    expect(new Set(pool.fixtures.map((f) => f.id)).size).toBe(3);
  });

  it('keeps numbering above the highest id already in the pool after a delete', () => {
    const pool = new FixturePool();
    pool.addRaw(sharpyData());
    const second = pool.addRaw(sharpyData());
    pool.addRaw(sharpyData());

    pool.delete(second); // removes id 1, leaving [0, 2]

    // genFixtureId() reduces to the highest id present, then adds one.
    expect(pool.addRaw(sharpyData()).id).toBe(3);
  });

  it('addExisting pushes an already-built fixture without renumbering it', () => {
    const pool = new FixturePool();
    const built = pool.addRaw(sharpyData());
    const other = new FixturePool();

    other.addExisting(built);

    expect(other.fixtures).toHaveLength(1);
    expect(other.fixtures[0].id).toBe(built.id);
  });
});

describe('FixturePool#getFromId / #checkIfExists', () => {
  it('returns the fixture for a known id, coercing string ids', () => {
    const pool = new FixturePool();
    const fixture = pool.addRaw(sharpyData());

    expect(pool.getFromId(0)).toBe(fixture);
    expect(pool.getFromId('0')).toBe(fixture);
  });

  it('throws when the id is not in the pool', () => {
    const pool = new FixturePool();
    pool.addRaw(sharpyData());

    expect(() => pool.getFromId(99)).toThrow('Cannot find fixture in pool');
  });

  it('checkIfExists mirrors getFromId without throwing', () => {
    const pool = new FixturePool();
    pool.addRaw(sharpyData());

    expect(pool.checkIfExists(0)).toBe(true);
    expect(pool.checkIfExists('0')).toBe(true);
    expect(pool.checkIfExists(99)).toBe(false);
  });
});

describe('FixturePool#delete / #clearAll -- 3D model teardown', () => {
  it('un-highlights the fixture on delete but keeps the 3D model alive by default', () => {
    const pool = new FixturePool();
    const fixture = pool.addRaw(sharpyData());
    const model = fixture._3DModel;
    Controls.reset();

    pool.delete(fixture);

    expect(pool.fixtures).toHaveLength(0);
    // delete() always calls highlight(false, true), which detaches the gizmo.
    expect(controlsCalls.map((call) => call.method)).toEqual(['detach']);
    // Without `destroy`, Fixture.deleteInstance is never reached.
    expect(model.deleted).toBe(false);
  });

  it('cascades to MovingHead.deleteInstance when destroy is requested', () => {
    const pool = new FixturePool();
    const fixture = pool.addRaw(sharpyData());
    const model = fixture._3DModel;

    pool.delete(fixture, true);

    expect(pool.fixtures).toHaveLength(0);
    expect(model.deleted).toBe(true);
  });

  it('throws when deleting a fixture that is not in the pool', () => {
    const pool = new FixturePool();
    pool.addRaw(sharpyData());

    expect(() => pool.delete({ id: 99 })).toThrow('Could not find fixture in fixture pool');
  });

  it('clearAll(true) empties the pool and destroys every 3D model', () => {
    const pool = new FixturePool();
    const models = [
      pool.addRaw(sharpyData())._3DModel,
      pool.addRaw(sharpyData())._3DModel,
      pool.addRaw(sharpyData())._3DModel,
    ];

    pool.clearAll(true);

    expect(pool.fixtures).toHaveLength(0);
    expect(models.map((model) => model.deleted)).toEqual([true, true, true]);
  });

  it('clearAll() without destroy leaves the 3D models untouched', () => {
    const pool = new FixturePool();
    const model = pool.addRaw(sharpyData())._3DModel;

    pool.clearAll();

    expect(pool.fixtures).toHaveLength(0);
    expect(model.deleted).toBe(false);
  });
});

describe('FixturePool#showData / #listable', () => {
  it('exposes one show-data chunk per fixture', () => {
    const pool = new FixturePool();
    pool.addRaw(sharpyData({ name: 'Left', chStart: 1 }));
    pool.addRaw(sharpyData({ name: 'Right', chStart: 20 }));

    const { showData } = pool;

    expect(showData).toHaveLength(2);
    expect(Object.keys(showData[0]).sort()).toEqual([
      'category',
      'chStart',
      'id',
      'manufacturer',
      'mode',
      'model',
      'name',
      'position',
      'rotation',
      'universe',
    ]);
    expect(showData[0]).toMatchObject({
      id: 0,
      name: 'Left',
      model: 'sharpy',
      manufacturer: 'clay-paky',
      category: 'Moving Head',
      universe: 0,
      chStart: 1,
    });
    expect(showData[1]).toMatchObject({ id: 1, name: 'Right', chStart: 20 });

    // Default position is `{ x: id, y: universe, z: 10 }`, computed inside the
    // Fixture constructor -- ie. BEFORE FixturePool#addRaw overwrites the id.
    // With no id in the constructor data, `parseInt(undefined, 10)` leaves x
    // NaN. Documented upstream behaviour, hence the explicit NaN assertion.
    expect(showData[0].position.x).toBeNaN();
    expect(showData[0].position.y).toBe(0);
    expect(showData[0].position.z).toBe(10);
  });

  it('keeps the default position finite when the caller supplies an id', () => {
    const pool = new FixturePool();
    pool.addRaw(sharpyData({ id: 0, universe: 2 }));

    expect(pool.showData[0].position).toEqual({ x: 0, y: 2, z: 10 });
  });

  it('round-trips the mode name (upstream `modeNam` typo fixed)', () => {
    const pool = new FixturePool();
    pool.addRaw(sharpyData({ mode: 'Standard' }));

    expect(pool.fixtures[0].modeName).toBe('Standard');
    expect(pool.showData[0].mode).toBe('Standard');
  });

  it('exposes listable entries carrying the universe/address summary', () => {
    const pool = new FixturePool();
    pool.addRaw(sharpyData({ name: 'Left', chStart: 5 }));

    expect(pool.listable).toEqual([{
      name: 'Left',
      icon: 'movinghead',
      id: 0,
      universe: 0,
      more: 'U0 - CH5',
    }]);
  });
});

describe('UniversePool#addRaw', () => {
  it('assigns incrementing ids when none are supplied', () => {
    const pool = new UniversePool();

    const first = pool.addRaw();
    const second = pool.addRaw();
    const third = pool.addRaw();

    expect([first.id, second.id, third.id]).toEqual([0, 1, 2]);
    expect(pool.universes).toHaveLength(3);
  });

  it('honours an explicit non-zero id and numbers the next universe above it', () => {
    const pool = new UniversePool();

    const explicit = pool.addRaw({ id: 4, name: 'Stage' });

    expect(explicit.id).toBe(4);
    expect(explicit.name).toBe('Stage');
    expect(pool.addRaw().id).toBe(5);
  });

  it('re-generates the id when the supplied id is the falsy 0', () => {
    const pool = new UniversePool();
    pool.addRaw({ id: 7 });

    // `addRaw` guards with `if (!universe.id)`, so an explicit 0 is discarded
    // and replaced by genUniverseId() -- documented, not endorsed.
    expect(pool.addRaw({ id: 0 }).id).toBe(8);
  });

  it('defaults the universe name from its id', () => {
    const pool = new UniversePool();

    expect(pool.addRaw().name).toBe('Universe 0');
    expect(pool.addRaw().name).toBe('Universe 1');
  });
});

describe('UniversePool#getFromId', () => {
  it('returns the universe for a known id, coercing string ids', () => {
    const pool = new UniversePool();
    const universe = pool.addRaw();

    expect(pool.getFromId(0)).toBe(universe);
    expect(pool.getFromId('0')).toBe(universe);
  });

  it('throws when the id is not in the pool', () => {
    const pool = new UniversePool();
    pool.addRaw();

    expect(() => pool.getFromId(99)).toThrow('Cannot find universe in pool');
  });
});

describe('UniversePool#delete / #clearAll', () => {
  it('removes the universe from the pool', () => {
    const pool = new UniversePool();
    const first = pool.addRaw();
    const second = pool.addRaw();

    pool.delete(first);

    expect(pool.universes).toHaveLength(1);
    expect(pool.universes[0]).toBe(second);
  });

  it('throws when deleting a universe that is not in the pool', () => {
    const pool = new UniversePool();
    pool.addRaw();

    expect(() => pool.delete({ id: 99 })).toThrow('Could not find universe in universe pool');
  });

  it('clearAll empties the pool but does NOT destroy patched fixtures', () => {
    const pool = new UniversePool();
    const universe = pool.addRaw();
    const fixture = universe.fixturePool.addRaw(sharpyData());
    const model = fixture._3DModel;

    pool.clearAll();

    expect(pool.universes).toHaveLength(0);
    // UniversePool#delete only splices; teardown of the 3D model is the
    // FixturePool's job (Show#clearShowData calls fixturePool.clearAll(true)).
    expect(model.deleted).toBe(false);
  });
});

describe('Universe#showData -- nested fixture pool', () => {
  it('nests the patched fixtures under the universe chunk', () => {
    const pool = new UniversePool();
    const universe = pool.addRaw({ id: 3, name: 'Front', color: '#ff0000' });
    // Representative call pattern: real call sites (`show.model.js`,
    // `universe.modifier.popup.patch.vue`) build the fixture once -- either
    // via the Show-level fixturePool.addRaw or (as here) a plain constructed
    // Fixture -- and hand it to Universe#patchFixture, which is the only
    // thing that pushes it into the *universe's own* fixturePool
    // (`addExisting`). Also calling `universe.fixturePool.addRaw(...)`
    // first, as this test used to, pushes the same fixture into that same
    // local pool a second time -- a test artifact, not real `patchFixture`
    // behaviour.
    const fixture = new Fixture(sharpyData({ id: 0, name: 'Sharpy A', chStart: 1 }));
    universe.patchFixture(fixture);

    const { showData } = universe;

    expect(Object.keys(showData).sort()).toEqual(['color', 'fixtures', 'id', 'name']);
    expect(showData.id).toBe(3);
    expect(showData.name).toBe('Front');
    expect(showData.color).toBe('#ff0000');
    expect(showData.fixtures).toHaveLength(1);
    expect(showData.fixtures[0]).toMatchObject({
      id: 0,
      name: 'Sharpy A',
      universe: 3,
      chStart: 1,
    });
  });

  it('falls back to a generated name and colour when none were supplied', () => {
    const pool = new UniversePool();
    const universe = pool.addRaw();

    expect(universe.showData.name).toBe('Universe 0');
    expect(typeof universe.showData.color).toBe('string');
    expect(universe.showData.fixtures).toEqual([]);
  });
});

describe('Universe#checkPatchCapability', () => {
  // Regression: `return false` inside the old `Object.keys(...).forEach(...)`
  // callback only returned from that one invocation -- it never stopped the
  // loop and had zero effect on `checkPatchCapability`'s own return value, so
  // the function unconditionally fell through to `return true`. Collision
  // detection was completely dead.
  //
  it('rejects a range overlapping an already-patched fixture', () => {
    const pool = new UniversePool();
    const universe = pool.addRaw();
    const fixture = new Fixture(sharpyData({ id: 0, chStart: 1 }));
    universe.patchFixture(fixture);

    // fixture occupies [1, 1 + channels.length); start one channel inside it.
    const overlappingStart = fixture.chStart + 1;
    expect(universe.checkPatchCapability(overlappingStart, fixture.channels.length)).toBe(false);
  });

  it('rejects an overlapping fixture end-to-end through patchFixture', () => {
    // `patchFixture` guards via `fixture.chCount` -- the getter makes the
    // incoming width real so the collision check protects actual callers.
    const pool = new UniversePool();
    const universe = pool.addRaw();
    const first = new Fixture(sharpyData({ id: 0, chStart: 1 }));
    universe.patchFixture(first);
    expect(first.chCount).toBe(first.channels.length);

    const overlapping = new Fixture(sharpyData({ id: 1, chStart: first.chStart + 1 }));
    const before = universe.fixturePool.fixtures.length;
    expect(() => universe.patchFixture(overlapping)).toThrow(/Cannot patch/);
    expect(universe.fixturePool.fixtures.length).toBe(before);
  });

  it('allows an adjacent, non-overlapping range', () => {
    const pool = new UniversePool();
    const universe = pool.addRaw();
    const fixture = new Fixture(sharpyData({ id: 0, chStart: 1 }));
    universe.patchFixture(fixture);

    // Starting exactly at the patched fixture's chStop must be allowed:
    // [1, chStop) and [chStop, chStop + n) do not overlap.
    expect(universe.checkPatchCapability(fixture.chStop, fixture.channels.length)).toBe(true);
  });

  it('rejects a range whose end exceeds the 512-address universe length', () => {
    const pool = new UniversePool();
    const universe = pool.addRaw();

    expect(universe.checkPatchCapability(500, 20)).toBe(false);
  });

  it('allows a plain non-colliding, in-range patch', () => {
    const pool = new UniversePool();
    const universe = pool.addRaw();

    expect(universe.checkPatchCapability(1, 10)).toBe(true);
  });
});
