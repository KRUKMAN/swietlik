// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION,
  DEFAULT_MCP_PORT,
  DMX_GATEWAY_PORT,
  COMMAND_TIMEOUT_MS,
  ERROR_CODES,
  MESSAGE_TYPES,
  APP_NOT_CONNECTED_REMEDY,
  makeRequest,
  makeSuccess,
  makeError,
  makeDetach,
  parseMessage,
  isRequest,
  isResponse,
  resolvePort,
} from '@root/mcp/protocol';

describe('protocol constants', () => {
  it('pins the wire version, ports and timeout', () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(DEFAULT_MCP_PORT).toBe(5215);
    expect(DMX_GATEWAY_PORT).toBe(5214);
    expect(COMMAND_TIMEOUT_MS).toBe(10000);
  });

  it('exposes every error code as a self-named string', () => {
    expect(ERROR_CODES).toEqual({
      APP_NOT_CONNECTED: 'APP_NOT_CONNECTED',
      TIMEOUT: 'TIMEOUT',
      VALIDATION: 'VALIDATION',
      COMMAND_ERROR: 'COMMAND_ERROR',
      UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
    });
  });

  it('names the three message types', () => {
    expect(MESSAGE_TYPES).toEqual({
      REQUEST: 'request',
      RESPONSE: 'response',
      DETACH: 'detach',
    });
  });

  it('gives the caller an actionable remedy for a missing app', () => {
    expect(APP_NOT_CONNECTED_REMEDY).toContain('localhost:5173');
  });
});

describe('message constructors', () => {
  it('builds a request envelope', () => {
    expect(makeRequest('r1', 'set_bpm', { bpm: 128 })).toEqual({
      v: 1, type: 'request', id: 'r1', cmd: 'set_bpm', args: { bpm: 128 },
    });
  });

  it('defaults request args to an empty object', () => {
    expect(makeRequest('r2', 'stop_all').args).toEqual({});
  });

  it('builds a success envelope', () => {
    expect(makeSuccess('r1', { bpm: 128 })).toEqual({
      v: 1, type: 'response', id: 'r1', ok: true, result: { bpm: 128 },
    });
  });

  it('builds an error envelope', () => {
    expect(makeError('r1', ERROR_CODES.TIMEOUT, 'too slow')).toEqual({
      v: 1,
      type: 'response',
      id: 'r1',
      ok: false,
      error: { code: 'TIMEOUT', message: 'too slow' },
    });
  });

  it('builds a detach envelope', () => {
    expect(makeDetach('superseded')).toEqual({
      v: 1, type: 'detach', reason: 'superseded',
    });
  });
});

describe('parseMessage', () => {
  it('parses a JSON string into an object', () => {
    expect(parseMessage('{"v":1,"type":"request","id":"a","cmd":"undo","args":{}}'))
      .toEqual({
        v: 1, type: 'request', id: 'a', cmd: 'undo', args: {},
      });
  });

  it('parses a Buffer payload (ws delivers Buffers by default)', () => {
    const buffer = Buffer.from(JSON.stringify(makeSuccess('a', 1)), 'utf8');
    expect(parseMessage(buffer)).toEqual(makeSuccess('a', 1));
  });

  it('returns null for malformed JSON instead of throwing', () => {
    expect(parseMessage('not json')).toBeNull();
  });

  it('returns null for a JSON scalar or array', () => {
    expect(parseMessage('42')).toBeNull();
    expect(parseMessage('[1,2]')).toBeNull();
  });
});

describe('message predicates', () => {
  it('recognises a well-formed request', () => {
    expect(isRequest(makeRequest('a', 'undo'))).toBe(true);
  });

  it('rejects a request with no cmd', () => {
    expect(isRequest({ v: 1, type: 'request', id: 'a' })).toBe(false);
  });

  it('rejects a request carrying the wrong protocol version', () => {
    expect(isRequest({
      v: 2, type: 'request', id: 'a', cmd: 'undo', args: {},
    })).toBe(false);
  });

  it('recognises both response shapes', () => {
    expect(isResponse(makeSuccess('a', null))).toBe(true);
    expect(isResponse(makeError('a', 'TIMEOUT', 'x'))).toBe(true);
    expect(isResponse(makeRequest('a', 'undo'))).toBe(false);
    expect(isResponse(null)).toBe(false);
  });
});

describe('resolvePort', () => {
  it('falls back to the default when no env var is set', () => {
    expect(resolvePort({})).toBe(5215);
    expect(resolvePort()).toBe(5215);
  });

  it('prefers SWIETLIK_MCP_PORT over VITE_SWIETLIK_MCP_PORT', () => {
    expect(resolvePort({
      SWIETLIK_MCP_PORT: '6000',
      VITE_SWIETLIK_MCP_PORT: '7000',
    })).toBe(6000);
  });

  it('accepts the VITE_ prefixed variant on its own', () => {
    expect(resolvePort({ VITE_SWIETLIK_MCP_PORT: '7000' })).toBe(7000);
  });

  it('accepts 0 so tests can bind an ephemeral port', () => {
    expect(resolvePort({ SWIETLIK_MCP_PORT: '0' })).toBe(0);
  });

  it('rejects the DMX gateway port', () => {
    expect(() => resolvePort({ SWIETLIK_MCP_PORT: '5214' }))
      .toThrow(/5214 is the DMX gateway port/);
  });

  it('rejects non-numeric and out-of-range values', () => {
    expect(() => resolvePort({ SWIETLIK_MCP_PORT: 'abc' })).toThrow(/must be an integer/);
    expect(() => resolvePort({ SWIETLIK_MCP_PORT: '70000' })).toThrow(/0 and 65535/);
    expect(() => resolvePort({ SWIETLIK_MCP_PORT: '-1' })).toThrow(/0 and 65535/);
  });
});
