# Plan A — full migration to the new architecture (RECOMMENDED)

**Summary:** we adopt the new feature-first architecture as the target and launch the agentic pipeline,
rebuilding legacy tests by intent (not line-by-line). Over 2 weeks: finish the foundation, run the
`expenses` pilot end-to-end, then scale out.

**Definition of Done (2 weeks):**
- N green migrated tests (the `expenses` pilot + ≥1 scale-out feature).
- A reproducible agentic pipeline with active HITL gates (CP-3, CP-5).
- A green CI smoke-lane on the new architecture.

---

## Week 1 — foundation + pilot

### 1. Activate the orchestrator's HITL
- Enable CP-3 (batch plan approval) and CP-5 (push/PR authorization) via `AskUserQuestion`.
- Verify that the orchestrator actually **stops** at these points.
- Files: `playwright-e2e/.claude/agents/personal-engineering-orchestrator.md`, `GUARDRAILS.md`.

### 2. Harden `core` to parity with legacy (driven by real features)
The new `core/http/BaseApiClient.ts` is concise, but it lacks what legacy `BaseAPI` has and what
live modules will need:
- retry on transient 429/5xx for idempotent GETs;
- `postMultipart` / `postUrlEncoded` (file uploads, forms — the same expenses needs this for receipts);
- a timeout variant of the request for slow endpoints;
- a fix for parsing an empty response body (currently parsing errors can be masked).
- Files: `playwright-e2e/core/http/BaseApiClient.ts` (target), `services/api/common/BaseAPI.ts` (logic donor).

### 3. Domain types and the worker fixture
- Move the needed domain types into `core/types` (or reference the source explicitly) — a single source of truth.
- Add the missing **worker-scoped login fixture** (worker role) to `fixtures/base.fixture.ts`.

### 4. `expenses` pilot end-to-end through the agentic pipeline
- Run the full pipeline: `inventory → scenario → architecture-mapping → page-object/fixture →
  migration → stabilization → review`.
- Batch limit — G8 (3–5 tests). Create `features/expenses/` (client / builder / fixtures / pages /
  tests) per the mapping in `docs/test-migration/architecture-mapping.md`.
- Green `npm run typecheck` + a run of the specs. Merge via CP-5.
- Outcome of the week: the `expenses` feature is green on the new architecture, and the pipeline has been run end-to-end.

---

## Week 2 — scale + guardrails

### 5. Parallel batches in isolated worktrees
- Launch the next 1–2 features (candidates: `invoices` — 13 tests; `contracts` — 25 tests) in
  separate git worktrees (1 agent = 1 worktree = 1 branch = 1 PR).
- Before merging — `graphify prs --conflicts` for a safe ordering (no two agents on shared
  infrastructure in parallel).

### 6. ESLint boundary rules
- Forbid cross-architecture imports (a test in `playwright-e2e/features/*` does not import from the root
  `services/`/`tests/`, and vice versa). Layer boundaries are caught automatically.

### 7. CI smoke-lane (first target)
- Stand up a smoke run (`@smoke`) on the new architecture as the first CI target.
- Files/context: `docs/20-engineering/ci-cd-for-automation.md`.
- **The self-improving CI loop — a target beyond the 2-week horizon** (planned, not firmly scheduled, but it
  must exist): merged PR → auto graph rebuild → `get_pr_impact` → selection of affected tests →
  run → coverage grows. The smoke-lane is the first brick of this loop.

### 8. Bring the documentation in line
- Update the root `CLAUDE.md` so that it describes the **new** architecture as the current one (right now it
  describes the legacy 3-lane).

---

## Risks and how the system mitigates them

| Risk | Mitigation |
|------|-----------|
| The agent edits shared infrastructure blindly | G5: discovery via the graph + grep confirmation before editing |
| A test is generated against a nonexistent endpoint | G6: cross-check against the API spec (`rp-search`/`rp-show`) |
| A large uncontrolled batch | G8: limit of 3–5 tests; `git diff --stat` against the approved plan |
| Broken imports/types after generation | G2: `tsc --noEmit` in pre-commit; G3: green verify tests before commit |
| Conflict between parallel PRs | `graphify prs --conflicts` before CP-5 |
| False/flaky tests | stabilization-agent: root-cause, without deleting a test just to make it "green" |
| An incorrect architectural decision | qa-architect + CP-3 (a human approves the plan) |

---

## Why this is faster than porting

- We take only the intent → we don't drag along someone else's helpers, implicit dependencies, and legacy flakiness.
- The AI generates against a clear template (the shape of the `auth` module) → high speed while preserving quality.
- The graph + gates provide **safety without manually controlling every step**.
- Each migrated feature enriches the graph → the next one goes faster (the self-improving loop).
