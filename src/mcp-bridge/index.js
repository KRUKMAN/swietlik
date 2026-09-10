import { reactive } from 'vue';
import ShowSingleton from '@/singletons/show.singleton';
import EventBus from '@/plugins/eventbus';
import { resolvePort } from '@root/mcp/protocol';
import Bridge from './bridge';
import './commands';

/**
 * MCP bridge entry point.
 *
 * Importing this module is the whole integration: it subscribes to the
 * existing `app_ready` EventBus event (emitted by `app.activity.vue` once the
 * show and the OFL fixture list are loaded) and starts the WebSocket bridge.
 *
 * @module mcp-bridge
 */

/**
 * The single live bridge, or null when the bridge is dormant.
 *
 * @type {Bridge|null}
 * @private
 */
let activeBridge = null;

/**
 * Decides whether the bridge should run at all.
 *
 * On by default in a dev build, off in a production build unless
 * `VITE_SWIETLIK_MCP=true`. `VITE_SWIETLIK_MCP=false` forces it off everywhere.
 *
 * @param {Object} env environment bag
 * @return {Boolean} whether to start
 * @private
 */
function isEnabled(env) {
  if (env.VITE_SWIETLIK_MCP === 'false') {
    return false;
  }
  return Boolean(env.DEV) || env.VITE_SWIETLIK_MCP === 'true';
}

/**
 * Starts the MCP bridge, if it is enabled and not already running.
 *
 * @param {Object} [env=import.meta.env] environment bag
 * @return {Bridge|null} the live bridge, or null when dormant
 * @public
 */
export function startMcpBridge(env = import.meta.env) {
  if (activeBridge) {
    return activeBridge;
  }
  if (!isEnabled(env)) {
    return null;
  }
  if (typeof globalThis.WebSocket !== 'function') {
    return null;
  }
  let port;
  try {
    port = resolvePort(env);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[mcp-bridge] not starting: ${err.message}`);
    return null;
  }

  // REACTIVITY INVARIANT: Vue's proxy cache returns the same proxy that
  // src/main.js installed as `$show`, so mutations made by a command render in
  // the UI and the visualizer immediately. Never pass the raw singleton.
  const show = reactive(ShowSingleton);

  activeBridge = new Bridge({ show, url: `ws://127.0.0.1:${port}` });
  activeBridge.connect();
  return activeBridge;
}

/**
 * Stops and clears the bridge.
 *
 * @public
 */
export function stopMcpBridge() {
  if (activeBridge) {
    activeBridge.disconnect();
    activeBridge = null;
  }
}

/**
 * @return {Bridge|null} the live bridge, or null
 * @public
 */
export function getActiveBridge() {
  return activeBridge;
}

EventBus.on('app_ready', () => {
  startMcpBridge();
});
