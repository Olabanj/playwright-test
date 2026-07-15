// Golden regression set for the architecture gate.
//
// Run: npm run lint:arch:test
//
// Each BAD snippet must trigger a specific rule; each GOOD snippet must be clean.
// We lint code strings with virtual file paths under the real features/ tree:
// boundaries classifies the linted file by its path and resolves the imported
// modules against the real tsconfig — so no fixture files need to exist on disk.
//
// This is the frozen baseline from the build plan: every future architecture
// violation we find in the wild gets added here as a new case before we fix it.

import { ESLint } from 'eslint';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const eslint = new ESLint({ overrideConfigFile: path.join(root, 'eslint.arch.config.mjs') });

async function lint(code, relPath) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(root, relPath),
    warnIgnored: false,
  });
  return result.messages;
}

const cases = [
  {
    name: 'BAD: Page imports an API client (LAYER-010)',
    rel: 'features/expenses/pages/frontoffice/__golden.ts',
    code: `import { ExpensesClient } from '@features/expenses/client';\nexport class P { c = new ExpensesClient(); }\n`,
    expect: 'boundaries/dependencies',
  },
  {
    name: 'BAD: expect() inside a Page Object (ASSERT-003)',
    rel: 'features/expenses/pages/frontoffice/__golden.ts',
    code: `export function check() { expect(1).toBe(1); }\n`,
    expect: 'no-restricted-syntax',
  },
  {
    name: 'BAD: process.env outside core/config/env.ts (ENV-001)',
    rel: 'features/expenses/seeding.ts',
    code: `export const key = process.env.SECRET_KEY;\n`,
    expect: 'no-restricted-syntax',
  },
  {
    name: 'BAD: interface declared inside a spec (TYPES-009)',
    rel: 'features/expenses/tests/api/__golden.spec.ts',
    code: `interface Local { a: number }\nexport const x: Local = { a: 1 };\n`,
    expect: 'no-restricted-syntax',
  },
  {
    name: "BAD: cross-feature import of another feature's Page (LAYER-011)",
    rel: 'features/expenses/pages/frontoffice/__golden.ts',
    code: `import { LoginPage } from '@features/auth/pages/LoginPage';\nexport const x = LoginPage;\n`,
    expect: 'boundaries/dependencies',
  },
  {
    name: 'BAD: spec imports test from @playwright/test (COMPOSE-006)',
    rel: 'features/expenses/tests/api/__golden.spec.ts',
    code: `import { test } from '@playwright/test';\ntest('x', () => {});\n`,
    expect: 'no-restricted-imports',
  },
  {
    name: 'BAD: raw page.getByText locator in a spec (LOC-005)',
    rel: 'features/expenses/tests/ui/frontoffice/__golden.spec.ts',
    code: `import { test, expect } from '@features/expenses/fixtures';\ntest('x', async ({ page }) => {\n  await expect(page.getByText('hi')).toBeVisible();\n});\n`,
    expect: 'no-restricted-syntax',
  },
  {
    name: 'BAD: page.waitForTimeout in a Page Object (WAIT-002)',
    rel: 'features/expenses/pages/frontoffice/__golden.ts',
    code: `import { BasePage } from '@core/ui/BasePage';\nexport class P extends BasePage { async w() { await this.page.waitForTimeout(100); } }\n`,
    expect: 'no-restricted-syntax',
  },
  {
    name: 'GOOD: Page imports only core + playwright, no expect (clean)',
    rel: 'features/expenses/pages/frontoffice/__golden.ts',
    code: `import { BasePage } from '@core/ui/BasePage';\nexport class P extends BasePage {}\n`,
    expect: null,
  },
  {
    name: "GOOD: seeding imports another feature's public client (LAYER-011 allows)",
    rel: 'features/expenses/seeding.ts',
    code: `import { ContractsClient } from '@features/contracts/client';\nexport const x = ContractsClient;\n`,
    expect: null,
  },
];

let failures = 0;
for (const c of cases) {
  const messages = await lint(c.code, c.rel);
  const ruleIds = messages.map((m) => m.ruleId);
  if (c.expect === null) {
    const errors = messages.filter((m) => m.severity === 2);
    if (errors.length === 0) {
      console.log(`  ✓ ${c.name}`);
    } else {
      failures++;
      console.log(`  ✗ ${c.name}\n      expected clean, got: ${errors.map((m) => m.ruleId).join(', ')}`);
    }
  } else if (ruleIds.includes(c.expect)) {
    console.log(`  ✓ ${c.name}`);
  } else {
    failures++;
    console.log(`  ✗ ${c.name}\n      expected rule '${c.expect}', got: ${ruleIds.join(', ') || '(none)'}`);
  }
}

console.log(failures === 0 ? `\nAll ${cases.length} golden cases passed.` : `\n${failures} golden case(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
