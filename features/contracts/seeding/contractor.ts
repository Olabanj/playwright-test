import { assertOk } from '@core/http/assertOk';
import { getOtpFromDatabase } from '@core/db/otp';
import { logVerbose } from '@utils/helpers/logger';
import { generateWorkerData } from '@utils/data/user-faker';
import { AdminClient } from '@features/admin/api-client';
import { ContractsClient } from '../clients/api-client';
import { ContractorClient } from '../clients/contractor-client';
import { SANDBOX_TAX_RESIDENCE_UAE } from '../constants';
import { LifecycleWorker, WorkerRegistrationData } from '../types';

// ─── Contractor worker-registration + sign-to-Ongoing (Phase 4) — the
// self-service Flow B (signup → OTP verify → profile) that gates the
// invite→sign half of Fixed/PAYG/Milestone (and COR) contracts. Ported (shape)
// from legacy `lifecycle-core.ts::registerLifecycleWorker` +
// `contractor-lifecycle.helper.ts::completeContractorLifecycle`
// (tests/modules/contracts/helpers/). See
// docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md for the gated DB-OTP
// read layer this depends on. ───

/** `YYYY` password unique enough per run — mirrors the EOR/DE employee password pattern (`signEorToOngoing`). */
function generateWorkerPassword(): string {
  return `QaWorker${Date.now()}!`;
}

/**
 * Register a brand-new contractor worker via self-signup (Flow B): signup →
 * OTP (read from `remotewise_db` over the gated SSH tunnel, `core/db/otp.ts`)
 * → verify → activate → complete KYC profile → admin verifies KYC + disables
 * 2FA (mirrors legacy `registerLifecycleWorker`, which performs the same two
 * admin gates immediately after registration — required for the worker to
 * reliably sign/be paid later, not just to obtain a token).
 *
 * SENTINEL: returns `null` when `getOtpFromDatabase` resolves to its own
 * `null` sentinel (SSH/DB env absent, tunnel unreachable, or no OTP row yet)
 * — a genuine "precondition unavailable", not a broken flow. Callers
 * (factory fixtures / specs) MUST treat `null` as self-skip
 * (`test.skip(worker === null, ...)`), never as an error. Any other step
 * failing (signup/verify/activate/complete non-2xx) throws — that is a
 * genuinely broken precondition, distinct from the OTP sentinel.
 * TODO(api-preconditions): retire this OTP DB read the moment a worker-side
 * OTP bypass ships (see the ADR's "Alternatives considered").
 */
export async function registerContractorWorker(admin: AdminClient, slug: string): Promise<LifecycleWorker | null> {
  logVerbose(`[seeding] registerContractorWorker ${slug}`);
  const worker = generateWorkerData(slug);
  const client = new ContractorClient();
  try {
    await client.init();
    await client.signup(worker.email);

    const otp = await getOtpFromDatabase(worker.email);
    if (!otp) {
      logVerbose(`[seeding] registerContractorWorker: OTP unavailable for ${worker.email} — self-skip sentinel (null), see 2026-07-08-dmytro-db-otp-layer`);
      return null;
    }

    const token = await client.verify(worker.email, otp);
    await client.dispose();
    await client.init(token);

    const registrationData: WorkerRegistrationData = {
      email:      worker.email,
      firstName:  worker.firstName,
      lastName:   worker.lastName,
      phone:      worker.phone,
      password:   generateWorkerPassword(),
      countryId:  SANDBOX_TAX_RESIDENCE_UAE,
    };
    const userId = await client.activateProfile(registrationData);
    await client.completeContractorProfile(registrationData);

    await admin.verifyKYC(userId);
    await admin.disable2fa(userId);

    return {
      userId,
      token,
      fullName: `${worker.firstName} ${worker.lastName}`,
      email:    worker.email,
    };
  } finally {
    await client.dispose();
  }
}

export interface SignContractorToOngoingParams {
  contracts:     ContractsClient;
  contractId:    number;
  contractRef:   string;
  worker:        LifecycleWorker;
  signatoryName: string;
}

/**
 * Drive a created contractor contract (Fixed/PAYG/Milestone) from "created"
 * towards Ongoing: invite the registered worker → client signs → worker signs
 * with their own token (`ContractsClient.signContractAsWorker`) → poll for
 * Ongoing. Mirrors the legacy `completeContractorLifecycle` composition
 * (tests/modules/contracts/helpers/contractor-lifecycle.helper.ts). Throws on
 * a genuinely broken step (invite/clientSign/workerSign non-2xx) — seeding.ts
 * has no `expect`; the caller/spec asserts on the returned boolean.
 */
export async function signContractorToOngoing(params: SignContractorToOngoingParams): Promise<boolean> {
  const { contracts, contractId, contractRef, worker, signatoryName } = params;
  logVerbose(`[seeding] signContractorToOngoing contractId=${contractId}`);

  await contracts.inviteContractor(contractId, worker.email);

  const clientSignRes = await contracts.clientSign(contractId, signatoryName);
  assertOk(clientSignRes, 'signContractorToOngoing: clientSign');

  const workerSignRes = await contracts.signContractAsWorker(contractId, worker.fullName, worker.token);
  assertOk(workerSignRes, 'signContractorToOngoing: workerSign');

  return contracts.waitForContractOngoing(contractRef, { retries: 10, delayMs: 3000 });
}
