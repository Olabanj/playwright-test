---
name: assertions-library
description: >
  Complete Playwright assertions skill. Use whenever writing expect() calls,
  adding assertions to tests, validating UI state, or checking API responses.
  Trigger for: "add assertions", "how to check if element exists", "verify
  text", "assert URL", "check form state", "validate table data", "soft
  assertions", "custom error messages". Never skip this skill when adding
  assertions.
---

# Assertions Library Skill

---

## Core Rule
Always use `expect()` from `@playwright/test`.
Never use `if/throw`, `assert`, or raw boolean checks.

```typescript
// ❌ WRONG
if (await page.isVisible('.success')) throw new Error('Not visible');

// ✅ CORRECT
await expect(page.getByRole('alert')).toBeVisible();
```

---

## Visibility

```typescript
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();
await expect(locator).toBeAttached();  // in DOM but may be hidden
```

---

## Text Assertions

```typescript
// Exact match
await expect(locator).toHaveText('Exact text here');

// Partial match
await expect(locator).toContainText('partial');

// Case insensitive
await expect(locator).toContainText(/welcome/i);

// Multiple text checks
await expect(locator).toHaveText(['Item 1', 'Item 2', 'Item 3']);
```

---

## URL & Title

```typescript
await expect(page).toHaveURL('/dashboard');
await expect(page).toHaveURL(/.*dashboard/);
await expect(page).toHaveURL(new RegExp(contractId));
await expect(page).toHaveTitle('My App');
await expect(page).toHaveTitle(/.*My App.*/);
```

---

## Form State

```typescript
await expect(locator).toHaveValue('input value');
await expect(locator).toBeChecked();
await expect(locator).not.toBeChecked();
await expect(locator).toBeDisabled();
await expect(locator).toBeEnabled();
await expect(locator).toBeFocused();
await expect(locator).toBeEditable();
```

---

## Count & Lists

```typescript
await expect(locator).toHaveCount(3);
await expect(locator).toHaveCount(0); // nothing visible

// Check list items
const items = page.getByRole('listitem');
await expect(items).toHaveCount(5);
await expect(items.first()).toContainText('First item');
await expect(items.last()).toContainText('Last item');
```

---

## Attributes & CSS

```typescript
await expect(locator).toHaveAttribute('aria-expanded', 'true');
await expect(locator).toHaveAttribute('href', '/dashboard');
await expect(locator).toHaveClass(/active/);
await expect(locator).toHaveCSS('color', 'rgb(255, 0, 0)');
```

---

## Soft Assertions (Check Multiple Without Stopping)

```typescript
// Use when you want ALL failures reported, not just first
test('verify employee row data', async ({ page }) => {
  const row = page.getByTestId('employee-row-1');

  // Soft — continues even if one fails
  await expect.soft(row.getByTestId('name')).toHaveText('James Santos');
  await expect.soft(row.getByTestId('dept')).toHaveText('Engineering');
  await expect.soft(row.getByTestId('salary')).toContainText('85,000');
  await expect.soft(row.getByTestId('status')).toHaveText('Active');

  // Hard check at the end — fails if any soft failed
  expect(test.info().errors).toHaveLength(0);
});
```

---

## Custom Error Messages

```typescript
// Add message as second parameter — makes failures readable
await expect(
  page.getByRole('heading'),
  'Dashboard heading should be visible after login'
).toBeVisible();

await expect(
  page.getByTestId('total-gross'),
  `Expected total gross to be ${expectedTotal}`
).toContainText(String(expectedTotal));
```

---

## Table Assertions

```typescript
// Verify specific cell in a table
const row = page.getByRole('row').filter({ hasText: 'James Santos' });
await expect(row.getByRole('cell').nth(3)).toHaveText('Engineering');

// Verify row count
await expect(page.getByRole('row')).toHaveCount(6); // 5 data + 1 header

// Verify column header
await expect(page.getByRole('columnheader', { name: 'Salary' })).toBeVisible();

// Verify row NOT present
await expect(
  page.getByRole('row').filter({ hasText: 'David Lim' })
).toHaveCount(0);
```

---

## Network Response Assertions

```typescript
const [response] = await Promise.all([
  page.waitForResponse('**/api/employees'),
  page.getByRole('button', { name: 'Save' }).click(),
]);
expect(response.status()).toBe(201);
const body = await response.json();
expect(body.id).toBeDefined();
```

---

## Negative Assertions

```typescript
// Element NOT visible
await expect(locator).not.toBeVisible();

// Text NOT present
await expect(locator).not.toContainText('Error');

// Button NOT disabled
await expect(locator).not.toBeDisabled();

// URL did NOT change
await expect(page).not.toHaveURL('/dashboard');
```

---

## Timeout Overrides

```typescript
// Default timeout is too short for slow operations
await expect(locator).toBeVisible({ timeout: 10_000 });
await expect(locator).toHaveText('Loaded', { timeout: 15_000 });
```
