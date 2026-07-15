// Ported from: tests/modules/time-tracking/api/verify/policy-contract-matrix.spec.ts (lines 155–262)
// Inventory ids: MATRIX-001, MATRIX-002, MATRIX-003

import { test, expect } from '@features/time-tracking/fixtures';
import { buildPolicy } from '@features/time-tracking/builders/policy.builder';

test.describe('Time Tracking API — Policy/Contract Matrix (PAYG)', () => {

  // TODO(cleanup): workerType is a post-legacy required TT field; set to match the contract
  //   worker-type (per_hour). Verify per-cell value with product team.
  // TODO(cleanup): the full 5×3 matrix (5 contract-types × 3 timeBasis) should be
  //   parametrized into one data-driven spec in the cleanup phase — port explicit cells
  //   verbatim now, do NOT parametrize.

  test('MATRIX-001: PAYG + Flexible @smoke @critical', async ({
    timeTrackingClient,
    perHourContractIds,
  }) => {
    if (perHourContractIds.length < 1) {
      // TODO(api-preconditions): no Ongoing per_hour contract on sandbox — seed one in cleanup phase.
      // SKIP(api-preconditions): no Ongoing per_hour contract on sandbox
      test.skip(true, 'No Ongoing per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const contractId = perHourContractIds[0];
    const createRes = await timeTrackingClient.createPolicy(buildPolicy({
      title:      `PAYG-Flexible ${Date.now()}`,
      timeBasis:  'flexible',
      workerType: 'per_hour',
      days:       [1, 2, 3, 4, 5].map((day) => ({ day, totalMinutes: 480, isFullDay: false })),
      overtime:   { type: 'weekly', dailyWorkingHours: 8, threshold: 5, cap: 10, multiplier: 1.5 },
    }));

    expect(createRes.status).toBe(201);
    const policyId = createRes.body.result.id;

    try {
      const assignRes = await timeTrackingClient.modifyPolicyWorkers(policyId, [contractId], []);

      expect([200, 204]).toContain(assignRes.status);

      const res = await timeTrackingClient.getPolicyByContract(contractId);

      expect(res.status).toBe(200);
      expect(res.body.result.id).toBe(policyId);
      expect(res.body.result.timeBasis).toBe('flexible');
    } finally {
      await timeTrackingClient.deletePolicy(policyId);
    }
  });

  // TODO(merge): MATRIX-002 is a merge candidate with MATRIX-001 (both PAYG, differ only in
  //   timeBasis + overtime type). Port verbatim now; consolidate in the cleanup phase.
  test('MATRIX-002: PAYG + Schedule Window @critical', async ({
    timeTrackingClient,
    perHourContractIds,
  }) => {
    if (perHourContractIds.length < 1) {
      // TODO(api-preconditions): no Ongoing per_hour contract on sandbox — seed one in cleanup phase.
      // SKIP(api-preconditions): no Ongoing per_hour contract on sandbox
      test.skip(true, 'No Ongoing per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const contractId = perHourContractIds[0];
    const createRes = await timeTrackingClient.createPolicy(buildPolicy({
      title:      `PAYG-ScheduleWindow ${Date.now()}`,
      timeBasis:  'schedule_window',
      workerType: 'per_hour',
      days:       [1, 2, 3, 4, 5].map((day) => ({ day, startTime: '09:00', endTime: '17:00', isFullDay: false })),
      overtime:   { type: 'daily', dailyWorkingHours: 8, threshold: 8, cap: 10, multiplier: 1.5 },
    }));

    expect(createRes.status).toBe(201);
    const policyId = createRes.body.result.id;

    try {
      const assignRes = await timeTrackingClient.modifyPolicyWorkers(policyId, [contractId], []);

      expect([200, 204]).toContain(assignRes.status);

      const res = await timeTrackingClient.getPolicyByContract(contractId);

      expect(res.status).toBe(200);
      expect(res.body.result.timeBasis).toBe('schedule_window');
      expect(res.body.result.days).toBeDefined();
      expect(res.body.result.days.length).toBeGreaterThan(0);
    } finally {
      await timeTrackingClient.deletePolicy(policyId);
    }
  });

  // TODO(merge): MATRIX-003 is a merge candidate with MATRIX-001 (both PAYG, differ only in
  //   timeBasis + isEditingAllowed). Port verbatim now; consolidate in the cleanup phase.
  test('MATRIX-003: PAYG + Total Hours @regression @critical', async ({
    timeTrackingClient,
    perHourContractIds,
  }) => {
    if (perHourContractIds.length < 1) {
      // TODO(api-preconditions): no Ongoing per_hour contract on sandbox — seed one in cleanup phase.
      // SKIP(api-preconditions): no Ongoing per_hour contract on sandbox
      test.skip(true, 'No Ongoing per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const contractId = perHourContractIds[0];
    const createRes = await timeTrackingClient.createPolicy(buildPolicy({
      title:            `PAYG-TotalHours ${Date.now()}`,
      timeBasis:        'total_hours',
      workerType:       'per_hour',
      days:             [1, 2, 3, 4, 5].map((day) => ({ day, totalMinutes: 480, isFullDay: false })),
      overtime:         { type: 'weekly', dailyWorkingHours: 8, threshold: 5, cap: 10, multiplier: 1.5 },
      isEditingAllowed: false,
    }));

    expect(createRes.status).toBe(201);
    const policyId = createRes.body.result.id;

    try {
      const assignRes = await timeTrackingClient.modifyPolicyWorkers(policyId, [contractId], []);

      expect([200, 204]).toContain(assignRes.status);

      const res = await timeTrackingClient.getPolicyByContract(contractId);

      expect(res.status).toBe(200);
      expect(res.body.result.timeBasis).toBe('total_hours');
      expect(res.body.result.isEditingAllowed).toBe(false);
    } finally {
      await timeTrackingClient.deletePolicy(policyId);
    }
  });

  test('MATRIX-004: PAYG + No Overtime @regression', async ({
    timeTrackingClient,
    perHourContractIds,
  }) => {
    if (perHourContractIds.length < 1) {
      // TODO(api-preconditions): no Ongoing per_hour contract on sandbox — seed one in cleanup phase.
      // SKIP(api-preconditions): no Ongoing per_hour contract on sandbox
      test.skip(true, 'No Ongoing per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const contractId = perHourContractIds[0];
    // overtime: undefined overrides the buildPolicy default (spread makes the key undefined,
    // which JSON.stringify omits) — the API receives no overtime field and stores null.
    const createRes = await timeTrackingClient.createPolicy(buildPolicy({
      title:      `PAYG-NoOvertime ${Date.now()}`,
      timeBasis:  'flexible',
      workerType: 'per_hour',
      days:       [1, 2, 3, 4, 5].map((day) => ({ day, totalMinutes: 480, isFullDay: false })),
      overtime:   undefined,
    }));

    expect(createRes.status).toBe(201);
    const policyId = createRes.body.result.id;

    try {
      const assignRes = await timeTrackingClient.modifyPolicyWorkers(policyId, [contractId], []);

      expect([200, 204]).toContain(assignRes.status);

      const res = await timeTrackingClient.getPolicyByContract(contractId);

      expect(res.status).toBe(200);
      expect(res.body.result.overtime).toBeNull();
    } finally {
      await timeTrackingClient.deletePolicy(policyId);
    }
  });

});

test.describe('Time Tracking API — Policy/Contract Matrix (multi + blocked)', () => {

  test('MATRIX-017: Multiple PAYG contracts on one per_hour policy @regression', async ({
    timeTrackingClient,
    perHourContractIds,
  }) => {
    if (perHourContractIds.length < 2) {
      // TODO(api-preconditions): need >=2 Ongoing per_hour contracts on sandbox — seed in cleanup phase.
      // SKIP(api-preconditions): need >=2 Ongoing per_hour contracts on sandbox
      test.skip(true, 'Need >=2 Ongoing per_hour contracts on sandbox — TODO(api-preconditions)');
      return;
    }

    const createRes = await timeTrackingClient.createPolicy(buildPolicy({
      title:      `MultiPAYG-Flexible ${Date.now()}`,
      timeBasis:  'flexible',
      workerType: 'per_hour',
      days:       [1, 2, 3, 4, 5].map((day) => ({ day, totalMinutes: 480, isFullDay: false })),
      overtime:   { type: 'weekly', dailyWorkingHours: 8, threshold: 5, cap: 10, multiplier: 1.5 },
    }));

    expect(createRes.status).toBe(201);
    const policyId = createRes.body.result.id;

    try {
      const contractsToAssign = perHourContractIds.slice(0, 3);
      const assignRes = await timeTrackingClient.modifyPolicyWorkers(policyId, contractsToAssign, []);

      expect([200, 204]).toContain(assignRes.status);

      for (const contractId of contractsToAssign) {
        const res = await timeTrackingClient.getPolicyByContract(contractId);

        expect(res.status).toBe(200);
        expect(res.body.result.id).toBe(policyId);
      }
    } finally {
      await timeTrackingClient.deletePolicy(policyId);
    }
  });

  test('MATRIX-018: Reassign contract from one policy to another @regression', async ({
    timeTrackingClient,
    perHourContractIds,
  }) => {
    if (perHourContractIds.length < 1) {
      // TODO(api-preconditions): no Ongoing per_hour contract on sandbox — seed one in cleanup phase.
      // SKIP(api-preconditions): no Ongoing per_hour contract on sandbox
      test.skip(true, 'No Ongoing per_hour contract on sandbox — TODO(api-preconditions)');
      return;
    }

    const contractId = perHourContractIds[0];

    const create1Res = await timeTrackingClient.createPolicy(buildPolicy({
      title:      `Reassign-Policy1 ${Date.now()}`,
      timeBasis:  'flexible',
      workerType: 'per_hour',
      days:       [1, 2, 3, 4, 5].map((day) => ({ day, totalMinutes: 480, isFullDay: false })),
      overtime:   { type: 'weekly', dailyWorkingHours: 8, threshold: 5, cap: 10, multiplier: 1.5 },
    }));

    expect(create1Res.status).toBe(201);
    const policy1Id = create1Res.body.result.id;

    const create2Res = await timeTrackingClient.createPolicy(buildPolicy({
      title:      `Reassign-Policy2 ${Date.now()}`,
      timeBasis:  'schedule_window',
      workerType: 'per_hour',
      days:       [1, 2, 3, 4, 5].map((day) => ({ day, startTime: '09:00', endTime: '17:00', isFullDay: false })),
      overtime:   undefined,
    }));

    expect(create2Res.status).toBe(201);
    const policy2Id = create2Res.body.result.id;

    try {
      const assign1Res = await timeTrackingClient.modifyPolicyWorkers(policy1Id, [contractId], []);

      expect([200, 204]).toContain(assign1Res.status);

      const verify1Res = await timeTrackingClient.getPolicyByContract(contractId);

      expect(verify1Res.status).toBe(200);
      expect(verify1Res.body.result.id).toBe(policy1Id);

      const removeRes = await timeTrackingClient.modifyPolicyWorkers(policy1Id, [], [contractId]);

      expect([200, 204]).toContain(removeRes.status);

      const assign2Res = await timeTrackingClient.modifyPolicyWorkers(policy2Id, [contractId], []);

      expect([200, 204]).toContain(assign2Res.status);

      const verify2Res = await timeTrackingClient.getPolicyByContract(contractId);

      expect(verify2Res.status).toBe(200);
      expect(verify2Res.body.result.id).toBe(policy2Id);
      expect(verify2Res.body.result.timeBasis).toBe('schedule_window');
    } finally {
      await timeTrackingClient.deletePolicy(policy1Id);
      await timeTrackingClient.deletePolicy(policy2Id);
    }
  });

  // BLOCKED: requires minting an EOR contract on-demand (KYB + 2 signatures + provider sign),
  // which takes ~2-3 min and exceeds the per-test timeout. Not portable against the current
  // sandbox contract pool. Do NOT attempt the mint. Tracked as inventory blocked (MATRIX-005).
  // TODO(api-preconditions): unblock by seeding a full contract pool (one Ongoing contract per
  // worker-type) in the cleanup phase.
  // FIXME(blocked): EOR mint (~2-3 min) exceeds per-test timeout; no Ongoing EOR in sandbox pool
  test.fixme('MATRIX-005: all contract types × all policy time bases @critical @blocked', async () => {
    // intentionally empty — blocked, never executes
  });

});
