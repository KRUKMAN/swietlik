#!/usr/bin/env node
/**
 * Validate the lessons catalogue: records well-formed, index in sync, index cheap to load.
 *
 * Adapted from open-mercato's packages/create-app/agentic/shared/scripts/check-lessons.mjs.
 * A knowledge base with no validator rots within a month: titles drift out of sync with the
 * rows that cite them, records land without index entries and are never found again, and the
 * index grows prose until it is too expensive to load — at which point the progressive-loading
 * design it exists to serve has quietly stopped working.
 *
 * Usage: node .claude/scripts/check-lessons.mjs [--root <dir>]
 * Exit 0 clean, 1 with a list of errors.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const AREAS = new Set([
  'architecture',
  'domain-model',
  'visualizer',
  'ui',
  'testing',
  'verification',
  'build-tooling',
  'dependencies',
  'upstream',
  'agent-workflow',
  'licence',
]);

/**
 * The index budget scales with the record count rather than being a flat cap: a fixed limit
 * punishes a catalogue for legitimately growing, and trimming real rows to fit would defeat the
 * routing the index exists to provide. A per-row allowance still catches prose creep inside rows.
 */
const INDEX_BASE_BUDGET_BYTES = 8 * 1024;
const INDEX_PER_RECORD_BUDGET_BYTES = 320;

const RECORD_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INDEX_ROW_PATTERN = /^- \[(.+)]\(lessons\/([a-z0-9-]+\.md)\) — area:([^;]+); topic:(.+)$/;

function parseFrontMatter(source, relativePath, errors) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n\n# (.+)\n/);
  if (!match) {
    errors.push(`${relativePath}: expected JSON-valued front matter followed by a blank line and one H1`);
    return null;
  }

  const metadata = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator < 1) {
      errors.push(`${relativePath}: malformed front matter line ${JSON.stringify(line)}`);
      continue;
    }
    const key = line.slice(0, separator);
    try {
      metadata[key] = JSON.parse(line.slice(separator + 1).trim());
    } catch {
      errors.push(`${relativePath}: ${key} must use valid JSON syntax (quote strings, bracket arrays)`);
    }
  }

  const expected = ['areas', 'title', 'topics'];
  if (JSON.stringify(Object.keys(metadata).sort()) !== JSON.stringify(expected)) {
    errors.push(`${relativePath}: front matter keys must be exactly title, areas, topics`);
  }
  if (typeof metadata.title !== 'string' || !metadata.title.length) {
    errors.push(`${relativePath}: title must be a non-empty string`);
  } else if (metadata.title !== match[2]) {
    errors.push(`${relativePath}: front matter title must match the H1 exactly`);
  }
  if (!Array.isArray(metadata.areas) || !metadata.areas.length) {
    errors.push(`${relativePath}: areas must list at least one area`);
  } else if (metadata.areas.some((v) => !AREAS.has(v))) {
    errors.push(`${relativePath}: areas contain a value outside the taxonomy (${[...AREAS].join(', ')})`);
  }
  if (!Array.isArray(metadata.topics) || metadata.topics.length < 2 || metadata.topics.length > 6) {
    errors.push(`${relativePath}: topics must contain between two and six concepts`);
  } else if (metadata.topics.some((v) => typeof v !== 'string' || !TAG_PATTERN.test(v))) {
    errors.push(`${relativePath}: topics must use lowercase kebab-case`);
  }
  for (const key of ['areas', 'topics']) {
    if (Array.isArray(metadata[key]) && new Set(metadata[key]).size !== metadata[key].length) {
      errors.push(`${relativePath}: ${key} must not contain duplicates`);
    }
  }

  /**
   * The four body sections are the whole value of the format. A record missing "Rule" is a
   * war story, not a lesson; one missing "Context" is an assertion with no evidence behind it.
   */
  for (const section of ['Context', 'Problem', 'Rule', 'Applies to']) {
    if (!source.includes(`**${section}**:`)) {
      errors.push(`${relativePath}: missing the **${section}**: section`);
    }
  }

  return metadata;
}

export function checkLessons(rootDir) {
  const errors = [];
  const indexPath = join(rootDir, 'docs', 'swietlik', 'lessons.md');
  const lessonsDir = join(rootDir, 'docs', 'swietlik', 'lessons');
  if (!existsSync(indexPath)) return [`${indexPath}: lesson index is missing`];

  const indexSource = readFileSync(indexPath, 'utf8');
  if (/\*\*(?:Context|Problem|Rule|Applies to)\*\*:/.test(indexSource)) {
    errors.push('docs/swietlik/lessons.md: full lesson prose belongs in lessons/, not the index');
  }

  const recordNames = existsSync(lessonsDir)
    ? readdirSync(lessonsDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('_'))
      .map((e) => e.name)
      .sort()
    : [];

  const budget = INDEX_BASE_BUDGET_BYTES + recordNames.length * INDEX_PER_RECORD_BUDGET_BYTES;
  const indexBytes = Buffer.byteLength(indexSource);
  if (indexBytes > budget) {
    errors.push(
      `docs/swietlik/lessons.md: ${indexBytes} bytes exceeds the ${budget}-byte progressive-loading`
      + ` budget (${INDEX_BASE_BUDGET_BYTES} base + ${recordNames.length} × ${INDEX_PER_RECORD_BUDGET_BYTES})`,
    );
  }

  const records = new Map();
  const titles = new Set();
  for (const fileName of recordNames) {
    const relativePath = `docs/swietlik/lessons/${fileName}`;
    if (!RECORD_NAME_PATTERN.test(fileName)) errors.push(`${relativePath}: filename must be kebab-case`);
    const metadata = parseFrontMatter(readFileSync(join(lessonsDir, fileName), 'utf8'), relativePath, errors);
    if (!metadata) continue;
    if (titles.has(metadata.title)) errors.push(`${relativePath}: duplicate lesson title`);
    titles.add(metadata.title);
    records.set(fileName, metadata);
  }

  const indexed = new Set();
  for (const line of indexSource.split('\n')) {
    if (!line.startsWith('- [')) continue;
    const match = line.match(INDEX_ROW_PATTERN);
    if (!match) {
      errors.push(`docs/swietlik/lessons.md: malformed catalogue row ${JSON.stringify(line.slice(0, 80))}`);
      continue;
    }
    const [, title, fileName, areaText, topicText] = match;
    if (indexed.has(fileName)) errors.push(`docs/swietlik/lessons.md: duplicate link to lessons/${fileName}`);
    indexed.add(fileName);
    const record = records.get(fileName);
    if (!record) {
      errors.push(`docs/swietlik/lessons.md: row links lessons/${fileName}, which does not exist`);
      continue;
    }
    if (record.title !== title) {
      errors.push(`docs/swietlik/lessons.md: row title for ${fileName} does not match the record's title`);
    }
    const rowAreas = areaText.trim().split(',').map((s) => s.trim());
    const rowTopics = topicText.trim().split(',').map((s) => s.trim());
    if (JSON.stringify(rowAreas) !== JSON.stringify(record.areas)) {
      errors.push(`docs/swietlik/lessons.md: row areas for ${fileName} do not match its front matter`);
    }
    if (JSON.stringify(rowTopics) !== JSON.stringify(record.topics)) {
      errors.push(`docs/swietlik/lessons.md: row topics for ${fileName} do not match its front matter`);
    }
  }

  for (const fileName of records.keys()) {
    if (!indexed.has(fileName)) {
      errors.push(`docs/swietlik/lessons.md: lessons/${fileName} has no catalogue row — it will never be found`);
    }
  }

  return errors;
}

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag > -1 ? process.argv[rootFlag + 1] : process.cwd();
const errors = checkLessons(root);
if (errors.length) {
  process.stderr.write(`check-lessons: ${errors.length} problem(s)\n`);
  for (const error of errors) process.stderr.write(`  ${error}\n`);
  process.exit(1);
}
process.stdout.write('check-lessons: OK\n');
