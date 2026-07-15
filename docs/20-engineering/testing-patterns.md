---
id: 9ce74d6f-e686-5674-8842-6086ca1c22af
name: testing-patterns
description: "Architecture patterns for playwright-e2e — per-layer contracts (what each layer may and may not do), current vs target state, what to keep from old framework"
metadata:
  type: feedback
  category: engineering
  tags: ["patterns", "architecture", "layers", "playwright", "pom", "fixtures", "builder", "seeding", "istqb", "config"]
---

# Testing Patterns — playwright-e2e

> **See also:** [`layer-responsibilities.md`](layer-responsibilities.md) — what each file is for, where each kind of logic lives, and the no-duplication rule. Data cleanup rationale: [`../30-decisions/2026-06-19-dmytro-per-test-data-cleanup.md`](../30-decisions/2026-06-19-dmytro-per-test-data-cleanup.md).

## The Patterns (Target Architecture)

| # | Pattern | Purpose | Status in playwright-e2e |
|---|---------|---------|--------------------------|
| 1 | Three-Layer Architecture (ISTQB) | Enforce layer boundaries: Foundation / Composition / Tests | ✅ Designed from scratch |
| 2 | API Composition (`seeding.ts`) | Stateless helpers above API clients; reused in API specs and wrapped by factory fixtures. Replaces the old Flow/Facade layer — see [2026-06-17 ADR](../30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md) | ✅ New — `seeding.ts` |
| 3 | Builder Pattern | Fluent test data creation without HTTP calls | ✅ New — builders/ layer |
| 4 | Fixture Pattern (Playwright `test.extend()`) | Lifecycle management, auto-cleanup, factory state-fixtures, `mergeTests`, worker/test scope | ✅ Built from scratch |
| 5 | Page Object Model v4 | Locators + actions only; injected via fixtures (DI); no `expect()`, no `goto()` in tests | ✅ Built from scratch |
| 6 | API Client Pattern | Typed domain clients, one method = one HTTP request | ✅ Inherited and improved |
| 7 | Config Pattern | Single typed entry point for env vars; no `process.env` outside `env.ts`; multi-env via `ENV=` switch | ✅ New — `core/config/env.ts` |

## Layer Contracts (Non-Negotiable)

### Tests (Layer 3)
- ✅ Declares fixtures as arguments
- ✅ Contains `expect()` assertions
- ❌ Never creates HTTP clients directly
- ❌ Never calls `page.goto()` directly
- ❌ Never contains setup/teardown logic

### Fixtures (Layer 2→3)
- ✅ Manages lifecycle with Playwright `test.extend()`
- ✅ Handles auto-cleanup after each test
- ✅ Injects seeding helpers, builders, and page objects (DI); provides factory state-fixtures
- ❌ Never contains `expect()`

### Composition — `seeding.ts`
- ✅ Stateless helpers combining multiple API client calls into one reusable sequence
- ✅ Reused by API specs directly and wrapped by factory fixtures for UI setup
- ❌ Never contains `expect()`
- ❌ Never touches the browser; never owns cleanup (that is the fixture's job)

### Pages (Layer 2)
- ✅ Encapsulates locators and browser actions
- ✅ Contains `goto()` inside page methods
- ❌ Never contains `expect()`

### API Clients (Layer 1)
- ✅ One method = one HTTP request
- ✅ Returns typed `ApiResponse<T>` — never `any`
- ❌ Never combines multiple requests (that's a seeding helper's job)

### Builders (Layer 1)
- ✅ Creates test data objects
- ❌ Never makes HTTP calls

### Core (Layer 0)
- ✅ HTTP mechanics, config, types
- ✅ `core/config/env.ts` is the only file that reads `process.env`
- ❌ No RemotePass business logic
- ❌ No `process.env.X` reads outside `env.ts`

## What the Old test-framework Had vs What playwright-e2e Fixes

| Issue in test-framework | Solution in playwright-e2e |
|------------------------|---------------------------|
| `any` types everywhere | `ApiResponse<T>` generics on every method |
| Tests call API clients directly | Tests only touch fixtures/seeding |
| Multi-step setup duplicated in tests | Stateless `seeding.ts` helpers + factory state-fixtures |
| No Builder pattern | Dedicated `builders/` layer |
| Static fixture classes (not `test.extend()`) | Full `test.extend()` fixtures with auto-cleanup |
| Two Playwright configs | One base config + project overrides |
| Business logic in tests | Tests are specification-only |
| Code duplication | Shared utilities in core/ |
| `process.env.X` scattered across 10+ files | Single typed `env.ts` with `requireEnv` validation |

## What We Carry Over from test-framework

| What | How |
|------|-----|
| `BaseAPI.ts` init/dispose logic | Rewrite as `BaseApiClient.ts` with generics |
| Endpoint lists from `*API.ts` | Move to `core/config/endpoints.ts` |
| `utils/constants/` | Merge into `core/config/` |
| `logVerbose` pattern from `logger.ts` | Carry over as-is |
| Data generation logic from `*-faker.ts` | Wrap into Builder classes |
| TypeScript types from `utils/types/` | Carry over and extend |

## API Client Reuse Between API and UI Tests

The same `seeding.ts` helper is used in both test types:
- API test: `test({ seedContract }) → seedContract(data)` (factory fixture wrapping the helper)
- UI test: `test({ contractsPage, seedContract }) → seedContract(data)` + page assertions

The `seeding.ts` layer is what makes this possible — it abstracts the HTTP composition so UI tests don't need to know about the API directly, while the factory fixture adds cleanup.
