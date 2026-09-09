/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

const filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(filename);

const resolveRoot = (...segments) => path.resolve(rootDir, ...segments);

/**
 * Virtual module id backing every `?worker` / `?worker&inline` import.
 * Vite's real worker pipeline is unavailable under Vitest, so every worker
 * specifier is redirected to an inert stub class instead.
 */
const WORKER_STUB_ID = '\0swietlik:worker-stub';

const WORKER_STUB_SOURCE = `
export default class WorkerStub {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
    this.onmessageerror = null;
  }

  postMessage() {}

  terminate() {}

  addEventListener() {}

  removeEventListener() {}

  dispatchEvent() {
    return false;
  }
}
`;

/**
 * Inline Vite plugin replacing worker imports with an inert stub.
 *
 * @return {import('vite').Plugin} plugin definition
 */
function workerStubPlugin() {
  return {
    name: 'swietlik:worker-stub',
    enforce: 'pre',
    resolveId(source) {
      if (source === WORKER_STUB_ID) {
        return WORKER_STUB_ID;
      }
      if (source.endsWith('?worker') || source.endsWith('?worker&inline')) {
        return WORKER_STUB_ID;
      }
      return null;
    },
    load(id) {
      if (id === WORKER_STUB_ID) {
        return WORKER_STUB_SOURCE;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    workerStubPlugin(),
    vue(),
  ],
  resolve: {
    // NOTE: array form -- order matters. The regex entries MUST come first so
    // that WebGL/Three.js-bound modules are swapped for stubs *before* the
    // generic '@' prefix alias rewrites the specifier. Each regex is anchored
    // at both ends so the whole specifier is consumed by the replacement.
    alias: [
      {
        find: /^.*\/plugins\/visualizer\/moving_head$/,
        replacement: resolveRoot('./test/stubs/moving_head.stub.js'),
      },
      {
        find: /^.*\/plugins\/visualizer\/controls$/,
        replacement: resolveRoot('./test/stubs/controls.stub.js'),
      },
      {
        find: /^.*\/plugins\/wsc\.connection$/,
        replacement: resolveRoot('./test/stubs/wsc.connection.stub.js'),
      },
      {
        find: '@',
        replacement: resolveRoot('./src'),
      },
      {
        find: '@root',
        replacement: resolveRoot('./'),
      },
    ],
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.spec.js'],
    setupFiles: ['./test/setup.js'],
    isolate: true,
    pool: 'threads',
    restoreMocks: true,
    clearMocks: true,
  },
});
