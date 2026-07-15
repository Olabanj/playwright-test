# Session Handoff — Feature-First Migration

> Purpose: hand the migration work to a Claude Code session launched **from `playwright-e2e/`**
> so the `playwright-test` MCP (planner / generator / healer + live browser) and the custom
> migration sub-agents under `.claude/agents/` are available. Read this first, then `MEMORY.md`,
> then run `/mcp` to confirm servers loaded.

## First steps for the new session

1. Run `/mcp` — confirm `playwright-test`, `remotepass-qa` (this test framework's graph) and `remotepass-backend` (RemotePass product graph) are connected.
   - If `remotepass-qa`/`remotepass-backend` are missing, they're defined only in the repo-root `.mcp.json`; either add them to
     `playwright-e2e/.mcp.json` or accept that graph CLI (`graphify query …`) still works from shell. (MCP servers were renamed from `graphify`/`graphify-remotepass` on 2026-06-24; CLI name unchanged.)
2. Read this file + `docs/test-migration/inventory.json` + `docs/test-migration/progress.md`.
3. Confirm git: branch `migration/feature-first`, nothing pushed.

## ▶ RESUME HERE (new session — 2026-06-25)

**Migration state: 75/133 done.** CR ✅, onboarding ✅, contracts ✅ (22/25 + specialist review PASSED),
**time-tracking IN PROGRESS 14/66** (precondition-free policy API green — commits `bbe544da` / `e5fdf25a` / `04e92782`).
payments-e2e is OUT of scope. Everything local on `migration/feature-first`, **nothing pushed (CP-5)**.

**⛔ IMMEDIATE BLOCKER — fix before anything else: API tests 429 (login throttle).**
`npm run test:api` 429s on `POST /api/login` (backend `login.throttle:10,5` = 10 attempts / 5-min window
per email+IP; `workers:4` × worker-scoped logins in `fixtures/base.fixture.ts` blow it). **NOT a test defect**
— serial `--workers=1` is green. **Fix = the E2E throttle-bypass that already exists in code:** `BaseApiClient`
sends `x-e2e-secret-key` (which the sandbox honours to skip the throttle), but `.env`'s `E2E_SECRET_KEY` is
**EMPTY**. → **The user will paste `E2E_SECRET_KEY` in the new session.** Set it in `playwright-e2e/.env`
(gitignored — never commit/echo), then verify: one `--workers=1` probe, then `npm run test:api`.
(Durable root-cause: auto-memory `project-login-throttle-e2e-bypass`.)

**THEN resume time-tracking via the orchestrator** (tiered delegation; you = Opus plan/review, Sonnet/Haiku
specialists do the porting): the 50 remaining TT tests all need contract/worker preconditions — start at
**worker-assignment `TC_TT_API_010–017`**, then by-contract → matrix → sessions → manual-entries → UI.
Strategy (proposed — confirm with user): **env + auto-discovery of sandbox contracts via TT `/contracts`
+ self-skip + `TODO(api-preconditions)`**, no heavy seeding; 2 stay blocked (MATRIX-005 EOR-mint timeout,
SESSION_003 `endTime=null`). 9-batch plan in the TT DISCOVERY section below.

**How we work:** orchestrator-driven; **CP-5 = local commits only, NO push**; modify only `playwright-e2e/`;
port flow verbatim + greppable `TODO(<scope>)`, **don't heal mid-migration** (a dedicated cleanup phase
closes TODOs after the full migration); `--workers=1` on a rested sandbox (never full-parallel suites);
**WAIT-002 now bans `waitForTimeout`** (web-first waits; explicit eslint-disable+ADR only if unavoidable);
reconcile inventory/progress from inventory (status-sum **133**). Stage ONLY your files (pre-existing
`.claude/*`, `CLAUDE.md`, `GUARDRAILS.md`, `docs/20-engineering/*`, `docs/30-decisions/2026-06-12-*` are
NOT ours — leave untouched).

**Optional durable follow-up (not blocking):** structural login fix — Playwright `globalSetup` token-cache +
429 backoff in `loginAccount` (collapses 16–24 logins → ~2–3); shared-infra → needs an ADR. Good hygiene
even with the E2E key set.

---

## Project & branch

- Agentic migration of the legacy Playwright suite → **feature-first** framework under `playwright-e2e/`.
- Working branch: **`migration/feature-first`** (off `ai-memory-code-2-test`). **NOTHING pushed.**
  Commit/push only on explicit request (CP-5). **Only modify files inside `playwright-e2e/`.**
- Scope: source-of-truth = **`main` ONLY (strict)**; **133 in-scope tests**; order
  **CR → onboarding → contracts → time-tracking**. payments-e2e (209) re-scoped OUT 2026-06-25
  (0 specs on `main`). Reference impl = `features/expenses`.
- Plan of record: `~/.claude/plans/stateful-spinning-parasol.md` (phased: Ф0 prep → Ф1 CR → Ф2 onboarding → …).

---

## Phase 0a — ESLint architecture gate (built, green, in pre-commit)

- Stack: ESLint 9 flat config + typescript-eslint (strict+stylistic) + eslint-plugin-boundaries +
  sonarjs + playwright + jest(padding) + prettier; resolver `eslint-import-resolver-typescript`.
- Files: `eslint.config.mjs` (full), `eslint.arch.config.mjs` (fast gate), `eslint/architecture.mjs`
  (shared rules), `eslint/architecture-rules.json` (rules-as-data catalog → ADR),
  `eslint/__fixtures__/arch-gate.test.mjs` (golden **10/10** — WAIT-002 waitForTimeout case added
  2026-06-25), `tools/arch-checks.mjs` (FS rules),
  `scripts/hooks/pre-commit` + `install.sh`.
- npm scripts: `lint`, `lint:fix`, `lint:arch`, `lint:arch:test`, `arch:check`, `format`, `hooks:install`.
- Enforced rules: LAYER-010 (cross-layer imports), LAYER-011 (pages/builders feature-private),
  ASSERT-003 (expect only in tests), **LOC-005** (no raw `page.getBy*/locator` in specs — locators
  live in POM: static=getter, dynamic=method, cross-cutting=`core/ui/BasePage`), ENV-001
  (`process.env` only in `core/config/env.ts`), WAIT-002 (no `setTimeout/waitForTimeout`), TYPES-009
  (no `interface` in specs), COMPOSE-006 (no `@playwright/test` import in specs), NOFLOW-007 (no
  Flow/Facade), DOC-011 (scenario doc per feature), STYLE-030 (blank line between Act/Assert via
  `jest/padding-around-expect-groups`, autofix), DRY-020 (sonarjs duplication).
- Tunings: `restrict-template-expressions` allowNumber; `sonarjs/pseudo-random` off (builders);
  `no-empty-pattern` off (fixtures/specs); `no-non-null-assertion` off; `sonarjs/todo-tag` off
  (TODOs are intentional debt markers).

---

## Agent audit (ADR `docs/30-decisions/2026-06-23-dmytro-agent-audit.md`)

- 17 agents are well-factored — **keep all**; merges/removals rejected by adversarial review.
  Only `playwright-test-planner` was archived then **UN-archived**.
- planner / generator / healer are **built-in Claude Code Playwright MCP agents**; their
  `mcp__playwright-test__*` server **is** registered in `playwright-e2e/.mcp.json`. They + the live
  browser MCP are only available when Claude Code is launched **from `playwright-e2e/`** — which is
  why this handoff exists.

---

## client-registration — 31/31 MIGRATED (4 specs)

`features/client-registration/` — specs: `account-type`, `verify-email`, `general-info`, `company-info`.

- Pattern: layered UI precondition fixtures `signupEmail → atVerifyEmailStep → atGeneralInfoStep →
  atCompanyInfoStep` (no Flow/Facade). OTP bypass code `9999`.
- ADR `docs/30-decisions/2026-06-24-dmytro-api-preconditions.md`: preconditions/postconditions via
  API; UI-nav is a temporary exception carrying mandatory `TODO(api-preconditions)`.
- faker **restored**: shared `utils/data/user-faker.ts`
  (`generatePerson/PhoneNumber/ClientEmail/CompanyInfo`, ported from legacy
  `fixtures/data/user-faker.ts`); `features/client-registration/builders/signup.builder.ts`
  delegates to it (export names unchanged).

### Runtime findings (ran against sandbox)

- Fixed 2 real bugs — **both verbatim-legacy ports, NOT migration regressions**:
  - UAE phone double-prefixed (intl-tel +971) → use national `'54'+7 digits`.
  - Company Info "Next" used stale `.border-top` scope → `getByRole('button',{name:'Next'})`.
- **Sandbox concurrency**: flakes/degrades under parallel sign-up flows (non-deterministic, worsens
  with load). Set `workers=4` + `retries=1` in `playwright.config.ts`, but reliable runs need
  `--workers=1` on a rested sandbox. Known infra/CI blocker to raise.
- Config: `timeout 30s`, `actionTimeout/navigationTimeout 15s`; `BasePage.goto` uses
  `domcontentloaded` (not networkidle/load — SPA never idles).

---

## onboarding — 3/3 MIGRATED (Ф2, 2026-06-24)

`features/onboarding/` — specs: `confirm-company-details`, `company-profile`, `kyb-approval`.
All **3/3 green serially** (`--workers=1`). Inventory: 3 → `migrated`, the 4th
(`intercept-registration`, exploratory) stays `skipped_obsolete`.

- **DB dependency removed (the inventory blocker).** Legacy used `db-connection-manager`
  for two ids only; both now come from the API: `userId` decoded from the verify-token JWT
  `sub`, `companyId` from the `company/update` response. No DB layer in the new framework.
- **Fresh-client login is 2FA-gated at the API.** `/api/login` for a new client returns 200
  but **no token** (just the profile + `2fa` flag) until 2FA is disabled. So the
  `registeredClient` fixture MUST `disable2fa(userId)` via `AdminClient` before login; then
  the login `data` carries the token + `company_id` and is injected via
  `injectUiAuthFromAccount`. **`ADMIN_LOGIN_KEY` is therefore required** (added to `.env`,
  gitignored; `env.adminLoginKey`). Admin test-login = `GET /api/admin/login/test/<key>`.
- **Product drift:** the legacy "Complete company profile" activity card no longer exists
  (checklist now = confirm-details / identity / first-contract; API registration already
  fills company info). `company-profile.spec` reaches `/settings/info` directly (tagged
  `TODO(api-preconditions)`). confirm-details + KYB cards are unchanged.
- **New abstractions:** `OnboardingClient` (signup/verify/updateClient/updateCompany,
  single-endpoint), `AdminClient` (loginTest/approveCompanyKyb/disable2fa — lives in
  onboarding for now, promote when a 2nd feature needs admin), `seeding.registerFreshClient`
  (composite + JWT decode), `builders/company.builder`, 3 POMs, `fixtures` (registeredClient
  → disable2FA → inject UI auth → /activity). Each test registers its own fresh client.
- **Shared-infra edits (additive, G5-checked):** `core/config/endpoints.ts` (+registration,
  +admin), `core/config/env.ts` (+adminLoginKey). 3 importers each, no renames.

## Ф3 contracts — DISCOVERY (2026-06-24, not yet ported)

25 tests = **two sub-features**. Decision: port flow verbatim + bracket; defer-list below.

**A. EOR salary-currency API — 15 tests** (`eor-salary-currency.spec.ts`, API-only).
Flow: currency catalogue → read/edit `salary_currency` (PATCH `/api/contract/fulltime/{id}`) →
currency **amendment** on Ongoing (POST `/api/contract/amendment/add` → client `signature` →
admin `sign_as_provider`) → invariants (billing unchanged, allowances inherit, no webhook,
`has_amendment`). Build: `ContractsClient`/EOR methods (getCurrencies, getContract(ref),
updateSalaryCurrency, createCurrencyAmendment, getAmendments, clientSign) + extend `AdminClient`
with `signAsProvider`. Admin key available ✓. Existing `features/contracts/` = stub (listContracts
only; types.ts is example-only).
- **DEFER `TODO(api-preconditions)`:** tests run against **pre-existing** EOR contracts — edit flow
  via env `EOR_CONTRACT_ID`/`EOR_CONTRACT_REF` (Pending-company-signature), amendment flow via
  `findCleanOngoingEOR` auto-discovery. Both **self-skip if none found**. EOR creation is heavy
  (KYB+2 signatures+provider) — port env+auto-discovery verbatim, seed real EOR contracts later.
  Coverage risk: may skip in CI on a contract-less sandbox.
- **DEFER `TODO(cleanup)`:** TC_009/010/015/016 are an **ordered chain** depending on the amendment
  TC_008 creates (shared state in one spec). Port verbatim as one ordered spec; split into
  independent tests + amendment fixture later.
- Idempotent restore (afterAll restores original currency) → port as fixture teardown.

**B. Bulk-import UI — 8 tests + contractor-registration — 1.**
Bulk import: wizard (type+upload) → review table (filters/search/CoR) → edit sidebar → CoR
eligibility (3-step) → import+invite. Specs concise (~330 LOC) but need POMs (BulkImport page +
`BulkImportEditSidebar` + `BulkImportModals`) and **5 CSV fixtures** (clean-17row / errors / payg /
milestone / template). Auth via injected client session.
- **DEFER `TODO(flaky)`:** import processing 30–60s (import-and-invite 90s timeout) → flake-prone.
- **DEFER `TODO(merge)`:** PAYG + Milestone bulk-import (2 tests, decision=merge) → parametrize into
  import-and-invite.
- **BLOCKED — contractor-registration:** worker OTP is read from DB (`users.otp`), **NOT** the `9999`
  client bypass (scenario doc + `otp-database.helpers`). New framework has no DB layer. → mark
  `blocked` unless an admin/API OTP-fetch path exists (investigate at build time); do NOT port DB.
  `TODO(api-preconditions)`.

**Proposed batches (API before UI, 3–5 tests each):** (1) EOR client + AdminClient.signAsProvider +
TC_000 currencies + TC_001 read; (2) EOR edit flow TC_003–007; (3) EOR amendment chain TC_008–016;
(4) bulk-import foundation (POMs+CSV) + type-and-upload + review-table; (5) edit-sidebar +
cor-eligibility; (6) import-and-invite (+merge PAYG/Milestone). contractor-registration → blocked.

## Ф3 contracts — DONE + REVIEWED (2026-06-24/25)

- Bulk-import UI: 8 tests + 2 merged ported verbatim into `features/contracts/pages/frontoffice` +
  `tests/ui/frontoffice`. **3 green** serially; **7 ported-but-flaky** (each tagged
  `TODO(flaky|selector)`: eligibility-dialog timeout, with-errors-CSV data drift, `errorsCount(0)`
  selector, CoR re-render detach, Milestone upload, template-headers drift). Inherited flow, deferred.
- **contractor-registration BLOCKED** (`TODO(api-preconditions)`): worker email OTP is random; `9999`
  bypass is client-only (`ContractorService.php`); no admin/API read or force-verify; no DB layer.
- Client login was 429-throttled by a per-test login → `clientAccount` made **worker-scoped** in
  `features/contracts/fixtures.ts` (one login/worker), `bulkImportClientPage` injects per test.
- **Specialist audit (2026-06-25):** architecture-compliant. migration-reviewer + qa-architect ⇒
  COMPLIANT-WITH-NOTES (6/8 patterns fully upheld). One CLEAR fix applied (inventory `newPath` drift).
  One escalation to main: **WAIT-002 gate gap** (`playwright/no-wait-for-timeout` never registered ⇒
  `waitForTimeout` passes `lint:arch` silently). Reports in `docs/test-migration/reviews/`.
- Contracts now **22/25 migrated + 2 merged + 1 blocked**. Global **55/133** (post payments re-scope).
  Commits `488e281a` (bulk-import) + `cfb5f459` (review). Nothing pushed (CP-5).

## Ф4 payments-e2e — ❌ OUT OF SCOPE (resolved 2026-06-25)

**DECISION (Dmytro, 2026-06-25): payments-e2e is OUT of scope — strict main-only.** It has 0 specs on
`main` (all 76 files / 209 cases live only on `ai-memory-code-2-test`), so under "what is not in `main`
we do not migrate" it is NOT ported. Re-scoped out: total 342 → **133**; the payments feature was moved
to `inventory.archive.json`. Revisit only if payments merges to `main`. The discovery below is retained
as a **historical record only — do NOT port from it.**

### Discovery findings (valid regardless of the scope outcome)
Source read from `ai-memory-code-2-test` / working tree (`services/api/modules/payments-e2e/`).
- **Suite shape (inventory):** 209 tests / 18 legacy files. `migrationDecision` = rewrite 113 /
  migrate 63 / merge 8 / blocked 22 / skip 3. priority P0 68 / P1 118 / P2 23. Flow:
  enable-methods → add-methods → process-payments → withdrawals (API + UI mirrors).
- **22 blocked** are real backend gaps / sandbox limits, already documented per-test (Wise/Mercury no
  numeric ID; SEPA sandbox unsupported; `/transaction/quotes` validation gaps; duplicate-IBAN; etc.)
  — keep blocked.
- **Foundation file = `01-enable-payment-methods` (API, 9 pending + 2 blocked, P0).** `AdminPaymentMethodsAPI`:
  - WRITE `POST /api/admin/company/update` — **form-urlencoded**, `company_id` + repeated
    `payment_method_ids[]=<id>` (full-list replacement; Bank Transfer id=3 always included by convention).
  - READ `POST /api/admin/company/list?page=N` — JSON `{page,search:'',archived:0,user_type:'client'}`;
    company `payment_method_ids` is a comma-separated string. Method IDs: BankTransfer=3, CC=1, SEPA=4,
    ACH=5, Coinbase=18. (Confirmed from legacy source + graph node `AdminPaymentMethodsAPI`; rp-scribe
    has no admin endpoints.)
- **Precondition simplification:** Spec 01 needs only a `companyId` + admin auth — NOT the heavy
  `loadPrerequisites` seeded-client-company state file (which requires a DB tunnel for contractor OTP).
  Use an **env `PAYMENTS_CLIENT_COMPANY_ID`** (EOR `EOR_CONTRACT_ID` pattern), self-skip if absent,
  `TODO(api-preconditions)`. Downstream specs (process payments, withdrawals) DO need real seeded
  funded accounts — defer those, tag `TODO(api-preconditions)`.
- **Reuse vs net-new:** reuse `features/admin/AdminClient` (admin auth) + `base.fixture` `clientToken`/
  `loginAs`. Net-new: `features/payments/{client.ts (PaymentMethodsAdminClient extends AdminClient:
  setPaymentMethods/enable/disable/getEnabled/parseIds), types.ts (SetPaymentMethodsData),
  constants.ts (PAYMENT_METHOD_IDS, TOGGLEABLE_PAYMENT_METHODS)}` + two endpoints
  (`admin.companyUpdate`, `admin.companyList(page)`) + env `PAYMENTS_CLIENT_COMPANY_ID`.
- **Shared-infra note:** `BaseApiClient` has JSON `post` + `postMultipart` but **no form-urlencoded
  post**. The `payment_method_ids[]` repeated-array body needs either a new additive
  `postForm`/`postUrlEncoded` on `BaseApiClient` (G5 discovery first) or confirmation the endpoint
  accepts a JSON array. Decide before building the payments client.

### Proposed FIRST batch (5 tests from 01-enable-payment-methods, ONLY after scope green-light)
Bank-Transfer-always-on (read), enable-CC, enable-SEPA, enable-ACH, all-active-after-setup. P0 @smoke.
Build order: endpoints (+companyUpdate/+companyList) → constants → types → `PaymentMethodsAdminClient`
→ fixtures (env company id + AdminClient) → spec. Batch 2: disable/round-trip + non-admin-401
(needs `clientToken` wiring). Wise/Mercury stay blocked.

## Ф4 (renumbered) time-tracking — DISCOVERY (2026-06-25, foundation batch in progress)

66 tests / 8 verify files = **59 API + 7 UI**. 64 pending + 2 genuinely blocked. Source-of-truth =
repo-root legacy tree `tests/modules/time-tracking/**/verify/*.spec.ts` (tracked on `main` via commit
`050d836b`; physically present in the root worktree — read it directly, never modify outside
`playwright-e2e/`). The 3 probe specs are out of scope (probes lane deleted). A full scenario doc
already exists: `docs/test-migration/scenarios/time-tracking.md` (33 step-groups) — authoritative for intent.

### Suite shape (by legacy file)
| Legacy file | Tests | Kind | Preconditions |
|---|---|---|---|
| `api/verify/policies.spec.ts` | 19 | API | **NONE** for CRUD (000–009); worker-assign needs Fixed contract IDs (POLICY_010–017) |
| `api/verify/policies-deep.spec.ts` | 3 | API @deep @slow | none (creates its own 30/10 policies) |
| `api/verify/policy-by-contract.spec.ts` | 8 | API | a contract with/without an assigned policy (discovery) |
| `api/verify/policy-contract-matrix.spec.ts` | 7 | API | PAYG/Fixed contracts (discovery); **MATRIX-005 blocked** (EOR mint timeout) |
| `api/verify/sessions-details/auto-tracker-sessions.spec.ts` | 5 | API | worker PAYG contract + live session; **SESSION_003 blocked** (sandbox endTime=null xfail) |
| `api/verify/sessions-details/error-handling.spec.ts` | 5 | API | worker PAYG contract (mostly invalid-id, light) |
| `api/verify/sessions-details/manual-time-entries.spec.ts` | 12 | API | worker PAYG contract + policy |
| `ui/verify/policies.spec.ts` | 7 | UI | client login + a resolved policy in the list |

### Endpoints + envelope (confirmed from legacy `TIME_TRACKING_ENDPOINTS` + live-verified per scenario doc)
- **Separate host.** TT is NOT on `API_BASE_URL`. Legacy: `process.env.TIME_TRACKING_API_URL`
  (default `https://4s0fysfjri.execute-api.eu-central-1.amazonaws.com`), path prefix
  `/timetracking/api/v1/*`. rp-scribe documents the **main** API only — no TT endpoints there;
  TT source of truth is the TT Swagger (the legacy constants mirror it).
- Health `GET /server/healthy`; Policies `GET/POST /policies`, `GET/PATCH/DELETE /policies/{id}`,
  title-check `POST /policies/titles/availability:check`, workers `PUT/PATCH /policies/{id}/workers`,
  by-contract `GET /policies/contracts/{contractId}`. Sessions `/time-sessions[/{id}][/pause|/resume|/end]`,
  active `…/contracts/{id}/active`, stats `…/stats/contracts/{id}?fromDate=`. Contracts `/contracts`.
- **Envelope = `{ result: … }`** (NOT `{ data }` like the main API). Pagination:
  `result.{items,page,limit,total_items_count,total_pages_count}`.
- Status codes: create → **201** (`result.id`); missing-fields → **422** (`{message, statusCode:422}`);
  bad id → **404**. Title-check → 200 `result.isAvailable:boolean`.
- Body quirks (carry verbatim): pause/resume/end take `id` as a **string** in the body; `/contracts`
  caps `limit ≤ 50` (400 over); `timeBasis` enum = `flexible|schedule_window|total_hours`.
- New framework asserts **raw numeric status** (`res.status).toBe(201)`) — there is no HTTP_STATUS helper.

### Precondition strategy
- **Foundation (policy CRUD) needs ZERO preconditions** — runs as a logged-in client only. This is the
  cleanest entry point in the whole migration (no EOR/contract heavy lift, unlike contracts Ф3).
- **Worker-assignment / by-contract / matrix** need contract IDs → **env + auto-discovery** (EOR pattern):
  discover PAYG/Fixed contracts via `client.getContracts()` (TT `/contracts`), self-skip if none.
  `TODO(api-preconditions)`. Do NOT build heavy seeding now.
- **Sessions / manual-entries** need a worker PAYG contract + (for sessions) `ensureNoActiveSession`
  cleanup. Worker-scoped one-session constraint is global per worker (see scenario doc domain notes).
  Port the discovery+cleanup helpers verbatim into seeding/fixtures; `TODO(api-preconditions)`.

### Reuse vs net-new
- **Net-new `features/time-tracking/`:** `client.ts` (`TimeTrackingClient extends BaseApiClient`, ctor
  passes the TT host — typed `ApiResponse<T>`, drop legacy clockIn/clockOut/getSessions duplicates),
  `types.ts` (Policy/CreatePolicyRequest/ListPoliciesResponse/SessionResponse — typed, drop `any`),
  `constants.ts` (timeBasis/overtime/status enums), `builders/policy.builder.ts` (no HTTP),
  `seeding.ts` (contract discovery: `findPaygContract`/`findFixedContracts`), `fixtures.ts`
  (`timeTrackingClient` from worker-scoped `clientToken`; `workerTimeTrackingClient` from
  `contractorToken` for worker-role tests), `tests/api/*.spec.ts`, `tests/ui/*` (POM for the UI file).
- **Reuse:** `BaseApiClient` (ctor already accepts `baseURL`), `base.fixture` `clientToken`/
  `contractorToken`/`loginAs`/`injectUiAuthFromAccount`, `features/contracts` discovery idea
  (`findCleanOngoingEOR` → analogous `findPaygContract`). No `AdminClient` needed for policy CRUD.
- **Shared-infra (additive, G5):** `core/config/env.ts` `+timeTrackingApiUrl` (requireEnv w/ legacy
  default), `core/config/endpoints.ts` `+timeTracking` group, `.env` `+TIME_TRACKING_API_URL`. Each is
  additive (no renames) — but `env.ts`/`endpoints.ts` are imported widely → G5 grep-confirm before edit,
  and these edits land in the **same** foundation batch (serialize; no parallel TT batch until merged).

### Defer-list (greppable TODO scopes)
- `TODO(api-preconditions)` — every contract/session/worker-assign precondition via env+auto-discovery, self-skip.
- `TODO(cleanup)` — parametrize the matrix (MATRIX-*) + invalid-id families into data-driven loops;
  merge `sessions-details/` into flat specs (per scenario doc migration decision). Defer to cleanup phase — port verbatim now.
- `TODO(merge)` — 5 merge-candidate pairs flagged in inventory (007/007B, POLICY_010/011, 013/014,
  012/016, by-contract 003/006 + 004/005, UI 4 list-display dupes). Port both verbatim now, consolidate in cleanup.
- `TODO(flaky)` — sessions live timing (pause/resume/end), UI dialog/timer flows; tag, do not heal.
- **2 stay BLOCKED:** MATRIX-005 (EOR mint ~2-3min > per-test timeout) + SESSION_003 (sandbox returns
  endTime=null on completed sessions). Both real, documented — keep `blocked`, port as `test.fail`/`skip` w/ reason.

### Batches (API before UI, 3–5 each, G8)
1. **Foundation — policy CRUD (no preconditions):** TC_TT_API_000 health, 001 list, 002 get-by-id,
   004 create, 003 404. Build order: env(+timeTrackingApiUrl) → endpoints(+timeTracking) → types →
   constants → `TimeTrackingClient` → fixtures(`timeTrackingClient`) → `policies.api.spec.ts`. **← THIS RUN**
2. Policy CRUD cont'd: 005 (422 missing-fields), 006 (filter), 007/007B (title-check, merge), 009 (update), 008 (delete).
3. Worker-assignment (POLICY_010–017) — env+auto-discovery Fixed contracts, `TODO(api-preconditions)`.
4. policy-by-contract (8) — discovery + invalid-id family (parametrize later, `TODO(cleanup)`).
5. policy-contract-matrix (6 portable; MATRIX-005 blocked) — discovery, `TODO(cleanup)` parametrize.
6. sessions error-handling (5, light) + auto-tracker (4; SESSION_003 blocked).
7. manual-time-entries (12) — worker PAYG + policy precondition.
8. policies-deep (3 @deep @slow) — self-contained, low priority.
9. UI policies (7, 2 merge) — POM-v4 + client-auth injection.

## OPEN THREADS

1. ~~**verify-email: 4 `displays …` tests fail DETERMINISTICALLY**~~ **RESOLVED 2026-06-24.**
   The "deterministic failures" were **sandbox concurrency degradation under `workers>1`**, NOT an
   iframe/async OTP issue or a fixture readiness weakness. Proof: all tests pass deterministically
   under `--workers=1` (ran twice). The migrated locators + heading-only readiness are byte-for-byte
   identical to the legacy nav helper (`SignUpNavigationHelper.navigateToVerifyEmailStep`), so this
   was faithful parity, not a migration regression. **Decision: light cleanup (not heal, not trim):**
   dropped the one fully-redundant test ("displays the Resend and Sign In links" — a strict subset of
   "displays … all required elements"); kept the other 9. verify-email is now **9/9 green serially**.
   Inventory: `ba8fd40b4660` → `skipped_obsolete` (merge → consolidated into `ca927d9fcbc9`).
2. `retries: 1` in `playwright.config.ts` — decide: keep or revert (adds sandbox load).
3. Migration debt is greppable: `grep -rn "TODO(" features`
   (scopes: `flaky` | `selector` | `api-preconditions` | `cleanup` | `merge`).
4. **Sandbox concurrency is the real CR blocker** (confirmed via thread #1): parallel sign-up flows
   degrade the shared sandbox → spurious timeouts. Reliable CR/onboarding UI runs need
   `--workers=1` on a rested sandbox. Raise as an infra/CI item.

---

## Conventions

- **Port the FLOW verbatim; do NOT fix flakes/locators/cases mid-migration.** From the legacy
  repo we take only the flow — its flakiness is inherited, not a regression. Tag every compromise
  with a greppable `TODO(<scope>)` and move on. A **dedicated post-migration cleanup phase** (after
  the whole suite is on the new architecture) closes all TODOs in one sweep. Don't run the healer /
  re-engineer readiness for a flaky migrated test now — tag `TODO(flaky)`. Minimal flow-preserving
  adaptations are OK when a legacy step is impossible (removed UI card → reach form by URL), still
  tagged. (auto-memory `feedback-migration-defer-fixes`.)
- Locators in POM, never raw in specs (LOC-005). `expect` only in specs, never in POM (ASSERT-003).
- Durable record: auto-memory `project-migration-scope-and-readiness.md`,
  `project-architecture-linter.md`, `project-fresh-client-2fa-gate.md`,
  `feedback-migration-defer-fixes.md`.

---

## NEXT

- ~~Heal/trim verify-email~~ **DONE** (light cleanup, 9/9 green).
- ~~Ф2 — onboarding~~ **DONE** (3/3 green).
- ~~Ф3 — contracts~~ **DONE** (22/25 migrated + 2 merged + 1 blocked; EOR API green + bulk-import;
  specialist review PASSED — architecture-compliant-with-notes). `OnboardingClient` + shared
  `AdminClient` (`features/admin/`) + `registerFreshClient`/`findCleanOngoingEOR` reusable.
- ~~Ф4 — payments-e2e~~ **OUT OF SCOPE** (2026-06-25 — not on `main`; archived).
- **Ф4 (renumbered) time-tracking — IN PROGRESS 14/66** (precondition-free policy API done; 50 pending +
  2 blocked). **Resume at the contract-precondition boundary: worker-assignment `TC_TT_API_010–017`** —
  see ▶ RESUME HERE at the top. ⛔ But FIRST unblock the API-test 429 via `E2E_SECRET_KEY` (above).
- **Commits on `migration/feature-first` (local, NOTHING pushed — CP-5):** Ф1–Ф3 + re-scope/WAIT-002 +
  TT `bbe544da` / `e5fdf25a` / `04e92782`. (`git log --oneline` for the full list.)
- **Do not run full parallel sandbox suites** (degrades sandbox; use `--workers=1` on a rested sandbox).
