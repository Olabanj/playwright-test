import { test, expect } from '@features/contracts/fixtures';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { resolveContractDefaults, createFixedContractViaApi, signContractorToOngoing } from '@features/contracts/seeding';
import { FixedContractBuilder } from '@features/contracts/builders/fixed-contract.builder';
import { CURRENCY_IDS } from '@features/contracts/constants';
import { ContractorContractCreateData } from '@features/contracts/types';
import { isDbEnvPresent } from '@core/db/db-config';

// Contracts API — Create Fixed Contract (CREATE + VALIDATE lane, PR #172 phase 2).
// Ported from legacy tests/modules/contracts/api/verify/create-fixed-contract.spec.ts.
// Scope: TC_CFC_001-006, 008-020 (create + validation) plus TC_CFC_007, the
// OTP-gated invite/sign lane (Phase 4, docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md).
//
// Structural change from legacy: the legacy suite registered a fresh contractor
// via a DB-tunnel OTP read in beforeAll purely to get a `contractorName` string
// and (for TC_CFC_006) a contractor token. Create+validate never exercises that
// identity as a signer, so that step is dropped here: the contractor name comes
// from `FixedContractBuilder`'s generated worker data.
// TC_CFC_006 reuses the framework's shared worker-scoped `contractorToken` base
// fixture instead of a bespoke OTP registration.
//
// Fixture choice (resolves architecture-mapping escalation #3, 2026-07-08): this
// spec runs against the STATIC worker-scoped `contractsClient` (contracts/fixtures.ts,
// bound to the shared base `clientAccount` — zero extra logins), not a freshly-minted
// client. A fresh-per-test client (`createFinishedClient`) has no signatory/contract
// templates and cannot pass `getSignatory`/`getTemplateId` — the static account is
// already fully onboarded and has both (same account the bulk-import and
// eor-salary-currency specs already pass against).
//
// TC_CFC_007 exception: it must own the contract it invites/signs against, so it
// creates on the STATIC `contractsClient` too (a fresh `finishedContractsClient`
// has no templates — confirmed 2026-07-08, `getTemplateId: no contract templates
// found on this account`). The `signContractorToOngoing` FIXTURE is hard-wired to
// `finishedContractsClient` (contracts/fixtures.ts), so this test calls the
// `signContractorToOngoing` SEEDING FUNCTION directly with the static
// `contractsClient` injected — still composition living in seeding.ts, not
// inlined multi-step HTTP in the spec.
//
// Serial mode still dropped: every test builds its own payload with a uniquely
// generated contractor name/email (`FixedContractBuilder`), so parallel tests never
// collide on contract identity even though they share one account. Tests that read
// back a created contract create it locally and cancel it in `finally` — contracts
// on the shared static account are cleaned up per-test, never left behind.

const FIXED_AMOUNT = 1000;

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

/** Fresh Fixed-contract payload for this test's client: builder data + resolved signatory/template ids. */
async function buildPayload(
  client: ContractsClient,
  overrides: Partial<ContractorContractCreateData> = {},
): Promise<ContractorContractCreateData> {
  const input = new FixedContractBuilder().build();
  const { signatoryId, templateId } = await resolveContractDefaults(client);
  return { ...input, signatoryId, templateId, ...overrides };
}

test.describe('Contracts API — Create Fixed Contract @api', () => {
  // ==== Happy path ==========================================================

  test('TC_CFC_001: Should create a Fixed contract with valid payload @smoke @critical', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient);
    const response = await contractsClient.createFixedContract(payload);

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

  test('TC_CFC_002: Should return contract type = Fixed @smoke', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createFixedContractViaApi(contractsClient);
    try {
      const contract = await contractsClient.getContract(created.ref);

      expect(contract.type?.toLowerCase()).toBe('fixed');
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  test('TC_CFC_003: Should verify currency and rate are saved correctly @smoke', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createFixedContractViaApi(contractsClient);
    try {
      const contract = await contractsClient.getContract(created.ref);

      expect(contract.currency?.id).toBe(CURRENCY_IDS.USD);
      if (contract.amount !== undefined) {
        expect(Number(contract.amount)).toBe(FIXED_AMOUNT);
      }
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== Negative — validation ===============================================

  test('TC_CFC_004: Should fail with missing required fields @regression', async ({ contractsClient }) => {
    const response = await contractsClient.createFixedContractRaw({
      name: `QA Incomplete ${Date.now()}`,
    });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(false);
  });

  test('TC_CFC_005: Should fail with invalid currency @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { currencyId: 999999 });
    const response = await contractsClient.createFixedContract(payload);

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(false);
  });

  // BUG: sandbox returns 200 success=true when a contractor token calls
  // createFixedContract. Expected: 401/403 or 200 success=false (role-based
  // access control). Actual: the API accepts the request and creates a contract
  // — likely a backend defect. Marked fixme until the backend enforces
  // client-only access on this endpoint.
  test.fixme(
    'TC_CFC_006: Contractor token — contract creation returns non-client response @regression',
    async ({ contractsClient, contractorToken }) => {
      const payload = await buildPayload(contractsClient);
      // TODO(cleanup): lift alternate-identity ContractsClient construction to unauthContractsClient/contractorContractsClient fixtures (rule-of-two)
      const contractorApi = new ContractsClient();
      try {
        await contractorApi.init(contractorToken);
        const response = await contractorApi.createFixedContract(payload);

        expect([401, 403, 200]).toContain(response.status);
        expect(response.status).not.toBe(500);
        if (response.status === 200) {
          expect(response.body?.success).toBe(false);
          expect(response.body?.data?.id).toBeFalsy();
        }
      } finally {
        await contractorApi.dispose();
      }
    },
  );

  // ==== Negative — edge cases ===============================================

  test('TC_CFC_008: Should fail with empty contractor name @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts empty contractor_name — validation gap');
    const payload = await buildPayload(contractsClient, { contractorName: '' });
    const response = await contractsClient.createFixedContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CFC_009: Should fail with invalid signatory ID @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { signatoryId: -1 });
    const response = await contractsClient.createFixedContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CFC_010: Should fail with invalid template ID @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { templateId: 0 });
    const response = await contractsClient.createFixedContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CFC_011: Should fail with past start date @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts past start_date — validation gap');
    const payload = await buildPayload(contractsClient, {
      startDate: pastDate(30),
      firstPaymentDate: pastDate(1),
    });
    const response = await contractsClient.createFixedContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CFC_012: Should fail with zero amount @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts amount=0 — validation gap');
    const payload = await buildPayload(contractsClient, { amount: 0 });
    const response = await contractsClient.createFixedContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CFC_013: Should fail with negative amount @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts negative amount — validation gap');
    const payload = await buildPayload(contractsClient, { amount: -500 });
    const response = await contractsClient.createFixedContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CFC_014: Should fail with completely empty payload @regression', async ({ contractsClient }) => {
    const response = await contractsClient.createFixedContractRaw({});

    expect(response.body?.success).toBe(false);
  });

  test('TC_CFC_015: Should fail with malformed date format @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts malformed dates — validation gap');
    const payload = await buildPayload(contractsClient, {
      startDate: 'not-a-date',
      firstPaymentDate: '31/12/2099',
    });
    const response = await contractsClient.createFixedContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CFC_016: Should fail without auth token @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient);
    // TODO(cleanup): lift alternate-identity ContractsClient construction to unauthContractsClient/contractorContractsClient fixtures (rule-of-two)
    const unauthApi = new ContractsClient();
    try {
      await unauthApi.init();
      const response = await unauthApi.createFixedContractRaw({
        name: `QA Unauth ${Date.now()}`,
        contractor_name: payload.contractorName,
        currency_id: payload.currencyId,
        signatory_id: payload.signatoryId,
        template_id: payload.templateId,
        start_date: payload.startDate,
        first_payment_date: payload.firstPaymentDate,
        amount: payload.amount,
      });

      expect([401, 403]).toContain(response.status);
    } finally {
      await unauthApi.dispose();
    }
  });

  // ==== Edge cases — boundary values ========================================

  test('TC_CFC_017: Should handle very large amount @regression @deep', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { amount: 999999999 });
    const response = await contractsClient.createFixedContract(payload);

    try {
      expect(response.status).toBe(200);
    } finally {
      const id = response.body?.success === true ? (response.body?.data?.id as number | undefined) : undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_CFC_018: Should handle decimal amount @regression @deep', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { amount: 1500.75 });
    const response = await contractsClient.createFixedContract(payload);

    try {
      expect(response.status).toBe(200);
    } finally {
      const id = response.body?.success === true ? (response.body?.data?.id as number | undefined) : undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_CFC_019: Should handle special characters in contract name @regression @deep', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, {
      contractName: `QA <script>alert(1)</script> & "quotes" ${Date.now()}`,
    });
    const response = await contractsClient.createFixedContract(payload);

    try {
      expect(response.status).not.toBe(500);
    } finally {
      const id = response.body?.success === true ? (response.body?.data?.id as number | undefined) : undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_CFC_020: Should fail when firstPaymentDate is before startDate @regression', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'Backend accepts payment date before start date — validation gap');
    const payload = await buildPayload(contractsClient, {
      startDate: futureDate(60),
      firstPaymentDate: futureDate(7),
    });
    const response = await contractsClient.createFixedContract(payload);

    expect(response.body?.success).toBe(false);
  });

  // ==== Full lifecycle (Phase 4 — OTP-gated worker registration) ============

  // TODO(api-preconditions): depends on the gated DB-OTP worker-registration
  // layer (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) — retire the
  // two skip guards below the moment a worker-side OTP bypass ships.
  test('TC_CFC_007: Contractor signs -> contract becomes Ongoing @smoke @critical', async ({
    contractsClient,
    seedContractorWorker,
  }) => {
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );

    const worker = await seedContractorWorker('fixed-sign');
    test.skip(
      worker === null,
      'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer',
    );

    // Created on the STATIC `contractsClient` (has signatory + templates), not
    // `finishedContractsClient` — a fresh client has neither (see header note).
    const created = await createFixedContractViaApi(contractsClient);
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
