import { test as contractsTest, expect } from '@features/contracts/fixtures';
import { isDbEnvPresent } from '@core/db/db-config';
import { AdminClient } from '@features/admin/api-client';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { DeClient } from '@features/contracts/clients/de-client';
import { EorClient } from '@features/contracts/clients/eor-client';
import {
  signContractorToOngoing,
  createCorContractViaApi,
  signCorToOngoing,
  createDeEntity,
  signDeToOngoing,
  signEorClientAndProviderSign,
} from '@features/contracts/seeding';
import { CONTRACTS_TEST_DOCUMENT_PDF, SANDBOX_TAX_RESIDENCE_UAE } from '@features/contracts/constants';
import { generateUaeIban, generateWorkerData } from '@utils/data/user-faker';
import type { FixedContractPage as FixedContractPageType } from '@features/contracts/pages/frontoffice/FixedContractPage';
import type { PaygContractPage as PaygContractPageType } from '@features/contracts/pages/frontoffice/PaygContractPage';
import type { MilestonesContractPage as MilestonesContractPageType } from '@features/contracts/pages/frontoffice/MilestonesContractPage';

/**
 * Contracts UI — Full Cycle to Ongoing (combined, multi-type).
 *
 * Ported (intent, not implementation) from
 * tests/modules/contracts/ui/verify/full-cycle.spec.ts.
 *
 * UI-lane counterpart to `tests/api/full-cycle.spec.ts`. Each contract type is
 * CREATED through its real wizard Page Object, then driven to Ongoing (via the
 * owner-feature seeding composition — never inlined), and the Ongoing badge is
 * asserted back on `contractDetailPage`. Composes the EXISTING per-type
 * wizard POMs (`fixedContractPage`/`paygContractPage`/`milestonesContractPage`/
 * `deContractPage`/`eorContractPage`) and seeding helpers — no lifecycle logic
 * is rebuilt here.
 *
 * Coverage, mirroring legacy:
 *   - Fixed / PAYG / Milestone: created via their wizards, signed to Ongoing
 *     via the DB-OTP self-signup contractor flow (`seedContractorWorker` +
 *     `signContractorToOngoing`) — gated by `isDbEnvPresent()` + the worker
 *     null sentinel (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md),
 *     same as create-fixed-contract.spec.ts TC_UI_FIX_008.
 *   - COR (Fixed): the wizard toggle can't be activated on this seeded sandbox
 *     account (enableCor sets is_cor_enabled but the toggle needs additional
 *     COR-provider onboarding with no automation hook — same limitation
 *     documented in create-cor-contract.spec.ts) — created via
 *     `createCorContractViaApi`, signed via `signCorToOngoing` (same DB-OTP
 *     gate as the contractor types), then the Ongoing badge is asserted on
 *     `contractDetailPage` — the UI still verifies the outcome.
 *   - DE / EOR: created via their real wizards (`deContractPage`/
 *     `eorContractPage`), then driven to Ongoing via the invite-token
 *     self-service flow (`signDeToOngoing`/`signEorClientAndProviderSign`) —
 *     NOT DB-OTP-gated (mirrors create-de-contract.spec.ts /
 *     create-eor-contract.spec.ts UI-lane siblings).
 *
 * Fixture choice: everything runs on the shared worker-scoped `clientAccount`
 * (same rationale as every other Batch UI spec in this feature — the static
 * account already has a signatory + contract templates). COR and Direct
 * Employee are company-level, idempotent admin toggles — enabled once per
 * worker via the local `corEnabled`/`deEnabled` auto fixtures below, mirroring
 * create-cor-contract.spec.ts / create-de-contract.spec.ts.
 */

const UAE_COUNTRY_ID = SANDBOX_TAX_RESIDENCE_UAE;

const test = contractsTest.extend<
  { deClientOnClient: DeClient; eorClientOnClient: EorClient },
  { corEnabled: boolean; deEnabled: boolean }
>({
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

  deEnabled: [
    async ({ clientAccount }, use) => {
      const contracts = new ContractsClient();
      const admin = new AdminClient();
      try {
        await contracts.init(clientAccount.token);
        await admin.initWithAdminToken();
        const companyId = await contracts.getCompanyId();
        await admin.enableDirectEmployee(companyId);
      } finally {
        await contracts.dispose();
        await admin.dispose();
      }
      await use(true);
    },
    { scope: 'worker', auto: true },
  ],

  deClientOnClient: async ({ clientAccount }, use) => {
    const client = new DeClient();
    await client.init(clientAccount.token);
    await use(client);
    await client.dispose();
  },

  eorClientOnClient: async ({ clientAccount }, use) => {
    const client = new EorClient();
    await client.init(clientAccount.token);
    await use(client);
    await client.dispose();
  },
});

const WIZARD_DATA = {
  taxCountry: 'United Arab Emirates',
  scope: 'Full-cycle automation scope of work.',
  rate: 1000,
};

// Local tuple (no shared `interface` declared in a spec — see layer-responsibilities.md):
// [type, create-via-the-matching-wizard-POM]. Each `create` fn only touches the
// one POM it needs; the other two args are unused per-branch.
const CONTRACTOR_TASKS = [
  {
    type: 'Fixed' as const,
    create: (fixedContractPage: FixedContractPageType, _payg: PaygContractPageType, _milestones: MilestonesContractPageType, role: string) =>
      fixedContractPage.createFixedContract({ ...WIZARD_DATA, role }),
  },
  {
    type: 'PAYG' as const,
    create: (_fixed: FixedContractPageType, paygContractPage: PaygContractPageType, _milestones: MilestonesContractPageType, role: string) =>
      paygContractPage.createPaygContract({ ...WIZARD_DATA, rate: 50, role }),
  },
  {
    type: 'Milestone' as const,
    create: (_fixed: FixedContractPageType, _payg: PaygContractPageType, milestonesContractPage: MilestonesContractPageType, role: string) =>
      milestonesContractPage.createMilestonesContract({
        taxCountry: WIZARD_DATA.taxCountry,
        scope: WIZARD_DATA.scope,
        role,
        milestones: [
          { name: 'Phase 1', amount: 500 },
          { name: 'Phase 2', amount: 500 },
        ],
      }),
  },
];

function nextMonthStartDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString().split('T')[0];
}

test.describe('Contracts UI — Full Cycle to Ongoing @ui @regression', () => {

  // ==== Fixed / PAYG / Milestone contractor → Ongoing =======================

  for (const task of CONTRACTOR_TASKS) {
    test(`Full cycle (UI) — ${task.type} wizard → Ongoing @critical @slow`, async ({
      fixedContractPage,
      paygContractPage,
      milestonesContractPage,
      contractsClient,
      contractDetailPage,
      seedContractorWorker,
    }) => {
      test.setTimeout(240_000);
      test.skip(
        !isDbEnvPresent(),
        'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
      );

      const worker = await seedContractorWorker(`fullcycle-ui-${task.type.toLowerCase()}`);
      test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

      const role = `QA FC ${task.type} ${Date.now()}`;
      const ref = await task.create(fixedContractPage, paygContractPage, milestonesContractPage, role);

      expect(ref, `${task.type} wizard should produce a contract ref in the URL after creation`).toBeTruthy();

      const created = await contractsClient.getContract(ref!);
      try {
        const signatory = await contractsClient.getSignatory();

        const reachedOngoing = await signContractorToOngoing({
          contracts:     contractsClient,
          contractId:    created.id,
          contractRef:   ref!,
          worker:        worker!,
          signatoryName: signatory.name,
        });

        expect(reachedOngoing).toBe(true);

        await contractDetailPage.gotoContractDetail(created.id);

        await expect(contractDetailPage.ongoingBadge).toBeVisible();
      } finally {
        await contractsClient.cancelContract(created.id).catch(() => undefined);
      }
    });
  }

  // ==== COR (Fixed) → Ongoing badge ==========================================

  test('Full cycle (UI) — COR (Fixed) → Ongoing badge @critical @slow', async ({
    contractsClient,
    paymentClient,
    adminClient,
    contractDetailPage,
    seedContractorWorker,
  }) => {
    test.setTimeout(300_000);
    test.skip(
      !isDbEnvPresent(),
      'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
    );

    const worker = await seedContractorWorker('fullcycle-ui-cor');
    test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

    // COR's wizard toggle can't be activated on this seeded sandbox account
    // (create-cor-contract.spec.ts JSDoc) — created via the API, verified via
    // the UI detail page's Ongoing badge, same as that spec's TC_UI_COR_011.
    const created = await createCorContractViaApi(contractsClient, { type: 'Fixed' });
    try {
      const signatory = await contractsClient.getSignatory();

      const result = await signCorToOngoing({
        contracts:      contractsClient,
        payments:       paymentClient,
        admin:          adminClient,
        contractId:     created.id,
        contractRef:    created.ref,
        worker:         worker!,
        signatoryName:  signatory.name,
        processDeposit: true,
      });

      if (result.depositGap) {
        test.info().annotations.push({
          type: 'gap',
          description: `Full cycle (UI) COR: deposit path incomplete (${result.depositGap}) — documented gap, mirrors TC_COR_012`,
        });
      }

      expect(result.reachedOngoing).toBe(true);

      await contractDetailPage.gotoContractDetail(created.id);

      await expect(contractDetailPage.ongoingBadge).toBeVisible();
    } finally {
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });

  // ==== DE wizard → Ongoing ===================================================

  test('Full cycle (UI) — DE wizard → Ongoing @critical @slow', async ({
    deContractPage,
    contractsClient,
    contractDetailPage,
    deClientOnClient,
  }) => {
    test.fixme(true, 'QA-443: DE wizard full-cycle-to-Ongoing fails — QA-457');
    test.setTimeout(300_000);

    const entity = await createDeEntity(deClientOnClient);
    test.skip(
      !entity,
      'DE_ENTITY_JURISDICTION_ABSENT — sandbox has no DE jurisdiction for UAE (self-skip, see DeClient.getJurisdictions / seeding.createDeEntity)',
    );
    // `createDeEntity`'s response doesn't include `name` — resolve it via a
    // follow-up read for the wizard's entity dropdown (mirrors
    // create-de-contract.spec.ts's `requireDeEntity`).
    const rawEntity = await deClientOnClient.getEntity(entity!.id);
    const entityName = (rawEntity.name as string | undefined) ?? '';

    try {
      const worker = generateWorkerData('fullcycle-ui-de');
      const ref = await deContractPage.createDEContract({
        jobTitle:       'Software Engineer',
        salary:         5000,
        employmentTerm: 'Indefinite',
        employmentType: 'Full-time',
        employeeId:     `EMP-FC-${Date.now()}`,
        entityName,
        pdfPath:        CONTRACTS_TEST_DOCUMENT_PDF,
      });

      expect(ref, 'DE wizard should produce a contract ref in the URL after creation').toBeTruthy();

      const created = await contractsClient.getContract(ref!);
      try {
        const signatory = await contractsClient.getSignatory();
        const { invitationUrl } = await contractsClient.inviteContractor(created.id, worker.email);

        const { reachedOngoing } = await signDeToOngoing({
          contracts:          contractsClient,
          de:                 deClientOnClient,
          contractId:         created.id,
          contractRef:        ref!,
          signatoryName:      signatory.name,
          invitationUrl,
          employeeOnboarding: {
            firstName: worker.firstName,
            lastName:  worker.lastName,
            email:     worker.email,
            countryId: entity!.countryId,
            phone:     worker.phone,
            password:  `QaDe${Date.now()}!`,
          },
          employeeCountryId: entity!.countryId,
          molIdCardPath:     CONTRACTS_TEST_DOCUMENT_PDF,
          documentNumber:    `QA${Date.now()}`,
          molId:             `1${Date.now()}`, // 14 digits, must start with 1 (UAE WPS format)
          iban:              generateUaeIban(),
        });

        expect(reachedOngoing).toBe(true);

        await contractDetailPage.gotoContractDetail(created.id);

        await expect(contractDetailPage.ongoingBadge).toBeVisible();
      } finally {
        await contractsClient.cancelContract(created.id).catch(() => undefined);
      }
    } finally {
      await deClientOnClient.deleteEntity(entity!.id).catch(() => undefined);
    }
  });

  // ==== EOR wizard → Ongoing ===================================================

  test('Full cycle (UI) — EOR wizard → Ongoing @critical @slow', async ({
    eorContractPage,
    contractsClient,
    adminEorClient,
    contractDetailPage,
    eorClientOnClient,
  }) => {
    test.setTimeout(300_000);

    const regionalConfig = await eorClientOnClient.getRegionalConfig(UAE_COUNTRY_ID);
    test.skip(
      !regionalConfig,
      'EOR_REGIONAL_CONFIG_ABSENT — sandbox has no EOR regional config for UAE (self-skip, see EorClient.getRegionalConfig)',
    );

    const worker = generateWorkerData('fullcycle-ui-eor');
    const ref = await eorContractPage.createEorContract({
      country:         WIZARD_DATA.taxCountry,
      salary:          '5000',
      firstName:       worker.firstName,
      lastName:        worker.lastName,
      email:           worker.email,
      nationality:     WIZARD_DATA.taxCountry,
      startDate:       nextMonthStartDate(),
      jobTitle:        'QA Automation Engineer',
      jobDescription:  'QA automation and software quality assurance responsibilities',
      employmentTerm:  'Indefinite',
      employmentType:  'Full-time',
      annualLeaveDays: 21,
      trialPeriodDays: 30,
    });

    expect(ref, 'EOR wizard should produce a contract ref in the URL after creation').toBeTruthy();

    const created = await contractsClient.getContract(ref!);
    try {
      const signatory = await contractsClient.getSignatory();

      const { status } = await signEorClientAndProviderSign({
        contracts:            contractsClient,
        eorAdmin:             adminEorClient,
        contractId:           created.id,
        contractRef:          ref!,
        signatoryName:        signatory.name,
        isQuotationAutomated: regionalConfig!.is_quotation_automation_enabled ?? false,
      });

      expect(status.toLowerCase()).toBe('ongoing');

      await contractDetailPage.gotoContractDetail(created.id);

      await expect(contractDetailPage.ongoingBadge).toBeVisible();
    } finally {
      // EOR contracts have no client-side cancel endpoint — best-effort only.
      await contractsClient.cancelContract(created.id).catch(() => undefined);
    }
  });
});
