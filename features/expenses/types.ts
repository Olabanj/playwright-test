// Single source of truth for expense-domain request/response shapes.
// Imported by ExpensesClient (HTTP shapes) and the expenses seeding helpers.

/** Expense category as exposed per contract. */
export interface Category {
  id:   number;
  name: string;
}

/** Platform currency. */
export interface Currency {
  id:   number;
  code: string;
}

/** Request body for POST /api/contract/expense/add. */
export interface AddExpensePayload {
  contract_id: number;
  name:        string;
  date:        string;   // YYYY-MM-DD
  category_id: number;
  amount:      number;
  currency_id: number;
  photo?:      string;   // path returned by the receipt upload
}

/** One expense as returned by GET /api/contract/expense/list/contractor. */
export interface ContractorExpense {
  id:           number;
  name?:        string;
  contract_id?: number;
  [key: string]: unknown;
}

// --- Loose wire-response wrappers (the API nests under `data`, sometimes flat). ---
export interface ListWrapper<T>   { data?: T[]; }
export interface UploadResponse   { success?: boolean; data?: { path?: string }; path?: string; }
export interface AddResponse      { success?: boolean; data?: { id?: number }; id?: number; }
export interface MutationResponse { success?: boolean; }

/** Result of seeding an expense via API (see seeding.ts and the seedExpense fixture). */
export interface SeededExpense {
  id:         number;
  name:       string;
  amount:     string;
  contractId: number;
}
