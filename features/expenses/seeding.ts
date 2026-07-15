import { ContractsClient } from '@features/contracts/clients/api-client';
import { logVerbose } from '@utils/helpers/logger';
import { ExpensesClient } from './api-client';
import { ExpenseFormData } from './builders/expense.builder';
import { CURRENCY_ID, RECEIPT_PATH } from './constants';
import { SeededExpense } from './types';

/**
 * Stateless API composition for the expenses domain. One function = one reusable
 * business sequence over ExpensesClient/ContractsClient — no state, no cleanup.
 *
 * These helpers are the single home for multi-step expense setup: API specs call
 * them directly, and the `seedExpense` fixture wraps `createExpenseViaApi` to add
 * teardown cleanup. (There is no Flow class — see the 2026-06-17 remove-flow ADR.)
 */
export interface ExpenseSeedClients {
  expenses:  ExpensesClient;
  contracts: ContractsClient;
}

/** Resolve the contractor's first contract id — mirrors the "first available contract" modal default. */
export async function resolveFirstContractId(contracts: ContractsClient): Promise<number> {
  logVerbose('[seeding] resolveFirstContractId');
  const list = await contracts.listContracts();
  const contractId = list.find((c) => typeof c.id === 'number')?.id;
  if (!contractId) {
    throw new Error(
      'Cannot resolve a contract_id — the worker account has no contracts ' +
        '(GET /api/contract/list returned none).',
    );
  }
  return contractId;
}

/** Create an expense via API: resolve contract → categories → upload receipt → add. */
export async function createExpenseViaApi(
  clients: ExpenseSeedClients,
  data: ExpenseFormData,
  receiptPath: string = RECEIPT_PATH,
): Promise<SeededExpense> {
  logVerbose(`[seeding] createExpenseViaApi ${data.name}`);
  const contractId = await resolveFirstContractId(clients.contracts);
  const categories = await clients.expenses.getCategories(contractId);
  if (categories.length === 0) {
    throw new Error(`No expense categories available for contract ${contractId}`);
  }
  const photo = await clients.expenses.uploadReceipt(receiptPath);
  const id = await clients.expenses.addExpense({
    contract_id: contractId,
    name:        data.name,
    date:        data.date,
    category_id: categories[0].id,
    amount:      Number(data.amount),
    currency_id: CURRENCY_ID.USD,
    photo,
  });
  return { id, name: data.name, amount: data.amount, contractId };
}

/** Resolve an expense id by name substring — used to delete UI-created expenses via API. */
export async function findExpenseIdByName(
  expenses: ExpensesClient,
  name: string,
): Promise<number | undefined> {
  logVerbose(`[seeding] findExpenseIdByName ${name}`);
  const list = await expenses.listContractorExpenses();
  return list.find((e) => typeof e.name === 'string' && e.name.includes(name))?.id;
}
