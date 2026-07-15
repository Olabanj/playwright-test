---
id: feature-first-layout
name: feature-first-layout
description: "Switch playwright-e2e/ from layer-first (clients/builders/flows/pages at repo root) to feature-first (features/<domain>/{client,types,flow,builders,pages,tests}). Layers become file-level conventions inside each module instead of top-level folders. Path aliases shrink to @core, @fixtures, @features, @utils."
metadata:
  type: decision
  category: architecture
  status: accepted
  supersedes: ["initial layer-first sketch in 10-architecture/plan.md (pre-2026-05-22)"]
  tags: ["architecture", "layout", "feature-first", "modules", "scaling"]
  author: dmytro
  createdAt: 2026-05-22
---

# Switch playwright-e2e/ to feature-first layout

> **⚠️ Superseded in part (2026-06-17).** The feature-first layout decision below still stands. However, the **Flow / Facade layer** described in this document (the `flow.ts` file, `*Flow` classes, the "Page-level UI orchestration vs business Flow" and "Cross-module Flow ownership" sections, and the `flow.ts` rows in the structure / DAG tables) has been **removed**. Composition now lives in stateless `seeding.ts` helpers wrapped by factory state-fixtures; Pages are injected via fixtures (DI); cross-module composition uses `mergeTests`. Read every Flow/Facade passage below as historical. See [`2026-06-17-dmytro-remove-flow-facade-layers.md`](2026-06-17-dmytro-remove-flow-facade-layers.md).

## Decision

Repository code under `playwright-e2e/` is organised **by domain module** (`features/auth/`, `features/contracts/`, …), not by architectural layer.

Inside each module, the layered pattern (Client → Builder → Flow → Page → Fixture → Test) is preserved as **file-level conventions**:

```
features/<domain>/
├── client.ts          # Layer 1 (HTTP)
├── types.ts           # request/response + picklist types
├── flow.ts            # Layer 2 (Facade)
├── builders/          # one file per request shape (Create/Update/...)
├── pages/             # POM v4 (UI)
├── fixtures.ts        # extends baseTest with module-specific test.extend()
└── tests/api/, tests/ui/{frontoffice,backoffice}/
```

Only **cross-cutting infrastructure** stays at repo root: `core/`, `fixtures/` (worker-scoped auth tokens only), `utils/`.

Path aliases collapse to: `@core/*`, `@fixtures(/*)`, `@features/*`, `@utils/*`. The old layer aliases (`@clients`, `@builders`, `@flows`, `@pages`, `@tests`) are removed.

## Why

The initial sketch in `10-architecture/plan.md` had layers as top-level folders (`clients/`, `builders/`, `flows/`, `pages/`, `tests/`). That works for a small team with a few modules. As the migration plan brings 10+ modules (time-tracking, payments, contracts, expenses, onboarding, time-off, eor, DE-specific, …), the layer-first layout costs us:

- **Navigation cost.** Working on `contracts` means jumping across 5–6 top-level folders for the same domain.
- **Deletion / extraction cost.** Removing a feature touches every layer folder.
- **Cognitive cost.** "Show me everything about contracts" has no single location.
- **Parallel-work cost.** Two engineers touching different modules constantly collide in the same top-level folders.

Feature-first (also called vertical-slice / module-first) reverses these trade-offs at the cost of slightly more bookkeeping for cross-module Flows (they live in the `flow.ts` of the owning module, or under a dedicated `features/<flow-name>/` folder if they're genuinely cross-cutting).

ESLint enforcement of the layered contracts (no `expect()` in `pages/`, no `goto()` in `tests/`, single env entry-point, etc.) remains intact — the rules just key off filename/path patterns within `features/**/` instead of top-level layer folders.

### Why this also aligns with Playwright's official recommendation

Playwright is layout-agnostic — its docs do not prescribe a folder structure. But the **composition mechanism** we rely on for cross-module reuse — `mergeTests()` and `test.extend()` — is exactly what Playwright recommends for combining fixtures from different files. The official "Test fixtures" guide demonstrates the same pattern: each fixture file owns its `test.extend()`, and consumers merge them when they need fixtures from multiple sources. Feature-first folders make `mergeTests` natural — one `fixtures.ts` per module, merged at the consuming test or fixture site. With layer-first folders, the same composition is possible but requires arbitrary "where do the contracts fixtures live?" decisions because there is no single home per domain.

See `docs/20-engineering/composition-patterns.md` for the concrete `mergeTests` patterns used in this repo.

### Page-level UI orchestration vs business Flow

A common confusion when reading the layout: "isn't `LoginPage.login(email, password)` already a Flow, why a separate `flow.ts`?" The two operate on different layers:

| | `LoginPage.login()` in `pages/LoginPage.ts` | `AuthFlow.loginAs(role)` in `flow.ts` |
|---|---|---|
| Inputs | Raw email/password strings | A role enum (`'client' \| 'contractor' \| 'admin'`) |
| Mechanism | DOM interaction via `page.fill`/`.click`/`.waitForURL` | HTTP request via `AuthClient` |
| Knows about | Locators, navigation, post-login dialogs | Endpoint shape, credential env mapping, token extraction |
| Caller | UI test or UI test fixture | API test, or `base.fixture.ts` worker-scoped token setup |

`LoginPage.login()` is a "compound action on a page" — standard POM v4. `AuthFlow.loginAs()` is a "business operation through API" — the Flow / Facade pattern. They look similar from a distance because they perform the same business action (logging in a user); they are distinct because they take different paths and serve different test types. When an API test runs, only `AuthFlow` executes. When a UI test runs, `LoginPage.login()` drives the browser. There is no `goto()` and no `page` fixture inside `AuthFlow`; there is no HTTP and no token-handling inside `LoginPage`.

Auth's `flow.ts` is intentionally thin today (one wrapped client method). It exists because (a) it hides credential lookup from tests, (b) it grows naturally when token refresh / MFA / fresh-vs-cached login enter the picture, (c) once more API clients exist in the module (e.g. AuthClient + UserProfileClient for "log in then fetch /me"), it becomes a real composing Facade. **Do not add a Flow class for a domain with one HTTP call unless you have a credential or token-shape concern to hide.**

### Cross-module Flow ownership

Cross-module business operations (e.g. "contractor onboarding" spans auth + contracts + kyc) live in the **owner module's `flow.ts`** — the owner is the module that produces the final business entity. Dependencies come in via **constructor injection** so fixtures can wire them up:

```typescript
// features/contracts/flow.ts
export class ContractorOnboardingFlow {
  constructor(
    private auth: AuthFlow,
    private contracts: ContractsClient,
    private kyc: KycFlow,
  ) {}
  async onboardContractor(data: CreateContractRequest) { ... }
}
```

```typescript
// features/contracts/fixtures.ts — composes with mergeTests
import { mergeTests } from '@playwright/test';
import { test as authTest } from '@features/auth/fixtures';
import { test as kycTest }  from '@features/kyc/fixtures';

export const test = mergeTests(authTest, kycTest).extend<ContractsFixtures>({
  contractorOnboardingFlow: async ({ authFlow, kycFlow }, use) => { ... },
});
```

The consuming test sees **one** fixture (`contractorOnboardingFlow`) — never orchestrates multiple Flows itself. If a test reaches for three Flows manually, that is the signal to create a new composed Flow.

**Dependency direction rule (to be enforced by ESLint in Phase 3):** `features/<X>/flow.ts` MAY import `@features/<Y>/flow`. `features/<X>/client.ts` MUST NOT import `@features/<Y>/*`. Clients never compose other clients — only Flows compose Flows. This keeps the dependency graph a DAG.

## What changed in code

| Before | After |
|---|---|
| `clients/auth/AuthClient.ts` | `features/auth/client.ts` |
| `flows/auth/AuthFlow.ts` | `features/auth/flow.ts` |
| `pages/common/LoginPage.ts` | `features/auth/pages/LoginPage.ts` |
| `fixtures/api.fixture.ts` + `fixtures/ui.fixture.ts` | `features/auth/fixtures.ts` (single file per module) |
| `tests/modules/auth/api/auth.spec.ts` | `features/auth/tests/api/auth.spec.ts` |
| `clients/modules/contracts/contract.types.example.ts` | `features/contracts/types.ts` |
| `builders/contracts/{Create,Update}ContractBuilder.example.ts` | `features/contracts/builders/{Create,Update}ContractBuilder.example.ts` |

`playwright.config.ts` testMatch patterns were updated from `**/tests/**/api/...` to `**/features/**/tests/api/...`. `testDir` changed from `./tests` to `./features`.

## What did not change

- The 8 architectural patterns (ISTQB three layers, Flow, Facade, Builder, Fixture, POM v4, API Client, Config) — only their on-disk location.
- Layer contracts (no `expect()` in pages, no `process.env` outside `core/config/env.ts`, builders without HTTP, centralised logging in `BaseApiClient.request()`).
- Single `playwright.config.ts` with three projects (`api`, `frontoffice`, `backoffice`).
- Single typed env entry-point `core/config/env.ts`.

## Trade-offs accepted

- **Cross-module flows** need an explicit home. Convention: live in `features/<owner>/flow.ts`. If the flow is genuinely cross-cutting (e.g. "contractor onboarding spans contracts + payments + KYC"), create `features/<flow-name>/` with only `flow.ts` + `tests/`.
- **Shared UI components** (top-nav, dialogs) get `features/_common/pages/` (underscore prefix sorts it on top and signals "not a domain module").
- **ESLint architecture rules** need to match on `features/**/<role>.ts` filename patterns rather than top-level folder names. Slightly more regex, same intent.

## References

- Implementation PR: branch `ai-memory-code-1`.
- Updated structure documented in [`10-architecture/plan.md`](../10-architecture/plan.md#repository-structure).
- Migration plan: [`10-architecture/migration-plan.md`](../10-architecture/migration-plan.md) — all Phase 2 module-issues now land under `features/<domain>/` instead of split folders.
