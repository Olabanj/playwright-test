---
name: playwright-core
description: >
  Core Playwright TypeScript skill for Senior QA Engineers. Use this skill
  whenever writing, refactoring, or reviewing Playwright tests. Covers Page
  Object Model, selectors, waits, auth, re-run safety, and TypeScript patterns.
  Trigger for: "write a test", "create page object", "refactor codegen",
  "fix flaky test", "set up Playwright", "add assertions", any browser
  automation task. Always use this skill before writing any Playwright code.
---

# Playwright Core Skill

You are a Senior QA Automation Engineer. Write clean, reliable, maintainable
TypeScript Playwright tests following these patterns strictly.

---

## Project Structure

```
tests/
├── pages/
│   ├── BasePage.ts              ← shared methods all pages inherit
│   └── modules/
│       └── contracts/
│           └── MilestonesPage.ts
├── fixtures/
│   ├── auth.fixture.ts          ← login once, reuse everywhere
│   └── api.fixture.ts           ← create/delete data via API
├── helpers/
│   └── testData.factory.ts      ← faker-based data generators
├── e2e/
│   └── modules/
│       └── contracts/
│           └── milestones.spec.ts
playwright.config.ts
```

---

## BasePage Pattern

```typescript
// tests/pages/BasePage.ts
import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async clickButton(name: string) {
    await this.page.getByRole('button', { name }).click();
  }

  async fillField(label: string, value: string) {
    await this.page.getByLabel(label).fill(value);
  }

  async expectSuccessToast(message: string) {
    await expect(this.page.getByRole('alert')).toContainText(message);
  }

  async expectErrorMessage(message: string) {
    await expect(this.page.getByRole('alert')).toContainText(message);
  }
}
```

---

## Page Object Model Pattern

```typescript
// tests/pages/modules/contracts/MilestonesPage.ts
import { Page, expect } from '@playwright/test';
import { BasePage } from '../../BasePage';

export class MilestonesPage extends BasePage {
  // ── Locators (readonly, no hardcoded strings in methods) ──
  readonly milestonesTab = this.page.getByRole('tab', { name: 'Milestones' });
  readonly addMilestoneBtn = this.page.getByRole('button', { name: 'Add Milestone' });
  readonly titleInput = this.page.getByLabel('Title');
  readonly amountInput = this.page.getByLabel('Amount');
  readonly dueDateInput = this.page.getByLabel('Due Date');
  readonly submitBtn = this.page.getByRole('button', { name: 'Submit' });
  readonly milestoneList = this.page.getByTestId('milestone-list');

  constructor(page: Page) {
    super(page);
  }

  // ── Actions (accept params, never hardcode) ──
  async goto(contractRef: string) {
    await this.page.goto(`/contracts/${contractRef}/milestones`);
    await this.verifyOnMilestonesPage(contractRef);
  }

  async verifyOnMilestonesPage(contractRef: string) {
    await expect(this.page).toHaveURL(new RegExp(contractRef));
    await expect(this.milestonesTab).toBeVisible();
  }

  async createMilestone(data: {
    title: string;
    amount: number;
    dueDate: string;
  }) {
    await this.addMilestoneBtn.click();
    await this.titleInput.fill(data.title);
    await this.amountInput.fill(String(data.amount));
    await this.dueDateInput.fill(data.dueDate);
    await this.submitBtn.click();
  }

  async getMilestoneByTitle(title: string) {
    return this.milestoneList.getByText(title);
  }

  async deleteMilestoneByTitle(title: string) {
    const row = this.milestoneList.filter({ hasText: title });
    await row.getByRole('button', { name: 'Delete' }).click();
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }
}
```

---

## Selector Priority (Best → Worst)

```typescript
// 1. Role (BEST — semantic, resilient)
page.getByRole('button', { name: 'Submit' })
page.getByRole('textbox', { name: 'Email' })
page.getByRole('checkbox', { name: 'Active' })

// 2. Label (forms)
page.getByLabel('Email address')

// 3. Placeholder
page.getByPlaceholder('Search...')

// 4. Text
page.getByText('Welcome back')

// 5. Test ID (data-testid)
page.getByTestId('submit-btn')

// 6. CSS — last resort only
page.locator('[data-cy="submit"]')

// ❌ NEVER USE
page.locator('.css-19bb58m')        // auto-generated, breaks on deploy
page.locator('#app > div > button') // brittle path
page.waitForTimeout(2000)           // flaky timing
```

---

## Waiting Patterns

```typescript
// ✅ Auto-wait via assertions (preferred)
await expect(page.getByText('Success')).toBeVisible();

// ✅ Wait for network response
const [response] = await Promise.all([
  page.waitForResponse('**/api/milestones'),
  page.getByRole('button', { name: 'Save' }).click(),
]);
expect(response.status()).toBe(201);

// ✅ Wait for load state
await page.waitForLoadState('networkidle');

// ✅ Wait for element state
await page.getByRole('button').waitFor({ state: 'visible' });

// ❌ NEVER
await page.waitForTimeout(3000);
```

---

## Re-Run Safety Rules

1. Use faker for all dynamic data
2. Create test data in beforeEach via API
3. Delete test data in afterEach via API
4. Use storageState — never login in test body
5. Each test must be fully independent
6. Never depend on test execution order

```typescript
import { test, expect } from '../fixtures/auth.fixture';
import { faker } from '@faker-js/faker';

test.describe('Milestones — Create @regression', () => {
  let contractId: string;
  const milestoneData = {
    title: faker.lorem.words(3),
    amount: faker.number.int({ min: 500, max: 10000 }),
    dueDate: '2026-12-31',
  };

  test.beforeEach(async ({ request }) => {
    // Create contract via API — never rely on existing data
    const res = await request.post('/api/contracts', {
      data: { type: 'milestone', name: faker.company.name() }
    });
    contractId = (await res.json()).id;
  });

  test.afterEach(async ({ request }) => {
    // Clean up — so next run starts fresh
    await request.delete(`/api/contracts/${contractId}`).catch(() => null);
  });

  test('creates milestone successfully', async ({ page }) => {
    const milestonesPage = new MilestonesPage(page);
    await milestonesPage.goto(contractId);
    await milestonesPage.createMilestone(milestoneData);
    await expect(milestonesPage.getMilestoneByTitle(milestoneData.title))
      .toBeVisible();
  });
});
```

---

## Test Naming Convention

```typescript
// Pattern: should [action] when [condition]
test('should create milestone when valid data provided')
test('should show error when title is empty')
test('should disable submit when amount is negative')
test('should display "New" status when worker has no previous cycle')
test('should hide unchanged workers when show only changes is ON')
```

---

## waitForTimeout — STRICTLY BANNED (Point 5)

`waitForTimeout` is the #1 source of flakiness. It is banned without exception.
The framework provides proper alternatives in base classes.

```typescript
// ❌ BANNED — every occurrence must be replaced
await this.page.waitForTimeout(1000);
await this.page.waitForTimeout(2000);

// ✅ After file upload — wait for upload indicator
await this.contractFileInput.setInputFiles(filePath);
await this.page.getByTestId('upload-success').waitFor({ state: 'visible' });

// ✅ After dropdown interaction — wait for options to appear
await this.dropdownTrigger.click();
await this.page.getByRole('listbox').waitFor({ state: 'visible' });

// ✅ After typing in search — wait for results
await this.searchInput.fill(value);
await this.page.getByRole('option').first().waitFor({ state: 'visible' });

// ✅ Use base class helpers instead
await this.waitForVisible(locator);
await this.waitForPageLoad();
await this.waitForLoadingToComplete();
```

---

## Fragile Locators — Never Use (Point 6)

```typescript
// ❌ FRAGILE — react-select internal IDs break across library versions
await this.page.locator('[id^="react-select-"][id$="-placeholder"]')
  .first().click({ force: true });

// ❌ force: true hides real bugs — element may not be visible/enabled
await locator.click({ force: true });

// ❌ keyboard.type() bypasses component API
await this.page.keyboard.type(country);

// ✅ CORRECT — interact through visible UI role
await this.page.getByRole('combobox', { name: 'Tax Country' }).click();
await this.page.getByRole('combobox', { name: 'Tax Country' }).fill(country);
await this.page.getByRole('option', { name: country }).click();

// ✅ Only use force: true when absolutely necessary AND add a comment explaining why
await locator.click({ force: true }); // overlapping tooltip covers element, known issue #123
```

---

## Timeouts — Reasonable Per Test Type (Point 10)

```typescript
// ❌ WRONG — blanket 3-5 min timeouts mask performance regressions
test.setTimeout(300_000);
test.use({ navigationTimeout: 180_000 });

// ✅ CORRECT — match timeout to test complexity
// Smoke / heading / tab visibility
test.setTimeout(30_000);
test.use({ navigationTimeout: 15_000 });

// Standard CRUD flows
test.setTimeout(60_000);
test.use({ navigationTimeout: 30_000 });

// Multi-step wizard (complex flows only)
test.setTimeout(90_000);
test.use({ navigationTimeout: 45_000 });
```

---

## Unused Locators — Remove Immediately (Point 8)

```typescript
// ❌ Dead code — locators defined but never used
readonly peopleLink = ...       // navigation goes through this.navigate('/people')
readonly closeWizardButton = ... // never called
readonly getContractorInviteLink = ... // never called

// Rule: if a locator has no method that uses it, delete it.
// Dead locators add confusion and maintenance burden.
```

---

## Reference Files
- `references/config.md` — playwright.config.ts templates
- `references/selectors.md` — advanced selector patterns
- `references/typescript.md` — TypeScript strict mode patterns
