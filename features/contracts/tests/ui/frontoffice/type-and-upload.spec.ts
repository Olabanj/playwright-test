import fs from 'fs';
import { test, expect } from '@features/contracts/fixtures';
import { BULK_IMPORT_CSV_CLEAN } from '@features/contracts/constants';

test.describe('Bulk Import - Type Selection & Upload @ui @regression', () => {

  test('Should complete type selection and CSV upload flow @smoke', async ({
    bulkImportClientPage,
    bulkImportPage,
    bulkImportReview,
  }) => {
    await bulkImportPage.open();

    // Type Selection page is active with worker type options visible
    await expect(bulkImportClientPage).toHaveURL(/contract\/bulk-creation/);
    await expect(bulkImportPage.typeHeading).toBeVisible();
    await expect(bulkImportPage.contractorsRadio).toBeVisible();
    await expect(bulkImportPage.employeesRadio).toBeVisible();

    // Continue without any selection shows a validation error and stays on type page
    await bulkImportPage.clickContinue();

    await expect(bulkImportPage.validationError('Worker type must be one of the following values: Contractors, Employees')).toBeVisible();
    await expect(bulkImportClientPage).toHaveURL(/contract\/bulk-creation/);
    await expect(bulkImportPage.typeHeading).toBeVisible();

    // Worker type selected but no contract type shows a second validation error
    await bulkImportPage.selectWorkerType('Contractors');
    await bulkImportPage.clickContinue();

    await expect(bulkImportPage.validationError('Contract type must be one of the following values: Fixed, Milestones, Pay as you go')).toBeVisible();
    await expect(bulkImportClientPage).toHaveURL(/contract\/bulk-creation/);
    await expect(bulkImportPage.typeHeading).toBeVisible();

    // Both selections complete — proceeds to the Upload step
    await bulkImportPage.selectContractType('Fixed');
    await bulkImportPage.clickContinue();

    await expect(bulkImportClientPage).toHaveURL(/contract\/bulk-creation\/upload/);

    // Upload CSV and proceed to Review
    await bulkImportPage.uploadCSV(BULK_IMPORT_CSV_CLEAN);
    await bulkImportPage.waitForUploadSuccess();
    await bulkImportPage.clickContinue();

    await bulkImportReview.waitForReview();

    await expect(bulkImportReview.reviewHeading).toBeVisible();
  });

  test('Should download CSV templates with correct headers for each contract type @smoke', async ({
    bulkImportClientPage,
    bulkImportPage,
  }) => {
    test.fixme(true, 'QA-443: frontoffice UI element-interaction failure, see ticket for symptom — QA-453');
    const expectedHeaders: Record<string, string[]> = {
      Fixed: [
        'Contractor Tax Country', 'Role', 'Scope Of Work', 'Start Date', 'End Date',
        'Currency', 'Payment Amount', 'Frequency Of Payments',
        'When Do You Want To Process Payments', 'Date For The First Payment',
        'Notice Period (Days)', 'Contractor Label', 'Tag', 'Contractor Name',
        'Contractor Email', 'Signatory Email', 'CoR',
      ],
      PAYG: [
        'Contractor Tax Country', 'Role', 'Scope Of Work', 'Start Date', 'End Date',
        'Currency', 'Payment Amount', 'Rate', 'Frequency Of Payments',
        'When Do You Want To Process Payments', 'Date For The First Payment',
        'Notice Period (Days)', 'Contractor Label',
        'Tag', 'Contractor Name', 'Contractor Email', 'Signatory Email', 'CoR',
      ],
      Milestone: [
        'Contractor Tax Country', 'Role', 'Scope Of Work', 'Currency',
        'Notice Period (Days)', 'Contractor Label', 'Tag', 'Contractor Name',
        'Contractor Email', 'Signatory Email', 'CoR',
      ],
    };

    for (const contractType of ['Fixed', 'PAYG', 'Milestone'] as const) {
      await bulkImportPage.open();
      await bulkImportPage.selectWorkerType('Contractors');
      await bulkImportPage.selectContractType(contractType);
      await bulkImportPage.clickContinue();

      await expect(bulkImportClientPage).toHaveURL(/contract\/bulk-creation\/upload/);

      // Download template and assert headers
      const downloadPromise = bulkImportClientPage.waitForEvent('download');
      await bulkImportPage.downloadTemplateButton.click();
      const download = await downloadPromise;

      const filePath = await download.path();
      expect(filePath, `${contractType} template should download successfully`).toBeTruthy();

      const content = fs.readFileSync(filePath!, 'utf-8').replace(/^﻿/, '');
      const headerLine = content.split('\n')[0];
      const headers = headerLine.split(',').map((h) => h.replace(/"/g, '').trim());

      expect(headers, `${contractType} template headers`).toEqual(expectedHeaders[contractType]);
    }
  });
});
