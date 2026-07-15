# Review: `feature/time-tracking` (pre-merge to main)

**Reviewed:** 2026-06-10 · branch head `a8d3723` (Merge branch 'xfail-triage') · 246 commits ahead of main · 186 files · +56,115 / −2,788 lines
**Reviewer:** Dmytro + Claude (investigation round 3; evidence gathered on the merged integration worktree `integration/tt-investigation` @ `f25e76c`)
**Verdict: ✅ APPROVE with required pre-merge fixes (see Blockers).** The work is substantial and largely high-quality; nothing here is architecturally unsound, but four items must be addressed before the merge lands in main.

---

## What the branch delivers

- **time-tracking grows 98 → 392 catalogued tests** (54 spec files: 36 api/verify ≈277, 18 ui/verify ≈116). New coverage areas: approval flow, audit-trail, authorization, auto-clockout, daily-limit, e2e canary flow, feature-flag/localization permissions, manual-entry edge cases, notifications, payment calculation + invariants, permissions matrix, policy wizard (+scope2), schedule rules, worker types, reporting, timesheet report, session editing/edit-delete rules/edge cases, tt-bulk-import (template/validate/worker/execute), mobile UI, dashboard UI.
- **New module `invoices`** (3 specs / 13 tests; PD-12832 date filter + PD-11896 bulk ZIP download). Clean, no xfail.
- **Probes lanes deleted** (api/probes, ui/probes) — consistent with the team's drop-3-lane direction.
- **New infra:** `UserPool` (file-lock leased client/worker/contract slots per Playwright worker — solves shared-account collisions), roles `new_admin`/`custom_role` in AuthFixture (PD-12843/PD-12887), lane-based `testMatch` in `playwright.config.api.ts` (`API_LANE=probes`), `scripts/test-history/` run recorder.

## Strengths

1. **Test hygiene is genuinely good in the sampled specs**: zero `waitForTimeout`/sleep; cleanup in `afterAll` everywhere sampled (policies deleted, `UserPool.release()`, `dispose()`); `describe.serial` used only where justified (5×, e.g. the e2e canary); consistent tags and `HTTP_STATUS` usage; `logVerbose` convention followed.
2. **xfail discipline (mostly)**: `test.fail` markers carry PD tickets (PD-12072, PD-13931, PD-13413, PD-12929 …) — live backend defects are encoded as expected-failures instead of being skipped silently.
3. **UserPool** is the right answer to cross-spec sandbox state collisions and is schema-documented (`user-pool.example.json`).
4. Commit messages are conventional (feat/fix/test/chore + ticket refs).

## Blockers (fix before merging into main)

1. **`BaseAPI.postMultipart` duplicate.** The branch adds a *public* `postMultipart` (one-shot context) while main already has a *protected* `postMultipart` (shared context). After merge both exist with different visibility/semantics — subclasses calling `this.postMultipart()` may silently switch behaviour. **Deduplicate to one method** (keep main's protected shared-context form; add a timeout/one-shot option if needed).
2. **Six merge conflicts with main** must be resolved exactly once, deliberately (verified resolutions on the integration worktree, commit `f25e76c`, can be reused):
   - `.gitignore` (union), `package.json` (union of tt:* and payments:* scripts), `playwright.config.api.ts` (**keep both** lane-based `testMatch` *and* main's `testIgnore: '**/payments-e2e/**'` — dropping the ignore breaks the payments pipeline), `pages/common/BasePage.ts` (semantic conflict: branch `domcontentloaded` vs main `load` in `waitForPageLoad` — agree on one; branch's suite depends on `domcontentloaded`), `fixtures/auth/auth.fixture.ts` (role union: `client|worker|contractor|new_admin|custom_role`; add `contractor` to the branch's `credentialsMap`/`runtimeTokenMap`), `services/api/common/BaseAPI.ts` (keep main's `getWithRetry`/`sendWrite` resilience wrappers — branch side has plain calls).
3. **`user-pool.json` is a hard CI gate.** `UserPool.lease()` throws if the pool file is missing; seeding takes ~30 min. CI will fail all TT tests until a pool-seeding step + doc exist. Ship a CI setup note (or a graceful fallback to env-var accounts) with the merge.
4. **New required env vars** must land in `.env.example` + CI secrets before merge: `NEW_ADMIN_EMAIL/PASSWORD`, `CUSTOM_ROLE_EMAIL/PASSWORD` (and formalized `CONTRACTOR_EMAIL/PASSWORD`).

## Required (non-blocking) follow-ups

- **~200 xfail/skip annotations** land in main (51 catalogued blocked test entries; the rest parameterized/secondary). Risk: when a PD bug is fixed, a forgotten `test.fail` turns a now-passing test into a CI failure marked "expected" — schedule a recurring xfail-triage (the branch already merged one pass; make it a cadence).
- Two **bare `test.skip()` without reason** (`policy-contract-matrix.spec.ts:308`, `manual-entries-edge-cases.spec.ts:253`) — add reasons/tickets.
- **Conditional skips on live data** (`reporting.spec.ts:74/81/88` — skip when table empty) can mask real regressions; convert to seeded-data assertions.
- `ui/policy-contract-tab.spec.ts` carries 5–6 `test.fail` for a *locator re-discovery* issue (not a product bug) — that's test debt, not xfail; fix locators instead.
- ~8 "handoff/overnight summary" WIP commits + `test-runs/` history artefacts (`history.json`, `green-report.md`) — squash/gitignore before merge; dev-tooling shouldn't live in main history.
- `EXPENSE_ENDPOINTS` declared twice in `utils/constants/api-endpoints.constants.ts` (latent duplicate identifier).
- `mobile.spec.ts` drives raw `page` without a POM — acceptable as a first pass, note for follow-up.
- Invoices: `invoice-download.spec.ts` creates the export job but the `pending→ready` poll assertion is only in TC-INV-DL-002 — fine, but the hardcoded sandbox anchor (exactly 4 invoices in Mar 12–Apr 11 2026) will break on sandbox refresh; replace with seeded/derived counts.

## Merge-risk assessment

| Area | Risk | Why |
|---|---|---|
| payments-e2e pipeline | **Low** if conflict #2 is resolved as above | config keeps `testIgnore`; BaseAPI keeps main's wrappers |
| Other modules | Low | spec changes confined to time-tracking + invoices |
| CI | **High until #3/#4 done** | user-pool gate + new env vars |
| History cleanliness | Medium | 246 commits incl. WIP noise — recommend squash-merge |

## Note for the migration dashboard

Catalogued on the combined base (main `4e48b4f` + branch `a8d3723`): time-tracking = 392 tests (323 rewrite / 18 merge / 51 blocked-by-xfail), invoices = 13 (all rewrite). Grand total now **681 tests across 7 features**.
