import { Page } from '@playwright/test';

export class Header {
  constructor(private readonly page: Page) {}

  get logo() {
    return this.page.getByRole('link', { name: 'RemotePass logo' });
  }

  get search() {
    return this.page.getByRole('button', { name: 'Search' });
  }

  get notifications() {
    return this.page.getByRole('button', { name: 'Notifications' });
  }

  get sidebarToggle() {
    return this.page.locator('#vertical-menu-btn');
  }

  get userMenuButton() {
    return this.page.getByRole('button', { name: /^[A-Z]{2}$/ });
  }

  get logoutMenuItem() {
    return this.page.getByRole('menuitem', { name: 'Logout' });
  }

  get banner() {
    return this.page.getByRole('banner');
  }

  async clickLogout(): Promise<void> {
    await this.userMenuButton.click();
    await this.logoutMenuItem.click();
    await this.page.waitForURL(/\/login/, { timeout: 30_000 });
  }
}
