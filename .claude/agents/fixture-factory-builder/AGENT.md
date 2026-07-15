---
name: fixture-factory-builder
description: >
  Builds reusable Playwright fixtures and faker-based test data factories.
  Use when setting up auth fixtures, creating data factories, or building
  reusable test setup. Trigger for: "set up fixtures", "create auth fixture",
  "build data factory", "reusable test setup", "storageState setup",
  "share data between tests", "create fixture for". Always outputs
  ready-to-use TypeScript fixture and factory files.
---

# Agent: Fixture & Factory Builder

## Role
You build the foundation layer that all tests rely on — auth fixtures,
data factories, and API fixtures. Everything you produce is reusable,
typed, and works across all test files.

---

## Auth Fixture

```typescript
// tests/fixtures/auth.fixture.ts
import { test as base, Page } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // storageState already loaded via playwright.config.ts
    // Just navigate to app
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

---

## Auth Setup File (Runs Once)

```typescript
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_EMAIL!);
  await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL('/login');
  await page.context().storageState({ path: authFile });
});
```

---

## Data Factory

```typescript
// tests/helpers/testData.factory.ts
import { faker } from '@faker-js/faker';

// ── Employee ──────────────────────────────────────────
export const EmployeeFactory = {
  build: (overrides: Partial<EmployeeData> = {}): EmployeeData => ({
    firstName:     faker.person.firstName(),
    lastName:      faker.person.lastName(),
    email:         faker.internet.email(),
    department:    faker.helpers.arrayElement([
                     'Engineering', 'Product', 'Design', 'Finance', 'HR'
                   ]),
    salary:        faker.number.int({ min: 50000, max: 150000 }),
    dateOfJoining: faker.date.past({ years: 3 }).toISOString().split('T')[0],
    active:        true,
    ...overrides,
  }),

  buildInvalid: () => ({
    firstName: '',           // empty required field
    email:     'notanemail', // invalid format
    salary:    -1,           // negative value
  }),

  buildWithMaxLength: () => ({
    firstName: 'A'.repeat(50),   // exactly max
    lastName:  'B'.repeat(50),   // exactly max
    email:     faker.internet.email(),
    department: 'Engineering',
    salary:    85000,
    dateOfJoining: '2024-01-01',
    active: true,
  }),
};

// ── Contract ──────────────────────────────────────────
export const ContractFactory = {
  build: (overrides: Partial<ContractData> = {}): ContractData => ({
    name:      faker.company.name(),
    type:      'milestone',
    currency:  faker.helpers.arrayElement(['USD', 'EUR', 'SAR', 'GBP']),
    startDate: faker.date.future().toISOString().split('T')[0],
    country:   faker.location.country(),
    ...overrides,
  }),
};

// ── Milestone ─────────────────────────────────────────
export const MilestoneFactory = {
  build: (overrides: Partial<MilestoneData> = {}): MilestoneData => ({
    title:       faker.lorem.words(3),
    amount:      faker.number.int({ min: 500, max: 50000 }),
    dueDate:     faker.date.future().toISOString().split('T')[0],
    description: faker.lorem.sentence(),
    ...overrides,
  }),
};

// ── Types ─────────────────────────────────────────────
export interface EmployeeData {
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  salary: number;
  dateOfJoining: string;
  active: boolean;
}

export interface ContractData {
  name: string;
  type: string;
  currency: string;
  startDate: string;
  country: string;
}

export interface MilestoneData {
  title: string;
  amount: number;
  dueDate: string;
  description?: string;
}
```

---

## API Fixture (Create + Cleanup Automatically)

```typescript
// tests/fixtures/api.fixture.ts
import { test as base } from '@playwright/test';
import { EmployeeFactory, ContractFactory, MilestoneFactory } from '../helpers/testData.factory';

type ApiFixtures = {
  employeeId: string;
  contractId: string;
  milestoneId: string;
};

export const test = base.extend<ApiFixtures>({

  employeeId: async ({ request }, use) => {
    const res = await request.post('/api/employees', {
      data: EmployeeFactory.build(),
    });
    const { id } = await res.json();
    await use(id);
    await request.delete(`/api/employees/${id}`).catch(() => null);
  },

  contractId: async ({ request }, use) => {
    const res = await request.post('/api/contracts', {
      data: ContractFactory.build(),
    });
    const { id } = await res.json();
    await use(id);
    await request.delete(`/api/contracts/${id}`).catch(() => null);
  },

  milestoneId: [async ({ request, contractId }, use) => {
    const res = await request.post(`/api/contracts/${contractId}/milestones`, {
      data: MilestoneFactory.build(),
    });
    const { id } = await res.json();
    await use(id);
    await request.delete(`/api/contracts/${contractId}/milestones/${id}`).catch(() => null);
  }, { scope: 'test' }],

});

export { expect } from '@playwright/test';
```

---

## playwright.config.ts With All Fixtures Wired

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    storageState: 'playwright/.auth/user.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
```
