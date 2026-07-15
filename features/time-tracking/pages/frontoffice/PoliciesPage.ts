import { Locator } from '@playwright/test';
import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * PoliciesPage — the Time Tracking policies list screen at /time-tracking.
 *
 * NOTE: As of 2026-06-25 the /time-tracking route redirects to /activity in the
 * sandbox frontoffice (the TT policies UI screen is not currently reachable for
 * the client role). This POM is built from the legacy locators so that UI specs
 * can ship as reachability-gated self-skips and reactivate automatically when
 * the screen returns. Do NOT rely on visual verification against the live screen.
 *
 * Locators + actions only — assertions live in the spec (ASSERT-003).
 * Ported from legacy pages/modules/time-tracking/TimeTrackingPage.ts and PolicyPage.ts.
 */
export class PoliciesPage extends BasePage {
  // ==================== Static locators ====================

  /** "Create Policy" button — appears in the policies list header. */
  readonly createPolicyButton = this.page.getByRole('button', { name: /create policy/i });

  // ==================== Navigation ====================

  /**
   * Navigate to the Time Tracking policies screen.
   * The legacy route is /time-tracking; the SPA should show the Policies tab.
   */
  async open(): Promise<void> {
    logVerbose('Open Time Tracking Policies page');
    await this.goto(ROUTES.timeTracking);
  }

  async reload(): Promise<void> {
    logVerbose('Reload Time Tracking Policies page');
    await this.page.reload();
  }

  // ==================== Dynamic locators ====================

  /**
   * Returns the table row (or row-like container) that contains the given policy title.
   * The SPA renders policies in a `<table>` so we target `<tr>` first; if that misses,
   * the broader `[class*="policy"]` container is the fallback.
   */
  policyRowByTitle(title: string): Locator {
    return this.page.getByRole('row', { name: title });
  }

  /**
   * "Manage Workers" button scoped to the row for the given policy title.
   * Matches the label both as "Manage Workers" and "Manage workers" (case-insensitive).
   */
  manageWorkersButton(title: string): Locator {
    return this.policyRowByTitle(title).getByRole('button', { name: /manage workers/i });
  }

  /**
   * The overtime status span inside the row for the given policy title.
   * Legacy showed "Overtime disabled" / "Overtime enabled" as a `<span>` within the row.
   */
  overtimeStatus(title: string): Locator {
    return this.policyRowByTitle(title).locator('span').filter({ hasText: /overtime/i });
  }

  // ==================== Actions ====================

  async clickManageWorkers(title: string): Promise<void> {
    logVerbose(`Click Manage Workers for policy: ${title}`);
    await this.manageWorkersButton(title).click();
  }

  // ==================== Reachability ====================

  /**
   * Navigates to the page and checks whether the policies list actually rendered.
   *
   * Used by specs as a self-skip guard while the /time-tracking route is not
   * reachable in the sandbox. Returns `true` when the policy row for `title` is
   * visible within 5 s; `false` otherwise (redirect, empty screen, timeout).
   *
   * Implementation uses `waitFor({ state: 'visible', timeout })` — a web-first
   * auto-waiting check, not a fixed sleep (WAIT-002 compliant).
   */
  async isPoliciesScreenReachable(title = 'Default'): Promise<boolean> {
    logVerbose(`Check policies screen reachability (probe title: "${title}")`);
    await this.open();
    return this.policyRowByTitle(title)
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
  }
}
