# Old vs New architecture — why migrate instead of patch

> Companion to `01-architecture-rationale.md` (which covers the **new** architecture «in a vacuum») and
> `04-plan-B-fix-current-2-weeks.md` (which covers the downsides of patching). This document is a **direct comparison**:
> a concrete gap in the old framework ↔ how the new architecture closes it ↔ the benefit. Every
> claim about the old framework is backed by a reference to a real file.

## TL;DR

The old framework (repo root) **works** — hundreds of tests run on it. But it has **7 structural gaps**,
and they are all of one kind: they live in the *design itself*, not in individual tests. Fixing them «in place» is
fighting symptoms: you fix one, another drifts. The new architecture (`playwright-e2e/`)
closes all seven **by design** — not through author discipline, but through the shape of the code. Hence the conclusion: **rewriting
onto the new arch. is more worthwhile than patching the old one.**

---

## 1. Map on a single screen

| Dimension | 🔴 Old (repo root) | 🟢 New (`playwright-e2e/`) |
|---|---|---|
| **Layout** | layer-first: `tests/` + `services/` + `pages/` + `fixtures/` — a single feature is smeared across 4 top-level folders | feature-first: `features/<feature>/` owns all layers (client/seeding/pages/fixtures/tests) |
| **Configs** | **4 files**: `playwright.config.ts` / `.api.ts` / `.ui.ts` / `.ui.cross-browser.ts` | **1 file** + `projects[]` (`api` / `frontoffice` / `backoffice`) |
| **Fixtures** | static classes (`AuthFixture`, `UIFixture`) — these are **not** Playwright fixtures | real `test.extend()` with auto-cleanup and worker-scope |
| **env access** | `process.env.X` scattered across 10+ places, no validation | one typed `core/config/env.ts`, validated at startup |
| **Test structure** | 3-lane: `scripts/` + `probes/` + `verify/` | flat `tests/{api,ui}` + tags `@smoke/@regression` |
| **Types** | `any` in API signatures | `ApiResponse<T>` on every method |

Detail: the team document `docs/20-engineering/testing-patterns.md:76` mentions «Two Playwright
configs» — but at the root there are actually **four** of them. So reality is even **worse** than was
recorded.

---

## 2. Main table: 7 gaps of the old → solution in the new → benefit

| # | 🔴 Gap in the old (evidence) | 🟢 How the new closes it | Benefit |
|---|---|---|---|
| **1. «Fixtures that aren't fixtures»** | `AuthFixture` is an ordinary class with a **static** token cache: `private static tokens: Map<UserRole, string>` (`fixtures/auth/auth.fixture.ts:28-29`). This is global mutable state for the whole process, not a Playwright fixture. The only reset is a manual `clearTokens()`. | Real `test.extend()`: `baseTest = base.extend(...)` with **worker-scoped** tokens (`playwright-e2e/fixtures/base.fixture.ts:36,42`), modular fixtures with auto `init→use→dispose` (`features/auth/fixtures.ts`). | Test isolation, guaranteed teardown, no state leakage between tests. |
| **2. Four configs instead of one** | `playwright.config.ts`, `.api.ts`, `.ui.ts`, `.ui.cross-browser.ts` at the root. Shared settings (timeout/retries/reporter/workers) are duplicated and **drift** (e.g. a different number of workers across files). | One `playwright.config.ts` + `projects[]` — `api` / `frontoffice` / `backoffice`, shared settings defined once (`playwright-e2e/playwright.config.ts`). | One source of truth, no drift, native project parallelism, the official Playwright pattern. |
| **3. 3-lane ceremony** | `scripts/` + `probes/` + `verify/` in every module. `scripts` are ts-node outside the runner (no fixtures/reporters/retries); `probes` and `verify` duplicate logic. A new contributor doesn't know where to put a test. | Flat `tests/{api,ui}` + tags `@smoke/@regression/@critical`; WIP lives in feature branches. Recorded in ADR `docs/30-decisions/2026-05-15-dmytro-drop-3-lane.md`. | No copy-paste between lanes, no «folder» ceremony, everything in one runner. |
| **4. Manual lifecycle + stale tokens** | Services are created manually: `new API()` → `.init()` → `.dispose()`; forget `dispose()` and you leak an `APIRequestContext`. Tokens live in a static Map for the whole process → one test can get a stale token from another. | The context is managed by the fixture: `init()`/`dispose()` in `BaseApiClient` (`playwright-e2e/core/http/BaseApiClient.ts:14,31`), called automatically inside the `use()` wrapper. | No leaked contexts, no stale tokens, tests need no manual cleanup. |
| **5. Page objects by hand** | `UIFixture` instantiates **8 page objects** on every login, even if a test needs 2 (`fixtures/ui/ui.fixture.ts:34-35` and again at :60, :97). A deep chain `BasePage → CommonComponents → …` with mutable state. Business logic and UI mechanics are mixed together. | A Page is a fixture (DI), only **what's needed** is instantiated; API composition in `seeding.ts` (without `page`) is separated from the Page (locators+actions, without `expect`): `features/auth/pages/LoginPage.ts` vs `features/expenses/seeding.ts`. | Less memory and less risk of stale state; a single `seeding` helper is reused in both API and UI tests. |
| **6. Shared mutable JSON state** | `workers.json` is read from **5+ files** (`tests/global-setup.ts`, `policies.spec.ts`, `policy-by-contract.spec.ts`, `policy-contract-matrix.spec.ts`, scripts). Parallel writes → race condition; if the file is missing, tests are **silently** skipped instead of failing. The seeder state (`seeded-state.json`) is run manually and goes stale easily. | Test data goes through **builders without HTTP** (`features/contracts/builders/CreateContractBuilder.example.ts`) and fixtures, not a shared file on disk. | No race conditions and no silent skips; data is declarative and reproducible. |
| **7. `any` + scattered `process.env`** | API signatures on `any`; `process.env.X` is read in 10+ places without validation — a typo `process.env.CLIENT_EMIAL` silently becomes `undefined` and fails deep inside a test. | `ApiResponse<T>` on every method (`core/types/api.types.ts`); one `requireEnv()` throws at startup with the key name (`core/config/env.ts:8,21`). | A typo in env **won't compile**; configuration errors are caught before the run, not in the middle of it. |

> All seven are not «dirty code in a couple of tests» but **properties of the design**: a static cache,
> multiple configs, layer-first layout, manual lifecycle. A pinpoint fix of one does not remove the
> cause — it lives in the shape of the framework.

---

## 3. Why patching = losing (a compressed fork)

| Patch the old (Plan B) | Migrate (Plan A) |
|---|---|
| 🔴 We fix symptoms; in a month the same gaps surface in a new place | 🟢 The arch. closes gaps **by design** — there's nothing to «surface» |
| 🔴 Drift of two architectures: the repo already has two `BaseAPI` and two fixture patterns — a contributor doesn't know which to inherit | 🟢 One canon: one `BaseApiClient`, one `test.extend()` pattern |
| 🔴 Manual porting is slow — it hits exactly the same rakes we're trying to walk away from | 🟢 We rewrite onto clean layers → the AI pipeline (orchestrator + sub-agents) actually helps |
| 🔴 AI only as an editor-assistant; custom agents for legacy still have to be invented, the payoff is in doubt | 🟢 Clean layers + types + graph = agents **have something to lean on** |
| 🔴 No self-learning loop — every change starts from scratch | 🟢 Graphify (code + memory graph, auto-rebuilt on commit) + gates G1–G8 work for us |

A detailed breakdown of both paths is in `03-plan-A-migration-2-weeks.md` and `04-plan-B-fix-current-2-weeks.md`.

---

## 4. Conclusion

The seven gaps of the old framework are **structural**: a static token cache, four configs, layer-first
layout, manual lifecycle, shared JSON state, `any`/`process.env` scattered around. They **cannot** be closed
with pinpoint fixes without rewriting the layers — and rewriting the layers in place is the same migration, just
on top of legacy inertia and the drift of two architectures.

The new architecture closes all seven **by design** and on top of that gives scalability and a foundation for
the AI pipeline and self-learning memory. **Recommendation — migration (Plan A), pilot — the `expenses` feature.**
