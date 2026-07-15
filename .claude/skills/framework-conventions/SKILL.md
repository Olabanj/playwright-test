---
name: framework-conventions
description: >
  Team framework conventions for Playwright TypeScript tests. Use this skill
  on EVERY test or page object you write — before any other skill. Covers
  naming conventions, file structure, logging, tagging, auth, path aliases,
  cleanup patterns, and reference files to follow. Trigger for: any new test
  file, any new page object, "follow our conventions", "match existing pattern",
  "how do we name things", "what's the reference file". Always apply these
  rules — they are non-negotiable team standards.
---

# Framework Conventions Skill

Apply every rule here to every file you create or modify.

---

## Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Test files | `feature.spec.ts` | `milestones.spec.ts` |
| Page Objects | `PageName.ts` PascalCase | `MilestonesPage.ts` |
| API Services | `ModuleAPI.ts` | `ContractsAPI.ts` |
| Test descriptions | Start with "Should" | `Should display milestone tab` |
| Method names | camelCase verbs | `clickAddMilestone()`, `verifyMilestoneVisible()` |
| Variable names | camelCase, consistent across ALL describe blocks | `milestonesPage` not `mp` |
| Locators | `get` getter properties | `get addButton()` |

---

## Variable Naming — Consistency Rule

```typescript
// ❌ WRONG — mixing names in same file
test.describe('Block 1', () => {
  let milestonesPage: MilestonesPage; // uses milestonesPage
});

test.describe('Block 2', () => {
  let mp: MilestonesPage; // uses mp — INCONSISTENT
});

// ✅ CORRECT — same name across entire file
test.describe('Block 1', () => {
  let milestonesPage: MilestonesPage;
});

test.describe('Block 2', () => {
  let milestonesPage: MilestonesPage; // same convention
});
```

---

## File Structure — Single Responsibility

**Each page object covers ONE page or ONE focused section.**
If a page object exceeds ~200 lines, it is doing too much.

```
// ❌ WRONG — MilestonesPage handling both milestone list AND contract wizard
MilestonesPage.ts (378 lines)
  - milestone list locators
  - contract wizard locators   ← WRONG — different page, different file
  - file upload logic          ← WRONG — belongs in ContractWizardPage
  - compliance step logic      ← WRONG — belongs in ContractWizardPage

// ✅ CORRECT — split by responsibility
MilestonesPage.ts (~100 lines)
  - milestone tab
  - milestone list
  - add/delete milestone

ContractWizardPage.ts (~150 lines)
  - contractor type selection
  - contract info step
  - payment step
  - compliance step
  - file upload
  - template selection
```

**Rule:** If locators like `contractorTypeOption`, `peopleLink`, `roleInput`,
`scopeInput`, `contractFileInput` appear in a MilestonesPage — that is an SRP
violation. Extract to `ContractWizardPage`.

---

## Locators — Always Use Getters

```typescript
// ❌ WRONG — property assignment
readonly addButton = this.page.getByRole('button', { name: 'Add' });

// ✅ CORRECT — getter (lazy evaluation, always fresh)
get addButton() {
  return this.page.getByRole('button', { name: 'Add' });
}
```

---

## Logging — logVerbose() in Every Method

```typescript
// ✅ Add logVerbose() at the START of every method
async createMilestone(data: MilestoneInput): Promise<void> {
  logVerbose(`Creating milestone: ${data.title}`);
  await this.addButton.click();
  await this.titleInput.fill(data.title);
  await this.submitButton.click();
}

async verifyMilestoneVisible(title: string): Promise<void> {
  logVerbose(`Verifying milestone visible: ${title}`);
  await expect(this.milestoneList.getByText(title)).toBeVisible();
}
```

---

## Authentication — Always Use AuthFixture

```typescript
// ❌ NEVER hardcode credentials
await page.fill('[data-testid="email"]', 'user@test.com');
await page.fill('[data-testid="password"]', 'password123');

// ❌ NEVER use UI login in test body
await loginPage.login(email, password);

// ✅ ALWAYS use AuthFixture
import { UIFixture } from '@fixtures/ui.fixture';

test.beforeEach(async ({ page }) => {
  await UIFixture.loginClientViaAPI(page);
});
```

---

## Path Aliases — Always Use, Never Relative Imports

```typescript
// ❌ WRONG — brittle relative imports
import { MilestonesPage } from '../../../pages/modules/contracts/MilestonesPage';
import { UIFixture } from '../../../../fixtures/ui.fixture';

// ✅ CORRECT — path aliases
import { MilestonesPage } from '@pages/modules/contracts/MilestonesPage';
import { UIFixture } from '@fixtures/ui.fixture';
import { logVerbose } from '@helpers/logger';
import { generateMilestoneInput } from '@helpers/milestone-data.helpers';
```

Configure in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@pages/*":    ["tests/pages/*"],
      "@fixtures/*": ["tests/fixtures/*"],
      "@helpers/*":  ["tests/helpers/*"],
      "@data/*":     ["tests/data/*"]
    }
  }
}
```

---

## Test Tagging — Always Tag Every Test

```typescript
// Every test must have at least ONE tag
test('Should display milestone tab @smoke', async ({ page }) => {});
test('Should create milestone successfully @regression', async ({ page }) => {});
test('Should handle empty state @regression @edge', async ({ page }) => {});

// Tag meanings
// @smoke      → critical path, runs on every PR, fast
// @regression → full coverage, runs nightly
// @edge       → edge cases
// @negative   → negative/error cases
```

---

## Cleanup — Always afterAll or afterEach

```typescript
// ✅ Follow expense-crud.spec.ts pattern exactly
const createdContractNames: string[] = [];

test.beforeEach(async ({ page }) => {
  milestonesPage = new MilestonesPage(page);
  await UIFixture.loginClientViaAPI(page);
  await milestonesPage.goto(contractRef);
});

test.afterEach(async () => {
  for (const name of createdContractNames) {
    await milestonesPage.deleteContractIfExists(name);
  }
  createdContractNames.length = 0; // reset after each test
});

// Track every created resource
test('Should create contract @regression', async ({ page }) => {
  const contractName = faker.company.name();
  createdContractNames.push(contractName); // track it
  await milestonesPage.createContract({ name: contractName });
});
```

---

## Timeouts — Reasonable Limits Only

```typescript
// ❌ WRONG — blanket 3-5 minute timeouts mask performance regressions
test.setTimeout(300_000);
test.use({ navigationTimeout: 180_000 });

// ✅ CORRECT — specific timeouts per test type
// Smoke tests
test.setTimeout(30_000);
test.use({ navigationTimeout: 15_000 });

// Complex wizard flows
test.setTimeout(60_000);
test.use({ navigationTimeout: 30_000 });

// API-dependent tests
test.setTimeout(45_000);
```

---

## Random Data Strategy — Pick ONE, Use Everywhere

```typescript
// ❌ WRONG — mixing faker directly AND helper functions
import { faker } from '@faker-js/faker'; // direct faker
import { generateMilestoneInput } from '@helpers/milestone-data.helpers'; // helper

// In tests — inconsistent mix:
jobTitle: faker.person.jobTitle(),       // direct faker
name:     generateMilestoneInput().name, // helper

// ✅ CORRECT — consolidate ALL random data in helpers (like expense-faker.ts)
import { generateMilestoneInput, generateContractInput } from '@helpers/milestone-data.helpers';

// In tests — consistent:
const milestoneData = generateMilestoneInput();
const contractData  = generateContractInput();

// OR use faker directly everywhere — but PICK ONE APPROACH per module
```

---

## Reference Files — Always Follow These

```
New module tests?    → follow time-tracking module structure
New page object?     → follow TimeTrackingPage.ts pattern
Expense-style CRUD?  → follow expense-crud.spec.ts pattern
Policy-style list?   → follow policies.spec.ts pattern
```

**Always say in your prompt:**
```
"Follow the exact same pattern as expense-crud.spec.ts"
"Follow TimeTrackingPage.ts for the page object structure"
```

---

## Do's and Don'ts Summary

```
✅ DO
  - Clean up ALL created data in afterAll/afterEach
  - logVerbose() at start of every method
  - Tag every test with @smoke or @regression
  - Use AuthFixture — never hardcode credentials
  - Keep locators as get getters
  - Use path aliases (@pages, @fixtures)
  - Use time-tracking module as reference
  - Run smoke tests locally before pushing
  - Pick ONE random data strategy per module
  - Keep page objects under ~200 lines (SRP)
  - Match variable names consistently across describe blocks

❌ DON'T
  - Use waitForTimeout() — wait for conditions instead
  - Hardcode credentials anywhere
  - Use relative imports (../../)
  - Mix variable names (mp vs milestonesPage)
  - Put wizard logic in MilestonesPage
  - Set 3-5 minute blanket timeouts
  - Leave unused locators in page objects
  - Mix faker direct + helper functions
  - Write tests that don't match their name (navigation test named "create" test)
  - Assert things already verified in beforeEach
```
