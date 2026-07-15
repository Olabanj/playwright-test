import { Page } from '@playwright/test';
import { baseTest, injectUiAuthFromAccount } from '@fixtures/base.fixture';
import { TimeTrackingClient } from '@features/time-tracking/api-client';
import {
  findPerHourContractIds,
  findFixedContractIds,
  findWorkerPerHourContractId,
  ensureNoActiveSession,
} from '@features/time-tracking/seeding';
import { buildFlexiblePolicy } from '@features/time-tracking/builders/policy.builder';
import { PoliciesPage } from '@features/time-tracking/pages/frontoffice/PoliciesPage';

// ==================== Test-scoped fixtures ====================

export interface TimeTrackingFixtures {
  /**
   * Time Tracking API client authenticated as the client/company role.
   * Initialised with the worker-scoped base `clientAccount` — one login per
   * Playwright run (cached by global-setup), reused across all tests. Disposed on teardown.
   */
  timeTrackingClient: TimeTrackingClient;

  /**
   * Time Tracking API client authenticated as the contractor/worker role.
   * Initialised with the worker-scoped `contractorToken` — one login per Playwright
   * worker, reused across all tests in that worker. Disposed on teardown.
   */
  workerTimeTrackingClient: TimeTrackingClient;

  /**
   * Ongoing per_hour PAYG contract ids discovered on the sandbox (worker-scoped, cached).
   * This is the worker-type that matches a `per_hour` / flexible policy — the kind the
   * worker-assignment tests create. Tests self-skip when this array is too small.
   *
   * TODO(api-preconditions): discovered from sandbox-resident contracts; seed real
   *   per_hour contracts in the cleanup phase to eliminate the skip path in CI.
   */
  perHourContractIds: number[];

  /**
   * Ongoing Fixed-contractor contract ids discovered on the sandbox (worker-scoped, cached).
   * Matches a `fixed_contractor` / schedule_window policy. Retained for later
   * by-contract / matrix batches. Tests self-skip when empty.
   *
   * TODO(api-preconditions): see perHourContractIds.
   */
  fixedContractIds: number[];

  /**
   * Factory state-fixture: the worker's Ongoing per_hour PAYG contract id, with a
   * freshly created flexible policy assigned to it (by the client). Yields 0 (sentinel)
   * when no matching worker contract is found — specs must self-skip on 0.
   *
   * Teardown: ends any active session, then deletes the created policy.
   *
   * TODO(api-preconditions): clock-in requires an assigned policy; this fixture assigns
   *   one transiently so session tests are self-contained. In the cleanup phase, replace
   *   with a seeded per_hour contract that already has a policy so the fixture is lighter.
   */
  sessionContractId: number;

  /**
   * A `page` already authenticated as the client (company) user, ready to navigate
   * the frontoffice for TT policies UI flows. Auth is injected via localStorage
   * (Redux-Persist rehydration) — no login form required.
   * Test-scoped (fresh page per test = clean navigation state);
   * the underlying auth comes from the worker-scoped base `clientAccount` (no re-login).
   */
  policiesClientPage: Page;

  /** PoliciesPage POM bound to the client-authenticated page. */
  policiesPage: PoliciesPage;
}

// ==================== Extended test object ====================

export const test = baseTest.extend<TimeTrackingFixtures>({
  // Reuses the worker-scoped base `clientAccount` (run-cached by global-setup, or a single
  // live login per worker as fallback) — no extra login round-trip for this feature.
  timeTrackingClient: async ({ clientAccount }, use) => {
    const client = new TimeTrackingClient();
    await client.init(clientAccount.token);
    await use(client);
    await client.dispose();
  },

  workerTimeTrackingClient: async ({ contractorToken }, use) => {
    const client = new TimeTrackingClient();
    await client.init(contractorToken);
    await use(client);
    await client.dispose();
  },

  perHourContractIds: async ({ timeTrackingClient }, use) => {
    const ids = await findPerHourContractIds(timeTrackingClient);
    await use(ids);
  },

  fixedContractIds: async ({ timeTrackingClient }, use) => {
    const ids = await findFixedContractIds(timeTrackingClient);
    await use(ids);
  },

  /**
   * TODO(api-preconditions): clock-in requires the worker contract to have an assigned
   *   policy. This fixture creates a transient per_hour flexible policy (client-auth) and
   *   assigns it, then removes it on teardown. The live sandbox worker per_hour contract
   *   is id 17457 (subtype payg, rateCode hour, statusId 4, verified 2026-06-25).
   */
  sessionContractId: async ({ timeTrackingClient, workerTimeTrackingClient }, use) => {
    const contractId = await findWorkerPerHourContractId(workerTimeTrackingClient);

    if (!contractId) {
      // 0 sentinel — specs that depend on this fixture self-skip
      await use(0);
      return;
    }

    // Create a transient per_hour flexible policy and assign the worker contract to it
    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: `QA Session Policy ${Date.now()}` }),
    );
    const policyId = createRes.status === 201 ? createRes.body?.result?.id : null;

    if (policyId) {
      await timeTrackingClient.modifyPolicyWorkers(policyId, [contractId], []);
    }

    await use(contractId);

    // Teardown: end any stray active session, then delete the transient policy
    await ensureNoActiveSession(workerTimeTrackingClient, contractId);
    if (policyId) {
      await timeTrackingClient.deletePolicy(policyId);
    }
  },

  // Test-scoped: each test gets a FRESH page (clean navigation state, no leftover URL).
  // Auth is injected from the worker-scoped base `clientAccount` — zero extra logins per test.
  policiesClientPage: async ({ page, clientAccount }, use) => {
    await injectUiAuthFromAccount(page, clientAccount);
    await use(page);
  },

  policiesPage: async ({ policiesClientPage }, use) => {
    await use(new PoliciesPage(policiesClientPage));
  },
});

export { expect } from '@playwright/test';
