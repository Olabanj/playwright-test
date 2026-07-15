import { Page } from '@playwright/test';

export type SidebarItem =
  | 'Activity'
  | 'People'
  | 'Documents'
  | 'SpendCards'
  | 'Reports'
  | 'Invoices'
  | 'Transactions';

/** Maps the typed union key to the visible link text rendered in the DOM. */
const SIDEBAR_LABELS: Record<SidebarItem, string> = {
  Activity: 'Activity',
  People: 'People',
  Documents: 'Documents',
  SpendCards: 'Spend Cards',
  Reports: 'Reports',
  Invoices: 'Invoices',
  Transactions: 'Transactions',
};

export class Sidebar {
  private readonly container;

  constructor(private readonly page: Page) {
    this.container = page.locator('#side-menu-list');
  }

  /**
   * Returns the sidebar link locator for the given item.
   * Use this for assertions; use `goTo` for navigation actions.
   */
  link(item: SidebarItem) {
    return this.container.getByRole('link', { name: SIDEBAR_LABELS[item] });
  }

  /** Clicks the sidebar link for `item`. Navigation is orchestrated by the caller. */
  async goTo(item: SidebarItem): Promise<void> {
    await this.link(item).click();
  }
}
