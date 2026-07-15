// Ported from: tests/modules/time-tracking/api/verify/policies.spec.ts (Worker Assignment)
// Inventory ids: TC_TT_API_010, TC_TT_API_011, TC_TT_API_012, TC_TT_API_013
//
// Precondition strategy: env(TT_FIXED_CONTRACT_ID) + auto-discovery + self-skip.
// The TT API enforces workerType↔contract matching on assignment (400 otherwise), so
// these tests create a per_hour / flexible policy and assign per_hour PAYG contracts
// discovered live. Legacy used a static workers.json (type-agnostic contract ids) — replaced
// by live discovery. TODO(api-preconditions): sandbox currently exposes only 1 Ongoing
// per_hour contract, so the ≥2-contract tests (010, 013) self-skip until more are seeded.

import { test, expect } from '@features/time-tracking/fixtures';
import { buildFlexiblePolicy } from '@features/time-tracking/builders/policy.builder';

test.describe('Time Tracking API — Policy Worker Assignment', () => {

  // TODO(merge): TC_TT_API_010 and TC_TT_API_011 are merge candidates (both exercise
  //   PUT replace-all; 010 = assign workers, 011 = clear workers via empty array).
  //   Port verbatim now; consolidate into a single parametrized test in the cleanup phase.
  test('TC_TT_API_010: replace all policy workers (PUT) @workers @regression @critical', async ({ timeTrackingClient, perHourContractIds }) => {
    if (perHourContractIds.length < 2) {
      // TODO(api-preconditions): need ≥2 Ongoing per_hour contracts on sandbox; self-skip when absent.
      // SKIP(api-preconditions): fewer than 2 Ongoing per_hour contracts on sandbox
      test.skip(true, 'Fewer than 2 Ongoing per_hour contracts on sandbox — TODO(api-preconditions)');
      return;
    }

    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: `QA Workers Replace-All ${Date.now()}` }),
    );

    expect(createRes.status).toBe(201);
    const policyId: number = createRes.body.result.id;

    const selectedIds = perHourContractIds.slice(0, Math.min(3, perHourContractIds.length));
    const assignRes = await timeTrackingClient.replaceAllPolicyWorkers(policyId, selectedIds);

    expect([200, 204]).toContain(assignRes.status);

    const getRes = await timeTrackingClient.getPolicyById(policyId);

    expect(getRes.status).toBe(200);

    await timeTrackingClient.deletePolicy(policyId);
  });

  test('TC_TT_API_011: clear all workers with empty array (PUT) @workers @regression', async ({ timeTrackingClient, perHourContractIds }) => {
    if (perHourContractIds.length < 1) {
      // TODO(api-preconditions): need ≥1 Ongoing per_hour contract on sandbox; self-skip when absent.
      // SKIP(api-preconditions): no Ongoing per_hour contract on sandbox
      test.skip(true, 'No Ongoing per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: `QA Workers Clear-All ${Date.now()}` }),
    );

    expect(createRes.status).toBe(201);
    const policyId: number = createRes.body.result.id;

    const initialIds = perHourContractIds.slice(0, Math.min(2, perHourContractIds.length));
    await timeTrackingClient.replaceAllPolicyWorkers(policyId, initialIds);

    const clearRes = await timeTrackingClient.replaceAllPolicyWorkers(policyId, []);

    expect([200, 204]).toContain(clearRes.status);

    const getRes = await timeTrackingClient.getPolicyById(policyId);

    expect(getRes.status).toBe(200);

    await timeTrackingClient.deletePolicy(policyId);
  });

  // TODO(merge): TC_TT_API_012 is a merge candidate with TC_TT_API_016 (invalid-id PUT vs
  //   invalid-id PATCH). Port verbatim now; consolidate in the cleanup phase.
  test('TC_TT_API_012: 404 for invalid policy id (PUT) @workers @regression', async ({ timeTrackingClient, perHourContractIds }) => {
    if (perHourContractIds.length < 1) {
      // TODO(api-preconditions): need ≥1 Ongoing per_hour contract to send a valid body.
      // SKIP(api-preconditions): no Ongoing per_hour contract on sandbox
      test.skip(true, 'No Ongoing per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const selectedIds = perHourContractIds.slice(0, Math.min(2, perHourContractIds.length));
    const res = await timeTrackingClient.replaceAllPolicyWorkers(999999, selectedIds);

    expect(res.status).toBe(404);
  });

  test('TC_TT_API_013: add workers to policy (PATCH add-only) @workers @regression @critical', async ({ timeTrackingClient, perHourContractIds }) => {
    if (perHourContractIds.length < 2) {
      // TODO(api-preconditions): need ≥2 Ongoing per_hour contracts on sandbox; self-skip when absent.
      // SKIP(api-preconditions): fewer than 2 Ongoing per_hour contracts on sandbox
      test.skip(true, 'Fewer than 2 Ongoing per_hour contracts on sandbox — TODO(api-preconditions)');
      return;
    }

    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: `QA Workers Add-Only ${Date.now()}` }),
    );

    expect(createRes.status).toBe(201);
    const policyId: number = createRes.body.result.id;

    const workersToAdd = perHourContractIds.slice(0, 2);
    const patchRes = await timeTrackingClient.modifyPolicyWorkers(policyId, workersToAdd);

    expect([200, 204]).toContain(patchRes.status);

    const getRes = await timeTrackingClient.getPolicyById(policyId);

    expect(getRes.status).toBe(200);

    await timeTrackingClient.deletePolicy(policyId);
  });

  // TODO(merge): TC_TT_API_014 is a merge candidate with TC_TT_API_013 (PATCH add-only vs
  //   PATCH remove-only). Port verbatim now; consolidate into a single parametrized test in
  //   the cleanup phase.
  test('TC_TT_API_014: remove workers from policy (PATCH remove-only) @workers @regression', async ({ timeTrackingClient, perHourContractIds }) => {
    if (perHourContractIds.length < 2) {
      // TODO(api-preconditions): need ≥2 Ongoing per_hour contracts on sandbox; self-skip when absent.
      // SKIP(api-preconditions): fewer than 2 Ongoing per_hour contracts on sandbox
      test.skip(true, 'Fewer than 2 Ongoing per_hour contracts on sandbox — TODO(api-preconditions)');
      return;
    }

    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: `QA Workers Remove-Only ${Date.now()}` }),
    );

    expect(createRes.status).toBe(201);
    const policyId: number = createRes.body.result.id;

    const initialIds = perHourContractIds.slice(0, Math.min(3, perHourContractIds.length));
    await timeTrackingClient.replaceAllPolicyWorkers(policyId, initialIds);

    const workerToRemove = [initialIds[0]];
    const patchRes = await timeTrackingClient.modifyPolicyWorkers(policyId, [], workerToRemove);

    expect([200, 204]).toContain(patchRes.status);

    const getRes = await timeTrackingClient.getPolicyById(policyId);

    expect(getRes.status).toBe(200);

    await timeTrackingClient.deletePolicy(policyId);
  });

  test('TC_TT_API_015: add and remove workers in same PATCH call @workers @regression @critical', async ({ timeTrackingClient, perHourContractIds }) => {
    if (perHourContractIds.length < 3) {
      // TODO(api-preconditions): need ≥3 Ongoing per_hour contracts on sandbox; self-skip when absent.
      // SKIP(api-preconditions): fewer than 3 Ongoing per_hour contracts on sandbox
      test.skip(true, 'Fewer than 3 Ongoing per_hour contracts on sandbox — TODO(api-preconditions)');
      return;
    }

    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: `QA Workers Modify ${Date.now()}` }),
    );

    expect(createRes.status).toBe(201);
    const policyId: number = createRes.body.result.id;

    const initialIds = perHourContractIds.slice(0, 2);
    await timeTrackingClient.replaceAllPolicyWorkers(policyId, initialIds);

    const idsToAdd = [perHourContractIds[2]];
    const idsToRemove = [initialIds[0]];
    const patchRes = await timeTrackingClient.modifyPolicyWorkers(policyId, idsToAdd, idsToRemove);

    expect([200, 204]).toContain(patchRes.status);

    const getRes = await timeTrackingClient.getPolicyById(policyId);

    expect(getRes.status).toBe(200);

    await timeTrackingClient.deletePolicy(policyId);
  });

  // TODO(merge): TC_TT_API_016 is a merge candidate with TC_TT_API_012 (invalid-id PUT vs
  //   invalid-id PATCH). Port verbatim now; consolidate in the cleanup phase.
  test('TC_TT_API_016: 404 for invalid policy id (PATCH) @workers @regression', async ({ timeTrackingClient, perHourContractIds }) => {
    if (perHourContractIds.length < 1) {
      // TODO(api-preconditions): need ≥1 Ongoing per_hour contract to send a valid body.
      // SKIP(api-preconditions): no Ongoing per_hour contract on sandbox
      test.skip(true, 'No Ongoing per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const idsToAdd = perHourContractIds.slice(0, 1);
    const res = await timeTrackingClient.modifyPolicyWorkers(999999, idsToAdd);

    expect(res.status).toBe(404);
  });

  test('TC_TT_API_017: duplicate worker PATCH is accepted-or-rejected gracefully @workers @regression', async ({ timeTrackingClient, perHourContractIds }) => {
    if (perHourContractIds.length < 1) {
      // TODO(api-preconditions): need ≥1 Ongoing per_hour contract on sandbox; self-skip when absent.
      // SKIP(api-preconditions): no Ongoing per_hour contract on sandbox
      test.skip(true, 'No Ongoing per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: `QA Workers Duplicate ${Date.now()}` }),
    );

    expect(createRes.status).toBe(201);
    const policyId: number = createRes.body.result.id;

    const workerId = perHourContractIds[0];
    await timeTrackingClient.replaceAllPolicyWorkers(policyId, [workerId]);

    const patchRes = await timeTrackingClient.modifyPolicyWorkers(policyId, [workerId]);

    expect([200, 204, 400, 409]).toContain(patchRes.status);

    const getRes = await timeTrackingClient.getPolicyById(policyId);

    expect(getRes.status).toBe(200);

    await timeTrackingClient.deletePolicy(policyId);
  });

});
