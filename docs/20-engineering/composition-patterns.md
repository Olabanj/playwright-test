---
id: composition-patterns
name: composition-patterns
description: "How to compose fixtures and seeding helpers across feature-first modules in playwright-e2e — single-module test (test.extend), cross-module test (mergeTests), cross-module composition (a seeding helper in the owner module wrapped by a factory state-fixture); page-level UI orchestration vs seeding; dependency direction rule; Playwright official mergeTests pattern. No Flow/Facade layer."
metadata:
  type: project
  category: engineering
  tags: ["composition", "fixtures", "mergeTests", "test-extend", "modules", "playwright", "seeding", "factory-fixture"]
  author: dmytro
  createdAt: 2026-05-22
---

# Composition Patterns

> **See also:** [`layer-responsibilities.md`](layer-responsibilities.md) — what each file is responsible for and the no-duplication rule (this doc focuses on *how* to compose; that one on *where things live*).

How tests, fixtures, and `seeding.ts` helpers compose across the feature-first layout. There is **no Flow/Facade layer** — see [decisions/2026-06-17-dmytro-remove-flow-facade-layers.md](../30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md). Multi-step API composition lives in stateless `seeding.ts` helpers; reusable preconditions with lifecycle live in factory state-fixtures; cross-module tests combine fixtures with `mergeTests`.

## TL;DR

| Need | Pattern |
|---|---|
| Test uses one module's fixtures | Import `test` from `@features/<X>/fixtures` |
| Test uses fixtures from two modules | `mergeTests(testA, testB)` then optionally `.extend()` |
| Reusable multi-step API setup | A stateless function in `@features/<X>/seeding.ts` |
| Reusable precondition that needs cleanup | A **factory state-fixture** wrapping the seeding helper |
| Cross-module business operation | Seeding helper in the **owner** module + factory fixture that wires deps via `mergeTests` |
| Generic "log in via UI before this test" | Compound action inside the `LoginPage` POM, not a seeding helper |

## Pattern 1 — single-module test (`test.extend()`)

Each module has one `fixtures.ts` that extends `baseTest` with its own fixtures. Pages are injected (DI); reusable API setup comes from `seeding.ts` either directly or via a factory fixture.

```typescript
// features/auth/fixtures.ts
import { baseTest } from '@fixtures/base.fixture';
import { AuthClient } from '@features/auth/client';
import { LoginPage } from '@features/auth/pages/LoginPage';

export const test = baseTest.extend<{
  authClient: AuthClient;
  loginPage:  LoginPage;
}>({
  authClient: async ({}, use) => {
    const client = new AuthClient();
    await client.init();
    await use(client);
    await client.dispose();
  },
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); }, // DI page
});

export { expect } from '@playwright/test';
```

```typescript
// features/auth/tests/api/auth.spec.ts
import { test, expect } from '@features/auth/fixtures';
import { loginAs } from '@fixtures/base.fixture';

test('logs in as client @smoke', async () => {
  const token = await loginAs('client'); // helper from base.fixture — no Flow class
  expect(token).toBeDefined();
});
```

## Pattern 2 — cross-module test (`mergeTests`)

A test that needs fixtures from two modules merges them. This is the **official Playwright pattern** for combining fixtures from different files.

```typescript
// features/payments/tests/api/payment-after-login.spec.ts
import { mergeTests } from '@playwright/test';
import { test as authTest }     from '@features/auth/fixtures';
import { test as paymentsTest } from '@features/payments/fixtures';

const test  = mergeTests(authTest, paymentsTest);
const expect = test.expect;

test('worker gets paid @smoke', async ({ seedPayment }) => {
  const payment = await seedPayment(/* … */); // factory fixture from payments
  expect(payment.status).toBe('paid');
});
```

Each module's fixtures stay defined exactly once, in its own file. The merged `test` exposes the union of all fixtures; only those a given spec destructures are actually constructed.

## Pattern 3 — cross-module composition (owner-module seeding helper)

When the same multi-module sequence appears in more than one test, lift it into a **stateless helper in the owner module's `seeding.ts`** — the module whose entity is the result of the sequence. Pass the clients it needs as arguments (the fixture injects them); never instantiate clients inside the helper, and never put cleanup there.

```typescript
// features/contracts/seeding.ts — composition lives in the OWNER module
import { loginAs } from '@fixtures/base.fixture';
import { ContractsClient } from '@features/contracts/client';
import { KycClient } from '@features/kyc/client';
import { CreateContractRequest, Contract } from '@features/contracts/types';

/** Stateless: onboard a contractor end-to-end. No cleanup here — the fixture owns lifecycle. */
export async function onboardContractor(
  clients: { contracts: ContractsClient; kyc: KycClient },
  data: CreateContractRequest,
): Promise<Contract> {
  const token    = await loginAs('client');
  const contract = await clients.contracts.create(token, data);
  await clients.kyc.completeFor(contract.id);
  return contract;
}
```

The owner module's `fixtures.ts` provides a **factory state-fixture** that wires the dependency clients (merging the dependency modules' fixtures where useful) and adds cleanup:

```typescript
// features/contracts/fixtures.ts
import { mergeTests } from '@playwright/test';
import { test as kycTest } from '@features/kyc/fixtures';
import { ContractsClient } from '@features/contracts/client';
import { KycClient } from '@features/kyc/client';
import { onboardContractor } from '@features/contracts/seeding';
import { CreateContractRequest, Contract } from '@features/contracts/types';

export const test = mergeTests(kycTest).extend<{
  seedOnboardedContractor: (data: CreateContractRequest) => Promise<Contract>;
}>({
  seedOnboardedContractor: async ({}, use) => {
    const contracts = new ContractsClient(); await contracts.init();
    const kyc = new KycClient();             await kyc.init();
    const created: number[] = [];
    await use(async (data) => {
      const contract = await onboardContractor({ contracts, kyc }, data);
      created.push(contract.id);
      return contract;
    });
    for (const id of created) await contracts.delete(id).catch(() => {});
    await contracts.dispose();
    await kyc.dispose();
  },
});

export { expect } from '@playwright/test';
```

The consuming test sees **one** factory fixture — never three clients orchestrated by hand:

```typescript
test('contractor is fully onboarded @smoke', async ({ seedOnboardedContractor }) => {
  const contract = await seedOnboardedContractor({ /* … */ });
  expect(contract.status).toBe('ongoing');
});
```

## Pattern 4 — scaling to 4–5+ modules

The 2-module case (Pattern 3) and the 5-module case are **structurally identical** — `seeding.ts` helpers and `mergeTests` scale linearly. "First invoice paid" spans `auth + contracts + kyc + invoices + payments`. Owner = `features/payments/` (the final entity is a paid `Payment`). A higher-level helper composes the lower-level seeding helpers:

```typescript
// features/payments/seeding.ts
import { onboardContractor } from '@features/contracts/seeding';
import { generateFirstInvoice } from '@features/invoices/seeding';
import { ContractsClient } from '@features/contracts/client';
import { KycClient } from '@features/kyc/client';
import { InvoicesClient } from '@features/invoices/client';
import { PaymentsClient } from '@features/payments/client';

export async function payFirstInvoice(
  clients: { contracts: ContractsClient; kyc: KycClient; invoices: InvoicesClient; payments: PaymentsClient },
  input: FirstInvoicePaidInput,
) {
  const contract = await onboardContractor({ contracts: clients.contracts, kyc: clients.kyc }, input.contract);
  const invoice  = await generateFirstInvoice({ invoices: clients.invoices }, contract.id);
  return clients.payments.pay(invoice.id);
}
```

`features/payments/fixtures.ts` exposes a `seedPaidInvoice` factory fixture wrapping `payFirstInvoice` with cleanup. The spec **does not import** any client directly — it sees one factory fixture. If a spec destructures several clients and orchestrates them by hand, that is the signal to lift another seeding helper.

## Where does cross-module composition live?

Decide by **which entity it produces** — the entity the spec's final `expect()` targets:

| Business operation | Entity produced | Owner module (`seeding.ts`) |
|---|---|---|
| Onboarding a contractor | Contract | `features/contracts/seeding.ts` |
| Running payroll for a contract | Payment | `features/payments/seeding.ts` |
| Inviting a worker + KYC | Worker | `features/workers/seeding.ts` |
| First invoice paid end-to-end | Payment | `features/payments/seeding.ts` |

### Edge case: no clear owner (`features/_smoke/`)

If a scenario genuinely touches half the platform and asserts on no single entity (e.g. a sanity-check that all critical pages load after a deploy), create a cross-cutting module under the `_`-prefixed name:

```
features/_smoke/
├── seeding.ts                          # platformSmoke helpers
├── fixtures.ts                         # mergeTests of every module it touches
└── tests/api/platform-smoke.spec.ts
```

The underscore prefix sorts these on top in the file tree and signals "not a domain module — cross-cutting". This is the **exception**, not the rule. Most "cross-module" scenarios have an owner — find it before reaching for `features/_<name>/`.

## Page-level UI orchestration is **not** a seeding helper

A compound UI action — `LoginPage.login(email, password)` filling two fields, clicking a button, waiting for URL — is **part of POM v4**. It lives inside the page class and stays within one screen:

```typescript
// features/auth/pages/LoginPage.ts
async login(email: string, password: string): Promise<void> {
  await this.emailInput.fill(email);
  await this.passwordInput.fill(password);
  await this.signInButton.click();
  await this.page.waitForURL(url => !url.toString().includes('/login'));
}
```

Compare to a seeding helper / the `loginAs(role)` token helper: it takes a role, looks up credentials in `env`, calls the API client, returns a token. No DOM, no `page` fixture.

| | `LoginPage.login()` | `loginAs()` / seeding helper |
|---|---|---|
| Layer | POM (single-screen UI action) | API composition (`seeding.ts` / `base.fixture`) |
| Transport | DOM via `page` | HTTP via the API client |
| Caller | UI tests, UI fixtures | API tests, `base.fixture.ts` token setup, factory fixtures |

Both can exist for the same business action (logging in); they serve different test types.

## Dependency direction (DAG rule)

Will be enforced by ESLint in Phase 3 of the migration plan.

| File | May import | May NOT import |
|---|---|---|
| `features/<X>/client.ts` | `@core/*`, `@features/<X>/types` | `@features/<Y>/*` for any Y ≠ X — clients never compose clients |
| `features/<X>/seeding.ts` | `@core/*`, `@features/<X>/{client,types}`, **other modules' `client`/`seeding`** (owner-module composition) | — (composition is exactly what seeding is for; keep it a DAG, no cycles) |
| `features/<X>/pages/*.ts` | `@core/ui/BasePage` | `@features/<X>/client`, `@features/<Y>/*` — pages know nothing about HTTP or other modules |
| `features/<X>/fixtures.ts` | All of the above + `@fixtures` + other modules' `fixtures` via `mergeTests` | — |
| `features/<X>/tests/**/*.spec.ts` | `@features/<X>/fixtures` (or a merged test) + `@features/<X>/seeding` for direct API setup | Bare clients or page classes — go through the fixture (pages) or a seeding helper (composition) |

If a cycle forms (e.g. `auth/seeding.ts` imports from `contracts/seeding.ts` and vice versa), one of the dependencies must become a constructor/argument injected by a fixture instead of an import.

## When tests reach for many clients manually

If a test starts looking like:

```typescript
test('long scenario', async ({ authClient, contractsClient, kycClient, paymentsClient }) => {
  const token    = await loginAs('client');
  const contract = await contractsClient.create(token, …);
  await kycClient.completeFor(contract.id);
  await paymentsClient.processFor(contract.id);
});
```

That is the signal to lift the sequence into a seeding helper (probably `features/payments/seeding.ts → payForContract`) wrapped by a factory fixture, and turn the test into:

```typescript
test('long scenario', async ({ seedPaidContract }) => {
  const contract = await seedPaidContract({ /* … */ });
  expect(contract.payment.status).toBe('paid');
});
```
