---
id: d643c321-edc4-5b3d-8419-4389f51bf1dd
name: framework-architecture-plan
description: "Architecture plan for playwright-e2e — repository structure, layered design (Core / Clients+Builders / seeding / Pages+Fixtures / Tests), single config with projects[], no 3-lane, no Flow/Facade, code examples, role split frontoffice vs backoffice"
metadata:
  type: project
  category: architecture
  tags: ["playwright", "implementation", "plan", "roadmap", "layers", "typescript"]
---

# Architecture Plan: New QA Framework for RemotePass

> **Status:** Draft / Project Bible
> **Created:** 2026-05-13
> **Author:** Dmytro Kuznetsov (QA Automation Architect)

---

## What We Are Building and Why

The current framework (`test-framework`) works, but has structural issues: tests call HTTP clients directly, there is no business-scenario layer, fixtures do not leverage Playwright's capabilities, and data is created inside tests. This makes the code brittle and hard to scale.

The new repository `remotepass-qa` is built from scratch around these patterns:

1. ISTQB Three-Layer Architecture
2. API Composition — stateless `seeding.ts` helpers (no Flow/Facade layer; see [decisions/2026-06-17-dmytro-remove-flow-facade-layers.md](../30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md))
3. Builder Pattern
4. Fixture Pattern (Playwright `test.extend()` + factory state-fixtures + `mergeTests`)
5. Page Object Model v4 (injected via fixtures — DI)
6. API Client Pattern
7. Config Pattern (typed env access)

**Principles:**
- One Playwright runner for everything — both API tests and UI tests
- A test reads like a specification — no technical noise inside
- API clients are reused between API tests and data setup for UI tests
- Each new module is added without modifying existing code

---

## Repository Structure

> **Layout: feature-first.** Code is grouped by domain module, not by architectural layer.
> See [decisions/2026-05-22-dmytro-feature-first-layout.md](../30-decisions/2026-05-22-dmytro-feature-first-layout.md) for the rationale (supersedes the earlier layer-first sketch).

```
remotepass-qa/
│
├── core/                                ← infrastructure, no domain knowledge
│   ├── http/BaseApiClient.ts            #   Playwright APIRequestContext wrapper
│   ├── ui/BasePage.ts                   #   Playwright Page wrapper
│   ├── config/{env,endpoints}.ts        #   typed env access + URL constants
│   └── types/api.types.ts               #   shared HTTP/response shapes
│
├── fixtures/                            ← framework-wide Playwright test.extend()
│   ├── base.fixture.ts                  #   worker-scoped auth tokens per role (login once)
│   └── index.ts                         #   re-exports
│
├── features/                             ← one folder per domain module
│   └── {module-a}/
│       ├── client.ts                    #   API Client (Layer 1) — one method = one HTTP request
│       ├── types.ts                     #   request/response shapes + picklist types
│       ├── seeding.ts                   #   stateless API composition helpers (reused by API specs + fixtures)
│       ├── fixtures.ts                  #   module-specific test.extend() — extends baseTest
│       ├── builders/
│       │   ├── Create{Entity}Builder.ts #   one file per request shape (Create/Update/...)
│       │   └── Update{Entity}Builder.ts
│       ├── pages/
│       │   └── {Entity}Page.ts          #   POM v4 (Layer 2) — locators + actions, no expect()
│       └── tests/                       #   Layer 3 — specs colocated with the module
│           ├── api/*.spec.ts            #   API tests
│           └── ui/
│               ├── frontoffice/*.spec.ts
│               └── backoffice/*.spec.ts
│
├── utils/helpers/logger.ts              ← logVerbose primitive (called only from core/)
│
├── scripts/                             ← npx tsx utilities — NOT Playwright specs
│   └── {module-a}/seed-something.ts
│
├── .env.example
├── .nvmrc
├── .eslintrc.json
├── playwright.config.ts                 #   single config — three projects: api / frontoffice / backoffice
├── tsconfig.json
└── package.json
```

**Path aliases** (see `tsconfig.json`):

| Alias | Resolves to |
|---|---|
| `@core/*` | `core/*` |
| `@fixtures`, `@fixtures/*` | `fixtures/index.ts`, `fixtures/*` |
| `@features/*` | `features/*` (use as `@features/auth/client`, `@features/contracts/types`, etc.) |
| `@utils/*` | `utils/*` |

The old layer-first aliases (`@clients`, `@builders`, `@flows`, `@pages`, `@tests`) are gone.

> **Config rule:** One `playwright.config.ts` with `projects[]` — not multiple config files.
> The `projects[]` array covers every split needed: API vs UI, front-office vs back-office.
> See the [Playwright Config section](#playwright-config--one-file-three-projects) below for the full comparison.

### Where do the user roles live?

| UI | Users | Folder |
|---|---|---|
| **Front-office** | Contractor, Client | `features/<feature>/pages/frontoffice/`, `features/<feature>/tests/ui/frontoffice/` |
| **Back-office** | Admin | `features/<feature>/pages/backoffice/`, `features/<feature>/tests/ui/backoffice/` |
| **API** | Any role (token-driven) | `features/<feature>/client.ts`, `features/<feature>/tests/api/` |

`<feature>` is always a **user-facing capability** (`auth`, `contracts`, `expenses`, `time-tracking`, …), **never a backend microservice**. See [`30-decisions/2026-05-25-dmytro-feature-over-microservice-division.md`](../30-decisions/2026-05-25-dmytro-feature-over-microservice-division.md) for the rationale and the rule for cases where one feature spans multiple backend services.

---

## Layer 0: Core — Foundation

Nothing here is about RemotePass domains — only base mechanics.

### `core/types/api.types.ts`

```typescript
export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string>;
}
```

Every API client method explicitly declares what it returns:
```typescript
async getEntity(id: number): Promise<ApiResponse<EntityResponse>>
```

### Config Pattern — `core/config/env.ts`

**Why this pattern.**

In the old repo, `process.env.X` is read directly in `BaseAPI.ts`, `playwright.config.*`, `global-setup.ts`, `auth.fixture.ts`, `utils/database/db-config.ts`, and scattered test files — 10+ locations. There is no validation, no typed access, and a misspelled key silently becomes `undefined` and crashes at runtime, often deep inside a test, with no indication of which variable is missing.

The Config Pattern formalizes a single entry point for all environment variables: one module that loads `.env`, validates required keys, and exposes a typed `env` object. Every other file imports `env` — no file outside of `core/config/env.ts` may touch `process.env` directly.

**Old vs new:**

| | Old repo | New (`env.ts`) |
|---|---|---|
| Where env is read | Scattered across 10+ files | One module |
| Type safety | `string \| undefined` everywhere | All values typed at one place |
| Missing variable | Silently `undefined` → runtime crash | Throws at startup with the key name |
| Multi-environment (staging/prod) | Manual editing of `.env` per run | `ENV=staging` selects the right file |
| Discoverability | Grep across the repo | Open one file |

**Implementation** — includes multi-environment support via the `ENV` switch:

```typescript
// core/config/env.ts
import dotenv from 'dotenv';
import path from 'path';

// Selects which .env file to load: .env (default), .env.staging, .env.prod
const envName = process.env.ENV ?? 'local';
const envFile = envName === 'local' ? '.env' : `.env.${envName}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env variable: ${key} (env: ${envName})`);
  return value;
}

export const env = {
  envName,                                          // 'local' | 'staging' | 'prod'
  apiBaseUrl:       requireEnv('API_BASE_URL'),
  frontofficeUrl:   requireEnv('FRONTOFFICE_URL'),  // front-office UI (contractor + client)
  backofficeUrl:    requireEnv('BACKOFFICE_URL'),   // back-office UI (admin only)
  clientEmail:      requireEnv('CLIENT_EMAIL'),
  clientPassword:   requireEnv('CLIENT_PASSWORD'),
  workerEmail:      requireEnv('WORKER_EMAIL'),
  workerPassword:   requireEnv('WORKER_PASSWORD'),
  adminEmail:       requireEnv('ADMIN_EMAIL'),
  adminPassword:    requireEnv('ADMIN_PASSWORD'),
  e2eSecretKey:     process.env.E2E_SECRET_KEY,     // optional — no requireEnv
} as const;
```

**Usage rule:** No `process.env.X` anywhere in the codebase except inside `env.ts`. Anything else imports `env` from `@core/config/env`.

**Multi-environment usage:**

```bash
# default — reads .env
npx playwright test

# reads .env.staging
ENV=staging npx playwright test

# reads .env.prod
ENV=prod npx playwright test
```

Files committed to repo: `.env.example` (template only). Files gitignored: `.env`, `.env.staging`, `.env.prod` (real secrets).

### `core/config/endpoints.ts`

All URLs in one place:

```typescript
export const ENDPOINTS = {
  auth: {
    login:  '/api/auth/login',
    logout: '/api/auth/logout',
  },
  // module-a, module-b ... — added as modules are built
} as const;
```

### `core/http/BaseApiClient.ts`

```typescript
export class BaseApiClient {
  protected context!: APIRequestContext;
  protected baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL ?? env.apiBaseUrl;
  }

  async init(authToken?: string): Promise<void> { ... }
  async dispose(): Promise<void> { ... }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> { ... }
  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> { ... }
  async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> { ... }
  async delete<T>(url: string): Promise<ApiResponse<T>> { ... }
}
```

### `core/ui/BasePage.ts`

```typescript
export class BasePage {
  constructor(protected readonly page: Page) {}

  protected async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.waitForLoad();
  }

  protected async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}
```

---

## Layer 1: API Clients — Pure HTTP

**The key rule: one method = one HTTP request.**

If a method makes two requests — it belongs in a `seeding.ts` helper, not here.

```typescript
export class EntityClient extends BaseApiClient {
  async create(data: CreateEntityRequest): Promise<ApiResponse<EntityResponse>> {
    logVerbose('EntityClient.create');
    return this.post<EntityResponse>(ENDPOINTS.entity.create, data);
  }

  async getById(id: number): Promise<ApiResponse<EntityResponse>> {
    logVerbose('EntityClient.getById');
    return this.get<EntityResponse>(ENDPOINTS.entity.byId(id));
  }

  async delete(id: number): Promise<ApiResponse<void>> {
    logVerbose('EntityClient.delete');
    return this.delete<void>(ENDPOINTS.entity.byId(id));
  }
}
```

---

## Layer 1: Builders — Data Without Magic

**The key rule: Builder only creates data, it never makes HTTP calls.**

**Why Builder instead of plain objects or factory functions.**

In the old repo, test data is created with factory functions like `generateFixedContractData(ownerId, templateId, iso, attrs, 2, 3)` — positional arguments with no self-documentation, and every caller must know every parameter. As the number of test scenarios grows (different currencies, payment cycles, edge cases), this becomes hard to read and hard to maintain.

Builder solves this with a fluent API: each method has a meaningful name, defaults are built in, and you only specify what is relevant for the current test.

**What the builder produces.** Example contract payload:

```typescript
// Output of .build() — a plain object ready to POST
{
  name:           "Auto Fixed Contract",
  currency_code:  "USD",       // default
  amount:         3000,        // default
  payment_cycle:  "monthly",   // explicitly set
}
```

**Example 1 — build from scratch (all defaults):**

```typescript
const data = new ContractBuilder().build();
// → { name: "Auto Fixed Contract", currency_code: "USD", amount: 3000, payment_cycle: "monthly" }
```

**Example 2 — static base, variable fields per test scenario:**

```typescript
// First two fields are always the same across this test suite
const base = new ContractBuilder()
  .withName('Salary Contract')
  .withCurrency('AED');        // always AED in this suite

// Scenario A — weekly cycle
const weeklyContract = base.withPaymentCycle('weekly').build();

// Scenario B — monthly cycle with a higher amount
const monthlyContract = base.withPaymentCycle('monthly').withAmount(8000).build();
```

Implementation:

```typescript
const defaults: ContractData = {
  name:          'Auto Fixed Contract',
  currency_code: 'USD',
  amount:        3000,
  payment_cycle: 'monthly',
};

export class ContractBuilder {
  private data: Partial<ContractData> = {};

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withCurrency(code: 'USD' | 'AED' | 'EUR'): this {
    this.data.currency_code = code;
    return this;
  }

  withAmount(amount: number): this {
    this.data.amount = amount;
    return this;
  }

  withPaymentCycle(cycle: 'monthly' | 'weekly' | 'biweekly' | 'twice_a_month'): this {
    this.data.payment_cycle = cycle;
    return this;
  }

  build(): ContractData {
    return { ...defaults, ...this.data };
  }
}
```

---

## Layer 1→2: Composition — `seeding.ts` (stateless helpers)

**The key rule: a `seeding.ts` helper combines multiple client calls into one reusable business sequence. It is stateless — no `expect`, no browser, no lifecycle.**

There is no Flow/Facade layer (see [decisions/2026-06-17-dmytro-remove-flow-facade-layers.md](../30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md)). The same helper is called directly by API specs and wrapped by a factory state-fixture for UI preconditions — cleanup is the fixture's job, not the helper's.

```typescript
// features/<feature>/seeding.ts
export async function createAndActivateEntity(
  clients: { entities: EntityClient; related: RelatedResourceClient },
  data: EntityData,
): Promise<{ entityId: number }> {
  logVerbose('seeding.createAndActivateEntity');
  const { body: entity } = await clients.entities.create(data);
  await clients.related.attach(entity.id);
  await clients.entities.activate(entity.id);
  return { entityId: entity.id };
}
```

---

## Layer 2: Pages — Page Object Model v4

POM evolved through four generations. Playwright's `test.extend()` fixture system made the clean separation in v4 practical — each layer (fixture, page, test) now has a single responsibility enforced by the framework itself.

| Version | What changed |
|---------|-------------|
| v1 | Locators + actions + assertions all in one class |
| v2 | `BasePage` introduced, duplication removed |
| v3 | `expect()` moved out of page classes; pages do actions only |
| v4 | Playwright fixtures (`test.extend()`) handle setup/teardown — pages focus purely on locators and actions, tests focus purely on assertions |

**Two rules:**
1. No `expect()` inside page classes — only locators and actions
2. No `page.goto()` inside tests — only through a page method

```typescript
export class EntityListPage extends BasePage {
  readonly createButton = this.page.getByTestId('create-btn');
  readonly rows = this.page.locator('[data-testid="entity-row"]');

  async open(): Promise<void> {
    await this.goto('/entities');
  }

  async clickCreate(): Promise<void> {
    await this.createButton.click();
  }
}
```

---

## Layer 2→3: Fixtures — Playwright test.extend()

**Why this is different from what we had before.**

In the old repo, `fixtures/auth/auth.fixture.ts` is just a plain TypeScript class with static methods — it has nothing to do with Playwright's fixture system. Setup and teardown were done manually in every test file via `beforeAll` / `afterAll`, and every test had to know how to set up and clean up its own context.

With `test.extend()`, Playwright owns the lifecycle. The test receives ready-to-use dependencies as arguments and never sees setup or cleanup code — that lives in the fixture definition once, and Playwright runs it automatically before and after each test (or once per worker, depending on scope).

| | Old approach | `test.extend()` |
|---|---|---|
| Auth | `AuthFixture.getAPIAsClient()` called in `beforeAll` | `clientToken` injected automatically |
| Cleanup | `afterAll` in every test file | Runs after `await use(...)` in fixture |
| Scope control | Manual | `{ scope: 'worker' }` or `'test'` |
| Test readability | Test knows about setup | Test only describes the scenario |

```typescript
export const test = base.extend<ApiFixtures, WorkerFixtures>({

  // One token per role — login once per parallel worker
  clientToken:     [authTokenFor('client'),     { scope: 'worker' }],   // front-office: client
  contractorToken: [authTokenFor('contractor'), { scope: 'worker' }],   // front-office: contractor
  adminToken:      [authTokenFor('admin'),      { scope: 'worker' }],   // back-office:  admin

  // Factory state-fixture: wraps the stateless seeding helper and adds cleanup.
  seedEntity: async ({ clientToken }, use) => {
    const client = new EntityClient();
    await client.init(clientToken);
    const related = new RelatedResourceClient();
    await related.init(clientToken);
    const createdIds: number[] = [];

    await use(async (data) => {
      const result = await createAndActivateEntity({ entities: client, related }, data);
      createdIds.push(result.entityId);
      return result;
    });

    for (const id of createdIds) {
      await client.delete(id).catch(() => {});
    }
    await client.dispose();
    await related.dispose();
  },

  entityBuilder: async ({}, use) => {
    await use(new EntityBuilder());
  },
});

export { expect } from '@playwright/test';
```

---

## Layer 3: Tests — Read Like Specifications

**Why tests look different from the old repo.**

In the old repo, every test file is responsible for its own setup and teardown. A typical test has `beforeAll` that logs in, creates an API instance, and sometimes creates prerequisite data — and `afterAll` that cleans up. The actual test case is buried inside all of that.

In this architecture, a test has exactly one job: describe a scenario and assert the outcome. Everything else is handled by layers below.

| | Old repo | This architecture |
|---|---|---|
| Authentication | `beforeAll` in every file | Injected via fixture, runs once per worker |
| Data setup | Inside the test or `beforeAll` | `seedEntity` factory fixture — one line in the test |
| Cleanup | `afterAll` in every file | Handled automatically after `await use(...)` in fixture |
| What the test reads like | Setup + action + assertion mixed | Action + assertion only |

**API test:**
```typescript
test('creates entity @smoke', async ({ seedEntity, entityBuilder }) => {
  const data = entityBuilder.withField('value').withOption('option-a').build();
  const { entityId } = await seedEntity(data);
  expect(entityId).toBeDefined();
});
```

**UI test — API prepares data, page does UI:**
```typescript
test('shows entity in the list @smoke', async ({ entityListPage, seedEntity, entityBuilder }) => {
  const data = entityBuilder.withField('value').build();
  await seedEntity(data);
  await entityListPage.open();
  await expect(entityListPage.rows).toHaveCount(1);
});
```

---

## Test Tags

| Tag | Meaning |
|-----|---------|
| `@smoke` | Critical fast tests, < 5 min — run per-commit |
| `@regression` | Full regression — nightly |
| `@critical` | Must-pass, block deployments |
| `@deep` | Extreme edge cases — on demand |
| `@slow` | Long-running — excluded from smoke |

---

## Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "paths": {
      "@core/*":     ["./core/*"],
      "@fixtures":   ["./fixtures/index.ts"],
      "@fixtures/*": ["./fixtures/*"],
      "@features/*":  ["./features/*"],
      "@utils/*":    ["./utils/*"]
    }
  }
}
```

Within a module, code references its peers as `@features/<domain>/client`, `@features/<domain>/types`, etc.

---

## Playwright Config — One File, Three Projects

**Why one config, not three.**

The old repo has three separate config files (`playwright.config.ts`, `playwright.config.api.ts`, `playwright.config.ui.ts`). This is a common pattern teams arrive at organically, but Playwright's own best-practice recommendation is a single config with a `projects[]` array. Here is why:

| | Three config files (old repo) | One config + `projects[]` |
|---|---|---|
| Shared settings (timeout, retries, reporter) | Duplicated in every file — easy to drift out of sync | Defined once at the top level, inherited by all projects |
| Running a subset | `npx playwright test --config playwright.config.api.ts` | `npx playwright test --project api` |
| CI matrix | Three separate commands to maintain | One command, filter by `--project` |
| Adding a new environment (e.g. staging) | Copy + edit another config file | Add one entry to `projects[]` |
| Playwright tooling (UI mode, trace viewer) | Works per-config only | Works across all projects in one session |

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { env } from '@core/config/env';   // Config Pattern — single typed entry point

export default defineConfig({
  testDir: './features',
  fullyParallel: true,
  reporter: [['html'], ['list']],

  projects: [
    // API tests — no browser
    {
      name: 'api',
      testMatch: '**/features/**/tests/api/**/*.spec.ts',
    },

    // Front-office UI — contractor + client
    {
      name: 'frontoffice',
      testMatch: '**/features/**/tests/ui/frontoffice/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: env.frontofficeUrl,
      },
    },

    // Back-office UI — admin only
    {
      name: 'backoffice',
      testMatch: '**/features/**/tests/ui/backoffice/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: env.backofficeUrl,
      },
    },
  ],
});
```

> **Note:** `playwright.config.ts` follows the Config Pattern just like every other file — it imports `env` instead of reading `process.env` directly. `env.ts` calls `dotenv.config()` internally, so `.env` is loaded before any value is read.

**Run commands:**

```bash
npx playwright test                        # all projects
npx playwright test --project=api          # API tests only
npx playwright test --project=frontoffice  # front-office UI only
npx playwright test --project=backoffice   # back-office UI only
npx playwright test --grep @smoke          # smoke across all projects
```

---

## What We Take from the Old Repo as Reference

> **Note:** The mapping below is a preliminary draft and has not been verified in detail.
> Before any migration begins, the old repo needs a deeper review to understand exactly what is worth carrying over, what should be rewritten from scratch, and what can be dropped entirely.
> Treat this table as a starting point for discussion, not a final decision.

| Source | What We Take |
|--------|-------------|
| `BaseAPI.ts` | init/dispose logic, HTTP methods — rewrite with generics |
| `*API.ts` classes | Endpoint list, signatures — rewrite into `clients/` |
| `utils/constants/` | Constants inventory — rewrite into `core/config/` |
| `logger.ts` | logVerbose pattern — carry over as-is |
| `*-faker.ts` | Generation logic — wrap into Builder classes |
| `utils/types/` | TypeScript types — carry over and extend |

---

## Implementation Order

### Phase 1 — Scaffold
1. `git init`, `package.json`, `tsconfig.json` with path aliases
2. Single `playwright.config.ts` with three projects: `api`, `frontoffice`, `backoffice`
3. `.nvmrc`, `.env.example`, `.eslintrc.json`
4. `core/types/api.types.ts`
5. `core/config/env.ts` and `endpoints.ts`
6. `core/http/BaseApiClient.ts`
7. `core/ui/BasePage.ts`
8. `fixtures/base.fixture.ts` — authentication
9. `fixtures/index.ts`

Done criteria: `tsc --noEmit` passes with no errors.

### Phase 2 — First Module (to be chosen)
`client → builder → seeding → fixture → tests`

The first module will be chosen based on what gives the team the most value first — likely the simplest domain that exercises both API and UI lanes end-to-end.

Done criteria: tests run and pass. Show to the team, discuss migration path.

### Phase 3+
Each subsequent module follows the same pattern. Order is decided as priorities emerge — not pre-locked here.

> **Module split strategy — resolved 2026-05-25:** `features/<feature>/` is keyed by **user-facing feature**, never by backend microservice. This holds throughout the ongoing monolith → microservices migration on the backend. See [`30-decisions/2026-05-25-dmytro-feature-over-microservice-division.md`](../30-decisions/2026-05-25-dmytro-feature-over-microservice-division.md) for the rationale, the two-axes rule (tests by feature, API clients may follow service boundaries), and the answer for cases where one feature spans multiple services.

---

## Scalability: How to Add a New Module

Create one folder under `features/<domain>/`:

```
features/<domain>/
├── client.ts                          # Layer 1 — HTTP
├── types.ts                           # request/response + picklist types
├── seeding.ts                         # stateless API composition helpers
├── fixtures.ts                        # extends baseTest with module-specific fixtures (DI pages + factory state-fixtures)
├── builders/Create<Entity>Builder.ts  # one file per request shape
├── pages/<Entity>Page.ts              # POM v4 (if UI)
└── tests/
    ├── api/*.spec.ts
    └── ui/{frontoffice,backoffice}/*.spec.ts
```

**No existing file is modified when adding a new module.** Tests import everything from `@features/<domain>/fixtures`.
