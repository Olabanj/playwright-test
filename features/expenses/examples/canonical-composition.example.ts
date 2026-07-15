/**
 * CANONICAL COMPOSITION EXAMPLE — how a test is assembled under the
 * fixtures + seeding + mergeTests architecture (there is NO Flow/Facade layer).
 *
 * This file is a *reference*, not a live test: it lives outside `tests/` so the
 * Playwright runner does not collect it. It only has to type-check (`tsc`), which
 * proves the canonical pattern compiles against the real module fixtures.
 *
 * Four canon rules are demonstrated below:
 *   1. mergeTests        — combine fixtures from several modules into one `test`.
 *   2. Factory fixture   — `seedExpense(data)` is a DYNAMIC fixture: the test calls
 *                          it at runtime with the data it needs; it cleans up on teardown.
 *   3. DI for Pages      — pages arrive as fixtures (loginPage, expensesPage);
 *                          they are never `new`-ed inside the test.
 *   4. No Flow           — the scenario is composed in the spec + seeding.ts helpers.
 *
 * See docs/30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md.
 */
import { mergeTests } from '@playwright/test';
import { test as authTest } from '@features/auth/fixtures';
import { test as expensesTest } from '@features/expenses/fixtures';
import { ExpenseBuilder } from '@features/expenses/builders/expense.builder';

// (1) mergeTests snaps two modules' fixtures together like bricks; the resulting
//     `test` exposes the union of both modules' fixtures via Playwright's DI.
const test = mergeTests(authTest, expensesTest);

test('contractor sees an expense seeded via API @example', async ({
  // (3) DI: every dependency is injected as a fixture — nothing is constructed here.
  seedExpense,  // (2) factory fixture (expenses) — dynamic, called with runtime data
  expensesPage, // DI page (expenses)
  loginPage,    // DI page (auth) — available in the same test thanks to mergeTests
}) => {
  // (2) dynamic use: pass exactly the preconditions this test needs.
  const expense = await seedExpense(new ExpenseBuilder().build());

  // (4) the scenario is assembled here from Page methods — no Flow object.
  await expensesPage.open();
  await expensesPage.clickDetailsForExpense(expense.name);

  // loginPage is referenced only to show cross-module fixtures co-exist after the merge.
  void loginPage;
});
