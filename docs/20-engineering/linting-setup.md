# Linting & Architecture Gate (Phase 0a)

Set up 2026-06-22. Deterministic gate that AI-generated / migrated code must pass.
Two layers: **architecture** (where code lives / what imports what, tied to ADRs)
and **gold-standard** (type-safety, duplication, single style).

Rule catalog (id → ADR → enforcement → status): [`eslint/architecture-rules.json`](../../eslint/architecture-rules.json).

## Libraries added (devDependencies)

| Library | Version | Why |
|---------|---------|-----|
| `eslint` | ^9.39.4 | Lint engine (flat config). No ESLint existed before. |
| `typescript-eslint` | ^8.61.1 | Type-aware TS rules (`strictTypeChecked` + `stylisticTypeChecked`) — the gold-standard best-practice layer; catches real bugs, not just style. |
| `eslint-plugin-playwright` | ^2.10.4 | Battle-tested Playwright rules (no-wait-for-timeout, no-nth-methods, no-raw-locators, expect-expect…) — frees us from writing them. |
| `eslint-plugin-boundaries` | ^6.0.2 | Architecture import boundaries (the feature-first layer model). Rule used: `boundaries/dependencies`. |
| `eslint-plugin-sonarjs` | ^4.1.0 | Duplication & complexity (the "don't copy logVerbose/error-handling into every file — extract to core/" lever). |
| `prettier` | ^3.8.4 | Single source of formatting truth (one style, zero debate). |
| `eslint-config-prettier` | ^10.1.8 | Turns OFF ESLint formatting rules so they don't fight Prettier (loaded last). |
| `eslint-import-resolver-typescript` | ^4.4.5 | Lets boundaries resolve path aliases (`@features/*`, `@core/*`) to real files so it can classify imports. |

## Files added

| File | Purpose |
|------|---------|
| `eslint.config.mjs` | Full gold-standard config (base → best-practice → quality → architecture → prettier-compat). `npm run lint`. |
| `eslint.arch.config.mjs` | Fast architecture-only gate (no type-check). `npm run lint:arch`. Run by pre-commit + the oversight agent. |
| `eslint/architecture.mjs` | Shared architecture rules (boundaries + scoped bans), used by both configs above. |
| `eslint/architecture-rules.json` | Rules-as-data catalog (single documented source; read by the oversight agent). |
| `eslint/__fixtures__/arch-gate.test.mjs` | Golden regression set — bad snippets must fail, good must pass. `npm run lint:arch:test` (8/8). |
| `tools/arch-checks.mjs` | Filesystem-level rules (NOFLOW-007, DOC-011) that aren't per-file lint. `npm run arch:check`. |
| `.prettierrc.json` / `.prettierignore` | Formatting config. |
| `scripts/hooks/pre-commit` + `install.sh` | Version-controlled pre-commit hook (G2 tsc + arch gate) + installer. `npm run hooks:install`. |

## npm scripts

- `lint` / `lint:fix` — full gold-standard lint.
- `lint:arch` — architecture gate (boundaries + FS checks); blocking, fast.
- `lint:arch:test` — golden regression set for the gate itself.
- `arch:check` — FS-level architecture checks.
- `format` / `format:check` — Prettier.
- `hooks:install` — install the pre-commit hook.

## Restrictions (rules) enforced

### Architecture layer — `error`, blocks commits

| ID | Restriction | Mechanism |
|----|-------------|-----------|
| LAYER-010 | Page→client/seeding/HTTP forbidden; client→client/page/fixtures/builders forbidden; builder→HTTP/client forbidden; types/constants must be dependency-free | `boundaries/dependencies` |
| LAYER-011 | Pages & builders are private to their feature; cross-feature uses only public entry points (client/types/seeding/fixtures) | `boundaries/dependencies` (`!{{from.feature}}`) |
| ASSERT-003 | `expect` only in tests, never in Page Objects | `no-restricted-syntax` (pages) |
| ENV-001 | `process.env` only in `core/config/env.ts` | `no-restricted-syntax` |
| WAIT-002 | No `setTimeout` / `waitForTimeout` | `no-restricted-syntax` + `playwright/no-wait-for-timeout` |
| TYPES-009 | No `interface` declared inside a spec — types live in `types.ts` | `no-restricted-syntax` (specs) |
| COMPOSE-006 | Specs take `test`/`expect` from feature fixtures, not raw `@playwright/test` | `no-restricted-imports` (specs) |
| NOFLOW-007 | No Flow/Facade layer (no `flows`/`facades` dirs, no `*Flow.ts`/`*Facade.ts`) | `tools/arch-checks.mjs` |
| DOC-011 | Every feature with `tests/` has a scenario doc | `tools/arch-checks.mjs` |
| LOC-004 | Stable locators — no nth-child / XPath / raw CSS | `playwright/no-nth-methods`, `no-raw-locators` |

### Gold-standard layer — type-safety, duplication, single style

`typescript-eslint` strict + stylistic (type-checked), `sonarjs` (incl. DRY-020: no copy-paste boilerplate), `playwright` recommended, Prettier formatting.

### Context tunings (rule relaxed because too strict for a TEST framework — code is correct)

| Rule | Tuning | Reason |
|------|--------|--------|
| `restrict-template-expressions` | `allowNumber: true` | Interpolating ids/amounts into URLs is intended. |
| `sonarjs/pseudo-random` | off (builders) | `Math.random` for test data is fine — not crypto. |
| `no-empty-pattern` | off (fixtures, specs) | Playwright fixture idiom `({}, use)`. |
| `no-non-null-assertion` | off | Resolves a strict-vs-stylistic conflict (stylistic rewrites `as`→`!`, strict then forbids `!`). |
| `*.example.ts` | excluded from lint | Docs-as-code, not real tests. |

### Agent-only (judgment, not linted)

INDEP-004 (test independence), FIXT-008 (fixtures vs beforeAll), MEANING-100 (test is meaningful), and the mergeTests-specifically part of COMPOSE-006. These go to the architecture-oversight agent (Phase 0b), which reads the same `architecture-rules.json`.

## Wiring

`.git/hooks/pre-commit` runs `tsc --noEmit` (G2) + `lint:arch` on staged `playwright-e2e/*.ts`; a violation blocks the commit. Install with `npm run hooks:install`. Hooks are not auto-installed for teammates. A CI workflow running the full type-checked `lint` is a future step.
