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

/**
 * The registry's validator (`src/mcp-bridge/commands/validate.js`) has no
 * `integer` type of its own -- a whole-number rule is expressed as
 * `{ type: 'number', integer: true }`. This folds that pair down to the same
 * JSON-Schema-flavoured type string `mcp/tools.js` uses, so the two sides
 * can be compared directly.
 *
 * @param {Object} rule a single registry argument rule
 * @return {String} `'integer'`, or the rule's declared `type` unchanged
 * @private
 */
function registryType(rule) {
  if (rule.type === 'number' && rule.integer === true) {
    return 'integer';
  }
  return rule.type;
}

/**
 * The registry's array `items` shorthand is a bare type-name string (eg.
 * `'number'`), with no room for an integer refinement of its own -- the
 * fixture-id-style arrays that need one carry a sibling `itemsInteger: true`
 * flag instead (mirroring the scalar `integer: true` convention above).
 * Returns `undefined` when either side has no comparable primitive item type
 * (eg. `mcp/tools.js` describing a nested object-shaped item), so the caller
 * skips those rather than misreading them as a mismatch.
 *
 * @param {Object} rule a single registry argument rule
 * @return {String|undefined} the effective item type, if there is one
 * @private
 */
function registryItemType(rule) {
  if (typeof rule.items !== 'string') {
    return undefined;
  }
  if (rule.items === 'number' && rule.itemsInteger === true) {
    return 'integer';
  }
  return rule.items;
}

/**
 * @param {Object} prop a single `mcp/tools.js` JSON-Schema property
 * @return {String|undefined} the property's array item type, if it declares
 *   a primitive one
 * @private
 */
function toolItemType(prop) {
  if (!prop.items || typeof prop.items.type !== 'string') {
    return undefined;
  }
  return prop.items.type;
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

  it('declares the same argument type on both sides', () => {
    TOOLS.forEach((tool) => {
      const registrySchema = getCommandSchema(tool.name);
      Object.keys(tool.inputSchema.properties).forEach((key) => {
        const prop = tool.inputSchema.properties[key];
        const rule = registrySchema[key];
        expect(registryType(rule), `type of ${tool.name}.${key}`).toBe(prop.type);
      });
    });
  });

  it('declares the same enum values on both sides, where both declare one', () => {
    TOOLS.forEach((tool) => {
      const registrySchema = getCommandSchema(tool.name);
      Object.keys(tool.inputSchema.properties).forEach((key) => {
        const prop = tool.inputSchema.properties[key];
        const rule = registrySchema[key];
        if (prop.enum === undefined || rule.enum === undefined) {
          return;
        }
        expect([...rule.enum].sort(), `enum of ${tool.name}.${key}`)
          .toEqual([...prop.enum].sort());
      });
    });
  });

  it('declares the same minimum/maximum on both sides, where both declare one', () => {
    TOOLS.forEach((tool) => {
      const registrySchema = getCommandSchema(tool.name);
      Object.keys(tool.inputSchema.properties).forEach((key) => {
        const prop = tool.inputSchema.properties[key];
        const rule = registrySchema[key];
        if (prop.minimum !== undefined && rule.min !== undefined) {
          expect(rule.min, `minimum of ${tool.name}.${key}`).toBe(prop.minimum);
        }
        if (prop.maximum !== undefined && rule.max !== undefined) {
          expect(rule.max, `maximum of ${tool.name}.${key}`).toBe(prop.maximum);
        }
        if (prop.minItems !== undefined && rule.minLength !== undefined) {
          expect(rule.minLength, `minItems of ${tool.name}.${key}`).toBe(prop.minItems);
        }
      });
    });
  });

  it('declares the same array item type on both sides, where both declare a primitive one', () => {
    TOOLS.forEach((tool) => {
      const registrySchema = getCommandSchema(tool.name);
      Object.keys(tool.inputSchema.properties).forEach((key) => {
        const prop = tool.inputSchema.properties[key];
        if (prop.type !== 'array') {
          return;
        }
        const rule = registrySchema[key];
        const toolItem = toolItemType(prop);
        const registryItem = registryItemType(rule);
        if (toolItem === undefined || registryItem === undefined) {
          return;
        }
        expect(registryItem, `item type of ${tool.name}.${key}`).toBe(toolItem);
      });
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
