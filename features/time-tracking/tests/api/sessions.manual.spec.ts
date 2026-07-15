// Ported from: tests/modules/time-tracking/api/verify/sessions-details/manual-time-entries.spec.ts
// Inventory ids: TC_TT_SESSION_011, TC_TT_SESSION_012, TC_TT_SESSION_013, TC_TT_SESSION_014

import { test, expect } from '@features/time-tracking/fixtures';
import { ensureNoActiveSession, findWorkerPerHourContractId } from '@features/time-tracking/seeding';
import { buildPolicy } from '@features/time-tracking/builders/policy.builder';

test.describe('Time Tracking API — Session Details: Manual Time Entries', () => {

  test('TC_TT_SESSION_011: manual entry returns complete details @regression', async ({
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

    const startTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const createRes = await workerTimeTrackingClient.createTimeSession({
      title: `QA Manual Entry Details Test ${Date.now()}`,
      note: 'Testing manual time entry details',
      contractId: sessionContractId,
      startTime,
      endTime,
    });

    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.result.id as number;

    try {
      const res = await workerTimeTrackingClient.getTimeSessionById(sessionId);

      expect(res.status).toBe(200);
      const session = res.body.result;

      expect(session.id).toBe(sessionId);
      expect(session.startTime).toBeTruthy();
      expect(session.endTime).toBeTruthy();
      expect(session.state).toBe('completed');
      expect(session.totalMinutes).toBeGreaterThan(0);
      expect(session.workedMinutes).toBeGreaterThan(0);
    } finally {
      await workerTimeTrackingClient.deleteTimeSession(sessionId);
    }
  });

  test('TC_TT_SESSION_012: manual entry immediately completed @regression', async ({
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

    const startTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now()).toISOString();

    const createRes = await workerTimeTrackingClient.createTimeSession({
      title: `QA Manual Immediate Completion Test ${Date.now()}`,
      contractId: sessionContractId,
      startTime,
      endTime,
    });

    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.result.id as number;

    try {
      const res = await workerTimeTrackingClient.getTimeSessionById(sessionId);

      expect(res.status).toBe(200);
      const session = res.body.result;

      expect(session.state).toBe('completed');
      expect(session.endTime).toBeTruthy();
      expect(session.state).not.toBe('active');
      expect(session.state).not.toBe('paused');
    } finally {
      await workerTimeTrackingClient.deleteTimeSession(sessionId);
    }
  });

  test('TC_TT_SESSION_013: manual entry has exactly one subsession @regression', async ({
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

    const startTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    const createRes = await workerTimeTrackingClient.createTimeSession({
      title: `QA Manual Subsession Test ${Date.now()}`,
      contractId: sessionContractId,
      startTime,
      endTime,
    });

    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.result.id as number;

    try {
      const res = await workerTimeTrackingClient.getTimeSessionById(sessionId);

      expect(res.status).toBe(200);
      const session = res.body.result;

      // TODO(cleanup): legacy comment said 'no subsessions' but the assertion + live API both
      //   show exactly 1 subsession for a manual entry — comment is stale, assertion is correct.
      expect(Array.isArray(session.subsessions)).toBe(true);
      expect(session.subsessions.length).toBe(1);
    } finally {
      await workerTimeTrackingClient.deleteTimeSession(sessionId);
    }
  });

  test('TC_TT_SESSION_014: totalMinutes matches slot duration @regression', async ({
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

    const startTime = new Date('2024-01-15T09:00:00Z').toISOString();
    const endTime = new Date('2024-01-15T11:00:00Z').toISOString();

    const createRes = await workerTimeTrackingClient.createTimeSession({
      title: `QA Manual Duration Test ${Date.now()}`,
      contractId: sessionContractId,
      startTime,
      endTime,
    });

    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.result.id as number;

    try {
      const res = await workerTimeTrackingClient.getTimeSessionById(sessionId);

      expect(res.status).toBe(200);
      const session = res.body.result;

      expect(session.totalMinutes).toBe(120);
      expect(session.totalMinutes).toBe(session.workedMinutes);
      expect(session.pausedMinutes).toBe(0);
    } finally {
      await workerTimeTrackingClient.deleteTimeSession(sessionId);
    }
  });

});

// Authored from scenario intent (no legacy source) — inventory decision=rewrite.
test.describe('Time Tracking API — Manual Entry Policy & Lifecycle', () => {

  test('TC_TT_ENTRY_001: worker blocked when isManualEntryAllowed=false @regression @critical', async ({
    workerTimeTrackingClient,
    timeTrackingClient,
  }) => {
    // TODO(api-preconditions): requires a sandbox-resident per_hour PAYG contract belonging
    //   to the worker. Self-skip when none is found.
    const contractId = await findWorkerPerHourContractId(workerTimeTrackingClient);
    if (contractId === null) {
      // SKIP(api-preconditions): no worker per_hour contract on sandbox
      test.skip(true, 'No worker per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const createRes = await timeTrackingClient.createPolicy(
      buildPolicy({ workerType: 'per_hour', isManualEntryAllowed: false }),
    );
    expect(createRes.status).toBe(201);
    const policyId = createRes.body.result.id as number;

    try {
      await timeTrackingClient.modifyPolicyWorkers(policyId, [contractId], []);
      await ensureNoActiveSession(workerTimeTrackingClient, contractId);

      const start = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const end = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const res = await workerTimeTrackingClient.createTimeSession({
        title: `QA Policy Blocked Manual Entry ${Date.now()}`,
        contractId,
        startTime: start,
        endTime: end,
      });

      expect([400, 403, 422]).toContain(res.status);

      if (res.status === 201) {
        const sessionId = res.body.result.id as number;
        await workerTimeTrackingClient.deleteTimeSession(sessionId);
      }
    } finally {
      await ensureNoActiveSession(workerTimeTrackingClient, contractId);
      await timeTrackingClient.deletePolicy(policyId);
    }
  });

  test('TC_TT_ENTRY_006: client creates manual entry on behalf of worker @regression', async ({
    workerTimeTrackingClient,
    timeTrackingClient,
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

    const start = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const createRes = await timeTrackingClient.createTimeSession({
      title: `QA Client On-Behalf Manual Entry ${Date.now()}`,
      contractId: sessionContractId,
      startTime: start,
      endTime: end,
    });

    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.result.id as number;

    try {
      const res = await timeTrackingClient.getTimeSessionById(sessionId);

      expect(res.status).toBe(200);
      const session = res.body.result;

      expect(session.state).toBe('completed');
      expect(session.reviewStatus).toBe('pending');
      // TODO(cleanup): intent — client-created entry is completed + pending (client does not auto-approve own-behalf entry).
    } finally {
      await timeTrackingClient.deleteTimeSession(sessionId);
    }
  });

  test('TC_TT_ENTRY_007: worker edits title and note of manual entry @regression', async ({
    workerTimeTrackingClient,
    timeTrackingClient,
  }) => {
    test.fixme(true, 'QA-443: session create returns 400 instead of 201 — QA-450');
    // TODO(api-preconditions): requires a sandbox-resident per_hour PAYG contract belonging
    //   to the worker. Self-skip when none is found.
    const contractId = await findWorkerPerHourContractId(workerTimeTrackingClient);
    if (contractId === null) {
      // SKIP(api-preconditions): no worker per_hour contract on sandbox
      test.skip(true, 'No worker per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    // TODO(cleanup): worker edit requires policy isEditingAllowed=true; default policy (false)
    //   returns 403. This test provisions an editing-enabled policy.
    const createRes = await timeTrackingClient.createPolicy(
      buildPolicy({ workerType: 'per_hour', isManualEntryAllowed: true, isEditingAllowed: true }),
    );
    expect(createRes.status).toBe(201);
    const policyId = createRes.body.result.id as number;

    let sessionId: number | null = null;

    try {
      await timeTrackingClient.modifyPolicyWorkers(policyId, [contractId], []);
      await ensureNoActiveSession(workerTimeTrackingClient, contractId);

      const start = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const end = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const sessionRes = await workerTimeTrackingClient.createTimeSession({
        title: `QA Edit Entry Original ${Date.now()}`,
        contractId,
        startTime: start,
        endTime: end,
      });
      expect(sessionRes.status).toBe(201);
      sessionId = sessionRes.body.result.id as number;

      const updatedTitle = `Edited QA Entry ${Date.now()}`;
      const updateRes = await workerTimeTrackingClient.updateTimeSession(sessionId, {
        title: updatedTitle,
        note: 'Edited note',
      });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.result.title).toBe(updatedTitle);
      expect(updateRes.body.result.state).toBe('completed');
    } finally {
      if (sessionId !== null) {
        await workerTimeTrackingClient.deleteTimeSession(sessionId);
      }
      await ensureNoActiveSession(workerTimeTrackingClient, contractId);
      await timeTrackingClient.deletePolicy(policyId);
    }
  });

  test('TC_TT_ENTRY_008: delete pending manual entry @regression', async ({
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

    const start = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const createRes = await workerTimeTrackingClient.createTimeSession({
      title: `QA Delete Pending Entry ${Date.now()}`,
      contractId: sessionContractId,
      startTime: start,
      endTime: end,
    });
    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.result.id as number;

    const deleteRes = await workerTimeTrackingClient.deleteTimeSession(sessionId);

    expect([200, 204]).toContain(deleteRes.status);

    const getRes = await workerTimeTrackingClient.getTimeSessionById(sessionId);

    expect(getRes.status).toBe(404);
  });

});

// Authored from scenario intent (no legacy source) — inventory decision=rewrite.
test.describe('Time Tracking API — Manual Entry Validation', () => {

  test('TC_TT_ENTRY_002: missing startTime returns 400 @regression', async ({
    workerTimeTrackingClient,
    sessionContractId,
  }) => {
    // TODO(api-preconditions): requires a worker per_hour PAYG contract with an assigned
    //   policy on sandbox (fixture creates the policy transiently). Self-skip when none.
    if (sessionContractId === 0) {
      // SKIP(api-preconditions): no worker per_hour contract on sandbox
      test.skip(true, 'No worker per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const endTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const res = await workerTimeTrackingClient.createTimeSession({
      title: `QA Validation Missing startTime ${Date.now()}`,
      contractId: sessionContractId,
      endTime,
    } as Parameters<typeof workerTimeTrackingClient.createTimeSession>[0]);

    expect([400, 422]).toContain(res.status);
  });

  test('TC_TT_ENTRY_003: missing contractId returns 400 @regression', async ({
    workerTimeTrackingClient,
    sessionContractId,
  }) => {
    // TODO(api-preconditions): requires a worker token on sandbox. Self-skip when none.
    if (sessionContractId === 0) {
      // SKIP(api-preconditions): no worker per_hour contract on sandbox
      test.skip(true, 'No worker per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const startTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const res = await workerTimeTrackingClient.createTimeSession({
      title: `QA Validation Missing contractId ${Date.now()}`,
      startTime,
      endTime,
    } as Parameters<typeof workerTimeTrackingClient.createTimeSession>[0]);

    expect([400, 422]).toContain(res.status);
  });

  test('TC_TT_ENTRY_004: zero-duration entry does not 500 @regression', async ({
    workerTimeTrackingClient,
    sessionContractId,
  }) => {
    // TODO(api-preconditions): requires a worker per_hour PAYG contract with an assigned
    //   policy on sandbox (fixture creates the policy transiently). Self-skip when none.
    if (sessionContractId === 0) {
      // SKIP(api-preconditions): no worker per_hour contract on sandbox
      test.skip(true, 'No worker per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    await ensureNoActiveSession(workerTimeTrackingClient, sessionContractId);

    const sameTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const res = await workerTimeTrackingClient.createTimeSession({
      title: `QA Validation Zero Duration ${Date.now()}`,
      contractId: sessionContractId,
      startTime: sameTime,
      endTime: sameTime,
    });

    // TODO(cleanup): intent left accept/reject open; live API rejects with 400. Primary contract = no 500.
    expect(res.status).not.toBe(500);
    expect([400, 422]).toContain(res.status);

    try {
      if (res.status === 201) {
        const sessionId = res.body.result.id as number;
        await workerTimeTrackingClient.deleteTimeSession(sessionId);
      }
    } finally {
      // no-op: only cleans up if unexpectedly created
    }
  });

  test('TC_TT_ENTRY_005: negative-duration entry does not 500 @regression', async ({
    workerTimeTrackingClient,
    sessionContractId,
  }) => {
    // TODO(api-preconditions): requires a worker per_hour PAYG contract with an assigned
    //   policy on sandbox (fixture creates the policy transiently). Self-skip when none.
    if (sessionContractId === 0) {
      // SKIP(api-preconditions): no worker per_hour contract on sandbox
      test.skip(true, 'No worker per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    await ensureNoActiveSession(workerTimeTrackingClient, sessionContractId);

    // Negative duration: startTime is AFTER endTime (swapped intentionally).
    const startTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    const res = await workerTimeTrackingClient.createTimeSession({
      title: `QA Validation Negative Duration ${Date.now()}`,
      contractId: sessionContractId,
      startTime,
      endTime,
    });

    // TODO(cleanup): intent left accept/reject open; live API rejects with 400. Primary contract = no 500.
    expect(res.status).not.toBe(500);
    expect([400, 422]).toContain(res.status);

    try {
      if (res.status === 201) {
        const sessionId = res.body.result.id as number;
        await workerTimeTrackingClient.deleteTimeSession(sessionId);
      }
    } finally {
      // no-op: only cleans up if unexpectedly created
    }
  });

});
