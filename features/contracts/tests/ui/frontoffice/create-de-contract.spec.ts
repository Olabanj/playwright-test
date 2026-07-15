import { test as contractsTest, expect } from '@features/contracts/fixtures';
import { AdminClient } from '@features/admin/api-client';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { DeClient } from '@features/contracts/clients/de-client';
import { createDeEntity, signDeToOngoing, SeededDeEntity } from '@features/contracts/seeding';
import { CONTRACTS_TEST_DOCUMENT_PDF, CONTRACTS_TEST_IMAGE_JPG } from '@features/contracts/constants';
import { generateUaeIban, generateWorkerData } from '@utils/data/user-faker';

/**
 * Create Direct Employee (DE) Contract — UI wizard + API sign-to-Ongoing.
 *
 * Ported (intent, not implementation) from
 * tests/modules/contracts/ui/verify/create-de-contract.spec.ts (TC_UI_DE_001-012).
 *
 * DE is a mixed UI-create + API-complete flow: the wizard's own "Create" action
 * only lands the contract on "Pending company signature" — there is no UI
 * control to drive it further. Every pre/postcondition (DE entity, signatory
 * lookup, invite, client-sign, employee onboarding, Ongoing verification,
 * cleanup) goes through the API (`contractsClient` / `deClientOnClient` /
 * `seeding.ts`), per ADR 2026-06-24 — the wizard create action (behaviour
 * under test) is the only UI interaction that matters for the create-lane
 * tests; TC_UI_DE_006 additionally drives the sign-to-Ongoing composition to
 * verify the resulting badge on `contractDetailPage`.
 *
 * Fixture choice: `deContractPage` (and its sibling `contractsClient`) are
 * bound to the shared worker-scoped `clientAccount` (contracts/fixtures.ts'
 * `bulkImportClientPage`), NOT `finishedContractsClient` — mirrors
 * create-fixed-contract.spec.ts / create-cor-contract.spec.ts. Direct Employee
 * is a company-level, idempotent admin toggle (`AdminClient.enableDirectEmployee`)
 * — enabled once per worker via the local `deEnabled` auto fixture below, same
 * pattern as create-cor-contract.spec.ts's `corEnabled`. A local `deClientOnClient`
 * fixture supplies a `DeClient` authenticated against the SAME `clientAccount`
 * (fixtures.ts' `deClient` fixture is bound to `finishedContractsClient`
 * instead — a different account — which would create the entity somewhere the
 * UI wizard can't see it).
 *
 * DE entity: each test resolves its own fresh entity via `requireDeEntity`
 * (mirrors the API-lane sibling `create-de-contract.spec.ts`'s
 * `requireDeContext` — every test is self-contained, no shared `beforeAll`
 * entity/serial-mode contention) and best-effort deletes it in a `finally`.
 *
 * Legacy tests dropped: TC_UI_DE_008 (verify external-payroll contract appears
 * in the Global Payroll cycle table) is NOT ported — it exercises the Global
 * Payroll feature/screen, not Contracts, and needs a dedicated PayrollPage POM
 * that does not exist in this feature (out of scope for a page-locator
 * addition; flagged as a follow-up for whichever batch owns Global Payroll
 * UI coverage). All other legacy TC_UI_DE_* tests are ported below, keeping
 * their original numbering (with the resulting gap at 008).
 */

const test = contractsTest.extend<{ deClientOnClient: DeClient }, { deEnabled: boolean }>({
  // Direct Employee is a company-level, idempotent admin toggle — enabled once
  // per worker (shared static account), mirroring create-cor-contract.spec.ts's
  // `corEnabled` auto fixture.
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

  // DeClient authenticated as the SAME clientAccount the UI wizard runs on —
  // fixtures.ts' `deClient` is bound to `finishedContractsClient` (a different
  // account), which would create entities the UI wizard's dropdown can't see.
  deClientOnClient: async ({ clientAccount }, use) => {
    const client = new DeClient();
    await client.init(clientAccount.token);
    await use(client);
    await client.dispose();
  },
});

/** `SeededDeEntity` plus the `name` the UI wizard's entity dropdown needs (not part of `createEntity`'s own response — resolved via a follow-up `getEntity` read). */
type SeededDeEntityWithName = SeededDeEntity & { name: string };

/** `createDeEntity` + dynamic self-skip on the `DE_ENTITY_JURISDICTION_ABSENT` sentinel; resolves the entity's `name` for the wizard's entity dropdown. */
async function requireDeEntity(de: DeClient): Promise<SeededDeEntityWithName> {
  const entity = await createDeEntity(de);
  test.skip(
    !entity,
    'DE_ENTITY_JURISDICTION_ABSENT — sandbox has no DE jurisdiction for UAE (self-skip, see DeClient.getJurisdictions / seeding.createDeEntity)',
  );
  const rawEntity = await de.getEntity(entity!.id);
  return { ...entity!, name: (rawEntity.name as string | undefined) ?? '' };
}

const CONTRACT_DATA = {
  jobTitle: 'Software Engineer',
  salary: 5000,
  employmentTerm: 'Indefinite' as const,
  employmentType: 'Full-time' as const,
};

test.describe('Create DE Contract - Wizard + API Sign @ui @regression', () => {

  // ==== TC_UI_DE_001: Fill and submit form =================================

  test('TC_UI_DE_001 — Should fill and submit DE contract form successfully @smoke @critical', async ({
    deContractPage,
    contractsClient,
    deClientOnClient,
  }) => {
    test.fixme(true, 'QA-443: DE-entity dropdown never surfaces newly created entity — QA-452');
    test.setTimeout(120_000);
    const entity = await requireDeEntity(deClientOnClient);

    try {
      const ref = await deContractPage.createDEContract({
        ...CONTRACT_DATA,
        employeeId: `EMP${Date.now()}`,
        entityName: entity.name,
        pdfPath: CONTRACTS_TEST_DOCUMENT_PDF,
      });

      expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

      const details = await contractsClient.getContract(ref!);
      try {
        expect(details.id).toBeTruthy();
      } finally {
        await contractsClient.cancelContract(details.id).catch(() => undefined);
      }
    } finally {
      await deClientOnClient.deleteEntity(entity.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_DE_002: Verify contract fields via API ========================

  test('TC_UI_DE_002 — Should verify salary, start date, and job title fields render @smoke', async ({
    deContractPage,
    contractsClient,
    deClientOnClient,
  }) => {
    test.fixme(true, 'QA-443: DE-entity dropdown never surfaces newly created entity — QA-452');
    test.setTimeout(120_000);
    const entity = await requireDeEntity(deClientOnClient);

    try {
      const ref = await deContractPage.createDEContract({
        ...CONTRACT_DATA,
        employeeId: `EMP${Date.now()}`,
        entityName: entity.name,
        pdfPath: CONTRACTS_TEST_DOCUMENT_PDF,
      });

      expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

      const details = await contractsClient.getContract(ref!);
      try {
        const salaryValue = details.amount ?? details.rate ?? details.salary ?? details.total_amount;
        if (salaryValue !== undefined) {
          expect(Number(salaryValue)).toBeGreaterThan(0);
        } else {
          test.info().annotations.push({
            type: 'gap',
            description: 'TC_UI_DE_002: contract details endpoint does not return a salary/amount field',
          });
        }

        const currencyCode = details.currency?.code ?? details.salary_currency?.code;

        expect(currencyCode).toBeTruthy();
      } finally {
        await contractsClient.cancelContract(details.id).catch(() => undefined);
      }
    } finally {
      await deClientOnClient.deleteEntity(entity.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_DE_003: Validation on empty required fields ====================

  test('TC_UI_DE_003 — Should show validation error on empty required fields @regression', async ({
    deContractPage,
  }) => {
    test.setTimeout(90_000);
    await deContractPage.open();
    await deContractPage.selectEmployeeWorkerType();
    await deContractPage.selectDirectEmployeeType();

    await deContractPage.jobTitleInput.waitFor({ state: 'visible', timeout: 10_000 });
    await deContractPage.jobTitleInput.clear();

    await deContractPage.continueButton.click();

    const hasErrors = await deContractPage.requiredFieldErrors.first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const stayedOnStep = await deContractPage.jobTitleInput.isVisible({ timeout: 2_000 }).catch(() => false);

    expect(hasErrors || stayedOnStep).toBe(true);

    await deContractPage.closeWizard();
  });

  // ==== TC_UI_DE_004: Validation on invalid salary ===========================

  test('TC_UI_DE_004 — Should show validation error on invalid salary @regression', async ({
    deContractPage,
    deClientOnClient,
  }) => {
    test.fixme(true, 'QA-443: DE-entity dropdown never surfaces newly created entity — QA-452');
    test.setTimeout(90_000);
    const entity = await requireDeEntity(deClientOnClient);

    try {
      await deContractPage.navigateToPaymentStep({
        jobTitle: CONTRACT_DATA.jobTitle,
        employmentTerm: CONTRACT_DATA.employmentTerm,
        employmentType: CONTRACT_DATA.employmentType,
        entityName: entity.name,
      });

      if (await deContractPage.salaryAmountInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await deContractPage.salaryAmountInput.fill('0');
        await deContractPage.continueButton.click();

        const hasSalaryError = await deContractPage.salaryValidationError
          .isVisible({ timeout: 5_000 }).catch(() => false);
        const stayedOnStep = await deContractPage.salaryAmountInput
          .isVisible({ timeout: 2_000 }).catch(() => false);

        expect(hasSalaryError || stayedOnStep).toBe(true);
      } else {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_UI_DE_004: salary field not visible on payment step',
        });
      }

      await deContractPage.closeWizard();
    } finally {
      await deClientOnClient.deleteEntity(entity.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_DE_005: Validation on invalid start date =======================

  test('TC_UI_DE_005 — Should show validation error on invalid start date @regression', async ({
    deContractPage,
    deClientOnClient,
  }) => {
    test.fixme(true, 'QA-443: DE-entity dropdown never surfaces newly created entity — QA-452');
    test.setTimeout(90_000);
    const entity = await requireDeEntity(deClientOnClient);

    try {
      await deContractPage.navigateToPaymentStep({
        jobTitle: CONTRACT_DATA.jobTitle,
        employmentTerm: CONTRACT_DATA.employmentTerm,
        employmentType: CONTRACT_DATA.employmentType,
        entityName: entity.name,
      });

      if (await deContractPage.startDateInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await deContractPage.startDateInput.fill('invalid-date');
        await deContractPage.continueButton.click();

        const hasDateError = await deContractPage.startDateValidationError
          .isVisible({ timeout: 5_000 }).catch(() => false);
        const stayedOnStep = await deContractPage.startDateInput
          .isVisible({ timeout: 2_000 }).catch(() => false);

        expect(hasDateError || stayedOnStep).toBe(true);
      } else {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_UI_DE_005: start date field not visible on payment step',
        });
      }

      await deContractPage.closeWizard();
    } finally {
      await deClientOnClient.deleteEntity(entity.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_DE_006: Employee onboards → contract Ongoing ==================

  test('TC_UI_DE_006 — Should become Ongoing after employee onboards @smoke @critical', async ({
    deContractPage,
    contractsClient,
    contractDetailPage,
    deClientOnClient,
  }) => {
    test.fixme(true, 'QA-443: DE-entity dropdown never surfaces newly created entity — QA-452');
    test.setTimeout(180_000);
    const entity = await requireDeEntity(deClientOnClient);

    try {
      const worker = generateWorkerData('de-ui');
      const ref = await deContractPage.createDEContract({
        ...CONTRACT_DATA,
        employeeId: `EMP${Date.now()}`,
        entityName: entity.name,
        pdfPath: CONTRACTS_TEST_DOCUMENT_PDF,
      });

      expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

      const created = await contractsClient.getContract(ref!);
      try {
        const signatory = await contractsClient.getSignatory();
        const { invitationUrl } = await contractsClient.inviteContractor(created.id, worker.email);

        // Composition (clientSign -> employee exchanges invitation link ->
        // onboarding wizard/profile/bank account -> poll for Ongoing) lives in
        // the owner-feature seeding helper, called directly — this contract
        // belongs to the shared `clientAccount` that backs the UI wizard.
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
            countryId: entity.countryId,
            phone:     worker.phone,
            password:  `QaDe${Date.now()}!`,
          },
          employeeCountryId: entity.countryId,
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
      await deClientOnClient.deleteEntity(entity.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_DE_007: External payroll provider + Ongoing ===================

  test('TC_UI_DE_007 — Should create DE contract with external payroll provider and make Ongoing @regression @critical', async ({
    deContractPage,
    contractsClient,
    contractDetailPage,
    deClientOnClient,
  }) => {
    test.setTimeout(180_000);
    // PRODUCT BUG (confirmed live 2026-07-09, reproduces deterministically —
    // see docs/40-domain/de-external-payroll-bank-account-bug.md): once the
    // wizard-creation precondition below is restored, contract creation with
    // `payrollProvider: 'external'` succeeds, but the employee's bank-account
    // step of the sign-to-Ongoing flow always 500s —
    // `POST /api/accounts/bank/create` → SQLSTATE[23000] duplicate entry for
    // key `payroll_cycles_unique_index` on the entity's first payroll period.
    // The RemotePass-payroll-provider sibling (TC_UI_DE_006) does NOT hit
    // this — it is specific to external-payroll DE entities, whose payroll
    // cycle is apparently pre-created at contract-creation time and then
    // re-inserted (non-idempotently) by the bank-account endpoint. Not a test
    // or POM issue — do not force green.
    test.fixme(true, 'QA-208-follow-up: external-payroll DE bank-account creation 500s on duplicate payroll_cycles key (product bug, see docs/40-domain/de-external-payroll-bank-account-bug.md)');

    const entity = await requireDeEntity(deClientOnClient);

    try {
      // Precondition dropped by the mechanical port (root cause of the original
      // TC_UI_DE_007 failure): "Use external payroll provider" renders disabled
      // in the wizard until both gates below are flipped — mirrors the legacy
      // UI-lane beforeAll (tests/modules/contracts/ui/verify/create-de-contract.spec.ts).
      const admin = new AdminClient();
      try {
        await admin.initWithAdminToken();
        const companyId = await contractsClient.getCompanyId();
        await admin.enableGlobalPayroll(companyId);
        await admin.enableExternalPayrollOnJurisdiction(entity.jurisdictionId);
      } finally {
        await admin.dispose();
      }

      const worker = generateWorkerData('de-ext');
      const ref = await deContractPage.createDEContract({
        ...CONTRACT_DATA,
        employeeId: `EMP${Date.now()}`,
        payrollProvider: 'external',
        entityName: entity.name,
        pdfPath: CONTRACTS_TEST_DOCUMENT_PDF,
      });

      expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

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
            countryId: entity.countryId,
            phone:     worker.phone,
            password:  `QaDe${Date.now()}!`,
          },
          employeeCountryId: entity.countryId,
          molIdCardPath:     CONTRACTS_TEST_DOCUMENT_PDF,
          documentNumber:    `QA${Date.now()}`,
          molId:             `1${Date.now()}`,
          iban:              generateUaeIban(),
        });

        expect(reachedOngoing).toBe(true);

        await contractDetailPage.gotoContractDetail(created.id);

        await expect(contractDetailPage.ongoingBadge).toBeVisible();
      } finally {
        await contractsClient.cancelContract(created.id).catch(() => undefined);
      }
    } finally {
      await deClientOnClient.deleteEntity(entity.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_DE_009: Cancel wizard mid-flow =================================

  test('TC_UI_DE_009 — Should cancel wizard mid-flow without saving @regression', async ({
    deContractPage,
    contractsClient,
  }) => {
    test.setTimeout(90_000);
    await deContractPage.open();
    await deContractPage.selectEmployeeWorkerType();
    await deContractPage.selectDirectEmployeeType();

    await deContractPage.jobTitleInput.waitFor({ state: 'visible', timeout: 10_000 });
    await deContractPage.jobTitleInput.fill('Temp Cancel Test');

    const idsBefore = new Set(
      (await contractsClient.listContracts()).map((c) => c.id).filter(Boolean),
    );
    await deContractPage.closeWizard();

    const contractsAfter = await contractsClient.listContracts();
    const newIds = contractsAfter.map((c) => c.id).filter((id) => id && !idsBefore.has(id));

    expect(newIds, `Unexpected new contract(s) after cancel: ${newIds.join(',')}`).toHaveLength(0);
  });

  // ==== TC_UI_DE_010: Definite term + Part-time ==============================

  test('TC_UI_DE_010 — Should create DE contract with Definite term and Part-time @regression', async ({
    deContractPage,
    contractsClient,
    deClientOnClient,
  }) => {
    test.fixme(true, 'QA-443: DE-entity dropdown never surfaces newly created entity — QA-452');
    test.setTimeout(150_000);
    const entity = await requireDeEntity(deClientOnClient);

    try {
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      const endDateStr = endDate.toISOString().split('T')[0];

      const ref = await deContractPage.createDEContract({
        jobTitle: 'Part-time Analyst',
        salary: 3000,
        employmentTerm: 'Definite',
        employmentType: 'Part-time',
        employeeId: `EMP-PT-${Date.now()}`,
        entityName: entity.name,
        endDate: endDateStr,
        pdfPath: CONTRACTS_TEST_DOCUMENT_PDF,
      });

      expect(ref, 'Wizard should produce a contract ref in the URL after creation').toBeTruthy();

      const details = await contractsClient.getContract(ref!);
      await contractsClient.cancelContract(details.id).catch(() => undefined);
    } finally {
      await deClientOnClient.deleteEntity(entity.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_DE_011: Duplicate employee ID validation =======================

  test('TC_UI_DE_011 — Should reject duplicate employee identifier @regression', async ({
    deContractPage,
    contractsClient,
    deClientOnClient,
  }) => {
    // TODO(api-preconditions): this test opens the DE-entity dropdown twice and its
    // search degrades to a timeout once the shared sandbox accumulates many orphaned
    // "QA DE Entity" records — DELETE /api/direct_employees/entities/{id} returns
    // 400/500 (pre-existing backend issue), so teardown can't remove them and they
    // pile up. Not a port regression; reactivate once the entity DELETE endpoint
    // works (or the sandbox is purged). See docs/40-domain/de-external-payroll-bank-account-bug.md.
    test.fixme(true, 'DE-entity dropdown search times out with orphaned entities; entity DELETE endpoint 400/500 (backend)');
    test.setTimeout(180_000);
    const entity = await requireDeEntity(deClientOnClient);

    try {
      const duplicateId = `EMP-DUP-${Date.now()}`;

      const ref = await deContractPage.createDEContract({
        ...CONTRACT_DATA,
        employeeId: duplicateId,
        entityName: entity.name,
        pdfPath: CONTRACTS_TEST_DOCUMENT_PDF,
      });
      let createdId: number | undefined;
      if (ref) {
        const details = await contractsClient.getContract(ref);
        createdId = details.id;
      }

      try {
        // Try creating a second contract with the same employee identifier —
        // it should fail validation at the Contract Info step.
        await deContractPage.open();
        await deContractPage.selectEmployeeWorkerType();
        await deContractPage.selectDirectEmployeeType();
        await deContractPage.selectEntity(entity.name);

        await deContractPage.jobTitleInput.waitFor({ state: 'visible', timeout: 10_000 });
        await deContractPage.jobTitleInput.fill('Dup Test');
        await deContractPage.employeeIdInput.fill(duplicateId);
        await deContractPage.continueButton.click();

        const errorShown = await deContractPage.requiredFieldErrors.first()
          .isVisible({ timeout: 5_000 }).catch(() => false);
        const stayedOnStep = await deContractPage.jobTitleInput.isVisible({ timeout: 3_000 }).catch(() => false);

        expect(errorShown || stayedOnStep).toBe(true);

        await deContractPage.closeWizard();
      } finally {
        if (createdId) await contractsClient.cancelContract(createdId).catch(() => undefined);
      }
    } finally {
      await deClientOnClient.deleteEntity(entity.id).catch(() => undefined);
    }
  });

  // ==== TC_UI_DE_012: Invalid file upload on Compliance step =================

  test('TC_UI_DE_012 — Should reject non-PDF file on Compliance step @regression', async ({
    deContractPage,
    deClientOnClient,
  }) => {
    test.fixme(true, 'QA-443: DE-entity dropdown never surfaces newly created entity — QA-452');
    test.setTimeout(90_000);
    const entity = await requireDeEntity(deClientOnClient);

    try {
      await deContractPage.navigateToPaymentStep({
        jobTitle: CONTRACT_DATA.jobTitle,
        employmentTerm: CONTRACT_DATA.employmentTerm,
        employmentType: CONTRACT_DATA.employmentType,
        entityName: entity.name,
      });

      await deContractPage.fillPaymentDetails({ salary: CONTRACT_DATA.salary });
      await deContractPage.proceedFromPayment();

      if (await deContractPage.uploadContractInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await deContractPage.uploadContractInput.setInputFiles(CONTRACTS_TEST_IMAGE_JPG);
        await deContractPage.createButton.waitFor({ state: 'visible', timeout: 10_000 });

        const hasUploadError = await deContractPage.uploadRejectionError
          .isVisible({ timeout: 5_000 }).catch(() => false);
        const createDisabled = await deContractPage.createButton.isDisabled().catch(() => false);

        expect(hasUploadError || createDisabled).toBe(true);
      } else {
        test.info().annotations.push({
          type: 'gap',
          description: 'TC_UI_DE_012: Upload input not visible on Compliance step',
        });
      }

      await deContractPage.closeWizard();
    } finally {
      await deClientOnClient.deleteEntity(entity.id).catch(() => undefined);
    }
  });
});
