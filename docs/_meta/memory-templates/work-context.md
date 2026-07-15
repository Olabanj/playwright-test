---
name: work-context
description: Current focus, active repositories, ongoing constraints. Refreshed weekly. Loaded by orchestrator at session start.
metadata:
  type: project
---

# Work context

## Current focus

- _Primary: migrating legacy RemotePass test suite into `playwright-e2e/`._
- _Secondary: building the agentic system that drives the migration._

## Active repositories

- `playwright-e2e/` (new framework — single write target)
- legacy `test-framework/` root (read-only; cataloged in the Graphify graph)

## Constraints

- _Writes happen only inside `playwright-e2e/` — hard rule._
- _Team memory English-only (see `docs/_meta/memory-rules.md`)._
- _3-5 tests per migration batch._
- _Shared-infra edits serialised across worktrees._

## Tooling

- Graphify MCP active (`graphify` server in root `.mcp.json`); graph at `graphify-out/graph.json` (3,262 nodes / 5,949 edges / 197 communities, first indexed 2026-06-12; counts drift as the hook rebuilds). Cross-repo queries are default.
- RemotePass API specs via `rp-search` / `rp-show` / `rp-list`.
- Live dashboard at `playwright-e2e/docs/test-migration/dashboard/` on `http://localhost:8501`.

## Last refreshed

`2026-05-25`
