import { Locator, Page } from '@playwright/test';
import { logVerbose } from '@utils/helpers/logger';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

export class BasePage {
  private _header?: Header;
  private _sidebar?: Sidebar;

  constructor(protected readonly page: Page) {}

  get header(): Header {
    return (this._header ??= new Header(this.page));
  }

  get sidebar(): Sidebar {
    return (this._sidebar ??= new Sidebar(this.page));
  }

  protected async goto(path: string): Promise<void> {
    logVerbose(`UI goto ${path}`);
    // waitUntil 'domcontentloaded' (not the default 'load'): on the RemotePass SPA
    // the 'load' event can stall, hanging goto() to the navigation timeout.
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.waitForLoad();
  }

  protected async waitForLoad(): Promise<void> {
    // 'domcontentloaded', NOT 'networkidle': the RemotePass SPA holds persistent
    // connections open, so the network never idles and 'networkidle' hangs to the
    // navigation timeout. Web-first assertions handle post-load waits.
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Shared error-toast locator, filtered by (partial) message text.
   * Cross-cutting across pages — assert visibility from the test.
   */
  errorToast(message: string): Locator {
    return this.page
      .locator('[role="alert"], .toast-error, [data-test-id*="toast"], #toast-container')
      .filter({ hasText: message })
      .first();
  }

  /**
   * Shared success-toast locator, filtered by (partial) message text.
   * Cross-cutting across pages — assert visibility from the test.
   */
  successToast(message: string): Locator {
    return this.page
      .locator('[role="alert"], .toast-success, [data-test-id*="toast"], #toast-container')
      .filter({ hasText: message })
      .first();
  }
}
