# Archived agents

Agent definitions removed from the active set (`.claude/agents/`) but preserved
verbatim here in case they return.

**Currently: none.** (`playwright-test-planner` was archived 2026-06-23 by the agent
audit, then un-archived 2026-06-24 — it is used with generator/healer to heal
failing migrated tests via the live-browser Playwright MCP.)

To archive an agent: `git mv .claude/agents/<name>.md docs/_meta/archived-agents/<name>.md`,
remove it from `docs/20-engineering/agentic-system-registry.md`, and record why here.
