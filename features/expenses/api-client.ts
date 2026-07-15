import * as fs from 'fs';
import { BaseApiClient } from '@core/http/BaseApiClient';
import { assertOk, assertOkWithId } from '@core/http/assertOk';
import { ENDPOINTS } from '@core/config/endpoints';
import { logVerbose } from '@utils/helpers/logger';
import {
  AddExpensePayload,
  AddResponse,
  Category,
  ContractorExpense,
  Currency,
  ListWrapper,
  MutationResponse,
  UploadResponse,
} from './types';

/**
 * Typed HTTP client for the expenses API. One method = one request.
 * Endpoints confirmed via rp-scribe (G6) 2026-06-16.
 */
export class ExpensesClient extends BaseApiClient {
  private static asArray<T>(body: ListWrapper<T> | T[] | undefined): T[] {
    if (Array.isArray(body)) return body;
    return body?.data ?? [];
  }

  async getCategories(contractId: number): Promise<Category[]> {
    logVerbose(`[ExpensesClient] getCategories contractId=${contractId}`);
    const res = await this.get<ListWrapper<Category> | Category[]>(
      ENDPOINTS.expenses.categories(contractId),
    );
    return ExpensesClient.asArray<Category>(res.body).map((c) => ({ id: c.id, name: c.name }));
  }

  async getCurrencies(): Promise<Currency[]> {
    const res = await this.get<ListWrapper<Currency> | Currency[]>(ENDPOINTS.expenses.currencies);
    return ExpensesClient.asArray<Currency>(res.body).map((c) => ({ id: c.id, code: c.code }));
  }

  async listContractorExpenses(): Promise<ContractorExpense[]> {
    const res = await this.get<ListWrapper<ContractorExpense> | ContractorExpense[]>(
      ENDPOINTS.expenses.listContractor,
    );
    return ExpensesClient.asArray<ContractorExpense>(res.body);
  }

  /** Multipart upload (field 'photo'); returns the stored path string. */
  async uploadReceipt(filePath: string): Promise<string> {
    logVerbose(`[ExpensesClient] uploadReceipt file=${filePath}`);
    const res = await this.postMultipart<UploadResponse>(ENDPOINTS.expenses.upload, {
      photo: { name: 'receipt.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(filePath) },
    });
    assertOk(res, 'uploadReceipt');
    const photoPath = res.body.data?.path ?? res.body.path;
    if (!photoPath) {
      throw new Error(`uploadReceipt returned no path (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return photoPath;
  }

  /** Submit an expense; returns the new expense id. */
  async addExpense(payload: AddExpensePayload): Promise<number> {
    logVerbose(`[ExpensesClient] addExpense contract=${payload.contract_id} amount=${payload.amount}`);
    const res = await this.post<AddResponse>(ENDPOINTS.expenses.add, payload);
    return assertOkWithId(res, 'addExpense');
  }

  async approveExpense(expenseId: number): Promise<void> {
    logVerbose(`[ExpensesClient] approveExpense id=${expenseId}`);
    const res = await this.post<MutationResponse>(ENDPOINTS.expenses.approve, { expense_id: expenseId });
    assertOk(res, 'approveExpense');
  }

  async deleteExpense(expenseId: number): Promise<void> {
    logVerbose(`[ExpensesClient] deleteExpense id=${expenseId}`);
    const res = await this.post<MutationResponse>(ENDPOINTS.expenses.delete, { expense_id: expenseId });
    assertOk(res, 'deleteExpense');
  }
}
