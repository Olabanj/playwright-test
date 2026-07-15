import { ApiResponse } from '@core/types/api.types';
import { assertOk } from '@core/http/assertOk';
import { delay } from '@core/http/delay';
import { logVerbose } from '@utils/helpers/logger';
import { AdminClient } from '@features/admin/api-client';
import { registerFreshClient, submitKybForClient } from '@features/onboarding/seeding';
import { RegisteredClient } from '@features/onboarding/types';
import { ContractsClient } from '../clients/api-client';
import { FixedContractBuilder } from '../builders/fixed-contract.builder';
import { PaygContractBuilder } from '../builders/payg-contract.builder';
import { MilestoneContractBuilder } from '../builders/milestone-contract.builder';
import { ContractMutationResponse, ContractorContractInput, CreatedContract } from '../types';

// ─── Contract creation lifecycle (PR #172) — create + validate lane. ───

/**
 * Register a brand-new client via the onboarding owner feature, submit KYB
 * (required before an admin can approve it — the backend rejects
 * approveCompanyKyb with "Company KYB status must be submitted" otherwise),
 * then run the idempotent admin toggles a contract-creation test needs (D3,
 * docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md): 2FA disabled (so the
 * SPA session can be injected later if needed), KYB approved, KYC verified,
 * company approved, global payroll enabled. No fresh-client-per-lane
 * file-locking machinery is reintroduced (D3) — this is a plain composed
 * sequence, reused by the `finishedClient` factory fixture.
 *
 * KYB submission is delegated to the onboarding owner feature's
 * submitKybForClient (public entry point) — registerFreshClient itself is
 * untouched so its other consumer (features/onboarding UI tests) keeps its
 * existing behaviour.
 *
 * Enables Direct-Employee (idempotent — DE create-time surface, EOR/DE
 * foundation batch, 2026-07-08). Does NOT enable Contractor-of-Record — that
 * remains a type-specific gate (`AdminClient.enableCor`) for the COR phase.
 * EOR needs no equivalent company-level toggle — no `is_eor_enabled` flag was
 * found anywhere in the legacy admin surface (EOR is always available, unlike
 * the COR/DE opt-in features), confirmed via rp-scribe (G6) 2026-07-08.
 */
const SIGNUP_THROTTLE_MAX_ATTEMPTS = 3;
const SIGNUP_THROTTLE_BACKOFF_MS = 5000;

/** True for the sandbox's signup-specific rate limit (distinct from the login throttle E2E_SECRET_KEY bypasses) — see QA-449. */
function isSignupThrottled(err: unknown): boolean {
  return err instanceof Error && /signup failed \(429\)/.test(err.message) && /Too Many Attempts/.test(err.message);
}

export async function createFinishedClient(admin: AdminClient): Promise<RegisteredClient> {
  logVerbose('[seeding] createFinishedClient');
  let client: RegisteredClient | undefined;
  for (let attempt = 1; attempt <= SIGNUP_THROTTLE_MAX_ATTEMPTS; attempt++) {
    try {
      client = await registerFreshClient();
      break;
    } catch (err) {
      if (!isSignupThrottled(err) || attempt === SIGNUP_THROTTLE_MAX_ATTEMPTS) throw err;
      logVerbose(`[seeding] createFinishedClient: signup throttled (attempt ${attempt}/${SIGNUP_THROTTLE_MAX_ATTEMPTS}) — backing off ${SIGNUP_THROTTLE_BACKOFF_MS}ms (QA-449)`);
      await delay(SIGNUP_THROTTLE_BACKOFF_MS);
    }
  }
  const registered = client as RegisteredClient;
  await submitKybForClient(registered);
  await admin.disable2fa(registered.userId);
  await admin.approveCompanyKyb(registered.companyId);
  await admin.verifyKYC(registered.userId);
  await admin.approveCompany(registered.companyId);
  await admin.enableGlobalPayroll(registered.companyId);
  await admin.enableDirectEmployee(registered.companyId);
  return registered;
}

/** Resolves the account-specific signatory/template ids once, shared by every create call. */
export async function resolveContractDefaults(
  contracts: ContractsClient,
): Promise<{ signatoryId: number; templateId: number }> {
  logVerbose('[seeding] resolveContractDefaults');
  const [signatory, templateId] = await Promise.all([contracts.getSignatory(), contracts.getTemplateId()]);
  return { signatoryId: signatory.id, templateId };
}

/**
 * Validates a create-contract response and extracts the new contract's id/ref.
 * Not an `expect` (seeding.ts must not contain assertions) — a thrown Error
 * surfaces a genuinely broken precondition to the caller (fixture/spec).
 */
export function extractCreatedContract(res: ApiResponse<ContractMutationResponse>, label: string): CreatedContract {
  assertOk(res, label);
  const id = res.body.data?.id as number | undefined;
  const ref = res.body.data?.ref as string | undefined;
  if (!id || !ref) {
    throw new Error(`${label} returned no id/ref (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { id, ref };
}

/** Create a Fixed-rate contractor contract end to end: resolve ids → create → extract id/ref. */
export async function createFixedContractViaApi(
  contracts: ContractsClient,
  input: ContractorContractInput = new FixedContractBuilder().build(),
): Promise<CreatedContract> {
  logVerbose(`[seeding] createFixedContractViaApi ${input.contractorName}`);
  const { signatoryId, templateId } = await resolveContractDefaults(contracts);
  const res = await contracts.createFixedContract({ ...input, signatoryId, templateId });
  return extractCreatedContract(res, 'createFixedContractViaApi');
}

/** Create a PAYG contractor contract end to end: resolve ids → create → extract id/ref. */
export async function createPaygContractViaApi(
  contracts: ContractsClient,
  input: ContractorContractInput = new PaygContractBuilder().build(),
): Promise<CreatedContract> {
  logVerbose(`[seeding] createPaygContractViaApi ${input.contractorName}`);
  const { signatoryId, templateId } = await resolveContractDefaults(contracts);
  const res = await contracts.createPaygContract({ ...input, signatoryId, templateId });
  return extractCreatedContract(res, 'createPaygContractViaApi');
}

/** Create a Milestone contractor contract end to end: resolve ids → create → extract id/ref. */
export async function createMilestoneContractViaApi(
  contracts: ContractsClient,
  input: ContractorContractInput = new MilestoneContractBuilder().build(),
): Promise<CreatedContract> {
  logVerbose(`[seeding] createMilestoneContractViaApi ${input.contractorName}`);
  const { signatoryId, templateId } = await resolveContractDefaults(contracts);
  const res = await contracts.createMilestoneContract({ ...input, signatoryId, templateId });
  return extractCreatedContract(res, 'createMilestoneContractViaApi');
}

/** `YYYY-MM-DD`, N days from today (no I/O — pure helper, exempt from logVerbose). */
export function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dispose a client, logging (not throwing) on failure — shared by every best-effort teardown. */
export async function safeDispose(client: { dispose(): Promise<void> }, label: string): Promise<void> {
  await client.dispose().catch((err: unknown) => {
    logVerbose(`[${label}] dispose failed: ${String(err)}`);
  });
}
