import { request, APIRequestContext, APIResponse } from '@playwright/test';
import { env } from '@core/config/env';
import { ApiResponse, HttpMethod } from '@core/types/api.types';
import { logVerbose } from '@utils/helpers/logger';

/** A file part for a multipart/form-data upload. */
export interface FilePart {
  name:     string;
  mimeType: string;
  buffer:   Buffer;
}

export class BaseApiClient {
  protected context!: APIRequestContext;
  protected baseURL: string;
  protected authToken?: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL ?? env.apiBaseUrl;
  }

  async init(authToken?: string): Promise<void> {
    this.authToken = authToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept:         'application/json',
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    if (env.e2eSecretKey) {
      headers['x-e2e-secret-key'] = env.e2eSecretKey;
    }
    this.context = await request.newContext({
      baseURL:          this.baseURL,
      extraHTTPHeaders: headers,
    });
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }

  protected async get<T>(url: string, params?: Record<string, string | number | boolean>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, { params });
  }

  protected async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, { data });
  }

  protected async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, { data });
  }

  protected async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', url, { data });
  }

  /**
   * POST multipart/form-data. Uses a dedicated request context that omits the
   * JSON Content-Type so Playwright sets the correct multipart boundary itself.
   * Reuses the auth token captured in init().
   */
  protected async postMultipart<T>(
    url: string,
    multipart: Record<string, string | number | boolean | FilePart>,
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    if (env.e2eSecretKey) {
      headers['x-e2e-secret-key'] = env.e2eSecretKey;
    }
    const ctx = await request.newContext({
      baseURL:          this.baseURL,
      extraHTTPHeaders: headers,
    });
    const startedAt = Date.now();
    try {
      const response: APIResponse = await ctx.fetch(url, { method: 'POST', multipart });
      const body = await this.parseBody<T>(response);
      logVerbose(`HTTP POST(multipart) ${url} → ${response.status()} (${Date.now() - startedAt}ms)`);
      return {
        status:  response.status(),
        body,
        headers: response.headers(),
      };
    } finally {
      await ctx.dispose();
    }
  }

  protected async delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url, {});
  }

  /**
   * Perform one request using a DIFFERENT bearer token than the one this client
   * was `init()`'d with (e.g. a contractor signing with their own token via a
   * client instance authenticated as the company). Opens a short-lived request
   * context mirroring `init()`'s header handling, and disposes it immediately
   * after — the caller's own `this.context` is never touched.
   *
   * Additive primitive (2026-07-08) replacing the legacy hand-rolled
   * `request.newContext` dance duplicated per-feature (e.g. contracts'
   * `signContractWithToken`, admin provider sign-as-different-identity).
   */
  protected async requestAsToken<T>(
    token: string,
    method: HttpMethod,
    url: string,
    data?: unknown,
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept:         'application/json',
      Authorization:  `Bearer ${token}`,
    };
    if (env.e2eSecretKey) {
      headers['x-e2e-secret-key'] = env.e2eSecretKey;
    }
    const ctx = await request.newContext({ baseURL: this.baseURL, extraHTTPHeaders: headers });
    const startedAt = Date.now();
    try {
      const response: APIResponse = await ctx.fetch(url, { method, data });
      const body = await this.parseBody<T>(response);
      logVerbose(`HTTP ${method} ${url} → ${response.status()} (${Date.now() - startedAt}ms) [as different token]`);
      return {
        status:  response.status(),
        body,
        headers: response.headers(),
      };
    } finally {
      await ctx.dispose();
    }
  }

  private async request<T>(
    method: HttpMethod,
    url: string,
    options: { data?: unknown; params?: Record<string, string | number | boolean> },
  ): Promise<ApiResponse<T>> {
    const startedAt = Date.now();
    const response: APIResponse = await this.context.fetch(url, {
      method,
      data:   options.data,
      params: options.params,
    });
    const body = await this.parseBody<T>(response);
    const durationMs = Date.now() - startedAt;

    logVerbose(`HTTP ${method} ${url} → ${response.status()} (${durationMs}ms)`);

    return {
      status:  response.status(),
      body,
      headers: response.headers(),
    };
  }

  private async parseBody<T>(response: APIResponse): Promise<T> {
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
}
