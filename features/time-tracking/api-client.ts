import { BaseApiClient } from '@core/http/BaseApiClient';
import { ENDPOINTS } from '@core/config/endpoints';
import { env } from '@core/config/env';
import { ApiResponse } from '@core/types/api.types';
import { logVerbose } from '@utils/helpers/logger';
import {
  TtEnvelope,
  PaginatedResult,
  Policy,
  PolicySummary,
  CreatePolicyRequest,
  UpdatePolicyRequest,
  ListPoliciesFilters,
  TitleAvailability,
  HealthResult,
  ContractSummary,
  ListContractsFilters,
  Session,
  CreateSessionRequest,
  UpdateSessionRequest,
} from './types';

/**
 * HTTP client for the Time Tracking microservice.
 * One method = one endpoint. Every method uses return convention C (raw
 * ApiResponse<TtEnvelope<T>>) so specs can assert on both `.status` and
 * `.body.result.*` — no assertOk here, by design.
 *
 * Host: env.timeTrackingApiUrl (separate AWS host, NOT API_BASE_URL).
 * Envelope: { result: T } (not { data }).
 */
export class TimeTrackingClient extends BaseApiClient {
  constructor() {
    super(env.timeTrackingApiUrl);
  }

  /** GET /timetracking/api/v1/server/healthy */
  async checkHealth(): Promise<ApiResponse<TtEnvelope<HealthResult>>> {
    // No semantic log: arg-less call, the transport line already covers it (D5).
    return this.get<TtEnvelope<HealthResult>>(ENDPOINTS.timeTracking.health);
  }

  /** GET /timetracking/api/v1/policies — paginated list with optional filters. */
  async listPolicies(
    filters?: ListPoliciesFilters,
  ): Promise<ApiResponse<TtEnvelope<PaginatedResult<PolicySummary>>>> {
    const filterSuffix = filters ? ` filters=${JSON.stringify(filters)}` : '';
    logVerbose(`[TimeTrackingClient] listPolicies${filterSuffix}`);
    return this.get<TtEnvelope<PaginatedResult<PolicySummary>>>(
      ENDPOINTS.timeTracking.policies,
      filters as Record<string, string | number | boolean> | undefined,
    );
  }

  /** GET /timetracking/api/v1/policies/{id} — full policy detail. */
  async getPolicyById(id: number): Promise<ApiResponse<TtEnvelope<Policy>>> {
    logVerbose(`[TimeTrackingClient] getPolicyById id=${id}`);
    return this.get<TtEnvelope<Policy>>(ENDPOINTS.timeTracking.policyById(id));
  }

  /** POST /timetracking/api/v1/policies — create a new policy. Returns 201 + result.id. */
  async createPolicy(data: CreatePolicyRequest): Promise<ApiResponse<TtEnvelope<{ id: number }>>> {
    logVerbose(`[TimeTrackingClient] createPolicy title="${data.title}"`);
    return this.post<TtEnvelope<{ id: number }>>(ENDPOINTS.timeTracking.policies, data);
  }

  /** PATCH /timetracking/api/v1/policies/{id} — update an existing policy. */
  async updatePolicy(
    id: number,
    data: UpdatePolicyRequest,
  ): Promise<ApiResponse<TtEnvelope<Policy>>> {
    logVerbose(`[TimeTrackingClient] updatePolicy id=${id}`);
    return this.patch<TtEnvelope<Policy>>(ENDPOINTS.timeTracking.policyById(id), data);
  }

  /** DELETE /timetracking/api/v1/policies/{id} — delete a policy. Returns 204 (no body). */
  async deletePolicy(id: number): Promise<ApiResponse<unknown>> {
    logVerbose(`[TimeTrackingClient] deletePolicy id=${id}`);
    return this.delete<unknown>(ENDPOINTS.timeTracking.policyById(id));
  }

  /**
   * POST /timetracking/api/v1/policies/titles/availability:check
   * Returns 200 + result.isAvailable:boolean.
   */
  async checkTitleAvailability(
    title: string,
  ): Promise<ApiResponse<TtEnvelope<TitleAvailability>>> {
    logVerbose(`[TimeTrackingClient] checkTitleAvailability title="${title}"`);
    return this.post<TtEnvelope<TitleAvailability>>(
      ENDPOINTS.timeTracking.policyTitleCheck,
      { title },
    );
  }

  /**
   * GET /timetracking/api/v1/policies/contracts/{contractId} — the policy assigned to
   * a contract. 200 + result when assigned; 404 when the contract has no policy or does
   * not exist (and 400 for malformed ids, per the invalid-id family).
   */
  async getPolicyByContract(contractId: number): Promise<ApiResponse<TtEnvelope<Policy>>> {
    logVerbose(`[TimeTrackingClient] getPolicyByContract contractId=${contractId}`);
    return this.get<TtEnvelope<Policy>>(ENDPOINTS.timeTracking.policyByContract(contractId));
  }

  /** GET /timetracking/api/v1/contracts — paginated list with optional filters (limit ≤ 50). */
  async getContracts(
    filters?: ListContractsFilters,
  ): Promise<ApiResponse<TtEnvelope<PaginatedResult<ContractSummary>>>> {
    const filterSuffix = filters ? ` filters=${JSON.stringify(filters)}` : '';
    logVerbose(`[TimeTrackingClient] getContracts${filterSuffix}`);
    return this.get<TtEnvelope<PaginatedResult<ContractSummary>>>(
      ENDPOINTS.timeTracking.contracts,
      filters as Record<string, string | number | boolean> | undefined,
    );
  }

  /**
   * PUT /timetracking/api/v1/policies/{id}/workers — replace ALL assigned workers.
   * Body: { contractIds: number[] }. Pass [] to clear all workers.
   * Returns 200 or 204 on success; 404 for unknown policy id.
   */
  async replaceAllPolicyWorkers(
    id: number,
    contractIds: number[],
  ): Promise<ApiResponse<TtEnvelope<unknown>>> {
    logVerbose(`[TimeTrackingClient] replaceAllPolicyWorkers policyId=${id} count=${contractIds.length}`);
    return this.put<TtEnvelope<unknown>>(
      ENDPOINTS.timeTracking.policyWorkers(id),
      { contractIds },
    );
  }

  /**
   * PATCH /timetracking/api/v1/policies/{id}/workers — add or remove workers.
   * Both arrays must be present in the body even when empty (API requirement).
   * Returns 200 or 204 on success.
   */
  async modifyPolicyWorkers(
    id: number,
    newContractIds: number[] = [],
    removedContractIds: number[] = [],
  ): Promise<ApiResponse<TtEnvelope<unknown>>> {
    logVerbose(`[TimeTrackingClient] modifyPolicyWorkers policyId=${id} add=${newContractIds.length} remove=${removedContractIds.length}`);
    return this.patch<TtEnvelope<unknown>>(
      ENDPOINTS.timeTracking.policyWorkers(id),
      { newContractIds, removedContractIds },
    );
  }

  // ─── Session methods (Batch 6a) ──────────────────────────────────────────────

  /**
   * POST /timetracking/api/v1/time-sessions — clock-in / create a session.
   * Returns 201 + result.id on success.
   * Defaults timezone to 'Asia/Amman' when absent (TT API requirement, live-verified).
   */
  async createTimeSession(data: CreateSessionRequest): Promise<ApiResponse<TtEnvelope<Session>>> {
    logVerbose(`[TimeTrackingClient] createTimeSession contractId=${data.contractId}`);
    return this.post<TtEnvelope<Session>>(ENDPOINTS.timeTracking.timeSessions, {
      timezone: 'Asia/Amman',
      ...data,
    });
  }

  /** GET /timetracking/api/v1/time-sessions/{id} — fetch a single session by id. */
  async getTimeSessionById(id: number): Promise<ApiResponse<TtEnvelope<Session>>> {
    logVerbose(`[TimeTrackingClient] getTimeSessionById id=${id}`);
    return this.get<TtEnvelope<Session>>(ENDPOINTS.timeTracking.timeSessionById(id));
  }

  /** PATCH /timetracking/api/v1/time-sessions/{id} — update session fields. */
  async updateTimeSession(
    id: number,
    data: UpdateSessionRequest,
  ): Promise<ApiResponse<TtEnvelope<Session>>> {
    logVerbose(`[TimeTrackingClient] updateTimeSession id=${id}`);
    return this.patch<TtEnvelope<Session>>(ENDPOINTS.timeTracking.timeSessionById(id), data);
  }

  /** DELETE /timetracking/api/v1/time-sessions/{id} — delete a session. Returns 204. */
  async deleteTimeSession(id: number): Promise<ApiResponse<unknown>> {
    logVerbose(`[TimeTrackingClient] deleteTimeSession id=${id}`);
    return this.delete<unknown>(ENDPOINTS.timeTracking.timeSessionById(id));
  }

  /**
   * POST /timetracking/api/v1/time-sessions/{id}/pause — pause an active session.
   * Live-probed body: { id: String(sessionId) } (string, not number).
   * Returns 200 + result.id on success.
   */
  async pauseTimeSession(
    id: number,
    data?: { title?: string; note?: string },
  ): Promise<ApiResponse<TtEnvelope<Session>>> {
    logVerbose(`[TimeTrackingClient] pauseTimeSession id=${id}`);
    return this.post<TtEnvelope<Session>>(ENDPOINTS.timeTracking.timeSessionPause(id), {
      id: String(id),
      ...data,
    });
  }

  /**
   * POST /timetracking/api/v1/time-sessions/{id}/resume — resume a paused session.
   * Live-probed body: { id: String(sessionId) } (string, not number).
   * Returns 200 + result.id on success.
   */
  async resumeTimeSession(
    id: number,
    data?: { title?: string; note?: string },
  ): Promise<ApiResponse<TtEnvelope<Session>>> {
    logVerbose(`[TimeTrackingClient] resumeTimeSession id=${id}`);
    return this.post<TtEnvelope<Session>>(ENDPOINTS.timeTracking.timeSessionResume(id), {
      id: String(id),
      ...data,
    });
  }

  /**
   * POST /timetracking/api/v1/time-sessions/{id}/end — end an active session.
   * Returns 200 + body {} or { title, note }.
   */
  async endTimeSession(
    id: number,
    data?: { title?: string; note?: string },
  ): Promise<ApiResponse<TtEnvelope<Session>>> {
    logVerbose(`[TimeTrackingClient] endTimeSession id=${id}`);
    return this.post<TtEnvelope<Session>>(ENDPOINTS.timeTracking.timeSessionEnd(id), data ?? {});
  }

  /**
   * GET /timetracking/api/v1/time-sessions/contracts/{contractId}/active
   * Returns 200 + result when an active session exists; **204 (no body) when none**.
   * Callers must treat 204 as "no active session" — do NOT assume 200 means no session.
   */
  async getActiveSessionByContract(
    contractId: number,
  ): Promise<ApiResponse<TtEnvelope<Session>>> {
    logVerbose(`[TimeTrackingClient] getActiveSessionByContract contractId=${contractId}`);
    return this.get<TtEnvelope<Session>>(ENDPOINTS.timeTracking.activeSessionByContract(contractId));
  }
}
