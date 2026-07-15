# Architecture Mapping — Legacy → New Framework

> Maps each legacy artefact (helpers, page objects, API setup, test data) to its target in the
> feature-first `playwright-e2e/` architecture. Grounding: 30-decisions (feature-first-layout,
> feature-over-microservice-division, drop-3-lane, single-config-projects,
> follow-playwright-best-practices, HITL-protocol). The legacy CODE + Graphify graph (`graphify-out/graph.json`) are the source
> of truth; this file records the migration intent per feature. Produced during the
> production-investigation phase — no migration performed.

Layer-mapping conventions used throughout:

| Legacy pattern | New feature-first target |
|---|---|
| `tests/modules/<m>/{api,ui}/{verify,probes,scripts}/` (3-lane) | `features/<m>/tests/*.{api,ui}.spec.ts` (flat, tag-selected) |
| `services/api/modules/<svc>/<Svc>API.ts` (extends BaseAPI) | `features/<m>/client.ts` (typed, `ApiResponse<T>`) |
| `pages/features/<m>/*.ts` (POM, `expect` inside) | `features/<m>/pages/{frontoffice,backoffice}/*.ts` (POM-v4, no `expect`) |
| `fixtures/auth/*`, `fixtures/ui/*` (monolithic) | `core/base.fixture.ts` + `features/<m>/fixtures.ts` (role-scoped, injected) |
| `fixtures/data/*-faker.ts`, hardcoded data, CSVs | `features/<m>/builders/*.builder.ts` |
| `@utils/constants/*`, `@utils/types/*` | `core/*` (shared) or `features/<m>/{constants,types}.ts` |

---

## Contracts

### Artefact-by-artefact mapping

| Legacy artefact path | New feature-first target | Decision |
|---|---|---|
| tests/modules/contracts/api/verify/eor-salary-currency.spec.ts | features/contracts/tests/eor-salary-currency.api.spec.ts (edit + amendment, builder-driven) | rewrite |
| tests/modules/contracts/ui/verify/contractor-registration.spec.ts | features/contracts/tests/contractor-registration.ui.spec.ts | rewrite |
| tests/modules/contracts/ui/verify/bulk-import/type-and-upload.spec.ts | features/contracts/tests/bulk-import/type-and-upload.ui.spec.ts | rewrite |
| tests/modules/contracts/ui/verify/bulk-import/review-table.spec.ts | features/contracts/tests/bulk-import/review-table.ui.spec.ts | rewrite |
| tests/modules/contracts/ui/verify/bulk-import/edit-sidebar.spec.ts | features/contracts/tests/bulk-import/edit-sidebar.ui.spec.ts | rewrite |
| tests/modules/contracts/ui/verify/bulk-import/cor-eligibility.spec.ts | features/contracts/tests/bulk-import/cor-eligibility.ui.spec.ts | rewrite |
| tests/modules/contracts/ui/verify/bulk-import/import-and-invite.spec.ts | features/contracts/tests/bulk-import/import-and-invite.ui.spec.ts (Fixed/PAYG/Milestone merged + parameterised) | merge |
| services/api/modules/eor/EORAPI.ts | features/contracts/client.ts (typed EORClient, ApiResponse<T>) | rewrite |
| services/api/modules/admin/AdminAPI.ts (signAsProvider, initWithAdminToken) | features/admin/client.ts (shared AdminClient) — injected into the contracts amendment `seeding.ts` helper | rewrite |
| 3-lane structure (api/verify, ui/verify) | dropped — flat features/contracts/tests/ with .api/.ui naming | rewrite |
| fixtures/auth/auth.fixture.ts (getEORAPIAsClient, getAuthenticatedAPI) | core/base.fixture.ts + features/contracts/fixtures.ts (worker-scoped login, injected clients/seeding) | rewrite |
| fixtures/ui/ui.fixture.ts (loginAndGotoBulkImport, injectAuthState, hideIntercom) | features/contracts/fixtures.ts (ui fixture) + shared base.fixture token injection + global hideIntercom hook | rewrite |
| pages/features/contracts/bulk-import/{BulkImportPage,BulkImportReviewPage,BulkImportEditSidebar,BulkImportModals}.ts | features/contracts/pages/frontoffice/bulk-import/*.ts (POM-v4: locators+actions, no expect/goto-in-test) | rewrite |
| pages/features/contracts/ContractorRegistrationPage.ts | features/contracts/pages/frontoffice/ContractorRegistrationPage.ts (POM-v4) | rewrite |
| pages/common/LoginPage.ts, CommonComponents.ts, BasePage.ts | core/pages/* + features/auth/pages/* (shared base) | rewrite |
| tests/modules/contracts/helpers/otp-database.helpers.ts + @utils/database/db-connection-manager | features/contracts/fixtures or features/auth helper (prefer nines bypass; DB-OTP only for OTP-gen tests) | rewrite |
| fixtures/data/openapi/contractor-faker.ts | features/contracts/builders/contractor.builder.ts | rewrite |
| fixtures/data/contract-bulk-import-test-data-*.csv (clean, with-errors, payg-clean, milestone-clean) | features/contracts/builders/bulk-import-csv.builder.ts (generated) or features/contracts/fixtures/data/*.csv | rewrite |
| env vars EOR_CONTRACT_ID / EOR_CONTRACT_REF + findCleanOngoingEOR scan | EOR contract builder + `seeding.ts` helper that creates/seeds an Ongoing EOR on demand | rewrite |
| @utils/constants/api-endpoints.constants.ts (EOR_ENDPOINTS, ADMIN_ENDPOINTS) | core/endpoints.ts (typed, per-module) | rewrite |

### Gaps blocking migration
- **EOR contract seeding**: the API spec depends on pre-existing contracts supplied via env vars (`EOR_CONTRACT_REF`/`EOR_CONTRACT_ID`) and an opportunistic `findCleanOngoingEOR` scan of up to 25 contracts. The new arch needs a builder/flow that deterministically creates an unsigned EOR contract (for edit) and an Ongoing EOR contract (for amendment) so tests are self-contained — this does not exist yet.
- **Worker OTP retrieval**: contractor registration reads OTP from the `remotewise.users` table via `@utils/database/db-connection-manager` (SSH tunnel/DB access). The new arch must either keep a DB-OTP fixture or wait for the backend fix that lets workers use the `9999` bypass (ContractorService.php — ticket pending). Until then this test carries an infra dependency.
- **Admin provider signing**: the amendment-completion gate needs an admin token (`ADMIN_LOGIN_KEY`) and `sign_as_provider`; requires a shared AdminClient in the new layout and confirmation the admin test-login endpoint stays available.
- **CSV fixtures are externally authored**: the four bulk-import CSVs encode exact expected counts (17 rows, 9 CoR, 1 error). Migrating to builders requires reproducing these exact distributions or the count assertions must be derived from the generated data.

### Deltas (non-blocking) worth recording
- API spec test ordering is significant: amendment tests (008→009→010→015) form an implicit sequential chain sharing `beforeAll`-discovered state; the rewrite should model this as one flow rather than independent tests.
- Numbering gaps are intentional reservations: TC-002 (invalid currency negative), TC-012 (amendment rejection), TC-014 (concurrent amendment conflict) — candidate new tests, not lost coverage.
- `updateContract` sends a minimal `{ currency_id }` body and relies on the server filling defaults — the typed client should keep currency-only edits minimal.
- The three Fixed/PAYG/Milestone import tests are near-identical apart from CSV + final invite action; ideal for a single parameterised test.
- UI auth uses Redux-Persist localStorage injection (`persist:root`) rather than UI login — fragile to frontend state-shape changes; the new base fixture should centralise this.
- `slowMo: 500` on contractor-registration is a smell (timing crutch) — should not be carried into the rewrite.

---

## Expenses

### Artefact-by-artefact mapping

| Legacy artefact | New target | Decision |
|---|---|---|
| tests/modules/expenses/ui/verify/expenses-list.spec.ts | features/expenses/tests/frontoffice/expenses.ui.spec.ts (merged) | rewrite + merge |
| tests/modules/expenses/ui/verify/expense-crud.spec.ts | features/expenses/tests/frontoffice/expenses.ui.spec.ts (merged) | rewrite + merge |
| tests/modules/expenses/ui/scripts/dump-auth-storage.spec.ts | — (none) | skip (debug utility, knowledge folded into base auth fixture) |
| pages/features/expenses/ExpensesPage.ts | features/expenses/pages/frontoffice/ExpensesPage.ts | rewrite (drop expect() from page; goto stays in page) |
| pages/features/expenses/ExpenseDetailsPanel.ts | features/expenses/pages/frontoffice/ExpenseDetailsPanel.ts | rewrite |
| pages/features/expenses/AddExpenseModal.ts | features/expenses/pages/frontoffice/AddExpenseModal.ts | rewrite |
| fixtures/data/expense-faker.ts (generateExpenseData) | features/expenses/builders/expense.builder.ts | rewrite as Builder (fluent, no HTTP) |
| utils/constants/expenses.constants.ts (EXPENSE_STATUS) | features/expenses/constants.ts (or types.ts) | migrate (move with module) |
| fixtures/ui/ui.fixture.ts (loginWorkerViaAPI / injectAuthState) | fixtures/base.fixture.ts (worker-scoped login) + features/expenses/fixtures.ts | rewrite (split monolithic UIFixture; per-worker login) |
| services/api/modules/expenses/ExpensesAPI.ts | features/expenses/client.ts | rewrite (typed ApiResponse<T>); back UI data setup via an expenses `seeding.ts` helper |
| services/api/common/AuthAPI.ts | core/auth client + base.fixture.ts | rewrite (shared infra) |
| pages/common/CommonComponents.ts | core/pages base / shared page utilities | rewrite (shared infra) |
| fixtures/data/files/test-document.pdf | features/expenses/fixtures/files/test-document.pdf (or shared assets) | migrate (asset) |

### Gaps blocking migration
- No expenses fixtures module / builder exists yet on the new architecture — must be created before rewrite (Builder + feature fixtures with auto-cleanup).
- Cleanup is currently best-effort UI deletion (swallows all errors); the new layout's fixture-based auto-cleanup needs a reliable teardown path, ideally via ExpensesAPI rather than the UI, which does not yet exist as a `seeding.ts` helper.
- ExpensesAPI is not yet wrapped as a typed client.ts with ApiResponse<T>; UI data setup should use it to avoid driving the modal for preconditions.
- Worker-scoped login fixture (base.fixture.ts pattern) does not yet exist for the worker role in this layout; UIFixture.loginWorkerViaAPI must be ported into the shared base fixture.

### Deltas (non-blocking) worth recording
- Status string mismatch across surfaces ('Pending' in list vs 'Pending approval' in panel) is intentional and encoded in EXPENSE_STATUS — preserve both on migration.
- Row/detail lookups rely on substring `hasText` matching on a timestamp name; consider a data-test-id or exact-match locator to avoid prefix collisions.
- ExpenseDetailsPanel uses brittle XPath ancestor traversal for Status/Amount values — candidate for stable data-test-id locators during rewrite.
- expenses-list creates its precondition expense by driving the full UI modal in beforeAll; on rewrite this should be API/flow-seeded for speed and determinism.
- AddExpenseModal always uploads a receipt; a 'no receipt' UI variant is currently uncovered (only the seeder covers missing-receipt).
- The @manual debug script hardcodes the persist:root shape — if the app's storage shape changes, the auth injection in UIFixture breaks silently; worth a note but not migrated.


---

## Time-tracking

### Artefact-by-artefact mapping

#### API verify specs

| Legacy artefact | New feature-first target | Decision |
|---|---|---|
| api/verify/policies.spec.ts (CRUD, title-check, worker assignment, pagination) | features/time-tracking/tests/policy-crud.api.spec.ts | rewrite; remove describe-level shared createdPolicyId coupling |
| api/verify/policies-deep.spec.ts (pagination@30, stress, edge) | features/time-tracking/tests/policy-crud.api.spec.ts @deep @slow section | rewrite; keep @deep/@slow out of CI smoke |
| api/verify/policy-default.spec.ts (3 system defaults, deletion guard, name edit, type lock, PD-13481) | features/time-tracking/tests/policy-defaults.api.spec.ts | rewrite |
| api/verify/policy-permissions.spec.ts (flag combos, PATCH flag toggle, filter by permission) | features/time-tracking/tests/policy-flags.api.spec.ts | rewrite |
| api/verify/policy-worker-type.spec.ts (8 types, PATCH persist, filter; type-8 xfail) | features/time-tracking/tests/policy-worker-type.api.spec.ts | rewrite; carry TC_TT_WTYPE_003 xfail |
| api/verify/policy-workers.spec.ts (workers[] shape, replace/clear, hasAssignedPolicy filter, count delta) | features/time-tracking/tests/policy-workers.api.spec.ts | rewrite |
| api/verify/policy-by-contract.spec.ts (assigned policy, 404 no policy, invalid IDs family, full structure) | features/time-tracking/tests/policy-by-contract.api.spec.ts | rewrite; parametrize invalid-id family; reconcile timeBasis enum read divergence |
| api/verify/policy-contract-matrix.spec.ts (18 MATRIX-* tests: PAYG+3 bases, non-PAYG types, multi-contract) | features/time-tracking/tests/policy-contract-matrix.api.spec.ts | rewrite as single data-driven matrix; replace workers.json grouping with typed contract fixture |
| api/verify/policy-contract-tab.spec.ts (get assigned policy, reassign, unassign, no-policy clock-in block) | features/time-tracking/tests/policy-by-contract.api.spec.ts (merged) | merge |
| api/verify/policy-schedule-rules.spec.ts (out-of-window reject, in-window accept, human-readable error, decimal threshold) | features/time-tracking/tests/policy-schedule-rules.api.spec.ts | rewrite |
| api/verify/policy-wizard-scope2.spec.ts (granularity, multiplier, type compat guard, keepWorkers, PAYG assign; 4 xfails PD-12914/13413/12929) | features/time-tracking/tests/policy-wizard-scope2.api.spec.ts | rewrite; carry 4 xfails verbatim |
| api/verify/sessions-details/auto-tracker-sessions.spec.ts (active/paused/completed detail, subsessions, no edit active; TC_TT_SESSION_003 xfail) | features/time-tracking/tests/sessions-auto-tracker.api.spec.ts | rewrite; carry endTime=null xfail |
| api/verify/sessions-details/manual-time-entries.spec.ts (manual detail, completed state, subsession, edge cases, client-on-behalf, PAYG stats, isolation) | features/time-tracking/tests/sessions-manual.api.spec.ts | rewrite; carry TC_TT_ENTRY_001 and TC_TT_ENTRY_006 xfails |
| api/verify/sessions-details/session-editing.spec.ts (active no-edit, completed edit, approved edit, empty title, 404; 2 xfails) | features/time-tracking/tests/sessions-manual.api.spec.ts (editing section) | merge; carry TC_TT_EDIT_003 and TC_TT_EDIT_005 xfails |
| api/verify/sessions-details/error-handling.spec.ts (404, 400 negative/zero, 400/404 large id, 404 deleted) | features/time-tracking/tests/sessions-auto-tracker.api.spec.ts (error section) | merge; parametrize invalid-id family |
| api/verify/sessions.spec.ts (clock-in/out, pause, resume, list state filter, active session, SES_019 double-pause) | features/time-tracking/tests/sessions-auto-tracker.api.spec.ts | rewrite; consolidate with sessions-details |
| api/verify/sessions-edge-cases.spec.ts (cross-contract block, end-paused, double-pause reject, resume-active reject, end-completed reject, PAYG payment on clockout, stats, long session) | features/time-tracking/tests/sessions-auto-tracker.api.spec.ts (edge section) | merge |
| api/verify/sessions-edit-delete-rules.spec.ts (active-edit reject PD-11575, delete pending PD-11576, delete approved block, PATCH fields, UTC storage PD-11703/11800) | features/time-tracking/tests/sessions-manual.api.spec.ts (edit-delete section) | merge |
| api/verify/manual-entries-edge-cases.spec.ts (PAYG stats after approval, cumulative stats, duplicate reject, overlap reject, fixed vs PAYG isolation; TC_TT_ENTRY_014 xfail) | features/time-tracking/tests/sessions-manual.api.spec.ts (edge section) | merge; carry xfail |
| api/verify/approval.spec.ts (single approve/decline, bulk, transitions blocked, worker-self-approve, client-created-pending, invalid-id resilience; 1 xfail TC_TT_REVIEW_014) | features/time-tracking/tests/approval.api.spec.ts | rewrite; carry pool-slot-collision xfail |
| api/verify/authorization.spec.ts (cross-contract, own-contracts scope, approved-delete, token review-block, no-policy clock-in, concurrent; TC_TT_AUTH_003 xfail) | features/time-tracking/tests/authorization.api.spec.ts | rewrite; carry sandbox boundary xfail |
| api/verify/permissions.spec.ts (worker policy-based, new-admin full, custom-role denied, baseline RBAC; 5 xfails) | features/time-tracking/tests/permissions.api.spec.ts | rewrite; carry CUSTOM_ROLE env xfails |
| api/verify/audit-trail.spec.ts (policy events, entry events, access control; 5 async xfails) | features/time-tracking/tests/audit-trail.api.spec.ts | rewrite; carry 5 async-ingestion xfails |
| api/verify/auto-clockout.spec.ts (cron auto-end; gated RUN_SLOW=1; xfail cron-dependent) | features/time-tracking/tests/sessions-auto-tracker.api.spec.ts (auto-clockout section) | carry; keep RUN_SLOW gate and xfail; inline comment → 2026-05-25 decision doc |
| api/verify/daily-limit.spec.ts (fully-consumed reject PD-12072, headroom-left accepts) | features/time-tracking/tests/sessions-auto-tracker.api.spec.ts (daily-limit section) | merge |
| api/verify/e2e-flow.spec.ts (full pipeline create→assign→in→out→approve; pause/resume; decline; serial mode) | features/time-tracking/tests/e2e-flow.api.spec.ts | rewrite; keep serial mode; add submit-after-end step coverage |
| api/verify/notifications.spec.ts (submit/approve/decline/navigate notifications; conditional test.skip on empty TestEnv slot) | features/time-tracking/tests/notifications.api.spec.ts | rewrite; keep conditional skip pattern for empty slot; note CI-proxy-only coverage |
| api/verify/ff-localization-permissions.spec.ts (feature flag, Accept-Language, company-settings TT Edit role) | features/time-tracking/tests/ff-localization-permissions.api.spec.ts | rewrite |
| api/verify/payment-calculation.spec.ts (PAYG stats, overtime, cap, pending, fixed vs PAYG, currency; 4 xfails PD-13692..13695) | features/time-tracking/tests/payment-calculation.api.spec.ts | rewrite; carry 4 PD bug xfails verbatim |
| api/verify/payment-invariants.spec.ts (cost PD-11454, currency PD-11603, amount decomp PD-11859, billable-minutes PD-11843) | features/time-tracking/tests/payment-invariants.api.spec.ts | rewrite |
| api/verify/reporting.spec.ts (dashboard stats paginated, per-contract daily, filters) | features/time-tracking/tests/reporting.api.spec.ts | rewrite |
| api/verify/timesheet-report.spec.ts (preview/export POST→201, columns, filters, CSV, auth; 7 describe groups) | features/time-tracking/tests/timesheet-report.api.spec.ts | rewrite; document POST→201 quirk explicitly |
| api/verify/tt-bulk-import/template.spec.ts | features/time-tracking/tests/bulk-import/bulk-import-template.api.spec.ts | rewrite |
| api/verify/tt-bulk-import/validate.spec.ts | features/time-tracking/tests/bulk-import/bulk-import-validate.api.spec.ts | rewrite |
| api/verify/tt-bulk-import/execute.spec.ts | features/time-tracking/tests/bulk-import/bulk-import-execute.api.spec.ts | rewrite |
| api/verify/tt-bulk-import/worker.spec.ts | features/time-tracking/tests/bulk-import/bulk-import-worker.api.spec.ts | rewrite |

#### UI verify specs

| Legacy artefact | New feature-first target | Decision |
|---|---|---|
| ui/verify/policies.spec.ts (list page, default policy, manage workers, navigate via settings, info) | features/time-tracking/tests/policies.ui.spec.ts | rewrite (principal flows only per scope decision) |
| ui/verify/policy.spec.ts (create wizard, list info, manage-workers panel, edit wizard, prevent-advance; 3 xfails) | features/time-tracking/tests/policies.ui.spec.ts (merged) | merge; carry 3 xfails |
| ui/verify/policy-wizard.spec.ts (create E2E, type required, all types selectable, edit+verify, delete, duplicate title, validation; 2 xfails) | features/time-tracking/tests/policy-wizard.ui.spec.ts | rewrite; carry 2 xfails; fix advanceThroughWizard helper |
| ui/verify/policy-wizard-scope2.spec.ts (granularity, multiplier, type change, compat dialog, PAYG list; 11 xfails — wizard nav broken) | features/time-tracking/tests/policy-wizard-scope2.ui.spec.ts | rewrite; fix wizard step navigation helper before activating; carry 11 xfails until helper fixed |
| ui/verify/policy-contract-tab.spec.ts (Change Policy panel, Unassign dialog, worker access, name display, change reflected, SPA unassign, no-policy assign, Help CTA; 6 xfails — TT tab locator) | features/time-tracking/tests/policy-contract-tab.ui.spec.ts | rewrite; re-discover TT tab locator before activating 6 xfails |
| ui/verify/policy-worker-ux.spec.ts (picker exclusion, member links, target=_blank) | features/time-tracking/tests/policy-workers.ui.spec.ts | rewrite |
| ui/verify/approval.spec.ts (Review Center, approve, decline+reason, badges, worker resubmit; 2 identity xfails) | features/time-tracking/tests/approval.ui.spec.ts | rewrite; resolve global-vs-pool identity to fix 2 xfails |
| ui/verify/dashboard.spec.ts (client TT center sections, worker table, filters, actions, worker dashboard, view modes, reload) | features/time-tracking/tests/dashboard.ui.spec.ts | rewrite |
| ui/verify/dashboard-and-review-sync.spec.ts (date-range guard, review counter sync; serial mode) | features/time-tracking/tests/dashboard.ui.spec.ts (merged) | merge |
| ui/verify/no-policy-visibility.spec.ts (PD-12192: nav visible with policy, banner without policy; serial mode) | features/time-tracking/tests/no-policy-visibility.ui.spec.ts | rewrite |
| ui/verify/time-entry.spec.ts (client entry list, summary row, filter, client manual create; 4 pool-ref xfails) | features/time-tracking/tests/time-entry.ui.spec.ts | rewrite; resolve pool contract ref to fix 4 xfails |
| ui/verify/worker-time-entry.spec.ts (worker list, split-button form, validation, edit, submit, history; 6 identity/policy xfails) | features/time-tracking/tests/worker-time-entry.ui.spec.ts | rewrite; resolve global-vs-pool identity + no-policy banner to fix xfails |
| ui/verify/timeline-date.spec.ts (PD-11948: date+time stamp on timeline events; serial mode) | features/time-tracking/tests/timeline-date.ui.spec.ts | rewrite |
| ui/verify/mobile.spec.ts (11 mobile tests on /activity: timer, manual form, pending row, edit/delete guards, filter chips) | features/time-tracking/tests/mobile.ui.spec.ts | rewrite; tag @mobile |
| ui/verify/reporting.spec.ts (reports page, filters, totals, export modal) | features/time-tracking/tests/reporting.ui.spec.ts | rewrite |
| ui/verify/timesheet-report.spec.ts (page load, export modal, filter intercept, column settings, restore defaults) | features/time-tracking/tests/timesheet-report.ui.spec.ts | rewrite |
| ui/verify/tt-bulk-import/bulk-import.spec.ts (wizard entry, upload, happy path, error blocking; serial mode) | features/time-tracking/tests/bulk-import/bulk-import.ui.spec.ts | rewrite |
| ui/verify/tt-bulk-import/bulk-import-worker.spec.ts (worker 2-step flow; serial mode) | features/time-tracking/tests/bulk-import/bulk-import-worker.ui.spec.ts | rewrite |

#### API service, helpers, fixtures, POMs

| Legacy artefact | New feature-first target | Decision |
|---|---|---|
| services/api/modules/time-tracking/TimeTrackingAPI.ts | features/time-tracking/client.ts (typed, ApiResponse<T>) | rewrite; drop legacy clockIn/clockOut/pauseSession/getSessions surface; keep all active surfaces |
| tests/modules/time-tracking/api/helpers/policy.helpers.ts | features/time-tracking/builders/policy.builder.ts + features/time-tracking/fixtures.ts | rewrite; use Playwright fixture injection |
| tests/modules/time-tracking/api/helpers/session.helpers.ts | features/time-tracking/fixtures.ts (session setup) + features/time-tracking/helpers/session.helpers.ts | port; resolveWorkerPaygContract + clearContractSessions are shared infra |
| tests/modules/time-tracking/api/helpers/common.helpers.ts | core/helpers/title.ts (generateUniqueTitle) + features/time-tracking/helpers/ | split; generateUniqueTitle → core; createNextSlot + loadFixedContracts → module helpers |
| tests/modules/time-tracking/helpers/bulk-import.helpers.ts | features/time-tracking/builders/bulk-import.builder.ts | rewrite; fetchOngoingContract → fixture |
| fixtures/test-env/TestEnv.ts + fixtures/locking/FileLock.ts | core/fixtures/test-env/ (promoted to shared infra) OR features/time-tracking/fixtures.ts (module-scoped) | promote TestEnv + FileLock to core — they are domain-agnostic pool-leasing infra used by multiple modules |
| tests/modules/time-tracking/api/scripts/ (6 scripts) | drop 3-lane scripts lane; fold live logic into fixtures/setup helpers | drop lane; keep setup-session-test-contract pattern as fixture setup method |
| pages/features/time-tracking/ApprovalPage.ts | features/time-tracking/pages/frontoffice/ApprovalPage.ts (POM-v4: no expect) | rewrite |
| pages/features/time-tracking/ContractTimeTrackingTabPage.ts | features/time-tracking/pages/frontoffice/ContractTimeTrackingTabPage.ts | rewrite + re-discover TT tab locator (6 xfails depend on it) |
| pages/features/time-tracking/DashboardPage.ts | features/time-tracking/pages/frontoffice/DashboardPage.ts | rewrite |
| pages/features/time-tracking/PolicyPage.ts | features/time-tracking/pages/frontoffice/PolicyPage.ts | rewrite |
| pages/features/time-tracking/TimeEntryPage.ts | features/time-tracking/pages/frontoffice/TimeEntryPage.ts | rewrite |
| pages/features/time-tracking/TimeTrackingPage.ts | features/time-tracking/pages/frontoffice/TimeTrackingPage.ts | rewrite |
| pages/features/time-tracking/TimeTrackingReportPage.ts | features/time-tracking/pages/frontoffice/TimeTrackingReportPage.ts | rewrite |
| pages/features/time-tracking/TimesheetReportPage.ts | features/time-tracking/pages/frontoffice/TimesheetReportPage.ts | rewrite |
| pages/features/time-tracking/bulk-import/TTBulkImportWizardPage.ts | features/time-tracking/pages/frontoffice/bulk-import/TTBulkImportWizardPage.ts | rewrite |
| docs/coverage/time-tracking/xfail-inventory.md (merged in this branch) | docs/test-migration/scenarios/time-tracking-xfails.md (or folded into scenario doc) | migrate as reference; xfail list is living document — update as bugs close |
| scripts/test-history/record-run.ts | drop (not test code; CI instrumentation) | drop |

### Gaps blocking migration

1. **TestEnv contract pool size**: the pool of ongoing contracts per worker type on the sandbox account determines maximum parallelism. Adding contracts to the sandbox is required before running the full suite with `--workers=4+`. No contract factory exists to provision contracts on-demand (unlike the seeder for other modules).
2. **Full-page wizard navigation helper broken (UI)**: `advanceThroughWizard` / `advanceWizardStep` does not advance past step 1 in the current multi-step full-page wizard layout. This blocks 13 UI wizard tests (11 wizard-scope2 + 2 wizard + some policy). The POM must be rewritten against the live DOM before these tests can be activated.
3. **TT contract-tab locator needs re-discovery (UI)**: the Time Tracking tab in the contract page tab bar is not found by the current locator (possibly moved to overflow menu or renamed). Blocks 6 PCT tests. Re-discovery against live DOM required.
4. **Global identity vs pool identity mismatch (UI)**: UI tests log in as the global client/worker (from env vars) but TestEnv creates state on a leased pool contract owned by a different user. This causes 14 UI xfails across approval, worker-time-entry, time-entry, and dashboard-review-sync. Fix requires either (a) UI tests log in as the pool user (TestEnv must expose pool-user credentials) or (b) UI tests seed their own data using the global user without TestEnv.
5. **CUSTOM_ROLE env vars not provisioned**: TC_PERM_020/021/022/024 require `CUSTOM_ROLE_EMAIL` + `CUSTOM_ROLE_PASSWORD` for a custom-role sandbox user. Currently not provisioned — 4 xfails. QA infra must provision this user before these tests can be activated.
6. **8th worker type not deployed**: TC_TT_WTYPE_003 tests all 8 worker types but only 7 are accepted by the sandbox (8th from PR #83 not yet deployed). Xfail until backend deploys the type.
7. **4 payment-calculation PD bugs open**: TC_TT_PC_001..006 (xfails PD-13692, PD-13693, PD-13694, PD-13695) — these tests assert the correct behavior but the sandbox does not yet implement it. Cannot be activated until the PD tickets are resolved.
8. **4 policy wizard PD bugs open**: TC_TT_WIZARD2_015 (PD-12914), TC_TT_WIZARD2_030 (PD-13413), TC_TT_WIZARD2_040 (PD-12929) — xfails until backend fixes land.
9. **Sandbox async event ingestion**: 5 audit-trail tests are xfail because policy ASSIGN/UNASSIGN and entry APPROVE/DECLINE/UPDATE events are not reliably ingested under parallel load. Needs backend/observability fix.
10. **Auto-clockout instant-trigger endpoint**: TC_TT_SESSION_EDGE_010 is parked — backend instant-trigger endpoint not merged (no write access, pushback from BE). Cannot be activated without backend cooperation. Carry as tracked gap per 2026-05-25 decision.
11. **Submit-after-end coverage gap**: the undocumented submit step is exercised in e2e-flow and approval specs but not as an isolated coverage unit. A dedicated test for client visibility before vs after submit should be added in the migrated sessions spec.

### Deltas (non-blocking) worth recording

- **Probes lane deleted in this branch**: both `api/probes/` and `ui/probes/` are empty directories. The old scenario doc referenced probes as a migration source — that section is now moot. All coverage is in the verify lane.
- **xfail-triage merge**: this branch added `docs/coverage/time-tracking/xfail-inventory.md` documenting 62 xfails (28 API, 34 UI). The old architecture-mapping did not reference this document. The migrated layout should maintain a living xfail tracker.
- **Timesheet report POST→201 quirk**: both preview and export endpoints are POST returning 201. This is counter-intuitive and should be explicitly documented in the typed client with JSDoc.
- **Bulk import 2-step client vs worker behavior difference**: client-uploaded sessions are auto-approved; worker-uploaded sessions require review. This behavioral asymmetry is tested and must be preserved in the migrated spec.
- **timeBasis enum divergence**: policy create uses `flexible | schedule_window | total_hours`; legacy policy-by-contract assertions reference `fixed | flexible`. Reconcile during rewrite (the create values are correct; the read divergence is a legacy test bug).
- **end-session status code**: auto-tracker end returns 200 in some tests and 201 is expected in others. Standardize on the observed 200 during migration.
- **createNextSlot factory**: the per-process entropy mechanism in `generateUniqueTitle` (pid + counter) was added specifically to prevent parallel 409 collisions. This pattern should be carried into the new `core/helpers/title.ts`.
- **TT /contracts limit cap of 50**: any new code querying contracts must cap `limit` at 50; higher values return 400 with no error surfaced to the caller.
- **Policy-contract matrix DE contracts**: `scripts/seed-de-for-matrix.ts` seeds Direct Employee contracts for the matrix spec. This seeding step must be accounted for in the new framework's fixture setup.
- **Notifications are CI proxy-only**: the notification delivery tests cannot assert actual email/push delivery; they assert against the in-platform notification feed. This design decision should be preserved and documented in the migrated spec.
- **Serial mode specs**: e2e-flow.spec.ts, no-policy-visibility.spec.ts, dashboard-and-review-sync.spec.ts, bulk-import.spec.ts, and bulk-import-worker.spec.ts use `test.describe.configure({ mode: 'serial' })`. Preserve serial mode in the migrated versions — these tests have ordering dependencies within the describe block.

---

## Payments-e2e

### Artefact-by-artefact mapping

| Legacy artefact (path) | New feature-first target | Decision |
|---|---|---|
| `services/api/modules/payments/PaymentsAPI.ts` | `features/payments/api/payments.client.ts` (or split: payments + transactions clients) | Port. Generic contract-payment + transaction-state-machine surface; keep as the shared client used by both the adjustment/seed flow and processing. |
| `services/api/modules/payments-e2e/PaymentProcessingAPI.ts` | `features/payments/api/payment-processing.client.ts` | Port. Owns quote->task->transfer state machine and per-method submit. |
| `services/api/modules/payments-e2e/PaymentMethodSetupAPI.ts` | `features/payments/api/payment-method-setup.client.ts` | Port. Client-side instrument attach/list/delete. |
| `services/api/modules/payments-e2e/WithdrawalAPI.ts` | `features/payments/api/withdrawal.client.ts` | Port. Contractor wallet + prepare/confirm withdrawal. |
| `services/api/modules/payments-e2e/WithdrawalMethodSetupAPI.ts` | `features/payments/api/withdrawal-method-setup.client.ts` | Port. Note orderRemotePassCard is undiscovered scaffolding — keep throw-guarded. |
| `services/api/modules/payments-e2e/AdminPaymentMethodsAPI.ts` | `features/payments/api/admin-payment-methods.client.ts` (extends shared AdminAPI/admin client) | Port. Admin company method toggles. |
| `services/api/modules/payments-e2e/AdminWithdrawalMethodsAPI.ts` | `features/payments/api/admin-withdrawal-methods.client.ts` | Port. Also hosts the prereqs admin helpers (initWithAdminToken, verifyKYC, disable2FA, enableStandardWithdrawalMethods). |
| `services/api/modules/payments-e2e/AdminApprovalsAPI.ts` | `features/payments/api/admin-approvals.client.ts` | Port. Payment/withdrawal approval queue. |
| `services/api/modules/payments-e2e/{ClientOnboardingAPI,ContractorOnboardingAPI}.ts` | shared `features/onboarding/` (or `features/payments/` setup layer) clients | Port to a shared onboarding client — these are reused by prereqs seeding, not payments-specific; follow owner-module rule. |
| `services/api/modules/admin/AdminAPI.ts` | shared `features/admin/api/admin.client.ts` | Shared infra — port once, parent of all admin clients (transfer release, confirm, KYB/KYC). |
| `tests/modules/payments-e2e/api/helpers/stripe-test-helper.ts` | `features/payments/helpers/stripe-test-helper.ts` | Port as feature test helper (external-provider adapter). Keep sandbox publishable key + retry logic; gate on sandbox URL guard. |
| `tests/modules/payments-e2e/api/helpers/plaid-sandbox-helper.ts` | `features/payments/helpers/plaid-sandbox-helper.ts` | Port. Requires PLAID_CLIENT_ID/SECRET. |
| `tests/modules/payments-e2e/api/helpers/transfer-release.helper.ts` | `features/payments/helpers/transfer-release.helper.ts` | Port (paginate+confirm admin release). |
| `tests/modules/payments-e2e/api/helpers/payments-resolver.helper.ts` | `features/payments/helpers/payments-resolver.helper.ts` | Port (workId->ref/itemId + waitForPaymentProcessable; uses expect.poll — keep, conforms to Playwright-best-practices). |
| `tests/modules/payments-e2e/api/helpers/withdrawal-method-payloads.ts` | `features/payments/helpers/withdrawal-method-payloads.ts` | Port (payload builders/constants). |
| `tests/modules/payments-e2e/api/helpers/payments-e2e-env.ts` | `features/payments/fixtures/payments-prerequisites.ts` | Port as the feature's prerequisites lifecycle (per-lane seed/cache/lock). Re-point at new client/onboarding clients. |
| `tests/modules/payments-e2e/api/helpers/dispose-all.helper.ts` | shared `utils/helpers/dispose-all.ts` | Promote to shared util (generic). |
| `tests/modules/payments-e2e/ui/fixtures/payments-e2e-ui.fixture.ts` | `features/payments/fixtures/payments-ui.fixture.ts` (composed via mergeTests) | Port. clientPage/contractorPage/adminPage storage-state fixtures; align with single-config projects[] model. |
| `tests/modules/payments-e2e/ui/helpers/{ui-auth,ui-admin-auth}.helper.ts` | `features/payments/helpers/` (admin-auth may be shared) | Port. Admin SSO-bypass via test-login JWT into persist:root — candidate for shared admin-auth helper. |
| `tests/modules/payments-e2e/ui/helpers/{process-payment,bank-account-seeder,adjustment-state}.helper.ts` | `features/payments/helpers/` | Port (UI orchestration + per-lane adjustment state file). |
| `pages/features/payments-e2e/admin/{AdminPaymentMethodsPage,AdminPendingTransfersPage,AdminUsersPage,AdminWithdrawalsPage}.ts` | `features/payments/pages/admin/*` (admin POMs may be shared infra) | Port. Admin SPA POMs — consider a shared admin-pages package since other modules will reuse the admin panel. |
| `pages/features/payments-e2e/client/{ClientPaymentMethodsPage,ClientPaymentsPage,ClientWalletPage,ClientActivityPage,ClientContractsPage,ClientKybPage,PaymentMethodsPage}.ts` | `features/payments/pages/client/*` | Port. Note two payment-method POMs (ClientPaymentMethodsPage + PaymentMethodsPage) — reconcile/dedupe during port. |
| `pages/features/payments-e2e/contractor/{ContractorWalletPage,ContractorWithdrawMethodsPage,ContractorActivityPage,ContractorKycPage}.ts` | `features/payments/pages/contractor/*` | Port. |
| `tests/modules/payments-e2e/api/scripts/*` | drop or convert to `features/payments/setup/` helpers | Most are placeholder shells (`export {}`) mapped 1:1 to QA-3..QA-11 tickets; the new architecture drops the 3-lane scripts lane — fold any live logic into fixtures/helpers and discard placeholders. |
| `tests/modules/payments-e2e/api/probes/*`, `ui` numbered verify specs | `features/payments/{api,ui}/*.spec.ts` | Probes are exploratory (drop per drop-3-lane decision); the 7+7 numbered verify specs become the migrated tests. Preserve the ordered pipeline contract (shared worker hash, --workers=1, per-lane prereqs). |

### Gaps blocking migration

- **Stripe sandbox dependency** — SEPA confirm + card tokenize hit api.stripe.com with a sandbox publishable key (and optional STRIPE_SECRET_KEY for detach/server tokenize). Migration must carry STRIPE_PUBLISHABLE_KEY/STRIPE_SECRET_KEY and the sandbox-URL guard; the suite is non-hermetic against Stripe.
- **Plaid sandbox dependency** — ACH needs PLAID_CLIENT_ID + PLAID_SECRET; absent, ACH process/add tests skip.
- **Admin-token dependency** — every privileged step needs an admin session via GET /api/admin/login/test/<ADMIN_LOGIN_KEY> (SSO bypass). Migration needs ADMIN_LOGIN_KEY and the persist:root injection pattern to keep working against the admin SPA.
- **Seeded-contractor / DB-tunnel dependency** — first fresh seed of a contractor reads OTP from the database (DB tunnel must be reachable). Cached per-lane state avoids it on later runs; the new prerequisites fixture must preserve this seed-once/reuse model and the lock-file race-safety.
- **Fundable-wallet dependency** — withdrawal specs require the wallet to already hold funds, which depends on the payment-processing step having run earlier in the same pipeline. The ordered 01->07 dependency must survive migration (07 withdrawal depends on 05 process which depends on 03 adjustment seed).
- **KNOWN-ISSUES backend bugs** — the test.fail/test.fixme/test.skip markers encode live backend defects (silent-accept bad IDs, duplicate IBAN/quote, SQL leak, currency-param-ignored, sandbox 500s on Paysend/DCT/Instant-Card) and sandbox limitations (OAuth withdrawals, SEPA settlement, Plaid Link UI). These must port verbatim with their tickets (QA-20, QA-131, QA-132); the 'no ticket' rows still need real backend tickets filed.

### Deltas (non-blocking) worth recording

- Two overlapping client payment-method POMs (`ClientPaymentMethodsPage` and `PaymentMethodsPage`) — consolidate during port.
- `PaymentsAPI` (under `services/api/modules/payments/`) lives outside the `payments-e2e` service folder yet is the generic payments client; reconcile its home in the feature-first layout.
- Several `api/scripts/*` are placeholder `export {}` shells tied to QA tickets — no behavior to migrate; safe to drop under the drop-3-lane decision.
- `dispose-all.helper` and admin-auth/admin-POMs are generically reusable — candidates for promotion to shared infra rather than payments-module-local.
- Adjustment seeding writes a per-lane state file consumed by the process step (API uses getContractPayments resolution; UI uses payments-e2e-adjustment-payments-ui.json) — the cross-spec file handoff is an ordering coupling to preserve explicitly.
- RemotePass Card order endpoint is undiscovered (orderRemotePassCard is throw-guarded scaffolding) — a known coverage hole, not a regression.

---

## Invoices

### Artefact-by-artefact mapping

| Legacy artefact | New feature-first target | Decision |
|---|---|---|
| tests/modules/invoices/api/verify/invoice-download.spec.ts | features/invoices/tests/invoice-date-filter.api.spec.ts + features/invoices/tests/invoice-bulk-download.api.spec.ts | rewrite — split into two focused specs matching UI counterparts |
| tests/modules/invoices/ui/verify/invoice-bulk-download.spec.ts | features/invoices/tests/invoice-bulk-download.ui.spec.ts | rewrite — keep structure, remove sandbox date anchors |
| tests/modules/invoices/ui/verify/invoice-date-filter.spec.ts | features/invoices/tests/invoice-date-filter.ui.spec.ts | rewrite — keep structure, remove sandbox date anchors |
| services/api/modules/invoices/InvoiceAPI.ts | features/invoices/client.ts (typed InvoiceClient, ApiResponse<T>; keep pollExportUntilReady) | rewrite |
| pages/features/invoices/InvoicesPage.ts | features/invoices/pages/frontoffice/InvoicesPage.ts (POM-v4) | rewrite |
| tests/modules/invoices/api/scripts/probe-invoice-*.ts | dropped (3-lane scripts lane removed); discovery knowledge folded into client.ts docs | skip |
| utils/constants/api-endpoints.constants.ts → INVOICE_ENDPOINTS | features/invoices/constants.ts or core/endpoints.ts | rewrite |
| fixtures/auth/auth.fixture.ts → getInvoiceAPIAsClient | core/base.fixture.ts + features/invoices/fixtures.ts | rewrite |
| fixtures/ui/ui.fixture.ts → loginAndGotoInvoices | features/invoices/fixtures.ts (ui fixture) | rewrite |

### Gaps blocking migration

- **Hardcoded sandbox date anchors**: count assertions (exactly 4 rows in Mar 12 – Apr 11 2026) depend on sandbox data observed 2026-04-11. A sandbox reset silently breaks them. Migration needs dynamic invoice seeding or ≥1 guards.
- **No dedicated invoice seeder**: invoice data is a side-effect of the payments pipeline (seed-accounting). The module has no setup/teardown creating its own data.
- **Worker-role coverage absent**: all tests authenticate as client; no access-control test for worker tokens on /api/invoice/* endpoints.

### Deltas (non-blocking) worth recording

- `EXPENSE_ENDPOINTS` is declared twice in utils/constants/api-endpoints.constants.ts — latent duplicate-identifier issue to fix during port.
- `InvoiceAPI` methods skip `logVerbose()` at entry — minor convention deviation; fix in the typed client.
- PD-11896 describe uses `test.describe.configure({ mode: 'serial' })` for shared export state — replace with beforeAll-seeded state in the rewrite.
- Calendar navigation (`_navigateCalendarTo`, up to 60 clicks) is a flakiness risk for multi-month ranges under CI.
