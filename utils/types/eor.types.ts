/**
 * EOR (Employer of Record) Contract Types
 * Related to PD-13186: Allow clients to update salary currency on EOR contracts
 */

export const EOR_STATUS = {
  ONGOING: { id: 4, name: 'Ongoing' },
} as const;

export const EOR_CONTRACT_TYPE = {
  EOR_EMPLOYEE: 'EOR Employee',
} as const;

export interface EORCurrency {
  id: number;
  code: string;
  symbol: string;
  name: string;
}

export interface EORAllowance {
  id?: number;
  name: string;
  amount: number | string; // API may return string — callers should use Number(allowance.amount)
  currency_id?: number;
}

/**
 * ✅ Confirmed body shape via Network tab (2026-04-21):
 * PATCH /api/contract/fulltime/{id}
 * { contract_id, amount, currency_id, employment_term, allowances, first_payment_prorata }
 */
export interface UpdateEORContractRequest {
  contract_id?: number;
  currency_id?: number;
  amount?: number; // confirmed as numeric from Network tab; use number only
  employment_term?: string;
  allowances?: EORAllowance[];
  first_payment_prorata?: boolean;
  name?: string;
  start_date?: string;
}

/**
 * ✅ Confirmed via Network tab (2026-04-21): POST /api/contract/amendment/add
 */
export interface EORAmendment {
  id: number;
  contract_id: number;
  status: string | { id: number; name: string }; // ⚠️ shape unconfirmed — verify via Network tab
  currency_id?: number;
  currency?: EORCurrency;
  amount?: number; // confirmed as numeric from Network tab; use number only
  created_at?: string;
  effective_date?: string;
}

/**
 * Payload for POST /api/contract/fulltime — create an EOR contract.
 * Fields discovered via probe (PD-12901).
 */
export interface CreateEORContractRequest {
  employee_first_name: string;
  employee_last_name: string;
  employee_email: string;
  country_id?: number;
  employee_country_id: number;
  employee_nationality_country_id?: number;
  nationality_id?: number;
  working_from_country_id?: number;
  work_visa?: number;
  job_title: string;
  job_description?: string;
  scope?: string;
  qualification?: string;
  amount: number | string;
  currency_id: number;
  start_date: string;
  employment_term?: string;
  employment_type?: string;
  insurance?: number;
  working_hours_per_week?: number;
  annual_leave_days?: number;
  notice_period?: number;
  trial_period?: number;
  allowances?: EORAllowance[];
}

export interface ImmigrationFormInput {
  form_field_id: number;
  value: string;
}
 