import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Activity page (/activity) — the post-sign-up landing with the onboarding
 * checklist cards. Locators + actions only; assertions live in the spec.
 * Ported from legacy pages/modules/Onboarding/ActivityPage.ts.
 */
export class ActivityPage extends BasePage {
  readonly confirmCompanyDetailsLink = this.page.getByRole('link', { name: /confirm company details/i });

  /** Card container for "Confirm company details" — becomes a div (not a link) after submission. */
  readonly confirmCompanyDetailsCard = this.page.locator('#company_details').locator('..');

  // NOTE: the legacy "Complete company profile" onboarding card no longer exists
  // — the current activity checklist shows only confirm-details / identity /
  // first-contract (API registration already fills company info). The company
  // profile is reached directly via CompanyInfoTabPage.open().

  async open(): Promise<void> {
    logVerbose('ActivityPage.open');
    await this.goto(ROUTES.activity);
  }

  async clickConfirmCompanyDetails(): Promise<void> {
    logVerbose('Click "Confirm company details" card');
    await this.confirmCompanyDetailsLink.click();
    await this.page.waitForURL('**/registration-document');
  }

  async reload(): Promise<void> {
    logVerbose('Reload Activity page');
    await this.page.reload();
  }
}
