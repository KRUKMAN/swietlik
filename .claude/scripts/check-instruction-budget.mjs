#!/usr/bin/env node
/**
 * Keep the root agent-instruction files inside the budget an agent will actually read.
 *
 * Adapted from open-mercato's scripts/check-agents-md-budget.mjs (they run it as a blocking CI
 * job — a literal agent-context-window gate).
 *
 * Why: a coding agent loads project instruction files at session start and stops once the
 * combined size reaches its budget. Codex's default `project_doc_max_bytes` is 32,768 **bytes**
 * — and everything past that offset is silently dropped, with no warning to the agent or the
 * author. A rule written in the tail of an over-budget file is not a weak rule; it is an absent
 * one. The failure is invisible, which is exactly why it needs a mechanical check.
 *
 * Budget and file list come from .claude/harness.json → instructionBudget.
 *
 * Usage: node .claude/scripts/check-instruction-budget.mjs [--root <dir>]
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag > -1 ? process.argv[rootFlag + 1] : process.cwd();

let config;
try {
  config = JSON.parse(readFileSync(join(root, '.claude', 'harness.json'), 'utf8'));
} catch (error) {
  process.stderr.write(`check-instruction-budget: cannot read .claude/harness.json — ${error.message}\n`);
  process.exit(1);
}

const { budgetBytes, reserveBytes, files } = config.instructionBudget ?? {};
if (!budgetBytes || !Array.isArray(files)) {
  process.stderr.write('check-instruction-budget: harness.json is missing instructionBudget.budgetBytes/files\n');
  process.exit(1);
}

const limit = budgetBytes - (reserveBytes ?? 0);
const errors = [];
let total = 0;
const report = [];

for (const relative of files) {
  const absolute = join(root, relative);
  if (!existsSync(absolute)) {
    errors.push(`${relative}: listed in instructionBudget.files but does not exist`);
    continue;
  }
  const bytes = statSync(absolute).size;
  total += bytes;
  report.push(`  ${relative.padEnd(12)} ${String(bytes).padStart(7)} bytes`);
}

report.push(`  ${'TOTAL'.padEnd(12)} ${String(total).padStart(7)} bytes  (limit ${limit}, budget ${budgetBytes} − reserve ${reserveBytes ?? 0})`);

if (total > limit) {
  errors.push(
    `root instruction files total ${total} bytes, over the ${limit}-byte limit by ${total - limit}.`
    + ' Move long-form procedure into docs/swietlik/* and leave hard rules and routing in place'
    + ' — see docs/swietlik/agent-instructions.md.',
  );
}

process.stdout.write(`${report.join('\n')}\n`);
if (errors.length) {
  process.stderr.write(`check-instruction-budget: ${errors.length} problem(s)\n`);
  for (const error of errors) process.stderr.write(`  ${error}\n`);
  process.exit(1);
}
process.stdout.write('check-instruction-budget: OK\n');
