import { assertOk } from '@core/http/assertOk';
import { logVerbose } from '@utils/helpers/logger';
import { AdminClient } from '@features/admin/api-client';
import { ContractsClient } from '../clients/api-client';
import { DeClient } from '../clients/de-client';
import { ContractorClient } from '../clients/contractor-client';
import { CONTRACTS_TEST_DOCUMENT_PDF, CURRENCY_IDS, PAY_CYCLES, SANDBOX_TAX_RESIDENCE_UAE } from '../constants';
import {
  CreatedContract,
  CreatedDeEntity,
  DeContractInput,
  DeEntity,
  DeOnboardingData,
} from '../types';
import { extractCreatedContract, daysFromNow, safeDispose } from './creation';

// ─── Direct Employee (DE) create-time surface (PR #172) — re-authored against
// DeClient/ContractorClient directly (NOT ported from the frozen integration-setup
// seeder — architecture-mapping.md line 96). Not gated by the OTP escalation. ───

/** A DE entity as seeded, plus the jurisdiction it was created with (needed later by `createDeContract`). */
export interface SeededDeEntity extends CreatedDeEntity {
  jurisdictionId: number;
  countryId:      number;
}

export interface CreateDeEntityOptions {
  countryId?:  number;
  currencyId?: number;
}

/**
 * Create a DE entity end to end: resolve country (default UAE) → resolve an
 * existing jurisdiction for it → create.
 *
 * Self-skip sentinel `DE_ENTITY_JURISDICTION_ABSENT`: returns `null` when no
 * jurisdiction exists for the resolved country — jurisdictions are admin-created
 * and the sandbox may not have one seeded; a genuine absent-precondition, not an
 * error. Callers (fixtures/specs) should self-skip on `null`.
 */
export async function createDeEntity(
  de: DeClient,
  opts: CreateDeEntityOptions = {},
): Promise<SeededDeEntity | null> {
  logVerbose('[seeding] createDeEntity');
  const countryId = opts.countryId ?? SANDBOX_TAX_RESIDENCE_UAE;
  const jurisdictions = await de.getJurisdictions(countryId);
  if (!jurisdictions.length) {
    logVerbose(`[seeding] createDeEntity: no jurisdiction for country=${countryId} — self-skip sentinel DE_ENTITY_JURISDICTION_ABSENT (null)`);
    return null;
  }
  const monthly = PAY_CYCLES.find((p) => p.cycle === 'Monthly')!;
  const created = await de.createEntity({
    name:               `QA DE Entity ${Date.now()}`,
    countryId,
    typeId:             1,
    address:            '123 QA Test Street',
    city:               'Dubai',
    state:              'DU',
    zipCode:            '00000',
    currencyId:         opts.currencyId ?? CURRENCY_IDS.AED,
    registrationNo:     `QA-${Date.now()}`,
    nbEmployees:        1,
    jurisdictionId:     jurisdictions[0].id,
    paydayOccurrenceId: monthly.occurrenceId,
  });
  return { ...created, jurisdictionId: jurisdictions[0].id, countryId };
}

export interface CreateDeContractOptions {
  jobTitle?: string;
  amount?:   string;
}

/**
 * Create a DE contract end to end: fetch the full entity record (the create
 * payload embeds it) → resolve first payroll month + upload the contract PDF →
 * create.
 */
export async function createDeContract(
  de: DeClient,
  entity: SeededDeEntity,
  opts: CreateDeContractOptions = {},
): Promise<CreatedContract> {
  logVerbose(`[seeding] createDeContract entityId=${entity.id}`);
  const rawEntity: DeEntity = await de.getEntity(entity.id);
  const [{ date: firstPayrollMonth }, contractFilePath] = await Promise.all([
    de.resolveFirstPayrollMonth(entity.id),
    de.uploadContractPdf(CONTRACTS_TEST_DOCUMENT_PDF),
  ]);
  const payload: DeContractInput = {
    entity:             rawEntity,
    jurisdictionId:     entity.jurisdictionId,
    currencyId:         entity.currencyId,
    employeeIdentifier: `QA-EMP-${Date.now()}`,
    contractFilePath,
    firstPayrollMonth,
    startDate:          daysFromNow(7),
    jobTitle:           opts.jobTitle ?? 'Software Engineer',
    amount:             opts.amount,
  };
  const res = await de.createDEContract(payload);
  return extractCreatedContract(res, 'createDeContract');
}

export interface OnboardDeEmployeeParams {
  employee:       ContractorClient;
  /** Admin surface for the two mid-flow gates the employee can't clear itself. */
  admin:          AdminClient;
  onboarding:     DeOnboardingData;
  countryId:      number;
  molIdCardPath:  string;
  documentNumber: string;
  molId:          string;
  iban:           string;
}

/**
 * Onboard a DE employee on an already-authenticated `ContractorClient` (invite
 * token exchanged by the caller — see `signDeToOngoing`): initial wizard →
 * admin disables the new employee's 2FA → MOL ID card upload → full profile →
 * admin verifies the employee's KYC → bank account.
 *
 * Ported step-for-step from the legacy `seedDEContract` (steps 8-13,
 * tests/modules/integration-setup/scripts/seed-de-contract.ts): the two admin
 * gates are NOT optional/deferred — `createBankAccount` 400s with "KYC not
 * verified" without the `verifyKYC` call, mirroring the fresh-client 2FA/KYC
 * gates used elsewhere in this feature (`createFinishedClient`). Shared by
 * both the API and UI create lanes (architecture-mapping.md line 97).
 */
export async function onboardDeEmployee(params: OnboardDeEmployeeParams): Promise<number> {
  const { employee, admin, onboarding, countryId, molIdCardPath, documentNumber, molId, iban } = params;
  logVerbose(`[seeding] onboardDeEmployee email=${onboarding.email}`);
  const userId = await employee.completeOnboarding(onboarding);
  await admin.disable2fa(userId);
  const uploadedMolIdPath = await employee.uploadMolIdCard(molIdCardPath);
  await employee.completeDeEmployeeProfile({
    firstName:     onboarding.firstName,
    lastName:      onboarding.lastName,
    phone:         onboarding.phone,
    countryId,
    molIdCardPath: uploadedMolIdPath,
    molId,
    documentNumber,
  });
  await admin.verifyKYC(userId);
  await employee.createDeBankAccount(iban, `${onboarding.firstName} ${onboarding.lastName}`);
  return userId;
}

export interface SignDeToOngoingParams {
  contracts:          ContractsClient;
  de:                 DeClient;
  contractId:         number;
  contractRef:        string;
  signatoryName:      string;
  /**
   * The employee invitation link (contains `token` + `contract_id` query
   * params). TODO(api-preconditions): no DE admin "get contract details" client
   * exists in this batch to resolve `employee_invitation_url` internally (unlike
   * EOR's `AdminEorClient.getContractDetails`) — the caller must supply it
   * (e.g. from a notification/email fixture, once one exists).
   */
  invitationUrl:      string;
  employeeOnboarding: DeOnboardingData;
  employeeCountryId:  number;
  molIdCardPath:      string;
  documentNumber:     string;
  molId:              string;
  iban:               string;
}

/**
 * Drive a created DE contract from "created" towards Ongoing: client signs →
 * employee exchanges the invitation link for a bearer token → employee completes
 * onboarding (`onboardDeEmployee`, which performs the required admin 2FA-disable
 * + KYC-verify gates) → polls for Ongoing.
 */
export async function signDeToOngoing(params: SignDeToOngoingParams): Promise<{ reachedOngoing: boolean }> {
  const {
    contracts, de, contractId, contractRef, signatoryName, invitationUrl,
    employeeOnboarding, employeeCountryId, molIdCardPath, documentNumber, molId, iban,
  } = params;
  logVerbose(`[seeding] signDeToOngoing contractId=${contractId}`);

  const clientSignRes = await contracts.clientSign(contractId, signatoryName);
  // BUGFIX (QA-449 follow-up, TC_CDC_008, 2026-07-14): DeClient.createDEContract()
  // submits with `client_can_submit: true` — the client's "signature" already
  // happens at creation time for DE (unlike Fixed/PAYG, which need this explicit
  // step). A 400 "Contract already saved" here just confirms that already-signed
  // state, not a real failure — only re-throw for a genuinely different error.
  const alreadySaved = clientSignRes.status === 400 && clientSignRes.body?.data?.error === 'Contract already saved';
  if (!alreadySaved) {
    assertOk(clientSignRes, 'signDeToOngoing: clientSign');
  } else {
    logVerbose('[seeding] signDeToOngoing: clientSign — contract already saved at creation, treating as signed');
  }

  const employeeToken = await de.exchangeInvitationToken(invitationUrl);
  const employee = new ContractorClient();
  const admin = new AdminClient();
  try {
    await employee.init(employeeToken);
    await admin.initWithAdminToken();
    await onboardDeEmployee({
      employee, admin, onboarding: employeeOnboarding, countryId: employeeCountryId,
      molIdCardPath, documentNumber, molId, iban,
    });
  } finally {
    await safeDispose(employee, 'signDeToOngoing:employee');
    await safeDispose(admin, 'signDeToOngoing:admin');
  }

  const reachedOngoing = await contracts.waitForContractOngoing(contractRef, { retries: 3, delayMs: 2000 });
  return { reachedOngoing };
}
