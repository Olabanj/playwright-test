import { baseTest } from '@fixtures/base.fixture';
import { logVerbose } from '@utils/helpers/logger';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { ExpensesClient } from '@features/expenses/api-client';
import { ExpenseFormData } from '@features/expenses/builders/expense.builder';
import { createExpenseViaApi } from '@features/expenses/seeding';
import { RECEIPT_PATH } from '@features/expenses/constants';
import { SeededExpense } from '@features/expenses/types';
import { ExpensesPage } from '@features/expenses/pages/frontoffice/ExpensesPage';
import { AddExpenseModal } from '@features/expenses/pages/frontoffice/AddExpenseModal';
import { ExpenseDetailsPanel } from '@features/expenses/pages/frontoffice/ExpenseDetailsPanel';

/** Seed an expense via API; returns the created record. */
export type SeedExpenseFn = (data: ExpenseFormData, receiptPath?: string) => Promise<SeededExpense>;

export interface ExpensesFixtures {
  expensesClient:  ExpensesClient;
  contractsClient: ContractsClient;
  seedExpense:     SeedExpenseFn;
  expensesPage:    ExpensesPage;
  addExpenseModal: AddExpenseModal;
  detailsPanel:    ExpenseDetailsPanel;
}

export const test = baseTest.extend<ExpensesFixtures>({
  expensesClient: async ({ contractorToken }, use) => {
    const client = new ExpensesClient();
    await client.init(contractorToken);
    await use(client);
    await client.dispose();
  },

  contractsClient: async ({ contractorToken }, use) => {
    const client = new ContractsClient();
    await client.init(contractorToken);
    await use(client);
    await client.dispose();
  },

  // State fixture: composition lives in seeding.ts; the fixture only tracks what
  // it created and deletes it on teardown so specs never leak preconditions.
  seedExpense: async ({ expensesClient, contractsClient }, use) => {
    const created: number[] = [];
    const seed: SeedExpenseFn = async (data, receiptPath = RECEIPT_PATH) => {
      const expense = await createExpenseViaApi(
        { expenses: expensesClient, contracts: contractsClient },
        data,
        receiptPath,
      );
      created.push(expense.id);
      return expense;
    };
    await use(seed);
    for (const id of created.splice(0)) {
      await expensesClient
        .deleteExpense(id)
        .catch((err: unknown) => { logVerbose(`[seedExpense] cleanup failed for id=${id}: ${String(err)}`); });
    }
  },

  expensesPage: async ({ contractorPage }, use) => {
    await use(new ExpensesPage(contractorPage));
  },

  addExpenseModal: async ({ contractorPage }, use) => {
    await use(new AddExpenseModal(contractorPage));
  },

  detailsPanel: async ({ contractorPage }, use) => {
    await use(new ExpenseDetailsPanel(contractorPage));
  },
});

export { expect } from '@playwright/test';
