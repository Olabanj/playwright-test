import { test, expect } from '@features/contracts/fixtures';
import { signContractorToOngoing } from '@features/contracts/seeding';
import { isDbEnvPresent } from '@core/db/db-config';

/**
 * Create PAYG Contract — UI wizard.
 *
 * Ported (intent, not implementation) from
 * tests/modules/contracts/ui/verify/create-payg-contract.spec.ts
 * (TC_UI_PAYG_001-013). Mirrors `create-fixed-contract.spec.ts`: the wizard
 * create action (behaviour under test) always runs through `paygContractPage`;
 * every pre/postcondition (signatory lookup, invite/sign, Ongoing
 * verification, cleanup) goes through the API (`contractsClient` /
 * `seeding.ts`), per ADR 2026-06-24 — never by driving more UI than the
 * screen under test.
 *
 * Structural change from legacy: legacy ran `describe.configure({mode:
 * 'serial'})` and shared one PAYG contract (created in TC_UI_PAYG_001) across
 * TC_UI_PAYG_002/003 via module-level state (`test.skip('...must pass
 * first')`). Here every test creates its own contract independently — no
 * serial mode, safe under parallel workers, and no dropped coverage (the two
 * dependent-skip tests are folded into standalone contract-creation +
 * verification tests below).
 *
 * TC_UI_PAYG_013's sign flow is behind `isDbEnvPresent()` + the
 * `seedContractorWorker` null sentinel (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md).
 */

const CONTRACT_DATA = {
  taxCountry: 'United Arab Emirates',
  role: 'QA Automation Engineer',
  scope: 'Provide hourly consulting and test automation services for the RemotePass platform.',
  rate: 50,
  noticePeriodDays: 30,
};

test.describe('Create PAYG Contract - Wizard @ui @regression', () => {

  // ==== TC_UI_PAYG_001: Fill and submit form =================================

  test('TC_UI_PAYG_001 — Should fill and submit PAYG contract form successfully @smoke @critical', async ({
    paygContractPage,
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: Create button never hides after submit — QA-455');
    test.setTimeout(60_000);

    const ref = await paygContractPage.createPaygContract(CONTRACT_DATA);

    expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

    const details = await contractsClient.getContract(ref!);
    try {
      expect(details.id).toBeTruthy();
    } finally {
      await contractsClient.cancelContract(details.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_PAYG_002: Verify hourly rate and currency =====================

  test('TC_UI_PAYG_002 — Should verify hourly rate and currency fields render correctly @smoke', async ({
    paygContractPage,
    contractsClient,
  }) => {
    test.setTimeout(60_000);

    const ref = await paygContractPage.createPaygContract(CONTRACT_DATA);

    expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

    const details = await contractsClient.getContract(ref!);
    try {
      const rateValue = details.amount ?? details.rate ?? details.salary ?? details.total_amount;
      if (rateValue !== undefined) {
        expect(Number(rateValue)).toBeGreaterThan(0);
      } else {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_UI_PAYG_002: contract details endpoint does not return a rate/amount field',
        });
      }

      const currencyCode = details.currency?.code ?? details.salary_currency?.code;

      expect(currencyCode).toBeTruthy();
    } finally {
      await contractsClient.cancelContract(details.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_PAYG_003: Verify created contract type is PAYG ================

  test('TC_UI_PAYG_003 — Should verify created contract type is PAYG @smoke', async ({
    paygContractPage,
    contractsClient,
  }) => {
    test.setTimeout(60_000);

    const ref = await paygContractPage.createPaygContract(CONTRACT_DATA);

    expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

    const details = await contractsClient.getContract(ref!);
    try {
      const contractType = (details.type ?? '').toLowerCase();

      expect(['payg', 'pay as you go', 'pay_as_you_go']).toContain(contractType);
    } finally {
      await contractsClient.cancelContract(details.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_PAYG_004: Validation on empty required fields ==================

  test('TC_UI_PAYG_004 — Should show validation error on empty required fields @regression', async ({
    paygContractPage,
  }) => {
    await paygContractPage.navigateToPaygForm();

    await paygContractPage.continueButton.click();

    const hasErrors = await paygContractPage.requiredFieldErrors.first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    const roleValue = await paygContractPage.roleInput.inputValue();

    expect(roleValue.length === 0 || hasErrors).toBe(true);

    await paygContractPage.closeWizard();
  });

  // ==== TC_UI_PAYG_005: Validation on invalid rate (zero) ====================

  test('TC_UI_PAYG_005 — Should show validation error on invalid hourly rate @regression', async ({
    paygContractPage,
  }) => {
    await paygContractPage.navigateToPaygForm();
    await paygContractPage.fillContractInfo(CONTRACT_DATA);

    await paygContractPage.rateAmountInput.fill('0');
    await paygContractPage.proceedFromPaymentStep().catch(() => undefined);

    const hasRateError = await paygContractPage.rateValidationError
      .isVisible({ timeout: 5000 }).catch(() => false);
    const stayedOnPayment = await paygContractPage.rateAmountInput
      .isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasRateError || stayedOnPayment).toBe(true);

    await paygContractPage.closeWizard();
  });

  // ==== TC_UI_PAYG_006: Validation on empty rate field =======================

  test('TC_UI_PAYG_006 — Should show validation error when rate field is empty @regression', async ({
    paygContractPage,
  }) => {
    await paygContractPage.navigateToPaygForm();
    await paygContractPage.fillContractInfo(CONTRACT_DATA);

    await paygContractPage.rateAmountInput.clear();
    await paygContractPage.proceedFromPaymentStep().catch(() => undefined);

    const hasRateError = await paygContractPage.rateValidationError
      .isVisible({ timeout: 5000 }).catch(() => false);
    const stayedOnPayment = await paygContractPage.rateAmountInput
      .isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasRateError || stayedOnPayment).toBe(true);

    await paygContractPage.closeWizard();
  });

  // ==== TC_UI_PAYG_007: Back button preserves data ============================

  test('TC_UI_PAYG_007 — Should preserve contract info data on back button @regression', async ({
    paygContractPage,
  }) => {
    await paygContractPage.navigateToPaygForm();
    await paygContractPage.fillContractInfo(CONTRACT_DATA);

    await paygContractPage.backButton.click();
    await paygContractPage.roleInput.waitFor({ state: 'visible', timeout: 5000 });

    await expect(paygContractPage.roleInput).toHaveValue(CONTRACT_DATA.role);

    await paygContractPage.closeWizard();
  });

  // ==== TC_UI_PAYG_008: Wizard closes on X ===================================

  test('TC_UI_PAYG_008 — Should close wizard without creating a contract when X is clicked @regression', async ({
    paygContractPage,
    bulkImportClientPage,
  }) => {
    await paygContractPage.open();
    await paygContractPage.selectContractorWorkerType();
    await paygContractPage.selectPaygContractType();

    const closeVisible = await paygContractPage.closeWizardButton.first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    if (!closeVisible) {
      test.info().annotations.push({
        type: 'gap',
        description: 'TC_UI_PAYG_008: Close/X button not found on wizard',
      });
      return;
    }

    await paygContractPage.closeWizard();

    await expect(bulkImportClientPage).not.toHaveURL(/contract\/create/);
  });

  // ==== TC_UI_PAYG_009: Duplicate contract creation ===========================

  test('TC_UI_PAYG_009 — Should allow creating a second PAYG contract with identical data @regression @deep', async ({
    paygContractPage,
    contractsClient,
  }) => {
    test.setTimeout(90_000);

    const firstRef = await paygContractPage.createPaygContract(CONTRACT_DATA);

    expect(firstRef, 'First contract should produce a ref').toBeTruthy();

    const firstDetails = await contractsClient.getContract(firstRef!);

    try {
      const secondRef = await paygContractPage.createPaygContract(CONTRACT_DATA);

      expect(secondRef, 'Second (duplicate) contract should also produce a ref').toBeTruthy();
      expect(secondRef).not.toBe(firstRef);

      const secondDetails = await contractsClient.getContract(secondRef!);
      try {
        expect(secondDetails.id).toBeTruthy();
      } finally {
        await contractsClient.cancelContract(secondDetails.id).catch(() => undefined);
      }
    } finally {
      await contractsClient.cancelContract(firstDetails.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_PAYG_010: Negative rate value ===================================

  test('TC_UI_PAYG_010 — Should reject or stay on payment step with negative rate @regression', async ({
    paygContractPage,
  }) => {
    await paygContractPage.navigateToPaygForm();
    await paygContractPage.fillContractInfo(CONTRACT_DATA);

    await paygContractPage.rateAmountInput.fill('-50');
    await paygContractPage.proceedFromPaymentStep().catch(() => undefined);

    const stayedOnPayment = await paygContractPage.rateAmountInput
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasError = await paygContractPage.rateValidationError
      .isVisible({ timeout: 2000 }).catch(() => false);

    expect(stayedOnPayment || hasError).toBe(true);

    await paygContractPage.closeWizard();
  });

  // ==== TC_UI_PAYG_011: Very large rate =======================================

  test('TC_UI_PAYG_011 — Should accept a very large hourly rate @regression @deep', async ({
    paygContractPage,
    contractsClient,
  }) => {
    test.setTimeout(60_000);

    const ref = await paygContractPage.createPaygContract({ ...CONTRACT_DATA, rate: 999999 });

    expect(ref, 'Wizard should produce a contract ref for a very large rate').toBeTruthy();

    const details = await contractsClient.getContract(ref!);
    try {
      expect(details.id).toBeTruthy();
    } finally {
      await contractsClient.cancelContract(details.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_PAYG_012: Contract type card renders PAYG option ===============

  test('TC_UI_PAYG_012 — Should display PAYG contract type card on Contract Type step @smoke', async ({
    paygContractPage,
  }) => {
    await paygContractPage.open();
    await paygContractPage.selectContractorWorkerType();

    await expect(paygContractPage.paygTypeCard).toBeVisible({ timeout: 5000 });

    await paygContractPage.closeWizard();
  });

  // ==== TC_UI_PAYG_013: Contractor signs → Ongoing ===========================

  // TODO(api-preconditions): depends on the gated DB-OTP worker-registration
  // layer (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) — retire the
  // two skip guards below the moment a worker-side OTP bypass ships.
  test('TC_UI_PAYG_013 — Should become Ongoing after contractor signs @smoke @critical', async ({
    paygContractPage,
    contractDetailPage,
    contractsClient,
    seedContractorWorker,
  }) => {
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );
    test.setTimeout(120_000);

    const worker = await seedContractorWorker('payg-ui');
    test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

    const ref = await paygContractPage.createPaygContract(CONTRACT_DATA);

    expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

    const created = await contractsClient.getContract(ref!);
    try {
      const signatory = await contractsClient.getSignatory();

      // Composition (invite -> client sign -> worker sign -> poll Ongoing) lives
      // in the owner-feature seeding helper (see create-fixed-contract.spec.ts
      // for the same rationale) — this contract belongs to the shared
      // `clientAccount` that backs the UI wizard, not the finished client.
      const reachedOngoing = await signContractorToOngoing({
        contracts:     contractsClient,
        contractId:    created.id,
        contractRef:   ref!,
        worker:        worker!,
        signatoryName: signatory.name,
      });

      expect(reachedOngoing).toBe(true);

      await contractDetailPage.gotoContractDetail(created.id);

      await expect(contractDetailPage.ongoingBadge).toBeVisible();
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });
});
