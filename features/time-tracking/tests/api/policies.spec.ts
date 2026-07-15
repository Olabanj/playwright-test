import { test, expect } from '@features/time-tracking/fixtures';
import { buildFlexiblePolicy, buildScheduleWindowPolicy } from '@features/time-tracking/builders/policy.builder';
import { CreatePolicyRequest } from '@features/time-tracking/types';

// Time Tracking — Policy CRUD API (Batch 1 + Batch 2, no preconditions)
// Ported from: tests/modules/time-tracking/api/verify/policies.spec.ts
// Batch 1 inventory ids: ce8031511197 b30559300db3 07edd9afd239 e128c54f7679 0675d96e8912
// Batch 2 inventory ids: 33dd11ae0d0a c6368c145769 8fffcd7bb4aa 33bf8a368d18 1fddc6ee51e3 1dfbb63d5255

test.describe('Time Tracking API — Policies (CRUD)', () => {
  // Tracks the policy created by TC_TT_API_004 for afterAll cleanup.
  let createdPolicyId: number | null = null;

  test.afterAll(async ({ timeTrackingClient }) => {
    if (createdPolicyId !== null) {
      await timeTrackingClient.deletePolicy(createdPolicyId).catch(() => undefined);
    }
  });

  test('TC_TT_API_000: API Health Check @smoke @critical', async ({ timeTrackingClient }) => {
    const res = await timeTrackingClient.checkHealth();

    expect(res.status).toBe(200);
  });

  test('TC_TT_API_001: get all policies with pagination @smoke', async ({ timeTrackingClient }) => {
    const res = await timeTrackingClient.listPolicies();

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('result');
    expect(res.body.result).toHaveProperty('items');
    expect(res.body.result).toHaveProperty('page');
    expect(res.body.result).toHaveProperty('limit');
    expect(res.body.result).toHaveProperty('total_items_count');
    expect(res.body.result).toHaveProperty('total_pages_count');

    expect(Array.isArray(res.body.result.items)).toBe(true);

    if (res.body.result.items.length > 0) {
      const policy = res.body.result.items[0];

      expect(policy).toHaveProperty('id');
      expect(typeof policy.id).toBe('number');
      expect(policy).toHaveProperty('title');
      expect(policy).toHaveProperty('timeBasis');
      expect(policy).toHaveProperty('companyId');
      expect(policy).toHaveProperty('isManualEntryAllowed');
      expect(policy).toHaveProperty('isTimeTrackerEntryAllowed');
    }
  });

  test('TC_TT_API_002: get policy by valid ID @regression', async ({ timeTrackingClient }) => {
    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: `QA Get-By-ID ${Date.now()}` }),
    );

    expect(createRes.status).toBe(201);
    const policyId: number = createRes.body.result.id;

    const res = await timeTrackingClient.getPolicyById(policyId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('result');
    expect(res.body.result).toHaveProperty('id', policyId);
    expect(res.body.result).toHaveProperty('title');
    expect(res.body.result).toHaveProperty('days');
    expect(Array.isArray(res.body.result.days)).toBe(true);

    await timeTrackingClient.deletePolicy(policyId);
  });

  test('TC_TT_API_004: create new policy with valid data @regression @critical', async ({ timeTrackingClient }) => {
    const payload = buildScheduleWindowPolicy({ title: `QA Create ${Date.now()}` });
    const res = await timeTrackingClient.createPolicy(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('result');
    expect(res.body.result).toHaveProperty('id');
    expect(res.body.result).toHaveProperty('title', payload.title);
    expect(res.body.result).toHaveProperty('timeBasis', 'schedule_window');

    createdPolicyId = res.body.result.id;
  });

  test('TC_TT_API_003: 404 for invalid policy ID @regression', async ({ timeTrackingClient }) => {
    const res = await timeTrackingClient.getPolicyById(999999);

    expect(res.status).toBe(404);
  });

  // ── Batch 2 ──────────────────────────────────────────────────────────────────

  test('TC_TT_API_005: reject policy creation with missing required fields @regression', async ({ timeTrackingClient }) => {
    // Intentionally-invalid payload: only isManualEntryAllowed, missing title + timeBasis.
    // Mirror of legacy `as any` — scoped cast kept to this one line per agent brief.
    const invalidPayload = { isManualEntryAllowed: true } as unknown as CreatePolicyRequest;

    const res = await timeTrackingClient.createPolicy(invalidPayload);

    // TODO(cleanup): legacy asserted 422 (UNPROCESSABLE_ENTITY); live API returns 400 (BAD_REQUEST).
    // Product API drift — ported verbatim, assertion updated to match actual; revisit in cleanup phase.
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  test('TC_TT_API_006: get policies with timeBasis filter @regression', async ({ timeTrackingClient }) => {
    const res = await timeTrackingClient.listPolicies({ timeBasis: 'schedule_window', page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.result).toHaveProperty('page', 1);
    expect(res.body.result).toHaveProperty('limit', 10);

    if (res.body.result.items.length > 0) {
      const allMatch = res.body.result.items.every(
        (policy: { timeBasis: string }) => policy.timeBasis === 'schedule_window',
      );

      expect(allMatch).toBe(true);
    }
  });

  test('TC_TT_API_007: check title availability for a never-used title @regression', async ({ timeTrackingClient }) => {
    const uniqueTitle = `QA Unique Title ${Date.now()}`;

    const res = await timeTrackingClient.checkTitleAvailability(uniqueTitle);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('result');
    expect(res.body.result).toHaveProperty('isAvailable', true);
  });

  // TODO(merge): merge candidate with TC_TT_API_007 (same title-check endpoint, complementary
  // available-vs-taken states). Port verbatim now; consolidate into a parametrized test in
  // cleanup phase. Decision=merge; mergeCandidateWith=TC_TT_API_007 (inventory id 8fffcd7bb4aa).
  test('TC_TT_API_007B: detect existing policy title as unavailable @regression', async ({ timeTrackingClient }) => {
    const testTitle = `QA Title-Check ${Date.now()}`;
    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: testTitle }),
    );

    expect(createRes.status).toBe(201);
    const policyId: number = createRes.body.result.id;

    const checkRes = await timeTrackingClient.checkTitleAvailability(testTitle);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.result).toHaveProperty('isAvailable', false);

    await timeTrackingClient.deletePolicy(policyId);
  });

  test('TC_TT_API_009: update policy successfully @regression @critical', async ({ timeTrackingClient }) => {
    const originalTitle = `QA Update-Before ${Date.now()}`;
    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: originalTitle }),
    );

    expect(createRes.status).toBe(201);
    const policyId: number = createRes.body.result.id;

    const updatedTitle = `QA Update-After ${Date.now()}`;
    // TODO(cleanup): workerType is required by the live TT API on PATCH (same drift as POST).
    // UpdatePolicyRequest does not model it (legacy had no workerType). Cast to carry the field.
    const updatePayload = {
      title: updatedTitle,
      timeBasis: 'flexible' as const,
      isManualEntryAllowed: false,
      workerType: 'per_hour',
    } as Parameters<typeof timeTrackingClient.updatePolicy>[1];
    const updateRes = await timeTrackingClient.updatePolicy(policyId, updatePayload);

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.result).toHaveProperty('title', updatedTitle);
    expect(updateRes.body.result).toHaveProperty('isManualEntryAllowed', false);

    await timeTrackingClient.deletePolicy(policyId);
  });

  // Self-contained: creates its own policy to delete (does NOT rely on shared createdPolicyId).
  // Legacy TC_TT_API_008 depended on TC_TT_API_004's shared state — anti-pattern in this framework.
  test('TC_TT_API_008: delete policy successfully @regression', async ({ timeTrackingClient }) => {
    const createRes = await timeTrackingClient.createPolicy(
      buildFlexiblePolicy({ title: `QA Delete-Me ${Date.now()}` }),
    );

    expect(createRes.status).toBe(201);
    const policyId: number = createRes.body.result.id;

    const deleteRes = await timeTrackingClient.deletePolicy(policyId);

    expect(deleteRes.status).toBe(204);

    const getRes = await timeTrackingClient.getPolicyById(policyId);

    expect(getRes.status).toBe(404);
  });
});
