// Ported from: tests/modules/time-tracking/api/verify/sessions-details/error-handling.spec.ts
// Inventory ids: TC_TT_SESSION_006, TC_TT_SESSION_007, TC_TT_SESSION_008, TC_TT_SESSION_009, TC_TT_SESSION_010

import { test, expect } from '@features/time-tracking/fixtures';
import { ensureNoActiveSession } from '@features/time-tracking/seeding';

// TODO(cleanup): TC_TT_SESSION_006 through TC_TT_SESSION_009 are four invalid-id boundary tests
//   that should be parametrized into a single data-driven loop in the cleanup phase
//   (id, expectedStatuses). Port verbatim now.

test.describe('Time Tracking API — Session Details: Error Handling', () => {

  // TODO(merge): TC_TT_SESSION_006 and TC_TT_SESSION_009 are merge candidates
  //   (both non-existent id → exact 404). Port verbatim now; consolidate in cleanup.
  test('TC_TT_SESSION_006: 404 for non-existent session id @smoke @critical', async ({ workerTimeTrackingClient }) => {
    const res = await workerTimeTrackingClient.getTimeSessionById(999999999);

    expect(res.status).toBe(404);
  });

  // TODO(merge): TC_TT_SESSION_007 and TC_TT_SESSION_008 are merge candidates
  //   (negative/zero edge-id pair). Port verbatim now; consolidate in cleanup.
  test('TC_TT_SESSION_007: 400 or 404 for negative session id @regression', async ({ workerTimeTrackingClient }) => {
    const res = await workerTimeTrackingClient.getTimeSessionById(-123);

    expect([400, 404]).toContain(res.status);
  });

  test('TC_TT_SESSION_008: 400 403 or 404 for zero session id @regression', async ({ workerTimeTrackingClient }) => {
    const res = await workerTimeTrackingClient.getTimeSessionById(0);

    expect([400, 403, 404]).toContain(res.status);
  });

  test('TC_TT_SESSION_009: 404 for MAX_SAFE_INTEGER session id @regression', async ({ workerTimeTrackingClient }) => {
    const res = await workerTimeTrackingClient.getTimeSessionById(Number.MAX_SAFE_INTEGER);

    expect(res.status).toBe(404);
  });

  test('TC_TT_SESSION_010: 404 for deleted session @regression', async ({
    workerTimeTrackingClient,
    sessionContractId,
  }) => {
    test.fixme(true, 'QA-443: session create returns 400 instead of 201 — QA-450');
    // TODO(api-preconditions): requires a worker per_hour PAYG contract with an assigned
    //   policy on sandbox (fixture creates the policy transiently). Self-skip when none.
    if (sessionContractId === 0) {
      // SKIP(api-preconditions): no worker per_hour contract on sandbox
      test.skip(true, 'No worker per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    await ensureNoActiveSession(workerTimeTrackingClient, sessionContractId);

    const createRes = await workerTimeTrackingClient.createTimeSession({
      title: `QA Delete Test Session ${Date.now()}`,
      contractId: sessionContractId,
    });

    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.result.id as number;

    await workerTimeTrackingClient.endTimeSession(sessionId);

    const deleteRes = await workerTimeTrackingClient.deleteTimeSession(sessionId);

    expect([200, 204]).toContain(deleteRes.status);

    const res = await workerTimeTrackingClient.getTimeSessionById(sessionId);

    expect(res.status).toBe(404);
  });

});
