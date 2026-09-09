#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import AppHub, { HubError } from './hub.js';
import { TOOLS, TOOL_NAMES } from './tools.js';
import { ERROR_CODES, resolvePort } from './protocol.js';

/**
 * Świetlik MCP server.
 *
 * Exposes the in-app command registry as MCP tools. Tool call -> JSON request
 * over the WebSocket hub -> the connected Świetlik tab executes it against
 * `reactive(ShowSingleton)` -> response -> MCP result.
 *
 * stdout belongs to the stdio transport: every log line goes to stderr.
 *
 * @module mcp/server
 */

/**
 * Logger that keeps stdout clean for the MCP transport.
 *
 * @constant {Object}
 */
const stderrLogger = {
  log: (...args) => console.error(...args),
  warn: (...args) => console.error(...args),
  error: (...args) => console.error(...args),
};

/**
 * Formats a successful command result as MCP tool content.
 *
 * @param {String} name tool name
 * @param {*} result command result payload
 * @return {Object} MCP tool result
 * @private
 */
function toolResult(name, result) {
  if (name === 'screenshot_visualizer' && result && result.dataBase64) {
    return {
      content: [
        { type: 'image', data: result.dataBase64, mimeType: result.mimeType },
        {
          type: 'text',
          text: `Visualizer capture ${result.width}x${result.height} (${result.mimeType}).`,
        },
      ],
    };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}

/**
 * Formats a failure as an MCP tool error, preserving the structured code.
 *
 * @param {Error} err thrown error, usually a HubError
 * @return {Object} MCP tool result with isError set
 * @private
 */
function toolError(err) {
  const code = err instanceof HubError ? err.code : ERROR_CODES.COMMAND_ERROR;
  return {
    isError: true,
    content: [{
      type: 'text',
      text: JSON.stringify({ code, message: err.message }, null, 2),
    }],
  };
}

/**
 * Builds the MCP server around a hub.
 *
 * @param {AppHub} hub the WebSocket hub to forward calls to
 * @return {Server} configured MCP server
 * @public
 */
export function createServer(hub) {
  const server = new Server(
    { name: 'swietlik', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = request.params.arguments || {};
    if (!TOOL_NAMES.includes(name)) {
      return toolError(new HubError(
        ERROR_CODES.UNKNOWN_COMMAND,
        `Unknown tool "${name}". Available: ${TOOL_NAMES.join(', ')}`,
      ));
    }
    try {
      return toolResult(name, await hub.call(name, args));
    } catch (err) {
      return toolError(err);
    }
  });

  return server;
}

/**
 * Starts the hub and the stdio MCP server.
 *
 * @return {Promise<void>}
 * @async
 * @public
 */
export async function main() {
  const port = resolvePort(process.env);
  const hub = new AppHub({ port, logger: stderrLogger });
  await hub.start();
  stderrLogger.log(`[swietlik-mcp] hub listening on ws://127.0.0.1:${hub.port}`);

  const server = createServer(hub);
  await server.connect(new StdioServerTransport());

  const shutdown = async () => {
    await hub.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run only when executed directly -- importing this file from a test must not
// bind a port.
const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main().catch((err) => {
    stderrLogger.error(`[swietlik-mcp] fatal: ${err.message}`);
    process.exit(1);
  });
}
