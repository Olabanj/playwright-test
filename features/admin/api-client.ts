import { BaseApiClient } from '@core/http/BaseApiClient';
import { assertOk } from '@core/http/assertOk';
import { ENDPOINTS } from '@core/config/endpoints';
import { env } from '@core/config/env';
import { ApiResponse } from '@core/types/api.types';
import { logVerbose } from '@utils/helpers/logger';
import { AdminLoginResponse, AdminMutationResponse } from './types';

/**
 * Shared admin client: test-login + the admin-gated actions consumed across
 * features (onboarding KYB/2FA, contracts EOR provider-sign, COR/company/KYC
 * gating for contract creation). Promoted out of onboarding once a second
 * feature (contracts) needed admin operations. The EOR-only quote/SOW/partner
 * surface stays OUT of this shared client — see
 * docs/30-decisions/2026-07-08-dmytro-admin-eor-client-placement.md — it lands
 * on a contracts-owned `AdminEorClient extends AdminClient` in a later phase.
 */
export class AdminClient extends BaseApiClient {
  /** Authenticate via the admin test-login key, then re-init the context with the admin token. */
  async initWithAdminToken(): Promise<void> {
    logVerbose('[AdminClient] initWithAdminToken');
    await this.init();
    let token: string;
    try {
      token = await this.loginTest();
    } finally {
      await this.dispose();
    }
    await this.init(token);
  }

  private async loginTest(): Promise<string> {
    if (!env.adminLoginKey) {
      throw new Error('ADMIN_LOGIN_KEY is not set (required for admin test-login)');
    }
    const res = await this.get<AdminLoginResponse>(ENDPOINTS.admin.loginTest(env.adminLoginKey));
    assertOk(res, 'admin test-login');
    const token = res.body?.data?.token;
    if (!token) {
      throw new Error(`admin test-login returned no token (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return token;
  }

  /** Approve a company's KYB submission. */
  async approveCompanyKyb(companyId: number): Promise<void> {
    logVerbose(`[AdminClient] approveCompanyKyb companyId=${companyId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.admin.kybApprove, { company_id: companyId });
    assertOk(res, 'approveCompanyKyb');
  }

  /** Disable 2FA for a user (so a freshly-registered client can log in without the 2FA challenge). */
  async disable2fa(userId: number): Promise<void> {
    logVerbose(`[AdminClient] disable2fa userId=${userId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.admin.disable2fa, { user_id: userId });
    assertOk(res, 'disable2fa');
  }

  /**
   * Admin signs an EOR amendment as the provider, completing the two-party flow.
   * Returns the raw response so callers can treat an idempotent "already signed"
   * (data.error) as success.
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async signAsProvider(contractId: number): Promise<ApiResponse<AdminMutationResponse>> {
    logVerbose(`[AdminClient] signAsProvider contractId=${contractId}`);
    return this.post<AdminMutationResponse>(ENDPOINTS.admin.signAsProvider(contractId), {});
  }

  // ─── Contract creation lifecycle (PR #172) — additive extension, ported from
  // legacy AdminAPI (docs/test-migration/architecture-mapping.md line 110). ───

  /** Verify KYC for a user (works for both contractors and clients). */
  async verifyKYC(userId: number): Promise<void> {
    logVerbose(`[AdminClient] verifyKYC userId=${userId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.admin.kycVerify, { user_id: userId });
    assertOk(res, 'verifyKYC');
  }

  /** Enable the Contractor-of-Record feature for a company (admin-level gate). */
  async enableCor(companyId: number): Promise<void> {
    logVerbose(`[AdminClient] enableCor companyId=${companyId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.admin.companyUpdate, {
      company_id:     companyId,
      is_cor_enabled: 1,
    });
    assertOk(res, 'enableCor');
  }

  /** Disable the Contractor-of-Record feature for a company. */
  async disableCor(companyId: number): Promise<void> {
    logVerbose(`[AdminClient] disableCor companyId=${companyId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.admin.companyUpdate, {
      company_id:     companyId,
      is_cor_enabled: 0,
    });
    assertOk(res, 'disableCor');
  }

  /** Enable Direct Employee (DE) for a company. */
  async enableDirectEmployee(companyId: number): Promise<void> {
    logVerbose(`[AdminClient] enableDirectEmployee companyId=${companyId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.admin.companyUpdate, {
      company_id:                  companyId,
      is_direct_employee_enabled: 1,
    });
    assertOk(res, 'enableDirectEmployee');
  }

  /** Enable Global Payroll for a company (required for external payroll). */
  async enableGlobalPayroll(companyId: number): Promise<void> {
    logVerbose(`[AdminClient] enableGlobalPayroll companyId=${companyId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.admin.companyUpdate, {
      company_id:                companyId,
      is_global_payroll_enabled: 1,
    });
    assertOk(res, 'enableGlobalPayroll');
  }

  /**
   * Enable the "external payroll provider" option on a DE jurisdiction (gates
   * the wizard's "Use external payroll provider" card — disabled by default,
   * confirmed live 2026-07-09). Ported from legacy AdminAPI.enableExternalPayrollOnJurisdiction
   * (docs/test-migration/architecture-mapping.md line 110) — dropped from the
   * create-de-contract.spec.ts UI-lane port; restored as a precondition for
   * TC_UI_DE_007. Read-modify-write: the endpoint requires the full jurisdiction
   * body on POST, not a partial patch.
   */
  async enableExternalPayrollOnJurisdiction(jurisdictionId: number): Promise<void> {
    logVerbose(`[AdminClient] enableExternalPayrollOnJurisdiction jurisdictionId=${jurisdictionId}`);
    const getRes = await this.get<{
      data?: Record<string, unknown> & {
        country?: { id?: number };
        payroll_engine?: { id?: number };
        currencies?: { id?: number }[];
        bank_countries?: { id?: number }[];
      };
    }>(`${ENDPOINTS.admin.jurisdictions}/${jurisdictionId}`);
    assertOk(getRes, 'enableExternalPayrollOnJurisdiction (fetch jurisdiction)');
    const jurisdiction = getRes.body?.data ?? {};
    // The GET response nests `country`/`payroll_engine` as objects and
    // `currencies`/`bank_countries` as arrays of objects, but the POST rejects
    // those shapes and requires their flat `_id` (or `_id[]`) counterparts.
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.admin.jurisdictions, {
      ...jurisdiction,
      country_id:                   jurisdiction.country?.id,
      payroll_engine_id:            jurisdiction.payroll_engine?.id,
      currencies:                   jurisdiction.currencies?.map((c) => c.id),
      bank_countries:               jurisdiction.bank_countries?.map((c) => c.id),
      is_external_payroll_enabled: 1,
      jurisdiction_id:              jurisdictionId,
    });
    assertOk(res, 'enableExternalPayrollOnJurisdiction');
  }

  /** Approve a company (final account-activation step). */
  async approveCompany(companyId: number): Promise<void> {
    logVerbose(`[AdminClient] approveCompany companyId=${companyId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.admin.companyApprove, {
      company_id: companyId,
      approved:   1,
    });
    assertOk(res, 'approveCompany');
  }

  /**
   * List admin-visible COR contracts (POST /api/admin/contract/adminlist,
   * `is_cor: 1`). Convention B — a read; an empty list is a valid result.
   *
   * The endpoint is paginated: the real array lives at `data.data`, not
   * `data` directly (confirmed live — `data` alone is the paginator object,
   * matching the legacy AdminAPI caller's `body.data.data` unwrap in
   * services/api/modules/admin/AdminAPI.ts). Falls back to a flat `data[]`
   * array defensively in case the sandbox ever serves the un-paginated shape.
   */
  async listCorContracts(page = 1): Promise<Record<string, unknown>[]> {
    const res = await this.post<{ data?: { data?: Record<string, unknown>[] } | Record<string, unknown>[] }>(
      `${ENDPOINTS.admin.corAdminContractList}?page=${page}`,
      { archived: 0, is_cor: 1, page },
    );
    const raw = res.body?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const nested = (raw as { data?: Record<string, unknown>[] }).data;
      if (Array.isArray(nested)) return nested;
    }
    return [];
  }

  /**
   * Admin signs the COR SOW as provider. Returns the raw response so callers
   * can treat an idempotent "already signed" as success.
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async signCorSow(contractId: number, signerName: string): Promise<ApiResponse<AdminMutationResponse>> {
    logVerbose(`[AdminClient] signCorSow contractId=${contractId}`);
    return this.post<AdminMutationResponse>(ENDPOINTS.admin.corAdminSowSign, {
      name:        signerName,
      contract_id: contractId,
    });
  }

  /**
   * Admin signs the COR contract as provider. Returns the raw response so
   * callers can treat an idempotent "already signed" as success.
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async signCorContract(contractId: number, signerName: string): Promise<ApiResponse<AdminMutationResponse>> {
    logVerbose(`[AdminClient] signCorContract contractId=${contractId}`);
    return this.post<AdminMutationResponse>(ENDPOINTS.admin.corAdminContractSign, {
      contract_id: contractId,
      name:        signerName,
    });
  }

  /**
   * Moves payment_status → "Paid" and finalises the invoice (admin confirms an
   * inbound client payment).
   */
  async confirmTransaction(transactionId: number, receivedAmount: number): Promise<void> {
    logVerbose(`[AdminClient] confirmTransaction transactionId=${transactionId} receivedAmount=${receivedAmount}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.admin.transactionConfirm, {
      transaction_id:        transactionId,
      received_amount:       receivedAmount,
      received_date:         new Date().toISOString(),
      received_reference:    'seeder-test',
      received_method:       'Wise USD',
      received_amount_email: 0,
      is_received:           1,
    });
    assertOk(res, 'confirmTransaction');
  }
}
