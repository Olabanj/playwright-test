import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Page Object for the Direct Employee (DE) contract creation wizard.
 *
 * Wizard steps:
 *   1  Worker Type       → "An Employee" → "Direct Employee" (dismiss intro modal)
 *   2  Contract Info     → Employment Term/Type, Seniority, Job Title, Employee ID
 *   3  Payment           → Salary, Currency, Start Date, Payment Cycle
 *   4  Compliance        → Upload contract PDF, Create
 *
 * Entered directly via `ROUTES.contractCreate` (`/contract/create`) — the
 * sibling of the bulk-import wizard's `ROUTES.bulkCreation`.
 */
export class DEContractPage extends BasePage {
  private selectedPayrollProvider: 'remotepass' | 'external' | null = null;

  // ==== Step 1 — Worker Type ============================================

  readonly employeeCard = this.page.getByText('An Employee', { exact: true });

  // ==== Step 1b — Employment Type =======================================

  readonly directEmployeeCard = this.page.getByText('Direct Employee', { exact: true });
  readonly continueButton = this.page.getByRole('button', { name: 'Continue' });
  readonly backButton = this.page.getByRole('button', { name: 'Back' });

  // ==== Entity Selection ================================================

  readonly entityDropdown = this.page.locator('label, span').filter({ hasText: /select entity/i })
    .locator('..').locator('[class*="control"]').first()
    .or(this.page.locator('[class*="entity"] [class*="control"]').first());

  // ==== Step 2 — Contract Info ==========================================

  readonly definiteTermCard = this.page.locator('text=Definite').first();
  readonly indefiniteTermCard = this.page.locator('text=Indefinite').first();
  readonly fullTimeCard = this.page.locator('text=Full-time').first();
  readonly partTimeCard = this.page.locator('text=Part-time').first();
  readonly seniorityDropdown = this.page.locator('[name="seniority"]')
    .or(this.page.getByLabel(/seniority/i));
  readonly jobTitleInput = this.page.locator('input[name="name"]');
  readonly employeeIdInput = this.page.locator('input[name="employee_identifier"]');
  readonly visaNumberInput = this.page.locator('input[name="visa_number"]')
    .or(this.page.getByLabel(/visa number/i));

  // ==== Step 3 — Payment ================================================

  readonly remotePassPayrollCard = this.page.getByText('Use RemotePass as payroll provider');
  readonly externalPayrollCard = this.page.getByText('Use external payroll provider');
  readonly salaryAmountInput = this.page.locator('input[name="amount"]')
    .or(this.page.locator('input[name="rate"]'))
    .or(this.page.locator('input[name="salary"]'))
    .or(this.page.getByPlaceholder(/base salary/i));
  readonly currencyDropdown = this.page.locator('[name="currency_id"]')
    .or(this.page.getByLabel(/currency/i));
  readonly startDateInput = this.page.locator('input[name="start_date"]')
    .or(this.page.locator('input[type="date"]').first());
  readonly endDateInput = this.page.locator('input[name="end_date"]')
    .or(this.page.getByLabel(/end date/i));

  /**
   * BUGFIX (discovered while stabilizing create-de-contract.spec.ts, 2026-07-09):
   * "Start date"/"End date"/"First payroll month" are all react-datepicker
   * overlays (button+span, not a fillable input — that's why `startDateInput`
   * never matches on this step) sharing no distinguishing class or name. A
   * positional `nth(1)` (assuming exactly 2 wrappers: Start date, then First
   * payroll month) broke for Definite-term contracts, where an "End date"
   * wrapper renders in between, shifting the index. Scope by the field's own
   * `<label>` text instead — order-independent.
   * FRAGILE: `.react-datepicker-wrapper` still has no distinguishing class/name
   * of its own — add data-testid to app (QA-208).
   */
  readonly firstPayrollMonthField = this.page.locator('label')
    .filter({ hasText: 'First payroll month' })
    .locator('..')
    .locator('.react-datepicker-wrapper');
  readonly availablePayrollMonthOption = this.page
    .locator('.react-datepicker__month-text:not(.react-datepicker__month-text--disabled)').first();

  // ==== Step 4 — Compliance / Upload ====================================

  readonly uploadContractInput = this.page.locator('input[type="file"]');
  readonly probationPeriodInput = this.page.locator('input[name="probation_period"]')
    .or(this.page.getByLabel(/probation/i));
  readonly noticePeriodInput = this.page.locator('input[name="notice_period"]')
    .or(this.page.getByLabel(/notice/i));
  readonly createButton = this.page.getByRole('button', { name: /create/i });

  // ==== Wizard chrome ===================================================

  readonly closeWizardButton = this.page.locator('[aria-label="close"], [aria-label="Close"]')
    .or(this.page.getByRole('button', { name: /close/i }))
    .or(this.page.locator('button').filter({ hasText: /×|✕/ }));

  // ==== Validation errors ===============================================

  readonly requiredFieldErrors = this.page.locator('[aria-invalid="true"], [class*="error-message"], .invalid-feedback');
  readonly salaryValidationError = this.page.getByText(/salary.*required|amount.*required|amount.*greater|salary.*greater/i);
  readonly startDateValidationError = this.page.getByText(/start.*date.*required|date.*invalid|date.*valid/i);
  readonly uploadRejectionError = this.page.getByText(/invalid|not allowed|pdf only|unsupported/i).first();

  // ==== Navigation Methods ==============================================

  async open(): Promise<void> {
    logVerbose('DEContractPage.open');
    await this.goto(ROUTES.contractCreate);
    await this.employeeCard.waitFor({ state: 'visible', timeout: 15000 });
  }

  async selectEmployeeWorkerType(): Promise<void> {
    logVerbose('DEContractPage.selectEmployeeWorkerType');
    await this.employeeCard.click();
    await this.continueButton.click();
    await this.page.getByText('Employment Type').waitFor({ state: 'visible', timeout: 10000 });
  }

  async selectDirectEmployeeType(): Promise<void> {
    logVerbose('DEContractPage.selectDirectEmployeeType');
    await this.directEmployeeCard.click();

    const modalContinue = this.page.locator('[role="dialog"] button').filter({ hasText: /continue/i });
    const modalClose = this.page.locator('[role="dialog"] [aria-label="Close"]')
      .or(this.page.locator('[role="dialog"] .close'));

    // BUGFIX (discovered while porting create-de-contract.spec.ts, 2026-07-09): a
    // single 3s check missed the intro modal when it rendered with a longer delay —
    // the caller then proceeded to fill the (modal-obscured) Contract Info form,
    // and a LATER "Continue" click matched both the modal's own Continue button and
    // the form's, throwing a strict-mode violation. Poll for up to ~8s so a
    // late-appearing modal is still dismissed here, before the caller proceeds.
    let dismissed = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (await modalContinue.isVisible({ timeout: 2000 }).catch(() => false)) {
        await modalContinue.click();
        logVerbose('DEContractPage.selectDirectEmployeeType — dismissed DE intro modal');
        dismissed = true;
        break;
      }
      if (await modalClose.isVisible({ timeout: 500 }).catch(() => false)) {
        await modalClose.click();
        logVerbose('DEContractPage.selectDirectEmployeeType — dismissed DE intro modal via close button');
        dismissed = true;
        break;
      }
    }

    // BUGFIX (discovered while stabilizing create-de-contract.spec.ts, 2026-07-09):
    // dismissing the modal only starts its close animation — the `[role="dialog"]`
    // node (and its own "Continue" button) stays attached to the DOM for a beat
    // afterward. A caller that clicks the page's `continueButton` immediately
    // (e.g. TC_UI_DE_003, which has no entity-selection/fill step in between to
    // absorb the delay) hits a strict-mode violation: `getByRole('button', {name:
    // 'Continue'})` resolves both the dialog's (still-attached) button and the
    // real form's. Wait for the dialog to fully detach before returning, so every
    // caller — fast or slow — sees a clean single-button DOM.
    if (dismissed) {
      await this.page.locator('[role="dialog"]').first()
        .waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
    }

    await this.page.getByText('Contract').first()
      .waitFor({ state: 'visible', timeout: 10000 });
  }

  async selectEntity(entityName?: string): Promise<void> {
    logVerbose(`DEContractPage.selectEntity entityName=${entityName ?? '(first available)'}`);

    // FRAGILE: css-*-control is auto-generated by React-Select CSS Modules — add data-testid to app (QA-208)
    const control = this.page.locator('div[class*="css-"][class*="-control"]').first();
    if (!(await control.isVisible({ timeout: 5000 }).catch(() => false))) {
      logVerbose('DEContractPage.selectEntity — no entity dropdown visible, entity may be auto-selected');
      return;
    }

    // BUGFIX (discovered while stabilizing create-de-contract.spec.ts, 2026-07-09):
    // the "Select entity" text is a persistent field LABEL, not a placeholder
    // that disappears once a value is picked (same root cause already worked
    // around in `selectSeniority` below) — using it to detect "already
    // selected" made every repeat call (e.g. `proceedFromContractInfo`'s
    // fallback, invoked right after this method already succeeded once)
    // reopen and re-search the dropdown, which sometimes cannot re-find the
    // now-selected option and times out. Read the control's own rendered text
    // instead: once selected, react-select displays the entity's name inside
    // the control itself, so a control that already shows the target name
    // makes this call a safe no-op.
    if (entityName) {
      const currentText = ((await control.textContent().catch(() => '')) ?? '').trim();
      if (currentText.includes(entityName.substring(0, 25))) {
        logVerbose('DEContractPage.selectEntity — entity already selected, skipping');
        return;
      }
    }

    await control.scrollIntoViewIfNeeded();

    // FRAGILE: [class*="menu"] / [class*="option"] are React-Select internals — add data-testid to app (QA-208)
    const menu = this.page.locator('[class*="menu"]').first();
    for (let attempt = 0; attempt < 3; attempt++) {
      await control.click();
      if (await menu.isVisible({ timeout: 2000 }).catch(() => false)) break;
      logVerbose(`DEContractPage.selectEntity — entity menu not visible, retrying (${attempt + 1}/3)`);
    }
    await menu.waitFor({ state: 'visible', timeout: 5000 });

    if (entityName) {
      await this.page.keyboard.type(entityName.substring(0, 25));
      const option = this.page.locator('[class*="option"]')
        .filter({ hasText: entityName }).first();
      await option.waitFor({ state: 'visible', timeout: 8000 });
      await option.click();
    } else {
      const firstOption = this.page.locator('[class*="option"]').first();
      await firstOption.waitFor({ state: 'visible', timeout: 5000 });
      await firstOption.click();
    }
  }

  // ==== Step 2 — Contract Info Methods ==================================

  async fillContractInfo(data: {
    employmentTerm?: 'Definite' | 'Indefinite';
    employmentType?: 'Full-time' | 'Part-time';
    jobTitle: string;
    employeeId?: string;
    visaNumber?: string;
  }): Promise<void> {
    logVerbose(`DEContractPage.fillContractInfo jobTitle=${data.jobTitle}`);

    await this.jobTitleInput.waitFor({ state: 'visible', timeout: 10000 });

    if (data.employmentTerm === 'Definite') {
      await this.definiteTermCard.click();
    } else if (data.employmentTerm === 'Indefinite') {
      await this.indefiniteTermCard.click();
    }

    if (data.employmentType === 'Full-time') {
      await this.fullTimeCard.click();
    } else if (data.employmentType === 'Part-time') {
      await this.partTimeCard.click();
    }

    await this.selectSeniority();
    await this.jobTitleInput.fill(data.jobTitle);

    if (data.employeeId) {
      await this.employeeIdInput.fill(data.employeeId);
    }

    if (data.visaNumber && await this.visaNumberInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.visaNumberInput.fill(data.visaNumber);
    }
  }

  async proceedFromContractInfo(entityName?: string): Promise<void> {
    logVerbose('DEContractPage.proceedFromContractInfo');
    await this.continueButton.scrollIntoViewIfNeeded();
    await this.continueButton.click();

    // Detect Payment step by heading or payroll provider cards
    const paymentIndicator = this.page.getByRole('heading', { name: 'Payment' })
      .or(this.remotePassPayrollCard)
      .or(this.page.locator('input[placeholder="Base salary"]'));
    const landed = await paymentIndicator.first().isVisible({ timeout: 10000 }).catch(() => false);

    if (!landed) {
      // BUGFIX (discovered while stabilizing create-de-contract.spec.ts, 2026-07-09):
      // the Contract Info → Payment transition can legitimately take longer than
      // the 10s check above on a loaded sandbox — the outgoing Contract Info DOM
      // (including its own `continueButton`) stays attached and visible for a
      // beat while the incoming Payment DOM mounts alongside it, so a fixed
      // "still on Contract Info?" snapshot check is unreliable here. Give the
      // transition one more grace window before concluding it's genuinely stuck.
      const landedAfterGrace = await paymentIndicator.first().isVisible({ timeout: 8000 }).catch(() => false);
      if (landedAfterGrace) return;

      logVerbose('DEContractPage.proceedFromContractInfo — still on Contract Info, checking entity/seniority');
      // `selectEntity` now guards its own "already selected?" check against the
      // control's rendered text (see BUGFIX there) — safe to call unconditionally.
      await this.selectEntity(entityName);
      await this.selectSeniority();
      // Grabbing `continueButton` a second time can still race the tail of a
      // just-completing transition (see above) — treat a detach here as "we
      // probably already landed" rather than a hard failure; the final
      // `waitFor` below is the authoritative check either way.
      try {
        await this.continueButton.scrollIntoViewIfNeeded({ timeout: 5000 });
        await this.continueButton.click({ timeout: 5000 });
      } catch {
        logVerbose('DEContractPage.proceedFromContractInfo — continueButton detached on retry, likely mid-transition');
      }
      await paymentIndicator.first().waitFor({ state: 'visible', timeout: 15000 });
    }
  }

  // ==== Step 3 — Payment Methods ========================================

  async fillPaymentDetails(data: {
    salary: string | number;
    startDate?: string;
    endDate?: string;
    payrollProvider?: 'remotepass' | 'external';
  }): Promise<void> {
    logVerbose(`DEContractPage.fillPaymentDetails salary=${data.salary}`);

    const provider = data.payrollProvider ?? 'remotepass';
    this.selectedPayrollProvider = provider;
    const card = provider === 'external' ? this.externalPayrollCard : this.remotePassPayrollCard;
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      await card.click();
    }

    await this.salaryAmountInput.first().waitFor({ state: 'visible', timeout: 10000 });
    await this.salaryAmountInput.first().fill(String(data.salary));

    if (data.startDate && await this.startDateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.startDateInput.fill(data.startDate);
    }

    if (data.endDate) {
      await this.selectDateFromPicker('End date', data.endDate);
    }

    await this.selectFirstAvailableDropdown();
    await this.selectFirstAvailableDropdown();
    await this.selectValidFirstPayrollMonth();
  }

  /**
   * BUGFIX (discovered while stabilizing create-de-contract.spec.ts, 2026-07-09):
   * "First payroll month" always defaults to the CURRENT month, which the
   * backend rejects at submission time (`Validation Error: The first payroll
   * month must be a date after or equal to <1st of next month>`) once the
   * current month's payroll cutoff has passed — but the wizard's own client-side
   * validation lets the Payment → Compliance step transition proceed anyway, so
   * the invalid month only surfaces as a silent failure on the final "Create"
   * submission (HTTP 200, `{success:false}`, no toast asserted by the POM/spec —
   * the wizard is left sitting on the Compliance step with no URL change).
   * The calendar itself already renders the current/past months as disabled
   * ("Not available") and the next valid month onward as enabled ("Choose ...") —
   * this only opens that picker and takes the first enabled option so every
   * caller always lands on a submittable month, regardless of what day of the
   * month the suite runs on.
   */
  private async selectValidFirstPayrollMonth(): Promise<void> {
    logVerbose('DEContractPage.selectValidFirstPayrollMonth');
    if (!(await this.firstPayrollMonthField.isVisible({ timeout: 3000 }).catch(() => false))) return;

    await this.firstPayrollMonthField.locator('button').first().click();
    if (await this.availablePayrollMonthOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.availablePayrollMonthOption.click();
    } else {
      logVerbose('DEContractPage.selectValidFirstPayrollMonth — no enabled month option found, leaving default');
    }
  }

  async proceedFromPayment(): Promise<void> {
    logVerbose('DEContractPage.proceedFromPayment');
    await this.continueButton.scrollIntoViewIfNeeded();
    await this.continueButton.click();

    // Wait for Compliance step indicator: file upload or Create button
    const complianceReady = this.uploadContractInput.or(this.createButton);
    const landed = await complianceReady.first().isVisible({ timeout: 10000 }).catch(() => false);

    if (!landed) {
      logVerbose('DEContractPage.proceedFromPayment — still on Payment, retrying payroll provider selection');
      await this.page.evaluate(() => window.scrollTo(0, 0));
      const preferred = this.selectedPayrollProvider ?? 'remotepass';
      const primaryCard = preferred === 'external' ? this.externalPayrollCard : this.remotePassPayrollCard;
      const secondaryCard = preferred === 'external' ? this.remotePassPayrollCard : this.externalPayrollCard;
      if (await primaryCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await primaryCard.click();
      } else if (await secondaryCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await secondaryCard.click();
      }
      await this.continueButton.scrollIntoViewIfNeeded();
      await this.continueButton.click();
      await complianceReady.first().waitFor({ state: 'visible', timeout: 10000 });
    }
  }

  // ==== Step 4 — Compliance / Upload Methods ============================

  async fillComplianceAndCreate(data: {
    pdfPath?: string;
    probationDays?: number;
    noticeDays?: number;
  }): Promise<void> {
    logVerbose('DEContractPage.fillComplianceAndCreate');

    if (data.pdfPath && await this.uploadContractInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.uploadContractInput.setInputFiles(data.pdfPath);
      await this.createButton.waitFor({ state: 'visible', timeout: 10000 });
    }

    if (await this.probationPeriodInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.probationPeriodInput.fill(String(data.probationDays ?? 30));
    }

    if (await this.noticePeriodInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.noticePeriodInput.fill(String(data.noticeDays ?? 30));
    }

    await this.createButton.scrollIntoViewIfNeeded();
    await this.createButton.click();

    await this.page.waitForURL((url) => {
      const u = url.toString();
      return u.includes('/contract/detail') || u.includes('/contracts') || u.includes('?id=');
    }, { timeout: 30_000 }).catch(() => {
      logVerbose(`DEContractPage.fillComplianceAndCreate — URL after create: ${this.page.url()}`);
    });
  }

  // ==== Helper to navigate to Payment step ==============================

  async navigateToPaymentStep(contractData: {
    jobTitle: string;
    employeeId?: string;
    employmentTerm?: 'Definite' | 'Indefinite';
    employmentType?: 'Full-time' | 'Part-time';
    entityName?: string;
  }): Promise<void> {
    logVerbose('DEContractPage.navigateToPaymentStep');
    await this.open();
    await this.selectEmployeeWorkerType();
    await this.selectDirectEmployeeType();
    await this.selectEntity(contractData.entityName);
    await this.fillContractInfo(contractData);
    await this.proceedFromContractInfo(contractData.entityName);
  }

  // ==== Close Wizard ====================================================

  async closeWizard(): Promise<void> {
    logVerbose('DEContractPage.closeWizard');
    if (await this.closeWizardButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.closeWizardButton.first().click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  // ==== Private Helpers =================================================

  private async selectSeniority(): Promise<void> {
    logVerbose('DEContractPage.selectSeniority');
    const seniorityLabel = this.page.getByText('Seniority level');
    if (!(await seniorityLabel.isVisible({ timeout: 3000 }).catch(() => false))) return;

    await seniorityLabel.scrollIntoViewIfNeeded();

    // BUGFIX (discovered while porting create-de-contract.spec.ts, 2026-07-09): the
    // previous check used the "Select entity" PLACEHOLDER text, which disappears the
    // moment an entity is selected — every caller in this feature selects the entity
    // BEFORE calling fillContractInfo, so that check always resolved to `false` and
    // this method targeted the already-filled entity control (index 0) instead of
    // Seniority (index 1), silently leaving Seniority unfilled and the wizard's later
    // "Create" click failing with no visible error. The "Entity" SECTION HEADING
    // persists regardless of selection state, so it reliably reflects whether an
    // entity control renders on this step at all.
    const entityHeading = this.page.getByRole('heading', { name: 'Entity' });
    const entityPresent = await entityHeading.isVisible({ timeout: 1000 }).catch(() => false);
    const seniorityIndex = entityPresent ? 1 : 0;
    // FRAGILE: css-*-control is auto-generated by React-Select CSS Modules — add data-testid to app (QA-208)
    const control = this.page.locator('div[class*="css-"][class*="-control"]').nth(seniorityIndex);

    if (!(await control.isVisible({ timeout: 3000 }).catch(() => false))) return;

    const menu = this.page.locator('[class*="menu"]').first();
    for (let attempt = 0; attempt < 3; attempt++) {
      await control.click();
      if (await menu.isVisible({ timeout: 2000 }).catch(() => false)) break;
      logVerbose(`DEContractPage.selectSeniority — menu not visible, retrying (${attempt + 1}/3)`);
    }

    if (await menu.isVisible({ timeout: 2000 }).catch(() => false)) {
      const option = this.page.locator('[class*="option"], [role="option"]').first();
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
      // BUGFIX (discovered while stabilizing create-de-contract.spec.ts, 2026-07-09):
      // the caller (`proceedFromContractInfo`) immediately scrolls to and clicks
      // `continueButton` right after this returns — without waiting for the
      // dropdown's closing reflow to settle first, that scroll sometimes lands
      // mid-re-render and throws "Element is not attached to the DOM". Wait for
      // the menu to actually close before handing control back.
      await menu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
    }
  }

  private async selectFirstAvailableDropdown(): Promise<void> {
    logVerbose('DEContractPage.selectFirstAvailableDropdown');
    const dropdown = this.page.locator('[class*="control"]')
      .filter({ hasText: /^Select/ }).first();
    if (await dropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dropdown.click();
      const option = this.page.locator('[class*="option"], [role="option"]').first();
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
    }
  }

  // ==== Date Picker Helper ================================================

  private async selectDateFromPicker(placeholderText: string, dateStr: string): Promise<void> {
    logVerbose(`DEContractPage.selectDateFromPicker placeholder=${placeholderText} date=${dateStr}`);
    const [year, month, day] = dateStr.split('-').map(Number);

    // Click the overlay button to open the calendar
    const placeholder = this.page.getByText(placeholderText, { exact: true });
    const container = placeholder.locator('..');
    await container.locator('button').first().scrollIntoViewIfNeeded();
    await container.locator('button').first().click();

    // Wait for the calendar popup to appear
    const calendar = this.page.locator('.react-datepicker, [class*="datepicker"], [role="dialog"]').first();
    await calendar.waitFor({ state: 'visible', timeout: 5000 });

    // Use the year and month select dropdowns (react-datepicker)
    const yearSelect = this.page.locator('select.react-datepicker__year-select, select[class*="year"]').first();
    const monthSelect = this.page.locator('select.react-datepicker__month-select, select[class*="month"]').first();

    if (await yearSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await yearSelect.selectOption(String(year));
    }
    if (await monthSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await monthSelect.selectOption(String(month - 1));
    }

    // Click the target day — find the day cell that's not from adjacent months
    const dayButton = this.page.locator(
      '.react-datepicker__day:not(.react-datepicker__day--outside-month), [class*="datepicker"] [class*="day"]:not([class*="outside"])',
    ).getByText(String(day), { exact: true });
    await dayButton.first().click();
  }

  // ==== URL Parsing =====================================================

  extractContractRef(url: string): string | null {
    logVerbose(`DEContractPage.extractContractRef url=${url}`);
    const reserved = ['create', 'new', 'edit', 'list', 'detail', 'undefined'];

    const qpMatch = url.match(/[?&]id=([A-Za-z0-9]+)/i);
    if (qpMatch && !reserved.includes(qpMatch[1].toLowerCase())) return qpMatch[1];

    const pathMatch = url.match(/\/contract[s]?\/([A-Za-z0-9]+)/i);
    if (pathMatch && !reserved.includes(pathMatch[1].toLowerCase())) return pathMatch[1];

    return null;
  }

  // ==== Full Wizard Flow ================================================

  async createDEContract(data: {
    jobTitle: string;
    employeeId?: string;
    salary: string | number;
    startDate?: string;
    endDate?: string;
    entityName?: string;
    employmentTerm?: 'Definite' | 'Indefinite';
    employmentType?: 'Full-time' | 'Part-time';
    payrollProvider?: 'remotepass' | 'external';
    pdfPath?: string;
    probationDays?: number;
    noticeDays?: number;
  }): Promise<string | null> {
    logVerbose(`DEContractPage.createDEContract jobTitle=${data.jobTitle}`);

    await this.open();
    await this.selectEmployeeWorkerType();
    await this.selectDirectEmployeeType();
    await this.selectEntity(data.entityName);
    await this.fillContractInfo({
      jobTitle: data.jobTitle,
      employeeId: data.employeeId,
      employmentTerm: data.employmentTerm,
      employmentType: data.employmentType,
    });
    await this.proceedFromContractInfo(data.entityName);
    await this.fillPaymentDetails({
      salary: data.salary,
      startDate: data.startDate,
      endDate: data.endDate,
      payrollProvider: data.payrollProvider,
    });
    await this.proceedFromPayment();
    await this.fillComplianceAndCreate({
      pdfPath: data.pdfPath,
      probationDays: data.probationDays,
      noticeDays: data.noticeDays,
    });

    await this.page.waitForLoadState('domcontentloaded');
    return this.extractContractRef(this.page.url());
  }

  // ==== Verification ====================================================

  async getSalaryValue(): Promise<string> {
    logVerbose('DEContractPage.getSalaryValue');
    const raw = await this.salaryAmountInput.inputValue();
    return raw.replace(/^[A-Z]{2,4}\s+/, '').replace(/,/g, '').trim();
  }
}
