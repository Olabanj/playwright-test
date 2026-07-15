/**
 * Policy builder — data-only, no HTTP.
 * Produces a valid CreatePolicyRequest with a unique title.
 * Mirror of legacy policies.spec.ts create payloads (flexible + schedule_window variants).
 */

import { CreatePolicyRequest, CreatePolicyDay, CreatePolicyOvertime, WorkerType } from '../types';
import { TIME_BASIS, OVERTIME_TYPE } from '../constants';

/**
 * Build a valid CreatePolicyRequest with a unique title. Accepts partial overrides.
 *
 * TODO(cleanup): workerType was not in the legacy suite — TT API added it as a required
 * field post-migration. Default 'per_hour' (flexible) / 'fixed_contractor' (schedule_window)
 * chosen as closest semantic match; verify correct per-test value with product team.
 */
export function buildPolicy(overrides: Partial<CreatePolicyRequest> = {}): CreatePolicyRequest {
  const title = overrides.title ?? `QA Policy ${Date.now()}`;
  return {
    title,
    timeBasis:                 TIME_BASIS.FLEXIBLE,
    // workerType required by TT API since 2026-06; not in legacy suite. TODO(cleanup).
    workerType:                'per_hour' as WorkerType,
    isManualEntryAllowed:      true,
    isTimeTrackerEntryAllowed: true,
    isEditingAllowed:          false,
    requireReasonOnEdit:       false,
    days:                      defaultFlexibleDays(),
    overtime:                  defaultWeeklyOvertime(),
    ...overrides,
  };
}

/** Flexible-basis variant — weekly overtime, no fixed hours per day. */
export function buildFlexiblePolicy(overrides: Partial<CreatePolicyRequest> = {}): CreatePolicyRequest {
  return buildPolicy({
    timeBasis: TIME_BASIS.FLEXIBLE,
    days:      defaultFlexibleDays(),
    overtime:  defaultWeeklyOvertime(),
    ...overrides,
  });
}

/** Schedule-window variant — fixed start/end times, daily overtime. */
export function buildScheduleWindowPolicy(overrides: Partial<CreatePolicyRequest> = {}): CreatePolicyRequest {
  return buildPolicy({
    timeBasis:  TIME_BASIS.SCHEDULE_WINDOW,
    workerType: 'fixed_contractor' as WorkerType, // TODO(cleanup): verify with product team
    days:       defaultScheduleDays(),
    overtime:   defaultDailyOvertime(),
    ...overrides,
  });
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Mon–Fri flexible days (no fixed start/end, 8h total). */
function defaultFlexibleDays(): CreatePolicyDay[] {
  return [1, 2, 3, 4, 5].map((day) => ({
    day,
    totalMinutes: 480, // 8 hours
    isFullDay:    false,
  }));
}

/** Mon–Fri schedule-window days (09:00–17:00). */
function defaultScheduleDays(): CreatePolicyDay[] {
  return [1, 2, 3, 4, 5].map((day) => ({
    day,
    startTime: '09:00',
    endTime:   '17:00',
    isFullDay: false,
  }));
}

function defaultWeeklyOvertime(): CreatePolicyOvertime {
  return {
    type:              OVERTIME_TYPE.WEEKLY,
    dailyWorkingHours: 8,
    threshold:         40,
    cap:               20,
    multiplier:        1.5,
  };
}

function defaultDailyOvertime(): CreatePolicyOvertime {
  return {
    type:              OVERTIME_TYPE.DAILY,
    dailyWorkingHours: 8,
    threshold:         8,
    cap:               4,
    multiplier:        1.5,
  };
}
