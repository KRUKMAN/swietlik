import { describe, it, expect } from 'vitest';
import Capability from '@/models/DMX/capabilityManager.model';
import loadOFL from '../helpers/ofl';

const sharpy = loadOFL('clay-paky/sharpy');
const rgbPar = loadOFL('acoustic-control/par-180-cob-3in1');

/**
 * Real "Shutter / Strobe" capability list from the Sharpy fixture, used
 * throughout this file so every assertion is anchored to actual OFL data
 * rather than a hand-rolled fixture.
 */
const shutterCapabilities = sharpy.availableChannels['Shutter / Strobe'].capabilities;

const strobeWithSpeedRange = shutterCapabilities.find(
  (cap) => cap.shutterEffect === 'Strobe' && cap.speedStart === '1Hz',
);
const openNoExtras = shutterCapabilities.find(
  (cap) => cap.shutterEffect === 'Open' && cap.dmxRange[0] === 104,
);
const strobeWithPresetSpeed = shutterCapabilities.find(
  (cap) => cap.speed === 'slow' && cap.randomTiming === true,
);

const panCapability = sharpy.availableChannels.Pan.capability;

const redChannelCapability = rgbPar.availableChannels.Red.capability;

describe('Capability -- dmxRange -> entity mapping (real OFL data)', () => {
  it('reads the capability dmxRange as its range, defaulting to [0,255] when absent', () => {
    const strobe = new Capability(strobeWithSpeedRange);
    expect(strobe.range).toEqual([4, 103]);

    const pan = new Capability(panCapability);
    expect(pan.range).toEqual([0, 255]); // Pan has no dmxRange -- single-capability channel
  });

  it('maps explicit *Start/*End entity values (Sharpy strobe speed 1Hz..12Hz)', () => {
    const strobe = new Capability(strobeWithSpeedRange);
    expect(strobe.entities.strobeFrequency.start).toBe(1);
    expect(strobe.entities.strobeFrequency.end).toBe(12);
    expect(strobe.min).toBe(1); // .min reads off the first built entity (strobeFrequency)

    // ShutterStrobe always builds a `duration` entity too (CAPABILITY_TYPES
    // lists it unconditionally), and since this capability has no
    // duration/durationStart/durationEnd keys at all it defaults to the full
    // configured span [0,1000]. .max reads off the LAST built entity, which
    // is this always-present default duration entity, not strobeFrequency.
    expect(strobe.entities.strobeDuration).toEqual({ start: 0, end: 1000 });
    expect(strobe.max).toBe(1000);
  });

  it('maps Sharpy Pan angleStart/angleEnd (0deg..540deg) onto the pan entity', () => {
    const pan = new Capability(panCapability);
    expect(pan.entities.pan.start).toBe(0);
    expect(pan.entities.pan.end).toBe(540);
    expect(pan.min).toBe(0);
    expect(pan.max).toBe(540);
  });

  it('resolves a single preset speed value ("slow") onto the entity .value slot', () => {
    const strobe = new Capability(strobeWithPresetSpeed);
    // Speed entity presets: slow -> '1%' -> (1/100)*(max-min) = (1/100)*10 = 0.1
    expect(strobe.entities.strobeFrequency.value).toBeCloseTo(0.1, 10);
    expect(strobe.parameters.strobeRandom).toBe(true); // explicit randomTiming: true
  });
});

describe('Capability#getValue -- DMX value -> entity value interpolation', () => {
  it('interpolates strobeFrequency linearly across the capability dmxRange', () => {
    const strobe = new Capability(strobeWithSpeedRange); // dmxRange [4,103], 1Hz..12Hz
    expect(strobe.getValue(4).strobeFrequency).toBe(1); // range start
    expect(strobe.getValue(103).strobeFrequency).toBe(12); // range end
    expect(strobe.getValue(53.5).strobeFrequency).toBeCloseTo(6.5, 10); // midpoint
  });

  it('interpolates Sharpy pan angle across the full 0-255 DMX range', () => {
    const pan = new Capability(panCapability);
    expect(pan.getValue(0).pan).toBe(0);
    expect(pan.getValue(255).pan).toBe(540);
    expect(pan.getValue(127.5).pan).toBeCloseTo(270, 10);
  });

  it('carries non-entity parameters through untouched regardless of DMX value', () => {
    const strobe = new Capability(strobeWithSpeedRange);
    expect(strobe.getValue(4).strobeEffect).toBe('Strobe');
    expect(strobe.getValue(103).strobeEffect).toBe('Strobe');
  });
});

describe('Capability.getValueInInterval -- static interpolation at 0/mid/255-equivalent percents', () => {
  it('interpolates a plain [start,end] entity at percent 0, 0.5 and 1', () => {
    const entity = { start: 10, end: 20 };
    expect(Capability.getValueInInterval(entity, 0)).toBe(10);
    expect(Capability.getValueInInterval(entity, 0.5)).toBe(15);
    expect(Capability.getValueInInterval(entity, 1)).toBe(20);
  });

  it('divides by 255 on both ends when isFine is true', () => {
    const entity = { start: 0, end: 255 };
    expect(Capability.getValueInInterval(entity, 0, true)).toBe(0);
    expect(Capability.getValueInInterval(entity, 1, true)).toBe(1);
    expect(Capability.getValueInInterval(entity, 0.5, true)).toBeCloseTo(0.5, 10);
  });

  it('short-circuits to entity.value when present, ignoring percent entirely', () => {
    const entity = { value: 42, start: 0, end: 100 };
    expect(Capability.getValueInInterval(entity, 0)).toBe(42);
    expect(Capability.getValueInInterval(entity, 0.5)).toBe(42);
    expect(Capability.getValueInInterval(entity, 1)).toBe(42);
  });
});

describe('Capability defaults -- ShutterStrobe', () => {
  it('falls back to shutterStrobeSoundControlled/strobeRandom defaults when absent from OFL data', () => {
    // dmxRange [104,107], shutterEffect "Open" with no speed/duration/
    // soundControlled/randomTiming keys at all in the real fixture data.
    expect(openNoExtras.soundControlled).toBeUndefined();
    expect(openNoExtras.randomTiming).toBeUndefined();

    const cap = new Capability(openNoExtras);
    expect(cap.parameters.strobeEffect).toBe('Open');
    expect(cap.parameters.shutterStrobeSoundControlled).toBe(false); // SHUTTER_STROBE_SOUNDCONTROL_DEFAULT
    expect(cap.parameters.strobeRandom).toBe(false); // SHUTTER_STROBE_RANDOMTIMING_DEFAULT
  });

  it('defaults speed/duration entities to their full configured span when no value is given at all', () => {
    const cap = new Capability(openNoExtras);
    // speed: entity Speed, unit Hz, min 0, max 10 -- defaults to [0,10]
    expect(cap.entities.strobeFrequency.start).toBe(0);
    expect(cap.entities.strobeFrequency.end).toBe(10);
    // duration: entity Time, unit ms, min 0, max 1000 -- defaults to [0,1000]
    expect(cap.entities.strobeDuration.start).toBe(0);
    expect(cap.entities.strobeDuration.end).toBe(1000);
  });
});

describe('Capability defaults -- ColorIntensity', () => {
  it('carries the real color parameter and defaults brightness when absent from OFL data', () => {
    // Red channel capability: { type: 'ColorIntensity', color: 'Red' } -- no
    // brightness/brightnessStart/brightnessEnd keys in the real fixture data.
    expect(redChannelCapability.brightness).toBeUndefined();

    const cap = new Capability(redChannelCapability);
    expect(cap.parameters.color).toBe('Red'); // real explicit value, not the 'red' default
    // brightness: entity Brightness, unit '%', min 0, max 1. The default
    // fallback builds '0%'/'1%' strings and feeds them through
    // Entity#getValue -- but because Brightness's *configured* unit is
    // itself '%', the "value unit already matches requested unit" branch
    // fires first and returns the raw parsed number (1), not the
    // percentage-scaled (1/100)*(max-min) = 0.01 one might expect.
    expect(cap.entities.colorBrightness.start).toBe(0);
    expect(cap.entities.colorBrightness.end).toBe(1);
  });

  it('falls back to the ColorIntensity color default when the color key is entirely missing', () => {
    const cap = new Capability({ type: 'ColorIntensity' });
    expect(cap.parameters.color).toBe('red'); // COLOR_INTENSITY_COLOR_DEFAULT
  });
});
