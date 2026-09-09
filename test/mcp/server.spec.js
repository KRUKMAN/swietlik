// @vitest-environment node
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TOOL_NAMES } from '@root/mcp/tools';
import {
  makeSuccess, makeError, parseMessage, isRequest,
} from '@root/mcp/protocol';

/**
 * Absolute path to the server entry point.
 *
 * @constant {String}
 */
const SERVER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'mcp',
  'server.js',
);

/**
 * Asks the OS for a free TCP port.
 *
 * @return {Promise<Number>} a port nobody is listening on
 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

let client;
let transport;
let port;
const sockets = [];

/**
 * Connects a scripted fake Świetlik app to the server hub.
 *
 * @param {Function} onRequest `(request) => responseEnvelope | null`
 * @return {Promise<WebSocket>} the open client socket
 */
function connectFakeApp(onRequest) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    sockets.push(socket);
    socket.on('message', (raw) => {
      const message = parseMessage(raw);
      if (!isRequest(message)) {
        return;
      }
      const response = onRequest(message);
      if (response) {
        socket.send(JSON.stringify(response));
      }
    });
    socket.on('open', () => resolve(socket));
    socket.on('error', reject);
  });
}

beforeEach(async () => {
  port = await findFreePort();
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_PATH],
    env: { ...process.env, SWIETLIK_MCP_PORT: String(port) },
    stderr: 'ignore',
  });
  client = new Client({ name: 'swietlik-test', version: '0.0.0' });
  await client.connect(transport);
}, 30000);

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.terminate());
  await client.close();
}, 30000);

describe('MCP server -- tool surface', () => {
  it('advertises every tool from the catalogue', async () => {
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
  }, 30000);

  it('gives every tool a description and an object input schema', async () => {
    const listed = await client.listTools();
    listed.tools.forEach((tool) => {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe('object');
    });
  }, 30000);
});

describe('MCP server -- no app connected', () => {
  it('returns a structured APP_NOT_CONNECTED error with a remedy', async () => {
    const res = await client.callTool({ name: 'get_show_state', arguments: {} });

    expect(res.isError).toBe(true);
    const payload = JSON.parse(res.content[0].text);
    expect(payload.code).toBe('APP_NOT_CONNECTED');
    expect(payload.message).toContain('localhost:5173');
  }, 30000);
});

describe('MCP server -- with a connected app', () => {
  it('round-trips a query tool end to end', async () => {
    await connectFakeApp((request) => makeSuccess(request.id, {
      name: 'fake_show', bpm: 128, fixtureCount: 2,
    }));
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const res = await client.callTool({ name: 'get_show_state', arguments: {} });

    expect(res.isError).toBeFalsy();
    expect(JSON.parse(res.content[0].text)).toEqual({
      name: 'fake_show', bpm: 128, fixtureCount: 2,
    });
  }, 30000);

  it('forwards tool arguments verbatim to the app', async () => {
    const seen = [];
    await connectFakeApp((request) => {
      seen.push(request);
      return makeSuccess(request.id, { ok: true });
    });
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    await client.callTool({
      name: 'patch_fixture',
      arguments: { manufacturer: 'clay-paky', model: 'sharpy', universe: 0 },
    });

    expect(seen[0].cmd).toBe('patch_fixture');
    expect(seen[0].args).toEqual({ manufacturer: 'clay-paky', model: 'sharpy', universe: 0 });
  }, 30000);

  it('returns image content for screenshot_visualizer', async () => {
    await connectFakeApp((request) => makeSuccess(request.id, {
      mimeType: 'image/png',
      width: 1280,
      height: 720,
      dataBase64: 'UE5HREFUQQ==',
    }));
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const res = await client.callTool({ name: 'screenshot_visualizer', arguments: {} });

    expect(res.content[0]).toEqual({
      type: 'image',
      data: 'UE5HREFUQQ==',
      mimeType: 'image/png',
    });
    expect(res.content[1].text).toContain('1280x720');
  }, 30000);

  it('surfaces an app-side command error as an MCP tool error', async () => {
    await connectFakeApp((request) => makeError(
      request.id,
      'COMMAND_ERROR',
      'patch_fixture: Cannot patch fixture on this interval',
    ));
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const res = await client.callTool({
      name: 'patch_fixture',
      arguments: { manufacturer: 'clay-paky', model: 'sharpy' },
    });

    expect(res.isError).toBe(true);
    const payload = JSON.parse(res.content[0].text);
    expect(payload.code).toBe('COMMAND_ERROR');
    expect(payload.message).toContain('Cannot patch fixture on this interval');
  }, 30000);
});
