---
name: test-data-strategy
description: >
  Test data management skill for Playwright TypeScript. Use whenever setting
  up test data, creating factories, handling data cleanup, or avoiding data
  conflicts. Trigger for: "set up test data", "create data factory",
  "test keeps failing because data exists", "data conflicts in parallel tests",
  "how to seed test data", "faker setup". Always use before writing beforeEach
  or afterEach blocks.
---

# Test Data Strategy Skill

---

## The 3 Rules of Test Data

```
1. CREATE  → always via API in beforeEach (never rely on existing data)
2. USE     → faker for unique values every run
3. DESTROY → always via API in afterEach (never leave dirty data)
```

---

## Data Factory Pattern

```typescript
// tests/helpers/testData.factory.ts
import { faker } from '@faker-js/faker';

export const EmployeeFactory = {
  build: (overrides = {}) => ({
    firstName:    faker.person.firstName(),
    lastName:     faker.person.lastName(),
    email:        faker.internet.email(),
    department:   faker.helpers.arrayElement(['Engineering', 'Product', 'Design', 'Finance']),
    salary:       faker.number.int({ min: 50000, max: 150000 }),
    dateOfJoining: faker.date.past().toISOString().split('T')[0],
    active:       true,
    ...overrides,   // allow test-specific overrides
  }),
};

export const ContractFactory = {
  build: (overrides = {}) => ({
    name:      faker.company.name(),
    type:      'milestone',
    currency:  'USD',
    startDate: faker.date.future().toISOString().split('T')[0],
    ...overrides,
  }),
};

export const MilestoneFactory = {
  build: (overrides = {}) => ({
    title:   faker.lorem.words(3),
    amount:  faker.number.int({ min: 500, max: 50000 }),
    dueDate: faker.date.future().toISOString().split('T')[0],
    ...overrides,
  }),
};
```

---

## When to Use Each Strategy

| Scenario | Strategy |
|---|---|
| Unique emails, names, amounts | faker |
| Specific business scenario (amount = 0) | faker + override |
| Pre-existing record needed | API create in beforeEach |
| Checking "not found" scenario | don't create, use random ID |
| Performance test | fixed seed data |
| Date-sensitive test | fixed date string, not faker |

---

## API Seeding Pattern

```typescript
// tests/fixtures/api.fixture.ts
import { test as base, APIRequestContext } from '@playwright/test';

type ApiFixtures = {
  apiContext: APIRequestContext;
  createdEmployee: { id: string; data: Record<string, unknown> };
};

export const test = base.extend<ApiFixtures>({
  createdEmployee: async ({ request }, use) => {
    // CREATE before test
    const data = EmployeeFactory.build();
    const res = await request.post('/api/employees', { data });
    expect(res.ok()).toBeTruthy();
    const employee = await res.json();

    // USE in test
    await use({ id: employee.id, data });

    // DESTROY after test
    await request.delete(`/api/employees/${employee.id}`).catch(() => null);
  },
});
```

---

## Parallel Test Safety

```typescript
// ❌ Conflicts in parallel — same email used by multiple workers
const email = 'test@example.com';

// ✅ Always unique per run
const email = faker.internet.email(); // user123abc@gmail.com
const email = `test-${Date.now()}@example.com`; // test-1712345678@example.com
```

---

## Fixed vs Dynamic Data

```typescript
// Use FIXED data when:
// — testing exact validation (max length = 50)
const longName = 'A'.repeat(51); // exactly 51 chars

// — testing specific business rules
const salary = 0; // testing minimum salary validation
const amount = -1; // testing negative number rejection

// Use FAKER when:
// — uniqueness required (email, username)
// — content doesn't affect outcome (name, address)
// — need variety across test runs
```

---

## Mandatory Cleanup Pattern — Follow expense-crud.spec.ts (Point 3)

Every test that creates data MUST clean it up. Follow this exact pattern:

```typescript
// ✅ The exact pattern from expense-crud.spec.ts
const createdExpenseNames: string[] = []; // track ALL created resources

test.beforeEach(async ({ page }) => {
  expensesPage = new ExpensesPage(page);
  await UIFixture.loginWorkerViaAPI(page);
  await expensesPage.goto();
  await expensesPage.verifyOnExpensesPage();
});

test.afterEach(async () => {
  // Delete every resource created during the test
  for (const name of createdExpenseNames) {
    await expensesPage.deleteExpenseIfExists(name);
  }
  createdExpenseNames.length = 0; // IMPORTANT: reset the array
});

// In each test — push to tracker immediately when creating
test('Should create expense @regression', async ({ page }) => {
  const expenseName = faker.commerce.productName();
  createdExpenseNames.push(expenseName); // track BEFORE creating
  await expensesPage.createExpense({ name: expenseName });
});
```

**Key rules:**
- Track resource name/ID **before** creating (so cleanup runs even if test fails mid-way)
- Always reset the tracking array at end of afterEach
- Use `deleteXIfExists()` not `deleteX()` — graceful if already gone
- Applies to contracts, employees, milestones, expenses — anything created in tests

---

## Graceful Skip When Fixture Missing (Point 9)

```typescript
// ❌ WRONG — hard crash on fresh checkout
function loadWorkers(): WorkerEntry[] {
  if (!fs.existsSync(WORKERS_FILE)) {
    throw new Error(`workers.json not found. Run global-setup first.`);
  }
  return JSON.parse(fs.readFileSync(WORKERS_FILE, 'utf-8'));
}

// ✅ CORRECT — follow policies.spec.ts pattern
function loadWorkers(): WorkerEntry[] {
  if (!fs.existsSync(WORKERS_FILE)) {
    console.warn(`workers.json not found at ${WORKERS_FILE}. Skipping worker-dependent tests.`);
    return []; // return empty, don't crash
  }
  return JSON.parse(fs.readFileSync(WORKERS_FILE, 'utf-8'));
}

// In tests — skip gracefully when no data
const workers = loadWorkers();

test.describe('Worker tests', () => {
  test.beforeAll(() => {
    if (workers.length === 0) {
      test.skip(); // skip all tests in block, not crash
    }
  });
});
```

// Pattern 2: Track multiple IDs
const createdIds: string[] = [];

test.afterEach(async ({ request }) => {
  await Promise.all(
    createdIds.map(id =>
      request.delete(`/api/employees/${id}`).catch(() => null)
    )
  );
  createdIds.length = 0; // reset array
});

// Pattern 3: UI delete (SLOWEST — last resort if no API)
test.afterEach(async ({ page }) => {
  await page.goto(`/employees/${employeeId}`);
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
});
```
