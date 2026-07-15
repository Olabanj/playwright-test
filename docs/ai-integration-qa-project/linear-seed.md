# Linear seed — Project «AI Integration into QA Processes»

> Paste-ready content for a NEW Linear project (separate from the framework rewrite/migration project).
> Created because direct Linear MCP creation could not complete OAuth in this session — paste manually,
> or have Claude create it from an interactive desktop/IDE session where the localhost OAuth redirect works.
> Content language: English (per decision). Scope note: **"Remove Flow layer" is NOT part of this project**
> — it belongs to the framework/architecture track.

---

## Project

**Name:** AI Integration into QA Processes

**Summary / description:**

> Integrate AI into our QA and developer workflows — incrementally. We roll this out in small chunks so
> the team can try each piece, learn it, and move on, while the larger agentic system keeps evolving in
> the background. North star: move from using Claude for one-off micro-tasks → to a full agentic flow
> (multi-agent + knowledge base + self-learning).
>
> Rollout principle: ship one chunk, let the team use and learn it, then ship the next. Avoid dumping the
> whole machine on everyone at once.

**Milestones (phases):**

1. **Phase 1 — Single-purpose skills** (manual, no knowledge base). Narrow tools a person invokes by hand.
2. **Phase 2 — Compose skills → agent.** Once ≥3 skills exist, wrap them into one agent.
3. **Phase 3 — Knowledge base / memory.** Plug in the Graphify graph + lessons memory so the agent
   understands the repo and learns from external feedback (test output / reviewer), not self-judgment.
4. **Phase 4 — Multi-agent / orchestrator + HITL.** Full agentic flow: orchestrator + sub-agents +
   gates + a self-learning loop in CI.

---

## Issues to create

### 1. QA assistant: suggest required test types from Linear + diff
- **Milestone:** Phase 1
- **Labels:** `phase-1`, `dev-facing`
- **Description:**
  A developer-facing assistant that, given a Linear issue (requirements) and the code changes (diff),
  suggests which test types the feature needs — unit / integration / e2e — and why.
- **Acceptance criteria:**
  - Input: a Linear issue reference + a diff/PR.
  - Output: a short recommendation — test types + rationale + suggested cases.
  - Runs as a Claude skill/command.
  - No knowledge base required yet.

### 2. Claude skill: write e2e tests from a pasted test case (Playwright MCP + CLI)
- **Milestone:** Phase 1
- **Labels:** `phase-1`, `e2e`
- **Description:**
  A Claude skill/agent that writes Playwright e2e tests from a manually pasted test case. No knowledge
  base yet — relies only on the test case + Playwright MCP + CLI.
- **Acceptance criteria:**
  - Input: a pasted test case.
  - Uses Playwright MCP to explore and Playwright CLI to run.
  - Output: a runnable spec; iterates until green.
  - Documented how to invoke.

### 3. Agentic flow roadmap (living doc) — North star
- **Milestone:** meta / North star
- **Labels:** `roadmap`
- **Description:**
  The north-star roadmap: micro-tasks → agentic flow (the 4 phases above). Living document, updated as
  the project expands. Links to the milestones.

---

## Expansion model (how we add tasks later)

- Each new skill = a new issue under **Phase 1**.
- When 3+ skills exist → a **Phase 2** issue: "wrap skills into an agent".
- Then **Phase 3**: "add knowledge base / memory".
- Then **Phase 4**: "orchestrator / multi-agent".
- New tasks are added via Claude as we go; the project grows chunk by chunk.

**Not in this project:** "Remove Flow layer" (framework/architecture track).
