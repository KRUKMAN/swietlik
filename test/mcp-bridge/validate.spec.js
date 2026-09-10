import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  validateArgs,
  assertVec3,
} from '@/mcp-bridge/commands/validate';

describe('validateArgs -- shape', () => {
  it('rejects a non-object argument bag', () => {
    expect(() => validateArgs({}, null)).toThrow(ValidationError);
    expect(() => validateArgs({}, [])).toThrow(/must be an object/);
  });

  it('rejects unknown arguments and lists the accepted ones', () => {
    const schema = { id: { type: 'number' }, name: { type: 'string' } };
    expect(() => validateArgs(schema, { nope: 1 }))
      .toThrow(/Unknown argument "nope". Accepted: id, name/);
  });

  it('reports "(none)" when the command takes no arguments', () => {
    expect(() => validateArgs({}, { x: 1 }))
      .toThrow(/Unknown argument "x". Accepted: \(none\)/);
  });
});

describe('validateArgs -- presence and defaults', () => {
  it('throws when a required argument is missing', () => {
    expect(() => validateArgs({ id: { type: 'number', required: true } }, {}))
      .toThrow('Missing required argument "id"');
  });

  it('treats explicit null as absent', () => {
    expect(() => validateArgs({ id: { type: 'number', required: true } }, { id: null }))
      .toThrow('Missing required argument "id"');
  });

  it('applies defaults for absent optional arguments', () => {
    const schema = { state: { type: 'boolean', default: true } };
    expect(validateArgs(schema, {})).toEqual({ state: true });
  });

  it('omits optional arguments that have no default', () => {
    expect(validateArgs({ name: { type: 'string' } }, {})).toEqual({});
  });
});

describe('validateArgs -- types and ranges', () => {
  it('enforces the declared type', () => {
    expect(() => validateArgs({ bpm: { type: 'number' } }, { bpm: '128' }))
      .toThrow('Argument "bpm" must be of type number');
  });

  it('rejects NaN and Infinity as numbers', () => {
    expect(() => validateArgs({ bpm: { type: 'number' } }, { bpm: NaN }))
      .toThrow('Argument "bpm" must be of type number');
    expect(() => validateArgs({ bpm: { type: 'number' } }, { bpm: Infinity }))
      .toThrow('Argument "bpm" must be of type number');
  });

  it('rejects arrays where an object is expected', () => {
    expect(() => validateArgs({ position: { type: 'object' } }, { position: [] }))
      .toThrow('Argument "position" must be of type object');
  });

  it('enforces integer, min and max', () => {
    const schema = { id: { type: 'number', integer: true, min: 0, max: 10 } };
    expect(() => validateArgs(schema, { id: 1.5 })).toThrow('Argument "id" must be an integer');
    expect(() => validateArgs(schema, { id: -1 })).toThrow('Argument "id" must be >= 0');
    expect(() => validateArgs(schema, { id: 11 })).toThrow('Argument "id" must be <= 10');
    expect(validateArgs(schema, { id: 7 })).toEqual({ id: 7 });
  });

  it('enforces minLength on arrays and strings', () => {
    expect(() => validateArgs({ ids: { type: 'array', minLength: 1 } }, { ids: [] }))
      .toThrow('Argument "ids" must contain at least 1 item(s)');
  });

  it('enforces array item types with an indexed message', () => {
    const schema = { ids: { type: 'array', items: 'number' } };
    expect(() => validateArgs(schema, { ids: [1, 'two'] }))
      .toThrow('Argument "ids[1]" must be of type number');
  });

  it('enforces enums', () => {
    const schema = { mime_type: { type: 'string', enum: ['image/png', 'image/jpeg'] } };
    expect(() => validateArgs(schema, { mime_type: 'image/gif' }))
      .toThrow('Argument "mime_type" must be one of: image/png, image/jpeg');
  });
});

describe('assertVec3', () => {
  it('returns a plain copy of the three axes', () => {
    expect(assertVec3('position', {
      x: 1, y: 2, z: 3, extra: 9,
    })).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('names the offending axis', () => {
    expect(() => assertVec3('position', { x: 1, y: 'up', z: 3 }))
      .toThrow('Argument "position.y" must be a number');
  });

  it('throws a ValidationError, not a plain Error', () => {
    expect(() => assertVec3('rotation', {})).toThrow(ValidationError);
  });
});
