import { logVerbose } from '@utils/helpers/logger';
import { env } from '@core/config/env';
import { TimeTrackingClient } from './api-client';
import { ContractSummary } from './types';

/**
 * Stateless API composition for the Time Tracking domain.
 *
 * TODO(api-preconditions): the discovery helpers below rely on sandbox-resident
 *   contractor contracts. Tests that depend on them self-skip when the sandbox has
 *   none of the required worker-type. Seed real contracts (full onboarding flow) in
 *   the cleanup phase to eliminate the skip path and make worker-assignment tests
 *   unconditionally runnable in CI.
 *
 * Live shape (verified 2026-06-25): GET /timetracking/api/v1/contracts returns
 *   `result.items[]` where `id` is a STRING, the worker-type discriminator is
 *   `subtype` ("fixed" | "payg" | "milestones" | "full_time"), and PAYG granularity
 *   is in `rateCode` ("hour" | "day"). The TT API rejects assignment (400) unless the
 *   contract's worker-type matches the policy's `workerType`. So a `per_hour` (flexible)
 *   policy can only be assigned per_hour PAYG contracts; a `fixed_contractor`
 *   (schedule_window) policy only Fixed contracts.
 */

/** Ongoing contract status id on the TT contracts endpoint. */
const STATUS_ONGOING = 4;

/**
 * Fetch all contracts visible to the authenticated client (single page, limit ≤ 50).
 * Returns `[]` on any non-200 / malformed response.
 */
async function listContracts(client: TimeTrackingClient, limit = 50): Promise<ContractSummary[]> {
  const safeLimit = Math.min(limit, 50); // TT API hard cap
  const res = await client.getContracts({ limit: safeLimit });
  if (res.status !== 200 || !res.body?.result?.items) {
    logVerbose(`[seeding] listContracts — unexpected response status=${res.status}`);
    return [];
  }
  return res.body.result.items;
}

/**
 * Discover Ongoing per_hour PAYG contract ids (numeric) — the worker-type that matches
 * a `per_hour` / flexible policy (the kind worker-assignment tests create).
 *
 * Honours the `TT_WORKER_CONTRACT_ID` env override (EOR_CONTRACT_ID pattern) as an explicit
 * single-id fast path. Otherwise filters `subtype === 'payg' && rateCode === 'hour' &&
 * statusId === 4`. Returns numeric ids (the assignment body uses numbers). Empty when none.
 */
export async function findPerHourContractIds(
  client: TimeTrackingClient,
  limit = 50,
): Promise<number[]> {
  logVerbose('[seeding] findPerHourContractIds');

  if (env.ttWorkerContractId !== undefined) {
    logVerbose(`[seeding] findPerHourContractIds — env override id=${env.ttWorkerContractId}`);
    return [env.ttWorkerContractId];
  }

  const ids = (await listContracts(client, limit))
    .filter((c) => c.subtype === 'payg' && c.rateCode === 'hour' && c.statusId === STATUS_ONGOING)
    .map((c) => Number(c.id));

  logVerbose(`[seeding] findPerHourContractIds — found ${ids.length}`);
  return ids;
}

/**
 * Discover Ongoing Fixed-contractor contract ids (numeric) — the worker-type that matches
 * a `fixed_contractor` / schedule_window policy. Retained for later by-contract / matrix
 * batches. Honours the `TT_FIXED_CONTRACT_ID` env override. Empty when none.
 */
export async function findFixedContractIds(
  client: TimeTrackingClient,
  limit = 50,
): Promise<number[]> {
  logVerbose('[seeding] findFixedContractIds');

  if (env.ttFixedContractId !== undefined) {
    logVerbose(`[seeding] findFixedContractIds — env override id=${env.ttFixedContractId}`);
    return [env.ttFixedContractId];
  }

  const ids = (await listContracts(client, limit))
    .filter((c) => c.subtype === 'fixed' && c.statusId === STATUS_ONGOING)
    .map((c) => Number(c.id));

  logVerbose(`[seeding] findFixedContractIds — found ${ids.length}`);
  return ids;
}

/**
 * End any active session for the given worker contract, if one exists.
 * Must be called with a worker-authenticated client.
 *
 * The active-session endpoint returns HTTP 204 (no body) when no session is running —
 * only act when status === 200 AND a session id is present in the response.
 * TODO(cleanup): active endpoint returns 204 when none (legacy assumed 200); treat
 *   any non-200 (including 204) as "nothing to end" — no error thrown.
 */
export async function ensureNoActiveSession(
  client: TimeTrackingClient,
  contractId: number,
): Promise<void> {
  logVerbose(`[seeding] ensureNoActiveSession contractId=${contractId}`);
  const res = await client.getActiveSessionByContract(contractId);
  if (res.status === 200 && res.body?.result?.id) {
    const sessionId = res.body.result.id as number;
    logVerbose(`[seeding] ensureNoActiveSession — ending active session id=${sessionId}`);
    await client.endTimeSession(sessionId);
  }
}

/**
 * Discover the worker's Ongoing per_hour PAYG contract id.
 * Must be called with a worker-authenticated client (worker sees their own contracts).
 *
 * Honours the `TT_WORKER_CONTRACT_ID` env override as a fast path.
 * Otherwise fetches up to 50 contracts and picks the first with
 * subtype==='payg' && rateCode==='hour' && statusId===4.
 * Returns null when no match is found.
 *
 * TODO(api-preconditions): relies on a sandbox-resident per_hour PAYG contract
 *   belonging to the worker. The session fixture self-skips (sentinel 0) when null.
 *   Seed a real per_hour contract in the cleanup phase to make session tests unconditionally
 *   runnable in CI.
 */
export async function findWorkerPerHourContractId(
  workerClient: TimeTrackingClient,
): Promise<number | null> {
  logVerbose('[seeding] findWorkerPerHourContractId');

  if (env.ttWorkerContractId !== undefined) {
    logVerbose(`[seeding] findWorkerPerHourContractId — env override id=${env.ttWorkerContractId}`);
    return env.ttWorkerContractId;
  }

  const contracts = await listContracts(workerClient, 50);
  const match = contracts.find(
    (c) => c.subtype === 'payg' && c.rateCode === 'hour' && c.statusId === STATUS_ONGOING,
  );

  if (!match) {
    logVerbose('[seeding] findWorkerPerHourContractId — no match found');
    return null;
  }

  const id = Number(match.id);
  logVerbose(`[seeding] findWorkerPerHourContractId — found id=${id}`);
  return id;
}
