# Onboarding — Compliance Audit (2026-06-24)

> Specialist review of the main-loop migration (`migration-reviewer-agent` + `qa-architect-agent`).
> Read-only audit against the 14-item review-checklist and the 8-pattern architecture.

**Verdict: APPROVE.** Architecture-compliant. Zero clear violations. Deterministic gates: `tsc --noEmit` exit 0, `lint:arch` exit 0. Grep gates clean (no `expect(` in POMs, no `process.env` outside `core/config/env.ts`, no raw `page.getBy*` in specs, no `waitForTimeout`/`setTimeout`).

## Scope
`features/onboarding/`: client.ts, seeding.ts, fixtures.ts, builders/company.builder.ts, types.ts, constants.ts, pages/frontoffice/{ActivityPage, CompanyInfoTabPage, ConfirmCompanyDetailsPage}.ts, tests/ui/frontoffice/{confirm-company-details, company-profile, kyb-approval}.spec.ts.

## Findings
- **Client / seeding / POM / fixtures** all conform: `OnboardingClient` extends `BaseApiClient` (1 method = 1 endpoint); `seeding.registerFreshClient` is composition (note: self-instantiates a transient `OnboardingClient` for the unauth→auth lifecycle — a stylistic divergence from the expenses gold standard's clients-as-args, ruled accept-with-note by the architect, no reuse so not a Flow); POMs extend `BasePage`, locators+actions only, expose `successToast()`/`errorToast()` getters instead of `expect`.
- **No Flow/Facade** (NOFLOW-007). `AdminClient` injected via fixture DI, never client-composes-client.
- **CompanyInfoTabPage** parent-walk `.locator('..')` (lines 14–21) for wrapped dropdowns is legacy-parity, acceptable.
- **`registeredClient` fixture has no teardown** — deliberate (throwaway sign-up sandbox accounts), documented in fixtures.ts.

## Accepted debt (NOT violations)
- `company-profile.spec.ts:14` reaches `/settings/info` by URL and `fixtures.ts` lands `/activity` by UI nav — both tagged `TODO(api-preconditions)`, sanctioned by ADR `docs/30-decisions/2026-06-24-dmytro-api-preconditions.md` (product drift: the "Complete company profile" activity card was removed).

## Warnings (process, not architecture)
- Checklist #11 (scenario doc): no `docs/test-migration/scenarios/onboarding.md`; intent is captured in spec-header comments. Main-loop migration exemption.
