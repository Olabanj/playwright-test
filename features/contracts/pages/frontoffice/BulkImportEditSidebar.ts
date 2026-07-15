import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { logVerbose } from '@utils/helpers/logger';

/**
 * BulkImportEditSidebar covers the edit sidebar panel on the Bulk Import Review page.
 * The sidebar is a <navigation> element containing:
 * - Worker details (name, country, CoR toggle, email, job title/description)
 * - Payment details (currency, amount, frequency, occurrence)
 * - Contract details (dates, notice period, signatory)
 * - Worker agreement (template selection)
 * - Action buttons (Delete, Cancel, Save)
 *
 * All locators scoped to the sidebar navigation element to avoid
 * collisions with identically-named fields in the table.
 *
 * Locators + actions only — assertions live in the spec.
 */
export class BulkImportEditSidebar extends BasePage {
  // ==================== Locators: Container ====================

  readonly panel        = this.page.getByRole('navigation');
  readonly closeButton  = this.panel.getByRole('button', { name: 'Close' });

  // ==================== Locators: Worker Details ====================

  /**
   * Full name input in the sidebar.
   * Replaces `verifyFullName(name)` — spec: `await expect(pom.fullNameInput).toHaveValue(name)`.
   */
  readonly fullNameInput      = this.panel.getByRole('textbox', { name: 'Full name' });
  readonly taxCountryCombobox = this.panel.getByRole('combobox').first();
  readonly corToggle          = this.panel.getByRole('checkbox');

  /**
   * Email input in the sidebar.
   * Replaces `verifyEmail(email)` — spec: `await expect(pom.emailInput).toHaveValue(email)`.
   */
  readonly emailInput = this.panel.getByRole('textbox', { name: 'Email' });

  /**
   * Job title input in the sidebar.
   * Replaces `verifyJobTitle(title)` — spec: `await expect(pom.jobTitleInput).toHaveValue(title)`.
   */
  readonly jobTitleInput         = this.panel.getByRole('textbox', { name: 'Job title' });
  readonly jobDescriptionInput   = this.panel.getByRole('textbox', { name: 'Job description' });

  // ==================== Locators: Payment ====================

  /**
   * Payment amount input in the sidebar.
   * Replaces `verifyPaymentAmount(amount)` — spec: `await expect(pom.paymentAmountInput).toHaveValue(amount)`.
   */
  readonly paymentAmountInput = this.panel.getByRole('textbox', { name: 'Payment amount' });

  // ==================== Locators: Contract ====================

  readonly noticePeriodInput  = this.panel.getByRole('spinbutton', { name: 'Notice period' });
  readonly signatoryCombobox  = this.panel.getByRole('combobox').last();

  // ==================== Locators: Worker Agreement ====================

  readonly remotePassTemplateRadio = this.panel.getByLabel('RemotePass Template');
  readonly uploadMyContractRadio   = this.panel.getByLabel('Upload My Contract');
  readonly useMyTemplateRadio      = this.panel.getByLabel('Use my template');

  // ==================== Locators: Action Buttons ====================

  readonly deleteButton = this.panel.getByRole('button', { name: 'Delete' });
  readonly cancelButton = this.panel.getByRole('button', { name: 'Cancel' });
  readonly saveButton   = this.panel.getByRole('button', { name: 'Save' });

  // ==================== Visibility locators (replaces verifyVisible / verifyHidden) ====================

  /**
   * The sidebar element itself — exposed so specs can assert `.toBeVisible()` / `.toBeHidden()`.
   * Replaces `verifyVisible()` and `verifyHidden()`.
   */
  get sidebarLocator(): Locator {
    return this.panel;
  }

  /**
   * CoR toggle — exposed so specs can assert `.toBeChecked()` / `.not.toBeChecked()`.
   * Replaces `verifyCorChecked(checked)`.
   */
  get corToggleLocator(): Locator {
    return this.corToggle;
  }

  // ==================== Actions: Worker Details ====================

  async fillFullName(name: string): Promise<void> {
    logVerbose(`Filling sidebar Full name: ${name}`);
    await this.fullNameInput.fill(name);
  }

  async selectTaxCountry(country: string): Promise<void> {
    logVerbose(`Selecting sidebar Tax country: ${country}`);
    const combobox = this.taxCountryCombobox;
    await combobox.click();
    await combobox.fill(country);
    await this.page.getByRole('option', { name: country }).click();
  }

  async toggleCor(enable: boolean): Promise<void> {
    logVerbose(`${enable ? 'Enabling' : 'Disabling'} CoR in sidebar`);
    await this.corToggle.scrollIntoViewIfNeeded();
    if (enable) {
      await this.corToggle.check({ force: true });
    } else {
      await this.corToggle.uncheck({ force: true });
    }
  }

  async fillEmail(email: string): Promise<void> {
    logVerbose(`Filling sidebar Email: ${email}`);
    await this.emailInput.fill(email);
  }

  async fillJobTitle(title: string): Promise<void> {
    logVerbose(`Filling sidebar Job title: ${title}`);
    await this.jobTitleInput.fill(title);
  }

  async fillJobDescription(description: string): Promise<void> {
    logVerbose(`Filling sidebar Job description: ${description}`);
    await this.jobDescriptionInput.fill(description);
  }

  // ==================== Actions: Payment ====================

  async fillPaymentAmount(amount: string): Promise<void> {
    logVerbose(`Filling sidebar Payment amount: ${amount}`);
    await this.paymentAmountInput.fill(amount);
  }

  // ==================== Actions: Contract ====================

  async selectSignatory(email: string): Promise<void> {
    logVerbose(`Selecting sidebar Signatory: ${email}`);
    const combobox = this.signatoryCombobox;
    await combobox.click();
    await combobox.fill(email);
    await this.page.locator('[role="option"]').filter({ hasText: email }).click();
  }

  // ==================== Actions: Buttons ====================

  async clickSave(): Promise<void> {
    logVerbose('Clicking sidebar Save');
    await this.saveButton.click();
    await this.panel.waitFor({ state: 'hidden' });
  }

  async clickCancel(): Promise<void> {
    logVerbose('Clicking sidebar Cancel');
    await this.cancelButton.click();
    await this.panel.waitFor({ state: 'hidden' });
  }

  async clickDelete(): Promise<void> {
    logVerbose('Clicking sidebar Delete');
    await this.deleteButton.click();
    await this.panel.waitFor({ state: 'hidden' });
  }

  async clickClose(): Promise<void> {
    logVerbose('Clicking sidebar Close');
    await this.closeButton.click();
    await this.panel.waitFor({ state: 'hidden' });
  }
}
