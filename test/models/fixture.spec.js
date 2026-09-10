import {
  describe, it, expect, beforeEach,
} from 'vitest';
import Fixture from '@/models/DMX/fixture.model';
import MovingHead, { created as movingHeads } from '../stubs/moving_head.stub';
import Controls, { calls as controlsCalls } from '../stubs/controls.stub';
import loadOFL from '../helpers/ofl';

/**
 * Real OFL definition, read straight off `public/fixtures`. Everything asserted
 * below is derived from this object rather than hardcoded, so the spec keeps
 * tracking the shipped fixture library if it is ever refreshed.
 *
 * The Sharpy is deliberately chosen: its first category is `Moving Head` (the
 * only category `Fixture.prepare3DModelInstance` supports), and its `Standard`
 * mode carries Pan/`Pan fine` + Tilt/`Tilt fine` pairs plus a plain Dimmer.
 */
const SHARPY = loadOFL('clay-paky/sharpy');

/**
 * The `Standard` mode is `modes[0]`, ie. the mode a Fixture falls back to.
 *
 * @constant {Object}
 */
const STANDARD_MODE = SHARPY.modes[0];

/**
 * Builds a Fixture from the real Sharpy definition.
 *
 * The OFL payload is deep-cloned per call because `Fixture.prepareChannels`
 * rewrites `availableChannels[...].capability.type` while resolving fine
 * channel aliases -- sharing one object across tests would leak that edit.
 *
 * @param {Object} [overrides={}] constructor-data overrides
 * @return {Fixture} proxified fixture instance
 */
function buildSharpy(overrides = {}) {
  return new Fixture({
    OFLData: JSON.parse(JSON.stringify(SHARPY)),
    id: 0,
    universe: 0,
    manufacturer: 'clay-paky',
    model: 'sharpy.json',
    mode: STANDARD_MODE.name,
    name: 'Sharpy 1',
    chStart: 1,
    ...overrides,
  });
}

/**
 * Locates a channel by its resolved `type`.
 *
 * @param {Fixture} fixture fixture instance
 * @param {String} type resolved channel type (eg. 'Dimmer', 'PanFine')
 * @return {Object} channel instance
 */
function channelOfType(fixture, type) {
  return fixture.channels.find((channel) => channel.type === type);
}

beforeEach(() => {
  MovingHead.reset();
  Controls.reset();
});

describe('Fixture -- mock strategy proof', () => {
  it('resolves the visualizer imports to the test stubs, not the Three.js modules', () => {
    const fixture = buildSharpy();

    // If the vitest alias table ever stops redirecting
    // `plugins/visualizer/moving_head`, this fixture would be backed by the
    // real (WebGL-bound) MovingHead and these two assertions would fail.
    expect(fixture._3DModel).toBeInstanceOf(MovingHead);
    expect(movingHeads).toHaveLength(1);
    expect(movingHeads[0]).toBe(fixture._3DModel);
  });
});

describe('Fixture -- channel parsing from real OFL data', () => {
  it('builds one channel per entry of the default (Standard) mode', () => {
    const fixture = buildSharpy();

    expect(fixture.modeName).toBe('Standard');
    expect(fixture.modeIndex).toBe(0);
    expect(fixture.channels).toHaveLength(STANDARD_MODE.channels.length);
    expect(fixture.channels).toHaveLength(16);
    // chStop is chStart + channel count.
    expect(fixture.chStop).toBe(1 + STANDARD_MODE.channels.length);
  });

  it('falls back to modes[0] when the requested mode name is unknown', () => {
    const fixture = buildSharpy({ mode: 'No Such Mode' });

    // modeIndex getter clamps an unresolved name to 0 ...
    expect(fixture.modeIndex).toBe(0);
    // ... so the Standard mode's channel list is what gets built.
    expect(fixture.channels).toHaveLength(STANDARD_MODE.channels.length);
  });

  it('takes its category from OFLData.categories[0]', () => {
    const fixture = buildSharpy();

    expect(SHARPY.categories[0]).toBe('Moving Head');
    expect(fixture.category).toBe('Moving Head');
  });

  it('strips the .json suffix from the model name', () => {
    const fixture = buildSharpy();

    expect(fixture.model).toBe('sharpy');
  });
});

describe('Fixture -- fine channel linkage', () => {
  it('links Pan -> "Pan fine" and Tilt -> "Tilt fine" through fineChannels', () => {
    const fixture = buildSharpy();

    const pan = channelOfType(fixture, 'Pan');
    const panFine = channelOfType(fixture, 'PanFine');
    const tilt = channelOfType(fixture, 'Tilt');
    const tiltFine = channelOfType(fixture, 'TiltFine');

    // The alias names come straight from the OFL definition.
    expect(SHARPY.availableChannels.Pan.fineChannelAliases).toEqual(['Pan fine']);
    expect(SHARPY.availableChannels.Tilt.fineChannelAliases).toEqual(['Tilt fine']);

    expect(pan.fineChannels).toHaveLength(1);
    expect(pan.fineChannels[0]).toBe(panFine);
    expect(tilt.fineChannels).toHaveLength(1);
    expect(tilt.fineChannels[0]).toBe(tiltFine);

    // Fine channels are flagged and never carry fine children of their own.
    expect(panFine.isFine).toBe(true);
    expect(tiltFine.isFine).toBe(true);
    expect(panFine.fineChannels).toHaveLength(0);
    expect(tiltFine.fineChannels).toHaveLength(0);

    // Mode ordering: the fine channel sits right after its coarse channel.
    expect(fixture.channels.indexOf(panFine)).toBe(fixture.channels.indexOf(pan) + 1);
    expect(fixture.channels.indexOf(tiltFine)).toBe(fixture.channels.indexOf(tilt) + 1);
  });

  it('writes the fractional remainder of a coarse value into the fine channel', () => {
    const fixture = buildSharpy();

    const pan = channelOfType(fixture, 'Pan');
    const panFine = channelOfType(fixture, 'PanFine');

    // 10.5 -> coarse ceil(10.5) = 11, fine ceil((10.5 % 1) * 255) = ceil(127.5) = 128
    fixture.setChannel(pan.id - 1, 10.5);

    expect(pan.value.DMX).toBe(11);
    expect(panFine.value.DMX).toBe(128);
  });

  it('exposes hasPan/hasTilt via the quick channel accessors', () => {
    const fixture = buildSharpy();

    expect(fixture.hasPan).toBe(true);
    expect(fixture.hasTilt).toBe(true);
    expect(fixture.hasDimmer).toBe(true);
    // The Sharpy is a colour-wheel fixture: no ColorIntensity channels at all.
    expect(fixture.hasColor).toBe(false);

    expect(fixture.quickChannelsAccessors.Pan).toHaveLength(1);
    expect(fixture.quickChannelsAccessors.PanFine).toHaveLength(1);
    expect(fixture.quickChannelsAccessors.Tilt).toHaveLength(1);
    expect(fixture.quickChannelsAccessors.TiltFine).toHaveLength(1);
  });
});

describe('Fixture -- 3D model instantiation', () => {
  it('passes the OFL-derived option bag to the MovingHead constructor', () => {
    const fixture = buildSharpy();

    const { options } = fixture._3DModel;

    // Beam angles come from physical.lens.degreesMinMax ([0, 3.8] for a Sharpy).
    expect(SHARPY.physical.lens.degreesMinMax).toEqual([0, 3.8]);
    expect(options.minAngle).toBe(SHARPY.physical.lens.degreesMinMax[0]);
    expect(options.maxAngle).toBe(SHARPY.physical.lens.degreesMinMax[1]);

    // Colour temperature comes from physical.bulb.
    expect(SHARPY.physical.bulb.colorTemperature).toBe(8000);
    expect(options.colorTemp).toBe(SHARPY.physical.bulb.colorTemperature);

    // Pan/tilt travel comes from the corresponding channel capabilities
    // (angleStart/angleEnd: 0..540deg pan, 0..250deg tilt).
    expect(options.minPan).toBe(0);
    expect(options.maxPan).toBe(540);
    expect(options.minTilt).toBe(0);
    expect(options.maxTilt).toBe(250);

    // Wheels are forwarded straight from the OFL wheel slots.
    expect(options.colorWheel).toEqual(SHARPY.wheels['Color Wheel'].slots);
    expect(options.goboWheel).toEqual(SHARPY.wheels['Gobo Wheel'].slots);

    // Static defaults.
    expect(options.intensity).toBe(0.0);
    expect(options.pan).toBe(128);
    expect(options.tilt).toBe(128);
  });

  it('pushes the fixture position and rotation onto the 3D model', () => {
    const fixture = buildSharpy({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 180, y: 0, z: 0 },
    });

    expect(fixture._3DModel.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(fixture._3DModel.rotation.x).toBeCloseTo(Math.PI, 10);
    expect(fixture.rotation.x).toBeCloseTo(180, 10);
  });

  it('throws for a fixture category the visualizer does not implement', () => {
    const notAHead = JSON.parse(JSON.stringify(SHARPY));
    notAHead.categories = ['Strobe'];

    expect(() => buildSharpy({ OFLData: notAHead }))
      .toThrow('This fixture type is not supported yet.');
  });
});

describe('Fixture#setChannel -- propagation into the 3D model', () => {
  it('writes the Dimmer channel through to _3DModel.intensity', () => {
    const fixture = buildSharpy();
    const dimmer = channelOfType(fixture, 'Dimmer');

    // The Dimmer channel is an OFL `Intensity` capability, whose only entity is
    // aliased `intensity` (0..1) -- so setChannel lands on _3DModel.intensity.
    expect(SHARPY.availableChannels.Dimmer.capability.type).toBe('Intensity');

    // The constructor zeroes every channel.
    expect(fixture._3DModel.intensity).toBe(0);

    fixture.setChannel(dimmer.id - 1, 255);
    expect(dimmer.value.DMX).toBe(255);
    expect(fixture._3DModel.intensity).toBe(1);

    fixture.setChannel(dimmer.id - 1, 128);
    expect(fixture._3DModel.intensity).toBeCloseTo(128 / 255, 10);
  });

  it('clamps channel values into the 0..255 DMX range', () => {
    const fixture = buildSharpy();
    const dimmer = channelOfType(fixture, 'Dimmer');

    fixture.setChannel(dimmer.id - 1, 900);
    expect(dimmer.value.DMX).toBe(255);

    fixture.setChannel(dimmer.id - 1, -50);
    expect(dimmer.value.DMX).toBe(0);
  });

  it('writes the Colour Wheel slot through to _3DModel.colorWheelSlot', () => {
    const fixture = buildSharpy();
    const colorWheel = channelOfType(fixture, 'Color Wheel');

    // dmxRange [0,0] on the Sharpy colour wheel is slot number 1 -> index 0.
    fixture.setChannel(colorWheel.id - 1, 0);
    expect(fixture._3DModel.colorWheelSlot).toBe(0);
  });
});

describe('Fixture#setChannel -- bounds checking', () => {
  // Regression: an out-of-range `id` used to fall straight through to
  // `channel.fineChannels` on `undefined`, throwing an opaque
  // "Cannot read properties of undefined (reading 'fineChannels')".
  it('throws a descriptive error for a channel id past the end of channels', () => {
    const fixture = buildSharpy();
    const outOfRange = fixture.channels.length;

    expect(() => fixture.setChannel(outOfRange, 100))
      .toThrow(`Invalid channel id ${outOfRange} for fixture ${fixture.name}`);
  });

  it('throws a descriptive error for a negative channel id', () => {
    const fixture = buildSharpy();

    expect(() => fixture.setChannel(-1, 100))
      .toThrow(`Invalid channel id ${-1} for fixture ${fixture.name}`);
  });

  it('throws a descriptive error for a non-integer channel id', () => {
    const fixture = buildSharpy();

    expect(() => fixture.setChannel(1.5, 100))
      .toThrow(`Invalid channel id ${1.5} for fixture ${fixture.name}`);
  });

  it('still sets valid, in-range channel ids normally', () => {
    const fixture = buildSharpy();
    const dimmer = channelOfType(fixture, 'Dimmer');

    expect(() => fixture.setChannel(dimmer.id - 1, 200)).not.toThrow();
    expect(dimmer.value.DMX).toBe(200);
  });
});

describe('Fixture -- highlighting delegates to the Controls singleton', () => {
  it('records an attach on the Controls stub when highlighting with centerControls', () => {
    const fixture = buildSharpy();
    expect(controlsCalls).toHaveLength(0);

    fixture.highlight(true, true);

    expect(fixture._3DModel.highlighted).toBe(true);
    expect(fixture.highlighted).toBe(true);
    expect(controlsCalls).toHaveLength(1);
    expect(controlsCalls[0].method).toBe('attach');
    expect(controlsCalls[0].args[0]).toBe(fixture);
  });

  it('records a detach when un-highlighting with centerControls', () => {
    const fixture = buildSharpy();

    fixture.highlight(true, true);
    fixture.highlight(false, true);

    expect(fixture._3DModel.highlighted).toBe(false);
    expect(controlsCalls.map((call) => call.method)).toEqual(['attach', 'detach']);
  });

  it('does not touch Controls when centerControls is left off', () => {
    const fixture = buildSharpy();

    fixture.highlight(true);

    expect(fixture._3DModel.highlighted).toBe(true);
    expect(controlsCalls).toHaveLength(0);
  });

  it('highlightSingle detaches everything before attaching the single fixture', () => {
    const fixture = buildSharpy();

    fixture.highlightSingle(true, true);
    expect(fixture._3DModel.singlyHighlighted).toBe(true);
    expect(controlsCalls.map((call) => call.method)).toEqual(['detachAll', 'attach']);

    Controls.reset();
    fixture.highlightSingle(false, true);
    expect(fixture._3DModel.singlyHighlighted).toBe(false);
    expect(controlsCalls.map((call) => call.method)).toEqual(['detachAll', 'setFocus']);
    expect(controlsCalls[1].args[0]).toBe(false);
  });
});

describe('Fixture.deleteInstance', () => {
  it('forwards the 3D model of a Moving Head to MovingHead.deleteInstance', () => {
    const fixture = buildSharpy();
    const model = fixture._3DModel;

    expect(model.deleted).toBe(false);

    Fixture.deleteInstance(fixture);

    expect(model.deleted).toBe(true);
  });

  it('is a no-op for a category the visualizer does not manage', () => {
    const fixture = buildSharpy();
    const model = fixture._3DModel;
    fixture.category = 'Strobe';

    Fixture.deleteInstance(fixture);

    expect(model.deleted).toBe(false);
  });
});
