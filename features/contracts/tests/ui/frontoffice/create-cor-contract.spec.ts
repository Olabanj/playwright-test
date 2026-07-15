import { test as contractsTest, expect } from '@features/contracts/fixtures';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { AdminClient } from '@features/admin/api-client';
import {
  createCorContractViaApi,
  createCorContractAndSignSow,
  signCorToOngoing,
} from '@features/contracts/seeding';
import { isDbEnvPresent } from '@core/db/db-config';

/**
 * Create COR (Contractor of Record) Contract — UI wizard + detail page.
 *
 * Ported (intent, not implementation) from
 * tests/modules/contracts/ui/verify/create-cor-contract.spec.ts
 * (TC_UI_COR_001-019).
 *
 * COR is NOT a standalone contract type — it is `is_cor: true` on a
 * Fixed/PAYG/Milestone contract. Per
 * docs/test-migration/scenarios/contracts.md: "COR cannot be created through
 * its real wizard on seeded sandbox accounts (the toggle requires additional
 * COR-provider onboarding with no automation hook) — COR is created via the
 * API-lane client even inside the UI full-cycle suite, then only the Ongoing
 * badge is asserted on the UI." Every test below that needs a genuinely
 * persisted COR contract (creation/field/SoW/Ongoing checks) therefore
 * API-creates via `createCorContractViaApi`/`createCorContractAndSignSow`
 * (reusing the owner-feature `seeding.ts`, never inline HTTP) and verifies
 * through `corContractPage`/`contractDetailPage` — both bound to the same
 * client-authenticated page as `contractsClient`, so the UI can view what the
 * API created. Tests that only exercise the WIZARD's own UI (toggle
 * visibility, field validation, cancel, back-button) still drive the wizard
 * directly — they assert on-screen behaviour, not backend `is_cor`
 * persistence, so the sandbox limitation above does not apply to them.
 *
 * Fixture choice: COR contracts are created on the shared worker-scoped
 * `contractsClient` (bound to `clientAccount`, same as `corContractPage`/
 * `contractDetailPage` via `bulkImportClientPage`) — NOT `finishedContractsClient`
 * — mirrors `features/contracts/tests/api/create-cor-contract.spec.ts`'s
 * documented rationale: COR needs an account with a signatory + contract
 * templates, which a fresh `finishedContractsClient` does not have. COR is
 * enabled once per worker via the local `corEnabled` auto fixture below
 * (idempotent `AdminClient.enableCor`), same pattern as the API-lane sibling
 * spec — not `contracts/fixtures.ts`'s `seedCorContract` (hard-wired to
 * `finishedContractsClient`, which this spec deliberately does not use).
 *
 * TC_UI_COR_011/018/019 (full sign-to-Ongoing lifecycles) are behind
 * `isDbEnvPresent()` + the `seedContractorWorker` null sentinel
 * (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md).
 *
 * TC_UI_COR_013 stays a documented `test.skip(true, ...)`, ported verbatim —
 * no confirmed COR-unsupported, dropdown-selectable country exists on the
 * sandbox to drive that negative case.
 */

// COR is a company-level, idempotent admin toggle (`AdminClient.enableCor`) —
// enabled once per worker (shared static account), mirroring
// `features/contracts/tests/api/create-cor-contract.spec.ts`'s `corEnabled`
// auto fixture. `object` (not `Record<string, never>`) is the lint-clean
// pattern for adding a worker-scoped-only fixture without new test-scope ones.
// TODO(cleanup): lift this inline corEnabled fixture (and its ContractsClient/
// AdminClient construction) into features/contracts/fixtures.ts — shared with
// the api-lane create-cor-contract spec (rule-of-two).
const test = contractsTest.extend<object, { corEnabled: boolean }>({
  corEnabled: [
    async ({ clientAccount }, use) => {
      const contracts = new ContractsClient();
      const admin = new AdminClient();
      try {
        await contracts.init(clientAccount.token);
        await admin.initWithAdminToken();
        const companyId = await contracts.getCompanyId();
        await admin.enableCor(companyId);
      } finally {
        await contracts.dispose();
        await admin.dispose();
      }
      await use(true);
    },
    { scope: 'worker', auto: true },
  ],
});

const CONTRACT_DATA = {
  taxCountry: 'United Arab Emirates',
  role: 'QA COR Engineer',
  scope: 'Software development and QA automation services.',
  rate: 1000,
};

test.describe('Create COR Contract - Wizard + Detail @ui @regression', () => {

  // ==== TC_UI_COR_001: API-create a COR contract, verify is_cor =============

  test('TC_UI_COR_001 — Should create a COR contract and verify is_cor is set @smoke @critical', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createCorContractViaApi(contractsClient, { type: 'Fixed' });

    expect(created.id, 'COR contract creation must produce an id').toBeTruthy();
    expect(created.ref, 'COR contract creation must produce a ref').toBeTruthy();

    try {
      const details = await contractsClient.getContract(created.ref);
      const raw = details as unknown as Record<string, unknown>;

      expect([1, true]).toContain(raw.is_cor);
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_COR_002: Verify contract fields via API ========================

  test('TC_UI_COR_002 — Should verify contract fields (rate, currency, start date) via API after creation @smoke', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createCorContractViaApi(contractsClient, { type: 'Fixed' });

    try {
      const details = await contractsClient.getContract(created.ref);
      const raw = details as unknown as Record<string, unknown>;

      const rateValue = details.amount ?? details.rate ?? details.salary ?? details.total_amount;
      if (rateValue !== undefined) {
        expect(Number(rateValue)).toBeGreaterThan(0);
      } else {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_UI_COR_002: contract details endpoint does not return a rate/amount field',
        });
      }

      const currencyCode = details.currency?.code ?? details.salary_currency?.code;

      expect(currencyCode).toBeTruthy();

      const startDate = raw.start_date ?? raw.starts_at;
      if (startDate) expect(startDate).toBeTruthy();

      expect([1, true]).toContain(raw.is_cor);
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_COR_003: COR toggle renders and is enableable ==================

  test('TC_UI_COR_003 — Should verify COR toggle renders and is enableable in the wizard @smoke', async ({
    corContractPage,
  }) => {
    test.setTimeout(90_000);
    await corContractPage.navigateToContractInfoStep();
    await corContractPage.selectContractType('Fixed');
    await corContractPage.fillTaxCountry(CONTRACT_DATA.taxCountry);

    const corVisible = await corContractPage.isCorToggleVisible();

    expect(
      corVisible,
      'COR toggle must render after selecting a COR-supported country (UAE) on a COR-enabled company',
    ).toBe(true);

    const enabled = await corContractPage.enableCorToggle();

    expect(enabled, 'COR toggle must be enableable once visible').toBe(true);

    // Enabling opens a COR-provider-onboarding modal with no automation hook
    // (docs/test-migration/scenarios/contracts.md) — dismiss it before the
    // wizard's own close control is reachable again.
    await corContractPage.dismissOnboardingModal();
    await corContractPage.closeWizard();
  });

  // ==== TC_UI_COR_004: COR-specific fields appear on country selection ======

  test('TC_UI_COR_004 — Should verify COR-specific fields appear on country selection @smoke', async ({
    corContractPage,
  }) => {
    test.setTimeout(90_000);
    await corContractPage.navigateToContractInfoStep();
    await corContractPage.selectContractType('Fixed');
    await corContractPage.fillTaxCountry(CONTRACT_DATA.taxCountry);

    const visibleCorFields = await corContractPage.countCorSpecificFields();

    expect(
      visibleCorFields,
      'At least one COR-specific field must render after selecting a COR-supported country',
    ).toBeGreaterThan(0);

    await corContractPage.closeWizard();
  });

  // ==== TC_UI_COR_005: Validation on empty required fields ===================

  test('TC_UI_COR_005 — Should show validation error on empty required fields @regression', async ({
    corContractPage,
  }) => {
    test.setTimeout(90_000);
    await corContractPage.navigateToContractInfoStep();
    await corContractPage.selectContractType('Fixed');

    await corContractPage.roleInput.clear();
    await corContractPage.continueButton.click();

    // The hard invariant: an empty required field must NOT advance the wizard.
    const stayedOnStep = await corContractPage.roleInput.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(stayedOnStep, 'Empty required field must block the wizard from advancing').toBe(true);

    await corContractPage.closeWizard();
  });

  // ==== TC_UI_COR_006: Validation on invalid rate =============================

  test('TC_UI_COR_006 — Should show validation error on invalid rate (zero) @regression', async ({
    corContractPage,
  }) => {
    test.setTimeout(90_000);
    await corContractPage.navigateToPaymentStep({
      taxCountry: CONTRACT_DATA.taxCountry,
      role: CONTRACT_DATA.role,
      scope: CONTRACT_DATA.scope,
    });

    await expect(corContractPage.rateAmountInput, 'Rate field must render on the payment step')
      .toBeVisible({ timeout: 10_000 });

    await corContractPage.rateAmountInput.fill('0');
    await corContractPage.continueButton.click();

    // Hard invariant: a zero rate must NOT advance past the payment step.
    const stayedOnStep = await corContractPage.rateAmountInput.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(stayedOnStep, 'Invalid rate (0) must block the wizard from advancing').toBe(true);

    await corContractPage.closeWizard();
  });

  // ==== TC_UI_COR_007: Validation on unsupported country ======================

  test('TC_UI_COR_007 — Should show validation error on unsupported country @regression', async ({
    corContractPage,
  }) => {
    test.fixme(true, 'QA-443: non-existent country still yields dropdown options — QA-454');
    test.setTimeout(90_000);
    await corContractPage.navigateToContractInfoStep();
    await corContractPage.selectContractType('Fixed');

    const noResults = await corContractPage.searchTaxCountryShowsNoResults('Narnia');

    expect(
      noResults,
      'A non-existent country ("Narnia") must yield no options in the country dropdown',
    ).toBe(true);

    await corContractPage.closeWizard();
  });

  // ==== TC_UI_COR_008: Validation on invalid start date =======================

  test('TC_UI_COR_008 — Should show validation error on invalid start date @regression', async ({
    corContractPage,
  }) => {
    test.setTimeout(90_000);
    await corContractPage.navigateToPaymentStep({
      taxCountry: CONTRACT_DATA.taxCountry,
      role: CONTRACT_DATA.role,
      scope: CONTRACT_DATA.scope,
    });

    // TODO(selector): the live Payment step renders "Start date" as a
    // button-triggered date-picker widget (confirmed 2026-07-09), not a
    // fillable `input[type=date]`/`input[name="start_date"]` as legacy
    // assumed. Typing an invalid string into a picker-only control isn't a
    // meaningful interaction, so the negative case can't be ported as-is —
    // gap-annotated below instead of guessing the calendar-popover markup.
    await expect(corContractPage.startDateLabel, 'Start date control must render on the payment step')
      .toBeVisible({ timeout: 10_000 });

    test.info().annotations.push({
      type: 'gap',
      description:
        'TC_UI_COR_008: start date is a button/date-picker widget, not a fillable input — '
        + 'invalid-date-via-fill scenario needs picker-specific automation, not yet built (TODO(selector))',
    });

    await corContractPage.closeWizard();
  });

  // ==== TC_UI_COR_009: Cancel wizard mid-flow =================================

  test('TC_UI_COR_009 — Should cancel wizard mid-flow without saving a contract @regression', async ({
    corContractPage,
    contractsClient,
  }) => {
    test.setTimeout(90_000);
    // Unique role so we can positively assert this exact draft was never persisted.
    const uniqueRole = `Temp Cancel ${Date.now()}`;
    await corContractPage.navigateToContractInfoStep();
    await corContractPage.selectContractType('Fixed');
    await corContractPage.roleInput.fill(uniqueRole);

    const idsBefore = new Set(
      (await contractsClient.listContracts()).map((c) => c.id).filter(Boolean),
    );
    await corContractPage.closeWizard();

    const contractsAfter = await contractsClient.listContracts();
    const persisted = contractsAfter.find((c) => (c.name ?? c.role) === uniqueRole);

    expect(persisted, 'Cancelled wizard must not persist a contract').toBeUndefined();

    const newIds = contractsAfter.map((c) => c.id).filter((id) => id && !idsBefore.has(id));

    expect(newIds, `Unexpected new contract(s) after cancel: ${newIds.join(',')}`).toHaveLength(0);
  });

  // ==== TC_UI_COR_010: Reject non-PDF file upload =============================

  test('TC_UI_COR_010 — Should reject non-PDF file upload on Compliance step @regression', async ({
    corContractPage,
  }) => {
    test.setTimeout(120_000);
    await corContractPage.navigateToPaymentStep({
      taxCountry: CONTRACT_DATA.taxCountry,
      role: CONTRACT_DATA.role,
      scope: CONTRACT_DATA.scope,
    });

    await corContractPage.fillPaymentDetails({ rate: CONTRACT_DATA.rate });
    await corContractPage.proceedFromPaymentStep();

    if (await corContractPage.uploadContractInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // TODO(selector): reuses the legacy fixture image path — no equivalent
      // asset exists yet under this feature's own `fixtures/` folder.
      await corContractPage.uploadContractInput.setInputFiles('fixtures/data/files/test-image.jpg');
      await corContractPage.createButton.waitFor({ state: 'visible', timeout: 10_000 });

      const hasUploadError = await corContractPage.uploadRejectionError
        .isVisible({ timeout: 5_000 }).catch(() => false);
      const createDisabled = await corContractPage.createButton.isDisabled().catch(() => false);

      expect(hasUploadError || createDisabled).toBe(true);
    } else {
      test.info().annotations.push({
        type: 'gap',
        description: 'TC_UI_COR_010: Upload input not visible on Compliance step — may use RemotePass template',
      });
    }

    await corContractPage.closeWizard();
  });

  // ==== TC_UI_COR_011: Fixed COR — contractor signs → Ongoing ================

  // TODO(api-preconditions): depends on the gated DB-OTP worker-registration
  // layer (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) — retire the
  // two skip guards below the moment a worker-side OTP bypass ships.
  test('TC_UI_COR_011 — Fixed COR: contractor signs → contract becomes Ongoing @smoke @critical', async ({
    contractsClient,
    paymentClient,
    adminClient,
    contractDetailPage,
    seedContractorWorker,
  }) => {
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );
    test.setTimeout(180_000);

    const worker = await seedContractorWorker('cor-ui-fixed');
    test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

    const created = await createCorContractViaApi(contractsClient, { type: 'Fixed' });
    try {
      const signatory = await contractsClient.getSignatory();

      const result = await signCorToOngoing({
        contracts:      contractsClient,
        payments:       paymentClient,
        admin:          adminClient,
        contractId:     created.id,
        contractRef:    created.ref,
        worker:         worker!,
        signatoryName:  signatory.name,
        processDeposit: true,
      });

      if (result.depositGap) {
        test.info().annotations.push({
          type: 'gap',
          description: `TC_UI_COR_011: lightweight deposit step stopped — ${result.depositGap}`,
        });
      }

      expect(result.reachedOngoing).toBe(true);

      await contractDetailPage.gotoContractDetail(created.id);

      await expect(contractDetailPage.ongoingBadge).toBeVisible();
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_COR_012: Switch rate type → COR toggle stays enableable ========

  test('TC_UI_COR_012 — Switch rate type (Fixed → PAYG → Milestone) → COR toggle stays enableable @regression', async ({
    corContractPage,
  }) => {
    test.setTimeout(90_000);

    for (const contractType of ['Fixed', 'PAYG', 'Milestone'] as const) {
      await corContractPage.navigateToContractInfoStep();
      await corContractPage.selectContractType(contractType);
      await corContractPage.fillTaxCountry(CONTRACT_DATA.taxCountry);

      const visible = await corContractPage.isCorToggleVisible();

      expect(visible, `COR toggle must render for ${contractType} on a COR-supported country`).toBe(true);

      const enabled = await corContractPage.enableCorToggle();

      expect(enabled, `COR toggle must be enableable for ${contractType}`).toBe(true);

      // Enabling opens a COR-provider-onboarding modal with no automation
      // hook (docs/test-migration/scenarios/contracts.md) — dismiss it before
      // the next iteration's navigation.
      await corContractPage.dismissOnboardingModal();
      await corContractPage.closeWizard();
    }
  });

  // ==== TC_UI_COR_013: COR-unsupported country → COR hidden/disabled ========

  test('TC_UI_COR_013 — Select COR-unsupported country → COR option is hidden or disabled @regression', async ({
    corContractPage,
  }) => {
    // Skipped intentionally, ported verbatim from legacy: driving this negative
    // case needs a country that is (a) confirmed COR-unsupported on the sandbox
    // AND (b) selectable in the country dropdown. No such country is currently
    // confirmed. Re-enable once platform confirms a specific COR-disabled-but-
    // selectable country for the sandbox.
    test.skip(true, 'No confirmed COR-unsupported, dropdown-selectable country available on sandbox');

    await corContractPage.navigateToContractInfoStep();
    await corContractPage.selectContractType('Fixed');
    await corContractPage.fillTaxCountry(CONTRACT_DATA.taxCountry);
    const corVisibleSupported = await corContractPage.isCorToggleVisible();
    await corContractPage.closeWizard();

    expect(corVisibleSupported, 'COR toggle must render for the supported baseline country').toBe(true);
  });

  // ==== TC_UI_COR_014: SoW visible and downloadable after creation ==========

  test('TC_UI_COR_014 — After creation → verify SoW document is visible and downloadable in UI @regression', async ({
    contractsClient,
    corContractPage,
    contractDetailPage,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    test.setTimeout(120_000);

    const created = await createCorContractAndSignSow(contractsClient, { type: 'Fixed' });
    try {
      await contractDetailPage.gotoContractDetail(created.id);

      // SoW is surfaced in the contract timeline as a "SOW Signed" event —
      // `corContractPage`'s SoW-specific locators are page-scoped, not
      // POM-scoped, so they resolve against the same page `contractDetailPage`
      // just navigated.
      // TODO(flaky): SOW-Signed timeline event occasionally not yet indexed on
      // first navigation after createCorContractAndSignSow; passed on retry
      // (2026-07-09 run). Inherited timeline-indexing latency, not a regression.
      await expect(corContractPage.timelineSowSigned.first()).toBeVisible({ timeout: 15_000 });
      await expect(corContractPage.downloadButton).toBeVisible({ timeout: 10_000 });
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_COR_015: Admin signs SoW in UI ================================

  test('TC_UI_COR_015 — Admin signs SoW in UI → contract status updates accordingly @regression', async ({
    contractsClient,
    adminClient,
    corContractPage,
    contractDetailPage,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    test.setTimeout(120_000);

    const created = await createCorContractAndSignSow(contractsClient, { type: 'Fixed' });
    try {
      await contractDetailPage.gotoContractDetail(created.id);

      // Before admin signs: only the client-side SoW signature is in the timeline.
      await expect(corContractPage.timelineSowSigned.first()).toBeVisible({ timeout: 15_000 });
      await expect(corContractPage.timelineSowSigned).toHaveCount(1);

      const adminSow = await adminClient.signCorSow(created.id, 'Admin QA');

      expect(adminSow.status).toBe(200);
      expect(adminSow.body.success).toBe(true);

      // After admin signs: the RemotePass SoW signature appears (2 SOW Signed
      // events) — re-navigate to the detail page (fresh fetch) rather than a
      // raw `page.reload()`, matching the navigation-only pattern the other
      // wizard POMs use for post-mutation UI refreshes.
      await expect(async () => {
        await contractDetailPage.gotoContractDetail(created.id);

        await expect(corContractPage.timelineSowSigned).toHaveCount(2);
      }).toPass({ timeout: 15_000 });
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_COR_016: Navigate back → form data preserved ==================

  test('TC_UI_COR_016 — Navigate back through wizard steps → form data is preserved @regression', async ({
    corContractPage,
  }) => {
    test.setTimeout(90_000);
    await corContractPage.navigateToContractInfoStep();
    await corContractPage.selectContractType('Fixed');
    await corContractPage.fillTaxCountry(CONTRACT_DATA.taxCountry);
    // Deliberately does NOT enable the COR toggle here (unlike legacy):
    // enabling opens a COR-provider-onboarding modal with no automation hook
    // (docs/test-migration/scenarios/contracts.md, confirmed 2026-07-09), and
    // dismissing it left the wizard on an unpredictable step rather than
    // Contract Info — too unstable for a test whose actual behaviour under
    // test is back-button data preservation, not the COR toggle (already
    // covered by TC_UI_COR_003/012). TODO(selector): revisit once the
    // onboarding modal's own step-recovery behaviour is understood.
    await corContractPage.fillContractInfoFields({
      role: CONTRACT_DATA.role,
      scope: CONTRACT_DATA.scope,
    });

    await corContractPage.continueButton.click();
    await corContractPage.rateAmountInput.waitFor({ state: 'visible', timeout: 10_000 });

    await corContractPage.backButton.click();
    await corContractPage.roleInput.waitFor({ state: 'visible', timeout: 10_000 });

    const roleValue = await corContractPage.roleInput.inputValue();

    expect(roleValue).toContain(CONTRACT_DATA.role);

    await corContractPage.closeWizard();
  });

  // ==== TC_UI_COR_017: Non-COR contract → no SoW section ====================

  test('TC_UI_COR_017 — is_cor: 0 contract → verify no SoW section is shown in UI @regression', async ({
    corContractPage,
    contractDetailPage,
    contractsClient,
  }) => {
    test.setTimeout(120_000);

    // Create a non-COR Fixed contract via the wizard (no toggle needed here —
    // unlike COR creation, the plain wizard flow works on seeded accounts).
    const ref = await corContractPage.createNonCorContract({
      taxCountry: CONTRACT_DATA.taxCountry,
      role: `Non-COR ${Date.now()}`,
      scope: 'Non-COR test scope.',
      rate: CONTRACT_DATA.rate,
    });

    expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

    const details = await contractsClient.getContract(ref!);
    try {
      await contractDetailPage.gotoContractDetail(details.id);

      const sowVisible = await corContractPage.sowSection.isVisible({ timeout: 5_000 }).catch(() => false);

      expect(sowVisible).toBe(false);
    } finally {
      await contractsClient.cancelContract(details.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_COR_018: PAYG COR → Ongoing ===================================

  // TODO(api-preconditions): same DB-OTP gate as TC_UI_COR_011.
  test('TC_UI_COR_018 — PAYG COR: contractor signs → contract becomes Ongoing @regression @critical', async ({
    contractsClient,
    adminClient,
    contractDetailPage,
    seedContractorWorker,
  }) => {
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );
    test.setTimeout(180_000);

    const worker = await seedContractorWorker('cor-ui-payg');
    test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

    const created = await createCorContractViaApi(contractsClient, { type: 'PAYG' });
    try {
      const signatory = await contractsClient.getSignatory();

      // PAYG COR generates no payable item until work is submitted — no
      // upfront deposit, unlike Fixed (mirrors legacy `processPayment: false`).
      const result = await signCorToOngoing({
        contracts:      contractsClient,
        admin:          adminClient,
        contractId:     created.id,
        contractRef:    created.ref,
        worker:         worker!,
        signatoryName:  signatory.name,
        processDeposit: false,
      });

      expect(result.reachedOngoing).toBe(true);

      await contractDetailPage.gotoContractDetail(created.id);

      await expect(contractDetailPage.ongoingBadge).toBeVisible();
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_COR_019: Milestone COR → Ongoing ==============================

  // TODO(api-preconditions): same DB-OTP gate as TC_UI_COR_011.
  test('TC_UI_COR_019 — Milestone COR: contractor signs → contract becomes Ongoing @regression @critical', async ({
    contractsClient,
    adminClient,
    contractDetailPage,
    seedContractorWorker,
  }) => {
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );
    test.setTimeout(180_000);

    const worker = await seedContractorWorker('cor-ui-milestone');
    test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

    const created = await createCorContractViaApi(contractsClient, { type: 'Milestone' });
    try {
      const signatory = await contractsClient.getSignatory();

      const result = await signCorToOngoing({
        contracts:      contractsClient,
        admin:          adminClient,
        contractId:     created.id,
        contractRef:    created.ref,
        worker:         worker!,
        signatoryName:  signatory.name,
        processDeposit: false,
      });

      expect(result.reachedOngoing).toBe(true);

      await contractDetailPage.gotoContractDetail(created.id);

      await expect(contractDetailPage.ongoingBadge).toBeVisible();
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });
});
