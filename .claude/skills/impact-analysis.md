---
name: impact-analysis
description: >
  Risk gate before editing shared infrastructure — base fixtures, core/, _common/,
  playwright.config.ts, base API client. Uses Graphify reverse traversal + Grep to classify
  upstream dependents; final verification is tsc + tests. Use before editing anything under core/
  or base fixtures, before renaming/changing a public client or Page Object method, or when a
  "small refactor" touches something used in multiple modules.
metadata:
  owner: dmytro
  capability: code-intelligence
  status: active
  linear: null
  eval:
    status: none
    ref: null
    lastPassRate: null
    lastRun: null
---

# Impact Analysis

## Purpose

Shared abstractions have non-obvious blast radii. A "small" fixture tweak can break twelve unrelated specs. This skill classifies the risk of a proposed edit and recommends a safer path when the risk is high. Discovery comes from the Graphify graph; **verification of the actual edit is deterministic — `tsc --noEmit` (G2) and affected tests (G3)**, not a graph call.

## Trigger

- Editing any file under `core/`, `fixtures/` (base auth), `_common/`, or `playwright.config.ts`.
- Renaming or changing the signature of an API client method, a Page Object public method, a shared Flow, or a builder.
- Removing or adding a fixture key that other modules already consume.
- The user or another agent proposes a "small refactor" to anything used in multiple modules.

## Inputs

- Target file or symbol.
- Proposed change (one or two sentences).

## Procedure

1. Discovery: run `graphify affected "Symbol" --depth 2` (CLI, reverse traversal over calls/imports/inherits/references) or `mcp__graphify__get_neighbors` (inbound). The graph spans legacy + `playwright-e2e/` + docs/ — all matter even if only the new repo is edited.
2. **Grep cross-check (mandatory):** confirm the dependent list with `Grep` over both repos. The graph suggests; grep confirms — count from the union of both.
3. Count dependents. Classify:
   - **Low (0-3 dependents, single module)** — proceed with the change; mention the dependents in the PR description.
   - **Medium (4-15 dependents OR cross-module)** — preserve the public surface. Add a new method/key alongside the old one; deprecate the old in a separate commit. Run `npm run test:smoke` before merging.
   - **High (16+ dependents OR change to base auth / `core/config/env.ts` / `playwright.config.ts`)** — STOP. Escalate via `clarification-protocol` (HITL ad-hoc trigger), open a design note in `docs/30-decisions/`, list all dependents, propose either a feature flag, a non-breaking extension, or sequencing into a separate infrastructure batch.
4. For any High change: orchestrator must serialise — no other agent edits shared files in parallel until this one merges. Check `graphify prs --conflicts` for open PRs sharing the affected communities. See `docs/20-engineering/git-worktree-multi-agent.md`.
5. Surface every cross-repo dependent explicitly. Migration agents must know if a planned change in `playwright-e2e/` would have required a matching change in the legacy code (which we will not make, but must be aware of).
6. Recommend a safer alternative when risk is Medium or High: add-instead-of-replace, behind a typed enum extension, behind a constructor parameter default, etc.
7. After the edit lands (separate step, not this skill): `tsc --noEmit` must be clean and affected verify-lane tests green — the compiler catches broken callers the graph cannot guarantee.

## Outputs

- Target, proposed change, dependent count (graph + grep union), risk level (low/medium/high).
- List of dependents grouped by repo and module; related docs/ decisions if the graph surfaced any.
- Recommendation: proceed / proceed with extension / stop and design.
- Required validation level (single spec / smoke / full regression).
- No file writes (this skill is read-only — writes happen after the orchestrator approves the plan).

## Tools & MCPs

- `remotepass-qa` MCP (Graphify) — `get_neighbors` inbound, or CLI `graphify affected "Symbol" --depth 2`.
- Built-in tools: `Grep` (mandatory cross-check), `Bash` (`graphify prs --conflicts`, later `tsc --noEmit`).

## Examples

- **Invoke:** proposal to change the `BaseApiClient` constructor signature → **Outcome:** `graphify affected "BaseApiClient"` + Grep union counts 20+ dependents → classified High, STOP, escalate via `clarification-protocol`, recommend a non-breaking extension.

## Evaluation

none — pending QA-283.

## Guardrails

- Editing `core/`, `fixtures/`, or `playwright.config.ts` without calling this skill first.
- Renaming a public API client method on graph data alone — run the Grep cross-check, then verify with `tsc --noEmit` + tests after the change.
- Classifying a multi-module fixture change as "low risk" because it compiles locally.
- Ignoring legacy-side dependents because "we don't edit legacy" — the dependent count drives whether the change is safe at all.
- Skipping the `add-instead-of-replace` pattern when count > 3 and a deprecation step would unblock parallel agents.
- Letting two agents work on shared infra in parallel worktrees. One at a time, full stop.
