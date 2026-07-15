import { DEFAULT_CURRENCY_LABEL } from '../constants';

/** UI-facing expense form data (what the Add Expense modal needs). */
export interface ExpenseFormData {
  name:     string;
  date:     string;   // YYYY-MM-DD
  amount:   string;   // 2-decimal string
  currency: string;   // UI dropdown label, e.g. 'US Dollar'
}

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Random 2-decimal amount in [10, 500], matching the legacy faker range. */
function randomAmount(): string {
  return (Math.random() * 490 + 10).toFixed(2);
}

/**
 * Fluent builder for expense form data. No HTTP — pure data construction.
 * Defaults give a unique timestamped name so parallel runs don't collide.
 */
export class ExpenseBuilder {
  private data: Partial<ExpenseFormData> = {};

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withDate(date: string): this {
    this.data.date = date;
    return this;
  }

  withAmount(amount: string): this {
    this.data.amount = amount;
    return this;
  }

  withCurrency(currency: string): this {
    this.data.currency = currency;
    return this;
  }

  build(): ExpenseFormData {
    return {
      name:     `PW ${Date.now()}`,
      date:     today(),
      amount:   randomAmount(),
      currency: DEFAULT_CURRENCY_LABEL,
      ...this.data,
    };
  }
}
