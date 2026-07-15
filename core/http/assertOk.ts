import { ApiResponse } from '@core/types/api.types';

/**
 * Shared success guards for client mutations.
 *
 * `ApiResponse<T>` deliberately does NOT throw on non-2xx (negative tests assert
 * status codes directly — see time-tracking/tests/api/sessions.error-handling.spec.ts).
 * These are opt-in, free functions a mutation calls when it wants the "succeed or
 * throw" contract. They are NOT wired into BaseApiClient — keeping the no-throw
 * transport contract intact. The transport line (HTTP method/url/status) is logged
 * automatically in BaseApiClient; these guards add no logging.
 *
 * Convention C (methods that intentionally return the raw ApiResponse —
 * auth.login/logout, contracts.clientSign/createCurrencyAmendment,
 * admin.signAsProvider) does NOT call these.
 */

interface SuccessBody {
  success?: boolean;
}

/** True when the response is an HTTP success and the body did not flag success:false. */
function isOk(status: number, body: unknown): boolean {
  if (status < 200 || status >= 300) return false;
  if (body && typeof body === 'object' && (body as SuccessBody).success === false) return false;
  return true;
}

/**
 * Throw a labelled error unless the response is a 2xx with no `success: false` flag.
 * Use in client mutations that return `void` (or a value extracted by the caller).
 *
 * @param res   the raw ApiResponse from a client request
 * @param label human-readable step name for the error message (e.g. "signup")
 */
export function assertOk<T>(res: ApiResponse<T>, label: string): void {
  if (!isOk(res.status, res.body)) {
    throw new Error(`${label} failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
}

interface IdBody {
  id?: number;
  data?: { id?: number };
}

/**
 * `assertOk` plus extract a created-resource id from `body.data.id ?? body.id`.
 * Throws if the response is not ok or no id is present. Use in mutations that
 * create a resource and must return its id (e.g. addExpense, uploadReceipt-style flows).
 *
 * @returns the numeric id of the created resource
 */
export function assertOkWithId<T>(res: ApiResponse<T>, label: string): number {
  assertOk(res, label);
  const body = res.body as IdBody | undefined;
  const id = body?.data?.id ?? body?.id;
  if (id === undefined || id === null) {
    throw new Error(`${label} returned no id (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return id;
}
