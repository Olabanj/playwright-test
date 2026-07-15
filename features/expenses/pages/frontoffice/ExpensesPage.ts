import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Contractor Expenses list page (/expenses): table, "Add Expense" button, and
 * row-level navigation. Locators + actions only — assertions live in the spec.
 *
 * Navigation uses 'domcontentloaded' (not networkidle): the SPA keeps
 * persistent connections open, so the network never idles.
 */
export class ExpensesPage extends BasePage {
  readonly pageTitle        = this.page.locator('h1').filter({ hasText: 'Expenses' });
  readonly addExpenseButton = this.page.locator('button[title="Add Expense"]');
  readonly tableHeaders     = this.page.locator('thead th');
  readonly tableRows        = this.page.locator('table tbody tr');

  async open(): Promise<void> {
    logVerbose('ExpensesPage.open');
    await this.goto(ROUTES.expenses);
  }

  async clickAddExpense(): Promise<void> {
    logVerbose('Click Add Expense');
    await this.addExpenseButton.click();
  }

  headerCell(text: string): Locator {
    return this.tableHeaders.filter({ hasText: text });
  }

  rowByName(name: string): Locator {
    return this.tableRows.filter({ hasText: name });
  }

  async clickDetailsForExpense(name: string): Promise<void> {
    logVerbose(`Open details for expense "${name}"`);
    await this.rowByName(name).locator('a, button').filter({ hasText: 'Details' }).click();
  }
}
