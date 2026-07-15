---
id: graphify-guide
name: graphify-guide
description: "How to use the Graphify knowledge graphs from playwright-e2e: two MCP servers (remotepass-qa = framework code + docs team memory, remotepass-backend = product code), always/never rules (graph suggests, grep confirms), CLI quick reference, install gotcha, rename history."
metadata:
  type: project
  category: engineering
  tags: ["graphify", "knowledge-graph", "mcp", "tooling", "discovery", "gates"]
  author: dmytro
  createdAt: 2026-07-02
---

# Graphify — Code & Docs Intelligence Guide

One knowledge graph indexes the whole monorepo — code **and** team memory (`docs/`: decisions, domain gotchas, engineering patterns) — at the repo root `graphify-out/graph.json` (committed). Queries surface code↔decision↔domain links in one pass.

Freshness is automatic: a post-commit git hook rebuilds the graph (AST-only, no LLM cost) — gate G1. Never instruct anyone to "remember to re-index".

## Two graphs, two MCP servers

| Server | Graph | Use for |
|---|---|---|
| `remotepass-qa` | this monorepo: framework code + `playwright-e2e/docs/` team memory | exploring framework code, past decisions, domain gotchas |
| `remotepass-backend` | RemotePass product code (backend + frontend org repos, node `repo` attr) — local mirror expected at `~/WebstormProjects/remotepass/` | understanding the real backend **before** writing tests for a feature |

Identical toolset per server: `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, `shortest_path`, `list_prs`, `get_pr_impact`, `triage_prs`. Registered in the root `.mcp.json`. (Servers renamed 2026-06-24 from `graphify`/`graphify-remotepass`; the CLI is still `graphify …`.)

## Always do

- Unfamiliar code or domain question → `query_graph({question})` **before** grepping — returns community-grouped results across code and docs.
- Before editing shared infra (`core/`, `fixtures/` base, `playwright.config.ts`): `get_neighbors` on the symbol (or CLI `graphify affected "Symbol" --depth 2`), then confirm the caller list with Grep — **the graph suggests; grep confirms** (G5). Fan-in >15 inbound dependents → escalate (`GUARDRAILS.md` §3).
- Before writing/porting tests for a feature: `mcp__remotepass-backend__query_graph({question})`. CLI fallback: `graphify query --graph ~/WebstormProjects/remotepass/graphify-out/graph.json "<question>"`. Refresh the product mirror with `~/WebstormProjects/remotepass/refresh-graph.sh`.
- Symbol details → `get_node`; connection between two concepts → `shortest_path`; hub detection → `god_nodes`.
- Renames: IDE/LSP rename or Grep over **all** occurrences; verification is `tsc --noEmit` + affected tests (G2/G3) — the compiler catches broken callers deterministically.

## Never do

- Never treat the graph as the sole source of truth — confirm caller lists with Grep before destructive edits (stale-graph lesson, 2026-06).
- Never find-and-replace a rename without `tsc --noEmit` + affected tests afterwards.
- Never commit when the pre-commit `tsc` gate fails; `--no-verify` requires an explicit human decision.
- Never bypass CP-5: pushes/PRs need `graphify prs --conflicts` checked for merge-order risk with parallel worktrees.

## CLI quick reference

| Task | Command |
|------|---------|
| "How does X work?" (code + docs) | `graphify query "<question>"` |
| Blast radius / "what breaks if I change X?" | `graphify affected "Symbol" --depth 2` |
| Plain-language node explanation | `graphify explain "Symbol"` |
| Connection between two concepts | `graphify path "A" "B"` |
| Re-extract changed files manually | `graphify update .` (the hook does this on commit) |
| PR dashboard / impact / merge-order conflicts | `graphify prs` · `graphify prs <N>` · `graphify prs --conflicts` |
| Interactive visualization / audit report | open `graphify-out/graph.html` / `graphify-out/GRAPH_REPORT.md` (repo root) |

## Install gotcha

The MCP server needs the `[mcp]` extra: `uv tool install "graphifyy[gemini,mcp]"`. Without it the server crashes on start — symptom: `Failed to reconnect to graphify: -32000`.

## History

- 2026-06-12 — migrated GitNexus → Graphify; gate-system redesign G1–G8 rationale: [`../30-decisions/2026-06-12-migrate-gitnexus-to-graphify.md`](../30-decisions/2026-06-12-migrate-gitnexus-to-graphify.md).
- 2026-06-24 — MCP servers renamed to `remotepass-qa` / `remotepass-backend`; CLI name unchanged.
