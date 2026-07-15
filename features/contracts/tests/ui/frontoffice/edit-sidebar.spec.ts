import { test, expect } from '@features/contracts/fixtures';
import { BULK_IMPORT_CSV_CLEAN, BULK_IMPORT_CSV_WITH_ERRORS } from '@features/contracts/constants';

test.describe('Bulk Import - Edit Sidebar @ui @regression', () => {

  test('Should open, edit, cancel, and delete via sidebar @smoke', async ({
    bulkImportPage,
    bulkImportReview,
    bulkImportSidebar,
  }) => {
    test.fixme(true, 'QA-443: frontoffice UI element-interaction failure, see ticket for symptom — QA-453');
    await bulkImportPage.open();
    await bulkImportPage.completeTypeAndUpload(BULK_IMPORT_CSV_CLEAN, 'Fixed');
    await bulkImportReview.waitForReview();

    // Open sidebar and verify pre-filled values
    await bulkImportReview.clickEditForRow('Alice Johnson');

    await expect(bulkImportSidebar.sidebarLocator).toBeVisible();
    await expect(bulkImportSidebar.fullNameInput).toHaveValue('Alice Johnson');
    await expect(bulkImportSidebar.emailInput).toHaveValue('baha+alice@remotepass.com');
    await expect(bulkImportSidebar.jobTitleInput).toHaveValue('Software Engineer');
    await expect(bulkImportSidebar.corToggleLocator).toBeChecked();

    // Edit job title then cancel — should not persist
    await bulkImportSidebar.fillJobTitle('Changed Title');
    await bulkImportSidebar.clickCancel();
    await bulkImportReview.clickEditForRow('Alice Johnson');

    await expect(bulkImportSidebar.jobTitleInput).toHaveValue('Software Engineer');

    await bulkImportSidebar.clickCancel();

    // Delete contractor — total decreases
    await expect(bulkImportReview.contractsTotalCount(17)).toBeVisible();

    await bulkImportReview.clickEditForRow('Alice Johnson');
    await bulkImportSidebar.clickDelete();

    await expect(bulkImportReview.contractsTotalCount(16)).toBeVisible();
  });

  test('Should detect errors and fix via sidebar', async ({
    bulkImportPage,
    bulkImportReview,
    bulkImportSidebar,
  }) => {
    test.fixme(true, 'QA-443: frontoffice UI element-interaction failure, see ticket for symptom — QA-453');
    await bulkImportPage.open();
    await bulkImportPage.completeTypeAndUpload(BULK_IMPORT_CSV_WITH_ERRORS, 'Fixed');
    await bulkImportReview.waitForReview();

    // TODO(flaky): inherited data/validation drift — the with-errors CSV no longer
    // triggers a row error on the current sandbox; filterByErrors() returns all 17
    // rows (errorsCount(1) absent, tableRows expected 1 received 17). Port is verbatim;
    // re-author the CSV or the assertion in the post-migration cleanup phase.
    // Verify errors detected
    await expect(bulkImportReview.errorsCount(1)).toBeVisible();

    await bulkImportReview.filterByErrors();

    await expect(bulkImportReview.tableRows).toHaveCount(1);

    // Fix signatory error via sidebar
    await bulkImportReview.clickEditForRow('Katarzyna Nowak');
    await bulkImportSidebar.selectSignatory('baha+admin2@remotepass.com');
    await bulkImportSidebar.clickSave();

    // Verify error resolved
    await bulkImportReview.filterByAll();

    await expect(bulkImportReview.getTableRowByText('Katarzyna Nowak')).toContainText('Ready');
    await expect(bulkImportReview.errorsCount(0)).toBeVisible();
  });
});
