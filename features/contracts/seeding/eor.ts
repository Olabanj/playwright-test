import { assertOk } from '@core/http/assertOk';
import { logVerbose } from '@utils/helpers/logger';
import { generateWorkerData } from '@utils/data/user-faker';
import { ContractsClient } from '../clients/api-client';
import { AdminEorClient } from '../clients/admin-eor-client';
import { EorClient } from '../clients/eor-client';
import { ContractorClient } from '../clients/contractor-client';
import { CONTRACTS_TEST_DOCUMENT_PDF, CURRENCY_IDS, SANDBOX_TAX_RESIDENCE_UAE } from '../constants';
import { CreateEorContractInput, CreatedContract } from '../types';
import { extractCreatedContract, daysFromNow, safeDispose } from './creation';

// ─── EOR create-time surface (PR #172) — re-authored against EorClient/AdminEorClient/
// ContractorClient directly (NOT ported from the frozen integration-setup seeder —
// architecture-mapping.md line 98). Not gated by the worker-registration OTP escalation. ───

export interface CreateEorContractOptions {
  employeeCountryId?: number;
  currencyId?:        number;
  amount?:            string;
  jobTitle?:          string;
}

/**
 * Create an EOR contract end to end: resolve the regional config for the target
 * country → resolve insurance providers + regional form answers → create (the
 * client's own insurance-fallback retry handles provider rejection).
 *
 * Self-skip sentinel `EOR_REGIONAL_CONFIG_ABSENT`: returns `null` when the
 * sandbox has no EOR regional config for the resolved country — a genuine
 * absent-precondition, not an error. Callers (fixtures/specs) should self-skip
 * on `null`.
 */
export async function createEorContract(
  eor: EorClient,
  opts: CreateEorContractOptions = {},
): Promise<CreatedContract | null> {
  logVerbose('[seeding] createEorContract');
  const countryId = opts.employeeCountryId ?? SANDBOX_TAX_RESIDENCE_UAE;
  const regionalConfig = await eor.getRegionalConfig(countryId);
  if (!regionalConfig) {
    logVerbose(`[seeding] createEorContract: no EOR regional config for country=${countryId} — self-skip sentinel EOR_REGIONAL_CONFIG_ABSENT (null)`);
    return null;
  }

  const insuranceProviders = await eor.getInsuranceProviders(regionalConfig.id);
  const regionalFormAnswers = await eor.buildRegionalFormAnswers(regionalConfig);
  const worker = generateWorkerData('eor-employee');

  const input: CreateEorContractInput = {
    employeeFirstName:   'QA',
    employeeLastName:    worker.lastName,
    employeeEmail:       worker.email,
    employeeCountryId:   countryId,
    currencyId:          opts.currencyId ?? CURRENCY_IDS.USD,
    includeInsurance:    insuranceProviders.length > 0,
    insuranceProviderId: insuranceProviders[0]?.id ?? 0,
    startDate:           daysFromNow(7),
    amount:              opts.amount,
    jobTitle:            opts.jobTitle,
    ...regionalFormAnswers,
  };
  const res = await eor.createEorContract(input);
  return extractCreatedContract(res, 'createEorContract');
}

/**
 * Ensure the company's EOR MSA (Master Service Agreement) is uploaded/signed
 * before the client signs an EOR contract — `is_company_msa_agreement_signed`
 * gates `can_sign` (docs/api-discovery/eor-contract-lifecycle.md). MSA is
 * company-scoped: one upload unlocks every EOR contract on the account, so this
 * checks the flag on the contract's own admin details first and skips the
 * upload when already set — safe to call from both `signEorToOngoing` and
 * `signEorClientAndProviderSign` without a redundant upload in the same run.
 * `companyId` is resolved from `contracts` (the company-authenticated client)
 * rather than threading it through every caller's params.
 */
async function ensureEorMsaUploaded(
  eorAdmin: AdminEorClient,
  contracts: ContractsClient,
  contractId: number,
): Promise<void> {
  logVerbose(`[seeding] ensureEorMsaUploaded contractId=${contractId}`);
  const details = await eorAdmin.getContractDetails(contractId);
  if (details.is_company_msa_agreement_signed) {
    logVerbose('[seeding] ensureEorMsaUploaded: already signed — skip');
    return;
  }
  const companyId = await contracts.getCompanyId();
  await eorAdmin.uploadMsaAgreement(companyId, CONTRACTS_TEST_DOCUMENT_PDF);
}

export interface SignEorClientAndProviderSignParams {
  contracts:            ContractsClient;
  eorAdmin:             AdminEorClient;
  contractId:           number;
  contractRef:          string;
  signatoryName:        string;
  /** From `EorRegionalConfig.is_quotation_automation_enabled` for the contract's country. */
  isQuotationAutomated: boolean;
}

/**
 * Drive a created EOR contract through both signatures — the partial cycle used
 * by TC_QA209_008 (create-eor-contract.spec.ts): ensure the company MSA is
 * signed → (manual quote/SOW/partner/client-invite when quotation isn't
 * automated) → client signs → admin signs as provider → read back the resulting
 * status. Does NOT invite the employee and does NOT assert — seeding.ts has no
 * `expect`; the caller/spec asserts on the returned `status`.
 *
 * Renamed from `signEorToPendingInvitation` (2026-07-08): confirmed sandbox
 * reality is create → "Pending company signature" → clientSign →
 * "Pending worker onboarding" → providerSign → **"Ongoing"** — there is no
 * "Pending employee invitation" intermediate status in this quotation-automated
 * config, so calling `inviteEorEmployee` here 400s ("Employee can't be invited
 * for an inactive contract"). TODO(api-preconditions): the resulting status is
 * config-dependent (quotation-automation / deposit-gating may differ per
 * country) — re-verify if this is reused against a non-UAE regional config.
 */
export async function signEorClientAndProviderSign(
  params: SignEorClientAndProviderSignParams,
): Promise<{ contractRef: string; status: string }> {
  const { contracts, eorAdmin, contractId, contractRef, signatoryName, isQuotationAutomated } = params;
  logVerbose(`[seeding] signEorClientAndProviderSign contractId=${contractId}`);

  await ensureEorMsaUploaded(eorAdmin, contracts, contractId);

  if (!isQuotationAutomated) {
    await eorAdmin.prepareEorForClientSigning(contractId);
  }

  const clientSignRes = await contracts.clientSign(contractId, signatoryName);
  assertOk(clientSignRes, 'signEorClientAndProviderSign: clientSign');

  const providerSignRes = await eorAdmin.signEorAsProvider(contractId);
  assertOk(providerSignRes, 'signEorClientAndProviderSign: signEorAsProvider');

  const details = await contracts.getContract(contractRef);
  const status = details.status?.name ?? 'Unknown';
  return { contractRef, status };
}

export interface SignEorToOngoingParams {
  contracts:            ContractsClient;
  eorAdmin:             AdminEorClient;
  contractId:           number;
  contractRef:          string;
  signatoryName:        string;
  /** From `EorRegionalConfig.is_quotation_automation_enabled` for the contract's country. */
  isQuotationAutomated: boolean;
  employeeEmail:        string;
  employeeFirstName?:   string;
  employeeLastName:     string;
  employeeCountryId:    number;
  employeePassword?:    string;
}

export interface SignEorToOngoingResult {
  reachedOngoing:   boolean;
  employeePassword: string;
  /**
   * Documents where the best-effort employee-onboarding sequence stopped, when
   * it didn't run to completion (invite → activate → 2FA-disable → login →
   * profile → data-collection → bank account). `undefined` when the full
   * sequence completed without error. Callers use this + `reachedOngoing` to
   * `test.skip` gracefully instead of failing on a step this sandbox config
   * can't complete yet (e.g. the still-deferred EOR deposit-payment gate).
   */
  stoppedAt?: string;
}

/**
 * Drive a created EOR contract from "created" towards Ongoing:
 *   1. Ensure the company's EOR MSA is signed (`ensureEorMsaUploaded`) —
 *      required before `clientSign` will accept the contract (backend 400s
 *      with "Contract can't be signed unless MSA agreement is signed"
 *      otherwise).
 *   2. If quotation isn't automated for this country, admin prepares the
 *      contract for signing (quote → SOW → partner → client invite).
 *   3. Client signs the contract (reuses `ContractsClient.clientSign`).
 *   4. Admin signs as provider — confirmed sandbox reality (2026-07-08, UAE
 *      quotation-automated config): the contract is already "Ongoing" at this
 *      point, before any employee onboarding.
 *   5. Best-effort employee onboarding (invite → activate → disable the
 *      employee's 2FA → login → profile → data-collection form → bank
 *      account) — wrapped in try/catch (see below) so a step this sandbox
 *      can't complete does not throw.
 *   6. Polls for Ongoing regardless of how far step 5 got.
 *
 * The freshly-activated EOR employee is 2FA-gated: `ContractorClient.login`
 * returns `{success:true, data:{"2fa":true}}` with no token until 2FA is
 * disabled for that user (mirrors the Fresh-Client 2FA pattern used for
 * onboarding's `registerFreshClient`). `activateAccount` returns the new
 * employee's user id (`data.id`) precisely so this composition can call
 * `AdminClient.disable2fa` before the first `login()`.
 *
 * TODO(api-preconditions): the EOR deposit payment (architecture-mapping.md
 * gap-list step 13, "COR/EOR deposit-payment (lightweight path)") is still not
 * built — those `PaymentClient` methods (getContractPayments/
 * getPaymentCycles/createTransfer/approvePayments) are only wired for COR. Step 5 is
 * wrapped in try/catch precisely so that boundary (or any other step a given
 * sandbox config can't complete) degrades gracefully instead of throwing —
 * `stoppedAt` records where it stopped. In this sandbox's UAE
 * quotation-automated config, `reachedOngoing: true` is legitimately reached
 * at step 4, before the deposit (and even before employee onboarding) is
 * needed — that is expected, not a bug.
 */
export async function signEorToOngoing(
  params: SignEorToOngoingParams,
): Promise<SignEorToOngoingResult> {
  const {
    contracts, eorAdmin, contractId, contractRef, signatoryName, isQuotationAutomated,
    employeeEmail, employeeLastName, employeeCountryId,
  } = params;
  const employeeFirstName = params.employeeFirstName ?? 'QA';
  const employeePassword  = params.employeePassword ?? `QaEor${Date.now()}!`;
  logVerbose(`[seeding] signEorToOngoing contractId=${contractId}`);

  await ensureEorMsaUploaded(eorAdmin, contracts, contractId);

  if (!isQuotationAutomated) {
    await eorAdmin.prepareEorForClientSigning(contractId);
  }
  const clientSignRes = await contracts.clientSign(contractId, signatoryName);
  assertOk(clientSignRes, 'signEorToOngoing: clientSign');

  const providerSignRes = await eorAdmin.signEorAsProvider(contractId);
  assertOk(providerSignRes, 'signEorToOngoing: signEorAsProvider');

  let stoppedAt: string | undefined;
  try {
    stoppedAt = 'employee-invite';
    const specialistId = await eorAdmin.getEorSpecialistId();
    await eorAdmin.inviteEorEmployee(contractId, specialistId);

    stoppedAt = 'employee-invitation-url';
    const details = await eorAdmin.getContractDetails(contractId);
    const invitationUrl = details.employee_invitation_url;
    if (!invitationUrl) {
      throw new Error(`contract ${contractId} has no employee_invitation_url after invite`);
    }
    const inviteToken = new URL(invitationUrl).searchParams.get('token') ?? '';
    if (!inviteToken) {
      throw new Error(`could not extract invite token from ${invitationUrl}`);
    }

    const employee = new ContractorClient();
    await employee.init();
    try {
      stoppedAt = 'employee-activation';
      const employeeUserId = await employee.activateAccount(inviteToken, employeeEmail, employeePassword);

      stoppedAt = 'employee-2fa-disable';
      await eorAdmin.disable2fa(employeeUserId);

      stoppedAt = 'employee-login';
      const employeeToken = await employee.login(employeeEmail, employeePassword);
      await employee.dispose();
      await employee.init(employeeToken);

      stoppedAt = 'employee-profile';
      await employee.completeEorEmployeeProfile({
        firstName:      employeeFirstName,
        lastName:       employeeLastName,
        phone:          '971500000000',
        countryId:      employeeCountryId,
        documentNumber: `QA${Date.now()}`,
      });

      stoppedAt = 'employee-data-collection';
      // Data-collection form moved to EorClient (2026-07-09 boundary re-audit);
      // run it on a same-token EorClient, disposed right after.
      const eorForms = new EorClient();
      await eorForms.init(employeeToken);
      try {
        await eorForms.completeDataCollectionForm(`${employeeFirstName} ${employeeLastName}`, CONTRACTS_TEST_DOCUMENT_PDF, employeeCountryId);
      } finally {
        await safeDispose(eorForms, 'signEorToOngoing:eor-forms');
      }

      stoppedAt = 'employee-bank-account';
      await employee.createEorBankAccount(`${employeeFirstName} ${employeeLastName}`);

      stoppedAt = undefined; // full best-effort sequence completed
    } finally {
      await safeDispose(employee, 'signEorToOngoing:employee');
    }
  } catch (err) {
    logVerbose(`[signEorToOngoing] employee-onboarding sequence stopped at "${stoppedAt}" (deferred/unsupported step) — ${String(err)}`);
  }

  const reachedOngoing = await contracts.waitForContractOngoing(contractRef, { retries: 3, delayMs: 2000 });
  return { reachedOngoing, employeePassword, stoppedAt };
}
