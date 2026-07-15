# playwright-e2e — RemotePass QA Automation Framework

Feature-first Playwright + TypeScript framework for the RemotePass platform — the primary home for all new test automation. This project lives as the `playwright-e2e/` folder **inside the legacy `test-framework` repository and is absorbing it**: the legacy suite at the repo root (`tests/modules/`, `services/api/`, 3-lane) is fully migrated here, reference-only, and shrinks until it can be deleted — never copy its patterns (see "Legacy framework" at the bottom).

- **Canonical reference feature:** `features/expenses/` (full layer set). `features/auth/` is a smaller secondary example.
- **Tests are keyed by user-facing feature, never by backend microservice** (ADR 2026-05-25). API clients are the only layer that may mirror service boundaries.
- **All committed artifacts are English-only**: code, comments, commits, branches, PRs, ADRs, team memory.

> **Hard scope rule:** work in this project writes only inside `playwright-e2e/`. All prohibitions and gates: [`GUARDRAILS.md`](GUARDRAILS.md).

## Entry point — two doors (cost routing)

Every task starts by picking a lane. When in doubt → `/orchestrate`.

| Lane | Command | Model | Gates | Use for |
|------|---------|-------|-------|---------|
| **Full machine** | `/orchestrate <task>` | opus (self-tiers sub-agents) | all — G5, G6, worktree, G8, CP-5 | planning / consequential engineering / multi-test batches |
| **Cheap direct** | `/do <task>` | sonnet (pinned) | none | trivial ops: run a read-only command, read a file, launch dashboard, quick status |

`/do` has a hard escape hatch: shared infra (`core/`, `fixtures/` base, `playwright.config.ts`, any `CLAUDE.md`), >1-test batches, or a HITL checkpoint (CP-5 push/PR) → it refuses and points to `/orchestrate`. Definitions: `.claude/commands/{do,orchestrate}.md`.

## Commands

```bash
npm test                     # all projects
npm run test:api             # API tests (project=api)
npm run test:ui:frontoffice  # front-office UI (opens Playwright UI mode)
npm run test:ui:backoffice   # back-office UI
npm run test:smoke           # @smoke only
npx playwright test features/expenses --project=api   # one feature

npm run typecheck            # tsc --noEmit (pre-commit gate G2)
npm run lint                 # full ESLint
npm run lint:arch            # architecture gate — boundaries + rules catalog (pre-commit)
npm run format               # prettier
npm run hooks:install        # git hooks: pre-commit tsc + lint:arch, post-commit graph rebuild

npm run dashboard            # migration dashboard (Streamlit, http://localhost:8501)
```

Tags in use: `@smoke`, `@regression`, `@critical`, `@deep`, `@slow` — run any subset with `--grep`.

## Layout & path aliases

```
core/                  # foundation — no domain knowledge
├── http/              # BaseApiClient (no-throw transport), assertOk/assertOkWithId
├── config/            # env.ts (typed env), endpoints.ts
├── types/             # ApiResponse<T> etc.
└── ui/                # BasePage (goto, toasts), routes.ts (ROUTES), components/ (Header, Sidebar)

fixtures/              # base.fixture.ts — worker-scoped auth (clientToken, contractorToken,
                       # contractorPage via localStorage injection); exported from @fixtures

features/<feature>/    # a feature owns ALL its layers:
├── api-client.ts      # 1 method = 1 endpoint, returns ApiResponse<T>
├── types.ts           # request/response shapes (no `any`)
├── constants.ts
├── builders/          # fluent test-data construction, no HTTP
├── seeding.ts         # stateless multi-step API composition (replaces Flow)
├── pages/             # POM, one screen each; frontoffice/ vs backoffice/
├── fixtures.ts        # DI of pages/clients + factory state-fixtures with cleanup
├── fixtures/          # static files (e.g. test-document.pdf)
└── tests/
    ├── api/                       # → project "api"
    └── ui/{frontoffice,backoffice}/  # → projects "frontoffice"/"backoffice"

utils/                 # logger (logVerbose), user-faker
eslint/ + tools/       # architecture gate: rules catalog + golden regression tests
docs/                  # team memory (see below)
.claude/               # agentic system (see below)
```

Features: admin, auth, client-registration, contracts, expenses, onboarding, time-tracking. Not every feature needs every file (e.g. `admin` is client+types only).

Path aliases (`tsconfig.json`): `@core/*`, `@fixtures` (+ `@fixtures/*`), `@features/*`, `@utils/*`. Legacy aliases `@services`/`@pages`/`@tests` do not exist here.

Single runner, single `playwright.config.ts` with `projects[]` (`api`, `frontoffice`, `backoffice`) — the test's folder decides its project (ADR 2026-05-15). Sandbox is shared and flaky under load: local workers capped at 4, 1 retry local / 2 in CI.

## Architecture — layer contract

**No Flow/Facade layer** (ADR 2026-06-17). Where logic lives:

| Kind of logic | Home | In the test? |
|---|---|---|
| One HTTP request | `api-client.ts` | no |
| Multi-step API composition | `seeding.ts` (owner feature) | no |
| Single-screen UI action | `pages/` (POM) | no |
| Test-data construction | `builders/` | no |
| Wiring + lifecycle + cleanup | `fixtures.ts` | no |
| Scenario + `expect` | the spec | yes — it IS the test |

**Authoritative contract (read before writing any layer):** [`docs/20-engineering/layer-responsibilities.md`](docs/20-engineering/layer-responsibilities.md). Composition recipes: [`docs/20-engineering/composition-patterns.md`](docs/20-engineering/composition-patterns.md). Compiling cross-feature example: `features/expenses/examples/canonical-composition.example.ts`.

### Client conventions (A/B/C + assertOk)

`BaseApiClient` **never throws on non-2xx** — negative tests assert status codes directly. Each method picks one convention on purpose (ADR 2026-06-30):

- **A — mutation:** returns a domain value; guards with `assertOk`/`assertOkWithId` from `@core/http/assertOk`. Never re-implement the guard inline. Also allowed for a precondition-read whose failure makes the test unrunnable.
- **B — read:** returns a mapped value, no guard (valid-empty results stay B).
- **C — raw `ApiResponse<T>`:** caller/test asserts status/body (negative tests, sign handshakes). Every C method carries the one-line marker comment `// convention C — raw ApiResponse; caller/test asserts; no assertOk.` (or once in the class header when the whole client is C).

**Logging:** transport (`HTTP <method> <url> → <status>`) is logged automatically by `BaseApiClient` — never duplicate it. A mutation with domain args logs **one semantic line**: `logVerbose('[ExpensesClient] addExpense contract=42 amount=99')`. No-arg mutations and reads may omit it; bare `'[Client] method'` lines are banned.

### Fixtures & seeding

- **Factory state-fixture pattern:** composition lives in `seeding.ts`; the fixture wraps it, tracks created ids, and deletes them on teardown — per-test cleanup, never end-of-run bulk delete (ADR 2026-06-19). One-off setup in a spec uses `try/finally`.
- **Naming:** worker-scoped login fixtures are `<feature>ClientAccount` — never a bare `clientAccount` (avoids `mergeTests` collisions).
- **Login reuse:** import `loginAsClientAccount` from `@features/auth/helpers`; never re-declare a login round-trip.
- **Cross-feature seeding:** import from the **owner feature** (the feature whose entity it produces), never copy. Dependency graph must stay acyclic — on a would-be cycle, move shared code to `core/` or inject via fixture.
- **Cross-feature tests:** combine fixtures with `mergeTests`.
- **Sentinel self-skip:** a state-fixture discovering a sandbox precondition may return `0`/`[]` when it's absent so the spec self-skips — document the sentinel in the fixture's JSDoc.

### Pages & tests

- Pages: locators + actions for **one screen**; navigate only via `this.goto(ROUTES.x)` from `BasePage` (ADR 2026-06-26), `logVerbose('<Page>.<method>')` on every action method, no `expect`, no API clients, toasts inherited from `BasePage`.
- Specs: arrange → act → assert; declare fixtures, no reusable logic, no `new`-ing pages/clients, no `fs`/Node built-ins.
- **Preconditions/postconditions via API, never by driving the UI** (ADR 2026-06-24). UI is exercised only for the behaviour under test.
- Rule of two: need it once → inline in the spec; second consumer → extract to its layer.

## Playwright rules

- Official Playwright docs are law (ADR 2026-05-15); when this repo deviates, challenge it.
- Web-first assertions, user-facing locators.
- `page.waitForTimeout` is banned and lint-enforced (WAIT-002, ADR 2026-06-25); the single sanctioned exception carries an explicit eslint-disable + `TODO(flaky)`.

## Environment (`.env`)

`ENV=<name>` selects `.env.<name>` (default `.env`). Typed access via `env` from `@core/config/env` — never `process.env` directly, never hardcoded URLs/credentials.

- **Required:** `API_BASE_URL`, `FRONTOFFICE_URL`, `BACKOFFICE_URL`, `CLIENT_EMAIL`/`CLIENT_PASSWORD`, `WORKER_EMAIL`/`WORKER_PASSWORD`, `TIME_TRACKING_API_URL` (separate AWS host).
- **Optional:** `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `E2E_SECRET_KEY` (bypasses the 10-per-5-min login throttle on sandbox — without it parallel runs hit 429), `ADMIN_LOGIN_KEY` (admin test-login: KYB approval, disable-2FA), `EOR_CONTRACT_ID`/`EOR_CONTRACT_REF`, `TT_FIXED_CONTRACT_ID`, `TT_WORKER_CONTRACT_ID`, `VERBOSE`/`DEBUG`.

Setup walkthrough: [`docs/20-engineering/local-setup.md`](docs/20-engineering/local-setup.md).

## Code & docs intelligence (Graphify) + gates

Full guide — servers, tools, CLI table, install gotcha: [`docs/20-engineering/graphify-guide.md`](docs/20-engineering/graphify-guide.md). The rules that bind every session in this project:

- Explore unfamiliar code/domain via `mcp__remotepass-qa__query_graph` (code + `docs/` team memory in one graph) **before** grepping. The graph suggests; **grep confirms** — never treat it as sole truth.
- Before editing shared infra: `get_neighbors` / `graphify affected "Symbol"`, then Grep cross-check (G5). Fan-in >15 → escalate.
- Before writing tests for a feature: query the **product graph** `mcp__remotepass-backend__query_graph` to understand the real backend.
- Before writing `api-client.ts`/`types.ts`: verify endpoint shape via `rp-search`/`rp-show` (G6). No guessing.
- Deterministic gates run via git hooks — pre-commit `tsc --noEmit` + `lint:arch`, post-commit graph rebuild. Never `--no-verify`.

## Agentic system

Project-scoped system in `.claude/`: **9 sub-agents** (Opus/Sonnet/Haiku tiers) + **6 skills**, built for the migration and staying for the cleanup/extension phases. Map, tiering, and end-to-end flow: [`.claude/README.md`](.claude/README.md); registry: [`docs/20-engineering/agentic-system-registry.md`](docs/20-engineering/agentic-system-registry.md).

- **HITL:** semi-autonomous — only **CP-5 (push/PR authorization)** is active; batches are self-selected (3–5 cap, G8) and logged to `dashboard/state/activity.jsonl` (`GUARDRAILS.md` §3).
- **Migration record:** `docs/test-migration/{inventory,progress}.json` — frozen history from the completed migration; `progress.json` is authoritative when they disagree.
- **Worktrees:** 1 agent = 1 worktree = 1 branch = 1 PR; `graphify prs --conflicts` before merging parallel work ([`docs/20-engineering/git-worktree-multi-agent.md`](docs/20-engineering/git-worktree-multi-agent.md)).

## Team memory (`docs/`)

Index: [`docs/MEMORY.md`](docs/MEMORY.md) (auto-generated — never edit by hand). Governance: [`docs/_meta/memory-rules.md`](docs/_meta/memory-rules.md). Capture via the personal `/rp-memory` skill (lives in `~/.claude/skills/`, writes to this repo's `docs/` via its configured `teamMemoryRoot`); approval-first, never auto-pushes. Skill authoring contract (SKILL.md frontmatter + body sections, `npm run lint:skills`): [`docs/_meta/skill-rules.md`](docs/_meta/skill-rules.md).

- `10-architecture/` design & plans · `20-engineering/` workflow & patterns · `30-decisions/` one ADR per file (`YYYY-MM-DD-<author>-<topic>.md`) · `40-domain/` product knowledge · `50-work-log/` **retired 2026-07-02, frozen**.
- **People Policy (ADR 2026-07-02):** professional attribution is allowed (who decided/owns/reviewed); personal circumstances are banned — including the fact *and* reason of any absence. Record the decision, not the availability.
- English-only; decisions that change how we build tests get an ADR in `30-decisions/`.

## Status (2026-07-02)

- **Migration: complete.** All 133 in-scope legacy tests resolved (migrated / rewritten / obsolete / blocked); scope was `main` only. History: `docs/test-migration/`, dashboard via `npm run dashboard`.
- **PR #160 approved** — cleared to merge as a separate folder; a temporary CI workflow follows post-merge.
- **Next: cleanup phase.** Migration deliberately deferred fixes behind greppable markers — close them now:
  `grep -rnE 'TODO\((flaky|selector|api-preconditions|cleanup|merge)\)' features/ core/ fixtures/` (~167 markers as of 2026-07-02)
  Flakes bracketed this way are inherited from the legacy flow, not regressions.

## Legacy framework (host repo — being absorbed)

This project lives inside the legacy `test-framework` repository — one git repo, shared history and hooks — and the flow is one-way: everything of value migrates **into** `playwright-e2e/`, and the legacy tree only shrinks from here until it can be deleted. The old 3-lane framework (`tests/modules/`, `services/api/`, `BaseAPI`, `AuthFixture`, `@services` aliases) and the standalone seeders (integration, payment/expense anomalies) at the repo root are already fully migrated: do not import from them, do not copy their patterns (ADR 2026-05-15), do not edit them from here (scope rule). Everything worth knowing about them is already inside this project: the legacy→new mapping in `docs/test-migration/` and the legacy client map in `docs/40-domain/legacy-service-map.md`.
