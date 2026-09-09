import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const helperDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Repository root, derived from this file's location (test/helpers/ -> ../../).
 *
 * @constant {String}
 */
export const REPO_ROOT = path.resolve(helperDir, '..', '..');

/**
 * Directory holding the bundled Open Fixture Library definitions.
 *
 * @constant {String}
 */
export const OFL_ROOT = path.join(REPO_ROOT, 'public', 'fixtures');

/**
 * Loads an OFL fixture definition from `public/fixtures`.
 *
 * @param {String} relPath manufacturer/fixture path, with or without the
 *   trailing `.json` (eg. `'ayrton/mistral-tc'`).
 * @return {Object} parsed OFL fixture definition
 */
export function loadOFL(relPath) {
  const normalized = String(relPath).replace(/\\/g, '/').replace(/\.json$/i, '');
  const absPath = path.join(OFL_ROOT, `${normalized}.json`);
  if (!fs.existsSync(absPath)) {
    throw new Error(`OFL fixture not found: ${absPath}`);
  }
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

export default loadOFL;
