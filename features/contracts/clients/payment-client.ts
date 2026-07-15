import { BaseApiClient } from '@core/http/BaseApiClient';
import { ENDPOINTS } from '@core/config/endpoints';
import { ApiResponse } from '@core/types/api.types';
import { logVerbose } from '@utils/helpers/logger';
import { ContractMutationResponse, ContractPayment, PaymentCycleValidity } from '../types';

/**
 * Typed HTTP client for the money-movement backend boundary (legacy
 * `PaymentProcessingAPI`): contract payments, payment cycles, bulk approval,
 * bank transfers, and the per-contract payroll-approval toggle. One method =
 * one request. Extracted from `ContractsClient` in the 2026-07-09 client
 * boundary re-audit — these five methods hit `/api/payment/*`,
 * `/api/transaction/transfer/*`, `/api/contract/{id}/payments`, and
 * `/api/contract/update`, none of which are the generic-contract boundary the
 * rest of `ContractsClient` owns.
 *
 * NOTE: this is a **contracts-local home** — payments have no feature of their
 * own yet. When `features/payments/` lands (automation roadmap), migrate this
 * client there and repoint the COR deposit path in `seeding.ts`.
 *
 * Authenticated as the client/company (same token as the payer's
 * `ContractsClient`), so the COR lightweight deposit path in `seeding.ts`
 * (`processCorDepositPayment`) preserves its original single-token behaviour.
 */
export class PaymentClient extends BaseApiClient {
  /**
   * Payments for a contract (GET /api/contract/{id}/payments) — used to
   * resolve `payment_item_id`s (from `works[]`, NOT `payment.id`) for the COR
   * lightweight deposit path. The API nests results inconsistently across
   * environments (`data.data` array, a bare array, or an id-keyed object) —
   * ported verbatim from the legacy client's defensive normalisation.
   * Convention B — a read; an empty list is a valid ("no deposit generated
   * yet") result, not an error.
   */
  async getContractPayments(contractId: number, page = 1): Promise<ContractPayment[]> {
    logVerbose(`[PaymentClient] getContractPayments contractId=${contractId}`);
    const res = await this.get<{ data?: { data?: ContractPayment[] } | ContractPayment[] | Record<string, unknown> }>(
      ENDPOINTS.contracts.contractPayments(contractId),
      { page },
    );
    const raw = res.body?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const nested = (raw as { data?: ContractPayment[] }).data;
      if (Array.isArray(nested)) return nested;
      return Object.values(raw).filter(
        (v): v is ContractPayment => !!v && typeof v === 'object' && 'id' in (v as object),
      );
    }
    return [];
  }

  /**
   * Cycle validity (+ an undocumented, config-dependent `quote_id` when
   * present) for a batch of payment ids (GET /api/payment/cycles). The real
   * endpoint takes `payment_ids[]` as a bracketed query-array — ported
   * verbatim from the legacy client rather than `BaseApiClient.get`'s params
   * object (which cannot express repeated array keys). Convention B — a read;
   * an empty list is valid.
   */
  async getPaymentCycles(paymentIds: number[]): Promise<PaymentCycleValidity[]> {
    logVerbose(`[PaymentClient] getPaymentCycles ids=${paymentIds.join(',')}`);
    const query = paymentIds.map((id) => `payment_ids[]=${id}`).join('&');
    const res = await this.get<{ data?: PaymentCycleValidity[] }>(`${ENDPOINTS.contracts.corPaymentCycles}?${query}`);
    return res.body?.data ?? [];
  }

  /** Bulk-approve pending payments (POST /api/payment/approve). */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async approvePayments(paymentIds: number[]): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[PaymentClient] approvePayments ids=${paymentIds.join(',')}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.paymentsApprove, { payment_ids: paymentIds });
  }

  /** Submit a bank-transfer for a resolved quote (POST /api/transaction/transfer/create). */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createTransfer(quoteId: number): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[PaymentClient] createTransfer quoteId=${quoteId}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.transferCreate, { quote_id: quoteId });
  }

  /**
   * Toggle per-contract payroll approval off (POST /api/contract/update) so
   * payroll runs directly (quote → transfer) instead of queuing behind
   * `/api/payment/approve` — the precondition the COR lightweight deposit path
   * relies on (mirrors legacy `disableContractPayrollApproval`).
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async disableContractPayrollApproval(contractId: number): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[PaymentClient] disableContractPayrollApproval contractId=${contractId}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.update, {
      contract_id:                  contractId,
      is_payroll_approval_enabled: 0,
      approval_flow_id:            false,
    });
  }
}
