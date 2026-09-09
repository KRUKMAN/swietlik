import { describe, it, expect } from 'vitest';
import EntityManager from '@/models/DMX/entityManager.model';

/**
 * `Entity` is not exported from entityManager.model.js -- only the
 * EntityManager singleton is. The static `parseValueUnit` is reachable through
 * any built entity's constructor.
 */
const Entity = EntityManager.entities.Speed.constructor;

describe('EntityManager singleton', () => {
  it('is a singleton: re-constructing returns the same instance', () => {
    const again = new EntityManager.constructor();
    expect(again).toBe(EntityManager);
  });

  it('builds one Entity per ENTITIES key with its units', () => {
    expect(Object.keys(EntityManager.entities)).toEqual([
      'Speed',
      'RotationSpeed',
      'Time',
      'Duration',
      'Distance',
      'Brightness',
      'ColorTemperature',
      'FogOutput',
      'Angle',
      'RotationAngle',
      'BeamAngle',
      'HorizontalAngle',
      'VerticalAngle',
      'SwingAngle',
      'Parameter',
      'SlotNumber',
      'Percent',
      'Insertion',
      'IrisPercent',
    ]);

    expect(EntityManager.entities.Speed._units).toEqual(['Hz', 'bpm', '%']);
    expect(EntityManager.entities.RotationSpeed._units).toEqual(['Hz', 'rpm', '%']);
    expect(EntityManager.entities.Time._units).toEqual(['s', 'ms', '%']);
    expect(EntityManager.entities.SlotNumber._units).toEqual([null]);
  });
});

describe('Entity.parseValueUnit', () => {
  it('strips digits and returns the remaining unit string', () => {
    expect(Entity.parseValueUnit('20Hz')).toBe('Hz');
    expect(Entity.parseValueUnit('120bpm')).toBe('bpm');
    expect(Entity.parseValueUnit('300rpm')).toBe('rpm');
    expect(Entity.parseValueUnit('500ms')).toBe('ms');
    expect(Entity.parseValueUnit('2s')).toBe('s');
    expect(Entity.parseValueUnit('50%')).toBe('%');
    expect(Entity.parseValueUnit('3200K')).toBe('K');
    expect(Entity.parseValueUnit('15deg')).toBe('deg');
  });

  it('returns null for a bare number (empty unit is falsy)', () => {
    expect(Entity.parseValueUnit('100')).toBeNull();
    expect(Entity.parseValueUnit(42)).toBeNull();
    expect(Entity.parseValueUnit(0)).toBeNull();
  });

  it('only strips [0-9] -- signs and decimal points leak into the unit', () => {
    // Documents current upstream behaviour: the regex is /[0-9]/g, so '-' and
    // '.' survive and the returned "unit" is not a real unit string.
    expect(Entity.parseValueUnit('-100%')).toBe('-%');
    expect(Entity.parseValueUnit('1.5s')).toBe('.s');
  });
});

describe('Entity#getValueFromPresets', () => {
  it('maps named presets to their percentage strings', () => {
    const speed = EntityManager.entities.Speed;
    expect(speed.getValueFromPresets('stop')).toBe('0%');
    expect(speed.getValueFromPresets('slow')).toBe('1%');
    expect(speed.getValueFromPresets('fast')).toBe('100%');
    expect(speed.getValueFromPresets('slow reverse')).toBe('-1%');
    expect(speed.getValueFromPresets('fast reverse')).toBe('-100%');

    const rotation = EntityManager.entities.RotationSpeed;
    expect(rotation.getValueFromPresets('slow CW')).toBe('1%');
    expect(rotation.getValueFromPresets('fast CCW')).toBe('-100%');

    const temperature = EntityManager.entities.ColorTemperature;
    expect(temperature.getValueFromPresets('warm / CTO')).toBe('-100%');
    expect(temperature.getValueFromPresets('cold / CTB')).toBe('100%');
  });

  it('passes unknown values through untouched', () => {
    expect(EntityManager.entities.Speed.getValueFromPresets('20Hz')).toBe('20Hz');
    expect(EntityManager.entities.Speed.getValueFromPresets('nonsense')).toBe('nonsense');
  });

  it('passes everything through for entities without a preset table', () => {
    // Duration / Angle / SlotNumber all declare `values: null`.
    expect(EntityManager.entities.Duration._values).toBeNull();
    expect(EntityManager.entities.Duration.getValueFromPresets('short')).toBe('short');
    expect(EntityManager.entities.Angle.getValueFromPresets('wide')).toBe('wide');
  });
});

describe('Entity#getValue -- matching units', () => {
  it('returns the parsed float when the value unit already matches', () => {
    expect(EntityManager.entities.Speed.getValue('20Hz', 'Hz', 0, 100)).toBe(20);
    expect(EntityManager.entities.Speed.getValue('120bpm', 'bpm', 0, 100)).toBe(120);
    expect(EntityManager.entities.Time.getValue('2s', 's', 0, 100)).toBe(2);
    expect(EntityManager.entities.Time.getValue('500ms', 'ms', 0, 100)).toBe(500);
    expect(EntityManager.entities.BeamAngle.getValue('15deg', 'deg', 0, 100)).toBe(15);
  });
});

describe('Entity#getValue -- percentage to range mapping', () => {
  it('maps a percentage onto (max - min)', () => {
    const speed = EntityManager.entities.Speed;
    expect(speed.getValue('0%', 'Hz', 0, 100)).toBe(0);
    expect(speed.getValue('50%', 'Hz', 0, 100)).toBe(50);
    expect(speed.getValue('100%', 'Hz', 0, 100)).toBe(100);
    expect(speed.getValue('25%', 'Hz', 0, 200)).toBe(50);
  });

  it('scales by the span only -- min is NOT added back (upstream behaviour)', () => {
    // 50% of the 10..20 range is documented as 5, not 15.
    expect(EntityManager.entities.Speed.getValue('50%', 'Hz', 10, 20)).toBe(5);
    expect(EntityManager.entities.BeamAngle.getValue('100%', 'deg', 10, 60)).toBe(50);
  });

  it('resolves named presets through the percentage branch', () => {
    const speed = EntityManager.entities.Speed;
    expect(speed.getValue('stop', 'Hz', 0, 100)).toBe(0);
    expect(speed.getValue('slow', 'Hz', 0, 100)).toBe(1);
    expect(speed.getValue('fast', 'Hz', 0, 100)).toBe(100);

    const beam = EntityManager.entities.BeamAngle;
    expect(beam.getValue('closed', 'deg', 0, 45)).toBe(0);
    expect(beam.getValue('wide', 'deg', 0, 45)).toBe(45);

    // When the requested unit is itself '%', the "units already match" branch
    // wins and the raw percentage is returned rather than a mapped range value.
    const percent = EntityManager.entities.Percent;
    expect(percent.getValue('high', '%', 0, 255)).toBe(100);
    expect(percent.getValue('off', '%', 0, 255)).toBe(0);
    expect(percent.getValue('high', 'raw', 0, 255)).toBe(255);
  });
});

describe('Entity#getValue -- Hz <-> bpm / rpm conversions', () => {
  it('multiplies by 60 when converting Hz to bpm', () => {
    expect(EntityManager.entities.Speed.getValue('2Hz', 'bpm', 0, 1000)).toBe(120);
    expect(EntityManager.entities.Speed.getValue('0.5Hz', 'bpm', 0, 1000)).toBe(30);
  });

  it('multiplies by 60 when converting Hz to rpm', () => {
    expect(EntityManager.entities.RotationSpeed.getValue('5Hz', 'rpm', 0, 1000)).toBe(300);
  });

  it('divides by 60 when converting bpm back to Hz', () => {
    expect(EntityManager.entities.Speed.getValue('120bpm', 'Hz', 0, 1000)).toBe(2);
  });

  it('divides by 60 when converting rpm back to Hz', () => {
    expect(EntityManager.entities.RotationSpeed.getValue('300rpm', 'Hz', 0, 1000)).toBe(5);
  });

  it('routes negative presets through the Hz conversion, not the % branch', () => {
    // parseValueUnit('-100%') === '-%', so the '%' branch is skipped and the
    // Speed/RotationSpeed conversion branch runs on parseFloat('-100%') = -100.
    expect(EntityManager.entities.Speed.getValue('fast reverse', 'bpm', 0, 100)).toBe(-6000);
    expect(EntityManager.entities.Speed.getValue('fast reverse', 'Hz', 0, 100))
      .toBeCloseTo(-100 / 60, 10);
    expect(EntityManager.entities.RotationSpeed.getValue('fast CCW', 'rpm', 0, 100)).toBe(-6000);
  });
});

describe('Entity#getValue -- s <-> ms conversions', () => {
  it('divides by 1000 when converting ms to s', () => {
    expect(EntityManager.entities.Time.getValue('500ms', 's', 0, 10)).toBe(0.5);
    expect(EntityManager.entities.Time.getValue('250ms', 's', 0, 10)).toBe(0.25);
    expect(EntityManager.entities.Duration.getValue('1500ms', 's', 0, 10)).toBe(1.5);
  });

  it('multiplies by 1000 when converting s to ms', () => {
    expect(EntityManager.entities.Time.getValue('2s', 'ms', 0, 10)).toBe(2000);
    expect(EntityManager.entities.Duration.getValue('3s', 'ms', 0, 10)).toBe(3000);
  });

  it('applies the same 1000x fallback to non-time entities', () => {
    // The final branch is a catch-all: anything not Speed/RotationSpeed and not
    // already matching gets *1000 unless the target unit is seconds.
    expect(EntityManager.entities.ColorTemperature.getValue('3200K', 'x', 0, 10)).toBe(3200000);
  });
});
