import { BaseApiClient } from '@core/http/BaseApiClient';
import { assertOk, assertOkWithId } from '@core/http/assertOk';
import { delay } from '@core/http/delay';
import { ENDPOINTS } from '@core/config/endpoints';
import { ApiResponse } from '@core/types/api.types';
import { logVerbose } from '@utils/helpers/logger';
import {
  Contract,
  ContractAttribute,
  ContractListWrapper,
  ContractMutationResponse,
  ContractorContractCreateData,
  ContractTemplate,
  EorContract,
  EorCurrency,
  InviteContractorResult,
  Signatory,
} from '../types';

interface ContractDetailsResponse {
  data?: EorContract;
}

interface ListDataResponse<T> {
  data?: T[];
}

/** Loose shape covering observed field-name variants for the invite response. */
interface InviteContractorResponse {
  success?:        boolean;
  message?:        string;
  data?:           { invitation_url?: string };
  invitation_url?: string;
  invitationUrl?:  string;
}

/**
 * Typed HTTP client for the generic contract backend boundary (`contracts.*`):
 * contractor + COR create, invite, sign, generic reads (list/details/currencies/
 * signatory/template/attributes), poll-to-Ongoing, and cancel. One method = one
 * request.
 *
 * EOR-specific salary-currency edit + amendment methods live on `EorClient`, and
 * the money-movement methods on `PaymentClient` (2026-07-09 client boundary
 * re-audit) — this client owns only the generic contract surface.
 *
 * `clientSign` (and the other create/sign `*Raw` methods marked below) use
 * return convention C (raw ApiResponse) so callers/tests can assert on status +
 * body and treat an idempotent "already signed/saved" as success — they do NOT
 * call assertOk.
 */
export class ContractsClient extends BaseApiClient {
  /** List the authenticated user's contracts (numeric ids). */
  async listContracts(): Promise<Contract[]> {
    const res = await this.get<ContractListWrapper<Contract> | Contract[]>(ENDPOINTS.contracts.list);
    const body = res.body;
    return Array.isArray(body) ? body : body.data ?? [];
  }

  /** Platform currency catalogue (GET /api/static/currencies). */
  async getCurrencies(): Promise<EorCurrency[]> {
    const res = await this.get<ContractListWrapper<EorCurrency> | EorCurrency[]>(ENDPOINTS.contracts.currencies);
    const body = res.body;
    return Array.isArray(body) ? body : body.data ?? [];
  }

  /** EOR contract details by string ref (GET /api/contract/{ref}/details). */
  async getContract(ref: string): Promise<EorContract> {
    logVerbose(`[ContractsClient] getContract ${ref}`);
    const res = await this.get<ContractDetailsResponse>(ENDPOINTS.contracts.details(ref));
    assertOk(res, `getContract(${ref})`);
    if (!res.body?.data) {
      throw new Error(`getContract(${ref}) returned no data (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return res.body.data;
  }

  /**
   * Invite a contractor/employee to sign a created contract (POST /api/contract/invite).
   * Convention A — a mutation the caller expects to succeed (mirrors the legacy
   * `ContractsAPI.inviteContractor` inline throw-on-failure); guarded with `assertOk`.
   * Endpoint confirmed via rp-scribe (anchor `other-endpoints-POSTapi-contract-invite`,
   * 2026-07-08); response field checked defensively (`data.invitation_url` is the
   * shape proven by the legacy client against this exact endpoint, with top-level
   * `invitation_url`/`invitationUrl` as fallbacks — same defensive pattern as other
   * loosely-typed endpoints in this client). Unblocks Fixed/PAYG/Milestone/COR/DE
   * invite→sign flows.
   */
  async inviteContractor(contractId: number, email: string): Promise<InviteContractorResult> {
    logVerbose(`[ContractsClient] inviteContractor contractId=${contractId} email=${email}`);
    const res = await this.post<InviteContractorResponse>(ENDPOINTS.contracts.invite, {
      contract_id: contractId,
      email,
    });
    assertOk(res, 'inviteContractor');
    const invitationUrl = res.body.data?.invitation_url ?? res.body.invitation_url ?? res.body.invitationUrl;
    if (!invitationUrl) {
      throw new Error(`inviteContractor: no invitation url in response (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return { invitationUrl };
  }

  /**
   * Client signs the contract/amendment (POST /api/contract/signature). Returns the
   * raw response so the caller can treat an idempotent "already saved" as success.
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async clientSign(contractId: number, signerName: string): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[ContractsClient] clientSign contractId=${contractId}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.signature, {
      name:        signerName,
      contract_id: contractId,
    });
  }

  /**
   * The registered contractor worker signs their own contract (POST
   * /api/contract/signature), using the WORKER's bearer token rather than this
   * client's own — via the shared `requestAsToken` primitive (a temporary
   * request context; this client's own context is untouched). Mirrors legacy
   * `ContractsAPI.signContractWithToken`. Distinct from `clientSign` (company
   * token) — same endpoint, different signer identity. Feeds
   * `seeding.ts`'s `signContractorToOngoing` (Phase 4, worker-registration).
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async signContractAsWorker(
    contractId: number,
    signerName: string,
    workerToken: string,
  ): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[ContractsClient] signContractAsWorker contractId=${contractId}`);
    return this.requestAsToken<ContractMutationResponse>(workerToken, 'POST', ENDPOINTS.contracts.signature, {
      name:        signerName,
      contract_id: contractId,
    });
  }

  // ─── Contract creation lifecycle (PR #172) — create + validate lane only, no
  // worker/OTP needed (architecture-mapping.md, "Gaps blocking migration — API
  // lane", step 5). Payloads ported from legacy ContractsAPI, endpoint shapes
  // confirmed via rp-scribe (G6) 2026-07-08. ───

  /** First available signatory on the account. Precondition-read: throws if none. */
  async getSignatory(): Promise<Signatory> {
    logVerbose('[ContractsClient] getSignatory');
    const res = await this.get<
      ListDataResponse<{ id: number; first_name: string; last_name: string }>
      | { id: number; first_name: string; last_name: string }[]
    >(ENDPOINTS.contracts.signatoryList);
    assertOk(res, 'getSignatory');
    const body = res.body;
    const list = Array.isArray(body) ? body : body.data ?? [];
    if (!list.length) {
      throw new Error('getSignatory: no signatories found on this account');
    }
    const s = list[0];
    return { id: s.id, name: `${s.first_name} ${s.last_name}`.trim() };
  }

  /**
   * First matching contract template id (or the first template when `name` is
   * omitted/not found). Precondition-read: throws when the account has none.
   */
  async getTemplateId(name?: string): Promise<number> {
    logVerbose(`[ContractsClient] getTemplateId ${name ?? '(first available)'}`);
    const res = await this.get<ListDataResponse<ContractTemplate> | ContractTemplate[]>(
      ENDPOINTS.contracts.templateList,
    );
    assertOk(res, 'getTemplateId');
    const body = res.body;
    const templates = Array.isArray(body) ? body : body.data ?? [];
    if (!templates.length) {
      throw new Error('getTemplateId: no contract templates found on this account');
    }
    if (name) {
      const match = templates.find((t) => t.name === name);
      if (match) return match.id;
      logVerbose(
        `[ContractsClient] getTemplateId: template '${name}' not found — falling back to first template "${templates[0].name}" (id=${templates[0].id})`,
      );
    }
    return templates[0].id;
  }

  // ─── Company precondition-reads (documented boundary exception) ───
  // `getCompanyCurrency` + `getCompanyId` are the ONE acknowledged exception to
  // "ContractsClient owns only contracts.*": both piggyback on
  // POST /api/company/update (an onboarding-boundary endpoint, no dedicated GET)
  // and are used purely as contract-creation preconditions (billing currency for
  // the payload; company id to enable COR/Direct-Employee before create). They
  // are kept together here on purpose — splitting one to the onboarding client
  // while the other stays would be inconsistent and churny (2026-07-09 client
  // boundary re-audit, ADR + Deviation 3). Follow-up: relocate BOTH into an
  // onboarding-owned company-read together.

  /**
   * The authenticated company's billing currency code. Piggybacks on
   * POST /api/company/update with an empty body (no dedicated GET exists) —
   * ported verbatim from the legacy fragile-but-working approach. Precondition-read:
   * throws when the currency cannot be determined.
   */
  async getCompanyCurrency(): Promise<string> {
    logVerbose('[ContractsClient] getCompanyCurrency');
    const res = await this.post<{ data?: { currency?: { code?: string } } }>(
      ENDPOINTS.registration.companyUpdate,
      {},
    );
    assertOk(res, 'getCompanyCurrency');
    const code = res.body.data?.currency?.code;
    if (!code) {
      throw new Error(`getCompanyCurrency: could not determine company currency (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return code;
  }

  /**
   * The authenticated company's id. Same piggyback pattern as `getCompanyCurrency`
   * (POST /api/company/update, empty body, no dedicated GET) — the `data.id` field
   * is already relied on elsewhere for this exact endpoint (OnboardingClient.updateCompany
   * via `assertOkWithId`, confirmed 2026-07-08). Precondition-read: throws when no id
   * is returned.
   */
  async getCompanyId(): Promise<number> {
    logVerbose('[ContractsClient] getCompanyId');
    const res = await this.post<{ data?: { id?: number }; id?: number }>(ENDPOINTS.registration.companyUpdate, {});
    return assertOkWithId(res, 'getCompanyId');
  }

  /** Custom attributes for a contract area/type (GET /api/attributes). Valid-empty read. */
  async getAttributes(area: string, active: number, contractType?: string): Promise<ContractAttribute[]> {
    const params: Record<string, string | number> = { area, active };
    if (contractType) params.contract_type = contractType;
    const res = await this.get<ListDataResponse<ContractAttribute> | ContractAttribute[]>(
      ENDPOINTS.contracts.attributes,
      params,
    );
    const body = res.body;
    return Array.isArray(body) ? body : body.data ?? [];
  }

  /** Create a Fixed-rate contractor contract (POST /api/contract/fixed/create). */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createFixedContract(data: ContractorContractCreateData): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[ContractsClient] createFixedContract contractor=${data.contractorName}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.fixedCreate, {
      name:                data.contractName ?? `QA Fixed ${Date.now()}`,
      contractor_name:     data.contractorName,
      scope:               'Software development and support.',
      start_date:          data.startDate,
      first_payment_date:  data.firstPaymentDate,
      amount:              data.amount ?? 1000,
      currency_id:         data.currencyId,
      template_id:         data.templateId,
      ...(data.taxResidenceId !== undefined && { tax_residence_id: data.taxResidenceId }),
      ...(data.attributes?.length && { attributes: data.attributes }),
      frequency_id:  data.frequencyId ?? 4,
      occurrence_id: data.occurrenceId ?? 17,
      notice_period: 30,
      signatory_id:  data.signatoryId,
      kyc:           1,
    });
  }

  /** Create a PAYG (pay-as-you-go) contractor contract (POST /api/contract/payg/create). */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createPaygContract(data: ContractorContractCreateData): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[ContractsClient] createPaygContract contractor=${data.contractorName}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.paygCreate, {
      name:               data.contractName ?? `QA PAYG ${Date.now()}`,
      contractor_name:    data.contractorName,
      scope:              'Consulting services.',
      start_date:         data.startDate,
      first_payment_date: data.firstPaymentDate,
      amount:             data.amount ?? 50,
      currency_id:        data.currencyId,
      ...(data.rateId !== undefined && { rate_id: data.rateId }),
      template_id: data.templateId,
      ...(data.taxResidenceId !== undefined && { tax_residence_id: data.taxResidenceId }),
      frequency_id:      data.frequencyId ?? 4,
      occurrence_id:     data.occurrenceId ?? 17,
      notice_period:     30,
      signatory_id:      data.signatoryId,
      client_can_submit: 1,
      kyc:               1,
      extra:             1,
    });
  }

  /** Create a Milestone contractor contract (POST /api/contract/milestone/create). */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createMilestoneContract(data: ContractorContractCreateData): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[ContractsClient] createMilestoneContract contractor=${data.contractorName}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.milestoneCreate, {
      name:            data.contractName ?? `QA Milestone ${Date.now()}`,
      contractor_name: data.contractorName,
      scope:           'Deliverables per milestone schedule.',
      currency_id:     data.currencyId,
      template_id:     data.templateId,
      ...(data.taxResidenceId !== undefined && { tax_residence_id: data.taxResidenceId }),
      notice_period: 30,
      signatory_id:  data.signatoryId,
      kyc:           1,
      extra:         1,
      milestones: data.milestones ?? [
        { name: 'Phase 1', amount: 500 },
        { name: 'Phase 2', amount: 500 },
      ],
    });
  }

  /**
   * Thin passthrough for negative/boundary tests that need to send a
   * malformed/incomplete body — no client-side validation. Kept distinct from
   * `createFixedContract` on purpose (architecture-mapping.md line 105).
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createFixedContractRaw(payload: Record<string, unknown>): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose('[ContractsClient] createFixedContractRaw');
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.fixedCreate, payload);
  }

  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createPaygContractRaw(payload: Record<string, unknown>): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose('[ContractsClient] createPaygContractRaw');
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.paygCreate, payload);
  }

  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createMilestoneContractRaw(payload: Record<string, unknown>): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose('[ContractsClient] createMilestoneContractRaw');
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.milestoneCreate, payload);
  }

  /**
   * Poll GET /api/contract/{ref}/details until `status.name === 'Ongoing'` or
   * retries are exhausted. Convention B — a polling read; "not yet Ongoing" is a
   * valid intermediate result, so this returns `false` instead of throwing.
   */
  async waitForContractOngoing(ref: string, opts: { retries?: number; delayMs?: number } = {}): Promise<boolean> {
    const { retries = 5, delayMs = 2000 } = opts;
    logVerbose(`[ContractsClient] waitForContractOngoing ref=${ref}`);
    for (let i = 0; i < retries; i++) {
      const detail = await this.getContract(ref);
      if (detail.status?.name === 'Ongoing') return true;
      if (i < retries - 1) await delay(delayMs);
    }
    return false;
  }

  /**
   * Cancel a contract (POST /api/contract/{id}/cancel) — the only teardown
   * available; contracts cannot be deleted (inherited sandbox debt, not a
   * regression — see fixtures.ts factory state-fixture JSDoc).
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async cancelContract(contractId: number): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[ContractsClient] cancelContract contractId=${contractId}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.cancel(contractId), {});
  }

  // ─── Contractor-of-Record (COR, Phase 5) — COR is NOT a separate contract
  // type, it is `is_cor: true` on a Fixed/PAYG/Milestone contract (same create
  // endpoints as the plain create* methods above). Payloads ported from legacy
  // ContractsAPI (createCorContract/createCorPaygContract/
  // createCorMilestoneContract/signCorSow); endpoint shapes confirmed via
  // rp-scribe (G6) 2026-07-08. The lightweight deposit-payment surface
  // (getContractPayments/getPaymentCycles/approvePayments/createTransfer/
  // disableContractPayrollApproval) now lives on `PaymentClient`
  // (payment-client.ts) — a distinct money-movement boundary (2026-07-09
  // client boundary re-audit). Admin-side COR surface (enableCor,
  // listCorContracts, signCorSow-as-provider, signCorContract) already lives
  // on `AdminClient` — reused as-is by `seeding.ts`'s `signCorToOngoing`. ───

  /** Create a COR Fixed-rate contract (POST /api/contract/fixed/create, is_cor: true). */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createCorContract(data: ContractorContractCreateData): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[ContractsClient] createCorContract contractor=${data.contractorName}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.fixedCreate, {
      name:                data.contractName ?? `QA COR Fixed ${Date.now()}`,
      contractor_name:     data.contractorName,
      scope:               'Software development and support.',
      start_date:          data.startDate,
      first_payment_date:  data.firstPaymentDate,
      amount:              data.amount ?? 1000,
      currency_id:         data.currencyId,
      template_id:         data.templateId,
      ...(data.taxResidenceId !== undefined && { tax_residence_id: data.taxResidenceId }),
      ...(data.attributes?.length && { attributes: data.attributes }),
      frequency_id:  data.frequencyId ?? 4,
      occurrence_id: data.occurrenceId ?? 17,
      notice_period: 30,
      signatory_id:  data.signatoryId,
      kyc:           1,
      is_cor:        true,
    });
  }

  /** Create a COR PAYG contract (POST /api/contract/payg/create, is_cor: true). */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createCorPaygContract(data: ContractorContractCreateData): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[ContractsClient] createCorPaygContract contractor=${data.contractorName}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.paygCreate, {
      name:               data.contractName ?? `QA COR PAYG ${Date.now()}`,
      contractor_name:    data.contractorName,
      scope:              'Consulting services.',
      start_date:         data.startDate,
      first_payment_date: data.firstPaymentDate,
      amount:             data.amount ?? 50,
      currency_id:        data.currencyId,
      rate_id:            data.rateId ?? 1,
      template_id:        data.templateId,
      ...(data.taxResidenceId !== undefined && { tax_residence_id: data.taxResidenceId }),
      frequency_id:      data.frequencyId ?? 4,
      occurrence_id:     data.occurrenceId ?? 17,
      notice_period:     30,
      signatory_id:      data.signatoryId,
      client_can_submit: 1,
      kyc:               1,
      extra:             1,
      is_cor:            true,
    });
  }

  /** Create a COR Milestone contract (POST /api/contract/milestone/create, is_cor: true). */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createCorMilestoneContract(data: ContractorContractCreateData): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[ContractsClient] createCorMilestoneContract contractor=${data.contractorName}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.milestoneCreate, {
      name:            data.contractName ?? `QA COR Milestone ${Date.now()}`,
      contractor_name: data.contractorName,
      scope:           'Deliverables per milestone schedule.',
      currency_id:     data.currencyId,
      template_id:     data.templateId,
      ...(data.taxResidenceId !== undefined && { tax_residence_id: data.taxResidenceId }),
      notice_period: 30,
      signatory_id:  data.signatoryId,
      kyc:           1,
      extra:         1,
      is_cor:        true,
      milestones: data.milestones ?? [
        { name: 'Phase 1', amount: 500 },
        { name: 'Phase 2', amount: 500 },
      ],
    });
  }

  /**
   * Client-side COR SOW signature (POST /api/contract/cor/sow/sign) — distinct
   * from `AdminClient.signCorSow`, which signs the SAME SOW as the provider
   * (two-party flow, mirrors `clientSign`/admin `signAsProvider` for EOR).
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async signCorSow(contractId: number, signerName: string): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[ContractsClient] signCorSow contractId=${contractId}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.corSowSign, {
      name:        signerName,
      contract_id: contractId,
    });
  }
}
