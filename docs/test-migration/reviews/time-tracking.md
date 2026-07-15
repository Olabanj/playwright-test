## Architecture Review

_Reviews the **time-tracking** branch (HEAD `f25e76c`) against our target feature-first architecture (8 patterns + layer contracts in `docs/10-architecture/overview.md` + the ADRs). This is **legacy-shaped code being investigated for migration** — most rows below are migration-carry items, not "you broke a rule." It's the most mature module and the right pilot._

**Verdict:** functionally solid, structurally legacy — good coverage trapped in the old shell. The migration's job is to re-home it into `features/time-tracking/{client,flow,pages,builders,fixtures,tests}` **without rewriting the assertions**, and to fix a few real pre-merge issues (see Logic review).

➡️ **Tables scroll horizontally — scroll right for the "New code (target)", "Why", "Suggested fix" and "Evidence" columns.**

### Strengths

| ✅ Strength | Evidence | Carry into migration? |
|---|---|---|
| UserPool solves shared-account collisions (lease + file-lock + persist) | `fixtures/auth/user-pool.ts` | Yes — re-home as a fixture |
| Consistent tags `@smoke`/`@regression`/`@critical` | across all specs | Yes — drives `projects[]` grep filters |
| xfail carries a PD ticket instead of deleting the test | `authorization.spec.ts:155`, `payment-calculation.spec.ts:121` | Yes + add triage cadence |
| Real POMs (locators + actions encapsulated) | `PolicyPage.ts`, `TimeTrackingPage.ts` | Yes — after removing `expect`/`goto` |
| `logVerbose()` convention near-universal | `TimeTrackingAPI.ts` (1 miss) | Yes |

### Findings (old code → target)

| # | Area | Status | Old code (current) | New code (target) | Why it matters | Suggested fix | Evidence (file:line) |
|---|---|---|---|---|---|---|---|
| 1 | Layout / 3-lane | ⚠️ migrate (not a defect) | `api/scripts·probes·verify` lanes | flat `features/time-tracking/tests/` | 3-lane was **inherited from the old repo**; in the new framework one feature should live in one folder, not scattered across 3 | flatten lanes **during migration**; tags+branches instead of folders | `api/{scripts,probes,verify}/`; ADR `2026-05-15-drop-3-lane` |
| 2 | Config | ❌ | 4 configs: `.ts` + `.api.ts` + `.ui.ts` + `.ui.cross-browser.ts` | 1 `playwright.config.ts` + `projects[]` | configs drift independently — proof: a stray `,,` artifact nobody caught | merge to one config, `projects=api/ui/ui-cross-browser` | `playwright.config.api.ts:20` (`'**/api/verify/**/*.spec.ts',,`) |
| 3 | POM purity | ⚠️ | `expect()` inside Page classes | Page exposes state, **test** asserts | failure stack points at the Page, not the intent; Page can't be reused inside a Flow | move assertions to specs | `PolicyPage.ts:164,309,387,407,425,973`; `TimeTrackingPage.ts:241` |
| 4 | Navigation | ⚠️ | `page.goto()` inside tests | `goto()` only inside Page methods | routing knowledge leaks into the test layer | push `goto` into the relevant Page | `policy-wizard.spec.ts:43,249,318`; `mobile.spec.ts:78`; `reporting.spec.ts:131` |
| 5 | Fixtures / SRP | ❌ | `UIFixture` (453 lines) & `AuthFixture` — static God-classes | `test.extend()` fixtures, worker-scoped, auto-cleanup | a static class can't do per-worker login or auto-cleanup; token `Map` is a hidden global; 6 responsibilities in one file | split: `fixtures/base.fixture.ts` (login) + `features/time-tracking/fixtures.ts` (pages/flows) | `ui.fixture.ts` (login+intercom+POM-factory+nav); `auth.fixture.ts:43-283` |
| 6 | Typed client | ❌ | returns `body:any`; `any` params on writes | `ApiResponse<T>` + typed payloads | `any` removes the only compile-time guard; worst on write paths (a wrong field silently no-ops) | define `ApiResponse<T>`; type the mutating methods | `TimeTrackingAPI.ts:352,476,492` |
| 7 | Config boundary | ❌ | `process.env` read in many layers | single `core/config/env.ts` | a missing var should fail once, typed, at startup — not 5 layers deep at runtime | central typed env, all layers consume it | `BaseAPI.ts:29,45,83`; `TimeTrackingAPI.ts:32`; fixtures |
| 8 | UserPool design | 🟢 keep / ⚠️ refactor | static class, 5 responsibilities, imports `AuthFixture` | re-home into a fixture, split concerns | great idea, but coupling pulls in all API classes; lock-key mismatch risks concurrent contracts mutation | keep concept; split lease/lock/cache/instantiate/persist; fix lock key | `user-pool.ts:23` (imports AuthFixture), `:181-226` (lock mismatch) |

### 8-patterns & SOLID compliance

| Pattern / Principle | Status | Evidence |
|---|---|---|
| Single config + `projects[]` | ❌ | 4 configs; `playwright.config.api.ts:20` `,,` artifact |
| Feature-first layout | ⚠️ migrate | 3-lane `api/scripts\|probes\|verify`; no `features/time-tracking/{...}` yet |
| Drop-3-lane | ⚠️ migrate | lanes retained incl. `probes/.gitkeep` (legacy norm; flatten on migration) |
| Typed `ApiResponse<T>` | ❌ | `TimeTrackingAPI` returns `body:any`; `:352,:476,:492` take `any` |
| POM-no-expect / no goto in tests | ⚠️ | real POMs, but `expect` in `PolicyPage`/`TimeTrackingPage`; `goto` in specs |
| Fixtures over static classes | ❌ | `UIFixture`/`AuthFixture` static, no `test.extend`/`use()` |
| Builders | ❌ | no `builders/`; data built ad-hoc / in scripts |
| SRP | ❌ | `UIFixture` 453 lines/6 jobs; `AuthFixture` token+login+creds+factory; `UserPool` 5 jobs |
| Config boundary | ❌ | `process.env` scattered; no `core/config/env.ts` |

---

## Logic & Code Review

_Issues **visible from the code only** — I don't know the time-tracking/payment domain edge cases, so this is obvious-from-source findings, each with evidence + a fix. Nothing here blocks function; several are latent flakiness or false-coverage._

➡️ **Table scrolls horizontally — scroll right for "Why it looks wrong" and "Suggested fix".**

| # | Type | Severity | Issue (what) | Where (file:line) | Why it looks wrong | Suggested fix |
|---|---|---|---|---|---|---|
| 1 | Duplication | 🔴 | `postMultipart` defined twice | `BaseAPI.ts:295` (public, fresh ctx) & `:416` (protected, `this.context`) | same name, two bodies, divergent behaviour — TS "duplicate implementation" hazard | keep the fresh-context impl, delete `:416` |
| 2 | Duplication | 🟡 | role→credential resolution in two places | `auth.fixture.ts:79-84` & `ui.fixture.ts:332-357` | same concept resolved two ways → drift | resolve once via `core/config/env.ts`, both consume it |
| 3 | Likely bug | 🔴 | multipart upload silently broken | `BaseAPI.ts:416` | reuses `this.context` whose `extraHTTPHeaders` set `application/json`, overriding the multipart boundary → server can't parse parts | route all multipart through the fresh-context impl; never hand-set `Content-Type` on multipart |
| 4 | Likely bug | 🟠 | observation-only "test" (no `expect`) | `policies.spec.ts:805-824` (TC_TT_POLICY_017) | body only logs ("just log the behavior"), can never fail → false coverage in the deterministic lane | add the assertion, or move it out of the verify lane |
| 5 | Likely bug | 🟠 | test is structurally unpassable | `auto-clockout.spec.ts:59-61` | `test.skip(!isSlowRun)` **and** `test.fail(true)` together → if the cron works the test passes, which Playwright reports as *unexpected pass* (red). Product working = red. | pick one: keep skipped+ticket, OR drop `test.fail` and assert real outcome under `RUN_SLOW` |
| 6 | Likely bug | 🟡 | fragile shared `createdPolicyId` | `policies.spec.ts:11` | the consuming test is self-sufficient; the shared module-level var only makes the suite order-fragile | scope the id to the test; drop the module `let` |
| 7 | Note (not a bug) | ⚪ | `test.skip('MATRIX-005…', fn)` | `policy-contract-matrix.spec.ts:308` | this is the **valid** skipped-test-declaration signature — intentional, not a defect | just track it as a conscious **coverage gap** (that role×contract cell is untested) |
| 8 | Risky pattern | 🟠 | whole files are xfail → no live signal | `policy-contract-tab` (6): `:77,183,212,262,301,362`; `policy-wizard-scope2` (9): `:151,171,222,248,296,328,369,407,447` | these look like **locator/helper** problems, not product bugs; xfailing the whole file gives no signal and flips to red (unexpected pass) all at once when fixed | **fix the locators/helpers** (don't xfail); reserve xfail for real BE bugs + PD ticket; run an xfail-triage cadence |
| 9 | Risky pattern | 🟡 | module-level mutable state across describes | `policies.spec.ts:14-15` | two describe blocks' `beforeAll`/`afterAll` write the same module vars → corruption if ordering changes (shard/grep/parallel) | move shared state into a fixture or a single-describe `beforeAll` |
| 10 | Risky pattern | 🟡 | hard waits in a POM | `TimeTrackingPage.ts:64,75` (`wait(1000)`) | fixed sleeps are flaky (race if short, slow if long) — against Playwright web-first guidance | replace with `locator.waitFor()` / `expect(locator).toBeVisible()` |
| 11 | Risky pattern | 🟡 | module counter mutated by a helper | `manual-time-entries.spec.ts:31,67` (`dayCounter`) | if `fullyParallel` is ever enabled in the describe, concurrent `nextSlot()` calls race and hand out colliding slots | derive the slot from test/worker index or a fixture allocator |
