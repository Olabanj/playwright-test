---
id: agent-audit-2026-06-23
name: agent-audit-2026-06-23
description: "Audit of the 17-agent + ~9-skill migration system before mass migration. Conclusion: the system is well-factored — keep all units, the apparent overlaps are superficial (shared tier/tools, not shared responsibility) and the separations are deliberate. Only playwright-test-planner is archived (out-of-charter, orphaned, non-functional here). No merges."
metadata:
  type: decision
  category: agents
  status: accepted
  author: dmytro
  createdAt: 2026-06-23
  tags: ["agents", "audit", "migration", "workflow-vs-agent", "orchestrator-workers", "evaluator-optimizer"]
---

# Agent audit (2026-06-23) — keep the system as-is, archive only the planner

## Context

Before starting the mass legacy→feature-first migration we audited every agent and
skill to answer: is each one needed? do any overlap enough to merge? should any be
removed? Method: independent structured read of all 17 agents + ~9 skills, a
synthesis pass that proposed merges/removals, then an **adversarial verification
pass** that tried to refute each merge/removal proposal.

## Decision

**Keep the system essentially unchanged.** The synthesis pass was merge-happy; the
adversarial pass overturned almost every merge/removal it proposed. The recurring
finding: the apparent overlaps are **superficial** (two agents share the Opus tier
and the graphify tools, or the phrase "fix tests") while their **responsibilities
are distinct and the separations are deliberate** (confirmation-bias isolation,
context-size hygiene, team-vs-personal firewall, built-in vs custom).

### Migration backbone (orchestrator-workers)

```
orchestrator → test-inventory → scenario-extraction → architecture-mapping
→ page-object-fixture → playwright-migration → stabilization → migration-reviewer
```

Discovery (graphify), `progress-tracking`, and memory are **cross-cutting services**
invoked along the chain, not stages.

### Evaluator-optimizer loop

Generator = `playwright-migration-agent` (+ `stabilization-agent` fixing failures);
Critic = `migration-reviewer-agent` (runs `review-checklist` + `test-run`, marks
`failed_review`, which re-feeds the migrator). The reviewer **must** stay a separate
agent/turn from the migrator to avoid confirmation bias. `architecture-mapping` ↔
`qa-architect` form a second, outer adjudication loop.

### Verdicts (after adversarial review)

- **Keep, unchanged:** orchestrator, test-inventory, scenario-extraction,
  architecture-mapping, qa-architect, page-object-fixture, playwright-migration,
  stabilization, migration-reviewer, repo-intelligence, personal-memory,
  docs-knowledge, daily-work-assistant, english-explanation; all skills
  (review-checklist, impact-analysis, test-run, clarification-protocol,
  summary-generation, progress-tracking, memory-update, memory-read, graphify-query).
- **Rejected merges** (proposed by synthesis, refuted on review):
  - qa-architect → architecture-mapping: rejected — producer↔escalation boundary, not
    duplicated authority; merging creates a self-review (rubber-stamp) problem.
  - repo-intelligence → graphify-query skill: rejected — the agent returns a distilled
    ≤300-word summary in an isolated context; a skill would dump raw traversals into
    the caller's context.
  - personal-memory + docs-knowledge: rejected — team-vs-personal firewall + opposite
    write disciplines (append-only-supersede vs edit-in-place).
  - impact-analysis → graphify-query: rejected — impact-analysis is the risk gate
    (0-3/4-15/16+ thresholds, HITL escalation, worktree serialisation) absent from the
    general query router.
- **Rejected removals:** daily-work-assistant (reads source-of-truth, produces the
  resume view, keeps the Opus orchestrator lean), english-explanation (the only
  non-English-input → English-artifact seam for ADRs/PRs/work-logs),
  playwright-test-healer & playwright-test-generator (built-in Claude Code Playwright
  MCP agents — live-browser capability the custom agents lack; do not modify).
- **Archived (the one action):** `playwright-test-planner` — see below.

### playwright-test-planner → archived

Moved to `docs/_meta/archived-agents/`. Reasons (the adversarial pass corrected the
synthesis's weak "overlaps scenario-extraction" rationale):
1. **Out of charter** — it authors NEW coverage by exploring a live app; migration
   ports the EXISTING test surface (main specs) via scenario-extraction.
2. **Orphaned** — zero references anywhere; not in the orchestrator chain.
3. **Non-functional here** — its `mcp__playwright-test__*` server is not registered in
   `.mcp.json`.
It is a generic built-in (not custom), so the archived copy is preserved verbatim and
may legitimately return in the post-migration AI-Agentic ladder (QA-281…304).

### Non-action: registry "double entries"

The synthesis flagged test-inventory / scenario-extraction "double listings". On
inspection these are the registry's **table row + prose paragraph** (intentional doc
structure), not duplication. No dedup — per the audit's own lesson, do not fix a
non-problem.

### Bonus: the "14-agent system" vs 17 files discrepancy

Reconciled: planner/generator/healer are **built-in Claude Code Playwright agents**,
not custom — they inflate the file count above the documented 14 custom units.

**Why:** A mass migration amplifies whatever structure the agents have. Verifying the
factoring first (cheaply, before porting 342 tests) prevents either over-merging away
a needed safety boundary or carrying dead weight. The adversarial pass is what made
the audit trustworthy — it caught that most "overlaps" were superficial.

**How to apply:** Treat the 8-agent backbone + the evaluator-optimizer loop as the
migration engine. Do not merge the reviewer into the migrator, the architect into
the mapper, or the memory routers into each other — those separations are load-bearing.
When tempted to merge two agents, check whether the overlap is *responsibility* or
merely *shared tier/tools*; only the former justifies a merge. Revisit planner/
generator/healer (and exploratory test authoring) only after the migration, in the
AI-Agentic phase.
