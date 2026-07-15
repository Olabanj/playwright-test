import * as fs from 'fs';
import { BaseApiClient } from '@core/http/BaseApiClient';
import { assertOk } from '@core/http/assertOk';
import { ENDPOINTS } from '@core/config/endpoints';
import { ApiResponse } from '@core/types/api.types';
import { logVerbose } from '@utils/helpers/logger';
import {
  ContractMutationResponse,
  CreatedContract,
  CreatedDeEntity,
  DeContractInput,
  DeCountry,
  DeEntity,
  DeEntityInput,
  DeJurisdiction,
} from '../types';

interface ListResponse<T> { success?: boolean; data?: T[]; }
interface EntityListResponse { success?: boolean; data?: { entities?: DeEntity[] }; }
interface PayrollCycleResponse { success?: boolean; data?: unknown[] | { data?: unknown[] }; }
interface UploadResponse { success?: boolean; data?: { path?: string }; }
interface MutationResponse { success?: boolean; message?: string; data?: Record<string, unknown>; }
interface EntityMutationResponse { success?: boolean; data?: DeEntity; }
interface InvitationExchangeResponse { success?: boolean; data?: { url?: string }; }

/**
 * Sandbox currency ids known for DE entities. Extend when seeding entities with
 * other currencies. Kept local (not `@features/contracts/constants`) — it maps a
 * DE-entity-specific response quirk, not a general currency reference table.
 */
const DE_CURRENCY_CODE_MAP: Record<number, string> = { 1: 'USD', 4: 'AED', 121: 'SAR' };

/**
 * Direct Employee (DE) entity + contract create-time surface. Kept as ONE client
 * (not split entity/contract) — a DE entity is a hard precondition for a DE
 * contract (the same client always needs both in sequence), both live on the
 * same `/api/direct_employees/*` backend resource, and splitting would only add
 * a second class to inject/init for zero real boundary value.
 */
export class DeClient extends BaseApiClient {
  // ── Entity ──────────────────────────────────────────────────────────────

  /** All DE-supported countries. Convention B — a read; an empty list is a valid (if unusual) result. */
  async getCountries(): Promise<DeCountry[]> {
    logVerbose('[DeClient] getCountries');
    const res = await this.get<ListResponse<DeCountry>>(ENDPOINTS.directEmployees.countries);
    return res.body.data ?? [];
  }

  /**
   * Existing jurisdictions for a country. Convention B, valid-empty: an empty
   * result means no jurisdiction is configured for this country yet (an admin
   * would create one) — a genuine sandbox-precondition-absent state, not an
   * error. Seeding treats an empty result as the self-skip sentinel for DE entity
   * creation (documented on `seeding.ts`'s `createDeEntity`).
   */
  async getJurisdictions(countryId: number): Promise<DeJurisdiction[]> {
    logVerbose(`[DeClient] getJurisdictions countryId=${countryId}`);
    const res = await this.get<ListResponse<DeJurisdiction>>(ENDPOINTS.directEmployees.jurisdictions(countryId));
    if (res.status !== 200) return [];
    return res.body.data ?? [];
  }

  /** Payroll cycles for the client's entities. Convention B — valid-empty (new entity has none yet). */
  async getPayrollCycleList(cycleDate: string, allMonths = 1): Promise<unknown[]> {
    logVerbose(`[DeClient] getPayrollCycleList cycleDate=${cycleDate}`);
    const res = await this.get<PayrollCycleResponse>(
      `${ENDPOINTS.directEmployees.payrollCycleList}?cycle_date=${cycleDate}&page=1&all_months=${allMonths}&is_off_cycle=0`,
    );
    if (res.status !== 200) return [];
    const data = res.body.data;
    if (Array.isArray(data)) return data;
    return data?.data ?? [];
  }

  /** A single entity by id. Precondition-read: throws if not present in the account's entity list. */
  async getEntity(entityId: number): Promise<DeEntity> {
    logVerbose(`[DeClient] getEntity entityId=${entityId}`);
    const res = await this.get<EntityListResponse>(ENDPOINTS.directEmployees.entities);
    assertOk(res, 'getEntity');
    const entities = res.body.data?.entities ?? [];
    const entity = entities.find((e) => e.id === entityId);
    if (!entity) {
      throw new Error(`getEntity: entity id ${entityId} not found (${entities.length} entities returned)`);
    }
    return entity;
  }

  /**
   * Resolve `first_payroll_month` from the entity's current payroll cycle.
   * Convention B — never throws: falls back to the 1st of NEXT month when the
   * (newly created) entity has no payroll cycle yet, which is expected. The
   * backend rejects a first-payroll-month before "the 1st of next month" (observed
   * error: "The first payroll month must be a date after or equal to
   * <next-month-1st>") — the last-day-of-current-month value previously returned
   * here failed that validation; confirmed against the legacy
   * `DEContractAPI.resolveFirstPayrollMonth` fallback, 2026-07-08.
   */
  async resolveFirstPayrollMonth(entityId: number): Promise<{ date: string; usedFallback: boolean }> {
    logVerbose(`[DeClient] resolveFirstPayrollMonth entityId=${entityId}`);
    const fallback = firstDayOfNextMonth();
    const res = await this.get<{ success?: boolean; data?: { end_date?: string; ends_at?: string; to?: string } }>(
      ENDPOINTS.directEmployees.entityPayrollCycle(entityId),
    );
    if (res.status === 200 && res.body.data) {
      const endDate = res.body.data.end_date ?? res.body.data.ends_at ?? res.body.data.to;
      if (endDate) return { date: endDate.split('T')[0], usedFallback: false };
    }
    return { date: fallback, usedFallback: true };
  }

  /** Create a DE entity. Guarded mutation — throws on failure or a missing/unmapped currency. */
  async createEntity(data: DeEntityInput): Promise<CreatedDeEntity> {
    logVerbose(`[DeClient] createEntity name=${data.name}`);
    const res = await this.post<EntityMutationResponse>(ENDPOINTS.directEmployees.entities, {
      name:                 data.name,
      country_id:           data.countryId,
      type_id:              data.typeId,
      address:              data.address,
      city:                 data.city,
      state:                data.state,
      zip_code:             data.zipCode,
      currency_id:          data.currencyId,
      registration_no:      data.registrationNo,
      nb_employees:         data.nbEmployees,
      jurisdiction_id:      data.jurisdictionId,
      payday_occurrence_id: data.paydayOccurrenceId,
      vat:                  data.vat,
      po_number:            data.poNumber,
      mol_establishment_id: data.molEstablishmentId,
      tax_number:           data.taxNumber,
      duns_number:          data.dunsNumber,
    });
    assertOk(res, 'createEntity');
    const created = res.body.data;
    if (!created?.id) {
      throw new Error(`createEntity: response had no id (${res.status}): ${JSON.stringify(res.body)}`);
    }
    const currencyId = created.currency_id ?? data.currencyId;
    const currencyCode = created.currency?.code ?? DE_CURRENCY_CODE_MAP[currencyId];
    if (!currencyCode) {
      throw new Error(`createEntity: unknown currency_id ${currencyId} — add it to DE_CURRENCY_CODE_MAP`);
    }
    return { id: created.id, currencyId, currencyCode };
  }

  /**
   * Delete a DE entity — best-effort teardown only. Returns the raw response so
   * the fixture can swallow non-2xx without throwing (endpoint availability
   * varies by environment).
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async deleteEntity(entityId: number): Promise<ApiResponse<MutationResponse>> {
    logVerbose(`[DeClient] deleteEntity entityId=${entityId}`);
    return this.delete<MutationResponse>(ENDPOINTS.directEmployees.entityById(entityId));
  }

  // ── Contract ────────────────────────────────────────────────────────────

  /** Upload a PDF as the DE contract document. Returns the stored file path. */
  async uploadContractPdf(pdfPath: string): Promise<string> {
    logVerbose(`[DeClient] uploadContractPdf ${pdfPath}`);
    const res = await this.postMultipart<UploadResponse>(ENDPOINTS.contractShared.upload, {
      file: { name: 'test-document.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(pdfPath) },
    });
    assertOk(res, 'uploadContractPdf');
    const path = res.body.data?.path;
    if (!path) {
      throw new Error(`uploadContractPdf: no path in response (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return path;
  }

  /**
   * Validate that an `employee_identifier` is unique for this company. Convention
   * C — negative/boundary tests assert on the raw response directly (mirrors
   * `ContractsClient.createFixedContractRaw`'s reasoning).
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async validateEmployeeIdentifier(identifier: string): Promise<ApiResponse<MutationResponse>> {
    logVerbose(`[DeClient] validateEmployeeIdentifier ${identifier}`);
    return this.post<MutationResponse>(ENDPOINTS.contractShared.employeeIdValidate, {
      employee_identifier: identifier,
    });
  }

  /** Create a DE contract (POST /api/direct_employees/contracts). */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createDEContract(data: DeContractInput): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[DeClient] createDEContract employeeIdentifier=${data.employeeIdentifier}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.directEmployees.contracts, {
      start_date:                           data.startDate,
      first_payment_prorata:                0,
      custom_field:                         {},
      work_visa:                            0,
      trial_period:                         0,
      is_bonus_clause_enabled:              0,
      is_annual_plane_ticket_enabled:       0,
      is_overtime_enabled:                  0,
      entity:                               data.entity,
      jurisdiction_id:                      data.jurisdictionId,
      employment_term:                      'indefinite',
      employment_type:                      'full-time',
      seniority:                            'Senior',
      name:                                 data.jobTitle,
      employee_identifier:                  data.employeeIdentifier,
      sub_entity_id:                        data.entity.id,
      is_contributions_enabled:             0,
      is_external_payroll_provider:         0,
      amount:                               data.amount ?? '5000',
      currency_id:                          data.currencyId,
      first_payroll_month:                  data.firstPayrollMonth,
      allowances:                           [],
      file:                                 data.contractFilePath,
      probation_period:                     '30',
      notice_period:                        '30',
      client_can_submit:                    true,
      work_visa_questionnaire_answers:      [],
      payment_details_answers:              [],
      employee_details_answers:             [],
      compensation_benefit_details_answers: [],
      is_prorata_calculation_enabled:       false,
    });
  }

  /**
   * Exchange an invitation URL for the employee's bearer token. Extracts
   * `token`/`contract_id` from the invite URL, calls the exchange endpoint, then
   * pulls the JWT out of the redirect URL in the response.
   */
  async exchangeInvitationToken(invitationUrl: string): Promise<string> {
    logVerbose('[DeClient] exchangeInvitationToken');
    const parsed = new URL(invitationUrl);
    const token = parsed.searchParams.get('token') ?? '';
    const contractRef = parsed.searchParams.get('contract_id') ?? '';

    const res = await this.get<InvitationExchangeResponse>(ENDPOINTS.contractShared.invitation, {
      token,
      contract_id: contractRef,
    });
    assertOk(res, 'exchangeInvitationToken');
    const registerUrl = res.body.data?.url ?? '';
    if (!registerUrl) {
      throw new Error(`exchangeInvitationToken: no url in response (${res.status}): ${JSON.stringify(res.body)}`);
    }
    // Placeholder base handles a relative registerUrl; ignored when it's already absolute.
    const employeeToken = new URL(registerUrl, 'https://placeholder.invalid').searchParams.get('token') ?? '';
    if (!employeeToken) {
      throw new Error(`exchangeInvitationToken: could not extract JWT from register url: ${registerUrl.slice(0, 100)}`);
    }
    return employeeToken;
  }
}

/**
 * 1st of next month, `YYYY-MM-DD` (no I/O — pure helper, exempt from logVerbose).
 * The backend's minimum accepted `first_payroll_month` is the 1st of next month
 * (see `resolveFirstPayrollMonth` fallback JSDoc) — mirrors the workaround
 * previously duplicated in `create-de-contract.spec.ts`.
 */
function firstDayOfNextMonth(): string {
  const now = new Date();
  const nextMonthIndex = now.getMonth() + 1; // 0-indexed current month + 1
  const year = now.getFullYear() + Math.floor(nextMonthIndex / 12);
  const month = (nextMonthIndex % 12) + 1; // 1-indexed
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** A newly created DE contract's identifiers — mirrors `CreatedContract` (kept as an alias for call-site clarity). */
export type CreatedDeContract = CreatedContract;
