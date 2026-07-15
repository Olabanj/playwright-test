import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { AdminClient } from '@features/admin/api-client';
import { AdminMutationResponse, AdminListResponse } from '@features/admin/types';
import { assertOk } from '@core/http/assertOk';
import { ENDPOINTS } from '@core/config/endpoints';
import { ApiResponse } from '@core/types/api.types';
import { logVerbose } from '@utils/helpers/logger';
import { EorAdmin, EorContractDetails, EorPartner, EorQuotePrefillData, EorSowTemplate } from '../types';

/** `YYYY-MM-DD` in local time (no I/O — pure helper, exempt from logVerbose). */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * EOR-only admin surface: MSA upload, manual quote/SOW/partner chain, provider
 * signing, employee invite, contract details. Feature-scoped subclass of the
 * shared `AdminClient` — see
 * docs/30-decisions/2026-07-08-dmytro-admin-eor-client-placement.md. Inherits
 * `initWithAdminToken` and all cross-cutting admin methods; adds only the
 * EOR-specific 11-method surface (+ `getEorPartnerId` support method).
 *
 * `prepareEorForClientSigning`/`submitEorQuote`/`createAndSubmitSow` are composed
 * multi-request operations kept on this client (mirroring the legacy AdminEorAPI
 * shape) because each represents one indivisible admin-side domain action (build
 * and submit "the quote", build and submit "the SOW") rather than cross-feature
 * orchestration — the latter still belongs in `seeding.ts`.
 */
export class AdminEorClient extends AdminClient {
  /**
   * Upload and sign the EOR MSA (Master Service Agreement) for a company — required
   * before the client can sign EOR contracts (unlocks `can_sign`).
   * POST /api/admin/company/update, multipart: { company_id, msa_agreement_document_signed_date, msa_agreement_document }.
   */
  async uploadMsaAgreement(companyId: number, pdfPath: string): Promise<void> {
    logVerbose(`[AdminEorClient] uploadMsaAgreement companyId=${companyId}`);
    const res = await this.postMultipart<AdminMutationResponse>(ENDPOINTS.admin.companyUpdate, {
      company_id: String(companyId),
      msa_agreement_document_signed_date: formatLocalDate(new Date()),
      msa_agreement_document: {
        name:     'msa-agreement.pdf',
        mimeType: 'application/pdf',
        buffer:   fs.readFileSync(pdfPath),
      },
    });
    assertOk(res, 'uploadMsaAgreement');
  }

  /** Full contract details (admin view), including `employee_invitation_url`. Precondition-read: throws if not found. */
  async getContractDetails(contractId: number): Promise<EorContractDetails> {
    logVerbose(`[AdminEorClient] getContractDetails contractId=${contractId}`);
    const res = await this.get<{ data?: EorContractDetails } & AdminMutationResponse>(
      ENDPOINTS.adminEor.contractDetails(contractId),
    );
    assertOk(res, 'getContractDetails');
    if (!res.body.data) {
      throw new Error(`getContractDetails(${contractId}) returned no data (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return res.body.data;
  }

  /**
   * EOR admin specialist id (roles: EOR Admin, EOR Super Admin), falling back to
   * the first available admin when EOR-specific roles don't exist in this sandbox.
   * Precondition-read: throws when no admin at all is found.
   */
  async getEorSpecialistId(): Promise<number> {
    logVerbose('[AdminEorClient] getEorSpecialistId');
    // BaseApiClient's `get()` params don't support array values (roles[]=A&roles[]=B) —
    // the query string is appended to the url directly instead (same pattern as
    // AdminClient.listCorContracts' `?page=${page}`).
    const rolesQuery = 'roles%5B%5D=EOR+Admin&roles%5B%5D=EOR+Super+Admin';
    const res = await this.get<AdminListResponse<EorAdmin>>(`${ENDPOINTS.adminEor.admins}?${rolesQuery}`);
    let admins = res.body.data ?? [];
    if (!admins.length) {
      logVerbose('[AdminEorClient] getEorSpecialistId: EOR Admin/Super Admin roles not found — falling back to all admins');
      const fallback = await this.get<AdminListResponse<EorAdmin>>(ENDPOINTS.adminEor.admins);
      admins = fallback.body.data ?? [];
    }
    if (!admins.length) {
      throw new Error('getEorSpecialistId: no admin found for EOR onboarding specialist');
    }
    return admins[0].id;
  }

  /**
   * Admin signs an EOR contract as RemotePass (provider). Returns the raw response
   * so callers can treat an idempotent "already signed" as success.
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async signEorAsProvider(contractId: number): Promise<ApiResponse<AdminMutationResponse>> {
    logVerbose(`[AdminEorClient] signEorAsProvider contractId=${contractId}`);
    return this.post<AdminMutationResponse>(ENDPOINTS.adminEor.signAsProvider(contractId), {});
  }

  /**
   * Invite the EOR employee and assign an onboarding specialist. `contract_id`/
   * `onboarding_specialist_id` must be strings — the API rejects integers here
   * (verified from admin-panel HAR, ported verbatim).
   */
  async inviteEorEmployee(contractId: number, specialistId: number): Promise<void> {
    logVerbose(`[AdminEorClient] inviteEorEmployee contractId=${contractId} specialistId=${specialistId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.adminEor.employeeInvite(contractId), {
      notify_client:            true,
      notify_employee:          true,
      contract_id:              String(contractId),
      onboarding_specialist_id: String(specialistId),
    });
    assertOk(res, 'inviteEorEmployee');
  }

  // ── Manual quote flow (is_quotation_automation_enabled = false) ─────────────

  /** Pre-calculated quote inputs for an EOR contract. Precondition-read: throws if not found. */
  async prefillEorQuote(contractId: number): Promise<EorQuotePrefillData> {
    logVerbose(`[AdminEorClient] prefillEorQuote contractId=${contractId}`);
    const res = await this.post<{ data?: EorQuotePrefillData } & AdminMutationResponse>(
      ENDPOINTS.adminEor.quotePrefill,
      { contract_id: contractId },
    );
    assertOk(res, 'prefillEorQuote');
    if (!res.body.data) {
      throw new Error(`prefillEorQuote(${contractId}) returned no data (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return res.body.data;
  }

  /**
   * Build and submit the EOR simulation/quote from `prefillEorQuote` + `getContractDetails`.
   * Deposit = (monthly gross × USD rate) + monthly management fee. Only non-zero tax
   * items are included in the payroll array. Ported verbatim from legacy AdminEorAPI.
   */
  async submitEorQuote(contractId: number): Promise<void> {
    logVerbose(`[AdminEorClient] submitEorQuote contractId=${contractId}`);
    const [prefill, details] = await Promise.all([
      this.prefillEorQuote(contractId),
      this.getContractDetails(contractId),
    ]);

    const monthlyGross  = Number(details.amount ?? 0);
    const currencyCode  = details.salary_currency?.code ?? details.currency?.code ?? 'USD';
    const yearlyGross   = monthlyGross * 12; // simplified: 12× monthly gross — no 13th-month/proration
    const usdRate       = prefill.quote_currency_to_usd_rate ?? 1;
    const managementFee = prefill.management_fee?.monthly ?? 0;
    const indirectTax   = prefill.indirect_tax?.monthly ?? 0;
    const setupFee      = prefill.setup_fee ?? 0;
    const markup        = Math.round(prefill.markup_percentage ?? 0);
    const additionalText = prefill.additional_notes ?? '';
    const depositAmount = Number(((monthlyGross * usdRate) + managementFee).toFixed(2));

    interface PayrollLine { id: number | string; name: string; currency?: string; required?: boolean; value: number | string; }
    const lines: PayrollLine[] = [{ id: 1, name: 'Gross Salary', value: String(monthlyGross) }];
    for (const [taxName, taxData] of Object.entries(prefill.taxes ?? {})) {
      const monthly = taxData.monthly;
      if (monthly && monthly > 0) {
        // Server doesn't validate the UUID value — any v4 UUID is accepted (ported verbatim).
        lines.push({ id: randomUUID(), name: taxName, value: monthly });
      }
    }
    lines.push(
      { id: 2, name: 'Management fees (Inc. tax)', currency: 'USD', value: managementFee },
      { id: 3, name: 'Indirect Tax', currency: 'USD', required: false, value: indirectTax },
    );

    const toEntry = (line: PayrollLine) => ({
      name:  line.name,
      value: line.value,
      ...(line.currency ? { currency: line.currency } : {}),
      ...(line.required === false ? { required: false } : {}),
    });
    const payroll = lines.map((line) => ({ id: line.id, first_month_payroll: toEntry(line), monthly_payroll: toEntry(line) }));

    const res = await this.post<AdminMutationResponse>(ENDPOINTS.adminEor.quoteUpdate, {
      contract_id:         contractId,
      payroll,
      deposit_amount:      depositAmount,
      setup_fee:           setupFee,
      work_visa_cost:      0,
      currency_code:       currencyCode,
      yearly_gross:        yearlyGross,
      markup,
      first_month_payroll: lines.map(toEntry),
      monthly_payroll:     lines.map(toEntry),
      additional_text:     additionalText,
      is_deposit_enabled:  true,
    });
    assertOk(res, 'submitEorQuote');
  }

  /**
   * Fetch the default SOW template for an EOR contract and submit it unchanged.
   * GET .../contract_templates/contract/edit/{id} → POST .../contract_templates/contract/update.
   */
  async createAndSubmitSow(contractId: number): Promise<void> {
    logVerbose(`[AdminEorClient] createAndSubmitSow contractId=${contractId}`);
    const getRes = await this.get<{ data?: EorSowTemplate } & AdminMutationResponse>(
      ENDPOINTS.adminEor.sowTemplate(contractId),
    );
    assertOk(getRes, 'createAndSubmitSow (fetch template)');
    const template = getRes.body.data;
    if (!template) {
      throw new Error(`createAndSubmitSow(${contractId}): no SOW template returned (${getRes.status})`);
    }
    const postRes = await this.post<AdminMutationResponse>(ENDPOINTS.adminEor.sowUpdate, {
      contract_id: contractId,
      name:        template.name,
      sections:    template.sections,
    });
    assertOk(postRes, 'createAndSubmitSow (submit)');
  }

  /** First available EOR partner id. Precondition-read: throws when none exist. */
  async getEorPartnerId(): Promise<number> {
    logVerbose('[AdminEorClient] getEorPartnerId');
    const res = await this.get<AdminListResponse<EorPartner>>(ENDPOINTS.adminEor.partnerList);
    const partners = res.body.data ?? [];
    if (!partners.length) {
      throw new Error('getEorPartnerId: no EOR partners found');
    }
    return partners[0].id;
  }

  /** Assign an EOR partner to a contract. */
  async assignEorPartner(contractId: number, partnerId: number): Promise<void> {
    logVerbose(`[AdminEorClient] assignEorPartner contractId=${contractId} partnerId=${partnerId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.adminEor.partnerAssign, {
      contract_id: String(contractId),
      partner_id:  partnerId,
    });
    assertOk(res, 'assignEorPartner');
  }

  /**
   * Invite the client to review and sign the EOR contract — requires quote submitted
   * + partner assigned. Sets `can_sign = true` on the contract.
   */
  async inviteEorClient(contractId: number): Promise<void> {
    logVerbose(`[AdminEorClient] inviteEorClient contractId=${contractId}`);
    const res = await this.post<AdminMutationResponse>(ENDPOINTS.adminEor.clientInvite, { contract_id: contractId });
    assertOk(res, 'inviteEorClient');
  }

  /**
   * Run all admin steps needed before the client can sign an EOR contract in
   * countries where `is_quotation_automation_enabled = false`: submit quote → create
   * SOW → assign partner → invite client.
   */
  async prepareEorForClientSigning(contractId: number): Promise<void> {
    logVerbose(`[AdminEorClient] prepareEorForClientSigning contractId=${contractId}`);
    await this.submitEorQuote(contractId);
    await this.createAndSubmitSow(contractId);
    const partnerId = await this.getEorPartnerId();
    await this.assignEorPartner(contractId, partnerId);
    await this.inviteEorClient(contractId);
  }
}
