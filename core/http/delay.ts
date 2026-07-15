/**
 * Transport-level backoff for HTTP retry loops (e.g. honoring a `Retry-After`
 * header on a 429 from the shared sandbox login throttle).
 *
 * This is the ONE blessed home for a network-pacing timer in the framework.
 * WAIT-002 (eslint/architecture.mjs) bans `setTimeout` because on a page it is
 * a substitute for Playwright auto-wait / web-first assertions. That reasoning
 * does not apply here: there is no page, locator, or URL to await — we are
 * pacing raw HTTP requests against a server-side rate limit, for which
 * Playwright has no equivalent primitive. A bounded backoff genuinely requires
 * a timer. Keeping it in `core/http` (a dependency-free leaf, next to
 * BaseApiClient/assertOk) means the sanctioned exception lives in exactly one
 * auditable place instead of being copy-pasted into fixtures.
 *
 * Sanctioned WAIT-002 exception — see ADR 2026-06-25-dmytro-wait002-enforce and
 * ADR 2026-07-07-dmytro-login-throttle-global-setup-cache. NOT a flaky UI wait,
 * so intentionally NOT tagged TODO(flaky).
 */
export function delay(ms: number): Promise<void> {
  // eslint-disable-next-line no-restricted-syntax -- WAIT-002 sanctioned transport backoff (network Retry-After pacing, not a UI settle-delay); ADR 2026-07-07-dmytro-login-throttle-global-setup-cache
  return new Promise((resolve) => setTimeout(resolve, ms));
}
