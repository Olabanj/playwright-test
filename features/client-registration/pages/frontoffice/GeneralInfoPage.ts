import { BasePage } from '@core/ui/BasePage';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Sign-up — General Info step (Step 2: "Your Information") front-office page object.
 * Locators + actions only; assertions live in the spec.
 * Ported from legacy pages/modules/SignUp/SignUpPage-Step2-GeneralInfoPage.ts.
 */
export class GeneralInfoPage extends BasePage {
  readonly heading = this.page.getByRole('heading', { name: 'General info' });
  readonly firstNameInput = this.page.locator('[data-test-id="cntl-input-firstname"]');
  readonly middleNameInput = this.page.locator('[data-test-id="cntl-input-middlename"]');
  readonly lastNameInput = this.page.locator('[data-test-id="cntl-input-lastname"]');
  // TODO(selector): brittle XPath ported verbatim from legacy. Replace with a
  // stable locator (getByLabel/getByRole/testid) once verified against the live UI.
  readonly countryDropdown = this.page.locator('(//div[.="Country"])[1]');
  readonly phoneNumberInput = this.page.locator('#phone');
  readonly passwordInput = this.page.locator('[data-test-id="cntl-input-password"]');
  readonly registerButton = this.page.getByRole('button', { name: 'Register' });

  async enterFirstName(name: string): Promise<void> {
    logVerbose(`GeneralInfoPage.enterFirstName name=${name}`);
    await this.firstNameInput.fill(name);
  }

  async enterMiddleName(name: string): Promise<void> {
    logVerbose(`GeneralInfoPage.enterMiddleName name=${name}`);
    await this.middleNameInput.fill(name);
  }

  async enterLastName(name: string): Promise<void> {
    logVerbose(`GeneralInfoPage.enterLastName name=${name}`);
    await this.lastNameInput.fill(name);
  }

  async selectCountry(country: string): Promise<void> {
    logVerbose(`GeneralInfoPage.selectCountry country=${country}`);
    await this.countryDropdown.click();
    await this.page.getByText(country, { exact: true }).click();
  }

  async enterPhoneNumber(phone: string): Promise<void> {
    logVerbose(`GeneralInfoPage.enterPhoneNumber phone=${phone}`);
    await this.phoneNumberInput.fill(phone);
  }

  async enterPassword(password: string): Promise<void> {
    logVerbose('GeneralInfoPage.enterPassword');
    await this.passwordInput.fill(password);
  }

  async clickRegister(): Promise<void> {
    logVerbose('GeneralInfoPage.clickRegister');
    await this.registerButton.click();
  }
}
