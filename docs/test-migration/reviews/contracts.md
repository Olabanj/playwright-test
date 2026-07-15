# Contracts — Compliance Audit (2026-06-24)

> Specialist review of the main-loop migration (`migration-reviewer-agent` + `qa-architect-agent`).
> Read-only audit against the 14-item review-checklist and the 8-pattern architecture.
> Two bodies of work: (A) EOR salary-currency API, (B) bulk-import UI.

**Overall verdict: APPROVE-WITH-NOTES.** Architecture/code compliance is clean for both bodies. The single FAILED_REVIEW item was a bookkeeping drift in `inventory.json` (checklist #12), **now fixed** — not an architecture violation. Deterministic gates: `tsc --noEmit` exit 0, `lint:arch` exit 0.

## Body A — EOR salary-currency API → APPROVE-WITH-NOTES
Scope: client.ts (EOR methods), types.ts, constants.ts, seeding.findCleanOngoingEOR, fixtures.ts, tests/api/eor-salary-currency.spec.ts, builders/*.example.ts.

- Client = 1 method/1 endpoint over `BaseApiClient`; returns typed `ApiResponse<T>`/domain objects, no inline `any`, no interface-in-spec. Scenario doc `docs/test-migration/scenarios/contracts.md` exists.
- **Note (accepted debt):** the Edit-flow + amendment-chain (TC_008→016) is an intentionally ordered `mode:'serial'` describe sharing one contract, tagged `TODO(cleanup)` (spec lines ~17, ~148). Item #8: those serial blocks re-instantiate `new ContractsClient()` in `beforeAll` rather than using the `contractsClient` fixture — ported-verbatim debt, same `TODO(cleanup)`.
- **Note (accepted debt):** read/edit/amendment run against a pre-existing sandbox EOR contract via env / `findCleanOngoingEOR` auto-discovery (self-skip if none), tagged `TODO(api-preconditions)`.
- `.example.ts` builders confirmed illustrative-only (header banner `EXAMPLE ONLY`; grep shows zero non-example imports; excluded by `testMatch`). Architect note: flag for deletion in the cleanup phase so they aren't cargo-culted.

## Body B — bulk-import UI → APPROVE (after #12 fix)
Scope: pages/frontoffice/{BulkImportPage, BulkImportReviewPage, BulkImportEditSidebar, BulkImportModals}.ts, tests/ui/frontoffice/{type-and-upload, review-table, edit-sidebar, cor-eligibility, import-and-invite}.spec.ts.

- **All 4 POMs contain zero `expect`** (the only `expect(` strings are inside JSDoc) — ASSERT-003 satisfied. The legacy `verify*()`+expect methods were correctly inverted into exposed getters/locators the specs assert on.
- POMs extend `BasePage`, take only `Page` (never an API client), use stable `getByRole`/`getByLabel`/`getByText` locators (no nth-child/XPath). Sidebar scoped to `getByRole('navigation')` to avoid table collisions — good.
- Each test is independent (own `open()` + upload). No client-composes-client. No `process.env` in feature. PAYG/Milestone correctly parametrized (`TODO(merge)`).
- **`features/contracts/fixtures.ts` `loginAsClientAccount()` calls `AuthClient`** (auth feature) to obtain the full client login account: ACCEPTABLE (judgment call, ruled accept-with-note). It mirrors `base.fixture`'s private `loginAccount`; it calls the auth-feature client, not another *domain* client — not a Flow / client-composes-client violation. Minor duplication smell — promote a `loginAccountAs(role)` export from base.fixture only on the 3rd consumer.

## Accepted debt (NOT violations — intentional, tagged, deferred to cleanup phase)
- `BulkImportPage.ts` `waitForUploadSuccess` `waitForTimeout(2000)` and the review search/dismiss settle delays — `TODO(flaky)`.
- 7 bulk-import specs fail on the sandbox (eligibility dialog timeout, with-errors CSV data drift, `errorsCount(0)` selector, CoR re-render detach, Milestone upload, template-headers drift) — each `TODO(flaky)`/`TODO(selector)`, inherited flow, not migration regressions.

## Fixed this audit
- **Checklist #12 (CLEAR violation, auto-fixed):** `inventory.json` `newPath` for the 5 bulk-import specs + contractor-registration pointed to the stale planned path (`tests/bulk-import/*.ui.spec.ts`); corrected to the actual landing path `tests/ui/frontoffice/*.spec.ts`. Verified every non-blocked `newPath` exists on disk.

## Escalated to main (gate-integrity, out of session scope)
- **WAIT-002 gate gap:** `eslint/architecture-rules.json` claims `playwright/no-wait-for-timeout` enforces the `waitForTimeout` ban, but `eslint/architecture.mjs` only bans `setTimeout`; the plugin rule is never registered, so `waitForTimeout` passes lint:arch silently. The accepted-debt outcome is correct, but the catalog's `enforced_by` is aspirational. `eslint/*` is off-limits this session and changing it touches the established arch-lint catalog → escalated, not auto-fixed.
