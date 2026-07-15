# Workshop: from test case to autotest

**Case:** the `expenses` feature (contractor expenses). Chosen deliberately: only 7 tests, the smallest
feature, **no blockers**, the scenario doc and architecture-mapping are **already written**, a clear CRUD story.
Deterministic — does not depend on sandbox/network.

## The chain (in one line)

```
Legacy test  →  Scenario (intent)  →  Architecture-mapping (plan)  →  Artifacts by layer  →  Run
 what exists      what we verify           where it lands            client/seeding/page/test    tsc + test
```

This is exactly what the agentic pipeline does
(`scenario-extraction → architecture-mapping → page-object/fixture → migration → review`),
we just show it step by step and manually.

---

## Step 0 — Where we take intent from, not code

**I say:** we are NOT porting the legacy line by line. We extract *what* the test verifies and reassemble it on
the new architecture. That is why the first artifact is not code, but a description of intent.

---

## Step 1 — Test case (legacy, "as is")

**Open:** `tests/modules/expenses/ui/verify/expense-crud.spec.ts`

```typescript
import { test } from '@playwright/test';
import { UIFixture } from '@fixtures/ui/ui.fixture';
import { ExpensesPage } from '@pages/features/expenses/ExpensesPage';
import { ExpenseDetailsPanel } from '@pages/features/expenses/ExpenseDetailsPanel';
import { generateExpenseData } from '@fixtures/data/expense-faker';
import { EXPENSE_STATUS } from '@utils/constants/expenses.constants';

test.describe('Expenses - CRUD @ui @regression', () => {
  let expensesPage: ExpensesPage;
  let detailsPanel: ExpenseDetailsPanel;
  const createdExpenseNames: string[] = [];

  test.beforeEach(async ({ page }) => {
    expensesPage = new ExpensesPage(page);
    detailsPanel = new ExpenseDetailsPanel(page);
    await UIFixture.loginWorkerViaAPI(page);
    await expensesPage.goto();
  });
  // ... manual beforeEach/afterEach, best-effort cleanup through the UI, asserts inside the page object
});
```

**What to pay attention to (what is bad in the legacy):**
- Manual `beforeEach` + `new Page(...)` in every test.
- Best-effort data cleanup through the UI (fragile).
- Monolithic `UIFixture` with static methods.
- The page object in places contains `expect`.

---

## Step 2 — Extracting intent (scenario doc)

**Open:** `docs/test-migration/scenarios/expenses.md`

Framework-agnostic, **without Playwright syntax**. Exactly 7 mandatory H2 headings:

```
## User intent
## Preconditions
## Steps (intent only)
## Expected outcome
## Edge cases / variants
## Domain notes
## Migration decision
```

For example, `## User intent`:
> As a contractor (worker), I want to view my submitted expenses, create a new expense with an
> amount, category, date and receipt, inspect details, and delete a pending expense — so I can
> manage reimbursable costs on my contract.

And `## Migration decision`:
> Rewrite all three product specs into the feature-first layout under `features/expenses/`. Merge list
> and CRUD specs. Replace manual beforeAll/afterAll with fixture-driven setup and auto-cleanup. Back
> data creation with ExpensesAPI/flow rather than driving the modal for setup.

**I say:** this is precisely the "flow/plan" that we take from the old one. It will outlive any refactoring
of the UI and the test code.

---

## Step 3 — The plan: where this lands (architecture-mapping)

**Open:** `docs/test-migration/architecture-mapping.md` (the expenses section)

Legacy → new table:

| Legacy artifact | New target (feature-first) | Decision |
|---|---|---|
| `ui/verify/expenses-list.spec.ts` | `features/expenses/tests/frontoffice/expenses.ui.spec.ts` (merged) | rewrite + merge |
| `ui/verify/expense-crud.spec.ts` | `features/expenses/tests/frontoffice/expenses.ui.spec.ts` (merged) | rewrite + merge |
| `pages/.../ExpensesPage.ts` | `features/expenses/pages/frontoffice/ExpensesPage.ts` (POM v4) | rewrite (drop expect) |
| `pages/.../ExpenseDetailsPanel.ts` | `features/expenses/pages/frontoffice/ExpenseDetailsPanel.ts` | rewrite |
| `pages/.../AddExpenseModal.ts` | `features/expenses/pages/frontoffice/AddExpenseModal.ts` | rewrite |
| `fixtures/data/expense-faker.ts` | `features/expenses/builders/expense.builder.ts` | rewrite as Builder |
| `fixtures/ui/ui.fixture.ts` (loginWorkerViaAPI) | `fixtures/base.fixture.ts` + `features/expenses/fixtures.ts` | rewrite (split monolith) |
| `services/api/modules/expenses/ExpensesAPI.ts` | `features/expenses/client.ts` | rewrite (typed `ApiResponse<T>`) |

**Gaps that must be closed before rewriting (from the mapping):**
- There is no expenses fixtures/builder module on the new architecture.
- Cleanup must become reliable — through the `ExpensesAPI` flow, not UI deletion.
- `ExpensesAPI` is not yet wrapped as a typed `client.ts`.
- There is no worker-scoped login fixture for the worker role.

---

## Step 4 — Generating artifacts by layer (mirroring the `auth` module)

Target module layout:

```
features/expenses/
├── client.ts                       # typed API client (ApiResponse<T>)
├── builders/expense.builder.ts     # fluent test data, no HTTP
├── fixtures.ts                     # role-scoped + auto-cleanup
├── pages/frontoffice/
│   ├── ExpensesPage.ts             # POM v4 — no expect
│   ├── ExpenseDetailsPanel.ts
│   └── AddExpenseModal.ts
└── tests/frontoffice/expenses.ui.spec.ts   # 3 legacy specs → one, on fixtures
```

Each layer repeats the shape of `auth` (see `01-architecture-rationale.md`):
- **client.ts** — `export class ExpensesClient extends BaseApiClient { addExpense(...) ... }`,
  one method = one request, a typed response.
- **fixtures.ts** — `baseTest.extend<ExpensesFixtures>({ expensesClient, seedExpense, expensesPage })` (factory state-fixture + DI pages)
  with `init → use → dispose`.
- **tests** — only the fixture declaration + actions + `expect`; setup/teardown and cleanup live in
  the fixtures.

**I say:** note — we create the data for the test through a `client`/`seeding` helper (fast, reliable), not
by clicking the modal for the sake of setup. Cleanup is automatic through the factory fixture.

---

## Step 5 — Verifying

```bash
cd playwright-e2e
npm run typecheck          # tsc --noEmit — the compiler catches broken imports/types
npm run test:ui:frontoffice -- expenses    # run the spec (optional, live)
```

**What to highlight at the end:**
- No manual setup/teardown — everything is in the fixtures.
- No manual cleanup through the UI — auto-cleanup.
- Typed responses instead of `any`.
- Clean page objects (without `expect`).
- 3 legacy specs → one readable spec, on fixtures.

---

## Where the agentic system and gates fit here

The same path is automated by the agent pipeline, with a human at the key points:
- **CP-3 (HITL):** before launching a migration batch — plan approval (which 3–5 tests, which files).
- **G6:** before writing `client.ts` the agent cross-checks the endpoints against the API spec (`rp-search`/`rp-show`).
- **G2/G3:** before the commit — `tsc --noEmit` + green verify tests.
- **CP-5 (HITL):** before push/PR — authorization, with the attached `graphify prs --conflicts` and
  `get_pr_impact`.

In other words, the workshop is the "manual" version of a single pass of the agentic pipeline.
