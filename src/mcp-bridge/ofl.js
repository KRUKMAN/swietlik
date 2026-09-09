import axios from 'axios';

/**
 * Open Fixture Library loader for the MCP bridge.
 *
 * Mirrors the fetch path and cache strategy of `Show.prepareFixtures` so a
 * bridge-patched fixture is indistinguishable from a showfile-loaded one.
 *
 * @module mcp-bridge/ofl
 */

/**
 * Serialised OFL payloads keyed by `manufacturer/model`.
 *
 * Stored as JSON strings, exactly like `show.model.js`'s `fixtureDataCache`:
 * `Fixture.prepareChannels` mutates the definition it is handed, so every
 * caller must receive its own copy.
 *
 * @constant {Object<String, String>}
 * @private
 */
const oflCache = {};

/**
 * Normalises a model name to its bare form, without the `.json` suffix.
 *
 * @param {String} model model name as supplied by the caller
 * @return {String} bare model name
 * @private
 */
function bareModel(model) {
  return String(model).replace(/\.json$/i, '');
}

/**
 * Loads an OFL fixture definition, memoised per manufacturer/model.
 *
 * @param {String} manufacturer manufacturer folder name, eg. `clay-paky`
 * @param {String} model fixture file name, with or without `.json`
 * @return {Promise<Object>} a fresh deep copy of the OFL definition
 * @throws {Error} when the definition cannot be loaded
 * @async
 * @public
 */
export async function fetchOFL(manufacturer, model) {
  const key = `${manufacturer}/${bareModel(model)}`;
  if (oflCache[key]) {
    return JSON.parse(oflCache[key]);
  }
  let payload;
  try {
    const base = import.meta.env.VITE_STATIC_URL || '';
    const res = await axios.get(`${base}fixtures/${key}.json`);
    payload = res ? res.data : null;
  } catch (err) {
    throw new Error(`Could not load OFL definition for ${key}: ${err.message}`);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Could not load OFL definition for ${key}: empty response`);
  }
  oflCache[key] = JSON.stringify(payload);
  return JSON.parse(oflCache[key]);
}

/**
 * Empties the OFL cache. Used by tests and by `new_show`.
 *
 * @public
 */
export function clearOFLCache() {
  Object.keys(oflCache).forEach((key) => {
    delete oflCache[key];
  });
}
