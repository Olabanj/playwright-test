import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Page Object for the Milestones Contract creation wizard.
 * 4-step flow: Worker Type → Contract Info → Payment → Compliance.
 *
 * Entered directly via `ROUTES.contractCreate` (`/contract/create`) — the
 * sibling of the bulk-import wizard's `ROUTES.bulkCreation`.
 */
export class MilestonesContractPage extends BasePage {
  // ==== Step 1 — Worker Type ============================================

  readonly contractorCard = this.page.getByText('A Contractor', { exact: true });
  readonly continueButton = this.page.getByRole('button', { name: 'Continue' });
  readonly backButton = this.page.getByRole('button', { name: 'Back' });

  // ==== Step 2 — Contract Info ==========================================

  readonly milestonesTypeCard = this.page.getByRole('button', { name: /milestones/i });
  readonly taxCountryDropdown = this.page.locator('div').filter({ hasText: /^Select \.\.\.$/ }).first();
  readonly roleInput = this.page.locator('input[name="name"]');
  /**
   * Scope of Work uses a Quill rich-text editor; .ql-editor is more stable
   * than div[contenteditable="true"].first() which is position-dependent.
   */
  readonly scopeOfWorkEditor = this.page.locator('div.ql-editor');

  // ==== Step 3 — Payment ================================================

  readonly addMilestoneButton = this.page.getByRole('button', { name: /add milestone/i });

  milestoneNameInput(index: number): Locator {
    return this.page.locator(`input[name="milestones.${index}.name"]`);
  }

  milestoneAmountInput(index: number): Locator {
    return this.page.locator(`input[name="milestones.${index}.amount"]`);
  }

  /** Target delete buttons by list order to align with milestone index */
  milestoneDeleteButton(index: number): Locator {
    return this.page
      .locator(
        [
          'button[aria-label*="delete" i]',
          'button[aria-label*="remove" i]',
          'button[data-testid*="delete" i]',
          'button[data-testid*="remove" i]',
          'button:has(svg[aria-label*="delete" i])',
          'button:has(svg[title*="delete" i])',
          'button:has([data-icon="trash"])',
        ].join(', '),
      )
      .nth(index);
  }

  readonly milestoneNameError = this.page.getByText("Milestone name can't be empty");
  readonly milestoneAmountError = this.page.getByText('Milestone amount must be greater than 0');

  // ==== Step 4 — Compliance =============================================

  readonly useRemotepassTemplateCard = this.page.getByRole('button', { name: /use remotepass.*template/i });
  readonly noticePeriodInput = this.page.locator('input[name="notice_period"]');
  readonly createButton = this.page.getByRole('button', { name: 'Create' });

  // ==== Wizard chrome ===================================================

  readonly closeWizardButton = this.page.locator('button').filter({ hasText: /×|✕/ })
    .or(this.page.getByRole('button', { name: /close/i }))
    .or(this.page.locator('[aria-label="close"], [aria-label="Close"]'));

  // ==== Navigation Methods ==============================================

  async open(): Promise<void> {
    logVerbose('MilestonesContractPage.open');
    await this.goto(ROUTES.contractCreate);
    await this.contractorCard.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async closeWizard(): Promise<void> {
    logVerbose('MilestonesContractPage.closeWizard');
    if (await this.closeWizardButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.closeWizardButton.first().click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /**
   * Navigate, walk through worker-type and contract-type steps, fill contract
   * info, and land on the Payment step. Used by most verify tests to avoid
   * repetition.
   */
  async navigateToPaymentStep(contractData: {
    taxCountry: string;
    role: string;
    scope: string;
  }): Promise<void> {
    logVerbose('MilestonesContractPage.navigateToPaymentStep');
    await this.open();
    await this.selectContractorWorkerType();
    await this.selectMilestonesContractType();
    await this.fillContractInfo(contractData);
  }

  // ==== Step Actions ====================================================

  async selectContractorWorkerType(): Promise<void> {
    logVerbose('MilestonesContractPage.selectContractorWorkerType');
    await this.contractorCard.click();
    await this.continueButton.click();
    await this.milestonesTypeCard.waitFor({ state: 'visible', timeout: 10000 });
  }

  async selectMilestonesContractType(): Promise<void> {
    logVerbose('MilestonesContractPage.selectMilestonesContractType');
    await this.milestonesTypeCard.click();
    await this.roleInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  async fillTaxCountry(country: string): Promise<void> {
    logVerbose(`MilestonesContractPage.fillTaxCountry country=${country}`);
    await this.taxCountryDropdown.click();
    // Wait for the react-select menu to open before typing
    const menu = this.page.locator('[class*="menu"]').first();
    await menu.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.keyboard.type(country);
    // Wait for the filtered option to appear before clicking
    const option = this.page.locator('[class*="option"]').filter({ hasText: country }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await menu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  async fillContractInfo(data: { taxCountry: string; role: string; scope: string }): Promise<void> {
    logVerbose(`MilestonesContractPage.fillContractInfo role=${data.role}`);
    await this.fillTaxCountry(data.taxCountry);
    await this.roleInput.fill(data.role);
    if (await this.scopeOfWorkEditor.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.scopeOfWorkEditor.click();
      await this.page.keyboard.type(data.scope);
    }
    await this.continueButton.click();
    await this.addMilestoneButton.waitFor({ state: 'visible', timeout: 10000 });
  }

  async addMilestone(name: string, amount: number | string, index: number): Promise<void> {
    logVerbose(`MilestonesContractPage.addMilestone index=${index} name=${name} amount=${amount}`);
    await this.addMilestoneButton.click();
    await this.milestoneNameInput(index).waitFor({ state: 'visible', timeout: 5000 });
    await this.milestoneNameInput(index).fill(name);
    await this.milestoneAmountInput(index).fill(String(amount));
  }

  async editMilestone(index: number, name: string, amount: number | string): Promise<void> {
    logVerbose(`MilestonesContractPage.editMilestone index=${index} name=${name} amount=${amount}`);
    await this.milestoneNameInput(index).fill(name);
    await this.milestoneAmountInput(index).fill(String(amount));
  }

  async deleteMilestone(index: number): Promise<void> {
    logVerbose(`MilestonesContractPage.deleteMilestone index=${index}`);
    await this.milestoneDeleteButton(index).click();
    await this.milestoneNameInput(index).waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  async proceedFromPaymentStep(): Promise<void> {
    logVerbose('MilestonesContractPage.proceedFromPaymentStep');
    await this.continueButton.click();
    // noticePeriodInput is hidden until a compliance template is selected;
    // wait for whichever compliance-step indicator appears first
    await this.noticePeriodInput
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(async () => {
        await this.useRemotepassTemplateCard.waitFor({ state: 'visible', timeout: 15000 });
      });
  }

  async fillComplianceStep(noticePeriodDays: number): Promise<void> {
    logVerbose(`MilestonesContractPage.fillComplianceStep noticePeriodDays=${noticePeriodDays}`);
    // Use RemotePass template (selected by default — click to ensure)
    if (await this.useRemotepassTemplateCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.useRemotepassTemplateCard.click();
      await this.noticePeriodInput.waitFor({ state: 'visible', timeout: 5000 });
    }
    await this.noticePeriodInput.fill(String(noticePeriodDays));
    const urlBefore = this.page.url();
    await this.createButton.click();
    // Wizard URL stays on /contract/create — wait for any URL change after Create
    await this.page.waitForURL((url) => url.toString() !== urlBefore, { timeout: 20_000 })
      .catch(() => {
        logVerbose(`MilestonesContractPage.fillComplianceStep waitForURL timed out — current: ${this.page.url()}`);
      });
  }

  // ==== Full Wizard Flow ================================================

  /**
   * Run the full 4-step wizard to create a Milestones contract.
   * Returns the contract ref extracted from the resulting page URL.
   */
  async createMilestonesContract(data: {
    taxCountry: string;
    role: string;
    scope: string;
    milestones: Array<{ name: string; amount: number }>;
    noticePeriodDays?: number;
  }): Promise<string | null> {
    logVerbose(`MilestonesContractPage.createMilestonesContract role=${data.role}`);

    await this.open();
    await this.selectContractorWorkerType();
    await this.selectMilestonesContractType();
    await this.fillContractInfo({
      taxCountry: data.taxCountry,
      role: data.role,
      scope: data.scope,
    });

    for (let i = 0; i < data.milestones.length; i++) {
      await this.addMilestone(data.milestones[i].name, data.milestones[i].amount, i);
    }
    await this.proceedFromPaymentStep();
    await this.fillComplianceStep(data.noticePeriodDays ?? 30);

    // Extract contract ref from resulting URL (e.g. /contracts/ABCD1234)
    const url = this.page.url();
    // Pattern 1: query param ?id=REFID  (e.g. /contract/detail?id=FU374L3H)
    const queryMatch = url.match(/[?&]id=([A-Za-z0-9]+)/i);
    if (queryMatch) return queryMatch[1];

    // Pattern 2: path segment /contracts/REFID
    const pathMatch = url.match(/\/contracts?\/([A-Z0-9]{4,})/i);
    if (pathMatch && !['new', 'create', 'detail'].includes(pathMatch[1].toLowerCase())) {
      return pathMatch[1];
    }
    return null;
  }

  // ==== Verification ====================================================

  async getMilestoneCount(): Promise<number> {
    logVerbose('MilestonesContractPage.getMilestoneCount');
    return this.page.locator('input[name^="milestones."][name$=".name"]').count();
  }

  async getMilestoneNameValue(index: number): Promise<string> {
    logVerbose(`MilestonesContractPage.getMilestoneNameValue index=${index}`);
    return this.milestoneNameInput(index).inputValue();
  }

  async getMilestoneAmountValue(index: number): Promise<string> {
    logVerbose(`MilestonesContractPage.getMilestoneAmountValue index=${index}`);
    const raw = await this.milestoneAmountInput(index).inputValue();
    // Strip currency prefix (e.g. "AED 300" → "300") and thousands separators ("1,200" → "1200")
    return raw.replace(/^[A-Z]{2,4}\s+/, '').replace(/,/g, '').trim();
  }
}
