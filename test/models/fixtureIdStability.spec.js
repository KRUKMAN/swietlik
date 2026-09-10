import { describe, it, expect } from 'vitest';
import FixturePool from '@/models/DMX/fixture.pool.model';
import Fixture from '@/models/DMX/fixture.model';
import { loadOFL } from '../helpers/ofl';

const OFL = loadOFL('clay-paky/sharpy');
const data = (id, chStart) => ({ id, chStart, OFLData: OFL, manufacturer: 'clay-paky', model: 'sharpy', mode: 'Standard', universe: 0, name: 'S' + id, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } });

describe('FixturePool id stability across save/load (regression)', () => {
  it('reloading a pool after a mid-delete keeps serialized ids resolvable', () => {
    const pool = new FixturePool();
    pool.addRaw(data(undefined, 1));
    const mid = pool.addRaw(data(undefined, 20));
    pool.addRaw(data(undefined, 40));
    pool.delete(mid);
    const serialized = pool.showData; // ids [0, 2]
    const reloaded = new FixturePool();
    serialized.forEach((fd) => reloaded.addRaw({ ...fd, OFLData: OFL }));
    // the show loader resolves serialized ids against the reloaded pool
    expect(() => reloaded.getFromId(serialized[1].id)).not.toThrow();
  });
});

describe('Fixture showData mode round-trip (regression)', () => {
  it('serializes the running mode name, not undefined', () => {
    const f = new Fixture(data(0, 1));
    expect(f.showData.mode).toBe('Standard');
  });
});

describe('FixturePool#addRaw id fallback', () => {
  it('generates an id when the wanted id collides', () => {
    const pool = new FixturePool();
    pool.addRaw(data(7, 1));
    const second = pool.addRaw(data(7, 20));
    expect(second.id).not.toBe(7);
    expect(pool.fixtures).toHaveLength(2);
  });
});
