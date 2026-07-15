import { logVerbose } from '@utils/helpers/logger';
import { ContractsClient } from '../clients/api-client';
import { EOR_CONTRACT_TYPE_EOR_EMPLOYEE, EOR_STATUS_ONGOING_ID } from '../constants';
import { CleanContract } from '../types';

/**
 * Stateless API composition for the contracts domain.
 *
 * Discover a clean Ongoing EOR contract (no pending amendment, amendable) for the
 * amendment flow. Ported from the legacy findCleanOngoingEOR. Prefers a contract
 * that has allowances (so allowance-inheritance can be asserted), else the first
 * amendable one. Returns null when none is available (tests then skip).
 *
 * TODO(api-preconditions): this depends on a sandbox-resident clean EOR contract —
 *   seed one instead (heavy: KYB + two signatures + provider sign) in the cleanup phase.
 */
export async function findCleanOngoingEOR(client: ContractsClient): Promise<CleanContract | null> {
  logVerbose('[seeding] findCleanOngoingEOR');
  const all = await client.listContracts();
  const ongoing = all.filter((c) => {
    const row = c as Record<string, unknown>;
    const status = row.status as { id?: number } | undefined;
    return status?.id === EOR_STATUS_ONGOING_ID && row.type === EOR_CONTRACT_TYPE_EOR_EMPLOYEE;
  });

  let fallback: CleanContract | null = null;
  for (const c of ongoing.slice(0, 25)) {
    const details = await client.getContract(c.ref);
    if (details.has_amendment || !details.can_amend) continue;

    const match: CleanContract = {
      id:               c.id,
      ref:              c.ref,
      salaryCurrencyId: details.salary_currency?.id ?? 1,
      hasAllowances:    (details.allowances?.length ?? 0) > 0,
    };
    if (match.hasAllowances) return match;
    if (!fallback) fallback = match;
  }
  return fallback;
}
