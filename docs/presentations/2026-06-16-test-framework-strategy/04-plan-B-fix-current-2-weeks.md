# Plan B — stay in legacy and fix in place (NOT recommended)

**The crux of the fork:** we do not go through the migration, but instead continue working in the current legacy 3-lane repository
(root: `tests/`, `services/api/`, `fixtures/`) and fix it in place. This plan is needed as an honest
comparison — what we would do **first** if we chose this path.

> ⚠️ I do not recommend this path. The reasons are at the end of the document. But if we choose it, here are the priorities.

**Definition of Done (2 weeks):**
- The confusion of two architectures is removed (one base class, one fixture pattern).
- Basic quality gates in legacy (pre-commit `tsc` + lint).
- The next priority set of tests is ported into the existing 3-lane structure.

---

## Week 1 — put what we have in order

### 1. Untangle the confusion of two architectures (the main thing)
Right now the repo has two base classes and two fixture patterns — a new contributor does not know what
to inherit:
- `services/api/common/BaseAPI.ts` (466 lines, battle-hardened) **vs** `playwright-e2e/core/http/BaseApiClient.ts`.
- `fixtures/auth/auth.fixture.ts` (static methods) **vs** `playwright-e2e/fixtures/base.fixture.ts`.
- Decision for Plan B: lock in **legacy** as the single canon, freeze/remove the new
  `playwright-e2e/` from active development, document "how to add a module" in the legacy style.

### 2. Dedup and standardization
- Consolidate duplicates: endpoints (`utils/constants/api-endpoints.constants.ts`), domain types
  (`utils/types/*`), base classes.
- Lock in a single 3-lane style (scripts / probes / verify) and a single page object pattern.

### 3. Basic quality gates
- Add pre-commit `tsc --noEmit` + ESLint in legacy (right now the new part has none, legacy has them partially).

---

## Week 2 — stabilization and porting

### 4. Fix flaky patterns
- Go through the unstable spots (fragile selectors, manual waits, best-effort cleanup via the UI).
- Strengthen data cleanup via API instead of UI deletion.

### 5. Finish off coverage
- Close the missing UI coverage in priority features within the existing structure.

### 6. Porting the next tests
- Port the next priority set of tests into the current 3-lane structure — predominantly by hand.

### About AI in this scenario (an important caveat)

In Plan B, AI **does not disappear entirely** — but its role changes:

- It remains **in the form of a subscription assistant** (Copilot / Claude in the editor): hints, autocomplete,
  generation of code snippets on request. It helps you write faster, but it is **not** a full-fledged agentic system
  with an orchestrator, gates, and memory.
- To get closer to Plan A, we would have to **think through custom agents** for the legacy structure.
  The open question is **how exactly they would help**: without clean layers, typing, and a graph, they have almost nothing
  to lean on, so the payoff is in question and still has to be proven.
- There is no self-learning loop here (graph ↔ CI ↔ impact) — the assistant does not "understand" the repository, it merely
  answers individual requests.

---

## Why I do NOT recommend this

| Downside | Consequence |
|-------|-------------|
| **Tech debt accumulates** | We fix symptoms, not the structure; in a month, the same problems again |
| **Drift of two architectures** | Either we freeze the clean new one (losing what we invested), or we drag both along |
| **Manual porting is slow** | We run straight into the very pitfalls of legacy that we are trying to get away from |
| **AI — only as a subscription** | An assistant in the editor, not an agentic system; custom agents still have to be thought through, the payoff is in question |
| **No self-learning loop** | The graph/memory do not work for us; every change starts from scratch |
| **No quality growth over time** | The architecture does not improve; scaling = more tech debt |

**Conclusion:** Plan B provides a short-term "cleanup", but it does not change the trajectory. Plan A requires a bit more
investment up front (Week 1 — the foundation), but it delivers scalability, speed via AI, and a
self-learning system. I recommend **Plan A**, with the `expenses` feature as the pilot.
