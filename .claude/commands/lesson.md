---
description: Capture a correction from this session as one lesson record plus one index row.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Capture reusable knowledge from this session into `docs/swietlik/lessons/`.

$ARGUMENTS

## First, check the trigger

The trigger is narrow: **a correction in this session produced knowledge an agent with no memory
of it would need.** Not "something was learned" — something was learned *that would otherwise be
re-learned the same expensive way*.

Do not write a lesson when:

- It is a hard boundary. Those go in `CLAUDE.md` or `docs/swietlik/contract-surfaces.md`, where
  they are read every session rather than only when someone happens to route to that area.
- It is specific to one file's current state and will be false after the next refactor.
- It is a note about what this session did. That is a commit message.
- A record already covers it — in that case **update** that record instead of adding a second.

If the trigger is not met, say so and stop. An index padded with near-misses is how the catalogue
stops being worth loading.

## Procedure

1. Read `docs/swietlik/lessons.md` → *Adding a lesson*, and
   `rg -l '<topic>' docs/swietlik/lessons/` to check for an existing record to update.
2. Write `docs/swietlik/lessons/<kebab-case-slug>.md`. The slug should read as the lesson, not as a
   category — `a-public-file-can-shadow-a-root-raw-module-url`, not `public-folder-notes`.
3. Front matter: exactly `title`, `areas`, `topics`, JSON-valued. `title` matches the H1 verbatim.
   Areas come from the taxonomy in `lessons.md`; 2–6 kebab-case topics.
4. Body, these four sections in order:
   - **Context** — the concrete evidence. Name the file, the symptom, what was observed. A lesson
     with no evidence is an opinion.
   - **Problem** — why the naive move is wrong, and why it *looks* right. The second half is what
     makes the record work: the next agent will have the same instinct.
   - **Rule** — the durable, actionable instruction. Generalise one step beyond the incident, but
     only one.
   - **Applies to** — the surface this governs, so a reader can tell whether it is relevant.
5. Add exactly one row to the catalogue in `docs/swietlik/lessons.md`, under the matching area
   heading, in the exact format:
   `- [Title](lessons/slug.md) — area:a,b; topic:x,y` — areas and topics in the same order as the
   front matter.
6. Run `node .claude/scripts/check-lessons.mjs`. It verifies the title matches, the row matches the
   front matter, the four sections exist, and the index stays inside its loading budget. Fix
   anything it reports.

## Quality bar

Write it for an agent that has none of this session's context and is about to make the same
mistake. If the **Rule** section could be followed by someone who read only that paragraph, the
record is good. If it needs the Context section to be actionable, the rule is not yet a rule.
