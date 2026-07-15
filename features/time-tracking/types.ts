/**
 * Time Tracking domain types — Batch 1 (policy CRUD).
 * Response envelope: { result: T } (NOT { data } — this is the TT microservice).
 * Ported from legacy utils/types/time-tracking.types.ts with `any` eliminated.
 */

// ─── Enums / unions ──────────────────────────────────────────────────────────

export type TimeBasis   = 'flexible' | 'schedule_window' | 'total_hours';
export type OvertimeType = 'daily' | 'weekly';
export type PolicyDayType = 'fixed_hours' | 'flexible';
/**
 * Worker contract type — required by the TT API as of 2026-06.
 * Not present in the legacy suite (added post-legacy); carry verbatim.
 * TODO(cleanup): verify correct per-test value with product team.
 */
export type WorkerType =
  | 'eor'
  | 'direct_employee'
  | 'fixed_contractor'
  | 'per_month'
  | 'per_day'
  | 'per_hour'
  | 'per_minute'
  | 'per_task'
  | 'milestones';

// ─── TT envelope (wraps every TT API response) ───────────────────────────────

/** Every TT microservice response body is `{ result: T }`. */
export interface TtEnvelope<T> {
  result: T;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items:             T[];
  page:              number;
  limit:             number;
  total_items_count: number;
  total_pages_count: number;
}

// ─── Policy sub-shapes ───────────────────────────────────────────────────────

export interface PolicyDay {
  id:           number;
  day:          number;        // 0 (Sunday) – 6 (Saturday)
  type:         PolicyDayType;
  startTime:    string | null; // HH:mm
  endTime:      string | null; // HH:mm
  totalMinutes: number | null;
  isFullDay:    boolean;
  policyId:     number;
  createdAt:    string;
  updatedAt:    string;
}

export interface PolicyOvertime {
  id:                number;
  type:              OvertimeType;
  dailyWorkingHours: number;
  threshold:         number;
  cap:               number;
  multiplier:        number;
  policyId:          number;
  createdAt:         string;
  updatedAt:         string;
}

// ─── Policy (full detail, as returned by GET /policies/{id}) ─────────────────

export interface Policy {
  id:                       number;
  companyId:                string;
  title:                    string;
  timeBasis:                TimeBasis;
  isManualEntryAllowed:     boolean;
  isTimeTrackerEntryAllowed: boolean;
  isEditingAllowed:         boolean;
  requireReasonOnEdit:      boolean;
  createdAt:                string;
  updatedAt:                string;
  days:                     PolicyDay[];
  overtime:                 PolicyOvertime | null;
  [key: string]:            unknown; // allow forward-compatible API additions
}

/** Summary shape returned in paginated list (no days/overtime). */
export interface PolicySummary {
  id:                       number;
  companyId:                string;
  title:                    string;
  timeBasis:                TimeBasis;
  isManualEntryAllowed:     boolean;
  isTimeTrackerEntryAllowed: boolean;
  isEditingAllowed:         boolean;
  requireReasonOnEdit:      boolean;
  createdAt:                string;
  updatedAt:                string;
  [key: string]:            unknown;
}

// ─── Request shapes ──────────────────────────────────────────────────────────

export interface CreatePolicyDayFixed {
  day:       number;  // 0-6
  startTime: string;  // HH:mm
  endTime:   string;  // HH:mm
  isFullDay: boolean;
}

export interface CreatePolicyDayFlexible {
  day:          number;
  totalMinutes?: number; // 0-1440
  isFullDay:    boolean;
}

export type CreatePolicyDay = CreatePolicyDayFixed | CreatePolicyDayFlexible;

export interface CreatePolicyOvertime {
  type:              OvertimeType;
  dailyWorkingHours: number;
  threshold:         number;
  cap:               number;
  multiplier:        number;
}

export interface CreatePolicyRequest {
  title:                     string; // max 255 chars
  timeBasis:                 TimeBasis;
  /** Required by TT API (added post-legacy — not in legacy suite). TODO(cleanup): verify value per use-case. */
  workerType:                WorkerType;
  isManualEntryAllowed?:     boolean;
  isTimeTrackerEntryAllowed?: boolean;
  isEditingAllowed?:         boolean;
  requireReasonOnEdit?:      boolean;
  days?:                     CreatePolicyDay[];
  overtime?:                 CreatePolicyOvertime;
}

export interface UpdatePolicyRequest {
  title?:                    string;
  timeBasis:                 TimeBasis;
  isManualEntryAllowed?:     boolean;
  isTimeTrackerEntryAllowed?: boolean;
  isEditingAllowed?:         boolean;
  requireReasonOnEdit?:      boolean;
  days?:                     CreatePolicyDay[] | null;
  overtime?:                 CreatePolicyOvertime | null;
}

// ─── Query filters ────────────────────────────────────────────────────────────

export interface ListPoliciesFilters {
  timeBasis?:                TimeBasis;
  isManualEntryAllowed?:     boolean;
  isTimeTrackerEntryAllowed?: boolean;
  isEditingAllowed?:         boolean;
  requireReasonOnEdit?:      boolean;
  title?:                    string;
  limit?:                    number; // 1-50, default 10
  page?:                     number; // min 1, default 1
}

// ─── Contracts ───────────────────────────────────────────────────────────────

/**
 * Minimal contract summary shape returned by GET /timetracking/api/v1/contracts.
 * The TT microservice assigns a contract id (`id`) used for policy-worker assignment —
 * assign by contract id, NOT contractor/user id.
 *
 * NOTE (live-verified 2026-06-25): `id` is a STRING in the TT response (e.g. "17515");
 * `type` is human-readable ("Contractor" | "EOR Employee"); the worker-type discriminator
 * lives in `subtype` ("fixed" | "payg" | "milestones" | "full_time") combined with
 * `rateCode` ("hour" | "day" | null) — NOT in `type`. The TT API enforces that an assigned
 * contract's worker-type matches the policy's `workerType` (else 400).
 */
export interface ContractSummary {
  id:            string;
  ref?:          string;
  contractorId?: number;
  userId?:       string;
  /** Human-readable contract type, e.g. 'Contractor' | 'EOR Employee'. */
  type:          string;
  /** Worker-type discriminator, e.g. 'fixed' | 'payg' | 'milestones' | 'full_time'. */
  subtype?:      string;
  /** Rate granularity for PAYG contracts: 'hour' | 'day' | null. */
  rateCode?:     string | null;
  /** Contract status id (4 = Ongoing). */
  statusId?:     number;
  [key: string]: unknown;
}

/** Subset of query filters accepted by GET /timetracking/api/v1/contracts (limit ≤ 50). */
export interface ListContractsFilters {
  contractId?:          number;
  policyId?:            number;
  hasAssignedPolicy?:   boolean;
  limit?:               number; // 1–50
  page?:                number;
}

// ─── Worker-assignment request shapes ────────────────────────────────────────

/** Body for PATCH /timetracking/api/v1/policies/{id}/workers (add/remove). */
export interface ModifyPolicyWorkersRequest {
  newContractIds:     number[];
  removedContractIds: number[];
}

// ─── Session shapes ──────────────────────────────────────────────────────────

/** Request body for POST /timetracking/api/v1/time-sessions (clock-in). */
export interface CreateSessionRequest {
  title:       string;
  note?:       string;
  startTime?:  string;
  endTime?:    string;
  /** IANA timezone. Defaults to 'Asia/Amman' when absent (TT API requirement). */
  timezone?:   string;
  contractId:  number;
}

/** Request body for PATCH /timetracking/api/v1/time-sessions/{id}. */
export interface UpdateSessionRequest {
  title?:     string;
  note?:      string;
  startTime?: string;
  endTime?:   string;
  reason?:    string;
}

/** A single tracked sub-interval within a session (active/paused spans). */
export interface SessionSubsession {
  id:            number;
  timeSessionId: number;
  startTime:     string;
  state:         string;
  createdAt:     string;
  updatedAt:     string;
  [key: string]: unknown;
}

/** An audit entry recording a field edit on a session. */
export interface SessionEdit {
  id:            number;
  timeSessionId: number;
  editedBy?:     unknown;
  editedFields?: unknown;
  createdAt:     string;
  [key: string]: unknown;
}

/** Full session object as returned by GET/POST /timetracking/api/v1/time-sessions/{id}. */
export interface Session {
  id:             number;
  workerId?:      number | string;
  contractId:     number | string;
  companyId?:     number | string;
  state:          string;
  startTime:      string | null;
  endTime:        string | null;
  workedMinutes:  number;
  pausedMinutes:  number;
  totalMinutes:   number;
  subsessions:    SessionSubsession[];
  attachments:    unknown[];
  edits:          SessionEdit[];
  policySnapshot?: unknown;
  createdAt:      string;
  updatedAt:      string;
  [key: string]:  unknown;
}

// ─── Title availability ──────────────────────────────────────────────────────

export interface TitleAvailability {
  isAvailable: boolean;
}

// ─── Health ──────────────────────────────────────────────────────────────────

export interface HealthResult {
  status:  string;
  [key: string]: unknown;
}
