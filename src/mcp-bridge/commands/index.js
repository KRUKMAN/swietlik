/**
 * Command registry entry point.
 *
 * Every `*.commands.js` sibling registers its commands as an import side
 * effect. The glob is eager so registration completes before the bridge sends
 * its first response, and its result is exported so bundlers keep the modules.
 *
 * IMPORTANT: this file is written once and never edited again. New command
 * groups are added by creating a new `<group>.commands.js` file next to it.
 *
 * @module mcp-bridge/commands
 */

const modules = import.meta.glob('./*.commands.js', { eager: true });

/**
 * Paths of the command modules that were loaded, sorted. Used by the tool
 * parity test to prove no command group was silently dropped.
 *
 * @constant {Array<String>}
 */
export const loadedCommandModules = Object.keys(modules).sort();

export {
  dispatch,
  listCommands,
  hasCommand,
  getCommandSchema,
} from './registry';
