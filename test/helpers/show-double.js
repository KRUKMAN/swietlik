import { vi } from 'vitest';
import FixturePool from '@/models/DMX/fixture.pool.model';
import UniversePool from '@/models/DMX/universe.pool.model';
import GroupPool from '@/models/DMX/group.pool.model';
import Master from '@/models/DMX/master.model';
import loadOFL from './ofl';

/**
 * Real Clay Paky Sharpy OFL definition, loaded from `public/fixtures`.
 *
 * @constant {Object}
 */
export const SHARPY = loadOFL('clay-paky/sharpy');

/**
 * Fixture-pool constructor payload built from the real Sharpy definition.
 *
 * The OFL payload is deep-cloned per call: `Fixture.prepareChannels` rewrites
 * `availableChannels[...].capability.type` when resolving fine aliases, so a
 * shared object would leak state between tests.
 *
 * @param {Object} [overrides={}] constructor-data overrides
 * @return {Object} fixture configuration object
 */
export function sharpyFixtureData(overrides = {}) {
  return {
    OFLData: JSON.parse(JSON.stringify(SHARPY)),
    universe: 0,
    manufacturer: 'clay-paky',
    model: 'sharpy',
    mode: 'Standard',
    name: 'Sharpy',
    chStart: 0,
    position: { x: 0, y: 0, z: 10 },
    rotation: { x: 180, y: 0, z: 0 },
    ...overrides,
  };
}

/**
 * Builds a plain stand-in for the reactive Show singleton.
 *
 * The pools are the REAL model classes -- only the members commands actually
 * touch are faked (`visualizerHandle`, `persistLocally`, `genShowFile`). A
 * plain object is used deliberately: `reactive()` wrapping is the bridge's job
 * (Task 7) and is asserted there, not here.
 *
 * @param {Object} [overrides={}] show-member overrides
 * @return {Object} show stand-in
 */
export function makeShowDouble(overrides = {}) {
  const fixturePool = new FixturePool();
  const universePool = new UniversePool();
  const groupPool = new GroupPool();
  universePool.addRaw();
  return {
    name: 'test_show',
    bpm: 120,
    isSaved: true,
    ready: true,
    rawOFLFixtures: [
      { name: 'clay-paky', fixtures: ['sharpy.json', 'alpha-beam-700.json'] },
      { name: 'american-dj', fixtures: ['dotz-par.json'] },
    ],
    fixturePool,
    universePool,
    groupPool,
    master: new Master(groupPool),
    visualizerHandle: {
      preferences: null,
      showData: { camera: 'default' },
      render: vi.fn(),
      renderer: {
        domElement: {
          width: 1280,
          height: 720,
          toDataURL: vi.fn(() => 'data:image/png;base64,UE5HREFUQQ=='),
        },
      },
    },
    persistLocally: vi.fn(),
    genShowFile: vi.fn(() => '{"name":"test_show"}'),
    ...overrides,
  };
}

/**
 * Adds a Sharpy to the show's fixture pool and patches it into its universe.
 *
 * @param {Object} show show stand-in from makeShowDouble
 * @param {Object} [overrides={}] fixture-data overrides
 * @return {Object} the patched Fixture instance
 */
export function patchSharpy(show, overrides = {}) {
  const fixture = show.fixturePool.addRaw(sharpyFixtureData(overrides));
  show.universePool.getFromId(fixture.universe).patchFixture(fixture);
  return fixture;
}
