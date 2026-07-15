import { test, expect } from '@features/contracts/fixtures';
import { signContractorToOngoing } from '@features/contracts/seeding';
import { isDbEnvPresent } from '@core/db/db-config';

/**
 * Create Milestones Contract — UI wizard.
 *
 * Ported (intent, not implementation) from
 * tests/modules/contracts/ui/verify/create-milestones-contract.spec.ts
 * (TC_UI_MIL_001-007). Mirrors `create-fixed-contract.spec.ts`: the wizard
 * create action (behaviour under test) always runs through
 * `milestonesContractPage`; every pre/postcondition (signatory lookup,
 * invite/sign, Ongoing verification, cleanup) goes through the API
 * (`contractsClient` / `seeding.ts`), per ADR 2026-06-24 — never by driving
 * more UI than the screen under test.
 *
 * TC_UI_MIL_007's sign flow is behind `isDbEnvPresent()` + the
 * `seedContractorWorker` null sentinel (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) —
 * legacy handled the equivalent gap with a `beforeAll` try/catch that left
 * `contractorToken` empty; here the sentinel-based fixture self-skips instead.
 *
 * `MilestonesContractPage.closeWizard`/`closeWizardButton` did not exist —
 * added (same multi-selector fallback pattern as `FixedContractPage`) so the
 * validation/interaction tests below can tidy up without leaving an unsaved
 * wizard draft behind.
 */

const CONTRACT_DATA = {
  taxCountry: 'United Arab Emirates',
  role: 'QA Automation Engineer',
  scope: 'Deliver test automation suite for milestone-based contract creation.',
  noticePeriodDays: 30,
};

const MILESTONES_MULTIPLE = [
  { name: 'Discovery', amount: 300 },
  { name: 'Development', amount: 1200 },
];

test.describe('Create Milestones Contract - Wizard @ui @regression', () => {

  // ==== TC_UI_MIL_001: Fill and submit form =================================

  test('TC_UI_MIL_001 — Should fill and submit Milestones contract form successfully @smoke @critical', async ({
    milestonesContractPage,
    contractsClient,
  }) => {
    test.setTimeout(60_000);

    const ref = await milestonesContractPage.createMilestonesContract({
      ...CONTRACT_DATA,
      milestones: [{ name: 'Phase 1', amount: 500 }],
    });

    expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

    const details = await contractsClient.getContract(ref!);
    try {
      expect(details.id).toBeTruthy();
    } finally {
      await contractsClient.cancelContract(details.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_MIL_002: Add multiple milestones ================================

  test('TC_UI_MIL_002 — Should add multiple milestones via UI @smoke', async ({ milestonesContractPage }) => {
    await milestonesContractPage.navigateToPaymentStep(CONTRACT_DATA);

    for (let i = 0; i < MILESTONES_MULTIPLE.length; i++) {
      await milestonesContractPage.addMilestone(MILESTONES_MULTIPLE[i].name, MILESTONES_MULTIPLE[i].amount, i);
    }

    const count = await milestonesContractPage.getMilestoneCount();

    expect(count).toBe(MILESTONES_MULTIPLE.length);

    await milestonesContractPage.closeWizard();
  });

  // ==== TC_UI_MIL_003: Milestone list renders correctly =======================

  test('TC_UI_MIL_003 — Should verify milestone list renders correctly @smoke', async ({ milestonesContractPage }) => {
    await milestonesContractPage.navigateToPaymentStep(CONTRACT_DATA);

    for (let i = 0; i < MILESTONES_MULTIPLE.length; i++) {
      await milestonesContractPage.addMilestone(MILESTONES_MULTIPLE[i].name, MILESTONES_MULTIPLE[i].amount, i);
    }

    for (let i = 0; i < MILESTONES_MULTIPLE.length; i++) {
      const name = await milestonesContractPage.getMilestoneNameValue(i);
      const amount = await milestonesContractPage.getMilestoneAmountValue(i);

      expect(name).toBe(MILESTONES_MULTIPLE[i].name);
      expect(amount).toBe(String(MILESTONES_MULTIPLE[i].amount));
    }

    for (let i = 0; i < MILESTONES_MULTIPLE.length; i++) {
      await expect(milestonesContractPage.milestoneDeleteButton(i)).toBeVisible();
    }

    await milestonesContractPage.closeWizard();
  });

  // ==== TC_UI_MIL_004: Edit milestone title and amount ========================

  test('TC_UI_MIL_004 — Should edit a milestone title and amount @regression', async ({ milestonesContractPage }) => {
    await milestonesContractPage.navigateToPaymentStep(CONTRACT_DATA);

    await milestonesContractPage.addMilestone('Initial Name', 100, 0);
    await milestonesContractPage.editMilestone(0, 'Updated Milestone', 750);

    const name = await milestonesContractPage.getMilestoneNameValue(0);
    const amount = await milestonesContractPage.getMilestoneAmountValue(0);

    expect(name).toBe('Updated Milestone');
    expect(amount).toBe('750');

    await milestonesContractPage.closeWizard();
  });

  // ==== TC_UI_MIL_005: Delete a milestone =====================================

  test('TC_UI_MIL_005 — Should delete a milestone @regression', async ({ milestonesContractPage }) => {
    await milestonesContractPage.navigateToPaymentStep(CONTRACT_DATA);

    await milestonesContractPage.addMilestone('Keep This', 500, 0);
    await milestonesContractPage.addMilestone('Delete This', 200, 1);

    expect(await milestonesContractPage.getMilestoneCount()).toBe(2);

    await milestonesContractPage.deleteMilestone(1);

    expect(await milestonesContractPage.getMilestoneCount()).toBe(1);

    const remainingName = await milestonesContractPage.getMilestoneNameValue(0);

    expect(remainingName).toBe('Keep This');

    await milestonesContractPage.closeWizard();
  });

  // ==== TC_UI_MIL_006: Validation on empty milestone fields ==================

  test('TC_UI_MIL_006 — Should show validation error on empty milestone fields @regression', async ({
    milestonesContractPage,
  }) => {
    await milestonesContractPage.navigateToPaymentStep(CONTRACT_DATA);

    // Add milestone but leave name and amount empty (amount defaults to 0)
    await milestonesContractPage.addMilestoneButton.click();
    await milestonesContractPage.milestoneNameInput(0).waitFor({ state: 'visible', timeout: 5000 });

    // Trigger validation — use continueButton directly since this test stays on the payment step
    await milestonesContractPage.continueButton.click();

    await expect(milestonesContractPage.milestoneNameError).toBeVisible();
    await expect(milestonesContractPage.milestoneAmountError).toBeVisible();

    await milestonesContractPage.closeWizard();
  });

  // ==== TC_UI_MIL_007: Contractor signs → Ongoing ============================

  // TODO(api-preconditions): depends on the gated DB-OTP worker-registration
  // layer (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) — retire the
  // two skip guards below the moment a worker-side OTP bypass ships.
  test('TC_UI_MIL_007 — Should become Ongoing after contractor signs @smoke @critical', async ({
    milestonesContractPage,
    contractDetailPage,
    contractsClient,
    seedContractorWorker,
  }) => {
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );
    test.setTimeout(120_000);

    const worker = await seedContractorWorker('milestones-ui');
    test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

    const ref = await milestonesContractPage.createMilestonesContract({
      ...CONTRACT_DATA,
      milestones: [{ name: 'Delivery', amount: 1000 }],
    });

    expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

    const created = await contractsClient.getContract(ref!);
    try {
      const signatory = await contractsClient.getSignatory();

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
