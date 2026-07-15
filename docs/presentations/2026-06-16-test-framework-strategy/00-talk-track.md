# Talk-track — what to say on each slide

> Numbering is 1:1 with the file `test-framework-strategy.pptx` (12 slides, including the title and final slides).
> On each slide: **"Say"** — the text to be spoken, **"Show"** — what to open on screen.
> The same talking points are in the speaker notes of the .pptx itself (presenter mode).

---

## Slide 1 — Title  "Test Framework Strategy"

**Say:**
- In short: I'll walk through where we're heading with the automated tests and why exactly this way.
- I joined the team ~a month ago. Today — the strategy, two 2-week plans, and a short workshop.

**Show:** the title slide.

---

## Slide 2 — Where I am now (context)

**Say:**
- A month ago — onboarding.
- Over the next two weeks I deliberately gathered information: studied the **legacy framework**, the **new
  repository**, all the documentation, and the structure of the **backend**.
- Goal of the meeting: show the direction and justify it; give two plans; run a workshop.

**Show:** the repository structure (root + `playwright-e2e/`).

---

## Slide 3 — What we have today: two architectures

**Say:**
- The repository effectively contains **two architectures at once**:
  - **Legacy 3-lane** (root) — hundreds of working tests, run today; battle-hardened, but accumulating tech debt.
  - **New feature-first** (`playwright-e2e/`) — clean, with the reference `auth` module ready (API + UI).
- The question for this meeting: what do we do with these two going forward.

**Show:** side by side, `services/api/common/BaseAPI.ts` and `playwright-e2e/core/http/BaseApiClient.ts`.

---

## Slide 4 — Thesis: don't port, rebuild

**Say:**
- A line-by-line port of the legacy is slow and full of pitfalls.
- The better approach is **architecture from scratch** and rebuilding the tests on it with AI. This is faster than porting.
- From the old code we take **only the flow / intent** (what the test verifies).
- Then the system: verifies that the **flows work**, and **cross-checks against the backend** that the flow is valid.

**Show:** `docs/test-migration/scenarios/expenses.md` — an example of "intent" without code.

---

## Slide 5 — Agentic system for writing automated tests

**Say:**
- A single **orchestrator** (Opus) takes an intent phrase and breaks it down into a pipeline.
- The pipeline: `inventory → scenario → architecture-mapping → page-object/fixture → migration →
  stabilization → review`.
- Under the orchestrator — sub-agents organized in tiers (Opus architects / Sonnet workers / Haiku utilities).
- Each agent is a separate human-readable file, which you can open and read.

**Show:** `playwright-e2e/.claude/agents/` — open `personal-engineering-orchestrator.md`.

---

## Slide 6 — Three layers of safety gates

**Say:**
- The system doesn't write blindly. Three layers of protection:
  - **G1–G3 — automatic** (impossible to forget): graph rebuild on commit, `tsc`, green verify tests.
  - **G5–G8 — agent procedures**: discovery (graph + grep), cross-check against the API spec, batch limit of 3–5.
  - **HITL**: a human approves the batch plan (CP-3) and authorizes push/PR (CP-5).
- **Why there is no G4** (in case the question comes up): G4 was the former gate "do an impact-analysis before any
  edit." In the 12.06 redesign it was **removed**: for TypeScript, the compiler + tests (G2+G3) give the same
  signal deterministically, and the narrow remainder (only for shared infrastructure) was folded into G5. The numbers
  G5–G8 were **not renumbered**, so as not to break references across dozens of files — which is why in G4's place
  an intentional "hole" remains. It's a marker of a decommissioned gate, not a mistake.
- The principle: **the graph suggests, grep confirms**.

**Show:** `playwright-e2e/GUARDRAILS.md` §2 (three layers of gates).

---

## Slide 7 — Self-learning memory (Graphify)

**Say:**
- Memory is not just data. It's **one graph**, covering **both the code and the team memory**
  (decisions, domain, scenarios).
- **Ready right now:** the graph is built; a git hook rebuilds it on every commit; **the entire RemotePass
  backend is indexed** — Graphify understands the product code, you can ask it before writing a
  test.
- **The CI self-learning loop — still planned** (not certain, but it definitely should exist): a PR is merged → the graph
  is updated → an impact query → we understand which tests to run → coverage grows → the next migration is
  faster. This is the target we're working toward.

**Show:** the root `CLAUDE.md` (Graphify section) + `graphify-out/`.

---

## Slide 8 — Status: done / in progress / next

**Say — Done:**
- The new architecture is **proven by the `auth` module** (API + UI).
- A single config with `projects[]` — one runner.
- 14 agents + skills, GUARDRAILS and HITL gates.
- The Graphify graph (~3.26k nodes) + auto-rebuild; **the entire backend is indexed**.
- The legacy is inventoried: 681 tests / 7 features; scenario docs + mapping for the pilots.

**In progress:** hardening `core` (retry/multipart/timeouts); the first migration batch at scale; CI/CD design.
**Next:** the `expenses` pilot end-to-end → scaling; the CI self-learning loop (target).

**Show:** `docs/test-migration/progress.md`.

---

## Slide 9 — Architecture by layers

**Say:**
- Small building blocks organized by layers — scale **without losing quality**.
- Bottom to top: **Core → Clients/Builders → seeding/Pages → Fixtures → Tests**.
- The SOLID / DAG principle: **core knows nothing about the tests; the tests know about core**; dependencies only point downward.
- **One framework**: the same seeding helpers/Clients are reused in API and UI; one runner — Playwright.

**Show:** `01-architecture-rationale.md` (the layer diagram + the imports table).

---

## Slide 10 — Workshop: from a test case to an automated test

**Say:**
- I'll show the chain on the small `expenses` feature:
  legacy test → scenario (intent) → mapping (plan) → artifacts by layers → run.
- This is exactly what the agentic pipeline does, just step by step.

**Show:** switch to `02-workshop-test-case-to-autotest.md`, open the files from the list.

---

## Slide 11 — Two forks for the 2 weeks

**Say:**
- **Plan A (recommended):** migration — new architecture + agentic pipeline. Week 1 — foundation +
  the `expenses` pilot; week 2 — scale + CI smoke-lane.
- **Plan B (not recommended):** we stay in the legacy and fix it in place. AI in this case **stays, but only
  as a subscription assistant** (Copilot/Claude), not a full-fledged agentic system; custom agents still
  need to be thought through — and it's unclear how much they'll help in the old structure. Plus tech debt accumulates and
  there's no self-learning loop.

**Show:** `03-plan-A-migration-2-weeks.md` and `04-plan-B-fix-current-2-weeks.md` side by side.

---

## Slide 12 — My ask

**Say:**
- I'm asking for a **go-ahead on Plan A**. The pilot — the `expenses` feature, end-to-end through the agentic pipeline.
- Plan A requires a bit more up front (the foundation), but it delivers scale, AI-driven speed, and a
  self-learning system.

**Show:** the final slide.
