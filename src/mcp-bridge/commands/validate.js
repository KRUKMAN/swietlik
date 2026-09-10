/**
 * Argument validation for the MCP command registry.
 *
 * Validation runs before a command touches any model, so a malformed request
 * can never leave the show in a half-mutated state.
 *
 * @module mcp-bridge/commands/validate
 */

/**
 * @class ValidationError
 * @classdesc Raised when a command argument fails its schema rule. Mapped to
 * the VALIDATION error code by the dispatcher.
 * @extends {Error}
 */
export class ValidationError extends Error {
  /**
   * @param {String} message explanation naming the offending argument
   */
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Per-type predicates. `number` rejects NaN/Infinity, `object` rejects arrays.
 *
 * @constant {Object}
 * @private
 */
const TYPE_CHECKS = {
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  string: (value) => typeof value === 'string',
  boolean: (value) => typeof value === 'boolean',
  object: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  array: (value) => Array.isArray(value),
};

/**
 * Validates and normalises a command's argument bag.
 *
 * Strict: unknown keys are rejected rather than ignored, so an agent that
 * misspells an argument gets told instead of silently getting a no-op.
 *
 * @param {Object} schema map of argument name to rule object
 * @param {Object} args raw arguments from the wire
 * @return {Object} normalised arguments with defaults applied
 * @throws {ValidationError} on any rule violation
 */
export function validateArgs(schema, args) {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new ValidationError('Arguments must be an object.');
  }
  const known = Object.keys(schema);
  const accepted = known.length ? known.join(', ') : '(none)';
  Object.keys(args).forEach((key) => {
    if (!known.includes(key)) {
      throw new ValidationError(`Unknown argument "${key}". Accepted: ${accepted}`);
    }
  });

  const out = {};
  known.forEach((key) => {
    const rule = schema[key];
    const value = args[key];
    if (value === undefined || value === null) {
      if (rule.required) {
        throw new ValidationError(`Missing required argument "${key}"`);
      }
      if (rule.default !== undefined) {
        out[key] = rule.default;
      }
      return;
    }
    if (!TYPE_CHECKS[rule.type](value)) {
      throw new ValidationError(`Argument "${key}" must be of type ${rule.type}`);
    }
    if (rule.integer && !Number.isInteger(value)) {
      throw new ValidationError(`Argument "${key}" must be an integer`);
    }
    if (rule.min !== undefined && value < rule.min) {
      throw new ValidationError(`Argument "${key}" must be >= ${rule.min}`);
    }
    if (rule.max !== undefined && value > rule.max) {
      throw new ValidationError(`Argument "${key}" must be <= ${rule.max}`);
    }
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      throw new ValidationError(
        `Argument "${key}" must contain at least ${rule.minLength} item(s)`,
      );
    }
    if (rule.items && rule.type === 'array') {
      value.forEach((item, index) => {
        if (!TYPE_CHECKS[rule.items](item)) {
          throw new ValidationError(`Argument "${key}[${index}]" must be of type ${rule.items}`);
        }
      });
    }
    if (rule.enum && !rule.enum.includes(value)) {
      throw new ValidationError(`Argument "${key}" must be one of: ${rule.enum.join(', ')}`);
    }
    out[key] = value;
  });
  return out;
}

/**
 * Validates a 3D vector argument and strips any extra keys.
 *
 * @param {String} name argument name, used in the error message
 * @param {Object} value candidate `{ x, y, z }` object
 * @return {Object} `{ x, y, z }` copy
 * @throws {ValidationError} when any axis is missing or not finite
 */
export function assertVec3(name, value) {
  ['x', 'y', 'z'].forEach((axis) => {
    if (typeof value[axis] !== 'number' || !Number.isFinite(value[axis])) {
      throw new ValidationError(`Argument "${name}.${axis}" must be a number`);
    }
  });
  return { x: value.x, y: value.y, z: value.z };
}
