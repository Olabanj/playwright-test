// Filesystem-level architecture checks — the rules that are NOT per-file lint.
//
// Run: npm run arch:check  (also chained into npm run lint:arch)
//
// ESLint reasons about the contents of a file; these rules reason about the
// SHAPE of the tree (which files/dirs may exist, which docs must accompany a
// feature). Kept deterministic and dependency-free.
//
//   NOFLOW-007 — no Flow/Facade layer (no flows|facades dirs, no *Flow|*Facade files)
//   DOC-011    — every feature that has tests/ must have a scenario doc
//
// Catalog + rationale: eslint/architecture-rules.json.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const violations = [];

/** Recursively list files under a dir (relative paths from root), skipping noise. */
function walk(dir, acc = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return acc;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'test-results', 'playwright-report', '.playwright-mcp'].includes(entry.name))
        continue;
      walk(rel, acc);
    } else {
      acc.push(rel);
    }
  }
  return acc;
}

// ---- NOFLOW-007 -----------------------------------------------------------
const featureFiles = walk('features');
const FLOW_DIR = /(^|\/)(flows?|facades?)\//i;
const FLOW_FILE = /(Flow|Facade)\.ts$/;
for (const f of featureFiles) {
  if (FLOW_DIR.test(f) || FLOW_FILE.test(f)) {
    violations.push({
      rule: 'NOFLOW-007',
      file: f,
      message: 'Flow/Facade layer is removed (ADR 2026-06-17). Put composition in seeding.ts + factory fixtures.',
    });
  }
}

// ---- DOC-011 --------------------------------------------------------------
const featuresDir = path.join(root, 'features');
const features = fs.existsSync(featuresDir)
  ? fs.readdirSync(featuresDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];
for (const feature of features) {
  const hasTests = fs.existsSync(path.join(featuresDir, feature, 'tests'));
  if (!hasTests) continue;
  const scenarioDoc = path.join(root, 'docs/test-migration/scenarios', `${feature}.md`);
  if (!fs.existsSync(scenarioDoc)) {
    violations.push({
      rule: 'DOC-011',
      file: `features/${feature}/tests/`,
      message: `Missing scenario doc: docs/test-migration/scenarios/${feature}.md (review-checklist #11).`,
    });
  }
}

// ---- Report ---------------------------------------------------------------
if (violations.length === 0) {
  console.log(`arch:check — OK (NOFLOW-007, DOC-011): no violations.`);
  process.exit(0);
}
console.log(`arch:check — ${violations.length} violation(s):\n`);
for (const v of violations) {
  console.log(`  [${v.rule}] ${v.file}`);
  console.log(`           ${v.message}`);
}
process.exit(1);
