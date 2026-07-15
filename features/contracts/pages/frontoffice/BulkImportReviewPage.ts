import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { logVerbose } from '@utils/helpers/logger';

/**
 * BulkImportReviewPage covers the Review table on /contract/bulk-creation/review:
 * - Review heading, CoR info alert
 * - Search, filter tabs (All / Errors)
 * - Contractor table rows with CoR checkboxes
 * - Footer (Back, contracts total, CoR count, Check Eligibility & Import)
 *
 * Locators + actions only — assertions live in the spec.
 */
export class BulkImportReviewPage extends BasePage {
  // ==================== Locators ====================

  readonly reviewHeading      = this.page.getByRole('heading', { name: 'Review' });
  readonly corInfoAlert       = this.page.locator('[role="alert"]').filter({ hasText: 'Contractor of Record' });
  readonly searchInput        = this.page.locator('input[placeholder=" "]');
  readonly allFilterButton    = this.page.getByRole('button', { name: /^All/ });
  readonly errorsFilterButton = this.page.getByRole('button', { name: /^Errors/ });
  readonly tableRows          = this.page.locator('table tbody tr');
  readonly backButton         = this.page.getByRole('button', { name: 'Back' });

  /**
   * Footer text showing total contracts count.
   * Replaces `verifyContractsTotalCount(n)` — spec asserts `.toBeVisible()`.
   */
  readonly contractsTotalText = this.page.getByText(/\d+ Contracts Total/);

  /**
   * Footer text showing CoR contractor count.
   * Replaces `verifyCorCount(n)` — spec asserts `.toBeVisible()`.
   */
  readonly corCountText = this.page.getByText(/\d+ Contractors of Record/);

  readonly checkEligibilityButton = this.page.getByRole('button', { name: 'Check Eligibility & Import' });

  // ==================== Dynamic locators (replaces parameterised verify* methods) ====================

  /**
   * Footer label showing exactly `count` contracts total.
   * Replaces `verifyContractsTotalCount(count)` — spec: `await expect(pom.contractsTotalCount(17)).toBeVisible()`.
   */
  contractsTotalCount(count: number): Locator {
    return this.page.getByText(`${count} Contracts Total`);
  }

  /**
   * Footer label showing exactly `count` Contractors of Record.
   * Replaces `verifyCorCount(count)` — spec: `await expect(pom.corCount(9)).toBeVisible()`.
   */
  corCount(count: number): Locator {
    return this.page.getByText(`${count} Contractors of Record`);
  }

  /**
   * Errors filter button, with count visible.
   * Replaces `verifyErrorsCount(count)` — spec: `await expect(pom.errorsCount(1)).toBeVisible()`.
   */
  errorsCount(count: number): Locator {
    return this.page.getByRole('button', { name: new RegExp(`Errors.*${count}`) });
  }

  /**
   * Table row identified by contractor name.
   * Exposed so specs can assert `.toBeVisible()` or count rows directly.
   */
  getTableRowByText(contractorName: string): Locator {
    return this.tableRows.filter({ hasText: contractorName });
  }

  /**
   * CoR checkbox within a contractor's row.
   * Replaces `verifyRowCorChecked(name, checked)` — spec asserts `.toBeChecked()` / `.not.toBeChecked()`.
   */
  getRowCorCheckbox(contractorName: string): Locator {
    return this.getTableRowByText(contractorName).getByRole('checkbox');
  }

  // ==================== Actions: CoR Onboarding Dismissal ====================

  /**
   * Dismiss the CoR onboarding popup if present.
   * Conditional UI cleanup — not an assertion.
   */
  async dismissCorOnboardingIfPresent(): Promise<void> {
    try {
      logVerbose('Checking for CoR onboarding popup');
      const gotItButton = this.page.getByRole('button', { name: 'Got It' });
      const isVisible = await gotItButton.isVisible();
      if (isVisible) {
        logVerbose('Dismissing CoR onboarding popup');
        await gotItButton.click();
        // TODO(flaky): legacy settle delay — dismiss animates out; replace with
        // `gotItButton.waitFor({state:'hidden'})` once animation duration is confirmed.
        await gotItButton.waitFor({ state: 'hidden' });
      } else {
        logVerbose('No CoR onboarding popup found');
      }
    } catch {
      logVerbose('No CoR onboarding popup to dismiss');
    }
  }

  // ==================== Actions ====================

  async searchContractor(name: string): Promise<void> {
    logVerbose(`Searching for contractor: ${name}`);
    await this.searchInput.fill(name);
    // TODO(flaky): legacy settle delay — search results filter client-side after input;
    // replace with a row-count assertion in the spec once stable.
    await this.searchInput.press('Tab');
  }

  async filterByAll(): Promise<void> {
    logVerbose('Filtering by All');
    await this.allFilterButton.click();
  }

  async filterByErrors(): Promise<void> {
    logVerbose('Filtering by Errors');
    await this.errorsFilterButton.click();
  }

  async clickEditForRow(contractorName: string): Promise<void> {
    logVerbose(`Opening edit sidebar for: ${contractorName}`);
    const row = this.getTableRowByText(contractorName);
    await row.getByRole('button').last().click();
    await this.page.getByRole('navigation').waitFor({ state: 'visible' });
  }

  async toggleCorForRow(contractorName: string, enable: boolean): Promise<void> {
    logVerbose(`${enable ? 'Enabling' : 'Disabling'} CoR for: ${contractorName}`);
    const checkbox = this.getRowCorCheckbox(contractorName);
    await checkbox.scrollIntoViewIfNeeded();
    if (enable) {
      await checkbox.check({ force: true });
    } else {
      await checkbox.uncheck({ force: true });
    }
  }

  async clickCheckEligibilityAndImport(): Promise<void> {
    logVerbose('Clicking Check Eligibility & Import');
    await this.checkEligibilityButton.click();
    await this.page.getByRole('dialog').waitFor({ state: 'visible' });
  }

  async clickBack(): Promise<void> {
    logVerbose('Clicking Back button');
    await this.backButton.click();
  }

  // ==================== Navigation wait (used by fixtures/convenience helpers) ====================

  /** Wait until review page URL is active and dismiss the CoR onboarding popup if present. */
  async waitForReview(): Promise<void> {
    logVerbose('Waiting for Review page');
    await this.page.waitForURL('**/contract/bulk-creation/review');
    await this.dismissCorOnboardingIfPresent();
  }
}
