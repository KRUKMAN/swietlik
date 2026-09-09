#!/usr/bin/env node
/**
 * Enforce the upstream divergence ledger mechanically.
 *
 * CLAUDE.md §2 states the rule in prose: "Every upstream file you edit MUST be logged in
 * docs/swietlik/upstream-diff.md with a one-line reason. No exceptions, no batching." A prose
 * rule is exactly the kind of rule an agent agrees with and then forgets nine tool calls later.
 * Open Mercato's lesson for this class of problem is blunt: a mention does not bind. So this
 * binds it.
 *
 * The test for "is this an upstream file?" is exact, not heuristic: `develop` is a pristine
 * mirror of ASLS-org/studio, so a path that exists on `develop` is an upstream file by
 * definition, and one that does not is ours and carries no merge debt.
 *
 * Two modes (mirroring .claude/hooks/gate-evidence.mjs):
 *
 *   notify (PostToolUse on Edit|Write|MultiEdit) — non-blocking. If the file just written
 *     exists on `develop` and is not named in the ledger, say so immediately, while the agent
 *     still has the reason for the edit in context. This is where the cost of compliance is
 *     lowest: writing the ledger line now is one sentence, reconstructing it at the end of a
 *     long session is archaeology.
 *
 *   check (Stop) — blocking. Any file modified in the working tree that exists on `develop`
 *     and is not named in the ledger stops the conclusion.
 *
 * Fails OPEN on every infrastructure problem — no git, no `develop` branch, no ledger, a git
 * command that errors. A harness guard that breaks sessions when the environment is unusual is
 * worse than no guard. It only ever blocks on the one thing it can prove.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const LEDGER = 'docs/swietlik/upstream-diff.md';
const MIRROR_BRANCH = 'develop';

function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: projectDir(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
  } catch {
    return null;
  }
}

/** True when `develop` exists locally and can be asked about file contents. */
function mirrorAvailable() {
  return git(['rev-parse', '--verify', `${MIRROR_BRANCH}^{commit}`]) !== null;
}

/** Exact test: the path exists on the pristine upstream mirror. */
export function isUpstreamPath(relPath) {
  return git(['cat-file', '-e', `${MIRROR_BRANCH}:${relPath}`]) !== null;
}

function readLedger() {
  try {
    return readFileSync(join(projectDir(), LEDGER), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Is this path named in the ledger?
 *
 * Matches on the basename-bearing tail rather than the exact string, because the ledger is
 * prose written for humans: it groups by area and writes `src/models/DMX/show.model.js`,
 * `` `show.model.js` ``, or a bare `show.model.js` inside a table row. Requiring an exact
 * repo-relative match would fire constantly on correctly-logged files, and a guard that cries
 * wolf gets switched off. A basename match can in principle pass a same-named file in another
 * directory; that is the right direction to be wrong in.
 */
export function ledgerMentions(ledger, relPath) {
  if (!ledger) return true;
  const posix = relPath.replace(/\\/g, '/');
  if (ledger.includes(posix)) return true;
  const basename = posix.split('/').pop();
  if (!basename) return true;
  return new RegExp(`(^|[^\\w./-])${basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w-]|$)`, 'm').test(ledger);
}

/** Repo-relative paths modified or deleted in the working tree (staged or not). */
function workingTreeChanges() {
  const out = git(['status', '--porcelain', '-z']);
  if (out === null) return [];
  const paths = [];
  for (const record of out.split('\0')) {
    if (record.length < 4) continue;
    const status = record.slice(0, 2);
    let path = record.slice(3);
    // Untracked files cannot be upstream edits by definition.
    if (status === '??') continue;
    // Renames arrive as "old -> new"; the old path is the upstream one that moved.
    if (status.includes('R')) path = path.split(' -> ')[0];
    paths.push(path);
  }
  return paths;
}

function readStdin() {
  return new Promise((resolve) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { raw += chunk; });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', () => resolve(''));
  });
}

function reminder(paths) {
  return [
    paths.length === 1
      ? `\`${paths[0]}\` is an UPSTREAM file (it exists on \`${MIRROR_BRANCH}\`) and is not named in ${LEDGER}.`
      : `${paths.length} UPSTREAM files are edited but not named in ${LEDGER}:`,
    ...(paths.length === 1 ? [] : paths.map((p) => `  - ${p}`)),
    '',
    'CLAUDE.md §2: every upstream edit is logged in the same change that makes it — one line,',
    'with the reason. Editing upstream creates permanent merge debt against ASLS-org/studio.',
    '',
    'Either add the ledger line now, or revert the edit and do it additively instead',
    '(a new file, a wrapper, or a plugin — new files are free).',
  ].join('\n');
}

async function main() {
  const mode = process.argv[2] === 'check' ? 'check' : 'notify';
  const raw = await readStdin();

  let data = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
  }

  if (!mirrorAvailable()) return;
  const ledger = readLedger();
  if (ledger === null) return;

  if (mode === 'notify') {
    const target = data.tool_input?.file_path ?? data.tool_input?.filePath;
    if (!target) return;
    const rel = target.replace(/\\/g, '/').replace(`${projectDir().replace(/\\/g, '/')}/`, '');
    if (!rel.startsWith('src/')) return;
    if (!isUpstreamPath(rel)) return;
    if (ledgerMentions(ledger, rel)) return;
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: reminder([rel]),
      },
    }));
    return;
  }

  if (data.stop_hook_active) return;

  const unlogged = workingTreeChanges()
    .filter((rel) => rel.startsWith('src/'))
    .filter((rel) => isUpstreamPath(rel))
    .filter((rel) => !ledgerMentions(ledger, rel));
  if (!unlogged.length) return;

  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: reminder(unlogged),
  }));
}

const invokedDirectly = process.argv[1]
  && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  main().catch(() => { /* fail open */ });
}
