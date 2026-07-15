// Skill contract linter — validates every SKILL.md against docs/_meta/skill-rules.md.
//
// Run: npm run lint:skills  (node tools/skill-lint.mjs)
//
// Dependency-free ESM, same style as tools/arch-checks.mjs: hand-parse the YAML
// frontmatter (no yaml dependency), emit SKILL-NNN codes, exit non-zero on any
// violation. Not wired into hooks/CI yet — run manually.
//
//   SKILL-001 — frontmatter block missing or malformed
//   SKILL-002 — `name` missing, or does not equal dir/file basename
//   SKILL-003 — `description` missing/empty, or > ~120 words
//   SKILL-004 — metadata.owner missing
//   SKILL-005 — metadata.capability missing or not in taxonomy
//   SKILL-006 — metadata.status missing or not in {draft,active,deprecated}
//   SKILL-007 — metadata.eval.status missing or not in {none,golden-set,passing}
//   SKILL-008 — metadata.eval.ref must be non-null when eval.status != none
//   SKILL-009 — a required H2 section is missing
//   SKILL-010 — body >= 500 lines (progressive-disclosure cap)
//
// Contract: docs/_meta/skill-rules.md.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const violations = [];

const CAPABILITY_TAXONOMY = [
  'memory',
  'session-lifecycle',
  'context-intake',
  'code-intelligence',
  'migration-workflow',
  'review',
];
const STATUS_ENUM = ['draft', 'active', 'deprecated'];
const EVAL_STATUS_ENUM = ['none', 'golden-set', 'passing'];
const REQUIRED_H2 = ['Trigger', 'Inputs', 'Outputs', 'Tools & MCPs', 'Guardrails', 'Examples', 'Evaluation'];
const DESCRIPTION_WORD_CAP = 120;
const BODY_LINE_CAP = 500;

/** Collect the skill files: .claude/skills/*.md (project skills; personal skills live in ~/.claude/skills and are not linted here). */
function collectSkillFiles() {
  const files = [];

  const claudeSkillsDir = path.join(root, '.claude/skills');
  if (fs.existsSync(claudeSkillsDir)) {
    for (const entry of fs.readdirSync(claudeSkillsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== '.gitkeep') {
        files.push(path.join(claudeSkillsDir, entry.name));
      }
    }
  }

  return files;
}

/** The slug a file's `name` must equal: dir name for folder skills, basename otherwise. */
function expectedName(file) {
  if (path.basename(file) === 'SKILL.md') return path.basename(path.dirname(file));
  return path.basename(file, '.md');
}

/**
 * Hand-parse the leading `---` frontmatter block into a shallow object.
 * Supports the one level of nesting the schema uses (metadata: / eval:) via
 * indentation. Values are returned as trimmed strings; `null` maps to null.
 */
function parseFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return null;

  const fm = {};
  // Track nesting by indentation; the schema nests at most metadata: > eval:.
  const stack = [{ indent: -1, obj: fm }];
  let i = 1;
  for (; i < end; i++) {
    const raw = lines[i];
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const m = raw.trim().match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue; // continuation line of a folded scalar (e.g. description: >) — ignore
    const [, key, rest] = m;

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;

    let value = rest.replace(/\s+#.*$/, '').trim(); // strip trailing comments
    if (value === '' || value === '>' || value === '|') {
      // Nested map, or a folded/literal scalar. Peek: if next non-blank line is
      // more-indented and looks like `key:`, treat as a nested map.
      let j = i + 1;
      while (j < end && lines[j].trim() === '') j++;
      const nextIndent = j < end ? lines[j].length - lines[j].trimStart().length : indent;
      const nextIsKey = j < end && /^[A-Za-z0-9_-]+:/.test(lines[j].trim());
      if ((value === '') && nextIndent > indent && nextIsKey) {
        const child = {};
        parent[key] = child;
        stack.push({ indent, obj: child });
        continue;
      }
      // Folded/literal scalar: gather the more-indented continuation lines.
      const parts = [];
      while (j < end && (lines[j].trim() === '' || lines[j].length - lines[j].trimStart().length > indent)) {
        if (lines[j].trim() !== '') parts.push(lines[j].trim());
        j++;
      }
      parent[key] = parts.join(' ');
      i = j - 1;
      continue;
    }
    // Strip quotes.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parent[key] = value === 'null' ? null : value;
  }

  return { fm, bodyStartLine: end + 1 };
}

function add(rule, file, message) {
  violations.push({ rule, file: path.relative(root, file), message });
}

for (const file of collectSkillFiles()) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  const parsed = parseFrontmatter(text);

  if (!parsed) {
    add('SKILL-001', file, 'Missing or malformed `---` frontmatter block.');
    continue;
  }
  const { fm } = parsed;

  // SKILL-002 — name
  const expected = expectedName(file);
  if (!fm.name) {
    add('SKILL-002', file, '`name` is missing.');
  } else if (fm.name !== expected) {
    add('SKILL-002', file, `\`name\` is "${fm.name}" but must equal the dir/file basename "${expected}".`);
  }

  // SKILL-003 — description
  if (!fm.description || fm.description.trim() === '') {
    add('SKILL-003', file, '`description` is missing or empty.');
  } else {
    const words = fm.description.trim().split(/\s+/).length;
    if (words > DESCRIPTION_WORD_CAP) {
      add('SKILL-003', file, `\`description\` is ${words} words (> ${DESCRIPTION_WORD_CAP}).`);
    }
  }

  const meta = fm.metadata && typeof fm.metadata === 'object' ? fm.metadata : {};

  // SKILL-004 — owner
  if (!meta.owner) add('SKILL-004', file, 'metadata.owner is missing.');

  // SKILL-005 — capability
  if (!meta.capability) {
    add('SKILL-005', file, 'metadata.capability is missing.');
  } else if (!CAPABILITY_TAXONOMY.includes(meta.capability)) {
    add('SKILL-005', file, `metadata.capability "${meta.capability}" not in taxonomy [${CAPABILITY_TAXONOMY.join(', ')}].`);
  }

  // SKILL-006 — status
  if (!meta.status) {
    add('SKILL-006', file, 'metadata.status is missing.');
  } else if (!STATUS_ENUM.includes(meta.status)) {
    add('SKILL-006', file, `metadata.status "${meta.status}" not in [${STATUS_ENUM.join(', ')}].`);
  }

  // SKILL-007 / SKILL-008 — eval
  const ev = meta.eval && typeof meta.eval === 'object' ? meta.eval : {};
  if (!ev.status) {
    add('SKILL-007', file, 'metadata.eval.status is missing.');
  } else if (!EVAL_STATUS_ENUM.includes(ev.status)) {
    add('SKILL-007', file, `metadata.eval.status "${ev.status}" not in [${EVAL_STATUS_ENUM.join(', ')}].`);
  } else if (ev.status !== 'none' && (ev.ref === null || ev.ref === undefined || ev.ref === '')) {
    add('SKILL-008', file, `metadata.eval.ref must be non-null when eval.status is "${ev.status}".`);
  }

  // SKILL-009 — required H2 sections
  const h2 = new Set();
  for (const line of text.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) h2.add(m[1].trim());
  }
  for (const required of REQUIRED_H2) {
    if (!h2.has(required)) add('SKILL-009', file, `Required section "## ${required}" is missing.`);
  }

  // SKILL-010 — body length
  const bodyLines = text.split('\n').length - parsed.bodyStartLine;
  if (bodyLines >= BODY_LINE_CAP) {
    add('SKILL-010', file, `Body is ${bodyLines} lines (>= ${BODY_LINE_CAP}); move overflow to references/.`);
  }
}

// ---- Report ---------------------------------------------------------------
const skillCount = collectSkillFiles().length;
if (violations.length === 0) {
  console.log(`skill-lint — OK: ${skillCount} skill(s) conform to docs/_meta/skill-rules.md.`);
  process.exit(0);
}
console.log(`skill-lint — ${violations.length} violation(s) across ${skillCount} skill(s):\n`);
for (const v of violations) {
  console.log(`  [${v.rule}] ${v.file}`);
  console.log(`             ${v.message}`);
}
process.exit(1);
