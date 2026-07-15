import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

export class LoginPage extends BasePage {
  readonly emailInput    = this.page.getByPlaceholder('Email');
  readonly passwordInput = this.page.getByPlaceholder('Password');
  readonly signInButton  = this.page.getByRole('button', { name: 'Sign in', exact: true });

  async open(): Promise<void> {
    logVerbose('LoginPage.open');
    await this.goto(ROUTES.login);
  }

  async login(email: string, password: string): Promise<void> {
    logVerbose(`LoginPage.login email=${email}`);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
    await this.page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30_000 });
  }

  async clickLogout(): Promise<void> {
    logVerbose('LoginPage.clickLogout');
    await this.header.clickLogout();
  }
}
