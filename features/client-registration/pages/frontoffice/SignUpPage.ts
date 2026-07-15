import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_DESCRIPTIONS,
} from '@features/client-registration/constants';
import { AccountType } from '@features/client-registration/types';

/**
 * Sign-up — Account Type step (Step 1.1) front-office page object.
 * Locators + actions only; assertions live in the spec.
 * Ported from legacy pages/modules/SignUp/SignUpPage-Step1.1-ChooseAccountType.ts.
 */
export class SignUpPage extends BasePage {
  // ---- Account type options + descriptions ----
  readonly companyOption = this.page.getByText(ACCOUNT_TYPE_LABELS.COMPANY);
  readonly companyDescription = this.page.getByText(ACCOUNT_TYPE_DESCRIPTIONS.COMPANY);
  readonly contractorOption = this.page.getByText(ACCOUNT_TYPE_LABELS.CONTRACTOR);
  readonly contractorDescription = this.page.getByText(ACCOUNT_TYPE_DESCRIPTIONS.CONTRACTOR);
  readonly employeeOption = this.page.getByText(ACCOUNT_TYPE_LABELS.EMPLOYEE);
  readonly employeeDescription = this.page.getByText(ACCOUNT_TYPE_DESCRIPTIONS.EMPLOYEE);

  // ---- Form controls ----
  readonly emailInput = this.page.locator('[data-test-id="cntl-input-email"]');
  readonly googleSignUpButton = this.page.getByRole('button', { name: 'Sign up with Google' });
  readonly termsCheckbox = this.page.locator('input[type="checkbox"]');
  readonly termsText = this.page.getByText('I agree to the Terms of');
  readonly nextButton = this.page.getByRole('button', { name: 'Next' });
  readonly backButton = this.page.getByRole('button', { name: 'Back' });

  // ---- Actions ----
  async open(): Promise<void> {
    logVerbose('SignUpPage.open');
    await this.goto(ROUTES.signup);
  }

  async selectAccountType(type: AccountType): Promise<void> {
    logVerbose(`SignUpPage.selectAccountType type=${type}`);
    const option = {
      company: this.companyOption,
      contractor: this.contractorOption,
      employee: this.employeeOption,
    }[type];
    await option.click();
  }

  async enterEmail(email: string): Promise<void> {
    logVerbose(`SignUpPage.enterEmail email=${email}`);
    await this.emailInput.fill(email);
  }

  async acceptTerms(): Promise<void> {
    logVerbose('SignUpPage.acceptTerms');
    await this.termsCheckbox.check({ force: true });
  }

  async clickNext(): Promise<void> {
    logVerbose('SignUpPage.clickNext');
    await this.nextButton.click();
  }

  async clickBack(): Promise<void> {
    logVerbose('SignUpPage.clickBack');
    await this.backButton.click();
  }
}
