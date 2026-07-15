---
name: graphify-query
description: >
  Project wrapper over Graphify (knowledge graph of code + docs). Adds RemotePass-specific rules —
  cross-repo queries by default, write-scope hard-rule, graph-suggests-grep-confirms. The graph
  rebuilds automatically on commit. Use before touching shared infrastructure (G5), when starting
  migration of a feature, when renaming/extracting symbols, when debugging where a legacy helper is
  consumed, or to check whether a domain quirk is already documented.
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

# Graphify Query (project wrapper)

## Purpose

The whole monorepo is indexed by Graphify into one knowledge graph at `graphify-out/graph.json` (~3,260 nodes, 197 communities). The graph covers the legacy framework, `playwright-e2e/`, **and `playwright-e2e/docs/` team memory** (decisions, domain gotchas, scenarios, work-log incidents) in a single store — every migration question can be answered with one cross-repo, cross-layer query. Freshness is automatic: a post-commit git hook re-extracts changed files (AST-only, no LLM cost).

## Trigger

- About to touch shared infrastructure: `core/`, `fixtures/`, `playwright.config.ts`, `_common/`, base API client, any cross-module abstraction (this is gate **G5 — discovery-before-edit**).
- Starting migration of a feature — locate every reference to that domain in legacy code AND related decisions/gotchas in docs/.
- Renaming or extracting symbols that exist in either repo.
- Debugging where a legacy helper is consumed and what its modern equivalent should be.
- Checking whether a domain quirk (OTP bypass, payment lifecycle, tracker-vs-manual payloads…) is already documented before re-discovering it.

## Inputs

- Query intent (one sentence): "find all references to OTP", "what depends on AuthFixture.loginAsClient", "trace contract creation flow".
- Optional: target symbol, traversal depth, edge-relation filter.

## Procedure

1. Pick the right tool:
   - Concept / "how does X work" / domain question → `mcp__graphify__query_graph({question})` or CLI `graphify query "<question>"`.
   - Full detail on one symbol → `mcp__graphify__get_node({label})`; its connections → `mcp__graphify__get_neighbors`.
   - **Blast radius / who depends on X** → CLI `graphify affected "Symbol" --depth 2` (reverse traversal over calls/imports/inherits/references) or `get_neighbors` inbound. This feeds the `impact-analysis` skill.
   - Route between two concepts → `mcp__graphify__shortest_path` or CLI `graphify path "A" "B"`.
   - Hubs / most-connected symbols → `mcp__graphify__god_nodes`; functional area overview → `get_community`; index sanity → `graph_stats`.
   - PR questions → `list_prs`, `get_pr_impact`, `triage_prs`, or CLI `graphify prs [--conflicts|--triage]`.
   - Plain-language explanation of a node → CLI `graphify explain "Symbol"`.
   - **Product graph (RemotePass backend + frontend)** → query the real product to understand the backend you are testing, BEFORE porting/mapping a feature or writing a client: `graphify query --graph ~/WebstormProjects/remotepass/graphify-out/graph.json "<question>"` (AST-only; nodes carry a `repo`/layer attr). Use it for "how does the <feature> flow work in the backend", endpoint ownership, model/field shapes. Refresh if stale (>7 days): `~/WebstormProjects/remotepass/refresh-graph.sh`. The product graph **suggests**; the API spec (`rp-show`) and grep **confirm** — never write a client off the graph alone.
2. Apply project rules on top of any output:
   - **Graph suggests; grep confirms.** Before any destructive edit, confirm the caller list from the graph with `Grep` over the workspace. The graph is never the sole source of truth.
   - **Write-scope hard-rule:** even when the graph reveals an issue in legacy code, do not edit it. All writes land in `playwright-e2e/` only.
   - **Cross-repo + cross-layer queries are the default** for migration work — never narrow to one repo unless explicitly asked; docs/ results (decisions, gotchas) are first-class citizens, cite them.
   - **Freshness:** the post-commit hook rebuilds the graph; manual refresh only after non-committed bulk edits — `graphify update .` from the monorepo root.
3. Fallback: if the MCP server is unreachable, use CLI (`graphify query/affected/explain/path`) via Bash; if that also fails, fall back to `Grep`/`Glob`, warn that results are partial, and re-attempt MCP once `graph_stats` responds.

## Outputs

- A short report: which tool was used, the query, the key findings (≤7 bullets, citing `source_location` for facts), any follow-up action recommended.
- No file writes.

## Tools & MCPs

- `remotepass-qa` MCP (Graphify code + docs graph): `query_graph`, `get_node`, `get_neighbors`, `shortest_path`, `god_nodes`, `get_community`, `graph_stats`, `list_prs`, `get_pr_impact`, `triage_prs`.
- `remotepass-backend` MCP (product graph) for backend-flow questions.
- CLI fallback via `Bash` (`graphify query/affected/path/explain/prs`); last-resort `Grep`/`Glob`.

## Examples

- **Invoke:** "what depends on `AuthFixture.loginAsClient`" before renaming it → **Outcome:** `graphify affected` lists dependents across legacy + playwright-e2e + docs; report cites `source_location`s and reminds to Grep-confirm before editing.

## Evaluation

none — pending QA-283.

## Guardrails

- Editing legacy code because the graph showed a smell there. Write-scope is `playwright-e2e/` only.
- Treating graph output as verification. Verification of an edit is `tsc --noEmit` + affected tests (gates G2/G3); the graph is for discovery.
- Using `grep` as the primary discovery tool when the graph is available — you lose docs/ context and community grouping. (But always grep-confirm before edits.)
- Narrowing queries to one repo and losing cross-repo insight — the single store is the whole point.
- Re-discovering a documented domain gotcha because you only queried code — docs/ is in the graph; ask for it.
