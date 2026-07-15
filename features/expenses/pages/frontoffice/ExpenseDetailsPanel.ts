import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Expense details side panel (a <nav> with a "Details" heading) shown when
 * clicking "Details" on a row. Exposes status/amount/name and the delete flow.
 * Locators + actions only — assertions live in the spec.
 */
export class ExpenseDetailsPanel extends BasePage {
  readonly panel = this.page
    .locator('nav')
    .filter({ has: this.page.getByRole('heading', { name: 'Details' }) });

  readonly detailsHeading       = this.panel.getByRole('heading', { name: 'Details' });
  readonly closeButton          = this.panel.getByRole('button', { name: 'Close' });
  readonly expenseName          = this.panel.locator('p').first();
  readonly receiptPreviewButton = this.panel.getByRole('button', { name: 'Preview' });
  readonly deleteExpenseButton  = this.panel.getByRole('button', { name: 'Delete Expense' });

  readonly deleteConfirmationModal = this.page
    .locator('.modal-dialog')
    .filter({ hasText: 'Delete Expense' });

  readonly confirmDeleteButton = this.deleteConfirmationModal.getByRole('button', { name: 'Confirm Delete' });
  readonly cancelDeleteButton  = this.deleteConfirmationModal.getByRole('button', { name: 'Cancel' });

  /** The text following a labelled field ("Status", "Amount") in the panel. */
  fieldValue(label: string): Locator {
    return this.panel
      .locator('p')
      .filter({ hasText: new RegExp(`^${label}$`) })
      .locator('xpath=ancestor::*[2]')
      .locator('> *:last-child');
  }

  statusBadge(status: string): Locator {
    return this.panel.getByText(status);
  }

  async waitVisible(): Promise<void> {
    await this.detailsHeading.waitFor({ state: 'visible' });
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }

  async deleteExpense(): Promise<void> {
    logVerbose('Delete expense (click + confirm)');
    await this.deleteExpenseButton.click();
    await this.confirmDeleteButton.click();
    await this.deleteConfirmationModal.waitFor({ state: 'hidden' });
  }
}
