import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { logVerbose } from '@utils/helpers/logger';

/**
 * BulkImportModals covers the two dialog modals in the bulk import flow:
 *
 * 1. CoR Eligibility Modal (multi-step assessment):
 *    - Intro: "Check your eligibility"
 *    - Step 1: Contractor Assessment
 *    - Step 2: Worker's Role
 *    - Step 3: Legal Entity
 *    - Result: "Your contracts are eligible!"
 *
 * 2. Import Success Modal:
 *    - Success heading with contract count
 *    - Invite message editor
 *    - Do It Later / Invite All Workers
 *
 * Locators + actions only — assertions live in the spec.
 */
export class BulkImportModals extends BasePage {
  // ==================== Locators: Dialog Container ====================

  readonly dialog            = this.page.getByRole('dialog');
  readonly dialogCloseButton = this.dialog.getByRole('button', { name: 'Close' });

  // ==================== Locators: CoR Eligibility ====================

  readonly checkButton   = this.dialog.getByRole('button', { name: 'Check' });
  readonly yesButton     = this.dialog.getByRole('button', { name: 'Yes' });
  readonly noButton      = this.dialog.getByRole('button', { name: 'No' });
  readonly backButton    = this.dialog.getByRole('button', { name: 'Back' });
  readonly nextButton    = this.dialog.getByRole('button', { name: 'Next' });
  readonly proceedButton = this.dialog.getByRole('button', { name: 'Proceed' });

  readonly checkYourEligibilityHeading   = this.dialog.getByRole('heading', { name: 'Check your eligibility' });
  readonly contractorAssessmentHeading   = this.dialog.getByRole('heading', { name: 'Contractor Assessment' });
  readonly workersRoleHeading            = this.dialog.getByRole('heading', { name: "Worker's role" });
  readonly legalEntityHeading            = this.dialog.getByRole('heading', { name: 'Legal Entity' });
  readonly eligibleResultText            = this.dialog.getByText(/contracts are eligible/i);

  // ==================== Locators: Import Success ====================

  readonly successHeading        = this.dialog.getByRole('heading', { name: /imported.*successfully/i });
  readonly inviteMessageTextbox  = this.dialog.getByRole('textbox', { name: /Message/i });
  readonly saveMessageCheckbox   = this.dialog.getByRole('checkbox');
  readonly doItLaterButton       = this.dialog.getByRole('button', { name: 'Do It Later' });
  readonly inviteAllWorkersButton = this.dialog.getByRole('button', { name: 'Invite All Workers' });

  // ==================== Dynamic locators (replaces parameterised verify* methods) ====================

  /**
   * CoR count text in the eligibility modal.
   * Replaces `verifyCorCountInEligibility(count)` —
   * spec: `await expect(pom.corCountInEligibility(9)).toBeVisible()`.
   */
  corCountInEligibility(count: number): Locator {
    return this.dialog.getByText(`${count} contracts will be imported as Contractor of Record`);
  }

  /**
   * Import success message for the given contract count.
   * Replaces `verifyImportSuccessVisible(contractCount)` —
   * spec: `await expect(pom.importSuccessMessage(17)).toBeVisible()`.
   */
  importSuccessMessage(contractCount: number): Locator {
    return this.dialog.getByText(`You imported ${contractCount} contracts successfully`);
  }

  /**
   * Invite question text in the success modal.
   * Replaces `verifyInviteQuestionVisible()` — spec asserts `.toBeVisible()`.
   */
  readonly inviteQuestionText = this.dialog.getByText(
    'Do you want to send invites to all the workers at their respective emails?',
  );

  // ==================== Actions: CoR Eligibility ====================

  /**
   * Complete the full eligibility check (Intro → 3 assessment steps).
   * Answers "Yes" to all questions. Does NOT click Proceed.
   */
  async completeEligibilityCheck(): Promise<void> {
    logVerbose('Completing full CoR eligibility check');

    // Intro
    await this.checkYourEligibilityHeading.waitFor({ state: 'visible' });
    await this.checkButton.click();

    // Step 1: Contractor Assessment
    await this.contractorAssessmentHeading.waitFor({ state: 'visible' });
    await this.answerStep('Yes');

    // Step 2: Worker's Role
    await this.workersRoleHeading.waitFor({ state: 'visible' });
    await this.answerStep('Yes');

    // Step 3: Legal Entity
    await this.legalEntityHeading.waitFor({ state: 'visible' });
    await this.answerStep('Yes');

    // Result
    await this.eligibleResultText.waitFor({ state: 'visible' });
    logVerbose('Eligibility check completed - contracts are eligible');
  }

  async answerStep(answer: 'Yes' | 'No'): Promise<void> {
    logVerbose(`Answering assessment step: ${answer}`);
    if (answer === 'Yes') {
      await this.yesButton.click();
    } else {
      await this.noButton.click();
    }
    await this.nextButton.click();
  }

  async clickProceed(): Promise<void> {
    logVerbose('Clicking Proceed on eligibility result');
    await this.proceedButton.click();
  }

  async clickBack(): Promise<void> {
    logVerbose('Clicking Back in eligibility modal');
    await this.backButton.click();
  }

  // ==================== Actions: Import Success ====================

  async waitForImportSuccess(timeout: number = 60_000): Promise<void> {
    logVerbose('Waiting for import to complete');
    await this.successHeading.waitFor({ state: 'visible', timeout });
    logVerbose('Import completed successfully');
  }

  async clickInviteAllWorkers(): Promise<void> {
    logVerbose('Clicking Invite All Workers');
    await this.inviteAllWorkersButton.click();
  }

  async clickDoItLater(): Promise<void> {
    logVerbose('Clicking Do It Later');
    await this.doItLaterButton.click();
  }

  async editInviteMessage(message: string): Promise<void> {
    logVerbose(`Editing invite message: ${message}`);
    await this.inviteMessageTextbox.fill(message);
  }
}
