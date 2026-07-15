import { BasePage } from '@core/ui/BasePage';
import { logVerbose } from '@utils/helpers/logger';
import { ExpenseFormData } from '@features/expenses/builders/expense.builder';
import { RECEIPT_PATH } from '@features/expenses/constants';

/**
 * "Add expense" modal — react-select dropdowns (Contract, Category, Currency),
 * a react-datepicker Date field, amount, and receipt upload.
 * Locators + actions only — no assertions.
 */
export class AddExpenseModal extends BasePage {
  readonly modal             = this.page.locator('.modal-dialog');
  readonly modalTitle        = this.page.locator('.modal-title').filter({ hasText: 'Add expense' });
  readonly nameInput         = this.page.locator('[data-test-id="cntl-input-expense"]');
  readonly datePickerTrigger = this.modal.locator('.react-datepicker__input-container button[tabindex="0"]');
  readonly datePickerDisplay = this.modal.locator('.react-datepicker__input-container span');
  readonly amountInput       = this.page.locator('input[name="amount"]');
  readonly currencyDropdown  = this.page.locator('[name="currency_id"]').locator('..');
  readonly contractDropdown  = this.page.locator('[name="contract"]').locator('..');
  readonly categoryDropdown  = this.page.locator('[name="category_id"]').locator('..');
  readonly receiptInput      = this.modal.locator('input[type="file"]');
  readonly submitButton      = this.modal.locator('button[type="submit"]').filter({ hasText: 'Submit' });
  readonly cancelButton      = this.modal.locator('button').filter({ hasText: 'Cancel' });

  async waitVisible(): Promise<void> {
    await this.modalTitle.waitFor({ state: 'visible' });
  }

  async waitClosed(): Promise<void> {
    await this.modal.waitFor({ state: 'hidden' });
  }

  async fillName(name: string): Promise<void> {
    logVerbose(`Fill expense name: ${name}`);
    await this.nameInput.fill(name);
  }

  /** Open the calendar and pick the day from a YYYY-MM-DD date; skip if already set. */
  async selectDate(date: string): Promise<void> {
    logVerbose(`Select date: ${date}`);
    const current = await this.datePickerDisplay.textContent();
    if (current?.trim() === date) return;
    await this.datePickerTrigger.click();
    const day = parseInt(date.split('-')[2], 10).toString();
    await this.page
      .locator('.react-datepicker')
      .locator('.react-datepicker__day:not(.react-datepicker__day--outside-month)')
      .filter({ hasText: new RegExp(`^${day}$`) })
      .click();
  }

  async fillAmount(amount: string): Promise<void> {
    logVerbose(`Fill amount: ${amount}`);
    await this.amountInput.fill(amount);
  }

  async selectCurrency(currency: string): Promise<void> {
    logVerbose(`Select currency: ${currency}`);
    await this.currencyDropdown.click();
    await this.page.getByRole('option', { name: currency }).click();
  }

  async selectFirstContract(): Promise<void> {
    logVerbose('Select first contract');
    await this.contractDropdown.click();
    await this.page.getByRole('option').first().click();
  }

  async selectFirstCategory(): Promise<void> {
    logVerbose('Select first category');
    await this.categoryDropdown.click();
    await this.page.getByRole('option').first().click();
  }

  async uploadReceipt(filePath: string = RECEIPT_PATH): Promise<void> {
    logVerbose(`Upload receipt: ${filePath}`);
    await this.receiptInput.setInputFiles(filePath);
  }

  async submit(): Promise<void> {
    logVerbose('Submit expense form');
    await this.submitButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  /** Fill all fields; selects the first available Contract and Category. */
  async fillForm(data: ExpenseFormData): Promise<void> {
    await this.selectFirstContract();
    await this.fillName(data.name);
    await this.selectDate(data.date);
    await this.selectFirstCategory();
    await this.fillAmount(data.amount);
    await this.selectCurrency(data.currency);
    await this.uploadReceipt();
  }
}
