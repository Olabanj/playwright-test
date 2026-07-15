// Architecture-only gate — fast, no type information needed.
//
// Run with: npm run lint:arch
// This is the deterministic gate the architecture-oversight agent defers to and
// that the pre-commit hook runs. It contains ONLY the architecture layer, so it
// stays fast (no full type-check) and its findings are pure architecture signal.

import tseslint from 'typescript-eslint';
import { architectureConfig } from './eslint/architecture.mjs';

export default [
  {
    name: 'arch-gate/ignores',
    ignores: [
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      '.playwright-mcp/**',
      'docs/**',
      'graphify-out/**',
      'test-migration/**',
      '**/*.example.ts',
    ],
  },
  {
    name: 'arch-gate/parser',
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  ...architectureConfig,
];
