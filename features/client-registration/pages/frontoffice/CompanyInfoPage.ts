import { BasePage } from '@core/ui/BasePage';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Sign-up — Company Info step (Step 3) front-office page object.
 * Locators + actions only; assertions live in the spec.
 * Ported from legacy pages/modules/SignUp/SignUpPage-Step3-CompanyInfoPage.ts.
 */
export class CompanyInfoPage extends BasePage {
  readonly heading = this.page.getByRole('heading', { name: 'Company info' });
  readonly legalNameInput = this.page.locator('[data-test-id="cntl-input-name"]');
  // TODO(selector): the three dropdowns below use brittle parent-of-hidden-input
  // selectors ([name="…"].locator('..')) ported verbatim from legacy. Replace with
  // stable locators (getByLabel/getByRole) once verified against the live UI.
  readonly typeDropdown = this.page.locator('[name="type_id"]').locator('..');
  readonly registrationNumberInput = this.page.locator('[data-test-id="cntl-input-registration_no"]');
  readonly numberOfEmployeesInput = this.page.locator('[data-test-id="cntl-input-nb_employees"]');
  readonly currencyDropdown = this.page.locator('[name="currency_id"]').locator('..');
  readonly addressInput = this.page.locator('[data-test-id="cntl-input-address"]');
  readonly countryDropdown = this.page.locator('[name="country_id"]').locator('..');
  readonly cityInput = this.page.locator('[data-test-id="cntl-input-city"]');
  // Role-based, not the legacy '.border-top' container scope (that class no longer
  // wraps the button → the scoped locator matched nothing and timed out).
  readonly nextButton = this.page.getByRole('button', { name: 'Next' });
  readonly infoAlert = this.page.getByText('You cannot change these details after your account is verified.');

  async enterLegalName(name: string): Promise<void> {
    logVerbose(`CompanyInfoPage.enterLegalName name=${name}`);
    await this.legalNameInput.fill(name);
  }

  async selectType(type: string): Promise<void> {
    logVerbose(`CompanyInfoPage.selectType type=${type}`);
    await this.typeDropdown.click();
    await this.page.getByText(type, { exact: false }).click();
  }

  async enterRegistrationNumber(value: string): Promise<void> {
    logVerbose(`CompanyInfoPage.enterRegistrationNumber value=${value}`);
    await this.registrationNumberInput.fill(value);
  }

  async enterNumberOfEmployees(value: string): Promise<void> {
    logVerbose(`CompanyInfoPage.enterNumberOfEmployees value=${value}`);
    await this.numberOfEmployeesInput.fill(value);
  }

  async selectCurrency(currency: string): Promise<void> {
    logVerbose(`CompanyInfoPage.selectCurrency currency=${currency}`);
    await this.currencyDropdown.click();
    await this.page.getByRole('option', { name: currency, exact: false }).click();
  }

  async enterAddress(address: string): Promise<void> {
    logVerbose(`CompanyInfoPage.enterAddress address=${address}`);
    await this.addressInput.fill(address);
  }

  async selectCountry(country: string): Promise<void> {
    logVerbose(`CompanyInfoPage.selectCountry country=${country}`);
    await this.countryDropdown.click();
    await this.page.getByText(country, { exact: true }).click();
  }

  async enterCity(city: string): Promise<void> {
    logVerbose(`CompanyInfoPage.enterCity city=${city}`);
    await this.cityInput.fill(city);
  }

  async clickNext(): Promise<void> {
    logVerbose('CompanyInfoPage.clickNext');
    await this.nextButton.click();
  }
}
