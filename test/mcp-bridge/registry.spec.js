import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import {
  registerCommand,
  getCommand,
  getCommandSchema,
  hasCommand,
  listCommands,
  dispatch,
  __resetRegistryForTests,
} from '@/mcp-bridge/commands/registry';
import { ValidationError } from '@/mcp-bridge/commands/validate';

beforeEach(() => {
  __resetRegistryForTests();
});

describe('registerCommand', () => {
  it('stores the spec and exposes it by name', () => {
    const handler = vi.fn();
    registerCommand('set_bpm', {
      description: 'Sets the show BPM.',
      args: { bpm: { type: 'number', required: true } },
      handler,
    });

    expect(hasCommand('set_bpm')).toBe(true);
    expect(getCommand('set_bpm').handler).toBe(handler);
    expect(getCommandSchema('set_bpm')).toEqual({
      bpm: { type: 'number', required: true },
    });
  });

  it('lists commands in sorted order', () => {
    registerCommand('undo', { description: 'u', args: {}, handler: () => null });
    registerCommand('add_fixtures_to_group', {
      description: 'a', args: {}, handler: () => null,
    });
    expect(listCommands()).toEqual(['add_fixtures_to_group', 'undo']);
  });

  it('refuses to register the same name twice', () => {
    registerCommand('undo', { description: 'u', args: {}, handler: () => null });
    expect(() => registerCommand('undo', {
      description: 'u', args: {}, handler: () => null,
    })).toThrow('Command "undo" is already registered');
  });

  it('rejects a spec without a callable handler', () => {
    expect(() => registerCommand('bad', { description: 'b', args: {} }))
      .toThrow('Command "bad" needs a handler function');
  });

  it('rejects a spec without a description', () => {
    expect(() => registerCommand('bad', { args: {}, handler: () => null }))
      .toThrow('Command "bad" needs a description');
  });

  it('throws when asked for the schema of an unknown command', () => {
    expect(() => getCommandSchema('nope')).toThrow('Unknown command "nope"');
  });
});

describe('dispatch', () => {
  beforeEach(() => {
    registerCommand('set_bpm', {
      description: 'Sets the show BPM.',
      args: { bpm: { type: 'number', required: true, min: 20, max: 400 } },
      handler: (show, args) => {
        show.bpm = args.bpm;
        return { bpm: show.bpm };
      },
    });
  });

  it('returns a success envelope carrying the handler result', async () => {
    const show = { bpm: 120 };
    await expect(dispatch(show, { id: 'r1', cmd: 'set_bpm', args: { bpm: 128 } }))
      .resolves.toEqual({
        v: 1, type: 'response', id: 'r1', ok: true, result: { bpm: 128 },
      });
    expect(show.bpm).toBe(128);
  });

  it('awaits async handlers', async () => {
    registerCommand('slow', {
      description: 'async',
      args: {},
      handler: async () => ({ done: true }),
    });
    const res = await dispatch({}, { id: 'r2', cmd: 'slow', args: {} });
    expect(res.result).toEqual({ done: true });
  });

  it('normalises an undefined handler result to null', async () => {
    registerCommand('quiet', { description: 'q', args: {}, handler: () => undefined });
    const res = await dispatch({}, { id: 'r3', cmd: 'quiet', args: {} });
    expect(res).toEqual({
      v: 1, type: 'response', id: 'r3', ok: true, result: null,
    });
  });

  it('treats a missing args key as an empty bag', async () => {
    registerCommand('noargs', { description: 'n', args: {}, handler: () => 'ok' });
    const res = await dispatch({}, { id: 'r4', cmd: 'noargs' });
    expect(res.ok).toBe(true);
  });

  it('returns UNKNOWN_COMMAND naming the known commands', async () => {
    const res = await dispatch({}, { id: 'r5', cmd: 'nope', args: {} });
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('UNKNOWN_COMMAND');
    expect(res.error.message).toContain('Unknown command "nope"');
    expect(res.error.message).toContain('set_bpm');
  });

  it('returns VALIDATION for a bad argument, without calling the handler', async () => {
    const res = await dispatch({ bpm: 120 }, { id: 'r6', cmd: 'set_bpm', args: { bpm: 5 } });
    expect(res.ok).toBe(false);
    expect(res.error).toEqual({
      code: 'VALIDATION',
      message: 'set_bpm: Argument "bpm" must be >= 20',
    });
  });

  it('returns COMMAND_ERROR when the handler throws', async () => {
    registerCommand('boom', {
      description: 'b',
      args: {},
      handler: () => { throw new Error('universe is full'); },
    });
    const res = await dispatch({}, { id: 'r7', cmd: 'boom', args: {} });
    expect(res.error).toEqual({
      code: 'COMMAND_ERROR',
      message: 'boom: universe is full',
    });
  });

  it('maps a ValidationError thrown inside a handler to VALIDATION', async () => {
    registerCommand('picky', {
      description: 'p',
      args: {},
      handler: () => { throw new ValidationError('Argument "mode" must be one of: A, B'); },
    });
    const res = await dispatch({}, { id: 'r8', cmd: 'picky', args: {} });
    expect(res.error.code).toBe('VALIDATION');
    expect(res.error.message).toBe('picky: Argument "mode" must be one of: A, B');
  });

  it('returns COMMAND_ERROR when an async handler rejects', async () => {
    registerCommand('async_boom', {
      description: 'ab',
      args: {},
      handler: async () => { throw new Error('network down'); },
    });
    const res = await dispatch({}, { id: 'r9', cmd: 'async_boom', args: {} });
    expect(res.error).toEqual({
      code: 'COMMAND_ERROR',
      message: 'async_boom: network down',
    });
  });

  it('never rejects, whatever the handler does', async () => {
    registerCommand('nasty', {
      description: 'n',
      args: {},
      // eslint-disable-next-line prefer-promise-reject-errors
      handler: () => Promise.reject('a bare string'),
    });
    const res = await dispatch({}, { id: 'r10', cmd: 'nasty', args: {} });
    expect(res.ok).toBe(false);
    expect(res.error.message).toBe('nasty: a bare string');
  });
});
