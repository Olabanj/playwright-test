import { BaseApiClient } from '@core/http/BaseApiClient';
import { ENDPOINTS } from '@core/config/endpoints';
import { ApiResponse } from '@core/types/api.types';
import { logVerbose } from '@utils/helpers/logger';

export interface LoginResponse {
  data: {
    token: string;
  };
}

/**
 * Auth client. `login`/`logout` use return convention C (raw ApiResponse) so callers
 * and negative tests can assert on status/body directly — they do NOT call assertOk.
 */
export class AuthClient extends BaseApiClient {
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    logVerbose(`[AuthClient] login email=${email}`);
    return this.post<LoginResponse>(ENDPOINTS.auth.login, { email, password });
  }

  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  // No semantic log: arg-less mutation, the transport line already covers it (D5).
  async logout(): Promise<ApiResponse> {
    return this.post<unknown>(ENDPOINTS.auth.logout);
  }
}
