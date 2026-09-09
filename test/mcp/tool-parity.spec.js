import { describe, it, expect } from 'vitest';
import {
  listCommands,
  getCommandSchema,
  loadedCommandModules,
} from '@/mcp-bridge/commands';
import { TOOLS, TOOL_NAMES } from '@root/mcp/tools';

/**
 * Registry argument names that are marked required.
 *
 * @param {String} name command name
 * @return {Array<String>} sorted required argument names
 */
function registryRequired(name) {
  const schema = getCommandSchema(name);
  return Object.keys(schema).filter((key) => schema[key].required === true).sort();
}

describe('tool/command parity', () => {
  it('loads all five command modules through the glob', () => {
    expect(loadedCommandModules).toEqual([
      './control.commands.js',
      './patch.commands.js',
      './query.commands.js',
      './show.commands.js',
      './vision.commands.js',
    ]);
  });

  it('exposes exactly one MCP tool per registered command', () => {
    expect(TOOL_NAMES).toEqual(listCommands());
  });

  it('declares the same argument names on both sides', () => {
    TOOLS.forEach((tool) => {
      const registryArgs = Object.keys(getCommandSchema(tool.name)).sort();
      const toolArgs = Object.keys(tool.inputSchema.properties).sort();
      expect(toolArgs, `argument names for ${tool.name}`).toEqual(registryArgs);
    });
  });

  it('declares the same required arguments on both sides', () => {
    TOOLS.forEach((tool) => {
      const toolRequired = [...(tool.inputSchema.required || [])].sort();
      expect(toolRequired, `required args for ${tool.name}`)
        .toEqual(registryRequired(tool.name));
    });
  });

  it('closes every tool schema to unknown arguments', () => {
    TOOLS.forEach((tool) => {
      expect(tool.inputSchema.additionalProperties, `${tool.name} schema`).toBe(false);
    });
  });

  it('gives every tool a usable description', () => {
    TOOLS.forEach((tool) => {
      expect(tool.description.length, `${tool.name} description`).toBeGreaterThan(20);
    });
  });
});
