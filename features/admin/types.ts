// Admin API wire shapes (shared admin client — used by onboarding, contracts, …).

export interface AdminLoginResponse {
  success?: boolean;
  data?:    { token?: string };
}

/** Loose admin-mutation response — `data.error` carries idempotent "already done" markers. */
export interface AdminMutationResponse {
  success?:      boolean;
  message?:      string;
  data?:         { error?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** Loose list-wrapper for admin list endpoints (COR contracts, transfers, …). */
export interface AdminListResponse<T = Record<string, unknown>> {
  success?:      boolean;
  data?:         T[];
  [key: string]: unknown;
}
