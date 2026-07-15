import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * BulkImportPage covers the first two steps of the Bulk Contract Import wizard:
 * - Step 1: Type Selection (/contract/bulk-creation)
 * - Step 2: Upload (/contract/bulk-creation/upload)
 *
 * Locators + actions only — assertions live in the spec.
 */
export class BulkImportPage extends BasePage {
  // ==================== Locators: Stepper ====================

  readonly stepperType   = this.page.getByText('Type', { exact: true }).first();
  readonly stepperUpload = this.page.getByText('Upload', { exact: true }).first();
  readonly stepperReview = this.page.getByText('Review', { exact: true }).first();

  // ==================== Locators: Type Selection ====================

  readonly contractorsRadio = this.page.getByText('Contractors', { exact: true });
  readonly employeesRadio   = this.page.getByText('Employees', { exact: true });
  readonly continueButton   = this.page.getByRole('button', { name: 'Continue' });
  readonly closeButton      = this.page.getByRole('button', { name: 'Close' });

  // ==================== Locators: Contract Type ====================

  readonly fixedRadio     = this.page.getByText('Fixed', { exact: true });
  readonly paygRadio      = this.page.getByText(/PAYG|Pay as you go/i);
  readonly milestoneRadio = this.page.getByText(/Milestone/i);

  // ==================== Locators: Upload ====================

  readonly fileUploadInput        = this.page.locator('input[type="file"]');
  readonly downloadTemplateButton = this.page.getByRole('button', { name: /Download template/i });

  // ==================== Locators: Validation (exposed for spec assertions) ====================

  /** Type heading — spec asserts `.toBeVisible()`. */
  readonly typeHeading = this.page.getByRole('heading', { name: 'Type' });

  /**
   * Validation error message element.
   * Replaces `verifyValidationError(message)` — spec asserts `.toBeVisible()`.
   */
  validationError(message: string): Locator {
    return this.page.locator('small').filter({ hasText: message });
  }

  /** All validation error elements — spec asserts `.toHaveCount(0)` etc. */
  readonly validationErrors = this.page.locator('small.tw-text-systemRed-100');

  // ==================== Navigation ====================

  async open(): Promise<void> {
    logVerbose('Navigating to Bulk Import - Type Selection');
    await this.goto(ROUTES.bulkCreation);
  }

  // ==================== Actions: Type Selection ====================

  async selectWorkerType(type: 'Contractors' | 'Employees'): Promise<void> {
    logVerbose(`Selecting worker type: ${type}`);
    if (type === 'Contractors') {
      await this.contractorsRadio.click();
    } else {
      await this.employeesRadio.click();
    }
  }

  async selectContractType(type: 'Fixed' | 'PAYG' | 'Milestone'): Promise<void> {
    logVerbose(`Selecting contract type: ${type}`);
    if (type === 'Fixed') {
      await this.fixedRadio.click();
    } else if (type === 'PAYG') {
      await this.paygRadio.click();
    } else {
      await this.milestoneRadio.click();
    }
  }

  async clickContinue(): Promise<void> {
    logVerbose('Clicking Continue button');
    await this.continueButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickClose(): Promise<void> {
    logVerbose('Clicking Close button');
    await this.closeButton.click();
  }

  // ==================== Actions: Upload ====================

  async uploadCSV(filePath: string): Promise<void> {
    logVerbose(`Uploading CSV file: ${filePath}`);
    // Selecting the file triggers a multipart POST to contract/import/validate;
    // the server parses the CSV and returns the contract list. The Continue button
    // is enabled only on a successful response (setDisabledNext(false)). Start
    // listening BEFORE setInputFiles so we cannot miss the response.
    await Promise.all([
      this.page.waitForResponse(
        (resp) => resp.url().includes('/contract/import/validate') && resp.ok(),
      ),
      this.fileUploadInput.setInputFiles(filePath),
    ]);
  }

  async waitForUploadSuccess(): Promise<void> {
    logVerbose('Waiting for CSV upload validation to enable Continue');
    // Deterministic signal (ADR 2026-06-25-dmytro-wait002-enforce): the validate
    // response (awaited in uploadCSV) gates the Continue button via React state.
    // Guard against the rare state-update lag by waiting for the button to be enabled.
    await this.continueButton.and(this.page.locator(':enabled')).waitFor({ state: 'visible' });
  }

  // ==================== Convenience ====================

  /**
   * Complete type selection and upload in one call.
   * Selects Contractors + specified contract type, uploads CSV, and proceeds to review.
   */
  async completeTypeAndUpload(
    csvPath: string,
    contractType: 'Fixed' | 'PAYG' | 'Milestone' = 'Fixed',
  ): Promise<void> {
    logVerbose('Completing Type Selection and Upload steps');

    // Step 1: Type Selection
    await this.selectWorkerType('Contractors');
    await this.selectContractType(contractType);
    await this.clickContinue();

    // Step 2: Upload — wait for upload page URL then upload
    await this.page.waitForURL('**/contract/bulk-creation/upload');
    await this.uploadCSV(csvPath);
    await this.waitForUploadSuccess();
    await this.clickContinue();

    logVerbose('Type and Upload steps completed');
  }
}
