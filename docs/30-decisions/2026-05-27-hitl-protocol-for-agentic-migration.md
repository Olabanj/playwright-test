---
id: 480f8b0c-9814-5185-9902-40f04fe35b8b
name: hitl-protocol-for-agentic-migration
description: "Adds a Human-in-the-Loop protocol to the 14-agent migration system: five mandatory checkpoints (CP-1…CP-5), a shared clarification-protocol skill, and a phased rollout starting with CP-3 (Batch Plan Approval) and CP-5 (Push/PR Authorization). Closes the HITL gap recorded in personal memory before the migration kick-off in the week of 2026-06-01."
metadata:
  type: decision
  category: process
  status: accepted
  supersedes: []
  tags: ["agentic-migration", "hitl", "guardrails", "orchestrator", "process", "safety"]
  author: dmytro
  createdAt: 2026-05-27T00:00:00Z
  updatedAt: 2026-05-27T00:00:00Z
  expiresAt: null
---

# Human-in-the-Loop Protocol for the Agentic Migration System

> Updated 2026-06-12: GitNexus replaced by Graphify — tool/trigger references below updated accordingly; see `2026-06-12-migrate-gitnexus-to-graphify.md`.

## Decision

The 14-agent migration system gets an explicit Human-in-the-Loop (HITL) protocol with five mandatory checkpoints. The protocol is enforced by `personal-engineering-orchestrator` and `migration-reviewer-agent`, formatted by a new `clarification-protocol` skill, and listed as `GUARDRAILS.md` §3.

Rollout is phased:

- **Phase 1 — active immediately (before migration kick-off on the week of 2026-06-01):** CP-3 (Batch Plan Approval) and CP-5 (Push / PR Authorization).
- **Phase 2 — activated after the first migration wave lands:** CP-1 (Inventory Review), CP-2 (Architecture Gap), CP-4 (Review Failure Escalation).

All five checkpoints are documented now in `personal-engineering-orchestrator.md` §HITL Protocol; CP-1, CP-2, CP-4 are marked `[DEFERRED]` until Phase 2 begins.

## Why

1. **The gap was real and tracked.** The personal-memory entry `hitl-gap-agentic-migration.md` flagged the absence of an HITL protocol with the deadline "week of 2026-06-01". The migration is about to start; the protocol must exist before the first batch runs.
2. **Pre-factum gates beat post-factum reviews.** The system already has `migration-reviewer-agent` as a quality gate, but it fires *after* work lands. CP-3 and CP-5 inject the human at the two points where intent and irreversibility matter most — before delegation, and before push.
3. **A single shared format keeps HITL low-noise.** Without `clarification-protocol`, each agent would phrase questions differently and the user would learn five dialects. One template (Context → Decision → Options → Recommendation) keeps cognitive load flat.
4. **Phased rollout avoids a chatty start.** Five active checkpoints from day one would feel intrusive and train the user to skim. Starting with CP-3 + CP-5 covers the two highest-cost mistakes (wrong batch, wrong push) while keeping the orchestrator silent on routine plumbing.
5. **GUARDRAILS centralises the rules.** Before this decision, the agent's *what-not-to-do* was spread across `.claude/README.md`, `docs/_meta/memory-rules.md`, `docs/20-engineering/git-worktree-multi-agent.md`, and `review-checklist.md`. `GUARDRAILS.md` collapses the hard prohibitions and high-risk operations into one agent-facing document.

## Checkpoint list (canonical)

| Code | Trigger | Phase 1 status |
|---|---|---|
| CP-1 | After `test-inventory-agent` produced an `inventory.json` slice | DEFERRED |
| CP-2 | After `architecture-mapping-agent` reports missing builders/seeding/fixtures/clients | DEFERRED |
| CP-3 | Before `playwright-migration-agent` is delegated a 3–5 test batch | **ACTIVE** |
| CP-4 | After `migration-reviewer-agent` returns ≥3 FAILED or any CRITICAL severity | DEFERRED |
| CP-5 | Before `git push` or `gh pr create` | **ACTIVE** |

Plus four always-active ad-hoc triggers (not numbered, listed in `GUARDRAILS.md` §3):

- Memory and observed code conflict.
- Discovery shows fan-in >15 inbound dependents on the symbol to be edited (`graphify affected` / `get_neighbors`).
- A decision is required that no existing ADR covers.
- A non-trivial worktree merge conflict.

## What is intentionally NOT HITL

Avoiding HITL noise is part of the design. The following stay autonomous:

- Reading files, running queries, invoking skills, writing summaries.
- Calling `progress-tracking` after a status change — that is a gate, not a decision.
- Creating a worktree, checking out a branch, committing locally (push is the boundary, not the commit).
- Running `test-run`, `graphify-query`, `impact-analysis`, `rp-search`, `rp-show`.
- Returning `FAILED_REVIEW` for a single item — only ≥3 or any CRITICAL escalates.

## How to apply

- **Orchestrator:** halts at CP-3 and CP-5 in Phase 1. The HITL section of `personal-engineering-orchestrator.md` is authoritative.
- **Reviewer:** the `Decision` step now references CP-4; even in Phase 1 (CP-4 deferred), the reviewer records the trigger condition in the work-log so the threshold can be tuned before Phase 2.
- **Any agent:** when in doubt, invoke `clarification-protocol`. Do not improvise a question format.
- **User:** answers are logged to `docs/50-work-log/<date>.md`. If an answer reveals a durable rule, `personal-memory-agent` files an ADR.

## Phase 2 activation criteria

Phase 2 turns on CP-1, CP-2, CP-4 when **all** of the following hold:

1. At least one full feature has been migrated end-to-end through Phase 1.
2. The user has seen at least three CP-3 invocations and at least one CP-5 invocation and reports the format works.
3. No open work-log issue points at HITL noise (too many questions, wrong granularity).

When the criteria are met, update `GUARDRAILS.md` §3 and the orchestrator's HITL Protocol to remove the `[DEFERRED]` markers, and write a follow-up ADR recording the activation date and any threshold tweaks (e.g. the FAILED count for CP-4).

## References

- `playwright-e2e/GUARDRAILS.md` §3 — canonical list of high-risk operations.
- `playwright-e2e/.claude/agents/personal-engineering-orchestrator.md` §HITL Protocol — checkpoint definitions and invocation format.
- `playwright-e2e/.claude/agents/migration-reviewer-agent.md` — CP-4 trigger condition.
- `playwright-e2e/.claude/skills/clarification-protocol.md` — question template.
- Personal-memory note `hitl-gap-agentic-migration.md` — the gap this ADR closes.
- `2026-05-18-dmytro-mandatory-architecture-review.md` — adjacent decision establishing pre-batch review gates.
