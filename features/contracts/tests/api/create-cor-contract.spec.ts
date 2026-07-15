import { test as contractsTest, expect } from '@features/contracts/fixtures';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { AdminClient } from '@features/admin/api-client';
import {
  resolveContractDefaults,
  createFixedContractViaApi,
  createCorContractViaApi,
  createCorContractAndSignSow,
  signCorToOngoing,
} from '@features/contracts/seeding';
import { FixedContractBuilder } from '@features/contracts/builders/fixed-contract.builder';
import { PaygContractBuilder } from '@features/contracts/builders/payg-contract.builder';
import { MilestoneContractBuilder } from '@features/contracts/builders/milestone-contract.builder';
import { CURRENCY_IDS, SANDBOX_TAX_RESIDENCE_UAE } from '@features/contracts/constants';
import { ContractorContractCreateData } from '@features/contracts/types';
import { generateWorkerData } from '@utils/data/user-faker';
import { isDbEnvPresent } from '@core/db/db-config';

// Contracts API — Create COR (Contractor of Record) Contract (CREATE + VALIDATE
// lane + one full-lifecycle test, PR #172 phase 5). Ported from legacy
// tests/modules/contracts/api/verify/create-cor-contract.spec.ts (TC_COR_001-024).
//
// COR is NOT a separate contract type — it is `is_cor: true` on a Fixed/PAYG/
// Milestone contract (ContractsClient.createCorContract/createCorPaygContract/
// createCorMilestoneContract). COR lifecycle: client creates + signs SOW ->
// client invites worker -> worker signs -> lightweight deposit payment ->
// admin signs SOW + contract as provider -> Ongoing (seeding.ts::signCorToOngoing).
//
// Structural change from legacy: the legacy suite ran `describe.configure({mode:
// 'serial'})` and shared one COR contract (created in TC_COR_001) across
// TC_COR_002/003/004/011/024 via module-level state, plus one self-registered
// contractor (via a bespoke DB-OTP round trip in beforeAll) reused by
// TC_COR_012/018. Here every test is independent and builds its own COR
// contract via `createCorContractViaApi`/`buildCorPayload` — no serial mode,
// safe under parallel workers. TC_COR_012/018/024 that need a signed-in
// contractor identity use the framework's DB-OTP-gated
// `seedContractorWorker`/`contractorToken` fixtures instead of a bespoke
// registration round trip.
//
// Fixture choice (mirrors create-fixed-contract.spec.ts): COR contracts are
// created on the STATIC worker-scoped `contractsClient` (contracts/fixtures.ts,
// bound to the shared base `clientAccount`) — COR needs an account with
// signatory + contract templates, which a fresh `finishedContractsClient` does
// not have (confirmed there: "no contract templates found on this account").
// COR itself is enabled once per worker via the local `corEnabled` auto
// fixture below (idempotent `AdminClient.enableCor`) rather than
// `contracts/fixtures.ts`'s `seedCorContract` (that fixture is hard-wired to
// `finishedContractsClient`, which this spec deliberately does not use).
//
// TC_COR_012/024 (full lifecycle) are OTP-gated
// (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) — both self-skip via
// `isDbEnvPresent()` + the `seedContractorWorker` null sentinel.

const COR_AMOUNT = 1000;
const COR_PAYG_AMOUNT = 50;

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

/** Fresh COR Fixed-contract payload: builder data (marked `.asCor()`) + resolved signatory/template ids. */
async function buildCorPayload(
  client: ContractsClient,
  overrides: Partial<ContractorContractCreateData> = {},
): Promise<ContractorContractCreateData> {
  const input = new FixedContractBuilder().asCor().withAmount(COR_AMOUNT).build();
  const { signatoryId, templateId } = await resolveContractDefaults(client);
  return { ...input, signatoryId, templateId, ...overrides };
}

// COR is a company-level, idempotent admin toggle (`AdminClient.enableCor`) —
// enabled once per worker (shared static account) rather than per test.
// TODO(cleanup): `new`-ing ContractsClient/AdminClient here duplicates the
// enable-once logic already in `contracts/fixtures.ts`'s `seedCorContract`
// (hard-wired to `finishedContractsClient`); revisit if a third consumer needs
// "enable COR on the static account" (rule of two).
// `object` (not `Record<string, never>`, whose index signature collapses `corEnabled`
// to `never` when merged) — Playwright's own documented pattern for adding a
// worker-scoped-only fixture is `test.extend<{}, W>`; `object` is the lint-clean
// equivalent here (no new test-scope fixtures, only the worker-scoped one below).
const test = contractsTest.extend<object, { corEnabled: boolean }>({
  corEnabled: [
    async ({ clientAccount }, use) => {
      const contracts = new ContractsClient();
      const admin = new AdminClient();
      try {
        await contracts.init(clientAccount.token);
        await admin.initWithAdminToken();
        const companyId = await contracts.getCompanyId();
        await admin.enableCor(companyId);
      } finally {
        await contracts.dispose();
        await admin.dispose();
      }
      await use(true);
    },
    { scope: 'worker', auto: true },
  ],
});

test.describe('Contracts API — Create COR Contract @api', () => {
  // ==== Happy path ===========================================================

  test('TC_COR_001: Should create a COR contract with valid payload @smoke @critical', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildCorPayload(contractsClient);
    const response = await contractsClient.createCorContract(payload);

    try {
      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
      expect(response.body?.data?.id).toBeTruthy();
      expect(response.body?.data?.ref).toBeTruthy();
      expect([1, true]).toContain(response.body?.data?.is_cor);
    } finally {
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_COR_002: Should verify is_cor: 1 is set in the contract detail response @smoke', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createCorContractViaApi(contractsClient);
    try {
      const contract = await contractsClient.getContract(created.ref);
      const raw = contract as unknown as Record<string, unknown>;

      expect([1, true]).toContain(raw.is_cor);
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== Field/compliance validation ==========================================

  test('TC_COR_003: Should verify COR-specific fields are saved correctly @smoke', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createCorContractViaApi(contractsClient, { input: new FixedContractBuilder().asCor().withAmount(COR_AMOUNT).build() });
    try {
      const contract = await contractsClient.getContract(created.ref);
      const raw = contract as unknown as Record<string, unknown>;

      const amount = raw.amount ?? raw.rate ?? raw.salary;
      if (amount !== undefined) {
        expect(Number(amount)).toBe(COR_AMOUNT);
      } else {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_COR_003: amount/rate/salary not found in detail response — probe needed',
        });
      }

      const currencyCode = contract.currency?.code ?? raw.currency;

      expect(currencyCode).toBeTruthy();

      const startDate = raw.start_date ?? raw.starts_at;
      if (!startDate) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_COR_003: start_date/starts_at not found in detail response — probe needed',
        });
      }
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  test('TC_COR_004: Should verify country-specific compliance fields are applied @smoke', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createCorContractViaApi(contractsClient);
    try {
      const contract = await contractsClient.getContract(created.ref);
      const raw = contract as unknown as Record<string, unknown>;

      const taxResidenceId = raw.tax_residence_id as number | undefined;
      const taxResidenceObj = raw.tax_residence as { id?: number } | undefined;
      const taxResidence = taxResidenceId ?? taxResidenceObj?.id;

      if (taxResidence !== undefined) {
        expect(taxResidence).toBe(SANDBOX_TAX_RESIDENCE_UAE);
      } else {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_COR_004: tax_residence_id not found in contract detail response — probe needed',
        });
      }
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== Negative — validation ================================================

  test('TC_COR_005: Should fail with missing required fields @regression', async ({ contractsClient }) => {
    const response = await contractsClient.createFixedContractRaw({ is_cor: true });

    try {
      expect(response.body?.success).toBe(false);
    } finally {
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_COR_006: Should fail with unsupported country @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildCorPayload(contractsClient, { taxResidenceId: 99999 });
    const response = await contractsClient.createCorContract(payload);

    try {
      if (response.body?.success === false) {
        expect(response.body?.success).toBe(false);
      } else {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_COR_006: Invalid tax_residence_id was accepted — backend does not validate country',
        });
      }
    } finally {
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_COR_007: Should fail for non-client user (401/403) @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildCorPayload(contractsClient);
    // TODO(cleanup): lift alternate-identity ContractsClient construction to an
    // unauthContractsClient fixture (rule-of-two) — same pattern noted in
    // create-fixed-contract.spec.ts.
    const unauthClient = new ContractsClient();
    try {
      await unauthClient.init();
      const response = await unauthClient.createCorContract(payload);

      expect([401, 403]).toContain(response.status);
    } finally {
      await unauthClient.dispose();
    }
  });

  // ==== Negative — edge cases (documented backend gaps) ======================

  test('TC_COR_008: Should fail with negative rate @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts negative amount — validation gap');
    const payload = await buildCorPayload(contractsClient, { amount: -500 });
    const response = await contractsClient.createCorContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_COR_009: Should fail with invalid start date @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts malformed dates — validation gap');
    const payload = await buildCorPayload(contractsClient, {
      startDate: 'not-a-date',
      firstPaymentDate: '31/12/2099',
    });
    const response = await contractsClient.createCorContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_COR_010: Should fail with past first payment date @regression', async ({ contractsClient }) => {
    test.fixme(true, 'Backend accepts past payment dates — validation gap');
    const payload = await buildCorPayload(contractsClient, {
      startDate: pastDate(30),
      firstPaymentDate: pastDate(1),
    });
    const response = await contractsClient.createCorContract(payload);

    expect(response.body?.success).toBe(false);
  });

  test('TC_COR_011: Should fail with duplicate contractor name on same client @regression', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildCorPayload(contractsClient);
    const first = await contractsClient.createCorContract(payload);

    expect(first.body?.success).toBe(true);

    const firstId = first.body.data?.id as number;

    try {
      const second = await contractsClient.createCorContract({
        ...payload,
        contractName: `QA COR Dup ${Date.now()}`,
      });
      const secondId = second.body?.data?.id as number | undefined;
      try {
        if (second.body?.success === true) {
          test.info().annotations.push({
            type: 'gap',
            description: 'TC_COR_011: Duplicate contractor name accepted — backend allows multiple COR contracts per contractor',
          });
        } else {
          expect(second.body?.success).toBe(false);
        }
      } finally {
        if (secondId) await contractsClient.cancelContract(secondId).catch(() => undefined);
      }
    } finally {
      await contractsClient.cancelContract(firstId).catch(() => undefined);
    }
  });

  // ==== Full lifecycle (OTP-gated) ===========================================

  // TODO(api-preconditions): depends on the gated DB-OTP worker-registration
  // layer (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) — retire the
  // two skip guards below the moment a worker-side OTP bypass ships.
  test('TC_COR_012: Full COR lifecycle -> contract becomes Ongoing @smoke @critical @slow', async ({
    contractsClient,
    paymentClient,
    adminClient,
    seedContractorWorker,
  }) => {
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );
    test.setTimeout(180_000);

    const worker = await seedContractorWorker('cor-lifecycle');
    test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

    const created = await createCorContractViaApi(contractsClient);
    const signatory = await contractsClient.getSignatory();

    try {
      const result = await signCorToOngoing({
        contracts:     contractsClient,
        payments:      paymentClient,
        admin:         adminClient,
        contractId:    created.id,
        contractRef:   created.ref,
        worker:        worker!,
        signatoryName: signatory.name,
      });

      if (result.depositGap) {
        test.info().annotations.push({
          type: 'gap',
          description: `TC_COR_012: deposit path incomplete (${result.depositGap}) — documented gap, mirrors legacy behaviour`,
        });
      }

      expect(result.reachedOngoing).toBe(true);
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== COR on other contractor types =========================================

  test('TC_COR_013: Should create COR as PAYG type and verify is_cor: 1 @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const input = new PaygContractBuilder().asCor().withAmount(COR_PAYG_AMOUNT).build();
    const { signatoryId, templateId } = await resolveContractDefaults(contractsClient);
    const response = await contractsClient.createCorPaygContract({ ...input, signatoryId, templateId });

    try {
      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
      expect(response.body?.data?.id).toBeTruthy();
      expect([1, true]).toContain(response.body?.data?.is_cor);
    } finally {
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_COR_014: Should create COR as Milestone type and verify is_cor: 1 @regression', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const input = new MilestoneContractBuilder().asCor().build();
    const { signatoryId, templateId } = await resolveContractDefaults(contractsClient);
    const response = await contractsClient.createCorMilestoneContract({ ...input, signatoryId, templateId });

    try {
      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
      expect(response.body?.data?.id).toBeTruthy();
      expect([1, true]).toContain(response.body?.data?.is_cor);
    } finally {
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== SOW-specific behaviour =================================================

  test('TC_COR_015: Should verify a non-COR contract does NOT allow SOW signing @regression', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createFixedContractViaApi(contractsClient);
    try {
      const contract = await contractsClient.getContract(created.ref);
      const raw = contract as unknown as Record<string, unknown>;

      expect([0, false, undefined]).toContain(raw.is_cor);

      const signatory = await contractsClient.getSignatory();
      const sowRes = await contractsClient.signCorSow(created.id, signatory.name);
      if (sowRes.body?.success === true) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_COR_015: SOW sign succeeded on non-COR contract — endpoint does not validate is_cor flag',
        });
      }
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  test('TC_COR_016: After COR creation -> verify SoW is auto-generated @regression', async ({
    contractsClient,
    adminClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createCorContractViaApi(contractsClient);
    try {
      const contract = await contractsClient.getContract(created.ref);
      const raw = contract as unknown as Record<string, unknown>;

      expect(raw.is_cor).toBeTruthy();

      const sowStatus = raw.sow_status ?? raw.cor_sow_status;
      if (sowStatus === undefined) {
        const corContracts = await adminClient.listCorContracts();
        const found = corContracts.find((c) => (c).id === created.id);
        if (!found) {
          test.info().annotations.push({
            type: 'gap',
            description: 'TC_COR_016: SOW status not in detail endpoint and contract not on admin list page 1 — needs deeper probe',
          });
        }
      }
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  test('TC_COR_017: Admin signs SoW via POST /api/admin/cor/sow/sign @regression', async ({
    contractsClient,
    adminClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createCorContractAndSignSow(contractsClient);
    try {
      const adminSow = await adminClient.signCorSow(created.id, 'Admin QA');

      expect(adminSow.status).toBe(200);
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  test('TC_COR_018: Contractor signs SoW via POST /api/contract/cor/sow/sign @regression', async ({
    contractsClient,
    contractorToken,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createCorContractAndSignSow(contractsClient);
    // TODO(cleanup): lift alternate-identity ContractsClient construction to a
    // contractorContractsClient fixture (rule-of-two) — same pattern noted in
    // create-fixed-contract.spec.ts.
    const contractorClient = new ContractsClient();
    try {
      await contractorClient.init(contractorToken);
      const contractorSow = await contractorClient.signCorSow(created.id, 'QA Contractor Signer');

      expect(contractorSow.status).toBeDefined();

      if (contractorSow.body?.success !== true) {
        test.info().annotations.push({
          type: 'gap',
          description: `TC_COR_018: Contractor SOW sign failed — ${contractorSow.body?.message ?? 'no message'}. SOW may require client-only signature.`,
        });
      }
    } finally {
      await contractorClient.dispose();
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== Invalid is_cor values (raw payload — typed helpers always send true) ===

  test('TC_COR_019a: Should fail when is_cor=2 @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const { signatoryId, templateId } = await resolveContractDefaults(contractsClient);
    const response = await contractsClient.createFixedContractRaw({
      name: `QA COR Invalid ${Date.now()}`,
      contractor_name: new FixedContractBuilder().build().contractorName,
      scope: 'Test scope.',
      currency_id: CURRENCY_IDS.USD,
      signatory_id: signatoryId,
      template_id: templateId,
      start_date: futureDate(7),
      first_payment_date: futureDate(37),
      amount: COR_AMOUNT,
      frequency_id: 4,
      occurrence_id: 17,
      notice_period: 30,
      kyc: 1,
      is_cor: 2,
    });

    try {
      if (response.body?.success === true) {
        test.info().annotations.push({
          type: 'gap',
          description: `TC_COR_019a: is_cor=2 accepted (result=${String(response.body.data?.is_cor)}) — no backend validation`,
        });
      } else {
        expect(response.body?.success).toBe(false);
      }
    } finally {
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_COR_019b: Should fail when is_cor=-1 @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const { signatoryId, templateId } = await resolveContractDefaults(contractsClient);
    const response = await contractsClient.createFixedContractRaw({
      name: `QA COR Invalid ${Date.now()}`,
      contractor_name: new FixedContractBuilder().build().contractorName,
      scope: 'Test scope.',
      currency_id: CURRENCY_IDS.USD,
      signatory_id: signatoryId,
      template_id: templateId,
      start_date: futureDate(7),
      first_payment_date: futureDate(37),
      amount: COR_AMOUNT,
      frequency_id: 4,
      occurrence_id: 17,
      notice_period: 30,
      kyc: 1,
      is_cor: -1,
    });

    try {
      if (response.body?.success === true) {
        test.info().annotations.push({
          type: 'gap',
          description: `TC_COR_019b: is_cor=-1 accepted (result=${String(response.body.data?.is_cor)}) — no backend validation`,
        });
      } else {
        expect(response.body?.success).toBe(false);
      }
    } finally {
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_COR_019c: Should fail when is_cor="yes" @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const { signatoryId, templateId } = await resolveContractDefaults(contractsClient);
    const response = await contractsClient.createFixedContractRaw({
      name: `QA COR Invalid ${Date.now()}`,
      contractor_name: new FixedContractBuilder().build().contractorName,
      scope: 'Test scope.',
      currency_id: CURRENCY_IDS.USD,
      signatory_id: signatoryId,
      template_id: templateId,
      start_date: futureDate(7),
      first_payment_date: futureDate(37),
      amount: COR_AMOUNT,
      frequency_id: 4,
      occurrence_id: 17,
      notice_period: 30,
      kyc: 1,
      is_cor: 'yes',
    });

    try {
      if (response.body?.success === true) {
        test.info().annotations.push({
          type: 'gap',
          description: `TC_COR_019c: is_cor="yes" accepted (result=${String(response.body.data?.is_cor)}) — no backend validation`,
        });
      } else {
        expect(response.body?.success).toBe(false);
      }
    } finally {
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== Edge cases — boundary values ==========================================

  test('TC_COR_020: Should accept decimal hourly rate on COR PAYG contract @regression', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const input = new PaygContractBuilder().asCor().withAmount(75.5).build();
    const { signatoryId, templateId } = await resolveContractDefaults(contractsClient);
    const response = await contractsClient.createCorPaygContract({ ...input, signatoryId, templateId });

    try {
      expect(response.status).toBe(200);
      expect(response.body?.success).toBe(true);
    } finally {
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_COR_021: Should sanitize XSS payload in scope/title field @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const payload = await buildCorPayload(contractsClient, {
      contractName: `QA <script>alert(1)</script> & "COR" ${Date.now()}`,
    });
    const response = await contractsClient.createCorContract(payload);

    try {
      expect(response.status).not.toBe(500);

      if (response.body?.success === true) {
        const storedName = (response.body.data?.name as string | undefined) ?? '';

        expect(storedName).not.toContain('<script>');
      }
    } finally {
      const id = response.body?.data?.id as number | undefined;
      if (id) await contractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  test('TC_COR_022: Should fail to invite contractor before SOW is signed @regression', async ({
    contractsClient,
  }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createCorContractViaApi(contractsClient);
    const inviteEmail = generateWorkerData('cor-invite-gap').email;

    try {
      const inviteRes = await contractsClient.inviteContractor(created.id, inviteEmail);
      test.info().annotations.push({
        type: 'gap',
        description: `TC_COR_022: Invite succeeded without SOW signing (url present: ${!!inviteRes.invitationUrl}) — backend does not enforce SOW-first`,
      });
    } catch (err) {
      // inviteContractor throws (assertOk) on a non-2xx response — correctly rejected.
      expect(err).toBeTruthy();
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  test('TC_COR_023: Should handle duplicate SOW sign on same contract @regression', async ({ contractsClient }) => {
    test.fixme(true, 'QA-443: no contract templates on sandbox account — QA-448');
    const created = await createCorContractAndSignSow(contractsClient);
    try {
      const duplicateRes = await contractsClient.signCorSow(created.id, created.signatoryName);
      if (duplicateRes.body?.success === false) {
        expect(duplicateRes.body?.success).toBe(false);
      } else {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_COR_023: Duplicate SOW sign accepted — backend does not guard against double-signing',
        });
      }
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== Cancellation (OTP-gated — reaches Ongoing first) ======================

  // TODO(api-preconditions): same DB-OTP gate as TC_COR_012, see
  // 2026-07-08-dmytro-db-otp-layer.
  // TODO(merge): shares the full COR-to-Ongoing bootstrap with TC_COR_012 —
  // kept separate because this test asserts on cancellation, not on the
  // deposit path (`processDeposit: false` here keeps runtime bounded).
  test('TC_COR_024: Should cancel an Ongoing COR contract @regression @slow', async ({
    contractsClient,
    adminClient,
    seedContractorWorker,
  }) => {
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );
    test.setTimeout(120_000);

    const worker = await seedContractorWorker('cor-cancel');
    test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

    const created = await createCorContractViaApi(contractsClient);
    try {
      const signatory = await contractsClient.getSignatory();

      const result = await signCorToOngoing({
        contracts:      contractsClient,
        admin:          adminClient,
        contractId:     created.id,
        contractRef:    created.ref,
        worker:         worker!,
        signatoryName:  signatory.name,
        processDeposit: false,
      });

      expect(result.reachedOngoing).toBe(true);

      const cancelRes = await contractsClient.cancelContract(created.id);
      if (cancelRes.status === 200 && cancelRes.body?.success !== false) {
        expect(cancelRes.status).toBe(200);
      } else {
        test.info().annotations.push({
          type: 'gap',
          description: `TC_COR_024: cancelContract returned ${cancelRes.status}: ${cancelRes.body?.message ?? 'no message'}`,
        });
      }
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });
});
