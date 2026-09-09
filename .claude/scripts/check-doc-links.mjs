#!/usr/bin/env node
/**
 * Fail on a dangling relative link in any agent-facing document.
 *
 * Adapted from open-mercato's scripts/lint.sh "reference-resolution gate", which refuses to ship
 * a skill whose `references/...` pointer does not resolve.
 *
 * Why this is worth a CI job: the routing layer (CLAUDE.md, AGENTS.md, task-router.md,
 * lessons.md) is load-bearing precisely because agents follow its links instead of exploring. A
 * broken link does not produce an error — it produces an agent that silently falls back to
 * guessing, and the symptom shows up as a bad decision three files away. Cheap to check, and the
 * only half of doc rot that a machine can catch at all.
 *
 * Usage: node .claude/scripts/check-doc-links.mjs [--root <dir>]
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative as relativePath } from 'node:path';

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag > -1 ? process.argv[rootFlag + 1] : process.cwd();

/** Inline markdown links, excluding images and reference-style definitions. */
const LINK_PATTERN = /(?<!!)\[[^\]^]*?\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Blank out fenced code blocks before scanning.
 *
 * A link inside a fence is an *example* — a proposal quoting the markdown it suggests adding to
 * another file, a snippet showing the expected row format. Those links are written relative to the
 * file they would live in, not the one quoting them, so resolving them here reports failures that
 * are not failures. Replacing the block with blank lines rather than deleting it keeps line
 * positions intact for anything that later wants to report them.
 */
function stripFences(source) {
  let inFence = false;
  return source
    .split('\n')
    .map((line) => {
      if (/^\s*(?:```|~~~)/.test(line)) {
        inFence = !inFence;
        return '';
      }
      return inFence ? '' : line;
    })
    .join('\n');
}

function collectDocs(dir, accumulator) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectDocs(full, accumulator);
    else if (entry.name.endsWith('.md')) accumulator.push(full);
  }
  return accumulator;
}

const targets = [];
for (const candidate of ['CLAUDE.md', 'AGENTS.md', 'README.md']) {
  if (existsSync(join(root, candidate))) targets.push(join(root, candidate));
}
const docsDir = join(root, 'docs', 'swietlik');
if (existsSync(docsDir)) collectDocs(docsDir, targets);

const errors = [];
let checked = 0;

for (const file of targets) {
  const source = readFileSync(file, 'utf8');
  const shown = relativePath(root, file).replace(/\\/g, '/');
  for (const match of source.matchAll(LINK_PATTERN)) {
    const target = match[1];
    // External, mail, and in-page anchors are out of scope: a link checker that hits the network
    // is a flaky CI job, and an anchor check needs a heading index nobody maintains.
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    checked += 1;
    const withoutAnchor = target.split('#')[0];
    if (!withoutAnchor) continue;
    // A leading slash in these docs means repo-root-relative (CLAUDE.md uses `/CLAUDE.md`).
    const absolute = withoutAnchor.startsWith('/')
      ? join(root, withoutAnchor.slice(1))
      : resolve(dirname(file), withoutAnchor);
    if (!existsSync(absolute)) {
      errors.push(`${shown}: dangling link → ${target}`);
      continue;
    }
    // A link to a directory is almost always a mistake in this repo's docs; nothing renders an
    // index for it, so an agent following it gets a listing rather than the file meant for it.
    if (statSync(absolute).isDirectory() && !withoutAnchor.endsWith('/')) {
      errors.push(`${shown}: link resolves to a directory, not a file → ${target}`);
    }
  }
}

process.stdout.write(`check-doc-links: ${checked} relative link(s) across ${targets.length} document(s)\n`);
if (errors.length) {
  process.stderr.write(`check-doc-links: ${errors.length} problem(s)\n`);
  for (const error of errors) process.stderr.write(`  ${error}\n`);
  process.exit(1);
}
process.stdout.write('check-doc-links: OK\n');
