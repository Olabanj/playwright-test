import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Page Object for the Fixed Contract creation wizard.
 * 4-step flow: Worker Type → Contract Info → Payment → Compliance.
 *
 * Entered directly via `ROUTES.contractCreate` (`/contract/create`, confirmed
 * against the product router `apps/user/src/routes/allRoutes.jsx`) — the
 * sibling of the bulk-import wizard's `ROUTES.bulkCreation`.
 */
export class FixedContractPage extends BasePage {
  // ==== Step 1 — Worker Type ============================================

  readonly contractorCard = this.page.getByText('A Contractor', { exact: true });
  readonly continueButton = this.page.getByRole('button', { name: 'Continue' });
  readonly backButton = this.page.getByRole('button', { name: 'Back' });

  // ==== Step 2 — Contract Info ==========================================

  readonly contractInfoHeading = this.page.getByText('Contract Type');
  readonly fixedTypeCard = this.page.getByText('Fixed', { exact: true });
  readonly taxCountryDropdown = this.page.locator('div').filter({ hasText: /^Select \.\.\.$/ }).first();
  readonly roleInput = this.page.locator('input[name="name"]');
  /** Quill editor class — stable across positions */
  readonly scopeOfWorkEditor = this.page.locator('div.ql-editor');

  // ==== Step 3 — Payment ================================================

  readonly rateAmountInput = this.page.locator('input[name="rate"]').or(this.page.locator('input[name="amount"]'));
  readonly currencyDropdown = this.page.locator('[class*="control"]').filter({ hasText: /USD|AED|EUR|GBP|Select/i }).first();
  readonly frequencyDropdown = this.page.locator('div').filter({ hasText: /^Select \.\.\.$/ }).first();
  readonly rateValidationError = this.page.getByText(/rate.*required|amount.*required|rate.*greater/i);

  // ==== Step 4 — Compliance =============================================

  readonly useRemotepassTemplateCard = this.page.getByRole('button', { name: /use remotepass.*template/i });
  readonly noticePeriodInput = this.page.locator('input[name="notice_period"]');
  readonly createButton = this.page.getByRole('button', { name: /create/i });

  // ==== Wizard chrome ===================================================

  readonly closeWizardButton = this.page.locator('button').filter({ hasText: /×|✕/ })
    .or(this.page.getByRole('button', { name: /close/i }))
    .or(this.page.locator('[aria-label="close"], [aria-label="Close"]'));

  // ==== Validation errors ===============================================

  /**
   * Required-field validation messages render as plain text next to the field
   * (confirmed against the live wizard 2026-07-09: "Role is required",
   * "Scope of work is required") — NOT via an `.error`/`aria-invalid` CSS hook,
   * which never matched (TODO(selector) closed by re-targeting to a
   * user-facing text locator, Playwright best practice, instead of guessing
   * markup classes).
   */
  readonly requiredFieldErrors = this.page.getByText(/is required/i);

  // ==== Navigation Methods ==============================================

  async open(): Promise<void> {
    logVerbose('FixedContractPage.open');
    await this.goto(ROUTES.contractCreate);
    await this.contractorCard.waitFor({ state: 'visible', timeout: 15_000 });
  }

  /** Navigate → select Contractor → select Fixed → fill contract info → land on Payment */
  async navigateToPaymentStep(contractData: {
    taxCountry: string;
    role: string;
    scope: string;
  }): Promise<void> {
    logVerbose('FixedContractPage.navigateToPaymentStep');
    await this.open();
    await this.selectContractorWorkerType();
    await this.selectFixedContractType();
    await this.fillContractInfo(contractData);
  }

  async closeWizard(): Promise<void> {
    logVerbose('FixedContractPage.closeWizard');
    if (await this.closeWizardButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.closeWizardButton.first().click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  // ==== Step Actions ====================================================

  async selectContractorWorkerType(): Promise<void> {
    logVerbose('FixedContractPage.selectContractorWorkerType');
    await this.contractorCard.click();
    await this.continueButton.click();
    await this.waitForContractInfoStep();
  }

  /** Waits for the Contract Info (Step 2) heading — also reappears when navigating Back from Payment. */
  async waitForContractInfoStep(): Promise<void> {
    logVerbose('FixedContractPage.waitForContractInfoStep');
    await this.contractInfoHeading.waitFor({ state: 'visible', timeout: 10000 });
  }

  async selectFixedContractType(): Promise<void> {
    logVerbose('FixedContractPage.selectFixedContractType');
    await this.fixedTypeCard.click();
    await this.roleInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  async fillTaxCountry(country: string): Promise<void> {
    logVerbose(`FixedContractPage.fillTaxCountry country=${country}`);
    await this.taxCountryDropdown.click();
    await this.page.locator('[class*="menu"]').first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await this.page.keyboard.type(country);
    const option = this.page.locator('[class*="option"]').filter({ hasText: country }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
  }

  async fillContractInfo(data: { taxCountry: string; role: string; scope: string }): Promise<void> {
    logVerbose(`FixedContractPage.fillContractInfo role=${data.role}`);
    await this.fillTaxCountry(data.taxCountry);
    await this.roleInput.fill(data.role);
    if (await this.scopeOfWorkEditor.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.scopeOfWorkEditor.click();
      await this.page.keyboard.type(data.scope);
    }
    await this.continueButton.click();
    await this.page.getByText(/payment/i).first().waitFor({ state: 'visible', timeout: 10000 });
  }

  async fillPaymentDetails(data: { rate: string | number; frequency?: string }): Promise<void> {
    logVerbose(`FixedContractPage.fillPaymentDetails rate=${data.rate}`);
    await this.rateAmountInput.fill(String(data.rate));

    const freq = data.frequency ?? 'Every month';
    await this.frequencyDropdown.click();
    const freqOption = this.page.getByText(freq, { exact: true });
    await freqOption.waitFor({ state: 'visible', timeout: 5000 });
    await freqOption.click();

    await this.selectFirstAvailableDropdown();
    await this.selectFirstAvailableDropdown();
  }

  private async selectFirstAvailableDropdown(): Promise<void> {
    logVerbose('FixedContractPage.selectFirstAvailableDropdown');
    const dropdown = this.page.locator('div').filter({ hasText: /^Select \.\.\.$/ }).first();
    if (await dropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dropdown.click();
      const option = this.page.locator('[class*="option"], [role="option"]').first();
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
    }
  }

  async proceedFromPaymentStep(): Promise<void> {
    logVerbose('FixedContractPage.proceedFromPaymentStep');
    await this.continueButton.click();
    await this.noticePeriodInput
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(async () => {
        await this.useRemotepassTemplateCard.waitFor({ state: 'visible', timeout: 15000 });
      });
  }

  async fillComplianceStep(noticePeriodDays: number): Promise<void> {
    logVerbose(`FixedContractPage.fillComplianceStep noticePeriodDays=${noticePeriodDays}`);
    if (await this.useRemotepassTemplateCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.useRemotepassTemplateCard.click();
      await this.noticePeriodInput.waitFor({ state: 'visible', timeout: 5000 });
    }
    if (await this.noticePeriodInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.noticePeriodInput.fill(String(noticePeriodDays));
    }
    const urlBefore = this.page.url();
    await this.createButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.createButton.click();
    await this.page.waitForURL((url) => url.toString() !== urlBefore, { timeout: 20_000 })
      .catch(() => {
        logVerbose(`FixedContractPage.fillComplianceStep waitForURL timed out — current: ${this.page.url()}`);
      });
  }

  // ==== URL Parsing =====================================================

  extractContractRef(url: string): string | null {
    logVerbose(`FixedContractPage.extractContractRef url=${url}`);
    const reserved = ['create', 'new', 'edit', 'list', 'detail', 'undefined'];

    const qpMatch = url.match(/[?&]id=([A-Za-z0-9]+)/i);
    if (qpMatch && !reserved.includes(qpMatch[1].toLowerCase())) return qpMatch[1];

    const pathMatch = url.match(/\/contract[s]?\/([A-Za-z0-9]+)/i);
    if (pathMatch && !reserved.includes(pathMatch[1].toLowerCase())) return pathMatch[1];

    return null;
  }

  // ==== Full Wizard Flow ================================================

  async createFixedContract(data: {
    taxCountry: string;
    role: string;
    scope: string;
    rate: string | number;
    noticePeriodDays?: number;
  }): Promise<string | null> {
    logVerbose(`FixedContractPage.createFixedContract role=${data.role}`);

    await this.navigateToPaymentStep({
      taxCountry: data.taxCountry,
      role: data.role,
      scope: data.scope,
    });
    await this.fillPaymentDetails({ rate: data.rate });
    await this.proceedFromPaymentStep();
    await this.fillComplianceStep(data.noticePeriodDays ?? 30);

    await this.page.waitForLoadState('domcontentloaded');
    return this.extractContractRef(this.page.url());
  }

  // ==== Verification ====================================================

  async getRateValue(): Promise<string> {
    logVerbose('FixedContractPage.getRateValue');
    const raw = await this.rateAmountInput.inputValue();
    return raw.replace(/^[A-Z]{2,4}\s+/, '').replace(/,/g, '').trim();
  }
}
