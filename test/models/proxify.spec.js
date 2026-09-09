import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { Proxify, ProxifySingleton } from '@/models/utils/proxify.utils';

/**
 * Minimal Proxify consumer mirroring the real usage pattern seen throughout
 * src/models/DMX/*.model.js (eg. Fade): call super(), assign plain fields,
 * then return `this.proxify(except)` from the constructor.
 */
class Widget extends Proxify {
  constructor(data = {}) {
    super();
    this.value = data.value ?? 0;
    this.label = data.label ?? 'a';
    this.items = data.items || [];
    // eslint-disable-next-line no-constructor-return
    return this.proxify([]);
  }
}

beforeEach(() => {
  // ProxifySingleton is a genuine module-level singleton (see
  // proxify.utils.js) -- reset its stacks/hash between tests so state from
  // one test can never leak into the next.
  ProxifySingleton.undoStack = [];
  ProxifySingleton.redoStack = [];
  ProxifySingleton.hash = null;
});

describe('Proxify -- property writes are queued for undo', () => {
  it('queues an undo entry when a proxified property is set', () => {
    const widget = new Widget({ value: 10 });
    expect(ProxifySingleton.undoStack).toHaveLength(0);

    widget.value = 99;

    expect(widget.value).toBe(99); // write goes through to the real target
    expect(ProxifySingleton.undoStack).toHaveLength(1);
    expect(ProxifySingleton.undoStack[0].prop).toBe('value');
  });

  it('does not queue writes to properties listed in the except array', () => {
    class ExceptWidget extends Proxify {
      constructor() {
        super();
        this.tracked = 1;
        this.untracked = 1;
        // eslint-disable-next-line no-constructor-return
        return this.proxify(['untracked']);
      }
    }
    const widget = new ExceptWidget();

    widget.untracked = 2;
    expect(widget.untracked).toBe(2);
    expect(ProxifySingleton.undoStack).toHaveLength(0);

    widget.tracked = 2;
    expect(ProxifySingleton.undoStack).toHaveLength(1);
  });
});

describe('Proxify -- undo() restores the previous value', () => {
  it('restores the prior property value on undo, after regenHash establishes a batch', () => {
    const widget = new Widget({ value: 10 });

    ProxifySingleton.regenHash(); // must run BEFORE the write: undo() is a
    // no-op while hash is still null (see undo()'s `!= null` guard)
    widget.value = 55;
    expect(widget.value).toBe(55);

    ProxifySingleton.undo();

    expect(widget.value).toBe(10);
    expect(ProxifySingleton.undoStack).toHaveLength(0);
    expect(ProxifySingleton.redoStack).toHaveLength(1);
  });

  it('is a no-op if regenHash() was never called (hash stays null)', () => {
    const widget = new Widget({ value: 10 });
    widget.value = 55; // queued, but with hash === null

    ProxifySingleton.undo();

    // Documents real behaviour: undo()'s while-loop guard requires
    // `hash != null`, so a null-hash entry is never popped/undone.
    expect(widget.value).toBe(55);
    expect(ProxifySingleton.undoStack).toHaveLength(1);
  });

  it('redo() replays the change that undo() reverted', () => {
    const widget = new Widget({ value: 10 });
    ProxifySingleton.regenHash();
    widget.value = 55;

    ProxifySingleton.undo();
    expect(widget.value).toBe(10);

    ProxifySingleton.redo();
    expect(widget.value).toBe(55);
    expect(ProxifySingleton.redoStack).toHaveLength(0);
    expect(ProxifySingleton.undoStack).toHaveLength(1);
  });
});

describe('Proxify -- regenHash() batches writes so one undo() reverses the whole batch', () => {
  it('groups every write between two regenHash() calls under the same hash', () => {
    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValueOnce(100); // hash for the first batch
    nowSpy.mockReturnValueOnce(200); // hash for the second batch

    const widget = new Widget({ value: 10, label: 'a' });

    ProxifySingleton.regenHash(); // hash = 100
    widget.value = 1;
    widget.label = 'b';

    ProxifySingleton.regenHash(); // hash = 200
    widget.value = 2;

    expect(ProxifySingleton.undoStack.map((entry) => entry.hash)).toEqual([100, 100, 200]);

    // First undo() only reverses the hash-200 batch (the single `value = 2` write).
    ProxifySingleton.undo();
    expect(widget.value).toBe(1);
    expect(widget.label).toBe('b');
    expect(ProxifySingleton.undoStack).toHaveLength(2);

    // Second undo() reverses BOTH hash-100 writes in one call.
    ProxifySingleton.undo();
    expect(widget.value).toBe(10);
    expect(widget.label).toBe('a');
    expect(ProxifySingleton.undoStack).toHaveLength(0);
  });
});

describe('Proxify -- array pushAndStackUndo/spliceAndStackUndo helpers', () => {
  it('pushAndStackUndo pushes the value and undo() pops it back off', () => {
    const widget = new Widget({ items: [] });
    expect(typeof widget.items.pushAndStackUndo).toBe('function');

    ProxifySingleton.regenHash();
    widget.items.pushAndStackUndo('x');

    // pushAndStackUndo/spliceAndStackUndo are attached as own enumerable
    // properties directly on the array (see proxify.utils.js), so a bare
    // `toEqual(['x'])` would fail on those extra keys -- spread to compare
    // only the indexed elements.
    expect([...widget.items]).toEqual(['x']);
    expect(ProxifySingleton.undoStack).toHaveLength(1);

    ProxifySingleton.undo();
    expect([...widget.items]).toEqual([]);
  });

  it('spliceAndStackUndo removes items and undo() reinserts a copy at the same index', () => {
    const widget = new Widget({ items: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    expect(typeof widget.items.spliceAndStackUndo).toBe('function');

    ProxifySingleton.regenHash();
    const removed = widget.items.spliceAndStackUndo(1, 1);

    expect(removed).toHaveLength(1);
    expect(removed[0].id).toBe(2);
    expect(widget.items.map((item) => item.id)).toEqual([1, 3]);

    ProxifySingleton.undo();
    expect(widget.items.map((item) => item.id)).toEqual([1, 2, 3]);
  });
});
