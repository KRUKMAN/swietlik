#!/usr/bin/env node
/**
 * Fail when a branch edits an upstream file that the divergence ledger does not name.
 *
 * CLAUDE.md §2: "Every upstream file you edit MUST be logged in docs/swietlik/upstream-diff.md
 * with a one-line reason. No exceptions, no batching 'I'll do it later'." The Stop hook
 * (.claude/hooks/upstream-diff-check.mjs) catches this during a session; this catches it on a
 * branch, including work done without the hook, by a human, or in a session that deleted its state.
 *
 * "Upstream" is decided exactly, not heuristically: `develop` is a pristine mirror of
 * ASLS-org/studio, so a path that exists there is upstream by definition.
 *
 * Usage: node .claude/scripts/check-upstream-ledger.mjs [--base <ref>] [--root <dir>]
 *        --base defaults to the merge base against the upstream mirror.
 *
 * Fails OPEN when the mirror ref is unavailable: a shallow clone with no `develop` cannot answer
 * the question, and a gate that fails closed on a missing precondition it cannot establish just
 * breaks CI for unrelated reasons. It prints loudly when it skips, so a permanently-skipping
 * check is visible rather than silently reassuring.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const LEDGER = 'docs/swietlik/upstream-diff.md';
const MIRROR_CANDIDATES = ['develop', 'origin/develop', 'refs/remotes/origin/develop'];

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag > -1 ? process.argv[rootFlag + 1] : process.cwd();
const baseFlag = process.argv.indexOf('--base');
const baseOverride = baseFlag > -1 ? process.argv[baseFlag + 1] : null;

function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function resolveMirror() {
  for (const candidate of MIRROR_CANDIDATES) {
    if (git(['rev-parse', '--verify', `${candidate}^{commit}`])) return candidate;
  }
  return null;
}

const mirror = resolveMirror();
if (!mirror) {
  process.stdout.write(
    'check-upstream-ledger: SKIPPED — no upstream mirror ref found'
    + ` (looked for ${MIRROR_CANDIDATES.join(', ')}).\n`
    + '  Fetch the pristine ASLS-org/studio mirror to enable this check.\n',
  );
  process.exit(0);
}

const base = baseOverride ?? mirror;
const range = git(['merge-base', base, 'HEAD']) ? `${base}...HEAD` : null;
if (!range) {
  process.stdout.write(`check-upstream-ledger: SKIPPED — no merge base between ${base} and HEAD.\n`);
  process.exit(0);
}

// Only modified (M), deleted (D) and renamed (R) paths carry merge debt. Added (A) files are ours.
const nameStatus = git(['diff', '--name-status', '--diff-filter=MDR', range]);
if (nameStatus === null) {
  process.stdout.write(`check-upstream-ledger: SKIPPED — could not diff ${range}.\n`);
  process.exit(0);
}

let ledger;
try {
  ledger = readFileSync(join(root, LEDGER), 'utf8');
} catch {
  process.stderr.write(`check-upstream-ledger: ${LEDGER} is missing. It is the fork's divergence ledger.\n`);
  process.exit(1);
}

/** Matches the lenient basename test the hook uses — see .claude/hooks/upstream-diff-check.mjs. */
function ledgerMentions(relPath) {
  const posix = relPath.replace(/\\/g, '/');
  if (ledger.includes(posix)) return true;
  const basename = posix.split('/').pop();
  if (!basename) return true;
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w./-])${escaped}([^\\w-]|$)`, 'm').test(ledger);
}

const changed = nameStatus
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'))
  .map(([, path]) => path)
  .filter(Boolean);

const upstream = changed.filter((path) => git(['cat-file', '-e', `${mirror}:${path}`]) !== null);
const unlogged = upstream.filter((path) => !ledgerMentions(path));

process.stdout.write(
  `check-upstream-ledger: mirror=${mirror}, range=${range}\n`
  + `  ${changed.length} modified/deleted/renamed path(s), ${upstream.length} of them upstream\n`,
);

if (unlogged.length) {
  process.stderr.write(`check-upstream-ledger: ${unlogged.length} upstream edit(s) missing from ${LEDGER}\n`);
  for (const path of unlogged) process.stderr.write(`  ${path}\n`);
  process.stderr.write(
    '\n  Add one line per file, with the reason, in the same change that makes the edit'
    + ' (CLAUDE.md §2).\n'
    + '  Or revert and do it additively — a new file, a wrapper, or a plugin carries no merge debt.\n',
  );
  process.exit(1);
}
process.stdout.write('check-upstream-ledger: OK\n');
