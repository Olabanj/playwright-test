// Full gold-standard ESLint config (flat).
//
// Layered on purpose (top → bottom, later wins):
//   1. Base            — ESLint recommended
//   2. Best-practice   — typescript-eslint strict + stylistic (type-checked)
//   3. Quality         — sonarjs (duplication / complexity), playwright (specs)
//   4. Architecture    — feature-first boundaries + scoped bans (eslint/architecture.mjs)
//   5. Prettier-compat — turn OFF formatting rules; Prettier owns formatting
//
// Two entry points:
//   npm run lint       → this config (the gold standard we converge toward)
//   npm run lint:arch  → eslint.arch.config.mjs (architecture-only, blocking CI gate)
//
// Architecture rules are `error` (blocking). The best-practice layer surfaces the
// gold-standard gap on existing code; we promote items to error as we close gaps.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import playwright from 'eslint-plugin-playwright';
import jest from 'eslint-plugin-jest';
import prettier from 'eslint-config-prettier';
import { architectureConfig } from './eslint/architecture.mjs';

const SOURCE_TS = [
  'core/**/*.ts',
  'fixtures/**/*.ts',
  'features/**/*.ts',
  'utils/**/*.ts',
  'playwright.config.ts',
];

const SPECS = ['features/**/tests/**/*.ts', '**/*.spec.ts'];

export default tseslint.config(
  // 0. What never gets linted.
  {
    name: 'global/ignores',
    ignores: [
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      '.playwright-mcp/**',
      'docs/**',
      'graphify-out/**',
      'test-migration/**',
      // Example files are docs-as-code (illustrative), not real tests/specs.
      '**/*.example.ts',
    ],
  },

  // 1. Base.
  js.configs.recommended,

  // 2. Best-practice — type-aware. Scoped to source TS that lives in tsconfig.
  {
    name: 'best-practice/typescript',
    files: SOURCE_TS,
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // 3a. Quality — duplication & complexity (the "don't copy logVerbose everywhere"
  //     lever: copy-pasted boilerplate gets flagged, then extracted into core/).
  {
    name: 'quality/sonarjs',
    files: SOURCE_TS,
    extends: [sonarjs.configs.recommended],
  },

  // 3b. Quality — Playwright best practices, specs only.
  {
    name: 'quality/playwright',
    files: SPECS,
    ...playwright.configs['flat/recommended'],
  },

  // 3b2. Act/Assert readability — a blank line must separate the action block
  //      from the assertion block inside a test (jest's padding rule keys off
  //      `expect()`, framework-agnostic; auto-fixable). Specs only.
  {
    name: 'quality/act-assert-padding',
    files: SPECS,
    plugins: { jest },
    rules: {
      'jest/padding-around-expect-groups': 'error',
    },
  },

  // 3c. Playwright idiom tuning — empty destructuring `({}, use)` is the
  //     canonical way to declare a fixture/test with no dependencies.
  {
    name: 'quality/playwright-idioms',
    files: ['features/*/fixtures.ts', 'fixtures/**/*.ts', ...SPECS],
    rules: {
      'no-empty-pattern': 'off',
    },
  },

  // 3d. Context tuning — rules whose defaults are too strict for a TEST
  //     framework (the code is correct; the rule's assumptions don't fit).
  {
    name: 'quality/context-tuning',
    files: SOURCE_TS,
    rules: {
      // Interpolating ids/amounts (numbers) into URLs and messages is intended.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Resolve the strict-vs-stylistic conflict: non-nullable-type-assertion-style
      // (stylistic) rewrites `x as T` -> `x!`, which no-non-null-assertion (strict)
      // then forbids. In a test framework a `!` after an established guard is fine;
      // we keep the stylistic rule and allow `!`.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    name: 'quality/context-tuning-builders',
    // `utils/data/**` carries the same shared test-data generators (faker helpers)
    // that builders call — same rationale, same exception.
    files: ['features/*/builders/**/*.ts', 'utils/data/**/*.ts'],
    rules: {
      // Math.random for test-data generation is fine — this is not crypto.
      'sonarjs/pseudo-random': 'off',
    },
  },
  {
    name: 'quality/allow-tracked-todos',
    files: SOURCE_TS,
    rules: {
      // We use `TODO(scope):` markers for tracked, intentional debt (e.g. the
      // api-preconditions migration note). They are deliberate, not a smell.
      'sonarjs/todo-tag': 'off',
    },
  },

  // 4. Architecture — the feature-first gate (also runs standalone via lint:arch).
  ...architectureConfig,

  // 5. Prettier owns formatting — must be last to disable conflicting rules.
  prettier,
);
