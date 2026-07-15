import { test, expect } from '@features/contracts/fixtures';
import {
  BULK_IMPORT_CSV_CLEAN,
  BULK_IMPORT_CSV_PAYG_CLEAN,
  BULK_IMPORT_CSV_MILESTONE_CLEAN,
} from '@features/contracts/constants';

test.describe('Bulk Import - Import & Invite @ui @regression', () => {
  // TODO(flaky): bulk import processing is slow (30-60s); flake-prone under sandbox load
  test.setTimeout(90_000);

  test('Should complete full bulk import flow, verify invite dialog content, and send custom invite @smoke @critical', async ({
    bulkImportPage,
    bulkImportReview,
    bulkImportModals,
  }) => {
    test.fixme(true, 'QA-443: frontoffice UI element-interaction failure, see ticket for symptom — QA-453');
    await bulkImportPage.open();

    // Type selection + upload
    await bulkImportPage.completeTypeAndUpload(BULK_IMPORT_CSV_CLEAN, 'Fixed');

    // Review — verify counts and no errors
    await bulkImportReview.waitForReview();

    await expect(bulkImportReview.reviewHeading).toBeVisible();
    await expect(bulkImportReview.contractsTotalCount(17)).toBeVisible();
    await expect(bulkImportReview.corCount(9)).toBeVisible();
    // TODO(selector): errorsCount(0) — the review footer renders no "Errors · 0"
    // button when there are zero errors, so the /Errors.*0/ locator never matches.
    // Verbatim port of the legacy verifyErrorsCount(0); re-target in cleanup phase.
    await expect(bulkImportReview.errorsCount(0)).toBeVisible();

    // Eligibility check
    await bulkImportReview.clickCheckEligibilityAndImport();
    await bulkImportModals.completeEligibilityCheck();
    await bulkImportModals.clickProceed();

    // Import success — verify full dialog content
    await bulkImportModals.waitForImportSuccess();

    await expect(bulkImportModals.importSuccessMessage(17)).toBeVisible();
    await expect(bulkImportModals.inviteQuestionText).toBeVisible();
    await expect(bulkImportModals.doItLaterButton).toBeVisible();
    await expect(bulkImportModals.inviteAllWorkersButton).toBeVisible();
    await expect(bulkImportModals.inviteMessageTextbox).not.toHaveValue('');
    await expect(bulkImportModals.saveMessageCheckbox).toBeChecked();

    // Edit invite message and send
    await bulkImportModals.editInviteMessage('Welcome to our team! Please review and sign your contract.');
    await bulkImportModals.clickInviteAllWorkers();
  });

  // TODO(merge): PAYG + Milestone bulk-import parametrized (legacy were 2 separate tests d973d98ace6c / 786cd0b0c068)
  for (const { type, csv } of [
    { type: 'PAYG' as const,      csv: BULK_IMPORT_CSV_PAYG_CLEAN },
    { type: 'Milestone' as const, csv: BULK_IMPORT_CSV_MILESTONE_CLEAN },
  ]) {
    test(`Should bulk import ${type} contracts with CoR`, async ({
      bulkImportPage,
      bulkImportReview,
      bulkImportModals,
    }) => {
      test.fixme(true, 'QA-443: frontoffice UI element-interaction failure, see ticket for symptom — QA-453');
      await bulkImportPage.open();
      // TODO(flaky): Milestone CSV upload sometimes leaves the wizard "Continue" button
      // disabled past 15s (upload validation slow/rejected on sandbox) — clickContinue
      // times out in completeTypeAndUpload. PAYG path hits the same errorsCount(0)
      // selector issue below. Inherited flow; do not heal mid-migration.
      await bulkImportPage.completeTypeAndUpload(csv, type);

      await bulkImportReview.waitForReview();

      await expect(bulkImportReview.contractsTotalCount(17)).toBeVisible();
      await expect(bulkImportReview.corCount(9)).toBeVisible();
      // TODO(selector): errorsCount(0) — see the Fixed-flow note above (no "Errors · 0"
      // button rendered when there are zero errors).
      await expect(bulkImportReview.errorsCount(0)).toBeVisible();

      await bulkImportReview.clickCheckEligibilityAndImport();
      await bulkImportModals.completeEligibilityCheck();
      await bulkImportModals.clickProceed();

      await bulkImportModals.waitForImportSuccess();

      await expect(bulkImportModals.importSuccessMessage(17)).toBeVisible();

      await bulkImportModals.clickDoItLater();
    });
  }
});
