#!/usr/bin/env node
/**
 * Record validation-gate outcomes, and refuse to conclude on unverified source changes.
 *
 * Ported from open-mercato's `packages/create-app/agentic/claude-code/hooks/gate-evidence.ts`
 * and retuned for Świetlik (plain-JS Vue 3, no typecheck step).
 *
 * Why this exists: a gate that is claimed but never run is indistinguishable, in a transcript,
 * from one that passed. "I ran the tests and they pass" is free to say and expensive to check.
 * This makes the difference mechanical. A mention does not bind; an exit code does.
 *
 * Two modes:
 *
 *   record (PostToolUse on Bash) — when a Bash command was a validation gate AND its exit
 *     status genuinely belongs to that gate, append the status to .claude/.gate-state.json.
 *
 *   check (Stop) — block when a file under src/ changed after the session started and is
 *     newer than the last exit-0 run of the gate that covers it:
 *       - any src/ change            -> needs a green `npm run lint:ci`
 *       - src/models|singletons|plugins -> ALSO needs a green `npm run test:run`
 *     (that split is honest about coverage: the domain layer has 156 tests, the .vue views
 *     have none, so demanding a green test run for a pure-SFC edit would be theatre.)
 *
 * Deliberate limits. It compares mtimes rather than hashing, so a touch-without-edit costs one
 * gate run. It blocks at most once per stop sequence, so a gate that genuinely cannot pass is
 * reported to the user rather than trapping the agent. `npm run build` is never demanded — too
 * slow to be a per-stop tax. And the state file can simply be deleted: this is a speed bump
 * against carelessness, not a defence against deliberate circumvention.
 *
 * Escape hatches, in order of preference:
 *   1. Run the gate. It takes seconds.
 *   2. If the gate genuinely fails and you cannot fix it, SAY SO to the user. A reported red
 *      gate is a good outcome; a silent one is not.
 *   3. `rm .claude/.gate-state.json` or drop the hook from .claude/settings.json.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STATE_RELATIVE_PATH = '.claude/.gate-state.json';
const WATCHED_ROOT = 'src';
const DOMAIN_PREFIXES = ['models', 'singletons', 'plugins'];

const GATE_PATTERNS = [
  ['lint', /\b(?:npm run|yarn|pnpm)\s+lint:ci\b|\beslint\b/],
  ['test', /\b(?:npm run|yarn|pnpm)\s+test:run\b|\bvitest\s+run\b/],
  ['build', /\b(?:npm run|yarn|pnpm)\s+build\b|\bvite\s+build\b/],
];

/**
 * Extracts every gate a Bash command ran.
 *
 * Returns a list because a documented gate line chains several with `&&`, and a run reported
 * through a compound command must not be invisible to the recorder. Quoted spans are stripped
 * first, so a gate merely *named* in a message — `git commit -m "run npm run test:run"` — is
 * not mistaken for a gate that ran.
 *
 * `npm run lint` (no `:ci`) deliberately does NOT count as a lint gate: it runs eslint --fix,
 * which mutates source. But it does match /\beslint\b/... so it is excluded explicitly below.
 */
export function matchGates(command) {
  const executable = command.replace(/'[^']*'|"[^"]*"/g, ' ');
  if (/\b(?:npm run|yarn|pnpm)\s+lint(?!:ci)\b/.test(executable) && !/lint:ci/.test(executable)) {
    // `npm run lint` is the --fix variant. It is a mutation, not evidence.
    return [];
  }
  const found = new Set();
  for (const [gate, pattern] of GATE_PATTERNS) {
    if (pattern.test(executable)) found.add(gate);
  }
  return [...found];
}

/**
 * Decides whether a command's exit status can be attributed to the gates it names.
 *
 * A pipeline reports the exit status of its LAST stage, so `npm run test:run | tail -30`
 * reports tail's success no matter what vitest did. `;` and `||` break the link the same way.
 * `&&` does not: it short-circuits, so a non-zero status still belongs to a gate that ran.
 *
 * Recording an unattributable status would manufacture exactly the false green this hook
 * exists to prevent, so those commands are not recorded at all.
 */
export function isAttributableGateCommand(command) {
  return !/[|;\n]/.test(command);
}

/** `null` is not zero. An unrecognised payload shape means nothing was observed. */
export function resolveExitCode(data) {
  const response = data.tool_response ?? {};
  const value = response.exit_code ?? response.exitCode;
  return typeof value === 'number' ? value : null;
}

/**
 * Rolls state forward into the session the current invocation belongs to. A new session_id
 * starts from a clean record: gates observed in an earlier session prove nothing about this one.
 */
export function nextSessionState(previous, sessionId, startedAt) {
  if (!sessionId) {
    return previous.sessionStartedAt ? previous : { ...previous, sessionStartedAt: startedAt };
  }
  if (previous.sessionId === sessionId && previous.sessionStartedAt) return previous;
  return { sessionId, sessionStartedAt: startedAt };
}

/** Which gates must be green, given which files changed. */
export function requiredGates(changed) {
  if (!changed.length) return [];
  const gates = ['lint'];
  const touchesDomain = changed.some((rel) =>
    DOMAIN_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`)));
  if (touchesDomain) gates.push('test');
  return gates;
}

/**
 * Decides which required gates are unsatisfied.
 *
 * An absent record does NOT block on its own unless source actually changed this session —
 * otherwise the first stop of every read-only or docs-only session would block.
 */
export function unsatisfiedGates(input) {
  const { changedSincePerGate, sessionStartedAtMs, newestChangedMs, changedRelPaths } = input;
  if (newestChangedMs === null || newestChangedMs < sessionStartedAtMs) return [];
  return requiredGates(changedRelPaths).filter((gate) => {
    const greenAt = changedSincePerGate[gate];
    if (greenAt === null || greenAt === undefined) return true;
    return newestChangedMs > greenAt;
  });
}

function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function readState() {
  try {
    return JSON.parse(readFileSync(join(projectDir(), STATE_RELATIVE_PATH), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    mkdirSync(join(projectDir(), '.claude'), { recursive: true });
    writeFileSync(join(projectDir(), STATE_RELATIVE_PATH), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  } catch {
    // A hook must never fail the turn over its own bookkeeping.
  }
}

/** Newest mtime under src/, plus the repo-relative paths (relative to src/) of recent files. */
function scanSource(root, sinceMs) {
  let newest = null;
  const recent = [];
  const walk = (current, relative) => {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(current, entry);
      const rel = relative ? `${relative}/${entry}` : entry;
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
      if (stats.isDirectory()) walk(full, rel);
      else {
        if (newest === null || stats.mtimeMs > newest) newest = stats.mtimeMs;
        if (stats.mtimeMs >= sinceMs) recent.push(rel);
      }
    }
  };
  walk(root, '');
  return { newest, recent };
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

const GATE_COMMAND = { lint: 'npm run lint:ci', test: 'npm run test:run', build: 'npm run build' };

async function main() {
  const mode = process.argv[2] === 'check' ? 'check' : 'record';
  const raw = await readStdin();

  let data = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
  }

  const previous = readState();
  const now = new Date();
  const state = nextSessionState(previous, data.session_id ?? null, now.toISOString());
  if (state !== previous) writeState(state);

  if (mode === 'record') {
    const command = data.tool_input?.command;
    if (!command) return;
    const gates = matchGates(command);
    if (!gates.length) return;
    if (!isAttributableGateCommand(command)) return;
    const exitCode = resolveExitCode(data);
    if (exitCode === null) return;
    state.gates = state.gates ?? {};
    for (const gate of gates) {
      state.gates[gate] = { exitCode, finishedAt: now.toISOString() };
    }
    writeState(state);
    return;
  }

  if (data.stop_hook_active) return;

  const sessionStartedAtMs = Date.parse(state.sessionStartedAt ?? now.toISOString());
  const { newest, recent } = scanSource(join(projectDir(), WATCHED_ROOT), sessionStartedAtMs);

  const greenAt = {};
  for (const gate of ['lint', 'test']) {
    const record = state.gates?.[gate];
    greenAt[gate] = record && record.exitCode === 0 ? Date.parse(record.finishedAt) : null;
  }

  const missing = unsatisfiedGates({
    changedSincePerGate: greenAt,
    sessionStartedAtMs,
    newestChangedMs: newest,
    changedRelPaths: recent,
  });
  if (!missing.length) return;

  const commands = missing.map((gate) => GATE_COMMAND[gate]);
  const sample = recent.slice(0, 6).map((rel) => `  ${WATCHED_ROOT}/${rel}`);
  const lines = [
    `Source under ${WATCHED_ROOT}/ changed this session and has not passed ${missing.join(' + ')} since.`,
    '',
    'Changed this session (first few):',
    ...sample,
  ];
  if (recent.length > sample.length) lines.push(`  ...and ${recent.length - sample.length} more`);
  lines.push(
    '',
    `Run ${commands.map((c) => `\`${c}\``).join(' and ')} and report the exit status before concluding.`,
    '',
    'If a gate genuinely fails and you cannot fix it, report the failure to the user.',
    'Do not delete .claude/.gate-state.json to work around this.',
    'If the change is visual (a .vue view or the visualizer), tests and lint are still',
    'necessary but NOT sufficient — work docs/swietlik/verification.md as well.',
  );
  process.stdout.write(JSON.stringify({ decision: 'block', reason: lines.join('\n') }));
}

/** Run only when invoked as the hook, never on import — main() blocks reading stdin. */
const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  main().catch(() => { /* fail open: never break a turn over the hook itself */ });
}
