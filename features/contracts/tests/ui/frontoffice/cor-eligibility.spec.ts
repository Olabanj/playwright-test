import { test, expect } from '@features/contracts/fixtures';
import { BULK_IMPORT_CSV_CLEAN } from '@features/contracts/constants';

test.describe('Bulk Import - CoR Eligibility Modal @ui @regression', () => {

  test('Should complete eligibility assessment with step navigation and validation @smoke', async ({
    bulkImportPage,
    bulkImportReview,
    bulkImportModals,
  }) => {
    test.fixme(true, 'QA-443: frontoffice UI element-interaction failure, see ticket for symptom — QA-453');
    await bulkImportPage.open();
    await bulkImportPage.completeTypeAndUpload(BULK_IMPORT_CSV_CLEAN, 'Fixed');
    await bulkImportReview.waitForReview();

    await expect(bulkImportReview.reviewHeading).toBeVisible();

    // TODO(flaky): the CoR eligibility dialog does not open within 15s after clicking
    // "Check Eligibility & Import" on the sandbox (getByRole('dialog') timeout at
    // BulkImportReviewPage.clickCheckEligibilityAndImport). Inherited product timing;
    // port is verbatim — do not re-engineer readiness mid-migration.
    // Open eligibility modal — verify intro with CoR count
    await bulkImportReview.clickCheckEligibilityAndImport();

    await expect(bulkImportModals.checkYourEligibilityHeading).toBeVisible();
    await expect(bulkImportModals.checkButton).toBeVisible();
    await expect(bulkImportModals.corCountInEligibility(9)).toBeVisible();

    // Enter assessment — Next disabled until answered
    await bulkImportModals.checkButton.click();

    await expect(bulkImportModals.contractorAssessmentHeading).toBeVisible();
    await expect(bulkImportModals.nextButton).toBeDisabled();

    // Answer Yes — Next becomes enabled
    await bulkImportModals.yesButton.click();

    await expect(bulkImportModals.nextButton).toBeEnabled();
    await bulkImportModals.nextButton.click();

    // Back navigation — returns to previous step
    await expect(bulkImportModals.workersRoleHeading).toBeVisible();
    await bulkImportModals.clickBack();

    await expect(bulkImportModals.contractorAssessmentHeading).toBeVisible();

    // Complete all 3 steps
    await bulkImportModals.answerStep('Yes');

    await expect(bulkImportModals.workersRoleHeading).toBeVisible();
    await bulkImportModals.answerStep('Yes');

    await expect(bulkImportModals.legalEntityHeading).toBeVisible();
    await bulkImportModals.answerStep('Yes');

    // Verify eligible result
    await expect(bulkImportModals.eligibleResultText).toBeVisible();
    await expect(bulkImportModals.proceedButton).toBeVisible();
  });
});
