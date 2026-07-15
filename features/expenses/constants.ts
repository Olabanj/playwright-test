import path from 'path';

/**
 * Status vocabulary differs by surface — the list table shows 'Pending' while the
 * details panel shows 'Pending approval'. Both are preserved intentionally.
 */
export const EXPENSE_STATUS = {
  PENDING:          'Pending',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED:         'Approved',
  REJECTED:         'Rejected',
} as const;

export type ExpenseStatus = (typeof EXPENSE_STATUS)[keyof typeof EXPENSE_STATUS];

/** Static currency ids (others resolved dynamically via GET /api/static/currencies). */
export const CURRENCY_ID = { USD: 1, EUR: 2, GBP: 3, AED: 4 } as const;

/** UI dropdown label for the default currency. */
export const DEFAULT_CURRENCY_LABEL = 'US Dollar';

/** Dummy receipt PDF used for both API uploads and UI file inputs. */
export const RECEIPT_PATH = path.resolve(
  process.cwd(),
  'features/expenses/fixtures/files/test-document.pdf',
);
