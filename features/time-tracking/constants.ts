/**
 * Time Tracking domain constants — enums / picklists used by the builder and specs.
 * Source: legacy TIME_TRACKING_ENDPOINTS + TT Swagger.
 */

/** The three scheduling models a policy can operate under. */
export const TIME_BASIS = {
  FLEXIBLE:        'flexible',
  SCHEDULE_WINDOW: 'schedule_window',
  TOTAL_HOURS:     'total_hours',
} as const;

export type TimeBasisValue = (typeof TIME_BASIS)[keyof typeof TIME_BASIS];

/** Overtime calculation window. */
export const OVERTIME_TYPE = {
  DAILY:  'daily',
  WEEKLY: 'weekly',
} as const;

export type OvertimeTypeValue = (typeof OVERTIME_TYPE)[keyof typeof OVERTIME_TYPE];

/** Day-schedule kind used in a policy day entry. */
export const POLICY_DAY_TYPE = {
  FIXED_HOURS: 'fixed_hours',
  FLEXIBLE:    'flexible',
} as const;
