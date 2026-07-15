import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Page Object for the PAYG Contract creation wizard.
 * 4-step flow: Worker Type → Contract Info → Payment → Compliance.
 *
 * Entered directly via `ROUTES.contractCreate` (`/contract/create`) — the
 * sibling of the bulk-import wizard's `ROUTES.bulkCreation`.
 */
export class PaygContractPage extends BasePage {
  // ==== Step 1 — Worker Type ============================================

  readonly contractorCard = this.page.getByText('A Contractor', { exact: true });
  readonly continueButton = this.page.getByRole('button', { name: 'Continue' });
  readonly backButton = this.page.getByRole('button', { name: 'Back' });

  // ==== Step 2 — Contract Info ==========================================

  /** Exact match avoids false positives from substrings */
  readonly paygTypeCard = this.page.getByText('Pay as you go', { exact: true });

  /** Scoped to the tax-residence section to avoid matching other "Select ..." dropdowns */
  readonly taxCountryDropdown = this.page.locator('div')
    .filter({ has: this.page.getByText(/tax residence|tax country/i) })
    .locator('[class*="control"]').first();

  readonly roleInput = this.page.locator('input[name="name"]');
  /** Quill editor class — stable across positions */
  readonly scopeOfWorkEditor = this.page.locator('div.ql-editor').first();

  // ==== Step 3 — Payment ================================================

  readonly rateAmountInput = this.page.locator('input[name="rate"]').or(this.page.locator('input[name="amount"]'));
  readonly rateValidationError = this.page.getByText(/rate.*required|amount.*required|rate.*greater/i);
  /** CSS-class based — targets react-select placeholder elements */
  readonly pendingSelectDropdown = this.page.locator('[class*="placeholder"]')
    .filter({ hasText: 'Select' }).first();

  // ==== Step 4 — Compliance =============================================

  readonly useRemotepassTemplateCard = this.page.getByRole('button', { name: /use remotepass.*template/i });
  readonly noticePeriodInput = this.page.locator('input[name="notice_period"]');
  readonly createButton = this.page.getByRole('button', { name: /create/i });

  // ==== Wizard chrome ===================================================

  readonly closeWizardButton = this.page.getByRole('button', { name: 'Close' });

  // ==== Validation errors ===============================================

  /**
   * Required-field validation messages render as plain text next to the field
   * (confirmed against the live wizard, same pattern as `FixedContractPage`) —
   * NOT via a `[class~="error"]`/`[aria-invalid]` CSS hook, which never matched.
   */
  readonly requiredFieldErrors = this.page.getByText(/is required/i);

  // ==== Navigation Methods ==============================================

  async open(): Promise<void> {
    logVerbose('PaygContractPage.open');
    await this.goto(ROUTES.contractCreate);
    await this.contractorCard.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async navigateToPaygForm(): Promise<void> {
    logVerbose('PaygContractPage.navigateToPaygForm');
    await this.open();
    await this.selectContractorWorkerType();
    await this.selectPaygContractType();
  }

  async closeWizard(): Promise<void> {
    logVerbose('PaygContractPage.closeWizard');
    if (await this.closeWizardButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.closeWizardButton.click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  // ==== Step Actions ====================================================

  async selectContractorWorkerType(): Promise<void> {
    logVerbose('PaygContractPage.selectContractorWorkerType');
    await this.contractorCard.click();
    await this.continueButton.click();
    await this.page.getByText('Contract Type').waitFor({ state: 'visible', timeout: 10000 });
  }

  /** Waits for Contract Info form to render after clicking PAYG card */
  async selectPaygContractType(): Promise<void> {
    logVerbose('PaygContractPage.selectPaygContractType');
    await this.paygTypeCard.click();
    await this.roleInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  /** Waits for react-select menu to open before typing */
  async fillTaxCountry(country: string): Promise<void> {
    logVerbose(`PaygContractPage.fillTaxCountry country=${country}`);
    await this.taxCountryDropdown.click();
    await this.page.locator('[class*="menu"]').first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await this.page.keyboard.type(country);
    const option = this.page.locator('[class*="option"]').filter({ hasText: country }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
  }

  async fillContractInfo(data: { taxCountry: string; role: string; scope: string }): Promise<void> {
    logVerbose(`PaygContractPage.fillContractInfo role=${data.role}`);
    await this.fillTaxCountry(data.taxCountry);
    await this.roleInput.fill(data.role);
    if (await this.scopeOfWorkEditor.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.scopeOfWorkEditor.click();
      await this.page.keyboard.type(data.scope);
    }
    await this.continueButton.click();
    await this.page.getByText(/payment/i).first().waitFor({ state: 'visible', timeout: 10000 });
  }

  async selectNextPendingDropdown(): Promise<boolean> {
    logVerbose('PaygContractPage.selectNextPendingDropdown');
    if (!(await this.pendingSelectDropdown.isVisible({ timeout: 2000 }).catch(() => false))) return false;
    await this.pendingSelectDropdown.click();
    const option = this.page.locator('[class*="option"]').first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    return true;
  }

  async fillPaymentDetails(data: { rate: string | number }): Promise<void> {
    logVerbose(`PaygContractPage.fillPaymentDetails rate=${data.rate}`);
    await this.rateAmountInput.fill(String(data.rate));

    const MAX_CASCADING = 6;
    for (let i = 0; i < MAX_CASCADING; i++) {
      const selected = await this.selectNextPendingDropdown();
      if (!selected) break;
    }
  }

  async proceedFromPaymentStep(): Promise<void> {
    logVerbose('PaygContractPage.proceedFromPaymentStep');
    await this.continueButton.click();
    await this.page.getByText(/compliance/i).first()
      .waitFor({ state: 'visible', timeout: 10000 });
  }

  async fillComplianceStep(noticePeriodDays: number): Promise<void> {
    logVerbose(`PaygContractPage.fillComplianceStep noticePeriodDays=${noticePeriodDays}`);
    if (await this.useRemotepassTemplateCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.useRemotepassTemplateCard.click();
    }
    if (await this.noticePeriodInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.noticePeriodInput.fill(String(noticePeriodDays));
    }
    await this.createButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.createButton.click();
    await this.createButton.waitFor({ state: 'hidden', timeout: 30000 });
  }

  // ==== URL Parsing ======================================================

  /**
   * Extract contract ref from post-creation URL.
   * Primary: ?id=REFID query param (confirmed pattern).
   * Fallback: /contract(s)/REFID path segment.
   */
  extractContractRef(url: string): string | null {
    logVerbose(`PaygContractPage.extractContractRef url=${url}`);
    const reserved = ['create', 'new', 'edit', 'list', 'detail', 'undefined'];

    const qpMatch = url.match(/[?&]id=([A-Za-z0-9]+)/i);
    if (qpMatch && !reserved.includes(qpMatch[1].toLowerCase())) return qpMatch[1];

    const pathMatch = url.match(/\/contract[s]?\/([A-Za-z0-9]+)/i);
    if (pathMatch && !reserved.includes(pathMatch[1].toLowerCase())) return pathMatch[1];

    return null;
  }

  // ==== Full Wizard Flow ================================================

  async createPaygContract(data: {
    taxCountry: string;
    role: string;
    scope: string;
    rate: string | number;
    noticePeriodDays?: number;
  }): Promise<string | null> {
    logVerbose(`PaygContractPage.createPaygContract role=${data.role}`);

    await this.navigateToPaygForm();
    await this.fillContractInfo({
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
    logVerbose('PaygContractPage.getRateValue');
    const raw = await this.rateAmountInput.inputValue();
    return raw.replace(/^[A-Z]{2,4}\s+/, '').replace(/,/g, '').trim();
  }
}
