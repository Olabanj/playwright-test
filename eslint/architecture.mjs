// Architecture layer — the deterministic encoding of the feature-first rules.
//
// This is the SINGLE source the architecture gate runs on. It is intentionally
// separated from the gold-standard/style layer so it can be run on its own
// (`npm run lint:arch`) as a fast, blocking CI gate and as the deterministic
// check the architecture-oversight agent defers to.
//
// Each rule maps to an ADR in docs/30-decisions/ — see architecture-rules.json
// for the human/agent-facing catalog (rule id -> ADR -> enforced_by).
//
// Philosophy: start permissive (default: 'allow'), forbid only the known-bad
// combinations explicitly, and close gaps incrementally.

import boundaries from 'eslint-plugin-boundaries';

// Syntax bans applied everywhere (env access is centralised; no manual timers).
const GLOBAL_SYNTAX_BANS = [
  {
    // RULE: ENV-001 — process.env only in core/config/env.ts (typed config).
    selector: "MemberExpression[object.name='process'][property.name='env']",
    message:
      'Read environment only via core/config/env.ts (typed config). Direct process.env is banned — ADR 2026-* typed-config.',
  },
  {
    // RULE: WAIT-002 — no manual timers; rely on Playwright auto-wait.
    selector: "CallExpression[callee.name='setTimeout']",
    message: 'No setTimeout — use Playwright auto-wait + web-first assertions.',
  },
  {
    // RULE: WAIT-002 — no page.waitForTimeout. Matches `*.waitForTimeout(...)` via
    // callee.property.name, so it bans page/frame waitForTimeout but NOT `test.setTimeout`
    // (per-test timeout config). Sanctioned settle-delays need an explicit
    // eslint-disable + TODO(flaky) + ADR cite (see ADR 2026-06-25-dmytro-wait002-enforce).
    selector: "CallExpression[callee.property.name='waitForTimeout']",
    message: 'No waitForTimeout — use Playwright auto-wait + web-first assertions (web-first expect, waitForURL, locator waits).',
  },
];

/**
 * Architecture config blocks, shared by the full config and the arch-only gate.
 * @type {import('eslint').Linter.Config[]}
 */
export const architectureConfig = [
  // --- Boundaries: layer model + forbidden cross-layer imports ---------------
  {
    name: 'architecture/boundaries',
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
      'boundaries/dependency-nodes': ['import'],
      // Order matters: first matching pattern wins. Most specific first.
      'boundaries/elements': [
        { type: 'core-http', mode: 'full', pattern: 'core/http/**' },
        { type: 'core', mode: 'full', pattern: 'core/**' },
        { type: 'shared-fixtures', mode: 'full', pattern: 'fixtures/**' },
        { type: 'utils', mode: 'full', pattern: 'utils/**' },
        { type: 'page', mode: 'full', pattern: 'features/*/pages/**', capture: ['feature'] },
        { type: 'test', mode: 'full', pattern: 'features/*/tests/**', capture: ['feature'] },
        { type: 'builder', mode: 'full', pattern: 'features/*/builders/**', capture: ['feature'] },
        {
          type: 'feature-fixtures',
          mode: 'full',
          pattern: 'features/*/fixtures{,/**}',
          capture: ['feature'],
        },
        { type: 'seeding', mode: 'full', pattern: 'features/*/seeding.ts', capture: ['feature'] },
        // The feature's main API client. Single-client features keep it at the
        // root (`api-client.ts`); multi-client features group all clients under
        // `clients/` (ADR 2026-07-09) — the main client is `clients/api-client.ts`.
        {
          type: 'client',
          mode: 'full',
          pattern: 'features/*/{,clients/}api-client.ts',
          capture: ['feature'],
        },
        { type: 'types', mode: 'full', pattern: 'features/*/types.ts', capture: ['feature'] },
        { type: 'constants', mode: 'full', pattern: 'features/*/constants.ts', capture: ['feature'] },
      ],
    },
    rules: {
      // RULE: LAYER-010 — forbidden cross-layer imports (default allow).
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: { type: 'page' },
              disallow: { to: { type: ['client', 'seeding', 'core-http', 'shared-fixtures'] } },
              message:
                'Page (POM) must not import API clients, seeding, or raw HTTP. Compose via fixtures/seeding — ADR 2026-06-17 (no Flow/Facade).',
            },
            {
              from: { type: 'client' },
              disallow: {
                to: { type: ['client', 'page', 'feature-fixtures', 'seeding', 'test', 'builder'] },
              },
              message:
                'Client = one method per endpoint. No client-composes-client, no pages/seeding/fixtures/builders.',
            },
            {
              from: { type: 'builder' },
              disallow: {
                to: { type: ['client', 'core-http', 'page', 'seeding', 'feature-fixtures', 'test'] },
              },
              message: 'Builders are pure payload builders — no HTTP, clients, or pages.',
            },
            {
              from: { type: ['types', 'constants'] },
              disallow: {
                to: {
                  type: [
                    'client',
                    'page',
                    'builder',
                    'seeding',
                    'feature-fixtures',
                    'test',
                    'core-http',
                  ],
                },
              },
              message: 'Type/constant modules must stay dependency-free leaves.',
            },
            {
              // RULE: LAYER-011 — pages & builders are private to their feature.
              // Cross-feature composition goes through public entry points
              // (client / types / constants / seeding / fixtures), never another
              // feature's POM or builder. `!${from.feature}` matches any OTHER feature.
              from: {
                type: ['page', 'test', 'seeding', 'client', 'builder', 'feature-fixtures'],
              },
              disallow: {
                to: { type: ['page', 'builder'], captured: { feature: '!{{from.feature}}' } },
              },
              message:
                "Another feature's pages/builders are private. Import only its public entry points (client/types/constants/seeding/fixtures) — ADR 2026-05-22 feature-first layout.",
            },
          ],
        },
      ],
    },
  },

  // --- Scoped syntax bans: global -------------------------------------------
  {
    name: 'architecture/syntax-global',
    files: ['**/*.ts'],
    ignores: ['core/config/env.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...GLOBAL_SYNTAX_BANS],
    },
  },

  // --- Scoped syntax bans: Page Objects (no assertions) ----------------------
  {
    name: 'architecture/syntax-pages',
    files: ['features/*/pages/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...GLOBAL_SYNTAX_BANS,
        {
          // RULE: ASSERT-003 — expect lives in tests/, never in pages/.
          selector: "CallExpression[callee.name='expect']",
          message: 'Assertions belong in tests/, not in Page Objects. Pages expose locators + actions only.',
        },
      ],
    },
  },

  // --- Scoped syntax bans: specs (no inline interfaces) ----------------------
  {
    name: 'architecture/syntax-specs',
    files: ['features/**/tests/**/*.ts', '**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...GLOBAL_SYNTAX_BANS,
        {
          // RULE: TYPES-009 — no interface declared inside a test file.
          selector: 'TSInterfaceDeclaration',
          message: 'Declare shared types in features/<feature>/types.ts, not inside specs.',
        },
        {
          // RULE: LOC-005 — no raw Playwright locators in specs. The mirror of
          // ASSERT-003: locators live in Page Objects, assertions live in tests.
          // expect(page), page.goto, page.keyboard, etc. remain allowed.
          selector:
            "CallExpression[callee.object.name='page'][callee.property.name=/^(getByText|getByRole|getByLabel|getByPlaceholder|getByTestId|getByTitle|getByAltText|locator|frameLocator)$/]",
          message:
            'No raw Playwright locators in specs — expose them on the Page Object (static = getter, dynamic = method returning Locator) and assert via expect(pageObject.x). page.getBy*/locator belongs in pages/, not tests.',
        },
      ],
      // RULE: COMPOSE-006 — specs take the fixture-provided `test`/`expect`,
      // never the raw Playwright one. Cross-feature composition = mergeTests of
      // feature fixtures. (The mergeTests-specifically check stays agent-judged.)
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              message:
                'Import test/expect from your feature fixtures (or a mergeTests-composed test), not directly from @playwright/test.',
            },
          ],
        },
      ],
    },
  },
];
