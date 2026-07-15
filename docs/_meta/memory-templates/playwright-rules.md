---
name: playwright-rules
description: Concrete Playwright usage rules — locators, waits, fixtures, page objects, test data. Enforced by review-checklist.
metadata:
  type: feedback
---

# Playwright rules

## Locators

- Prefer `getByRole`, `getByLabel`, `getByTestId`, `getByPlaceholder`.
- Forbidden: `nth-child`, deep CSS chains, XPath unless the DOM forces it.
- A locator that breaks on minor UI changes is a bad locator.

## Waiting

- Auto-wait via assertions: `await expect(button).toBeVisible()`.
- Forbidden: `page.waitForTimeout`, `setTimeout`.
- `waitForResponse` only when the response itself is the verification target.

## Fixtures

- One module = one `fixtures.ts` via `test.extend()`.
- Cross-module test composition via `mergeTests(testA, testB)`.
- Authenticated contexts, builder instances, flow instances — all via fixtures.
- `beforeAll` reserved for genuinely once-per-file work with no isolation cost.

## Page objects (POM v4)

- Locators and actions only.
- No `expect` inside page objects — assertions live in tests.
- No `page.goto` inside actions — navigation orchestrated by fixtures or top of test.

## API clients

- Extend `BaseAPI`. One method = one HTTP request.
- Return `ApiResponse<T>` always. Never raw data.
- Verify endpoint shape via `rp-search` / `rp-show` before writing.

## Test data

- Builders for fluent data creation. Never inline literals.
- Builders are data-only — no HTTP. A `seeding.ts` helper performs the HTTP step.

## Configuration

- Read env via `core/config/env.ts` typed accessor.
- `process.env` forbidden outside `core/config/`.

## Tags

- `@smoke` — < 5 min total, critical paths.
- `@regression` — full validation.
- `@deep` — exhaustive edge cases.
- `@critical` — must-pass.
- `@slow` — significant runtime.

## Migration-specific

- Migrate intent, not implementation.
- Scenario doc is the source of truth; legacy file is reference only.
- One batch = one worktree = one branch = one PR.
- 3-5 tests per batch.
