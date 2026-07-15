import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Page Object for the COR (Contractor of Record) contract creation wizard.
 *
 * COR is a flag on Fixed, PAYG, and Milestone contracts — not a standalone type.
 * The wizard flow mirrors the standard contractor wizard with an additional COR toggle:
 *   1  Worker Type       → "A Contractor" → Continue
 *   2  Contract Type     → Fixed | Pay As You Go | Milestone → (COR toggle)
 *   3  Contract Info     → Country, Role, Scope of Work
 *   4  Payment           → Rate, Currency, Frequency
 *   5  Compliance        → Template / Notice period → Create
 *
 * Entered directly via `ROUTES.contractCreate` (`/contract/create`) — the
 * sibling of the bulk-import wizard's `ROUTES.bulkCreation`. Post-creation
 * "Ongoing" verification lives on the shared `ContractDetailPage`, not here.
 */
export class CORContractPage extends BasePage {
  // ==== Step 1 — Worker Type ============================================

  readonly contractorCard = this.page.getByText('A Contractor', { exact: true });
  readonly continueButton = this.page.getByRole('button', { name: 'Continue' });
  readonly backButton = this.page.getByRole('button', { name: 'Back' });

  // ==== Step 2 — Contract Type ==========================================

  readonly fixedTypeCard = this.page.getByText('Fixed', { exact: true });
  readonly paygTypeCard = this.page.getByText('Pay as you go', { exact: true })
    .or(this.page.getByText('Pay As You Go', { exact: true }))
    .or(this.page.getByText('PAYG', { exact: true }));
  readonly milestoneTypeCard = this.page.getByText('Milestones', { exact: true })
    .or(this.page.getByText('Milestone', { exact: true }));

  // Match "COR" only as a standalone token (\bCOR\b) — a bare /cor/i substring would
  // match Record, Corporate, Score, etc. and pull in unrelated page text.
  private static readonly COR_TEXT = /\bCOR\b|contractor of record/i;

  /**
   * The live wizard (confirmed 2026-07-09) renders the COR opt-in as an
   * unlabeled `checkbox` role element inside an `[role="alert"]` promo box
   * next to a "Contractor of record" heading — NOT a `<label>`-wrapped input
   * or an ARIA `switch`, which never matched (TODO(selector) closed by
   * scoping to the alert box + its checkbox descendant instead of guessing
   * label/switch markup).
   */
  readonly corToggle = this.page.getByRole('alert').filter({ hasText: CORContractPage.COR_TEXT })
    .getByRole('checkbox')
    .or(this.page.getByLabel(CORContractPage.COR_TEXT))
    .or(this.page.locator('label').filter({ hasText: CORContractPage.COR_TEXT }).locator('input'))
    .or(this.page.getByRole('switch', { name: CORContractPage.COR_TEXT }));

  /**
   * The `corToggle` checkbox is a `react-toggle` library input — visually
   * hidden (`.react-toggle-screenreader-only`) behind its own visible
   * `.react-toggle` track `<div>`, which intercepts pointer events. Clicking
   * (or `.check()`-ing) the checkbox directly times out; the track is the
   * element a real user actually clicks.
   */
  readonly corToggleTrack = this.page.getByRole('alert').filter({ hasText: CORContractPage.COR_TEXT })
    .locator('.react-toggle');

  readonly corToggleLabel = this.page.locator('label').filter({ hasText: CORContractPage.COR_TEXT }).first();

  /** Last-resort fallback: the COR control's label/text within the contract form. */
  readonly corToggleArea = this.contractForm.getByText(CORContractPage.COR_TEXT).first();

  readonly corProviderSelector = this.contractForm.locator('[class*="control"]').filter({ hasText: /provider|entity|select/i }).first();

  /**
   * Enabling the COR toggle opens a COR-provider-onboarding modal dialog
   * (confirmed 2026-07-09, matches docs/test-migration/scenarios/contracts.md:
   * "the toggle requires additional COR-provider onboarding with no
   * automation hook") — this modal then covers the rest of the page, so any
   * caller that enables the toggle inside a still-running wizard flow must
   * dismiss it (`dismissOnboardingModal`) before interacting with anything
   * else on the page.
   */
  readonly corOnboardingModal = this.page.getByRole('dialog');

  /**
   * The COR-specific UI that appears after selecting a COR-supported country
   * is the `[role="alert"]` promo box (heading + checkbox, see `corToggle`
   * doc) — NOT a `<label>` element, which never matched (TODO(selector)
   * closed by re-targeting to the confirmed alert-box markup).
   */
  readonly corSpecificFields = this.page.getByRole('alert').filter({ hasText: /\bCOR\b|contractor of record|provider/i });

  readonly noCountryOptionsMessage = this.page.getByText(/no options|not found|no results/i).first();

  // ==== Form scope ======================================================

  // The wizard fields (name/rate/start_date/notice_period inputs) all live inside the
  // contract <form>; scoping broad text/label lookups here keeps them from matching
  // page chrome (nav, header, sidebar) elsewhere in the app shell.
  private get contractForm(): Locator {
    // Prefer the most recently rendered form (wizards/modals are typically appended last)
    return this.page.locator('form').last();
  }

  // ==== React-select shared parts =======================================

  readonly reactSelectMenu = this.page.locator('[class*="menu"]').first();
  readonly reactSelectOptions = this.page.locator('[class*="option"], [role="option"]');

  // ==== Step 3 — Contract Info ==========================================

  // Unselected react-select controls render a "Select ..." placeholder. The lookup is
  // scoped to the contract form (not the whole page) so it can't match placeholders in
  // page chrome. `index` disambiguates when a step renders more than one placeholder.
  private placeholderDropdown(index = 0): Locator {
    return this.contractForm.locator('div').filter({ hasText: /^Select \.\.\.$/ }).nth(index);
  }

  // Step 3 (Contract Info) renders a single placeholder dropdown: the tax-residence
  // country. It is the first/only unselected placeholder on this step.
  get taxCountryDropdown(): Locator {
    return this.placeholderDropdown(0);
  }

  readonly roleInput = this.page.locator('input[name="name"]');
  readonly scopeOfWorkEditor = this.page.locator('div.ql-editor');

  // ==== Step 4 — Payment ================================================

  readonly rateAmountInput = this.page.locator('input[name="rate"]').or(this.page.locator('input[name="amount"]'));
  readonly currencyDropdown = this.page.locator('[class*="control"]').filter({ hasText: /USD|AED|EUR|GBP|Select/i }).first();

  // Step 4 (Payment) renders the payment-frequency dropdown as the first unselected
  // placeholder; currency / payment-cycle placeholders (if any) follow it.
  get frequencyDropdown(): Locator {
    return this.placeholderDropdown(0);
  }

  /**
   * TODO(selector): the live Payment step (confirmed 2026-07-09) renders
   * "Start date" as a button-triggered date-picker widget, not a fillable
   * `input[name="start_date"]`/`input[type="date"]` — this locator never
   * matches. Kept as a documented gap (`startDateLabel` below is the
   * confirmed-working stand-in for "the control renders") rather than
   * guessing the picker's calendar-popover markup.
   */
  readonly startDateInput = this.page.locator('input[name="start_date"]')
    .or(this.page.locator('input[type="date"]').first());
  /** Confirmed-working label locator for the Start date control (see `startDateInput` TODO). */
  readonly startDateLabel = this.page.getByText(/start date/i).first();
  readonly rateValidationError = this.page.getByText(/rate.*required|amount.*required|rate.*greater|amount.*greater|salary.*greater/i);
  readonly startDateValidationError = this.page.getByText(/date.*required|date.*invalid|date.*past|date.*future/i);

  // ==== Step 5 — Compliance =============================================

  readonly useRemotepassTemplateCard = this.page.getByRole('button', { name: /use remotepass.*template/i });
  readonly noticePeriodInput = this.page.locator('input[name="notice_period"]');
  readonly createButton = this.page.getByRole('button', { name: /create/i });
  readonly uploadContractInput = this.page.locator('input[type="file"]').first();
  readonly uploadRejectionError = this.page.getByText(/invalid|not allowed|pdf only|unsupported/i).first();

  // ==== SoW (Statement of Work) — post-creation =========================

  readonly sowSection = this.page.locator('text=/statement of work|sow/i').first();
  readonly sowDownloadButton = this.page.getByRole('button', { name: /download.*sow|sow.*download/i })
    .or(this.page.getByRole('link', { name: /download.*sow|sow.*download/i }));
  readonly sowSignButton = this.page.getByRole('button', { name: /sign.*sow|sow.*sign/i });

  // ==== Contract detail (post-creation) =================================

  readonly timelineSowSigned = this.page.getByText('SOW Signed');
  readonly downloadButton = this.page.getByRole('button', { name: 'Download' }).first();

  // ==== Wizard chrome ===================================================

  readonly closeWizardButton = this.page.locator('button').filter({ hasText: /×|✕/ })
    .or(this.page.getByRole('button', { name: /close/i }))
    .or(this.page.locator('[aria-label="close"], [aria-label="Close"]'));

  // ==== Validation errors ===============================================

  /**
   * Required-field validation messages render as plain text next to the field
   * (confirmed against the live wizard, same pattern as `FixedContractPage`) —
   * NOT via a `.error`/`[aria-invalid]` CSS hook, which never matched.
   */
  readonly requiredFieldErrors = this.page.getByText(/is required/i);

  // ==== Navigation Methods ==============================================

  async open(): Promise<void> {
    logVerbose('CORContractPage.open');
    await this.goto(ROUTES.contractCreate);
    await this.contractorCard.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async closeWizard(): Promise<void> {
    logVerbose('CORContractPage.closeWizard');
    if (await this.closeWizardButton.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.closeWizardButton.first().click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  // ==== Step Actions ====================================================

  async selectContractorWorkerType(): Promise<void> {
    logVerbose('CORContractPage.selectContractorWorkerType');
    await this.contractorCard.click();
    await this.continueButton.click();
    await this.fixedTypeCard.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async selectContractType(type: 'Fixed' | 'PAYG' | 'Milestone'): Promise<void> {
    logVerbose(`CORContractPage.selectContractType type=${type}`);
    const card = type === 'PAYG' ? this.paygTypeCard
      : type === 'Milestone' ? this.milestoneTypeCard
      : this.fixedTypeCard;
    await card.click();
    await this.roleInput.waitFor({ state: 'visible', timeout: 10_000 });
  }

  /**
   * Enables the COR toggle. Returns true if a toggle/label/area was found and
   * actioned, false if none could be located. Callers that REQUIRE a COR contract
   * (e.g. createCORContract) must treat false as a failure rather than silently
   * producing a non-COR contract.
   */
  async enableCorToggle(): Promise<boolean> {
    logVerbose('CORContractPage.enableCorToggle');
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const confirmEnabled = async (): Promise<boolean> => {
      const toggleVisible = await this.corToggle.isVisible({ timeout: 1_000 }).catch(() => false);
      if (toggleVisible) {
        const checked = await this.corToggle.isChecked().catch(() => false);
        if (checked) return true;
      }
      // The onboarding modal (see `corOnboardingModal` doc) is the confirmed
      // real signal on this sandbox — checked first since the provider
      // selector/COR-specific fields never render behind it.
      if (await this.corOnboardingModal.isVisible({ timeout: 1_000 }).catch(() => false)) return true;
      if (await this.isProviderSelectorVisible()) return true;
      const fieldsCount = await this.countCorSpecificFields().catch(() => 0);
      return fieldsCount > 0;
    };

    // A confirming signal (onboarding modal, provider selector, or a
    // COR-specific field) appearing is the deterministic post-toggle event —
    // awaited directly instead of a manual sleep-poll.
    const waitForConfirmingSignal = () =>
      this.corOnboardingModal.or(this.corProviderSelector).or(this.corSpecificFields.first())
        .waitFor({ state: 'visible', timeout: 3_000 })
        .catch(() => {});

    if (await this.corToggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
      if (!(await this.corToggle.isChecked().catch(() => false))) {
        if (await this.corToggleTrack.isVisible({ timeout: 1_000 }).catch(() => false)) {
          // `react-toggle` renders a visible `.react-toggle` track over the
          // screen-reader-only checkbox, intercepting pointer events — click
          // the track (what a real user clicks), not the hidden input.
          await this.corToggleTrack.click();
          await waitForConfirmingSignal();
        } else {
          // Standard label/switch-wrapped input — Playwright's check() already
          // waits until the control reaches the checked state before resolving.
          await this.corToggle.check();
        }
      }
      return confirmEnabled();
    }
    if (await this.corToggleLabel.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.corToggleLabel.click();
      await waitForConfirmingSignal();
      return confirmEnabled();
    }
    if (await this.corToggleArea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.corToggleArea.click();
      await waitForConfirmingSignal();
      return confirmEnabled();
    }
    logVerbose('CORContractPage.enableCorToggle — COR toggle not found');
    return false;
  }

  /**
   * Dismiss the COR-provider-onboarding modal (see `corOnboardingModal` doc)
   * via Escape — the modal covers every other control on the page, so no
   * button click can reach it. No-ops if the modal isn't showing.
   */
  async dismissOnboardingModal(): Promise<void> {
    logVerbose('CORContractPage.dismissOnboardingModal');
    if (await this.corOnboardingModal.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.page.keyboard.press('Escape');
      await this.corOnboardingModal.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    }
  }

  async isCorToggleVisible(): Promise<boolean> {
    logVerbose('CORContractPage.isCorToggleVisible');
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    return (await this.corToggle.isVisible({ timeout: 5_000 }).catch(() => false))
      || (await this.corToggleLabel.isVisible({ timeout: 3_000 }).catch(() => false))
      || (await this.corToggleArea.isVisible({ timeout: 3_000 }).catch(() => false));
  }

  async isProviderSelectorVisible(): Promise<boolean> {
    logVerbose('CORContractPage.isProviderSelectorVisible');
    return this.corProviderSelector.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  async countCorSpecificFields(): Promise<number> {
    logVerbose('CORContractPage.countCorSpecificFields');
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    return this.corSpecificFields.count();
  }

  async searchTaxCountryShowsNoResults(searchText: string): Promise<boolean> {
    logVerbose(`CORContractPage.searchTaxCountryShowsNoResults searchText=${searchText}`);
    await this.taxCountryDropdown.click();
    await this.page.keyboard.type(searchText);
    const noResults = await this.noCountryOptionsMessage.isVisible({ timeout: 3_000 }).catch(() => false);
    await this.page.keyboard.press('Escape');
    return noResults;
  }

  async selectFromReactSelect(control: Locator, searchText: string): Promise<void> {
    logVerbose(`CORContractPage.selectFromReactSelect searchText=${searchText}`);
    await control.click();
    if (!(await this.reactSelectMenu.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await control.locator('input').first().click().catch(() => control.click());
    }
    await this.reactSelectMenu.waitFor({ state: 'visible', timeout: 5_000 });
    await this.page.keyboard.type(searchText);
    // After typing, react-select filters the list — the best match is the first option.
    await this.reactSelectOptions.filter({ hasText: searchText }).first()
      .waitFor({ state: 'visible', timeout: 5_000 });
    await this.reactSelectOptions.filter({ hasText: searchText }).first().click();
    await this.reactSelectMenu.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }

  async fillTaxCountry(country: string): Promise<void> {
    logVerbose(`CORContractPage.fillTaxCountry country=${country}`);
    await this.selectFromReactSelect(this.taxCountryDropdown, country);
  }

  async fillContractInfoFields(data: { role: string; scope: string }): Promise<void> {
    logVerbose(`CORContractPage.fillContractInfoFields role=${data.role}`);
    await this.roleInput.fill(data.role);
    if (await this.scopeOfWorkEditor.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.scopeOfWorkEditor.click();
      await this.page.keyboard.type(data.scope);
    }
  }

  async submitContractInfoStep(): Promise<void> {
    logVerbose('CORContractPage.submitContractInfoStep');
    await this.continueButton.click();
    await this.rateAmountInput.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async fillPaymentDetails(data: { rate: string | number; frequency?: string }): Promise<void> {
    logVerbose(`CORContractPage.fillPaymentDetails rate=${data.rate}`);
    await this.rateAmountInput.fill(String(data.rate));
    const freq = data.frequency ?? 'Every month';
    await this.frequencyDropdown.click();
    await this.reactSelectOptions.filter({ hasText: freq }).first()
      .waitFor({ state: 'visible', timeout: 5_000 });
    await this.reactSelectOptions.filter({ hasText: freq }).first().click();
    // The payment step exposes up to two more react-select dropdowns after frequency
    // (currency, then payment cycle). Each picks its first option; the helper no-ops
    // when fewer are present, so this is safe even if the layout drops one.
    await this.selectFirstAvailableDropdown(); // currency
    await this.selectFirstAvailableDropdown(); // payment cycle
  }

  private async selectFirstAvailableDropdown(): Promise<void> {
    logVerbose('CORContractPage.selectFirstAvailableDropdown');
    if (await this.placeholderDropdown().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.placeholderDropdown().click();
      await this.reactSelectOptions.first().waitFor({ state: 'visible', timeout: 5_000 });
      await this.reactSelectOptions.first().click();
    }
  }

  async proceedFromPaymentStep(): Promise<void> {
    logVerbose('CORContractPage.proceedFromPaymentStep');
    await this.continueButton.click();
    await this.noticePeriodInput
      .waitFor({ state: 'visible', timeout: 3_000 })
      .catch(async () => {
        await this.useRemotepassTemplateCard.waitFor({ state: 'visible', timeout: 15_000 });
      });
  }

  async fillComplianceStep(noticePeriodDays: number): Promise<void> {
    logVerbose(`CORContractPage.fillComplianceStep noticePeriodDays=${noticePeriodDays}`);
    if (await this.useRemotepassTemplateCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.useRemotepassTemplateCard.click();
      await this.noticePeriodInput.waitFor({ state: 'visible', timeout: 5_000 });
    }
    if (await this.noticePeriodInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.noticePeriodInput.fill(String(noticePeriodDays));
    }
    const urlBefore = this.page.url();
    await this.createButton.waitFor({ state: 'visible', timeout: 10_000 });
    await this.createButton.click();
    await this.page.waitForURL((url) => url.toString() !== urlBefore, { timeout: 20_000 })
      .catch(() => {
        logVerbose(`CORContractPage.fillComplianceStep waitForURL timed out — current: ${this.page.url()}`);
      });
  }

  // ==== Navigation helpers ==============================================

  async navigateToContractInfoStep(): Promise<void> {
    logVerbose('CORContractPage.navigateToContractInfoStep');
    await this.open();
    await this.selectContractorWorkerType();
  }

  /**
   * Navigates to the Payment step WITHOUT enabling the COR toggle — used by
   * the generic wizard-validation tests (rate/date/upload checks), which
   * exercise the plain contractor wizard, not COR-specific behaviour.
   * Enabling the toggle opens a COR-provider-onboarding modal with no
   * automation hook (docs/test-migration/scenarios/contracts.md) that would
   * block the rest of this flow — callers that specifically need the COR
   * toggle call `enableCorToggle` (+ `dismissOnboardingModal`) directly.
   */
  async navigateToPaymentStep(data: {
    contractType?: 'Fixed' | 'PAYG' | 'Milestone';
    taxCountry: string;
    role: string;
    scope: string;
  }): Promise<void> {
    logVerbose('CORContractPage.navigateToPaymentStep');
    await this.navigateToContractInfoStep();
    await this.selectContractType(data.contractType ?? 'Fixed');
    await this.fillTaxCountry(data.taxCountry);
    await this.fillContractInfoFields({ role: data.role, scope: data.scope });
    await this.submitContractInfoStep();
  }

  // ==== URL Parsing =====================================================

  extractContractRef(url: string): string | null {
    logVerbose(`CORContractPage.extractContractRef url=${url}`);
    const reserved = ['create', 'new', 'edit', 'list', 'detail', 'undefined'];
    const qpMatch = url.match(/[?&]id=([A-Za-z0-9]+)/i);
    if (qpMatch && !reserved.includes(qpMatch[1].toLowerCase())) return qpMatch[1];
    const pathMatch = url.match(/\/contract[s]?\/([A-Za-z0-9]+)/i);
    if (pathMatch && !reserved.includes(pathMatch[1].toLowerCase())) return pathMatch[1];
    return null;
  }

  // ==== Full Wizard Flow ================================================

  async createCORContract(data: {
    contractType?: 'Fixed' | 'PAYG' | 'Milestone';
    taxCountry: string;
    role: string;
    scope: string;
    rate: string | number;
    noticePeriodDays?: number;
  }): Promise<string | null> {
    logVerbose(`CORContractPage.createCORContract role=${data.role}`);
    await this.navigateToContractInfoStep();
    await this.selectContractType(data.contractType ?? 'Fixed');
    await this.fillTaxCountry(data.taxCountry);
    const corEnabled = await this.enableCorToggle();
    if (!corEnabled) {
      throw new Error(
        'CORContractPage.createCORContract — COR toggle could not be enabled — refusing to create a non-COR contract',
      );
    }
    await this.fillContractInfoFields({ role: data.role, scope: data.scope });
    await this.submitContractInfoStep();
    await this.fillPaymentDetails({ rate: data.rate });
    await this.proceedFromPaymentStep();
    await this.fillComplianceStep(data.noticePeriodDays ?? 30);
    await this.page.waitForLoadState('domcontentloaded');
    return this.extractContractRef(this.page.url());
  }

  /**
   * Same wizard flow as `createCORContract` but explicitly skips the COR
   * toggle — used to produce a genuine non-COR contract for negative checks
   * (e.g. "no SoW section for a non-COR contract") without duplicating the
   * step sequence in the spec.
   */
  async createNonCorContract(data: {
    contractType?: 'Fixed' | 'PAYG' | 'Milestone';
    taxCountry: string;
    role: string;
    scope: string;
    rate: string | number;
    noticePeriodDays?: number;
  }): Promise<string | null> {
    logVerbose(`CORContractPage.createNonCorContract role=${data.role}`);
    await this.navigateToContractInfoStep();
    await this.selectContractType(data.contractType ?? 'Fixed');
    await this.fillTaxCountry(data.taxCountry);
    // Explicitly do NOT enable the COR toggle.
    await this.fillContractInfoFields({ role: data.role, scope: data.scope });
    await this.submitContractInfoStep();
    await this.fillPaymentDetails({ rate: data.rate });
    await this.proceedFromPaymentStep();
    await this.fillComplianceStep(data.noticePeriodDays ?? 30);
    await this.page.waitForLoadState('domcontentloaded');
    return this.extractContractRef(this.page.url());
  }
}
