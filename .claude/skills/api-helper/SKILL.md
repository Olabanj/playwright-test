---
name: api-helper
description: >
  Playwright API request context skill. Use whenever making API calls inside
  tests — for setup, teardown, auth, or response validation. Trigger for:
  "create data via API", "delete via API", "API login", "validate API response",
  "set up test data without UI", "beforeEach API call", "afterEach cleanup".
  Always prefer API over UI for test setup and teardown.
---

# API Helper Skill

---

## Why Use API Instead of UI for Setup

```
UI setup:  slow, fragile, depends on UI working correctly
API setup: fast, reliable, independent of UI state
```

Rule: **Only use the UI for what you're actually testing.**
Everything else (login, create data, cleanup) → API.

---

## Basic API Request in Tests

```typescript
import { test, expect } from '@playwright/test';

test('employee appears in list', async ({ page, request }) => {
  // Create via API — fast and reliable
  const res = await request.post('/api/employees', {
    data: {
      firstName: 'James',
      email: faker.internet.email(),
      salary: 85000,
    },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(201);
  const employee = await res.json();

  // Now test the UI
  await page.goto('/employees');
  await expect(page.getByText(employee.firstName)).toBeVisible();

  // Cleanup via API
  await request.delete(`/api/employees/${employee.id}`);
});
```

---

## Auth via API (Faster Than UI Login)

```typescript
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

setup('authenticate via API', async ({ request, page }) => {
  // Hit auth API directly
  const res = await request.post('/api/auth/login', {
    data: {
      email: process.env.TEST_EMAIL!,
      password: process.env.TEST_PASSWORD!,
    },
  });
  expect(res.ok()).toBeTruthy();

  // Save session to file
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
```

---

## Reusable API Fixture

```typescript
// tests/fixtures/api.fixture.ts
import { test as base } from '@playwright/test';
import { EmployeeFactory } from '../helpers/testData.factory';

type Fixtures = {
  employeeId: string;
  contractId: string;
};

export const test = base.extend<Fixtures>({
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
});

export { expect } from '@playwright/test';
```

---

## Response Validation Patterns

```typescript
// Status codes
expect(res.status()).toBe(200);
expect(res.status()).toBe(201); // created
expect(res.status()).toBe(400); // bad request
expect(res.status()).toBe(404); // not found
expect(res.ok()).toBeTruthy();  // 200-299

// Response body
const body = await res.json();
expect(body.id).toBeDefined();
expect(body.email).toBe('test@example.com');
expect(body.salary).toBeGreaterThan(0);

// Array response
const list = await res.json();
expect(list).toHaveLength(3);
expect(list[0]).toHaveProperty('id');
```

---

## Intercepting API Calls in UI Tests

```typescript
// Mock API response
await page.route('**/api/employees', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: 1, firstName: 'James', email: 'james@test.com' }
    ]),
  });
});

// Intercept and verify request was made
const requestPromise = page.waitForRequest('**/api/employees');
await page.getByRole('button', { name: 'Save' }).click();
const req = await requestPromise;
expect(req.method()).toBe('POST');

// Wait for response after action
const [response] = await Promise.all([
  page.waitForResponse('**/api/employees'),
  page.getByRole('button', { name: 'Save' }).click(),
]);
expect(response.status()).toBe(201);

// Simulate network failure
await page.route('**/api/employees', route => route.abort());
```

---

## Environment Config

```typescript
// playwright.config.ts
use: {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  extraHTTPHeaders: {
    'Accept': 'application/json',
  },
}
```

```bash
# .env.test
BASE_URL=https://sandbox.remotepass.com
TEST_EMAIL=test@company.com
TEST_PASSWORD=TestPass123!
API_TOKEN=your-token-here
```
