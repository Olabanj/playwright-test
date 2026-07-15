import { assertOk } from '@core/http/assertOk';
import { delay } from '@core/http/delay';
import { logVerbose } from '@utils/helpers/logger';
import { AdminClient } from '@features/admin/api-client';
import { ContractsClient } from '../clients/api-client';
import { PaymentClient } from '../clients/payment-client';
import { FixedContractBuilder } from '../builders/fixed-contract.builder';
import { PaygContractBuilder } from '../builders/payg-contract.builder';
import { MilestoneContractBuilder } from '../builders/milestone-contract.builder';
import { ContractorContractInput, ContractPayment, CreatedContract, LifecycleWorker } from '../types';
import { resolveContractDefaults, extractCreatedContract } from './creation';

// ─── Contractor-of-Record (COR, Phase 5) — COR is NOT a separate contract
// type: it is `is_cor: true` on a Fixed/PAYG/Milestone contract. Full-cycle→
// Ongoing reuses the Phase-4 contractor worker registration above
// (`registerContractorWorker`, DB-OTP self-signup) for the invite→sign half,
// plus the admin COR surface already built on `AdminClient` (enableCor,
// signCorSow, signCorContract — reused unmodified here). Ported (shape) from
// legacy `tests/modules/contracts/helpers/cor-lifecycle.helper.ts`
// (`driveCorToOngoing`/`processCorDepositPayment`), with one deliberate
// deviation: the legacy deposit step drives the HEAVY bank-transfer/quote
// flow (`PaymentProcessingAPI.createQuote` → poll → `submitTransfer` → poll →
// `AdminClient.confirmTransaction`/`releaseTransfer`) — that machinery does
// not exist in this architecture yet (architecture-mapping.md gap-list,
// "COR/EOR deposit-payment (lightweight path)") and is explicitly OUT OF
// SCOPE for this batch. Instead this uses the LIGHTWEIGHT path the legacy API
// verify suite itself falls back to (TC_COR_012,
// tests/modules/contracts/api/verify/create-cor-contract.spec.ts):
// disable per-contract payroll approval → poll for the deposit payment to be
// generated → resolve `payment_item_id`s from `works[]` → fetch payment
// cycles for the payment ids → `createTransfer` IF the cycle row carries a
// `quote_id`. TC_COR_012 itself only `test.info().annotations.push({type:
// 'gap', ...})`s and continues when `quote_id` is absent rather than failing
// — this composition mirrors that: a missing deposit/quote_id is a documented
// gap (`SignCorToOngoingResult.depositGap`), not a thrown error. ───

export type CorContractType = 'Fixed' | 'PAYG' | 'Milestone';

export interface CreateCorContractOptions {
  type?:  CorContractType;
  input?: ContractorContractInput;
}

/**
 * Create a COR contract (Fixed/PAYG/Milestone, `is_cor: true`) end to end:
 * resolve account ids → create via the type's dedicated Cor client method →
 * extract id/ref. Mirrors `createFixedContractViaApi`/`createPaygContractViaApi`/
 * `createMilestoneContractViaApi` but targets `ContractsClient.createCorContract`/
 * `createCorPaygContract`/`createCorMilestoneContract`. The account must
 * already have COR enabled (`AdminClient.enableCor`) — callers/fixtures own
 * that idempotent gate, mirroring how `createFinishedClient` leaves COR
 * disabled by default (JSDoc there).
 */
export async function createCorContractViaApi(
  contracts: ContractsClient,
  opts: CreateCorContractOptions = {},
): Promise<CreatedContract> {
  const type = opts.type ?? 'Fixed';
  const input =
    opts.input ??
    (type === 'PAYG'
      ? new PaygContractBuilder().asCor().build()
      : type === 'Milestone'
      ? new MilestoneContractBuilder().asCor().build()
      : new FixedContractBuilder().asCor().build());
  logVerbose(`[seeding] createCorContractViaApi type=${type} contractor=${input.contractorName}`);
  const { signatoryId, templateId } = await resolveContractDefaults(contracts);
  const payload = { ...input, signatoryId, templateId };
  const res =
    type === 'PAYG'
      ? await contracts.createCorPaygContract(payload)
      : type === 'Milestone'
      ? await contracts.createCorMilestoneContract(payload)
      : await contracts.createCorContract(payload);
  return extractCreatedContract(res, `createCorContractViaApi(${type})`);
}

/**
 * Create a COR contract and immediately client-sign its SOW — the shared
 * two-step precondition for the admin/contractor SOW-sign and duplicate-SOW-sign
 * probes (create-cor-contract.spec.ts TC_COR_017/018/023, ported (shape) from
 * legacy `createAndClientSignSow`). Multi-step API composition belongs here,
 * not inlined in the spec (layer-responsibilities.md) — three consumers in the
 * same spec file crossed the rule-of-two.
 */
export async function createCorContractAndSignSow(
  contracts: ContractsClient,
  opts: CreateCorContractOptions = {},
): Promise<CreatedContract & { signatoryName: string }> {
  logVerbose('[seeding] createCorContractAndSignSow');
  const created = await createCorContractViaApi(contracts, opts);
  const signatory = await contracts.getSignatory();
  const sowRes = await contracts.signCorSow(created.id, signatory.name);
  assertOk(sowRes, 'createCorContractAndSignSow: signCorSow');
  return { ...created, signatoryName: signatory.name };
}

/**
 * Lightweight COR deposit-payment step (TC_COR_012 behaviour — see the module
 * doc above for why this is NOT the heavy bank-transfer/quote-polling flow):
 * disable per-contract payroll approval → poll for the deposit payment to be
 * generated → resolve `payment_item_id`s from `works[]` (unused by the
 * lightweight path itself, but logged — a future `approvePayments` caller
 * needs them when payroll approval is left enabled) → fetch payment cycles →
 * `createTransfer` when a `quote_id` is present. Returns a short gap
 * description (never throws for this specific boundary) when the deposit
 * never materialises or the cycle row carries no `quote_id`.
 */
async function processCorDepositPayment(payments: PaymentClient, contractId: number): Promise<string | undefined> {
  logVerbose(`[seeding] processCorDepositPayment contractId=${contractId}`);

  const disableRes = await payments.disableContractPayrollApproval(contractId);
  assertOk(disableRes, 'processCorDepositPayment: disableContractPayrollApproval');

  let contractPayments: ContractPayment[] = [];
  for (let i = 0; i < 12; i++) {
    contractPayments = await payments.getContractPayments(contractId);
    if (contractPayments.length > 0) break;
    await delay(5000);
  }
  if (contractPayments.length === 0) {
    logVerbose(`[seeding] processCorDepositPayment: no deposit payment generated for contract=${contractId} after polling — gap`);
    return 'no-deposit-payment-generated';
  }

  const paymentItemIds = contractPayments
    .flatMap((p) => (p.works ?? []).map((w) => w.payment_item_id))
    .filter((id): id is number => !!id);
  logVerbose(`[seeding] processCorDepositPayment: resolved ${paymentItemIds.length} payment_item_id(s) for contract=${contractId}`);

  const paymentIds = contractPayments.map((p) => p.id);
  const cycles = await payments.getPaymentCycles(paymentIds);
  const quoteId = cycles[0]?.quote_id;
  if (!quoteId) {
    logVerbose(
      `[seeding] processCorDepositPayment: no quote_id on payment-cycle row for contract=${contractId} — gap, mirrors legacy TC_COR_012 annotation`,
    );
    return 'no-quote-id-on-cycle';
  }

  const transferRes = await payments.createTransfer(quoteId);
  assertOk(transferRes, 'processCorDepositPayment: createTransfer');
  return undefined;
}

export interface SignCorToOngoingParams {
  contracts:      ContractsClient;
  /** Admin surface for the provider-side COR signatures (already-built AdminClient.signCorSow/signCorContract). */
  admin:          AdminClient;
  /**
   * Money-movement client for the lightweight deposit path — must be authenticated
   * as the SAME client/company as `contracts` (2026-07-09 client boundary re-audit
   * split the deposit methods out of `ContractsClient`). Required only when the
   * deposit step runs (`processDeposit` truthy); `processCorDepositPayment` throws
   * if it runs without one.
   */
  payments?:      PaymentClient;
  contractId:     number;
  contractRef:    string;
  /** From `registerContractorWorker` — caller/fixture must honor its DB-OTP null self-skip sentinel before calling this. */
  worker:         LifecycleWorker;
  signatoryName:  string;
  /**
   * Run the lightweight deposit-payment step. Default `true` (Fixed COR has a
   * scheduled upfront deposit); pass `false` for PAYG/Milestone COR, which
   * generate no payable item until work/milestones are submitted and reach
   * Ongoing on signatures alone (mirrors legacy `processPayment: false`).
   */
  processDeposit?: boolean;
}

export interface SignCorToOngoingResult {
  reachedOngoing: boolean;
  /**
   * Set when the lightweight deposit path stopped short of a transfer (no
   * deposit payment generated yet, or no `quote_id` on the cycle row) — a
   * documented gap, not an error. `undefined` when `processDeposit: false` or
   * the deposit step completed a transfer.
   */
  depositGap?: string;
}

/**
 * Drive a created COR contract (Fixed/PAYG/Milestone, `is_cor: true`) from
 * "created" towards Ongoing — ported (shape) from legacy
 * `cor-lifecycle.helper.ts::driveCorToOngoing`:
 *   1. Client signs the SOW (`ContractsClient.signCorSow`).
 *   2. Client invites the (already self-registered) contractor worker.
 *   3. Client signs the MSA/contract (`clientSign`) — required before the
 *      worker can sign.
 *   4. Worker signs with their own token (`signContractAsWorker`).
 *   5. Lightweight deposit payment (`processCorDepositPayment`, skipped when
 *      `processDeposit: false`) — see that function's doc for the documented
 *      gap behaviour.
 *   6. Admin signs the SOW + contract as provider (`AdminClient.signCorSow`/
 *      `signCorContract` — already built, reused here unmodified).
 *   7. Poll for Ongoing.
 *
 * No `expect` — throws on a genuinely broken step (non-2xx SOW/invite/sign);
 * the deposit boundary (step 5) is the one documented exception, surfaced via
 * `depositGap` instead of a throw. Caller/spec asserts on the result.
 */
export async function signCorToOngoing(params: SignCorToOngoingParams): Promise<SignCorToOngoingResult> {
  const { contracts, admin, payments, contractId, contractRef, worker, signatoryName, processDeposit = true } = params;
  logVerbose(`[seeding] signCorToOngoing contractId=${contractId}`);

  const sowRes = await contracts.signCorSow(contractId, signatoryName);
  assertOk(sowRes, 'signCorToOngoing: signCorSow');

  await contracts.inviteContractor(contractId, worker.email);

  const clientSignRes = await contracts.clientSign(contractId, signatoryName);
  assertOk(clientSignRes, 'signCorToOngoing: clientSign');

  const workerSignRes = await contracts.signContractAsWorker(contractId, worker.fullName, worker.token);
  assertOk(workerSignRes, 'signCorToOngoing: workerSign');

  let depositGap: string | undefined;
  if (processDeposit) {
    if (!payments) {
      throw new Error('signCorToOngoing: processDeposit is true but no PaymentClient was provided (see SignCorToOngoingParams.payments)');
    }
    depositGap = await processCorDepositPayment(payments, contractId);
  }

  const sowAdminRes = await admin.signCorSow(contractId, 'Admin QA');
  assertOk(sowAdminRes, 'signCorToOngoing: admin signCorSow');
  const contractAdminRes = await admin.signCorContract(contractId, 'Admin QA');
  assertOk(contractAdminRes, 'signCorToOngoing: admin signCorContract');

  const reachedOngoing = await contracts.waitForContractOngoing(contractRef, { retries: 10, delayMs: 3000 });
  return { reachedOngoing, depositGap };
}
