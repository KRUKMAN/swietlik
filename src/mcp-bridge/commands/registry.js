import {
  ERROR_CODES,
  makeSuccess,
  makeError,
} from '@root/mcp/protocol';
import { ValidationError, validateArgs } from './validate';

/**
 * Command registry for the in-app MCP bridge.
 *
 * Commands are pure `(show, args) -> serializable result` functions. Every
 * failure path is converted into a structured error envelope: a bad command
 * must never crash the app.
 *
 * @module mcp-bridge/commands/registry
 */

/**
 * Registered command specs, keyed by command name.
 *
 * @constant {Map<String, Object>}
 * @private
 */
const registry = new Map();

/**
 * Registers a command. Called at module load time by every `*.commands.js`.
 *
 * @param {String} name snake_case command name, matching the MCP tool name
 * @param {Object} spec command specification
 * @param {String} spec.description one-line description, mirrored in mcp/tools.js
 * @param {Object} spec.args argument schema, see ./validate.js
 * @param {Function} spec.handler `(show, args) => result | Promise<result>`
 * @public
 */
export function registerCommand(name, spec) {
  if (registry.has(name)) {
    throw new Error(`Command "${name}" is already registered`);
  }
  if (!spec || typeof spec.handler !== 'function') {
    throw new Error(`Command "${name}" needs a handler function`);
  }
  if (typeof spec.description !== 'string' || !spec.description.length) {
    throw new Error(`Command "${name}" needs a description`);
  }
  registry.set(name, {
    description: spec.description,
    args: spec.args || {},
    handler: spec.handler,
  });
}

/**
 * @param {String} name command name
 * @return {Object|undefined} the registered spec
 * @public
 */
export function getCommand(name) {
  return registry.get(name);
}

/**
 * @param {String} name command name
 * @return {Boolean} whether the command exists
 * @public
 */
export function hasCommand(name) {
  return registry.has(name);
}

/**
 * @return {Array<String>} every registered command name, sorted
 * @public
 */
export function listCommands() {
  return Array.from(registry.keys()).sort();
}

/**
 * @param {String} name command name
 * @return {Object} the command's argument schema
 * @throws {Error} when the command is not registered
 * @public
 */
export function getCommandSchema(name) {
  const command = registry.get(name);
  if (!command) {
    throw new Error(`Unknown command "${name}"`);
  }
  return command.args;
}

/**
 * Executes a request envelope against the show, returning a response envelope.
 *
 * Never throws and never rejects.
 *
 * @param {Object} show reactive show handle
 * @param {Object} request `{ id, cmd, args }`
 * @return {Promise<Object>} response envelope
 * @async
 * @public
 */
export async function dispatch(show, request) {
  const { id, cmd } = request;
  const command = registry.get(cmd);
  if (!command) {
    return makeError(
      id,
      ERROR_CODES.UNKNOWN_COMMAND,
      `Unknown command "${cmd}". Known commands: ${listCommands().join(', ')}`,
    );
  }

  let args;
  try {
    args = validateArgs(command.args, request.args || {});
  } catch (err) {
    return makeError(id, ERROR_CODES.VALIDATION, `${cmd}: ${err.message}`);
  }

  try {
    const result = await command.handler(show, args);
    return makeSuccess(id, result === undefined ? null : result);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const code = err instanceof ValidationError
      ? ERROR_CODES.VALIDATION
      : ERROR_CODES.COMMAND_ERROR;
    return makeError(id, code, `${cmd}: ${message}`);
  }
}

/**
 * Empties the registry. Test-only; the app never calls this.
 *
 * @private
 */
export function __resetRegistryForTests() {
  registry.clear();
}
