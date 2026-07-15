import { test, expect } from '@features/contracts/fixtures';
import { BULK_IMPORT_CSV_CLEAN } from '@features/contracts/constants';

test.describe('Bulk Import - Review Table @ui @regression', () => {

  test('Should display review table with correct data, filters, and search @smoke', async ({
    bulkImportPage,
    bulkImportReview,
  }) => {
    await bulkImportPage.open();
    await bulkImportPage.completeTypeAndUpload(BULK_IMPORT_CSV_CLEAN, 'Fixed');

    // Verify review page content and counts
    await bulkImportReview.waitForReview();
    await expect(bulkImportReview.reviewHeading).toBeVisible();
    await expect(bulkImportReview.corInfoAlert).toBeVisible();
    await expect(bulkImportReview.contractsTotalCount(17)).toBeVisible();
    await expect(bulkImportReview.corCount(9)).toBeVisible();
    await expect(bulkImportReview.tableRows).toHaveCount(17);

    // Verify CoR checkboxes match CSV data
    await expect(bulkImportReview.getRowCorCheckbox('Alice Johnson')).toBeChecked();
    await expect(bulkImportReview.getRowCorCheckbox('Bob Williams')).not.toBeChecked();

    // Filter to errors then back to All
    await bulkImportReview.filterByErrors();
    await bulkImportReview.filterByAll();

    await expect(bulkImportReview.tableRows).toHaveCount(17);

    // Search by contractor name
    await bulkImportReview.searchContractor('Alice Johnson');

    await expect(bulkImportReview.tableRows).toHaveCount(1);
    await expect(bulkImportReview.getTableRowByText('Alice Johnson')).toBeVisible();
  });

  test('Should toggle CoR in table and sidebar with count updates', async ({
    bulkImportPage,
    bulkImportReview,
    bulkImportSidebar,
  }) => {
    test.fixme(true, 'QA-443: frontoffice UI element-interaction failure, see ticket for symptom — QA-453');
    await bulkImportPage.open();
    await bulkImportPage.completeTypeAndUpload(BULK_IMPORT_CSV_CLEAN, 'Fixed');
    await bulkImportReview.waitForReview();

    // TODO(flaky): the CoR table re-renders after a toggle, detaching the row
    // (scrollIntoViewIfNeeded: "Element is not attached to the DOM" at
    // BulkImportReviewPage.toggleCorForRow). Inherited flow; do not heal mid-migration.
    // Toggle CoR via table checkbox
    await bulkImportReview.toggleCorForRow('Alice Johnson', false);

    await expect(bulkImportReview.corCount(8)).toBeVisible();

    await bulkImportReview.toggleCorForRow('Alice Johnson', true);

    await expect(bulkImportReview.corCount(9)).toBeVisible();

    // Toggle CoR via edit sidebar
    await bulkImportReview.clickEditForRow('Alice Johnson');
    await bulkImportSidebar.toggleCor(false);
    await bulkImportSidebar.clickSave();

    await expect(bulkImportReview.getRowCorCheckbox('Alice Johnson')).not.toBeChecked();
    await expect(bulkImportReview.corCount(8)).toBeVisible();
  });
});
