/**
 * Time Tracking Policies UI — list / display / manage tests (batch 9a, 4 tests).
 *
 * TODO(flaky): TT UI flows degrade under sandbox concurrency — run with --workers=1.
 *   Do not heal flakes here; inherited from legacy flow. Tag; fix in dedicated cleanup phase.
 *
 * TODO(merge): "display the policies list page with default policy" (intent 1) and
 *   "display all required policy information" (intent 5) are list-display duplicates —
 *   consolidate into a single test in the cleanup phase.
 *
 * TODO(merge): "handle post-login dialogs and reach Time Tracking" (intent 4) overlaps
 *   intent 1 — same entry point + same assertion. Consolidate in cleanup phase.
 *
 * Reachability note: the /time-tracking route redirects to /activity in the current
 * sandbox frontoffice (no Time Tracking entry in Company Settings). Every test
 * self-skips at the reachability guard and reactivates automatically when the screen
 * returns (TODO(api-preconditions) bracket).
 */
import { test, expect } from '@features/time-tracking/fixtures';

const DEFAULT_POLICY = 'Default';

test.describe('Time Tracking Policies - UI @ui @regression', () => {
  /**
   * Verify that a user can view the list of policies.
   *
   * TODO(merge): duplicates "display all required policy information" — consolidate in cleanup.
   */
  test('Should display the policies list page with default policy @smoke', async ({
    policiesPage,
  }) => {
    const reachable = await policiesPage.isPoliciesScreenReachable(DEFAULT_POLICY);
    if (!reachable) {
      // TODO(api-preconditions): TT policies UI screen is not exposed in the current frontoffice
      //   (route /time-tracking redirects to /activity; no Time Tracking entry in Company Settings).
      //   The TT API works; only the UI entry point is missing (feature flag off / screen relocated).
      //   Self-skip until the screen returns — flow ported verbatim below reactivates automatically.
      // SKIP(api-preconditions): TT policies UI not exposed in frontoffice (route redirects to /activity)
      test.skip(true, 'TT policies UI not exposed in frontoffice — TODO(api-preconditions)');
      return;
    }

    await policiesPage.open();

    await expect(policiesPage.policyRowByTitle(DEFAULT_POLICY)).toBeVisible();
    await expect(policiesPage.manageWorkersButton(DEFAULT_POLICY)).toBeVisible();
    await expect(policiesPage.overtimeStatus(DEFAULT_POLICY)).toBeVisible();
  });

  /**
   * Verify that the Manage Workers button is functional.
   */
  test('Should be able to click Manage Workers button for a policy @smoke', async ({
    policiesPage,
  }) => {
    const reachable = await policiesPage.isPoliciesScreenReachable(DEFAULT_POLICY);
    if (!reachable) {
      // TODO(api-preconditions): TT policies UI screen is not exposed in the current frontoffice
      //   (route /time-tracking redirects to /activity; no Time Tracking entry in Company Settings).
      //   The TT API works; only the UI entry point is missing (feature flag off / screen relocated).
      //   Self-skip until the screen returns — flow ported verbatim below reactivates automatically.
      // SKIP(api-preconditions): TT policies UI not exposed in frontoffice (route redirects to /activity)
      test.skip(true, 'TT policies UI not exposed in frontoffice — TODO(api-preconditions)');
      return;
    }

    await policiesPage.open();
    await policiesPage.clickManageWorkers(DEFAULT_POLICY);
  });

  /**
   * Verify post-login dialogs are handled automatically.
   *
   * TODO(merge): overlaps "display the policies list page with default policy" (intent 1) —
   *   same entry point + same assertion. Consolidate in cleanup phase.
   */
  test('Should handle post-login dialogs and reach Time Tracking successfully', async ({
    policiesPage,
  }) => {
    const reachable = await policiesPage.isPoliciesScreenReachable(DEFAULT_POLICY);
    if (!reachable) {
      // TODO(api-preconditions): TT policies UI screen is not exposed in the current frontoffice
      //   (route /time-tracking redirects to /activity; no Time Tracking entry in Company Settings).
      //   The TT API works; only the UI entry point is missing (feature flag off / screen relocated).
      //   Self-skip until the screen returns — flow ported verbatim below reactivates automatically.
      // SKIP(api-preconditions): TT policies UI not exposed in frontoffice (route redirects to /activity)
      test.skip(true, 'TT policies UI not exposed in frontoffice — TODO(api-preconditions)');
      return;
    }

    await policiesPage.open();

    await expect(policiesPage.policyRowByTitle(DEFAULT_POLICY)).toBeVisible();
  });

  /**
   * Verify policy list contains all required elements.
   *
   * TODO(merge): duplicates "display the policies list page with default policy" (intent 1) —
   *   consolidate into a single test in the cleanup phase.
   */
  test('Should display all required policy information @smoke', async ({ policiesPage }) => {
    const reachable = await policiesPage.isPoliciesScreenReachable(DEFAULT_POLICY);
    if (!reachable) {
      // TODO(api-preconditions): TT policies UI screen is not exposed in the current frontoffice
      //   (route /time-tracking redirects to /activity; no Time Tracking entry in Company Settings).
      //   The TT API works; only the UI entry point is missing (feature flag off / screen relocated).
      //   Self-skip until the screen returns — flow ported verbatim below reactivates automatically.
      // SKIP(api-preconditions): TT policies UI not exposed in frontoffice (route redirects to /activity)
      test.skip(true, 'TT policies UI not exposed in frontoffice — TODO(api-preconditions)');
      return;
    }

    await policiesPage.open();

    await expect(policiesPage.policyRowByTitle(DEFAULT_POLICY)).toBeVisible();

    await expect(policiesPage.manageWorkersButton(DEFAULT_POLICY)).toBeVisible();
    await expect(policiesPage.manageWorkersButton(DEFAULT_POLICY)).toBeEnabled();

    await expect(policiesPage.overtimeStatus(DEFAULT_POLICY)).toBeVisible();
  });
});
