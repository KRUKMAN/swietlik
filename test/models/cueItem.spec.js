import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import CueItem from '@/models/DMX/cue.item.model';
import Live from '@/models/DMX/live.model';

/**
 * Builds a minimal stand-in for a Cue/Scene/Effect handle. Only the surface
 * CueItem actually touches (color, name, update) is provided.
 *
 * @param {Object} [overrides={}] fields to override on the fake handle
 * @return {Object} fake cue handle
 */
function fakeCueHandle(overrides = {}) {
  return {
    color: '#ff0000',
    name: 'Test Cue',
    update: vi.fn(),
    ...overrides,
  };
}

describe('CueItem', () => {
  beforeEach(() => {
    // Live is a module-scope singleton; pin bpm explicitly so barDuration
    // math below is not dependent on prior test/import ordering.
    Live.bpm = 120;
  });

  it('confirms the Live singleton\'s bar duration at 120 bpm is 2000ms', () => {
    // beatDuration = 60000 / bpm = 500ms ; barDuration = beatDuration * 4
    expect(Live.beatDuration).toBeCloseTo(500, 9);
    expect(Live.barDuration).toBeCloseTo(2000, 9);
  });

  describe('tick / time-related fields', () => {
    it('exposes tickStart via the `tick` accessor', () => {
      const item = new CueItem({
        id: 1, cue: fakeCueHandle(), tickStart: 5, tickDuration: 8,
      });

      expect(item.tick).toBe(5);
    });

    it('lets `tick` be reassigned and read back', () => {
      const item = new CueItem({
        id: 1, cue: fakeCueHandle(), tickStart: 0, tickDuration: 8,
      });

      item.tick = 12;

      expect(item.tick).toBe(12);
    });

    it('exposes tickDuration directly and via the `length` alias', () => {
      const item = new CueItem({
        id: 1, cue: fakeCueHandle(), tickStart: 0, tickDuration: 8,
      });

      expect(item.tickDuration).toBe(8);
      expect(item.length).toBe(8);
    });

    it('keeps tickDuration and `length` in sync when `length` is reassigned', () => {
      const item = new CueItem({
        id: 1, cue: fakeCueHandle(), tickStart: 0, tickDuration: 8,
      });

      item.length = 32;

      expect(item.length).toBe(32);
      expect(item.tickDuration).toBe(32);
    });

    it('converts tickDuration (length) to a millisecond fade duration at 31.25ms/tick (barDuration/4/16)', () => {
      // At 120bpm: barDuration=2000ms -> per-tick = 2000/4/16 = 31.25ms/tick.
      const handle = fakeCueHandle();
      const item = new CueItem({
        id: 1, cue: handle, tickStart: 0, tickDuration: 16,
      });

      item.update(1234);

      // 16 ticks * 31.25ms/tick = 500ms == one beat at 120bpm.
      expect(handle.update).toHaveBeenCalledWith(1234, 500);
    });

    it('converts a full-bar tickDuration of 64 ticks into exactly one barDuration (2000ms)', () => {
      const handle = fakeCueHandle();
      const item = new CueItem({
        id: 1, cue: handle, tickStart: 0, tickDuration: 64,
      });

      item.update(0);

      expect(handle.update).toHaveBeenCalledWith(0, 2000);
    });
  });

  describe('showData', () => {
    it('reports the expected shape and real values', () => {
      const handle = fakeCueHandle({ color: '#00ff00', name: 'My Cue' });
      const item = new CueItem({
        id: 42, cue: handle, tickStart: 7, tickDuration: 16,
      });

      expect(item.showData).toEqual({
        id: 42,
        name: 'My Cue',
        color: '#00ff00',
        tickStart: 7,
        tickDuration: 16,
      });
    });

    it('reflects live updates to tick/length in subsequent showData reads', () => {
      const item = new CueItem({
        id: 1, cue: fakeCueHandle(), tickStart: 0, tickDuration: 8,
      });

      item.tick = 3;
      item.length = 20;

      expect(item.showData.tickStart).toBe(3);
      expect(item.showData.tickDuration).toBe(20);
    });
  });

  describe('update(t) -- forwarding to the handle for fade application', () => {
    it('forwards the current time and computed ms duration to the handle unchanged', () => {
      const handle = fakeCueHandle();
      const item = new CueItem({
        id: 1, cue: handle, tickStart: 0, tickDuration: 4,
      });

      item.update(999);

      // duration = tickDuration(4) * (barDuration/4/16) = 4 * 31.25 = 125ms
      expect(handle.update).toHaveBeenCalledTimes(1);
      expect(handle.update).toHaveBeenCalledWith(999, 125);
    });

    it('recomputes the forwarded duration if `length` changes between updates', () => {
      const handle = fakeCueHandle();
      const item = new CueItem({
        id: 1, cue: handle, tickStart: 0, tickDuration: 4,
      });

      item.update(0);
      expect(handle.update).toHaveBeenLastCalledWith(0, 125);

      item.length = 8;
      item.update(10);
      expect(handle.update).toHaveBeenLastCalledWith(10, 250);
    });
  });

  describe('fadeIn / fadeOut', () => {
    // Regression: the `fadeOut` setter used to assign to `this._fadeIn`
    // (its parameter was even named `fadeIn`, not `fadeOut`), clobbering
    // whatever `fadeIn` had just been set to and leaving `_fadeOut` (and so
    // the `fadeOut` getter) permanently unreachable. These tests assert the
    // corrected behaviour: `fadeIn` and `fadeOut` are independent fields.
    it('defaults both fadeIn and fadeOut to 0 when neither is provided', () => {
      const item = new CueItem({
        id: 1, cue: fakeCueHandle(), tickStart: 0, tickDuration: 4,
      });

      expect(item.fadeIn).toBe(0);
      expect(item.fadeOut).toBe(0);
    });

    it('sets fadeIn from constructor data without touching fadeOut', () => {
      const item = new CueItem({
        id: 1, cue: fakeCueHandle(), tickStart: 0, tickDuration: 4, fadeIn: 250,
      });

      expect(item.fadeIn).toBe(250);
      expect(item.fadeOut).toBe(0);
    });

    it('sets fadeOut from constructor data without clobbering fadeIn', () => {
      const item = new CueItem({
        id: 1, cue: fakeCueHandle(), tickStart: 0, tickDuration: 4, fadeOut: 800,
      });

      expect(item.fadeOut).toBe(800);
      expect(item.fadeIn).toBe(0);
    });

    it('keeps fadeIn and fadeOut independent when both are provided', () => {
      const item = new CueItem({
        id: 1, cue: fakeCueHandle(), tickStart: 0, tickDuration: 4, fadeIn: 100, fadeOut: 250,
      });

      expect(item.fadeIn).toBe(100);
      expect(item.fadeOut).toBe(250);
    });

    it('round-trips a fadeOut reassignment after construction, independent of fadeIn', () => {
      const item = new CueItem({
        id: 1, cue: fakeCueHandle(), tickStart: 0, tickDuration: 4, fadeIn: 100, fadeOut: 250,
      });

      item.fadeOut = 500;

      expect(item.fadeOut).toBe(500);
      expect(item.fadeIn).toBe(100);
    });
  });
});
