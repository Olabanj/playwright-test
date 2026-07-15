# 2026-06-12 — Migrate code intelligence from GitNexus to Graphify; redesign safety gates

**Author:** Dmytro
**Status:** Accepted
**Supersedes:** GitNexus-gate wording in earlier docs; complements `2026-05-27-hitl-protocol-for-agentic-migration.md`.

## Decision

Replace GitNexus with **Graphify** (https://github.com/safishamsi/graphify) as the code-intelligence layer for the agentic migration system, and redesign the safety gates from "prose instructions agents must remember" to a **three-layer model**: deterministic automation first, agent procedures second, HITL third.

## Why

1. GitNexus served discovery well, but its strongest guarantees lived in prose ("MUST run impact analysis before editing any symbol", "MUST run detect_changes before committing"). Documented incidents show prose gates get skipped: stale graph after forgotten `gitnexus analyze`, a 22k-LOC PR violating the 3–5 batch rule, semantic merge conflicts between parallel worktree agents discovered only at merge time.
2. Graphify indexes **docs/ alongside code** in one graph. Two recurring failure classes — re-discovering documented domain gotchas (OTP client/worker asymmetry, tracker-vs-manual payloads) and losing decision context — are addressed by making team memory queryable next to the code it governs.
3. For a TypeScript codebase, `tsc --noEmit` + affected tests are a stronger, deterministic impact gate than any graph traversal: broken callers fail compilation. The graph's job shrinks to what it is good at — discovery and cross-layer context.

## Tool mapping

| GitNexus | Graphify replacement |
|---|---|
| `gitnexus_query` | `mcp__graphify__query_graph` / CLI `graphify query` |
| `gitnexus_context` | `get_node` + `get_neighbors` |
| `gitnexus_impact` | `graphify affected "Symbol"` / `get_neighbors` (discovery) + Grep cross-check; **verification = tsc + tests** |
| `gitnexus_detect_changes` | post-commit hook rebuild (G1) + `git diff --stat` vs batch plan (G8) + `get_pr_impact` at CP-5 |
| `gitnexus_rename` | LSP/Grep rename; safety net = `tsc --noEmit` + affected tests (G2/G3) |
| `npx gitnexus analyze` | automatic post-commit hook; manual: `graphify update .` |
| 7 global gitnexus skills | built-in `/graphify` skill + project skill `.claude/skills/graphify-query.md` |

## Gate redesign (G1–G8)

**Layer 1 — automatic (cannot be forgotten):**
- **G1 Graph freshness** — `graphify hook install` rebuilds the graph on every commit/checkout (AST-only, free).
- **G2 Compile-gate** — `.git/hooks/pre-commit` runs `tsc --noEmit` for `playwright-e2e/` when staged `.ts` files are present; failing types block the commit.
- **G3 Test-gate** — affected verify-lane tests green before a batch is committed (existing `test-run` skill).

**Layer 2 — agent procedures:**
- **G5 Discovery-before-edit** — before shared-infra edits: `query_graph`/`get_neighbors`/`graphify affected`, then Grep cross-check. *The graph suggests; grep confirms.*
- **G6 API-spec-gate** — `rp-search`/`rp-show` before `client.ts`/`types.ts` (unchanged).
- **G7 Memory-first** — `memory-read` before architectural work (unchanged); reinforced by docs/ being in the graph.
- **G8 Batch cap** — 3–5 tests per batch; `git diff --stat` must match the approved batch plan before commit.

**Layer 3 — HITL (unchanged checkpoints, sharpened inputs):**
- CP-3 rejects batches >5 tests or shared-infra edits without a G5 write-up.
- CP-5 requires `graphify prs --conflicts` (merge-order risk between parallel worktrees) and `get_pr_impact` attached.
- Ad-hoc escalation: fan-in >15 inbound dependents on a symbol to be edited (replaces the old "impact returns CRITICAL" trigger).

**Removed:** the blanket "MUST run impact analysis before editing ANY symbol" rule. For TS, compiler + tests give the same signal deterministically; mandatory graph calls remain only for shared infra. Less ritual → higher compliance.

## Lessons → gates traceability

| Past incident | New mechanism |
|---|---|
| Stale graph (forgotten re-index) | G1 automatic hook |
| 22k-LOC PR, duplicated Playwright builtins | G8 + CP-3 hard rejection |
| 6 semantic merge conflicts in time-tracking review | `graphify prs --conflicts` before merging worktrees |
| Payment-methods cleanup broke downstream specs | "clean up only resources your own spec created" (GUARDRAILS §1) + review-checklist item 13 |
| OTP asymmetry / tracker-vs-manual re-discovered repeatedly | docs/ indexed into the graph; `query_graph` surfaces gotchas |
| Risky renames | G2 compiler gate replaces `gitnexus_rename` |

## Operational facts

- Graph location: monorepo root `graphify-out/graph.json` (committed; `cost.json`, `cache/`, machine-local files gitignored).
- MCP server `graphify` registered in root `.mcp.json` (`graphify-mcp <path-to-graph.json>`), tools: `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, `shortest_path`, `list_prs`, `get_pr_impact`, `triage_prs`.
- First index 2026-06-12: 3,262 nodes / 5,949 edges / 197 communities (2,640 AST code nodes + ~620 semantic nodes from 204 docs).
- Doc semantic extraction runs through Claude Code session subagents (no API key cost); code extraction is local tree-sitter.

## Trade-offs accepted

- No symbol-level "execution flows" view (GitNexus processes) — communities + `shortest_path` + Mermaid `export callflow-html` cover the need.
- No graph-aware rename tool — compiler + tests are the accepted (stronger) substitute for TypeScript.
- Doc extraction freshness is manual-ish: AST hook covers code; semantic re-extraction of changed docs runs via `/graphify . --update` when docs change materially.
