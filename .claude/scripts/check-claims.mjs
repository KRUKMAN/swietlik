#!/usr/bin/env node
/**
 * Fail when a checkable factual claim in the agent docs no longer matches the repo.
 *
 * Adapted from open-mercato's scripts/check-version-sync.sh, which asserts that the version and
 * the advertised skill count agree across four files. The regression it was written for is
 * instructive: their metadata claimed "18 user-facing skills" long after the real count was 11,
 * and package.json sat at 1.8.0 while the plugin shipped 1.20.0. Nothing caught either.
 *
 * Why this matters more for agent docs than for human docs: an agent trusts a stated fact
 * completely and has no way to sense staleness. "156 tests across 10 files" that is no longer true
 * does not read as suspicious — it reads as a baseline, and a change that drops coverage looks
 * like it preserved it.
 *
 * Claims are asserted against things cheap to measure. A claim that needs a full test run to check
 * should be rewritten as a claim about something that does not.
 *
 * Usage: node .claude/scripts/check-claims.mjs [--root <dir>]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag > -1 ? process.argv[rootFlag + 1] : process.cwd();

const errors = [];
const notes = [];

function read(relative) {
  try {
    return readFileSync(join(root, relative), 'utf8');
  } catch {
    return null;
  }
}

function countSpecFiles(dir, accumulator = []) {
  if (!existsSync(dir)) return accumulator;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) countSpecFiles(full, accumulator);
    else if (entry.name.endsWith('.spec.js')) accumulator.push(full);
  }
  return accumulator;
}

const claudeMd = read('CLAUDE.md');

// ---------------------------------------------------------------------------
// Claim: the Phase 0 close line in CLAUDE.md §5 — "N tests across M files".
// The file count is cheap to verify; the test count is not, so only the file
// count is asserted, and a mismatch points at the sentence that needs editing.
// ---------------------------------------------------------------------------
if (claudeMd) {
  const match = claudeMd.match(/(.{0,40}?)(\d+)\s+tests?\s+across\s+(\d+)\s+files?/i);
  if (match) {
    const [, prefix, , claimedFiles] = match;
    const actualFiles = countSpecFiles(join(root, 'test')).length;
    /**
     * A claim scoped to a past milestone ("Phase 0 close: 156 tests across 10 files") is a
     * historical record, not an assertion about the working tree, and failing on it would punish
     * the repo for making progress. Only an unscoped, present-tense claim is asserted; a drifted
     * historical one is still surfaced, because a stale *baseline* is worth knowing about even
     * when it is not wrong.
     */
    const historical = /\b(?:phase\s*\d+\s*close|as of|at\s+the\s+time)\b/i.test(prefix);
    if (Number(claimedFiles) === actualFiles) {
      notes.push(`spec-file count: ${actualFiles} (matches CLAUDE.md)`);
    } else if (historical) {
      notes.push(
        `CLAUDE.md's historical baseline says ${claimedFiles} spec files; there are now`
        + ` ${actualFiles}. Not an error — but confirm the newer files are genuinely new work.`,
      );
    } else {
      errors.push(
        `CLAUDE.md claims "${match[0].slice(prefix.length)}" but there are ${actualFiles}`
        + ' *.spec.js files under test/. Update the sentence, or scope it to a phase close'
        + ' if it is meant as a historical baseline.',
      );
    }
  } else {
    notes.push('no "N tests across M files" claim found in CLAUDE.md — nothing to check');
  }
}

// ---------------------------------------------------------------------------
// Claim: the @asls/* pin floor and its alignment with .env's WSC_VERSION.
// Dropping below 2.2.0 hard-fails npm ci on Windows with EBADPLATFORM.
// ---------------------------------------------------------------------------
const packageJson = read('package.json');
if (packageJson) {
  let parsed;
  try {
    parsed = JSON.parse(packageJson);
  } catch {
    errors.push('package.json is not valid JSON');
  }
  if (parsed) {
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    for (const name of ['@asls/wsc-client', '@asls/wsc-sdk']) {
      const range = deps?.[name];
      if (!range) continue;
      const floor = range.match(/(\d+)\.(\d+)\.(\d+)/);
      if (!floor) continue;
      const [major, minor] = [Number(floor[1]), Number(floor[2])];
      if (major < 2 || (major === 2 && minor < 2)) {
        errors.push(
          `${name} is pinned at ${range}, below the 2.2.0 floor. Versions under 2.2.0 declare`
          + ' os: "windows" instead of "win32" and hard-fail npm ci with EBADPLATFORM.'
          + ' See docs/swietlik/lessons/a-pinned-dependencys-metadata-can-be-platform-wrong.md.',
        );
      } else {
        notes.push(`${name}: ${range} (at or above the 2.2.0 floor)`);
      }
    }

    const env = read('.env');
    const declared = env?.match(/WSC_VERSION\s*=\s*"?([\d.]+)"?/);
    const clientRange = deps?.['@asls/wsc-client'];
    if (declared && clientRange && !clientRange.includes(declared[1])) {
      errors.push(
        `.env declares WSC_VERSION="${declared[1]}" but @asls/wsc-client is pinned at`
        + ` ${clientRange}. CLAUDE.md §3 requires these to stay aligned.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Claim: the two-import model→visualizer boundary (a FROZEN contract surface).
// Counted rather than asserted, so widening it fails loudly here as well as in
// review.
// ---------------------------------------------------------------------------
function collectSources(dir, accumulator = []) {
  if (!existsSync(dir)) return accumulator;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectSources(full, accumulator);
    else if (/\.(js|mjs|vue)$/.test(entry.name)) accumulator.push(full);
  }
  return accumulator;
}

const visualizerImports = [];
for (const file of collectSources(join(root, 'src', 'models'))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/from\s+['"][^'"]*plugins\/visualizer\/[^'"]+['"]/g)) {
    visualizerImports.push(`${file.replace(root, '').replace(/\\/g, '/').replace(/^\//, '')}: ${match[0]}`);
  }
}
if (visualizerImports.length > 2) {
  errors.push(
    `src/models/ has ${visualizerImports.length} imports from plugins/visualizer/, but the`
    + ' boundary is FROZEN at two (both in fixture.model.js). Widening it breaks the test'
    + ' strategy in CLAUDE.md §5. See docs/swietlik/contract-surfaces.md §3:\n'
    + visualizerImports.map((entry) => `      ${entry}`).join('\n'),
  );
} else {
  notes.push(`model→visualizer imports: ${visualizerImports.length} (boundary intact)`);
}

// ---------------------------------------------------------------------------
// Claim: COPYING must not be shadowed by a same-named file in public/.
// ---------------------------------------------------------------------------
if (existsSync(join(root, 'public', 'COPYING'))) {
  errors.push(
    'public/COPYING exists. It shadows the @root/COPYING?raw module URL in dev and breaks the'
    + ' entire app. It must be named public/COPYING.txt — see'
    + ' docs/swietlik/lessons/a-public-file-can-shadow-a-root-raw-module-url.md.',
  );
}

for (const note of notes) process.stdout.write(`  ${note}\n`);
if (errors.length) {
  process.stderr.write(`check-claims: ${errors.length} problem(s)\n`);
  for (const error of errors) process.stderr.write(`  ${error}\n`);
  process.exit(1);
}
process.stdout.write('check-claims: OK\n');
