#!/usr/bin/env node
/**
 * Self-tests for the harness hooks.
 *
 * Open Mercato keeps input/expected-output fixtures for every one of their `bin/gap-*` gate
 * scripts, and their changelog records why: a "v1.19.0 fail-open bug" shipped in which a gate
 * silently stopped enforcing its own precondition. An unverified guardrail is worse than no
 * guardrail, because it is trusted.
 *
 * The cases below are the load-bearing logic — the bits where a wrong answer produces either a
 * false green (a gate that records a pass it never observed) or a false block (a guard that
 * traps sessions and gets switched off).
 *
 * Usage: node .claude/scripts/test-hooks.mjs
 */
import { matchGates, isAttributableGateCommand, resolveExitCode, nextSessionState, requiredGates, unsatisfiedGates }
  from '../hooks/gate-evidence.mjs';
import { ledgerMentions } from '../hooks/upstream-diff-check.mjs';

let failures = 0;
let passes = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passes += 1;
    return;
  }
  failures += 1;
  process.stderr.write(`  FAIL ${label}\n       expected ${e}\n       actual   ${a}\n`);
}

// --- matchGates ------------------------------------------------------------
// A gate named inside a quoted string did not run. Treating it as a run is the exact false green
// the hook exists to prevent.
check('quoted gate name is not a run', matchGates('git commit -m "run npm run test:run"'), []);
check('lint:ci counts as the lint gate', matchGates('npm run lint:ci'), ['lint']);
check('bare npm run lint is a mutation, not a gate', matchGates('npm run lint'), []);
check('direct vitest run counts', matchGates('npx vitest run test/models'), ['test']);
check('chained gates are both recorded', matchGates('npm run lint:ci && npm run test:run'), ['lint', 'test']);
check('build gate', matchGates('npm run build'), ['build']);
check('unrelated command matches nothing', matchGates('git status --short'), []);

// --- isAttributableGateCommand --------------------------------------------
// A pipeline reports its LAST stage's status, so piping a gate through tail reports tail.
check('piped gate is unattributable', isAttributableGateCommand('npm run test:run | tail -30'), false);
check('semicolon-chained is unattributable', isAttributableGateCommand('npm run lint:ci; echo done'), false);
check('&&-chained is attributable', isAttributableGateCommand('npm run lint:ci && npm run test:run'), true);
check('plain command is attributable', isAttributableGateCommand('npm run test:run'), true);

// --- resolveExitCode -------------------------------------------------------
// null is not zero. An unrecognised payload means nothing was observed, and storing that as a
// pass would manufacture the false green.
check('missing exit code is null, not zero', resolveExitCode({ tool_response: {} }), null);
check('camelCase exit code is read', resolveExitCode({ tool_response: { exitCode: 1 } }), 1);
check('snake_case exit code is read', resolveExitCode({ tool_response: { exit_code: 0 } }), 0);
check('absent tool_response is null', resolveExitCode({}), null);

// --- nextSessionState ------------------------------------------------------
// Gates observed in an earlier session prove nothing about this one.
check(
  'a new session id resets observed gates',
  nextSessionState({ sessionId: 'old', sessionStartedAt: 'T0', gates: { lint: { exitCode: 0, finishedAt: 'T0' } } }, 'new', 'T1'),
  { sessionId: 'new', sessionStartedAt: 'T1' },
);
check(
  'the same session id keeps its state',
  nextSessionState({ sessionId: 'same', sessionStartedAt: 'T0', gates: {} }, 'same', 'T1').sessionStartedAt,
  'T0',
);
check(
  'a payload with no session id degrades to set-once',
  nextSessionState({ sessionStartedAt: 'T0' }, null, 'T1').sessionStartedAt,
  'T0',
);

// --- requiredGates ---------------------------------------------------------
// Demanding a green test run for a pure-SFC edit would be theatre: no test covers .vue files.
check('no changes requires no gate', requiredGates([]), []);
check('a view change requires lint only', requiredGates(['views/activities/app/app.activity.vue']), ['lint']);
check('a model change also requires test', requiredGates(['models/DMX/show.model.js']), ['lint', 'test']);
check('a singleton change also requires test', requiredGates(['singletons/show.singleton.js']), ['lint', 'test']);
check('mixed changes require both', requiredGates(['views/x.vue', 'models/y.js']), ['lint', 'test']);
check('a prefix-lookalike path does not trigger the domain gate', requiredGates(['modelsomething/x.js']), ['lint']);

// --- unsatisfiedGates ------------------------------------------------------
// A read-only or docs-only session must not block on its first stop.
check(
  'no source change this session blocks nothing',
  unsatisfiedGates({ changedSincePerGate: {}, sessionStartedAtMs: 1000, newestChangedMs: 500, changedRelPaths: [] }),
  [],
);
check(
  'an absent src tree blocks nothing',
  unsatisfiedGates({ changedSincePerGate: {}, sessionStartedAtMs: 1000, newestChangedMs: null, changedRelPaths: [] }),
  [],
);
check(
  'a model change with no gate run blocks on both',
  unsatisfiedGates({
    changedSincePerGate: { lint: null, test: null },
    sessionStartedAtMs: 1000,
    newestChangedMs: 2000,
    changedRelPaths: ['models/DMX/show.model.js'],
  }),
  ['lint', 'test'],
);
check(
  'a gate green AFTER the change satisfies it',
  unsatisfiedGates({
    changedSincePerGate: { lint: 3000, test: 3000 },
    sessionStartedAtMs: 1000,
    newestChangedMs: 2000,
    changedRelPaths: ['models/DMX/show.model.js'],
  }),
  [],
);
check(
  'a gate green BEFORE the change does not satisfy it',
  unsatisfiedGates({
    changedSincePerGate: { lint: 1500, test: 1500 },
    sessionStartedAtMs: 1000,
    newestChangedMs: 2000,
    changedRelPaths: ['models/DMX/show.model.js'],
  }),
  ['lint', 'test'],
);
check(
  'a view change with green lint is satisfied even with no test run',
  unsatisfiedGates({
    changedSincePerGate: { lint: 3000, test: null },
    sessionStartedAtMs: 1000,
    newestChangedMs: 2000,
    changedRelPaths: ['views/app.activity.vue'],
  }),
  [],
);

// --- ledgerMentions --------------------------------------------------------
// A guard that cries wolf on correctly-logged files gets switched off, so the match is
// deliberately lenient: the ledger is prose written for humans.
const ledger = [
  '### Root / config',
  '- `package.json` — renamed the package.',
  '',
  '### Models',
  '- src/models/DMX/show.model.js — added the Świetlik default project name.',
  '| `toolbar.fragment.vue` | attribution strip |',
].join('\n');
check('an exact path is found', ledgerMentions(ledger, 'src/models/DMX/show.model.js'), true);
check('a backticked basename is found', ledgerMentions(ledger, 'src/views/x/toolbar.fragment.vue'), true);
check('a basename in a bullet is found', ledgerMentions(ledger, 'package.json'), true);
check('an unlisted file is not found', ledgerMentions(ledger, 'src/models/DMX/group.model.js'), false);
check('a substring of a listed name does not count', ledgerMentions(ledger, 'src/x/show.model.js.bak'), false);
// An unreadable ledger must fail OPEN — a missing file is an infrastructure problem, not evidence
// of an unlogged edit, and blocking on it would break sessions for the wrong reason.
check('a null ledger fails open', ledgerMentions(null, 'anything.js'), true);

process.stdout.write(`test-hooks: ${passes} passed, ${failures} failed\n`);
if (failures) process.exit(1);
