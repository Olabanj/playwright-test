import { test, expect } from '@features/contracts/fixtures';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { resolveContractDefaults, createPaygContractViaApi, signContractorToOngoing } from '@features/contracts/seeding';
import { PaygContractBuilder } from '@features/contracts/builders/payg-contract.builder';
import { CURRENCY_IDS, SANDBOX_TAX_RESIDENCE_UAE } from '@features/contracts/constants';
import { ContractorContractCreateData } from '@features/contracts/types';
import { isDbEnvPresent } from '@core/db/db-config';

// Contracts API — Create PAYG Contract (CREATE + VALIDATE lane, PR #172 phase 2).
// Ported from legacy tests/modules/contracts/api/verify/create-payg-contract.spec.ts.
// Scope: TC_CPC_001-021 (create + validation, including the pre-sign status check
// TC_CPC_021) plus TC_CPC_022, the OTP-gated invite/sign lane (Phase 4,
// docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) — mirrors the Fixed
// sibling's TC_CFC_007 composition exactly (static `contractsClient` +
// `seedContractorWorker` + `signContractorToOngoing` seeding function).
//
// Structural change from legacy: the legacy suite registered a fresh contractor
// via a DB-tunnel OTP read in beforeAll purely to get a `contractor.fullName`
// string and (for TC_CPC_006) a contractor token. Create+validate never
// exercises that identity as a signer, so that step is dropped here: the
// contractor name comes from `PaygContractBuilder`'s generated worker data, and
// TC_CPC_006 reuses the framework's shared worker-scoped `contractorToken` base
// fixture instead of a bespoke OTP registration.
//
// Fixture choice (same as the Fixed sibling, architecture-mapping escalation
// #3, 2026-07-08): runs against the STATIC worker-scoped `contractsClient`
// (contracts/fixtures.ts, bound to the shared base `clientAccount` — zero extra
// logins), not a freshly-minted client. A fresh-per-test client
// (`createFinishedClient`) has no signatory/contract templates and cannot pass
// `getSignatory`/`getTemplateId` — the static account is already fully
// onboarded and has both.
//
// Serial mode dropped, same reasoning as the Fixed sibling: every test builds
// its own payload with a uniquely generated contractor name/email
// (`PaygContractBuilder`), so parallel tests never collide on contract identity
// even though they share one account. Tests that read back a created contract
// create it locally and cancel it in `finally` — contracts on the shared
// static account are cleaned up per-test, never left behind.

const HOURLY_RATE = 50;

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

/** Fresh PAYG-contract payload for this test's client: builder data + resolved signatory/template ids. */
async function buildPayload(
  client: ContractsClient,
  overrides: Partial<ContractorContractCreateData> = {},
): Promise<ContractorContractCreateData> {
  const input = new PaygContractBuilder().build();
  const { signatoryId, templateId } = await resolveContractDefaults(client);
  return { ...input, signatoryId, templateId, ...overrides };
}

/** snake_case raw payload for the missing/overridden-flag negative tests (TC_CPC_015/016/017). */
function buildRawPaygPayload(
  base: { signatoryId: number; templateId: number; contractorName: string },
  omit: string[] = [],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: `QA PAYG Raw ${Date.now()}`,
    contractor_name: base.contractorName,
    scope: 'Consulting services.',
    start_date: futureDate(7),
    first_payment_date: futureDate(37),
    amount: HOURLY_RATE,
    currency_id: CURRENCY_IDS.USD,
    rate_id: 1,
    template_id: base.templateId,
    tax_residence_id: SANDBOX_TAX_RESIDENCE_UAE,
    frequency_id: 4,
    occurrence_id: 17,
    notice_period: 30,
    signatory_id: base.signatoryId,
    client_can_submit: 1,
    kyc: 1,
    extra: 1,
  };
  for (const key of omit) delete payload[key];
  return payload;
}

test.describe('Contracts API — Create PAYG Contract @api', () => {
  // ==== Happy path ==========================================================

  test('TC_CPC_001: Should create a PAYG contract with valid payload @smoke @critical', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient);
    const response = await contractsClient.createPaygContract(payload);

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

  test('TC_CPC_002: Should return contract type = PAYG @smoke', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createPaygContractViaApi(contractsClient);
    try {
      const contract = await contractsClient.getContract(created.ref);

      expect(['payg', 'pay as you go', 'pay_as_you_go']).toContain((contract.type ?? '').toLowerCase());
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  test('TC_CPC_003: Should verify currency is saved correctly @smoke', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createPaygContractViaApi(contractsClient);
    try {
      const contract = await contractsClient.getContract(created.ref);

      expect(contract.currency?.id).toBe(CURRENCY_IDS.USD);
      if (contract.amount !== undefined) {
        expect(Number(contract.amount)).toBe(HOURLY_RATE);
      }
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== Negative — validation ===============================================

  test('TC_CPC_004: Should fail with missing required fields @regression', async ({ contractsClient }) => {
    const response = await contractsClient.createPaygContractRaw({
      name: `QA Incomplete ${Date.now()}`,
    });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(false);
  });

  test('TC_CPC_005: Should fail with invalid hourly rate @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts negative amount — validation gap');
    const payload = await buildPayload(contractsClient, { amount: -100 });
    const response = await contractsClient.createPaygContract(payload);

    expect(response.body?.success).toBe(false);
  });

  // BUG: sandbox returns 200 success=true when a contractor token calls
  // createPaygContract. Expected: 401/403 or 200 success=false (role-based
  // access control). Actual: the API accepts the request and creates a contract
  // — likely a backend defect. Marked fixme until the backend enforces
  // client-only access on this endpoint.
  test.fixme(
    'TC_CPC_006: Contractor token — contract creation returns non-client response @regression',
    async ({ contractsClient, contractorToken }) => {
      const payload = await buildPayload(contractsClient);
      // TODO(cleanup): lift alternate-identity ContractsClient construction to unauthContractsClient/contractorContractsClient fixtures (rule-of-two)
      const contractorApi = new ContractsClient();
      try {
        await contractorApi.init(contractorToken);
        const response = await contractorApi.createPaygContract(payload);

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

  test('TC_CPC_007: Should fail with zero hourly rate @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts amount=0 — validation gap');
    const payload = await buildPayload(contractsClient, { amount: 0 });
    const response = await contractsClient.createPaygContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CPC_008: Should fail with invalid currency_id @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { currencyId: 999999 });
    const response = await contractsClient.createPaygContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CPC_009: Should fail with past start_date @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts past start_date — validation gap');
    const payload = await buildPayload(contractsClient, { startDate: pastDate(30) });
    const response = await contractsClient.createPaygContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CPC_010: Should fail with firstPaymentDate before startDate @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts firstPaymentDate < startDate — validation gap');
    const payload = await buildPayload(contractsClient, {
      startDate: futureDate(30),
      firstPaymentDate: futureDate(7),
    });
    const response = await contractsClient.createPaygContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CPC_011: Should fail with invalid template_id @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { templateId: 999999 });
    const response = await contractsClient.createPaygContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CPC_012: Should fail with invalid signatory_id @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts invalid signatory_id — validation gap');
    const payload = await buildPayload(contractsClient, { signatoryId: 999999 });
    const response = await contractsClient.createPaygContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CPC_013: Should fail with empty contractor_name @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts empty contractor_name — validation gap');
    const payload = await buildPayload(contractsClient, { contractorName: '' });
    const response = await contractsClient.createPaygContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CPC_014: Should fail with invalid rate_id @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { rateId: 999999 });
    const response = await contractsClient.createPaygContract(payload);

    expect(response.body?.success).toBe(false);
  });

  // ==== Edge cases — PAYG-specific fields ===================================

  test('TC_CPC_015: Should fail when kyc flag is missing @regression @deep', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts missing kyc flag — validation gap');
    const input = new PaygContractBuilder().build();
    const { signatoryId, templateId } = await resolveContractDefaults(contractsClient);
    const payload = buildRawPaygPayload({ signatoryId, templateId, contractorName: input.contractorName }, ['kyc']);
    const response = await contractsClient.createPaygContractRaw(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CPC_016: Should fail when extra flag is missing (required for PAYG) @regression @deep', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const input = new PaygContractBuilder().build();
    const { signatoryId, templateId } = await resolveContractDefaults(contractsClient);
    const payload = buildRawPaygPayload({ signatoryId, templateId, contractorName: input.contractorName }, ['extra']);
    const response = await contractsClient.createPaygContractRaw(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_CPC_017: Should fail when client_can_submit is 0 @regression @deep', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts client_can_submit=0 — validation gap');
    const input = new PaygContractBuilder().build();
    const { signatoryId, templateId } = await resolveContractDefaults(contractsClient);
    const payload = buildRawPaygPayload({ signatoryId, templateId, contractorName: input.contractorName });
    payload.client_can_submit = 0;
    const response = await contractsClient.createPaygContractRaw(payload);

    expect(response.body?.success).toBe(false);
  });

  // ==== Edge cases — boundary values =========================================

  test('TC_CPC_018: Should create contract with very large hourly rate @regression @deep', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { amount: 999999 });
    const response = await contractsClient.createPaygContract(payload);

    try {
      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
    } finally {
      const id = response.body?.success === true ? (response.body?.data?.id as number | undefined) : undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_CPC_019: Should create contract with decimal hourly rate @regression @deep', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient, { amount: 25.75 });
    const response = await contractsClient.createPaygContract(payload);

    try {
      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
    } finally {
      const id = response.body?.success === true ? (response.body?.data?.id as number | undefined) : undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_CPC_020: Should reject unauthenticated request @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildPayload(contractsClient);
    // TODO(cleanup): lift alternate-identity ContractsClient construction to unauthContractsClient/contractorContractsClient fixtures (rule-of-two)
    const unauthApi = new ContractsClient();
    try {
      await unauthApi.init();
      const response = await unauthApi.createPaygContract(payload);

      expect([401, 403]).toContain(response.status);
    } finally {
      await unauthApi.dispose();
    }
  });

  // ==== Pre-sign state =======================================================

  test('TC_CPC_021: Should verify contract status is not Ongoing before signing @smoke', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createPaygContractViaApi(contractsClient);
    try {
      const contract = await contractsClient.getContract(created.ref);

      expect(contract.status?.name).not.toBe('Ongoing');
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== Full lifecycle (Phase 4 — OTP-gated worker registration) ============

  // TODO(api-preconditions): depends on the gated DB-OTP worker-registration
  // layer (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) — retire the
  // two skip guards below the moment a worker-side OTP bypass ships.
  test('TC_CPC_022: Contractor signs -> contract becomes Ongoing @smoke @critical', async ({
    contractsClient,
    seedContractorWorker,
  }) => {
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );

    const worker = await seedContractorWorker('payg-sign');
    test.skip(
      worker === null,
      'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer',
    );

    // Created on the STATIC `contractsClient` (has signatory + templates), not
    // `finishedContractsClient` — a fresh client has neither (see header note).
    const created = await createPaygContractViaApi(contractsClient);
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
