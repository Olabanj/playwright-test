import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';
import type { CompanySettingsRequiredData } from '@features/onboarding/types';

/**
 * Company Info settings tab (/settings/info) — the required company fields a
 * client completes during onboarding via the "Complete company profile" card.
 * Locators + actions only; assertions live in the spec. Ported from legacy
 * pages/modules/CompanySettings/CompanyInfoTabPage.ts (required fields only).
 */
export class CompanyInfoTabPage extends BasePage {
  readonly companyLegalNameInput  = this.page.locator('[data-test-id="cntl-input-name"]');
  readonly companyTypeDropdown    = this.page.locator('[name="type_id"]').locator('..');
  readonly registrationNumberInput = this.page.locator('[data-test-id="cntl-input-registration_no"]');
  readonly numberOfEmployeesInput = this.page.locator('[data-test-id="cntl-input-nb_employees"]');
  readonly currencyDropdown       = this.page.locator('[name="currency_id"]').locator('..');
  readonly addressInput           = this.page.locator('[data-test-id="cntl-input-address"]');
  readonly countryDropdown        = this.page.locator('[name="country_id"]').locator('..');
  readonly cityInput              = this.page.locator('[data-test-id="cntl-input-city"]');
  readonly saveButton             = this.page.locator('button#submit-company-info-form');

  async open(): Promise<void> {
    logVerbose('CompanyInfoTabPage.open');
    await this.goto(ROUTES.companyInfo);
  }

  async enterCompanyLegalName(name: string): Promise<void> {
    logVerbose(`Enter company legal name: ${name}`);
    await this.companyLegalNameInput.fill(name);
  }

  async selectCompanyType(type: string): Promise<void> {
    logVerbose(`Select company type: ${type}`);
    await this.companyTypeDropdown.click();
    await this.page.getByRole('option', { name: type }).click();
  }

  async enterRegistrationNumber(regNumber: string): Promise<void> {
    logVerbose(`Enter registration number: ${regNumber}`);
    await this.registrationNumberInput.fill(regNumber);
  }

  async enterNumberOfEmployees(count: string): Promise<void> {
    logVerbose(`Enter number of employees: ${count}`);
    await this.numberOfEmployeesInput.fill(count);
  }

  async selectCurrency(currency: string): Promise<void> {
    logVerbose(`Select currency: ${currency}`);
    await this.currencyDropdown.click();
    await this.page.getByRole('option', { name: currency }).click();
  }

  async enterAddress(address: string): Promise<void> {
    logVerbose(`Enter address: ${address}`);
    await this.addressInput.fill(address);
  }

  async selectCountry(country: string): Promise<void> {
    logVerbose(`Select country: ${country}`);
    await this.countryDropdown.click();
    await this.page.getByRole('option', { name: country }).click();
  }

  async enterCity(city: string): Promise<void> {
    logVerbose(`Enter city: ${city}`);
    await this.cityInput.fill(city);
  }

  async clickSave(): Promise<void> {
    logVerbose('Click Save');
    await this.saveButton.click();
  }

  async fillAllRequiredFields(data: CompanySettingsRequiredData): Promise<void> {
    logVerbose('Fill all required company-info fields');
    await this.enterCompanyLegalName(data.legalName);
    await this.selectCompanyType(data.companyType);
    await this.enterRegistrationNumber(data.registrationNumber);
    await this.enterNumberOfEmployees(data.numberOfEmployees);
    await this.selectCurrency(data.currency);
    await this.enterAddress(data.address);
    await this.selectCountry(data.country);
    await this.enterCity(data.city);
  }
}
