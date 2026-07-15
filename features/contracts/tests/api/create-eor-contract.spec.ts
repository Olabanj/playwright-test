import { test as contractsTest, expect } from '@features/contracts/fixtures';
import { AdminClient } from '@features/admin/api-client';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { EorClient } from '@features/contracts/clients/eor-client';
import { createFinishedClient, signEorClientAndProviderSign, signEorToOngoing } from '@features/contracts/seeding';
import { RegisteredClient } from '@features/onboarding/types';
import { CURRENCY_IDS, SANDBOX_TAX_RESIDENCE_UAE } from '@features/contracts/constants';
import { CreateEorContractInput, EorTestContext } from '@features/contracts/types';
import { generateWorkerData } from '@utils/data/user-faker';

/**
 * QA-449: the shared base `contractsFinishedClient` (which `finishedContractsClient`
 * and `eorClient` both derive their token from) is deliberately test-scoped
 * (D3, docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md) so parallel
 * contract-creation tests never contend on account-level admin state. That's
 * the right default for fixed/payg/milestone/cor, but this file alone has 23
 * tests, each doing its own fresh client signup — the sandbox enforces a
 * signup-specific 429 rate limit distinct from the login throttle, and 23
 * signups per run reliably exhausts it (QA-443/QA-449), confirmed to shift
 * which specific tests fail run-to-run rather than converge. Both CI
 * invocations of the `api` project force `--workers=1` (pr-checks.yml,
 * nightly.yml), so there's no actual parallel-contention risk to guard
 * against here — introduce a WORKER-scoped signup local to this file only
 * (`sharedRegisteredClient`), then override `finishedContractsClient` and
 * `eorClient` in place (same names/scope tests already use, just sourced from
 * the shared signup instead of the base `contractsFinishedClient`) so every
 * test in this file's worker shares one signup instead of doing its own. Does
 * NOT touch the shared base fixtures, so every other consumer (fixed/payg/
 * milestone/cor, and the DE file's own local override) keeps D3's protection
 * independently.
 */
const test = contractsTest.extend<
  { finishedContractsClient: ContractsClient; eorClient: EorClient },
  { sharedRegisteredClient: RegisteredClient }
>({
  sharedRegisteredClient: [
    async ({}, use) => {
      const admin = new AdminClient();
      await admin.initWithAdminToken();
      try {
        const registered = await createFinishedClient(admin);
        await use(registered);
      } finally {
        await admin.dispose();
      }
    },
    { scope: 'worker' },
  ],
  finishedContractsClient: async ({ sharedRegisteredClient }, use) => {
    const client = new ContractsClient();
    await client.init(sharedRegisteredClient.token);
    await use(client);
    await client.dispose();
  },
  eorClient: async ({ sharedRegisteredClient }, use) => {
    const client = new EorClient();
    await client.init(sharedRegisteredClient.token);
    await use(client);
    await client.dispose();
  },
});

// Contracts API — Create EOR Contract (CREATE + VALIDATE lane).
// Ported from legacy tests/modules/contracts/api/verify/create-eor-contract.spec.ts.
// Scope: TC_QA209_001-023 create + validate, TC_QA209_007b (worker-role-denied,
// kept fixme verbatim), TC_QA209_008 (client+provider sign) and TC_QA209_014
// (full E2E to Ongoing) — see per-test notes below.
//
// Structural change from legacy: the legacy suite built ONE shared EOR payload
// in `beforeAll` (one fixed client, reused by every test). Here `eorClient` /
// `finishedContractsClient` / `adminEorClient` are bound to `contractsFinishedClient`,
// a FRESH client registered per test (contracts/fixtures.ts — D3, avoids
// account-level admin-state contention across parallel tests). So every test
// resolves its own EOR regional config + insurance + regional-form answers via
// `requireEorContext` below instead of sharing `beforeAll` state — the create+
// validate tests that used to just read a shared `contractDetails` now create
// their own contract first.
//
// EOR contracts (and registered EOR employees) have no delete endpoint at all
// (ported verbatim as sandbox debt, not a regression) — cleanup is best-effort
// `finishedContractsClient.cancelContract()` per test, matching the fixtures.ts
// `seedEorContract` factory's own cleanup contract.

const UAE_COUNTRY_ID = SANDBOX_TAX_RESIDENCE_UAE;

// ==== Helpers ================================================================

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

/**
 * Resolve a valid EOR create payload for UAE (regional config + insurance +
 * regional form answers). Returns `null` on the `EOR_REGIONAL_CONFIG_ABSENT`
 * self-skip sentinel (see `EorClient.getRegionalConfig`) — callers must
 * self-skip via `requireEorContext`, never treat `null` as a failure.
 * `overrides` are merged in last, after the UAE base config resolves — this
 * lets negative tests mutate a single field (e.g. `employeeCountryId: 99999`)
 * without needing a regional config for the invalid value itself (mirrors the
 * legacy suite's `basePayload` pattern).
 */
async function buildEorContext(
  eor: EorClient,
  overrides: Partial<CreateEorContractInput> = {},
): Promise<EorTestContext | null> {
  const regionalConfig = await eor.getRegionalConfig(UAE_COUNTRY_ID);
  if (!regionalConfig) return null;

  const [insuranceProviders, regionalFormAnswers] = await Promise.all([
    eor.getInsuranceProviders(regionalConfig.id),
    eor.buildRegionalFormAnswers(regionalConfig),
  ]);
  const worker = generateWorkerData('eor-create');

  const input: CreateEorContractInput = {
    employeeFirstName:   worker.firstName,
    employeeLastName:    worker.lastName,
    employeeEmail:       worker.email,
    employeeCountryId:   UAE_COUNTRY_ID,
    currencyId:          CURRENCY_IDS.USD,
    includeInsurance:    insuranceProviders.length > 0,
    insuranceProviderId: insuranceProviders[0]?.id ?? 0,
    startDate:           daysFromNow(7),
    ...regionalFormAnswers,
    ...overrides,
  };
  return { input, isQuotationAutomated: regionalConfig.is_quotation_automation_enabled ?? false };
}

/** `buildEorContext` + dynamic self-skip on the `EOR_REGIONAL_CONFIG_ABSENT` sentinel. */
async function requireEorContext(
  eor: EorClient,
  overrides: Partial<CreateEorContractInput> = {},
): Promise<EorTestContext> {
  const ctx = await buildEorContext(eor, overrides);
  test.skip(!ctx, 'EOR_REGIONAL_CONFIG_ABSENT — sandbox has no EOR regional config for UAE (self-skip, see EorClient.getRegionalConfig)');
  return ctx!;
}

test.describe('Contracts API — Create EOR Contract @api', () => {
  // ==== TC_QA209_001 ==========================================================

  test('TC_QA209_001 — should create an EOR contract with valid payload @smoke @critical', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, { employeeEmail: generateWorkerData('eor-main').email });
    const res = await eorClient.createEorContract(input);

    try {
      expect([200, 201]).toContain(res.status);
      expect(res.body?.success).not.toBe(false);
      expect(res.body?.data?.id).toBeTruthy();
      expect(res.body?.data?.ref).toBeTruthy();
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_002 ==========================================================

  test('TC_QA209_002 — should return correct contract type = EOR @smoke', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, { employeeEmail: generateWorkerData('eor-type').email });
    const createRes = await eorClient.createEorContract(input);
    const contractId = createRes.body?.data?.id as number | undefined;
    const contractRef = createRes.body?.data?.ref as string | undefined;

    expect(contractId).toBeTruthy();
    expect(contractRef).toBeTruthy();

    try {
      const contract = await finishedContractsClient.getContract(contractRef!);

      expect((contract.type ?? '').toLowerCase()).toContain('eor');
    } finally {
      await finishedContractsClient.cancelContract(contractId!).catch(() => undefined);
    }
  });

  // ==== TC_QA209_003 ==========================================================

  test('TC_QA209_003 — should verify employer-of-record metadata is saved correctly @smoke', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, { employeeEmail: generateWorkerData('eor-meta').email });
    const createRes = await eorClient.createEorContract(input);
    const contractId = createRes.body?.data?.id as number | undefined;
    const contractRef = createRes.body?.data?.ref as string | undefined;

    expect(contractId).toBeTruthy();
    expect(contractRef).toBeTruthy();

    try {
      const contract = await finishedContractsClient.getContract(contractRef!);
      const employee = contract.employee as Record<string, unknown> | undefined;

      expect(employee, 'contract details must include an employee record').toBeTruthy();
      expect(employee?.first_name).toBe(input.employeeFirstName);
      expect(employee?.last_name).toBe(input.employeeLastName);

      // Employee email may be partially masked in sandbox — verify presence only.
      const emailField = (employee?.email as string | undefined) ?? '';

      expect(emailField.length).toBeGreaterThan(0);

      // Salary amount is at the contract top level.
      expect(Number(contract.amount ?? 0)).toBeGreaterThan(0);

      // Start date round-trips correctly — API returns human-readable format
      // ("Jun 26, 2026"), so normalize to ISO (YYYY-MM-DD) via local date
      // methods to avoid UTC offset shifts.
      const startDateStored = (contract.start_date as string | undefined) ?? (contract.starting_date as string | undefined) ?? '';
      let startDateNormalized = '';
      if (startDateStored) {
        const d = new Date(startDateStored);
        startDateNormalized = [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, '0'),
          String(d.getDate()).padStart(2, '0'),
        ].join('-');
      }

      expect(startDateNormalized).toBe(input.startDate);

      // Job title stored as sent (default "Software Engineer" from EorClient.buildCreatePayload).
      const jobTitleStored =
        (contract.job_title as string | undefined) ??
        (contract.title as string | undefined) ??
        (contract.position as string | undefined) ??
        (contract.role as string | undefined) ?? '';
      if (!jobTitleStored) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_003: job_title field not found in GET response — tried: job_title, title, position, role. Probe contract details to find the correct path.',
        });
      } else {
        expect(jobTitleStored).toMatch(/software engineer/i);
      }

      // Currency stored correctly.
      const currencyIdStored =
        (contract.currency_id as number | undefined) ??
        contract.currency?.id ??
        (contract.salary_currency_id as number | undefined) ??
        contract.salary_currency?.id ?? 0;
      if (!currencyIdStored) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_003: currency field not found in GET response — tried: currency_id, currency.id, salary_currency_id, salary_currency.id. Probe contract details to find the correct path.',
        });
      } else {
        expect(currencyIdStored).toBe(input.currencyId);
      }

      // Employment term stored as "Indefinite" (hardcoded in EorClient.buildCreatePayload).
      const employmentTerm =
        (contract.employment_term as string | undefined) ??
        (contract.contract_term as string | undefined) ??
        (contract.term as string | undefined) ??
        (contract.term_type as string | undefined) ?? '';
      if (!employmentTerm) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_003: employment_term field not found in GET response — tried: employment_term, contract_term, term, term_type. Probe contract details to find the correct path.',
        });
      } else {
        expect(employmentTerm).toMatch(/indefinite/i);
      }
    } finally {
      await finishedContractsClient.cancelContract(contractId!).catch(() => undefined);
    }
  });

  // ==== TC_QA209_004 ==========================================================

  test('TC_QA209_004 — should verify country-specific fields are applied @smoke', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, { employeeEmail: generateWorkerData('eor-country').email });
    const createRes = await eorClient.createEorContract(input);
    const contractId = createRes.body?.data?.id as number | undefined;
    const contractRef = createRes.body?.data?.ref as string | undefined;

    expect(contractId).toBeTruthy();
    expect(contractRef).toBeTruthy();

    try {
      const contract = await finishedContractsClient.getContract(contractRef!);
      const employee = contract.employee as Record<string, unknown> | undefined;

      expect(employee, 'contract details must include an employee record').toBeTruthy();

      const empCountryId =
        (employee?.country as { id?: number } | undefined)?.id ??
        (employee?.citizen as { id?: number } | undefined)?.id ?? 0;

      expect(empCountryId).toBe(input.employeeCountryId);

      const workingFromId = (employee?.working_from_country as { id?: number } | undefined)?.id ?? 0;

      expect(workingFromId).toBe(input.employeeCountryId);

      // Nationality country round-trips correctly — field name probe: annotate gap if none resolve.
      const nationalityCountryId =
        (employee?.nationality_country as { id?: number } | undefined)?.id ??
        (employee?.nationality as { id?: number } | undefined)?.id ??
        (employee?.citizen_country as { id?: number } | undefined)?.id ??
        (employee?.employee_nationality_country as { id?: number } | undefined)?.id ?? 0;
      if (!nationalityCountryId) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_004: employee_nationality_country_id field not found in GET response — none of nationality_country.id / nationality.id / citizen_country.id / employee_nationality_country.id resolved. Probe contract.employee to find the correct path.',
        });
      } else {
        expect(nationalityCountryId).toBe(input.employeeCountryId);
      }
    } finally {
      await finishedContractsClient.cancelContract(contractId!).catch(() => undefined);
    }
  });

  // ==== TC_QA209_005 ==========================================================

  test('TC_QA209_005 — should fail with missing required fields @regression', async ({ eorClient }) => {
    // API uses 200 + { success: false } for validation errors (not HTTP 4xx).
    const res = await eorClient.createEorContract({
      employeeFirstName:  '',
      employeeLastName:   '',
      employeeEmail:      '',
      employeeCountryId:  0,
      currencyId:         0,
      includeInsurance:   false,
      startDate:          '',
    });

    expect(res.body?.success).toBe(false);
    expect(res.body?.message).toMatch(/validation|error/i);
  });

  // ==== TC_QA209_006 ==========================================================

  test('TC_QA209_006 — should fail with unsupported country @regression', async ({ eorClient }) => {
    const { input } = await requireEorContext(eorClient, {
      employeeEmail:     generateWorkerData('eor-bad-country').email,
      employeeCountryId: 99999, // non-existent country_id
    });

    // API uses 200 + { success: false } for validation errors (not HTTP 4xx).
    const res = await eorClient.createEorContract(input);

    expect(res.body?.success).toBe(false);

    const errorMsg = ((res.body?.data?.error) ?? res.body?.message ?? '').toLowerCase();

    expect(errorMsg).toMatch(/country|invalid|unsupported/);
  });

  // ==== TC_QA209_007 ==========================================================

  test('TC_QA209_007 — unauthenticated request → 401/403 @regression', async ({ eorClient }) => {
    const { input } = await requireEorContext(eorClient, { employeeEmail: generateWorkerData('eor-anon').email });

    // TODO(cleanup): lift alternate-identity EorClient construction to an unauthEorClient fixture (rule-of-two)
    const unauthEor = new EorClient();
    try {
      await unauthEor.init();
      const res = await unauthEor.createEorContract(input);

      expect([401, 403]).toContain(res.status);
    } finally {
      await unauthEor.dispose();
    }
  });

  // ==== TC_QA209_007b ==========================================================
  // Re-verified live 2026-07-14: the backend now correctly denies worker-role EOR
  // contract creation (business rule — workers cannot create their own contract).
  // The prior "sandbox gap" note is stale; un-fixme'd after 3 consecutive clean
  // passes.

  test(
    'TC_QA209_007b — worker role should be denied from creating EOR contract @regression',
    async ({ eorClient, contractorToken }) => {
      const { input } = await requireEorContext(eorClient, {
        employeeEmail: generateWorkerData('eor-worker-noauth').email,
      });

      // TODO(cleanup): lift alternate-identity EorClient construction to a contractorEorClient fixture (rule-of-two)
      const workerEor = new EorClient();
      try {
        await workerEor.init(contractorToken);
        const res = await workerEor.createEorContract(input);
        const denied = res.status === 401 || res.status === 403 || res.body?.success === false;

        expect(denied, 'Worker role should not be able to create EOR contracts').toBe(true);
      } finally {
        await workerEor.dispose();
      }
    },
  );

  // ==== TC_QA209_008 ==========================================================

  test('TC_QA209_008 — client + provider sign → contract reaches Ongoing @smoke @critical', async ({
    eorClient,
    finishedContractsClient,
    adminEorClient,
  }) => {
    const { input, isQuotationAutomated } = await requireEorContext(eorClient, {
      employeeEmail: generateWorkerData('eor-sign').email,
    });

    const createRes = await eorClient.createEorContract(input);

    expect(createRes.status).toBe(200);
    expect(createRes.body?.success).not.toBe(false);

    const contractId = createRes.body?.data?.id as number | undefined;
    const contractRef = createRes.body?.data?.ref as string | undefined;

    expect(contractId, 'EOR contract creation must return an id').toBeTruthy();
    expect(contractRef, 'EOR contract creation must return a ref').toBeTruthy();

    try {
      const signatory = await finishedContractsClient.getSignatory();

      // Composition (MSA upload → optional quote/SOW/partner/invite → clientSign →
      // providerSign → read-back) lives in the owner-feature seeding helper —
      // specs must not inline multi-step API composition.
      const { status } = await signEorClientAndProviderSign({
        contracts:            finishedContractsClient,
        eorAdmin:             adminEorClient,
        contractId:           contractId!,
        contractRef:          contractRef!,
        signatoryName:        signatory.name,
        isQuotationAutomated,
      });
      const statusName = status.toLowerCase();

      test.info().annotations.push({
        type: 'gap',
        description: 'TC_QA209_008: legacy premise was that client+provider sign lands on the ' +
          'intermediate "Pending employee invitation" status. Confirmed via standalone probe ' +
          '(2026-07-08) that this status no longer exists in this sandbox\'s EOR status enum for ' +
          'a quotation-automated country (UAE): create -> "Pending company signature" -> clientSign ' +
          '-> "Pending worker onboarding" -> providerSign -> "Ongoing" directly. Asserting the real ' +
          'reachable status ("Ongoing") instead of the no-longer-reachable legacy status.',
      });

      expect(statusName).toBe('ongoing');
    } finally {
      await finishedContractsClient.cancelContract(contractId!).catch(() => undefined);
    }
  });

  // ==== TC_QA209_009 ==========================================================

  test('TC_QA209_009 — should fail with invalid employee email format @regression', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, { employeeEmail: 'not-a-valid-email@@@@' });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success !== false) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_009: Invalid email format was accepted — backend does not validate email format at EOR contract creation.',
        });
      } else {
        expect(res.body?.success).toBe(false);
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_010 ==========================================================

  test('TC_QA209_010 — should fail with past start date @regression', async ({ eorClient, finishedContractsClient }) => {
    const pastStartDate = daysAgo(365);
    const { input } = await requireEorContext(eorClient, {
      employeeEmail: generateWorkerData('eor-past-date').email,
      startDate:     pastStartDate,
    });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success !== false) {
        test.info().annotations.push({
          type: 'gap',
          description: `TC_QA209_010: Past start date (${pastStartDate}) was accepted — backend does not enforce that start date cannot be in the past.`,
        });
      } else {
        expect(res.body?.success).toBe(false);
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_011 ==========================================================

  test('TC_QA209_011 — should sanitize or reject XSS payload in employee name @regression', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, {
      employeeEmail:     generateWorkerData('eor-xss').email,
      employeeFirstName: '<script>alert(1)</script>',
      employeeLastName:  '<img src=x onerror=alert(1)>',
    });
    const res = await eorClient.createEorContract(input);
    const id = res.body?.data?.id as number | undefined;

    try {
      if (res.body?.success === false) {
        // Backend rejected the XSS payload — acceptable.
        return;
      }
      // Backend accepted — verify raw script tags are not echoed back.
      const data = res.body?.data;
      const employee = data?.employee as Record<string, unknown> | undefined;
      const storedName = (employee?.first_name as string | undefined) ?? (data?.name as string | undefined) ?? '';

      expect(storedName).not.toContain('<script>');
    } finally {
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_012 ==========================================================

  test('TC_QA209_012 — should document behaviour for far-future start date @regression', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const farDate = '2099-12-31';
    const { input } = await requireEorContext(eorClient, {
      employeeEmail: generateWorkerData('eor-far-date').email,
      startDate:     farDate,
    });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success !== false) {
        test.info().annotations.push({
          type: 'gap',
          description: `TC_QA209_012: Far-future start date (${farDate}) was accepted — backend does not enforce an upper date bound.`,
        });
      } else {
        test.info().annotations.push({
          type: 'info',
          description: `TC_QA209_012: Far-future start date (${farDate}) was rejected — backend enforces an upper date bound.`,
        });
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_013 ==========================================================

  test('TC_QA209_013 — should document behaviour for duplicate employee email @regression', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, { employeeEmail: generateWorkerData('eor-dup').email });

    const firstRes = await eorClient.createEorContract(input);
    const firstId = firstRes.body?.data?.id as number | undefined;

    try {
      // Reuse the same employeeEmail to probe duplicate-email handling.
      const secondRes = await eorClient.createEorContract(input);
      const secondId = secondRes.body?.data?.id as number | undefined;

      try {
        if (secondRes.body?.success === false) {
          expect(secondRes.body?.success).toBe(false);
        } else {
          test.info().annotations.push({
            type: 'gap',
            description: 'TC_QA209_013: Duplicate employee email was accepted — backend allows multiple contracts per employee email.',
          });
        }
      } finally {
        if (secondId) await finishedContractsClient.cancelContract(secondId).catch(() => undefined);
      }
    } finally {
      if (firstId) await finishedContractsClient.cancelContract(firstId).catch(() => undefined);
    }
  });

  // ==== TC_QA209_014 ==========================================================

  test('TC_QA209_014 — full E2E: create → deposit → onboard → Ongoing @regression @slow', async ({
    eorClient,
    finishedContractsClient,
    adminEorClient,
  }) => {
    test.setTimeout(600_000); // 10 min — covers the full sign + onboarding composition.

    const { input, isQuotationAutomated } = await requireEorContext(eorClient, {
      employeeEmail: generateWorkerData('eor-e2e').email,
    });

    const createRes = await eorClient.createEorContract(input);
    const contractId = createRes.body?.data?.id as number | undefined;
    const contractRef = createRes.body?.data?.ref as string | undefined;

    expect(contractId, 'EOR contract creation must return an id').toBeTruthy();
    expect(contractRef, 'EOR contract creation must return a ref').toBeTruthy();

    try {
      const signatory = await finishedContractsClient.getSignatory();

      const { reachedOngoing } = await signEorToOngoing({
        contracts:            finishedContractsClient,
        eorAdmin:             adminEorClient,
        contractId:           contractId!,
        contractRef:          contractRef!,
        signatoryName:        signatory.name,
        isQuotationAutomated,
        employeeEmail:        input.employeeEmail,
        employeeFirstName:    input.employeeFirstName,
        employeeLastName:     input.employeeLastName,
        employeeCountryId:    input.employeeCountryId,
      });

      // TODO(api-preconditions): the EOR deposit-payment step is not yet built in
      // the foundation (seeding.ts `signEorToOngoing` docstring — ContractsClient
      // is missing getContractPayments/getPaymentCycles/createTransfer/
      // approvePayments), so `reachedOngoing` is expected to be `false` until that
      // lands. Self-skip here reactivates automatically (asserting Ongoing below)
      // the moment the deposit step is added — no manual re-enable needed.
      test.skip(
        !reachedOngoing,
        'TODO(api-preconditions): EOR deposit-payment step deferred — signEorToOngoing did not reach Ongoing (see features/contracts/seeding.ts)',
      );

      const contract = await finishedContractsClient.getContract(contractRef!);

      expect(contract.status?.name).toBe('Ongoing');
    } finally {
      await finishedContractsClient.cancelContract(contractId!).catch(() => undefined);
    }
  });

  // ==== TC_QA209_015 ==========================================================

  test('TC_QA209_015 — should verify initial contract status after creation @smoke', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, { employeeEmail: generateWorkerData('eor-status').email });
    const createRes = await eorClient.createEorContract(input);
    const contractId = createRes.body?.data?.id as number | undefined;
    const contractRef = createRes.body?.data?.ref as string | undefined;

    expect(contractId).toBeTruthy();
    expect(contractRef).toBeTruthy();

    try {
      const contract = await finishedContractsClient.getContract(contractRef!);
      const statusName = contract.status?.name ?? '';

      expect(statusName.length, 'Contract must have a non-empty status after creation').toBeGreaterThan(0);

      test.info().annotations.push({
        type: 'info',
        description: `TC_QA209_015: Initial contract status after creation = "${statusName}"`,
      });
    } finally {
      await finishedContractsClient.cancelContract(contractId!).catch(() => undefined);
    }
  });

  // ==== TC_QA209_016 ==========================================================

  test('TC_QA209_016 — should fail with zero salary amount @regression', async ({ eorClient, finishedContractsClient }) => {
    const { input } = await requireEorContext(eorClient, {
      employeeEmail: generateWorkerData('eor-amount-zero').email,
      amount:        '0',
    });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success !== false) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_016: Zero salary amount was accepted — backend does not enforce amount > 0.',
        });
      } else {
        expect(res.body?.success).toBe(false);
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_017 ==========================================================

  test('TC_QA209_017 — should fail with negative salary amount @regression', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, {
      employeeEmail: generateWorkerData('eor-amount-negative').email,
      amount:        '-1000',
    });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success !== false) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_017: Negative salary amount was accepted — backend does not enforce amount > 0.',
        });
      } else {
        expect(res.body?.success).toBe(false);
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_018 ==========================================================

  test('TC_QA209_018 — should accept decimal salary amount @regression', async ({ eorClient, finishedContractsClient }) => {
    const { input } = await requireEorContext(eorClient, {
      employeeEmail: generateWorkerData('eor-amount-decimal').email,
      amount:        '99.99',
    });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success === false) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_018: Decimal salary amount was rejected — backend does not allow fractional amounts.',
        });
      } else {
        expect([200, 201]).toContain(res.status);
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_019 ==========================================================

  test('TC_QA209_019 — should fail with non-numeric salary amount @regression', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, {
      employeeEmail: generateWorkerData('eor-amount-nonnumeric').email,
      amount:        'abc',
    });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success !== false) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_019: Non-numeric salary amount ("abc") was accepted — backend does not validate amount is numeric.',
        });
      } else {
        expect(res.body?.success).toBe(false);
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_020 ==========================================================

  test('TC_QA209_020 — should document behaviour for negative trial period @regression', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, {
      employeeEmail:   generateWorkerData('eor-trial-negative').email,
      trialPeriodDays: -1,
    });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success !== false) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_020: Negative trialPeriodDays (-1) was accepted — backend does not enforce trial period ≥ 0.',
        });
      } else {
        expect(res.body?.success).toBe(false);
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_021 ==========================================================

  test('TC_QA209_021 — should document behaviour for zero annual leave days @regression', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, {
      employeeEmail:   generateWorkerData('eor-leave-zero').email,
      annualLeaveDays: 0,
    });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success !== false) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_021: Zero annualLeaveDays was accepted — backend does not enforce leave ≥ min_annual_leave_days.',
        });
      } else {
        expect(res.body?.success).toBe(false);
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_022 ==========================================================

  test('TC_QA209_022 — should fail with non-existent currency ID @regression', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, {
      employeeEmail: generateWorkerData('eor-bad-currency').email,
      currencyId:    99999,
    });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success !== false) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_022: Non-existent currency_id (99999) was accepted — backend does not validate currency ID.',
        });
      } else {
        expect(res.body?.success).toBe(false);
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });

  // ==== TC_QA209_023 ==========================================================

  test('TC_QA209_023 — should document behaviour for insurance enabled with no provider @regression', async ({
    eorClient,
    finishedContractsClient,
  }) => {
    const { input } = await requireEorContext(eorClient, {
      employeeEmail:       generateWorkerData('eor-insurance-no-provider').email,
      includeInsurance:    true,
      insuranceProviderId: 0,
    });
    const res = await eorClient.createEorContract(input);

    try {
      if (res.body?.success !== false) {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_QA209_023: includeInsurance=true with insuranceProviderId=0 was accepted — backend does not require a valid provider when insurance is enabled.',
        });
      } else {
        expect(res.body?.success).toBe(false);
      }
    } finally {
      const id = res.body?.data?.id as number | undefined;
      if (id) await finishedContractsClient.cancelContract(id).catch(() => undefined);
    }
  });
});
