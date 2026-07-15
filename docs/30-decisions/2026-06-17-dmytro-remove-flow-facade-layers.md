---
id: remove-flow-facade-layers
name: remove-flow-facade-layers
description: "Remove the Flow and Facade layers from playwright-e2e. Multi-step API composition moves to stateless seeding.ts helpers; reusable preconditions with lifecycle move to factory state-fixtures; Pages are injected via fixtures (DI) and combined across modules with mergeTests. No Flow class until a narrow set of conditions is met."
metadata:
  type: decision
  category: architecture
  status: accepted
  supersedes: ["Flow/Facade parts of 2026-05-22-dmytro-feature-first-layout"]
  tags: ["architecture", "fixtures", "seeding", "mergeTests", "composition", "playwright", "factory-fixture"]
  author: dmytro
  createdAt: 2026-06-17
---

# Remove the Flow and Facade layers

## Decision

`playwright-e2e/` no longer has a **Flow** layer or a **Facade** layer. The work those layers did is redistributed by responsibility:

- **Stateless multi-step API composition** → plain helper functions in `features/<feature>/seeding.ts`.
- **Reusable preconditions that need lifecycle/cleanup** → **factory state-fixtures** in `features/<feature>/fixtures.ts` that wrap the seeding helpers and delete what they created on teardown.
- **Wiring / "which clients & pages a feature needs"** → fixtures + `mergeTests`, assembled in the spec.

There is no `flow.ts` and no `*Flow` / `*Facade` class.

## Canonical model (what to follow everywhere)

| Layer | Lives in | Responsibility |
|---|---|---|
| Core | `core/{http,config,types}` | foundation, no domain |
| Client (API) | `features/<f>/client.ts` | HTTP, 1 method = 1 endpoint |
| Builder | `features/<f>/builders/` | test-data construction, no HTTP |
| **seeding** | `features/<f>/seeding.ts` | **stateless API composition** — the single home for reusable multi-step setup; replaces Flow's composition role |
| Page (POM) | `features/<f>/pages/` | one class = one screen; multi-step OK only within one screen; never takes an API client; never navigates cross-screen |
| Fixtures | `features/<f>/fixtures.ts` | DI of pages/clients + **factory state-fixtures** (seed + cleanup on teardown) |
| Tests | `features/<f>/tests/{api,ui}/` | scenario + `expect` only |

Three rules the team agreed on (2026-06-18):

1. **DI for Pages** — a Page arrives as a fixture; it is never `new`-ed inside a test.
2. **Dynamic fixtures = factory fixtures** — the fixture yields a function the test calls at runtime with the data it needs (e.g. `seedExpense(data)`), tracking what it created and cleaning up on teardown.
3. **`mergeTests`** — cross-module tests combine the fixtures of several modules into one `test`.

### Helper vs fixture split

`seeding.ts` holds the *composition* (the sequence of client calls); the *lifecycle* (tracking + cleanup) lives in the fixture that wraps it. This is why "Flow" decomposed cleanly into two homes instead of being renamed: a Flow class always still needed a fixture to call its `cleanup()`, so in practice Flow already equalled `seeding` + fixture — we just stopped gluing them into one class.

### Litmus test — where does logic go?

- Needed by ≥2 tests **and** touches >1 screen/API → `seeding.ts` helper (+ a factory state-fixture if it needs cleanup).
- Single-screen action → Page method.
- One-off → inline in the spec.
- Cross-module → `seeding.ts` helper in the **owner** module + `mergeTests`.

## When to reintroduce a Flow class

Only when one of these is true — until then, use `seeding.ts` + a fixture:

1. A single business sequence genuinely spans ~5 modules.
2. Token / MFA / refresh-login logic must be hidden behind an interface.
3. Real cross-module composition that warrants an owner-module object (owner-module rule).

## Migrated files (already applied & verified)

- Deleted `features/auth/facade.ts`, `features/expenses/facade.ts`, `features/contracts/facade.ts`.
- Created `features/expenses/seeding.ts` — `createExpenseViaApi`, `resolveFirstContractId`, `findExpenseIdByName` (stateless).
- `features/expenses/fixtures.ts` — `seedExpense` factory state-fixture wraps `createExpenseViaApi` and deletes created expenses on teardown.
- `SeededExpense` moved from the deleted facade to `features/expenses/types.ts`.
- `features/auth/fixtures.ts` — dropped `authFlow`; `authClient` + `loginPage` (DI page) only.
- `features/auth/tests/api/auth.spec.ts` — login/logout assembled inline in the spec.
- Canonical compiling reference: `features/expenses/examples/canonical-composition.example.ts` (mergeTests + factory fixture + DI pages).

Verification: `tsc --noEmit` = 0; auth API smoke 2 passed; expenses UI smoke+regression 6 passed.

## References

- Supersedes the Flow/Facade portions of [`2026-05-22-dmytro-feature-first-layout.md`](2026-05-22-dmytro-feature-first-layout.md) (the feature-first layout decision itself stands).
- Composition mechanics: [`../20-engineering/composition-patterns.md`](../20-engineering/composition-patterns.md).
