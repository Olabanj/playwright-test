---
id: 9197542f-f442-5407-9746-835c74d87ed2
name: agentic-migration-system-status
description: "Status of the local agentic migration system: designed, Graphify indexed against legacy repo, dashboard live, migration completed 2026. Post-migration (QA-281) the system was pruned to 9 custom agents + 6 skills; migration-only agents and the memory/progress skills were retired."
metadata:
  type: project
  category: engineering
  tags: ["agentic-system", "migration", "graphify", "dashboard", "orchestrator", "claude-code"]
  author: dmytro
  createdAt: 2026-05-26T08:00:00Z
  updatedAt: 2026-07-02T12:50:07Z
  expiresAt: null
---

# Agentic migration system — status as of 2026-05-26

## What is built
> **Post-migration update (QA-281, 2026-07-07):** the system was pruned once the migration completed — **9 custom agents** and **6 skills** remain. Five migration-only agents (`test-inventory-agent`, `scenario-extraction-agent`, `architecture-mapping-agent`, `personal-memory-agent`, `daily-work-assistant`) and the three memory/progress skills (`memory-read`, `memory-update`, `progress-tracking`) were retired; team-memory capture now runs via the personal `/rp-memory` skill. See [[agentic-system-registry]] for the current map. The counts below describe the original as-built system for historical context.

- **14 specialised agents** designed in `.claude/agents/` — see [[agentic-system-registry]] for the current per-agent map (roles, tier, tools).
- **8 skills** in `.claude/skills/` covering memory read/update, graphify-query, progress-tracking, test-run, impact-analysis, review-checklist, summary-generation.
- **Graphify** indexed against the legacy `test-framework` repo — graph at `graphify-out/graph.json` (3,262 nodes / 5,949 edges / 197 communities, first indexed 2026-06-12; counts drift as the hook rebuilds) — agents can query the legacy call graph before porting any test, instead of grepping blind. *(Updated 2026-06-12: GitNexus replaced by Graphify, see `docs/30-decisions/2026-06-12-migrate-gitnexus-to-graphify.md`.)*
- **Migration dashboard** at `docs/test-migration/dashboard/` (Streamlit on `localhost:8501`) — live progress, per-feature status, build progress, designed so multi-day pauses do not lose context.
- Single source of truth: `docs/test-migration/{inventory,progress}.json` — written during migration via the (now retired) `progress-tracking` skill; frozen history since migration completed.
- Worktree workflow: one agent = one worktree = one branch = one PR; shared-infra edits serialised. See [[git-worktree-multi-agent]].

## Where it lives
- Branch `ai-memory-code-1`, not yet pushed to main.
- Effort: ~3 hours per agent during design.

## Plan
- Migration kick-off: **week of 2026-06-01**, after the Eid + Egypt holiday window.
- Start with one feature (likely time-tracking — already the reference module on the new framework) ported end-to-end as the proving run.
- Roman is in parallel using a similar agentic approach to extract microservices from the monolith — see [[sandbox-api-architecture]]. Patterns should converge where it makes sense.

## Known gaps (must address before kick-off)
- **No Human-in-the-Loop clarification protocol in the orchestrator.** Agents can mark tests `blocked` / `failed_review` but there is no active push to the user when ambiguity is encountered; no `AskUserQuestion` integration; no autonomy threshold. Will be added before real migration starts.
- Dashboard does not yet alert on stuck batches — manual polling for now.

## How to apply
- Do not use the system on real migration until the HITL gap is addressed.
- When a teammate joins the migration, point them at this file first, then `agentic-system-registry.md`, then the dashboard URL.
- Status updates here: append a dated section rather than overwriting — this is the trace of how the system matured.
