# Architecture and patterns — why it's built this way

The core idea: **scale without losing quality**. To achieve this, the framework is assembled from small
composable building blocks, separated into layers, with dependencies pointing strictly in one direction.

```
┌─────────────────────────────────────────────────────────┐
│  Tests        — specification only (declare, execute,     │  knows about everything below
│                 assert)                                   │
├─────────────────────────────────────────────────────────┤
│  Fixtures     — lifecycle, injection, auto-cleanup        │
├─────────────────────────────────────────────────────────┤
│  seeding / Pages — API composition and UI orchestration   │
├─────────────────────────────────────────────────────────┤
│  Clients / Builders — 1 method = 1 request; test data     │
├─────────────────────────────────────────────────────────┤
│  Core         — HTTP, config, types, BasePage             │  knows nothing about anything above
└─────────────────────────────────────────────────────────┘
        dependencies point only DOWN (DAG, no cycles)
```

---

## Layer 1 — Core (the foundation)

**What:** `core/http/BaseApiClient.ts`, `core/config/env.ts`, `core/config/endpoints.ts`,
`core/types/api.types.ts`, `core/ui/BasePage.ts`.

**Responsibility:** technical infrastructure only — HTTP mechanics, typed access to env,
endpoint constants, the base page class, the `ApiResponse<T>` wrapper.

**Why:**
- One entry point to HTTP, one env parser, one logging layer → no duplication.
- Consistency: every request goes through `BaseApiClient` → unified logging and response handling.
- Isolation: tests **never** read `process.env` directly; access is typed and validated at
  startup. A typo like `env.clientEmial` simply won't compile.

**Dependency direction:** Core **knows nothing** about features and tests. Zero "upward" dependencies.

```typescript
// core/config/env.ts — validation at startup, catch configuration errors before tests run
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env variable: ${key} (env: ${envName})`);
  }
  return value;
}
```

---

## Layer 2 — Clients and Builders

### Clients (`features/<feature>/client.ts`)
**Rule:** one method = one HTTP request, typed `ApiResponse<T>` (no `any`).
Imports only `@core` + its own types. Does **not** import clients of other modules — that's
the job of the seeding layer.

```typescript
// features/auth/client.ts
export class AuthClient extends BaseApiClient {
  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    return this.post<LoginResponse>(ENDPOINTS.auth.login, { email, password });
  }
  async logout(): Promise<ApiResponse<void>> {
    return this.post<void>(ENDPOINTS.auth.logout);
  }
}
```

**Why:** atomicity (each request is tested independently), reuse (one client — in
seeding helpers, fixtures, and elsewhere), type safety.

### Builders (`features/<feature>/builders/`)
**Rule:** fluent creation of test data **without HTTP** and without side effects.

```typescript
new CreateContractBuilder().withCurrency('USD').withAmount(3000).build();
```

**Why:** DRY, self-documenting, no hidden side effects.

---

## Layer 3 — seeding and Pages

### seeding (`features/<feature>/seeding.ts`) — API composition (no Flow/Facade)

> Flow/Facade have been removed as a layer — see [`../../30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md`](../../30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md).

**Rule:** stateless functions that assemble several client calls into one reusable scenario.
No `expect`, no `page`, no cleanup (cleanup is the fixture's concern). They may compose clients/seeding
of **other** modules (the owner-module rule).

```typescript
// features/expenses/seeding.ts — stateless composition
export async function createExpenseViaApi(
  clients: { expenses: ExpensesClient; contracts: ContractsClient },
  data: ExpenseFormData,
): Promise<SeededExpense> {
  const contractId = await resolveFirstContractId(clients.contracts);
  const categories = await clients.expenses.getCategories(contractId);
  const photo      = await clients.expenses.uploadReceipt(RECEIPT_PATH);
  const id = await clients.expenses.addExpense({ contract_id: contractId, /* … */, photo });
  return { id, name: data.name, amount: data.amount, contractId };
}
```

**Why:**
- Tests read like requirements: `seedExpense(data)` instead of a set of low-level calls.
- **Reuse between API and UI:** the API spec calls the same function directly, while the UI test calls it
  via the `seedExpense` factory fixture, which adds cleanup.
- "Dynamic" fixtures = **factory fixtures**: the fixture returns a function, and the test calls it with runtime data.
- Refactoring signal: *"if a test pulls in many clients by hand — extract the chain into `seeding.ts` and
  wrap it in a factory fixture"* (`docs/20-engineering/composition-patterns.md`).

### Pages / POM v4 (`features/<feature>/pages/`)
**Rule:** locators + actions only. **No `expect`** in a Page and **no `goto`/`page.fill`** in
tests.

```typescript
// features/auth/pages/LoginPage.ts — locators + actions, no assertions
readonly emailInput   = this.page.getByPlaceholder('Email');
readonly signInButton = this.page.getByRole('button', { name: 'Sign in', exact: true });

async login(email: string, password: string): Promise<void> {
  await this.emailInput.fill(email);
  await this.passwordInput.fill(password);
  await this.signInButton.click();
  await this.page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30_000 });
}
```

**Why seeding and Page are different layers:** different transport (HTTP vs browser), different entry (role vs
email/password), different caller (API test/fixture vs UI test). Locators live in one place —
when the UI changes, we fix the Page, not dozens of tests.

---

## Layer 4 — Fixtures

**What:** `fixtures/base.fixture.ts` (cross-cutting) + `features/<feature>/fixtures.ts` (per module).

**Responsibility:** lifecycle (init → use → dispose), injection of dependencies into the test,
auto-cleanup. Login is at the worker level (once per parallel worker).

```typescript
// features/auth/fixtures.ts
export const test = baseTest.extend<AuthTestFixtures>({
  authClient: async ({}, use) => {
    const client = new AuthClient();
    await client.init();
    await use(client);
    await client.dispose();          // auto-cleanup guaranteed
  },
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); }, // DI page
  // factory fixtures (e.g. seedExpense) live in modules with reusable preconditions
});
```

**Why:**
- Guaranteed teardown — tests don't need manual cleanup.
- The test **declares** what it needs (`{ loginPage, seedExpense }`) rather than creating it itself.
- Cross-module composition via `mergeTests()`:
  ```typescript
  const test = mergeTests(authTest, contractsTest);
  test('...', async ({ loginPage, seedContract }) => { /* ... */ });
  ```

---

## Layer 5 — Tests (the specification)

**Rule:** only declare fixtures, perform the operation, and assert the result. No setup/teardown,
no creating clients/pages, no `page.goto`.

```typescript
// features/auth/tests/api/auth.spec.ts
import { test, expect } from '@features/auth/fixtures';
import { loginAs } from '@fixtures/base.fixture';

test('logs in as client and gets a token @smoke', async () => {
  const token = await loginAs('client');
  expect(token).toBeDefined();
  expect(token.length).toBeGreaterThan(20);
});
```

**Why:** the test becomes a readable specification of behavior. `expect()` lives **only** here.

---

## Dependency direction table (DAG)

| File | May import | May NOT import |
|------|---------------------|------------------------|
| `client.ts` | `@core/*`, its own types | clients of other modules |
| `seeding.ts` | `@core/*`, its own client, its own types, **client/seeding of other modules** (owner module) | — |
| `pages/*.ts` | `@core/ui/BasePage` | any HTTP, other modules |
| `fixtures.ts` | everything (this is the wiring layer) | — |
| `tests/**/*.spec.ts` | fixtures of its own module (or `mergeTests()`) | "bare" clients/pages |

This is **SOLID / dependency inversion** in action: upper layers depend on lower ones, while lower ones do
not know about the upper ones. The dependency graph is a DAG, with no cycles. Any module can be removed and the rest
will still compile.

---

## Patterns and rationale (summary)

| Pattern | Why |
|---------|-------|
| **Three-layer** (Foundation / Orchestration / Spec) | Separation of responsibilities; tests-as-requirements; reuse of business logic |
| **seeding (API composition)** | Hides complexity; one scenario is used in both API and UI; scales to multi-module via factory fixtures + mergeTests (no Flow/Facade) |
| **Builder** | Declarative test data without HTTP and side effects |
| **Fixture** (`test.extend`) | Standard Playwright mechanism; guaranteed cleanup; worker-scoped login; type-safe injection |
| **POM v4** | Locators/waits in one place; tests are readable; assertions only in tests |
| **Typed API Client** | `ApiResponse<T>` instead of `any`; easy to compose; reusable |
| **Single typed Config** | All env vars validated at startup; type-safe; a single point of change |
| **Feature-first layout** | Tests follow the user, not the backend services; survive service refactoring |

---

## Scaling without losing quality

- Small composable building blocks: adding a feature = adding a module of the same shape
  (client / seeding / pages / fixtures / builders / tests).
- Cross-module composition via `mergeTests` + constructor injection scales to
  multi-module scenarios **without changing the pattern**.
- Layer boundaries (planned: ESLint boundary rules) catch violations automatically — quality does not depend
  on the discipline of each individual author.

---

## One framework, one runner

**The legacy problem:** separate configs/runners for API and UI → duplication (two sets of fixtures, two
entry points).

**The solution:** a single `playwright.config.ts` with three projects.

```typescript
projects: [
  { name: 'api',         testMatch: '**/features/**/tests/api/**/*.spec.ts' },
  { name: 'frontoffice', testMatch: '**/features/**/tests/ui/frontoffice/**/*.spec.ts',
    use: { ...devices['Desktop Chrome'], baseURL: env.frontofficeUrl } },
  { name: 'backoffice',  testMatch: '**/features/**/tests/ui/backoffice/**/*.spec.ts',
    use: { ...devices['Desktop Chrome'], baseURL: env.backofficeUrl } },
]
```

**Why a single runner:**
1. **Reuse of business logic:** seeding helpers are written once and work in both API and UI tests.
2. **A single base fixture:** the worker-scoped token cache eliminates repeated logins.
3. **A single lifecycle:** context, logging, screenshots, and trace are configured once.
4. **Less duplication:** one `env.ts`, one set of builders, one set of clients.
5. **Natural composition:** `mergeTests()` works the same way for API and UI.

The decision is recorded in `docs/30-decisions/2026-05-15-dmytro-single-config-projects.md`:
> «Multiple config files are not idiomatic Playwright. The `projects[]` array is the official
> mechanism for this split.»
