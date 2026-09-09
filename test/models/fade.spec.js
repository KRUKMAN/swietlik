import {
  describe, it, expect,
} from 'vitest';
import Fade from '@/models/DMX/fade.model';

/**
 * Fade preset type indices, as declared (in order) by FADE_PRESETS_INDICES
 * in src/models/DMX/fade.model.js. Index 0 (CUSTOM) is intentionally excluded
 * -- setting `type = 0` explicitly takes the "leave controlPoints alone"
 * branch rather than loading a preset (see the `type` setter tests below).
 */
const PRESET_TYPES = {
  LINEAR: 1,
  EASE: 2,
  EASE_IN: 3,
  EASE_OUT: 4,
  EASE_IN_OUT: 5,
};

/**
 * Expected control points per preset, mirrored from FADE_PRESETS in the
 * source file so the "type setter loads preset control points" assertions
 * pin down real, known values rather than merely re-deriving them.
 */
const EXPECTED_CONTROL_POINTS = {
  LINEAR: [{ x: 0.250, y: 0.250 }, { x: 0.750, y: 0.750 }],
  EASE: [{ x: 0.250, y: 0.100 }, { x: 0.250, y: 1.0 }],
  EASE_IN: [{ x: 0.420, y: 0.0 }, { x: 1.0, y: 1.0 }],
  EASE_OUT: [{ x: 0, y: 0 }, { x: 0.580, y: 1.0 }],
  EASE_IN_OUT: [{ x: 0.420, y: 0 }, { x: 0.580, y: 1.0 }],
};

/**
 * getValue returns a *string* (val.toFixed(3)) in the real implementation --
 * coerce to Number so numeric matchers (toBeCloseTo, comparisons) apply.
 *
 * @param {Fade} fade fade instance
 * @param {Number} time sample time (ms)
 * @param {Number} duration total duration (ms)
 * @return {Number} numeric sampled value
 */
function sample(fade, time, duration) {
  return Number(fade.getValue(time, duration));
}

/**
 * Proxify.proxify() (run once, at the end of the Fade constructor) attaches
 * non-index `pushAndStackUndo`/`spliceAndStackUndo` helper functions onto any
 * array that was already an own property at construction time -- including
 * `_controlPoints` whenever it was seeded from constructor data. Those helpers
 * are irrelevant to the fade curve's data and make raw `toEqual` comparisons
 * against plain arrays/objects fail for reasons unrelated to Fade's actual
 * behaviour, so strip them via a JSON round-trip before asserting.
 *
 * @param {*} value value to strip of any non-JSON-serializable instrumentation
 * @return {*} plain deep clone
 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('Fade', () => {
  describe('getValue endpoints', () => {
    it('is ~0 at time=0 regardless of the active preset', () => {
      Object.entries(PRESET_TYPES).forEach(([, typeIndex]) => {
        const fade = new Fade({ type: typeIndex });
        expect(sample(fade, 0, 1000)).toBeCloseTo(0, 3);
      });
    });

    it('is ~1 at time=duration regardless of the active preset', () => {
      Object.entries(PRESET_TYPES).forEach(([, typeIndex]) => {
        const fade = new Fade({ type: typeIndex });
        expect(sample(fade, 1000, 1000)).toBeCloseTo(1, 3);
      });
    });
  });

  describe('monotonic sampling across each preset type', () => {
    const duration = 1000;
    const steps = 50;

    Object.entries(PRESET_TYPES).forEach(([name, typeIndex]) => {
      it(`${name} produces a non-decreasing curve from 0 to 1`, () => {
        const fade = new Fade({ type: typeIndex });
        let previous = sample(fade, 0, duration);
        expect(previous).toBeCloseTo(0, 3);

        for (let i = 1; i <= steps; i += 1) {
          const t = (i / steps) * duration;
          const value = sample(fade, t, duration);
          expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
          previous = value;
        }

        expect(previous).toBeCloseTo(1, 3);
      });
    });
  });

  describe('type setter', () => {
    it('loads the matching preset control points for each named preset', () => {
      Object.entries(PRESET_TYPES).forEach(([name, typeIndex]) => {
        const fade = new Fade({});
        fade.type = typeIndex;
        expect(fade.type).toBe(typeIndex);
        expect(plain(fade.controlPoints)).toEqual(EXPECTED_CONTROL_POINTS[name]);
      });
    });

    it('falls back to type 0 and leaves controlPoints untouched for an unknown/zero type', () => {
      const customPoints = [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }];
      const fade = new Fade({ controlPoints: customPoints });

      fade.type = 0;

      expect(fade.type).toBe(0);
      expect(plain(fade.controlPoints)).toEqual(customPoints);
    });

    it('resets type back to 0 whenever controlPoints are assigned directly', () => {
      const fade = new Fade({ type: PRESET_TYPES.EASE_IN });
      expect(fade.type).toBe(PRESET_TYPES.EASE_IN);

      fade.controlPoints = [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }];

      expect(fade.type).toBe(0);
      expect(plain(fade.controlPoints)).toEqual([{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }]);
    });
  });

  describe('showData round-trips through the constructor', () => {
    it('round-trips a named preset (EASE_IN)', () => {
      const original = new Fade({ type: PRESET_TYPES.EASE_IN, duration: 4 });
      const showData = plain(original.showData);

      expect(showData).toEqual({
        type: PRESET_TYPES.EASE_IN,
        controlPoints: EXPECTED_CONTROL_POINTS.EASE_IN,
      });

      const restored = new Fade(showData);

      expect(plain(restored.showData)).toEqual(showData);
    });

    it('round-trips custom control points (type 0)', () => {
      const customPoints = [{ x: 0.12, y: 0.34 }, { x: 0.56, y: 0.78 }];
      const original = new Fade({ controlPoints: customPoints });
      const showData = plain(original.showData);

      expect(showData).toEqual({ type: 0, controlPoints: customPoints });

      const restored = new Fade(showData);

      expect(plain(restored.showData)).toEqual(showData);
    });
  });
});
