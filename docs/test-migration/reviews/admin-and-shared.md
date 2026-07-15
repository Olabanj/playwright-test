# Admin + verify-email cleanup + core-config — Compliance Audit (2026-06-24)

> Specialist review of the main-loop migration (`migration-reviewer-agent` + `qa-architect-agent`).
> Read-only audit against the 14-item review-checklist and the 8-pattern architecture.

**Verdict: APPROVE (all three).** Zero clear violations. `tsc --noEmit` exit 0, `lint:arch` exit 0.

## `features/admin/**` → APPROVE
- `AdminClient` extends `BaseApiClient`; methods `loginTest` / `approveCompanyKyb` / `disable2fa` / `signAsProvider` are each 1 endpoint; reads only `env.adminLoginKey` (client.ts:24,27); typed via `types.ts`; `signAsProvider` returns `ApiResponse<T>` so callers handle the idempotent "already signed".
- **Shared promotion is the correct shape, not a boundary violation** (architect ruling): admin is a bounded backend capability (test-login/KYB/2FA/provider-sign), not another feature's business logic. Two real consumers (onboarding fixture + contracts spec) satisfy the promote-on-second-use rule. It is a leaf client — imports no peer feature, so no boundary cycle.

## `features/client-registration/tests/ui/frontoffice/verify-email.spec.ts` → APPROVE
- The dropped "Resend and Sign In links" test is documented as a strict subset of the retained "all required elements" test — no coverage lost, no orphaned references; all fixtures (`atVerifyEmailStep`, `signupEmail`, `signUpPage`, `generalInfoPage`) and constants (`REGISTRATION_ERRORS.INVALID_CODE`, `BYPASS_VERIFICATION_CODE`) resolve.
- `codeItems.nth(i)` is positional indexing over an asserted count of 4, not a brittle CSS `nth-child` — passes the stable-locator item. Remaining flaky element-checks are tagged `TODO(flaky)` (sandbox/CI infra blocker).

## `core/config/{endpoints,env}.ts` → APPROVE (no smell)
- `endpoints.ts` is pure data (`as const`, path-builder arrow functions only, no logic).
- `env.ts` is the **sole** `process.env` reader (ENV-001 honoured); no inline secrets; every key sourced via `requireEnv`/optional fallback. Additive only (registration/admin/EOR keys).

## Accepted-debt / judgment calls carried (no action)
- `loginAsClientAccount()` in `features/contracts/fixtures.ts` duplicates `base.fixture`'s private `loginAccount` — accept-with-note; promote a shared `loginAccountAs(role)` from base.fixture only when a 3rd feature needs the full account (not just a token). Editing `base.fixture` is shared-infra and out of this session's scope.
