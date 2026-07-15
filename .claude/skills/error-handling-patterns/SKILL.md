---
name: error-handling-patterns
description: >
  Playwright error handling and debugging skill. Use whenever dealing with
  loading states, modals, toast notifications, network errors, flaky elements,
  or debugging failing tests. Trigger for: "handle loading spinner", "wait
  for modal", "toast assertion", "simulate network error", "element not found",
  "test is flaky", "how to debug", "trace viewer", "element intercept".
---

# Error Handling Patterns Skill

---

## Loading States

```typescript
// Wait for spinner to disappear
await page.getByTestId('loading-spinner').waitFor({ state: 'hidden' });

// Wait for skeleton loader to disappear
await page.getByRole('progressbar').waitFor({ state: 'hidden' });

// Wait for content to appear after load
await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

// Wait for network to settle before asserting
await page.waitForLoadState('networkidle');
```

---

## Toast / Alert Notifications

```typescript
// Success toast
await expect(page.getByRole('alert')).toContainText('Created successfully');
await expect(page.getByRole('alert')).toBeVisible();

// Error toast
await expect(page.getByRole('alert')).toContainText('Something went wrong');

// Toast disappears — check before it fades
const toast = page.getByRole('alert');
await expect(toast).toBeVisible();
await expect(toast).toContainText('Saved');
```

---

## Modal / Dialog Handling

```typescript
// Wait for modal to open
await page.getByRole('button', { name: 'Delete' }).click();
await expect(page.getByRole('dialog')).toBeVisible();

// Confirm modal action
await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
await expect(page.getByRole('dialog')).toBeHidden();

// Dismiss modal
await page.getByRole('button', { name: 'Cancel' }).click();
await expect(page.getByRole('dialog')).not.toBeVisible();

// Browser native dialog
page.on('dialog', dialog => dialog.accept());
await page.getByText('Delete').click();
```

---

## Network Error Simulation

```typescript
// Simulate API failure
await page.route('**/api/employees', route => route.abort());
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByRole('alert')).toContainText('Failed');

// Simulate slow network
await page.route('**/api/employees', async route => {
  await new Promise(r => setTimeout(r, 3000)); // 3s delay
  await route.continue();
});

// Simulate 500 error
await page.route('**/api/employees', route =>
  route.fulfill({ status: 500, body: 'Server Error' })
);

// Simulate 404
await page.route('**/api/employees/999', route =>
  route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) })
);
```

---

## Flaky Element Handling

```typescript
// Element appears after animation — use waitFor
await page.getByRole('tooltip').waitFor({ state: 'visible' });

// Click only when ready
await page.getByRole('button').waitFor({ state: 'enabled' });
await page.getByRole('button').click();

// Retry assertion with longer timeout
await expect(page.getByText('Results loaded')).toBeVisible({ timeout: 20_000 });

// Disable animations in tests
await page.addStyleTag({
  content: `*, *::before, *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }`
});
```

---

## Debugging Tools

```typescript
// Pause test — opens Playwright Inspector
await page.pause();

// Take screenshot at any point
await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });

// Log page content
console.log(await page.content());

// Log specific element text
console.log(await page.getByRole('alert').textContent());
```

```bash
# Run with full debug mode
npx playwright test --debug

# Run with trace always on
npx playwright test --trace on

# View trace after failure
npx playwright show-trace test-results/trace.zip

# Run headed to see browser
npx playwright test --headed

# Slow down execution
npx playwright test --slow-mo=500
```

---

## Validation Error Patterns

```typescript
// Field-level error
await expect(
  page.getByText('Email is required')
).toBeVisible();

// Form-level error
await expect(
  page.getByRole('alert').filter({ hasText: 'Please fix the errors' })
).toBeVisible();

// Multiple field errors — soft assertions
await expect.soft(page.getByText('First name is required')).toBeVisible();
await expect.soft(page.getByText('Email is required')).toBeVisible();
await expect.soft(page.getByText('Salary must be positive')).toBeVisible();
```

---

## Session Expiry

```typescript
// Simulate session expiry
await page.route('**/api/**', route =>
  route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) })
);
await page.reload();
await expect(page).toHaveURL('/login');
```
