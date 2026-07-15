import { BasePage } from '@core/ui/BasePage';
import { logVerbose } from '@utils/helpers/logger';
import { REGISTRATION_DOC_PATH } from '@features/onboarding/constants';
import type { CompanyRegistrationDocData } from '@features/onboarding/types';

/**
 * Confirm Company Details page (/registration-document) — company links,
 * authorized-signatory, and registration-document upload. Locators + actions
 * only; assertions live in the spec. Ported from legacy
 * pages/modules/Onboarding/ConfirmCompanyDetailsPage.ts.
 */
export class ConfirmCompanyDetailsPage extends BasePage {
  readonly pageHeading             = this.page.getByRole('heading', { name: 'Confirm your company details' });
  readonly companyLinkedinInput    = this.page.locator('#linkedin_profile_url');
  readonly companyWebsiteInput     = this.page.locator('#website_url');
  readonly personalLinkedinInput   = this.page.locator('#personal_linkedin_profile_url');
  readonly taxNumberInput          = this.page.locator('#taxNumber');
  readonly signatoryYesRadio       = this.page.locator('#signatoryYes');
  readonly signatoryNameInput      = this.page.locator('#signatoryName');
  readonly signatoryCountryDropdown = this.page.locator('#signatoryCountryId').locator('..');
  readonly registrationDocumentInput = this.page.locator('#registrationDocument');
  readonly submitButton            = this.page.getByRole('button', { name: 'Submit' });

  async enterCompanyLinkedin(url: string): Promise<void> {
    logVerbose(`Enter company LinkedIn: ${url}`);
    await this.companyLinkedinInput.fill(url);
  }

  async enterCompanyWebsite(url: string): Promise<void> {
    logVerbose(`Enter company website: ${url}`);
    await this.companyWebsiteInput.fill(url);
  }

  async enterPersonalLinkedin(url: string): Promise<void> {
    logVerbose(`Enter personal LinkedIn: ${url}`);
    await this.personalLinkedinInput.fill(url);
  }

  async enterTaxNumber(value: string): Promise<void> {
    logVerbose(`Enter tax number: ${value}`);
    await this.taxNumberInput.fill(value);
  }

  async selectAuthorizedSignatoryYes(): Promise<void> {
    logVerbose('Select "Yes" for authorized signatory');
    await this.signatoryYesRadio.click();
    await this.signatoryNameInput.waitFor({ state: 'visible' });
  }

  async selectSignatoryCountry(country: string): Promise<void> {
    logVerbose(`Select signatory country: ${country}`);
    await this.signatoryCountryDropdown.click();
    await this.page.getByRole('option', { name: country }).click();
  }

  async uploadRegistrationDocument(filePath: string = REGISTRATION_DOC_PATH): Promise<void> {
    logVerbose(`Upload registration document: ${filePath}`);
    await this.registrationDocumentInput.setInputFiles(filePath);
  }

  /** Submit and wait for the redirect back to /activity. */
  async submit(): Promise<void> {
    logVerbose('Submit company details');
    await this.submitButton.click();
    await this.page.waitForURL('**/activity');
  }

  /** Fill every required field with an authorized ("Yes") signatory. */
  async fillRequiredFieldsWithYesSignatory(data: CompanyRegistrationDocData): Promise<void> {
    logVerbose('Fill required confirm-company-details fields (Yes signatory)');
    await this.enterCompanyLinkedin(data.companyLinkedin);
    await this.enterCompanyWebsite(data.companyWebsite);
    await this.enterPersonalLinkedin(data.personalLinkedin);
    if (data.taxNumber) {
      await this.enterTaxNumber(data.taxNumber);
    }
    await this.selectAuthorizedSignatoryYes();
    await this.selectSignatoryCountry(data.signatoryCountry);
    await this.uploadRegistrationDocument();
  }
}
