import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Page Object for the EOR (Employer of Record) contract creation wizard.
 *
 * Actual 4-step flow (confirmed via UI exploration):
 *   Step 1 — Worker Type:              "An Employee" → Continue
 *   Step 1b — Employment Type:         EOR | Direct Employee → Continue
 *   Step 2 — Simulation:               Country + Yearly Gross Salary → Continue
 *   Step 3 — Employee and job info:    Name, email, job title, start date, nationality, working-from
 *   Step 4 — Compensation and benefits: Annual leave, trial period, insurance → Create
 *
 * Entered directly via `ROUTES.contractCreate` (`/contract/create`) — the
 * sibling of the bulk-import wizard's `ROUTES.bulkCreation`.
 */
export class EorContractPage extends BasePage {
  // ==== Shared ============================================================

  readonly continueButton = this.page.getByRole('button', { name: 'Continue' });
  readonly backButton = this.page.getByRole('button', { name: 'Back' });

  // ==== Step 1 — Worker Type ==============================================

  readonly employeeCard = this.page.getByText('An Employee', { exact: true });

  // ==== Step 1b — Employment Type (EOR vs Direct Employee) ================

  readonly eorTypeCard = this.page.getByText('EOR', { exact: true });
  readonly directEmployeeCard = this.page.getByText('Direct Employee', { exact: true });

  // ==== Step 2 — Simulation ===============================================

  /** FRAGILE: positional — breaks if any react-select is added before the country control on this step. */
  readonly countryDropdown = this.page.locator('[class*="control"]').first();
  readonly yearlySalaryInput = this.page.getByLabel(/yearly gross salary/i);
  /** FRAGILE: positional (nth 1) — breaks if the step layout changes. */
  readonly simulationCurrencyDropdown = this.page.locator('[class*="control"]').nth(1);

  // ==== Step 3 — Employee and job info ====================================

  readonly employeeFirstNameInput = this.page.locator('input[name="employee_first_name"]');
  readonly employeeLastNameInput = this.page.locator('input[name="employee_last_name"]');
  readonly employeeEmailInput = this.page.locator('input[name="employee_email"]');

  /**
   * FRAGILE: identical selector to qualificationDropdown — resolves correctly only BEFORE
   * nationality is selected. After selection the dropdown closes, leaving qualificationDropdown
   * as the first visible "Select…" control. Never use both in the same step simultaneously.
   */
  readonly nationalityDropdown = this.page.locator('[class*="control"]').filter({ hasText: /select/i }).first();

  readonly startDateInput = this.page.locator('input[name="start_date"]');
  /** End date input shown when "Definite" employment term is selected */
  readonly employmentTermEndDateInput = this.page.locator('input[name="end_date"], input[name="employment_end_date"]').first();
  readonly jobTitleInput = this.page.locator('input[name="job_title"]');

  /**
   * Employment Term — label wrapping a hidden radio input.
   * The visual card is inside a <label><input type="radio" name="employment_term" value="…"></label>.
   * Click the label to select the radio.
   */
  readonly employmentTermDefiniteButton = this.page.locator('label').filter({
    has: this.page.locator('input[name="employment_term"][value="Definite"]'),
  });

  readonly employmentTermIndefiniteButton = this.page.locator('label').filter({
    has: this.page.locator('input[name="employment_term"][value="Indefinite"]'),
  });

  // Employment Type — the textContent is literal "Full-time" / "Part-time" (no CSS transform needed)
  readonly employmentTypeFullTimeButton = this.page.getByText('Full-time', { exact: true }).first();
  readonly employmentTypePartTimeButton = this.page.getByText('Part-time', { exact: true }).first();

  /**
   * Qualification — react-select (after nationality is selected, first "Select…" is this).
   * FRAGILE: identical selector to nationalityDropdown — valid only AFTER nationality is selected.
   */
  readonly qualificationDropdown = this.page.locator('[class*="control"]').filter({ hasText: /select/i }).first();

  /** Job description — Quill rich-text editor (contenteditable div, not a textarea) */
  readonly jobDescriptionInput = this.page.locator('div.ql-editor');

  // ==== Step 4 — Compensation and benefits ================================

  readonly annualLeaveDaysInput = this.page.locator('input[name="annual_leave_days"]');
  readonly trialPeriodInput = this.page.locator('input[name="trial_period"]');
  readonly insuranceToggle = this.page.getByRole('checkbox', { name: /insurance/i });
  readonly createButton = this.page.getByRole('button', { name: 'Create' });

  // ==== Validation errors =================================================

  readonly employeeFirstNameError = this.page.getByText(/first name.*required|required.*first name/i).first();
  readonly employeeLastNameError = this.page.getByText(/last name.*required|required.*last name/i).first();
  readonly employeeEmailError = this.page.getByText(/valid email|invalid email|email.*invalid|email.*format/i).first();
  readonly countryError = this.page.getByText(/country.*required|required.*country/i).first();
  readonly anyRequiredFieldError = this.page.locator('text=/required|can\'t be empty|is required/i').first();

  // ==== Navigation / setup ================================================

  async open(): Promise<void> {
    logVerbose('EorContractPage.open');
    await this.goto(ROUTES.contractCreate);
    await this.employeeCard.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async navigateToWizardSimulationStep(): Promise<void> {
    logVerbose('EorContractPage.navigateToWizardSimulationStep');
    await this.open();
    await this.selectEmployeeWorkerType();
    await this.selectEorEmploymentType();
  }

  // ==== Step actions ======================================================

  async selectEmployeeWorkerType(): Promise<void> {
    logVerbose('EorContractPage.selectEmployeeWorkerType');
    await this.employeeCard.click();
    await this.continueButton.click();
    // Lands on Employment Type screen (EOR | Direct Employee)
    await this.eorTypeCard.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async selectEorEmploymentType(): Promise<void> {
    logVerbose('EorContractPage.selectEorEmploymentType');
    await this.eorTypeCard.click();
    await this.continueButton.click();
    // Lands on Simulation step — country dropdown is first react-select
    await this.countryDropdown.waitFor({ state: 'visible', timeout: 10_000 });
  }

  /**
   * Open a react-select dropdown and click its first available option.
   * Used for fields where any valid value is acceptable (e.g. Qualification).
   */
  private async selectFirstFromReactSelect(control: Locator): Promise<void> {
    logVerbose('EorContractPage.selectFirstFromReactSelect');
    await control.click();
    const menu = this.page.locator('[class*="menu"]').first();
    if (!(await menu.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await control.locator('input').first().click().catch(() => control.click());
    }
    await menu.waitFor({ state: 'visible', timeout: 5_000 });
    const firstOption = this.page.locator('[class*="option"]').first();
    await firstOption.waitFor({ state: 'visible', timeout: 5_000 });
    await firstOption.click();
    await menu.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }

  /**
   * Open a react-select dropdown, type a search string, and click the matching
   * option. Shared by all react-select dropdowns in the wizard.
   */
  private async selectFromReactSelect(control: Locator, searchText: string): Promise<void> {
    logVerbose(`EorContractPage.selectFromReactSelect searchText=${searchText}`);
    await control.click();
    const menu = this.page.locator('[class*="menu"]').first();
    // Retry via inner input if the container click didn't open the menu (timing/animation race)
    if (!(await menu.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await control.locator('input').first().click().catch(() => control.click());
    }
    await menu.waitFor({ state: 'visible', timeout: 5_000 });
    await this.page.keyboard.type(searchText);
    const option = this.page.locator('[class*="option"]').filter({ hasText: searchText }).first();
    await option.waitFor({ state: 'visible', timeout: 5_000 });
    await option.click();
    await menu.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }

  async selectSimulationCountry(country: string): Promise<void> {
    logVerbose(`EorContractPage.selectSimulationCountry country=${country}`);
    await this.selectFromReactSelect(this.countryDropdown, country);
  }

  async fillSimulationStep(data: {
    country: string;
    salary: string;
    currency?: string;
  }): Promise<void> {
    logVerbose(`EorContractPage.fillSimulationStep country=${data.country} salary=${data.salary}`);

    // Only change country if it is not already set to the desired value
    const currentCountry = ((await this.countryDropdown.textContent()) ?? '').trim();
    if (!currentCountry.includes(data.country)) {
      await this.selectFromReactSelect(this.countryDropdown, data.country);
    }

    if (await this.yearlySalaryInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.yearlySalaryInput.fill(data.salary);
    }

    // Currency dropdown uses a non-standard react-select — interact only when needed
    if (data.currency) {
      const currentCurrency = ((await this.simulationCurrencyDropdown.textContent()) ?? '').trim();
      if (!currentCurrency.includes(data.currency)) {
        if (await this.simulationCurrencyDropdown.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await this.selectFromReactSelect(this.simulationCurrencyDropdown, data.currency).catch(() => {});
        }
      }
    }

    await this.continueButton.click();
    await this.employeeFirstNameInput.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async fillEmployeeInfo(data: {
    firstName: string;
    lastName: string;
    email: string;
    nationality?: string;
    startDate?: string;
    jobTitle?: string;
    jobDescription?: string;
    employmentTerm?: 'Indefinite' | 'Definite';
    employmentType?: 'Full-time' | 'Part-time';
  }): Promise<void> {
    logVerbose(`EorContractPage.fillEmployeeInfo email=${data.email}`);
    await this.employeeFirstNameInput.fill(data.firstName);
    await this.employeeLastNameInput.fill(data.lastName);
    await this.employeeEmailInput.fill(data.email);

    // Nationality — react-select showing "Select ..."
    if (data.nationality && await this.nationalityDropdown.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.selectFromReactSelect(this.nationalityDropdown, data.nationality);
    }

    // Qualification first — pick the first available option.
    // Done before Employment Term/Type clicks to prevent any react-select
    // re-render from resetting the radio-button selections made afterward.
    if (await this.qualificationDropdown.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.selectFirstFromReactSelect(this.qualificationDropdown);
    }

    // Employment Term (required radio-style buttons) — scoped to label container
    const termButton = data.employmentTerm === 'Definite'
      ? this.employmentTermDefiniteButton
      : this.employmentTermIndefiniteButton;
    if (await termButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await termButton.scrollIntoViewIfNeeded();
      await termButton.click();
    }

    // Employment Type (required radio-style buttons)
    const typeButton = data.employmentType === 'Part-time'
      ? this.employmentTypePartTimeButton
      : this.employmentTypeFullTimeButton;
    if (await typeButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await typeButton.scrollIntoViewIfNeeded();
      await typeButton.click();
    }

    // Job description — Quill contenteditable div (fill works on contenteditable)
    if (data.jobDescription && await this.jobDescriptionInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await this.jobDescriptionInput.scrollIntoViewIfNeeded();
      await this.jobDescriptionInput.click();
      await this.jobDescriptionInput.fill(data.jobDescription);
    }

    if (data.startDate && await this.startDateInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.startDateInput.fill(data.startDate);
    }
    if (data.jobTitle && await this.jobTitleInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.jobTitleInput.fill(data.jobTitle);
    }

    await this.continueButton.click();
    // Wait for step 3 fields to be replaced by step 4
    await this.employeeFirstNameInput.waitFor({ state: 'hidden', timeout: 10_000 });
  }

  async fillCompensationAndBenefits(data: {
    annualLeaveDays?: number;
    trialPeriodDays?: number;
    includeInsurance?: boolean;
  }): Promise<void> {
    logVerbose('EorContractPage.fillCompensationAndBenefits');

    if (data.annualLeaveDays !== undefined) {
      if (await this.annualLeaveDaysInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await this.annualLeaveDaysInput.fill(String(data.annualLeaveDays));
      }
    }
    if (data.trialPeriodDays !== undefined) {
      if (await this.trialPeriodInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await this.trialPeriodInput.fill(String(data.trialPeriodDays));
      }
    }
    if (data.includeInsurance !== undefined) {
      if (await this.insuranceToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const checked = await this.insuranceToggle.isChecked().catch(() => false);
        if (data.includeInsurance !== checked) {
          await this.insuranceToggle.click();
        }
      }
    }

    // Step 4 ends with "Create" or "Continue" depending on wizard state
    const createVisible = await this.createButton.isVisible({ timeout: 3_000 }).catch(() => false);
    const urlBefore = this.page.url();
    logVerbose(`EorContractPage.fillCompensationAndBenefits — URL before Create: ${urlBefore}`);
    logVerbose(`EorContractPage.fillCompensationAndBenefits — Create button visible: ${createVisible}`);
    if (createVisible) {
      await this.createButton.click();
    } else {
      await this.continueButton.click();
    }
    // Wait for the page to navigate away from the creation URL.
    // Use a permissive predicate — the resulting URL is logged in createEorContract.
    await this.page.waitForURL(
      (url) => url.toString() !== urlBefore,
      { timeout: 20_000 },
    ).catch(() => {
      // URL didn't change — still log what we have
      logVerbose(`EorContractPage.fillCompensationAndBenefits — waitForURL timed out, URL unchanged: ${this.page.url()}`);
    });
    logVerbose(`EorContractPage.fillCompensationAndBenefits — URL after Create: ${this.page.url()}`);
  }

  // ==== Full wizard flow ==================================================

  /**
   * Run the complete EOR creation wizard.
   * Returns the contract ref from the resulting URL, or null.
   */
  async createEorContract(data: {
    country: string;
    salary: string;
    currency?: string;
    firstName: string;
    lastName: string;
    email: string;
    nationality?: string;
    startDate?: string;
    jobTitle?: string;
    jobDescription?: string;
    employmentTerm?: 'Indefinite' | 'Definite';
    employmentType?: 'Full-time' | 'Part-time';
    annualLeaveDays?: number;
    trialPeriodDays?: number;
    includeInsurance?: boolean;
  }): Promise<string | null> {
    logVerbose(`EorContractPage.createEorContract country=${data.country} email=${data.email}`);

    await this.open();
    await this.selectEmployeeWorkerType();
    await this.selectEorEmploymentType();
    await this.fillSimulationStep({
      country: data.country,
      salary: data.salary,
      currency: data.currency,
    });
    await this.fillEmployeeInfo({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      nationality: data.nationality,
      startDate: data.startDate,
      jobTitle: data.jobTitle,
      jobDescription: data.jobDescription,
      employmentTerm: data.employmentTerm ?? 'Indefinite',
      employmentType: data.employmentType ?? 'Full-time',
    });
    await this.fillCompensationAndBenefits({
      annualLeaveDays: data.annualLeaveDays,
      trialPeriodDays: data.trialPeriodDays,
      includeInsurance: data.includeInsurance,
    });

    const url = this.page.url();
    logVerbose(`EorContractPage.createEorContract — post-creation URL: ${url}`);

    // Pattern 1: query param ?id=REFID  (e.g. /contract/detail?id=FU374L3H)
    const queryMatch = url.match(/[?&]id=([A-Za-z0-9]+)/i);
    if (queryMatch) {
      logVerbose(`EorContractPage.createEorContract — ref from query param: ${queryMatch[1]}`);
      return queryMatch[1];
    }

    // Pattern 2: path segment  /contracts/REFID or /contract/REFID
    const EXCLUDED = new Set(['new', 'create', 'wizard', 'pending', 'eor', 'list', 'edit', 'detail']);
    const pathMatch = url.match(/\/contracts?\/(?:[a-z]+\/)?([A-Z0-9]{4,})/i);
    if (pathMatch && !EXCLUDED.has(pathMatch[1].toLowerCase())) {
      logVerbose(`EorContractPage.createEorContract — ref from URL path: ${pathMatch[1]}`);
      return pathMatch[1];
    }

    logVerbose(`EorContractPage.createEorContract — could not extract ref from URL: ${url}`);
    return null;
  }

  // ==== Verification helpers ==============================================

  async isCountrySearchable(country: string): Promise<boolean> {
    logVerbose(`EorContractPage.isCountrySearchable country=${country}`);
    await this.countryDropdown.click();
    const menu = this.page.locator('[class*="menu"]').first();
    if (!(await menu.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await this.countryDropdown.locator('input').first().click().catch(() => this.countryDropdown.click());
    }
    await menu.waitFor({ state: 'visible', timeout: 5_000 });
    await this.page.keyboard.type(country);
    const option = this.page.locator('[class*="option"]').filter({ hasText: country }).first();
    const found = await option.isVisible({ timeout: 3_000 }).catch(() => false);
    await this.page.keyboard.press('Escape');
    await menu.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
    return found;
  }

  async eorSpecificFieldsVisible(): Promise<boolean> {
    logVerbose('EorContractPage.eorSpecificFieldsVisible');
    const salaryVisible = await this.yearlySalaryInput.isVisible({ timeout: 5_000 }).catch(() => false);
    const countryVisible = await this.countryDropdown.isVisible({ timeout: 5_000 }).catch(() => false);
    return salaryVisible && countryVisible;
  }

  /** Dynamic text-anywhere-on-page locator (LOC-005) — e.g. asserting an employee name or job title rendered post-creation. */
  textOnPage(text: string): Locator {
    logVerbose(`EorContractPage.textOnPage text=${text}`);
    return this.page.getByText(text, { exact: false });
  }

  /** Dynamic locator for a specific contract ref rendered anywhere on the page (e.g. in a list row). */
  contractRefText(ref: string): Locator {
    logVerbose(`EorContractPage.contractRefText ref=${ref}`);
    return this.page.getByText(ref, { exact: false }).first();
  }
}
