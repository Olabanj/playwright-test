import { test, expect } from '@features/expenses/fixtures';
import { ExpenseBuilder } from '@features/expenses/builders/expense.builder';
import { EXPENSE_STATUS } from '@features/expenses/constants';
import { findExpenseIdByName } from '@features/expenses/seeding';

/**
 * Expenses — Frontoffice (contractor) UI suite.
 *
 * Merged from the legacy expenses-list (@smoke) and expense-crud (@regression)
 * specs. Preconditions are seeded via the API (the `seedExpense` state fixture,
 * which wraps seeding.ts), not the modal, and created expenses are auto-deleted
 * by the fixture teardown.
 */
test.describe('Expenses — Frontoffice', () => {
  const TABLE_HEADERS = ['Contract', 'Expense', 'Category', 'Date', 'Amount', 'Status', 'Actions'];

  test.describe('List @smoke', () => {
    let seededName: string;

    test.beforeEach(async ({ seedExpense, expensesPage }) => {
      const seeded = await seedExpense(new ExpenseBuilder().build());
      seededName = seeded.name;
      await expensesPage.open();
    });

    test('Expenses page displayed with correct structure @smoke', async ({ expensesPage }) => {
      await expect(expensesPage.pageTitle).toBeVisible();
      await expect(expensesPage.addExpenseButton).toBeVisible();

      for (const header of TABLE_HEADERS) {
        await expect(expensesPage.headerCell(header)).toBeVisible();
      }
    });

    test('Existing expenses are displayed in table @smoke', async ({ expensesPage }) => {
      await expect(expensesPage.rowByName(seededName)).toBeVisible();

      const firstRow = expensesPage.tableRows.first();

      await expect(firstRow).toBeVisible();
      expect(await firstRow.locator('td').count()).toBeGreaterThanOrEqual(6);
    });

    test('Expense details are displayed by click on Details @smoke', async ({ expensesPage, detailsPanel }) => {
      await expensesPage.clickDetailsForExpense(seededName);

      await expect(detailsPanel.detailsHeading).toBeVisible();
    });
  });

  test.describe('CRUD @regression', () => {
    test('Create a new expense @regression', async ({ expensesClient, expensesPage, addExpenseModal }) => {
      const data = new ExpenseBuilder().build();

      try {
        await expensesPage.open();
        await expensesPage.clickAddExpense();
        await addExpenseModal.waitVisible();
        await addExpenseModal.fillForm(data);
        await addExpenseModal.submit();
        await addExpenseModal.waitClosed();

        await expect(expensesPage.rowByName(data.name)).toBeVisible();
        await expect(expensesPage.rowByName(data.name)).toContainText(EXPENSE_STATUS.PENDING);
      } finally {
        // UI-created → not tracked by the seedExpense fixture. Delete via API in `finally`
        // so cleanup runs even if an assertion above failed (per-test cleanup ADR).
        const id = await findExpenseIdByName(expensesClient, data.name);
        if (id) await expensesClient.deleteExpense(id).catch(() => { /* best-effort cleanup */ });
      }
    });

    test('Correct expense data displayed on the Details panel @regression', async ({ seedExpense, expensesPage, detailsPanel }) => {
      const seeded = await seedExpense(new ExpenseBuilder().build());

      await expensesPage.open();
      await expensesPage.clickDetailsForExpense(seeded.name);

      await expect(detailsPanel.detailsHeading).toBeVisible();
      await expect(detailsPanel.expenseName).toContainText(seeded.name);
      await expect(detailsPanel.fieldValue('Amount')).toContainText(seeded.amount);
      await expect(detailsPanel.statusBadge(EXPENSE_STATUS.PENDING_APPROVAL)).toBeVisible();
    });

    test('Delete a pending expense @regression', async ({ seedExpense, expensesPage, detailsPanel }) => {
      const seeded = await seedExpense(new ExpenseBuilder().build());

      await expensesPage.open();
      await expensesPage.clickDetailsForExpense(seeded.name);

      await expect(detailsPanel.statusBadge(EXPENSE_STATUS.PENDING_APPROVAL)).toBeVisible();
      await expect(detailsPanel.deleteExpenseButton).toBeVisible();

      await detailsPanel.deleteExpense();

      await expect(expensesPage.rowByName(seeded.name)).toHaveCount(0);
    });
  });
});
