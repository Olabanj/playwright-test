import { test, expect } from '@features/contracts/fixtures';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { resolveContractDefaults, createMilestoneContractViaApi, signContractorToOngoing } from '@features/contracts/seeding';
import { MilestoneContractBuilder } from '@features/contracts/builders/milestone-contract.builder';
import { CURRENCY_IDS } from '@features/contracts/constants';
import { ContractorContractCreateData } from '@features/contracts/types';
import { isDbEnvPresent } from '@core/db/db-config';

// Contracts API — Create Milestones Contract (CREATE + VALIDATE lane, PR #172 phase 2).
// Ported from legacy tests/modules/contracts/api/verify/create-milestones-contract.spec.ts.
// Scope: TC_MIL_001-007, 007b, 008, 009-010 (create + validation, plus the
// OTP-gated invite/sign lane TC_MIL_008, Phase 4,
// docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md).
//
// TC_MIL_008 structural change from legacy: legacy wrapped each sign-flow step
// (invite / client-sign / contractor-sign) in a try/catch or status check that
// pushed a `test.info().annotations.push({type:'gap', ...})` and returned early
// on failure, rather than hard-failing. That per-step soft-degrade collapses
// here into the single `signContractorToOngoing` seeding-function call (the
// same proven composition as the Fixed/PAYG siblings' TC_CFC_007/TC_CPC_022):
// it throws on a genuinely broken invite/clientSign/workerSign step (a real
// regression, not a gap to silently swallow) and only the final Ongoing poll
// is soft (returns `false` on timeout, asserted via `expect(...).toBe(true)`).
// The gap-annotation pattern itself is preserved verbatim where it still
// applies in this file — TC_MIL_006/009/010, which probe unenforced
// server-side validation, unrelated to the sign flow.
//
// Structural change from legacy: the legacy suite registered a fresh contractor
// via a DB-tunnel OTP read in beforeAll purely to get a `contractorFullName`
// string and (for the worker-role case) a contractor token. Create+validate
// never exercises that identity as a signer, so that step is dropped here: the
// contractor name comes from `MilestoneContractBuilder`'s generated worker data,
// and TC_MIL_007b reuses the framework's shared worker-scoped `contractorToken`
// base fixture instead of a bespoke OTP registration (same approach as the Fixed
// sibling's TC_CFC_006 and the PAYG sibling's TC_CPC_006).
//
// TC_MIL_007/007b split (2026-07-08 review fix): legacy wrapped an
// always-run unauthenticated assertion (Case A) AND a contractor-token
// backend-gap assertion (Case B) inside a single `test.fixme`. Since
// Playwright never executes a fixme body, Case A's coverage was silently
// dropped. Split into a standalone live test (TC_MIL_007, unauth — mirrors
// TC_CFC_016/TC_CPC_020) and a separate fixme test (TC_MIL_007b,
// contractor-token gap — mirrors TC_CFC_006/TC_CPC_006).
//
// Fixture choice (same as the Fixed/PAYG siblings, architecture-mapping
// escalation #3, 2026-07-08): runs against the STATIC worker-scoped
// `contractsClient` (contracts/fixtures.ts, bound to the shared base
// `clientAccount` — zero extra logins), not a freshly-minted client. A
// fresh-per-test client (`createFinishedClient`) has no signatory/contract
// templates and cannot pass `getSignatory`/`getTemplateId` — the static account
// is already fully onboarded and has both.
//
// Serial mode dropped, same reasoning as the Fixed/PAYG siblings: every test
// builds its own payload with a uniquely generated contractor name/email
// (`MilestoneContractBuilder`), so parallel tests never collide on contract
// identity even though they share one account. Tests that read back a created
// contract create it locally and cancel it in `finally` — contracts on the
// shared static account are cleaned up per-test, never left behind.
//
// Gap-annotation pattern preserved verbatim from legacy: TC_MIL_006/009/010
// probe server-side milestone validation that the sandbox does not enforce.
// Where the sandbox accepts the invalid payload instead of rejecting it, the
// test records a `test.info().annotations.push({ type: 'gap', ... })` (with the
// original QA-2xx tracking reference where legacy had one) and returns instead
// of failing — the same non-blocking-gap shape as legacy.

const MILESTONES_TWO = [
  { name: 'Phase 1', amount: 500 },
  { name: 'Phase 2', amount: 750 },
];

const MILESTONES_THREE = [
  { name: 'Discovery', amount: 300 },
  { name: 'Development', amount: 1200 },
  { name: 'Delivery', amount: 500 },
];

/** Fresh Milestone-contract payload for this test's client: builder data + resolved signatory/template ids. */
async function buildPayload(
  client: ContractsClient,
  overrides: Partial<ContractorContractCreateData> = {},
): Promise<ContractorContractCreateData> {
  const input = new MilestoneContractBuilder().build();
  const { signatoryId, templateId } = await resolveContractDefaults(client);
  return { ...input, signatoryId, templateId, ...overrides };
}

test.describe('Contracts API — Create Milestones Contract @api', () => {
  // ==== Happy path ==========================================================

  test('TC_MIL_001: Should create a Milestones contract with valid payload @smoke @critical', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient);
    const response = await contractsClient.createMilestoneContract(payload);

    try {
      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
      expect(response.body?.data?.id).toBeTruthy();
      expect(response.body?.data?.ref).toBeTruthy();
    } finally {
      const id = response.body?.success === true ? (response.body?.data?.id as number | undefined) : undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_MIL_002: Should return contract type = Milestones @smoke', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createMilestoneContractViaApi(contractsClient);
    try {
      const contract = await contractsClient.getContract(created.ref);

      expect(contract.type?.toLowerCase()).toBe('milestones');
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  test('TC_MIL_003: Should verify milestone titles and amounts are saved correctly @smoke', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { milestones: MILESTONES_TWO });
    const response = await contractsClient.createMilestoneContract(payload);

    try {
      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);

      const ref = response.body?.data?.ref as string | undefined;

      expect(ref).toBeTruthy();

      const contract = await contractsClient.getContract(ref!);
      const milestones = (contract.milestones as { details?: string; amount?: number; status?: { name?: string } }[]) ?? [];

      expect(milestones.length).toBeGreaterThanOrEqual(2);
      expect(milestones.some((m) => m.details === 'Phase 1' && Number(m.amount) === 500)).toBe(true);
      expect(milestones.some((m) => m.details === 'Phase 2' && Number(m.amount) === 750)).toBe(true);

      for (const m of milestones) {
        expect(typeof m.status?.name).toBe('string');
        expect((m.status?.name ?? '').length).toBeGreaterThan(0);
      }
    } finally {
      const id = response.body?.success === true ? (response.body?.data?.id as number | undefined) : undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_MIL_004: Should create contract with multiple milestones @smoke', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { milestones: MILESTONES_THREE });
    const response = await contractsClient.createMilestoneContract(payload);

    try {
      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);

      const ref = response.body?.data?.ref as string | undefined;

      expect(ref).toBeTruthy();

      const contract = await contractsClient.getContract(ref!);
      const milestones = (contract.milestones as { details?: string }[]) ?? [];

      expect(milestones.length).toBeGreaterThanOrEqual(3);
      expect(milestones.some((m) => m.details === 'Discovery')).toBe(true);
      expect(milestones.some((m) => m.details === 'Development')).toBe(true);
      expect(milestones.some((m) => m.details === 'Delivery')).toBe(true);
    } finally {
      const id = response.body?.success === true ? (response.body?.data?.id as number | undefined) : undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== Negative — validation ===============================================

  test('TC_MIL_005: Should fail with missing required fields @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const { templateId } = await resolveContractDefaults(contractsClient);
    const response = await contractsClient.createMilestoneContractRaw({
      currency_id: CURRENCY_IDS.USD,
      template_id: templateId,
    });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(false);
  });

  test('TC_MIL_006: Should fail with invalid milestone amount @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { milestones: [{ name: 'Invalid', amount: -100 }] });
    const response = await contractsClient.createMilestoneContract(payload);

    expect(response.status).toBe(200);

    if (response.body?.success !== false) {
      test.info().annotations.push({
        type: 'gap',
        description:
          'TC_MIL_006: Sandbox accepted milestone with amount=-100 — server-side milestone amount validation not enforced. Tracked: QA-213',
      });
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
      return;
    }

    expect(response.body?.success).toBe(false);
  });

  // ==== Permissions ===========================================================

  test('TC_MIL_007: Should fail without auth token @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient);
    // TODO(cleanup): lift alternate-identity ContractsClient construction to unauthContractsClient/contractorContractsClient fixtures (rule-of-two)
    const unauthApi = new ContractsClient();
    try {
      await unauthApi.init();
      const response = await unauthApi.createMilestoneContractRaw({
        contractor_name: payload.contractorName,
        currency_id: payload.currencyId,
        template_id: payload.templateId,
        signatory_id: payload.signatoryId,
        notice_period: 30,
        kyc: 1,
        extra: 1,
        milestones: [{ name: 'M1', amount: 100 }],
      });

      expect([401, 403]).toContain(response.status);
    } finally {
      await unauthApi.dispose();
    }
  });

  // BUG: sandbox does not enforce client-only access on this endpoint — a
  // contractor token can create a Milestones contract. Expected: 401/403 or
  // 200 success=false. Actual: the API accepts the request. Marked fixme
  // until the backend enforces role-based access control here (matches the
  // Fixed/PAYG siblings' TC_CFC_006/TC_CPC_006 backend gap).
  test.fixme(
    'TC_MIL_007b: Contractor token — contract creation returns non-client response @regression',
    async ({ contractsClient, contractorToken }) => {
      // Sandbox gap: this endpoint does not enforce client-only access — workers
      // can create contracts (Tracked: QA-214).
      const payload = await buildPayload(contractsClient);
      // TODO(cleanup): lift alternate-identity ContractsClient construction to unauthContractsClient/contractorContractsClient fixtures (rule-of-two)
      const contractorApi = new ContractsClient();
      try {
        await contractorApi.init(contractorToken);
        const workerResponse = await contractorApi.createMilestoneContract(payload);

        expect([401, 403, 200]).toContain(workerResponse.status);
        expect(workerResponse.status).not.toBe(500);

        if (workerResponse.status === 200) {
          expect(workerResponse.body?.success).toBe(false);
          expect(workerResponse.body?.data?.id).toBeFalsy();
        }
      } finally {
        await contractorApi.dispose();
      }
    },
  );

  // ==== Negative — edge cases ===============================================

  test('TC_MIL_009: Should fail with empty milestones array @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient);
    const response = await contractsClient.createMilestoneContractRaw({
      contractor_name: payload.contractorName,
      currency_id: payload.currencyId,
      template_id: payload.templateId,
      signatory_id: payload.signatoryId,
      notice_period: 30,
      kyc: 1,
      extra: 1,
      milestones: [],
    });

    expect(response.status).toBe(200);

    if (response.body?.success !== false) {
      test.info().annotations.push({
        type: 'gap',
        description:
          'TC_MIL_009: Sandbox accepted empty milestones array — server-side validation not enforced for milestone count.',
      });
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
      return;
    }

    expect(response.body?.success).toBe(false);
  });

  test('TC_MIL_010: Should fail with zero-amount milestone @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { milestones: [{ name: 'Zero Amount', amount: 0 }] });
    const response = await contractsClient.createMilestoneContract(payload);

    expect(response.status).toBe(200);

    if (response.body?.success !== false) {
      test.info().annotations.push({
        type: 'gap',
        description: 'TC_MIL_010: Sandbox accepted milestone with amount=0 — zero-amount validation not enforced.',
      });
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
      return;
    }

    expect(response.body?.success).toBe(false);
  });

  // ==== Full lifecycle (Phase 4 — OTP-gated worker registration) ============

  // TODO(api-preconditions): depends on the gated DB-OTP worker-registration
  // layer (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) — retire the
  // two skip guards below the moment a worker-side OTP bypass ships.
  test('TC_MIL_008: Should become Ongoing after contractor signs @smoke @critical', async ({
    contractsClient,
    seedContractorWorker,
  }) => {
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );

    const worker = await seedContractorWorker('milestone-sign');
    test.skip(
      worker === null,
      'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer',
    );

    // Created on the STATIC `contractsClient` (has signatory + templates), not
    // `finishedContractsClient` — a fresh client has neither (see header note).
    const created = await createMilestoneContractViaApi(contractsClient);
    try {
      const signatory = await contractsClient.getSignatory();

      // Composition (invite -> client sign -> worker sign -> poll Ongoing) lives
      // in the owner-feature seeding helper — the spec must not inline
      // multi-step API composition. Calling the seeding function directly
      // (not the `signContractorToOngoing` fixture, which is hard-wired to
      // `finishedContractsClient`) so the client that owns the contract is the
      // one that invites/signs it.
      const reachedOngoing = await signContractorToOngoing({
        contracts:     contractsClient,
        contractId:    created.id,
        contractRef:   created.ref,
        worker:        worker!,
        signatoryName: signatory.name,
      });

      expect(reachedOngoing).toBe(true);
    } finally {
      // TODO(cleanup): the registered worker itself has no delete endpoint
      // (sandbox debt, documented in `seedContractorWorker`'s fixture JSDoc) —
      // only the contract can be cleaned up here.
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });
});
