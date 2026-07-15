# Playwright E2E Automation Framework

This repository is a TypeScript-based Playwright test framework built around a feature-first automation strategy for the RemotePass platform.

## What this project is

- A modern Playwright test suite using TypeScript, page objects, API clients, and structured test fixtures.
- Designed to keep automated tests readable, maintainable, and aligned with real product behaviors.
- Organized by feature, not by backend service — each feature owns its API client, page objects, test data builders, and test files.
- Includes both API tests and UI tests for frontoffice and backoffice flows.
- Built as a migration target from an older legacy framework into a cleaner, better-layered automation system.

## Key concepts

- `core/`: shared automation foundation, including HTTP clients, typed config, and generic UI base page support.
- `fixtures/`: reusable login and test data fixtures that keep setup and teardown isolated per test.
- `features/`: feature folders own the full test stack:
  - `api-client.ts` for one endpoint per method
  - `types.ts` for request and response shapes
  - `builders/` for test data construction
  - `seeding.ts` for multi-step API setup
  - `pages/` for single-screen page objects
  - `fixtures.ts` for feature-level test wiring
  - `tests/` for actual specs
- `playwright.config.ts`: single runner with separate projects for `api`, `frontoffice`, and `backoffice`.

## Useful commands

```bash
npm test
npm run test:api
npm run test:ui:frontoffice
npm run test:ui:backoffice
npm run test:smoke
npm run typecheck
npm run lint
npm run format
npm run dashboard
```

## Why this matters

This project is a strong example for a personal portfolio because it demonstrates:

- disciplined test architecture and layer separation
- modern Playwright automation with TypeScript
- feature-driven design and maintainable test structure
- practical use of API-first test setup and robust page object patterns

## Recommended starting points

- `CLAUDE.md`: high-level project overview and architecture notes
- `features/expenses/`: canonical feature example with full layer coverage
- `docs/20-engineering/`: engineering patterns and conventions used by the project
- `playwright.config.ts`: how the runner is configured for multiple test projects

## Project status

- The repository is already migrated from an older legacy automation framework into this new feature-first structure.
- The codebase is maintained with strict conventions, linting, and test quality gates.

---

This README is a simple walkthrough for a portfolio summary; it is not the full documentation for contributors.
