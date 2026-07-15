import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Sign-up — Verify Email step (Step 1.2) front-office page object.
 * Locators + actions only; assertions live in the spec.
 * Ported from legacy pages/modules/SignUp/SignUpPage-Step1.2-VerifyEmailPage.ts.
 */
export class VerifyEmailPage extends BasePage {
  readonly heading = this.page.getByRole('heading', { name: 'Verify your email' });
  readonly codeInput = this.page.locator('[data-cy="verification-code-0-item"]');
  readonly codeItems = this.page.locator('[data-cy^="verification-code-"][data-cy$="-item"]');
  readonly resendCodeButton = this.page.getByRole('button', { name: 'Resend it' });
  readonly signInLink = this.page.locator('a[href="/login"]');
  readonly enterCodeLabel = this.page.getByText('Enter Code');
  readonly confirmationText = this.page.getByText('A confirmation code has been sent to');

  /** The confirmation line showing a specific email (dynamic → method, not getter). */
  emailText(email: string): Locator {
    return this.page.getByText(email);
  }

  /** Type a verification code into the OTP boxes (focus first box, then type). */
  async enterVerificationCode(code: string): Promise<void> {
    logVerbose('VerifyEmailPage.enterVerificationCode');
    await this.codeInput.click();
    await this.page.keyboard.type(code);
  }
}
