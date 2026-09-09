import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import Master from '@/models/DMX/master.model';

/**
 * Builds a plain-object stand-in for a ChasePool.
 *
 * @param {Array<Number>} chaseIds ids of the chases the pool contains
 * @return {Object} fake chase pool
 */
function fakeChasePool(chaseIds) {
  const chases = chaseIds.map((id) => ({
    id,
    cue: vi.fn(),
    onEnd: null,
  }));
  return {
    chases,
    getFromId(id) {
      const chase = chases.find((item) => item.id === id);
      if (!chase) {
        // Mirrors the real ChasePool, which throws when the id is absent.
        throw new Error('Cannot find chase in pool');
      }
      return chase;
    },
  };
}

/**
 * Builds a plain-object stand-in for a GroupPool.
 *
 * @param {Array<Array<Number>>} groupChaseIds one chase-id list per group
 * @return {Object} fake group pool
 */
function fakeGroupPool(groupChaseIds) {
  return {
    groups: groupChaseIds.map((chaseIds, index) => ({
      id: index,
      chasePool: fakeChasePool(chaseIds),
    })),
  };
}

/**
 * Convenience accessor for a specific fake chase.
 *
 * @param {Object} pool fake group pool
 * @param {Number} groupIndex group index
 * @param {Number} chaseId chase id
 * @return {Object} fake chase
 */
function chaseOf(pool, groupIndex, chaseId) {
  return pool.groups[groupIndex].chasePool.chases.find((chase) => chase.id === chaseId);
}

describe('Master', () => {
  let groupPool;
  let master;

  beforeEach(() => {
    groupPool = fakeGroupPool([[0, 1, 2], [0, 1, 2]]);
    master = new Master(groupPool);
  });

  it('starts idle with playingRow -1 and a no-op onEnd', () => {
    expect(master.groupPool).toBe(groupPool);
    expect(master.playingRow).toBe(-1);
    expect(typeof master.onEnd).toBe('function');
    expect(master.onEnd()).toBeUndefined();
  });

  describe('cueRow -- toggling playingRow', () => {
    it('cues the row on the first call and records it as playing', () => {
      expect(master.cueRow(1)).toBe(1);
      expect(master.playingRow).toBe(1);
    });

    it('un-cues the same row on a second call (toggle off)', () => {
      master.cueRow(1);
      expect(master.cueRow(1)).toBe(-1);
      expect(master.playingRow).toBe(-1);
    });

    it('switches directly from one playing row to another', () => {
      master.cueRow(1);
      expect(master.cueRow(2)).toBe(2);
      expect(master.playingRow).toBe(2);
    });

    it('stays at -1 when no group owns the requested row', () => {
      expect(master.cueRow(99)).toBe(-1);
      expect(master.playingRow).toBe(-1);
    });

    it('clears playingRow when switching to a row nothing owns', () => {
      master.cueRow(1);
      expect(master.playingRow).toBe(1);
      expect(master.cueRow(99)).toBe(-1);
      expect(master.playingRow).toBe(-1);
    });
  });

  describe('cueRow -- chase.cue receives booleans', () => {
    it('resets every chase with cue(false) before cueing the target', () => {
      master.cueRow(1);

      const target = chaseOf(groupPool, 0, 1);
      const other = chaseOf(groupPool, 0, 0);

      // Non-target chases are only ever reset.
      expect(other.cue).toHaveBeenCalledTimes(1);
      expect(other.cue).toHaveBeenCalledWith(false);

      // The target is reset by the sweep, then cued true.
      expect(target.cue).toHaveBeenCalledTimes(2);
      expect(target.cue).toHaveBeenNthCalledWith(1, false);
      expect(target.cue).toHaveBeenNthCalledWith(2, true);

      target.cue.mock.calls.forEach(([arg]) => expect(typeof arg).toBe('boolean'));
    });

    it('cues the target with false when toggling the row off', () => {
      master.cueRow(1);
      const target = chaseOf(groupPool, 0, 1);
      target.cue.mockClear();

      master.cueRow(1);

      expect(target.cue).toHaveBeenCalledTimes(2);
      expect(target.cue).toHaveBeenNthCalledWith(1, false);
      expect(target.cue).toHaveBeenNthCalledWith(2, false);
    });

    it('cues the matching chase in every group', () => {
      master.cueRow(2);
      expect(chaseOf(groupPool, 0, 2).cue).toHaveBeenLastCalledWith(true);
      expect(chaseOf(groupPool, 1, 2).cue).toHaveBeenLastCalledWith(true);
    });

    it('cues only the groups that own the row', () => {
      const sparsePool = fakeGroupPool([[0, 1], [0]]);
      const sparseMaster = new Master(sparsePool);

      expect(sparseMaster.cueRow(1)).toBe(1);
      expect(chaseOf(sparsePool, 0, 1).cue).toHaveBeenLastCalledWith(true);
      // Group 1 has no chase 1 -- its chase 0 was only reset.
      expect(chaseOf(sparsePool, 1, 0).cue).toHaveBeenCalledTimes(1);
      expect(chaseOf(sparsePool, 1, 0).cue).toHaveBeenCalledWith(false);
    });
  });

  describe('cueRow -- onEnd wiring', () => {
    it('installs a no-op onEnd on every reset chase', () => {
      master.cueRow(1);
      const other = chaseOf(groupPool, 0, 0);
      expect(typeof other.onEnd).toBe('function');
      expect(other.onEnd()).toBeUndefined();
    });

    it('fires master.onEnd exactly once, after the last cued chase ends', () => {
      const onEnd = vi.fn();
      master.onEnd = onEnd;
      master.cueRow(1);

      const first = chaseOf(groupPool, 0, 1);
      const second = chaseOf(groupPool, 1, 1);

      first.onEnd();
      expect(onEnd).not.toHaveBeenCalled();

      second.onEnd();
      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('fires immediately when only a single group owns the row', () => {
      const singlePool = fakeGroupPool([[0, 1], [0]]);
      const singleMaster = new Master(singlePool);
      const onEnd = vi.fn();
      singleMaster.onEnd = onEnd;

      singleMaster.cueRow(1);
      chaseOf(singlePool, 0, 1).onEnd();

      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('does not fire master.onEnd merely by cueing a row', () => {
      const onEnd = vi.fn();
      master.onEnd = onEnd;
      master.cueRow(1);
      expect(onEnd).not.toHaveBeenCalled();
    });

    it('detaches the previous row\'s callbacks when a new row is cued', () => {
      const onEnd = vi.fn();
      master.onEnd = onEnd;

      master.cueRow(1);
      const staleFirst = chaseOf(groupPool, 0, 1);
      const staleSecond = chaseOf(groupPool, 1, 1);

      master.cueRow(2);

      // Row 1's chases were swept and re-armed with the no-op callback.
      staleFirst.onEnd();
      staleSecond.onEnd();
      expect(onEnd).not.toHaveBeenCalled();

      // Only the freshly cued row can end the master.
      chaseOf(groupPool, 0, 2).onEnd();
      chaseOf(groupPool, 1, 2).onEnd();
      expect(onEnd).toHaveBeenCalledTimes(1);
    });
  });
});
