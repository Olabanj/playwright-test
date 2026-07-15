---
id: b6063296-152c-5893-be7f-3cda5407bf9c
name: agentic-system-registry
description: "Registry of CUSTOM Claude Code agents and skills added to playwright-e2e/.claude/ — distinguishes them from built-in Playwright agents, the built-in Graphify skill, and other globally installed skills"
metadata:
  type: reference
  category: engineering
  tags: ["claude-code", "agents", "skills", "registry", "agentic", "migration"]
  author: dmytro
  createdAt: 2026-05-25T18:00:00Z
  updatedAt: 2026-07-07T00:00:00Z
  expiresAt: null
---

# Agentic System Registry

## What this file is

A registry of the **custom Claude Code agents and skills** added to `playwright-e2e/.claude/` to drive the migration of the legacy RemotePass test suite into this feature-first Playwright framework. It exists so a teammate opening the repo can immediately tell which agents and skills were added by us versus which came from Claude Code itself, from Graphify, or from other globally installed skill packages.

This document is a reference index, not a tutorial. For the operating model see:

- `playwright-e2e/.claude/README.md` — system overview, model tiering, cross-cutting rules.
- `playwright-e2e/docs/test-migration/README.md` — batch workflow, statuses, multi-day resume.
- Project root `CLAUDE.md` (code-intelligence section) — Graphify MCP server (`graphify` in root `.mcp.json`) and the built-in `/graphify` skill.

---

## Custom agents (9)

All custom agents live in `playwright-e2e/.claude/agents/`. Every file begins with YAML frontmatter declaring `name`, `description`, `model`, and an explicit `tools` allow-list. Five migration-only agents (`test-inventory-agent`, `scenario-extraction-agent`, `architecture-mapping-agent`, `personal-memory-agent`, `daily-work-assistant`) were retired in QA-281 once the migration completed.

| Name | Model | Trigger summary | File |
|---|---|---|---|
| personal-engineering-orchestrator | opus | Any non-trivial engineering instruction for the new framework | [agents/personal-engineering-orchestrator.md](../../.claude/agents/personal-engineering-orchestrator.md) |
| qa-architect-agent | opus | Architectural ambiguity, novel pattern choice, ADR drafting | [agents/qa-architect-agent.md](../../.claude/agents/qa-architect-agent.md) |
| test-reviewer-agent | opus | Pre-merge gate; runs the 13-item review-checklist on any new/changed test | [agents/test-reviewer-agent.md](../../.claude/agents/test-reviewer-agent.md) |
| repo-intelligence-agent | sonnet | Cross-repo mapping via Graphify; find duplicates and prior art | [agents/repo-intelligence-agent.md](../../.claude/agents/repo-intelligence-agent.md) |
| test-authoring-agent | sonnet | Author a 3-5-test batch into a feature-first module | [agents/test-authoring-agent.md](../../.claude/agents/test-authoring-agent.md) |
| page-object-fixture-agent | sonnet | Create missing clients/types/seeding/pages/builders/fixtures | [agents/page-object-fixture-agent.md](../../.claude/agents/page-object-fixture-agent.md) |
| stabilization-agent | sonnet | Root-cause flaky/failing tests; classify test/abstraction/product/env | [agents/stabilization-agent.md](../../.claude/agents/stabilization-agent.md) |
| docs-knowledge-agent | haiku | Keep `docs/` and `CLAUDE.md` in sync with code reality | [agents/docs-knowledge-agent.md](../../.claude/agents/docs-knowledge-agent.md) |
| english-explanation-agent | haiku | Rewrite text from another language or technical jargon as clear professional English | [agents/english-explanation-agent.md](../../.claude/agents/english-explanation-agent.md) |

### Architect tier (opus)

**personal-engineering-orchestrator.** Top-level coordinator. Receives a one-sentence user intent ("add expense tests", "continue from yesterday", "what's left") — possibly in another language — and turns it into the right sequence of specialist invocations, in the right model tier, in isolated worktrees where appropriate. Enforces every cross-cutting gate (Graphify discovery, API-spec, worktree isolation, CP-5). Never writes tests itself — always delegates. The only agent that should be invoked directly by the user; every other agent is reached through this one.

**qa-architect-agent.** Owns the architectural integrity of `playwright-e2e/`. Invoked sparingly — only when work hits a genuine architectural ambiguity (two patterns plausibly apply, a new abstraction is proposed, a binding decision is needed). Writes ADRs directly to `docs/30-decisions/`. Resists premature abstraction — "three concrete consumers, then abstract" is the operative rule.

**test-reviewer-agent.** Read-only pre-merge gate. Re-runs the 13-item `review-checklist` skill on every new or changed spec with fresh eyes and either approves or marks the offending tests `failed_review`. Intentionally a separate agent — and ideally a separate Claude turn — to avoid author confirmation bias.

### Worker tier (sonnet)

**repo-intelligence-agent.** Read-only. Delegates exploration to the built-in `/graphify` skill and the raw MCP tools (`query_graph`, `get_node`, `get_neighbors`, `shortest_path`, `get_community`). Cross-repo queries by default — the single monorepo-wide graph spans legacy, `playwright-e2e/`, and the `playwright-e2e/docs/` team memory in one store, so code↔decision↔domain queries resolve in one pass.

**test-authoring-agent.** The load-bearing authoring worker. Produces new spec files under `features/<domain>/tests/{api|ui}/` following the layer contract. Mantra: express intent, not implementation. Three-to-five tests per batch.

**page-object-fixture-agent.** Builds the missing abstractions a batch needs — clients, types, seeding helpers, page objects, builders, fixtures — strictly within the feature-first layout. Mirrors `features/expenses/` as the canonical file shape. Returns `ApiResponse<T>`, separates locators from assertions, keeps seeding helpers in the owner feature.

**stabilization-agent.** Runs tests, captures traces, root-causes failures, classifies them as test bug / abstraction bug / product bug / environment instability, and acts accordingly. Never deletes a test to silence a failure — a genuinely broken test goes to `blocked` with a documented blocker.

### Utility tier (haiku)

**docs-knowledge-agent.** Keeps `docs/`, `CLAUDE.md`, and per-module READMEs in sync with code reality. Extends existing docs over creating new ones; cross-links ADRs and pattern docs.

**english-explanation-agent.** Pure language translation — text in another language or technical jargon into clear professional English for PR descriptions, ADR bodies, Slack messages, and standup updates. Preserves technical identifiers verbatim. No code changes.

---

## Custom skills (6 — 5 project helpers here + clarification-protocol)

All custom skills live in `playwright-e2e/.claude/skills/`. Skills are prose-only instructional documents (per project memory rule "skill design: prefer instructions over scripts"). Three migration/memory skills (`memory-read`, `memory-update`, `progress-tracking`) were split out to the user's personal `~/.claude/skills/` in QA-281; team-memory capture now runs via the personal `/rp-memory` skill.

| Name | Purpose | File |
|---|---|---|
| graphify-query | Project wrapper over the built-in `/graphify` skill + CLI; adds cross-repo + write-scope rules | [skills/graphify-query.md](../../.claude/skills/graphify-query.md) |
| test-run | Pick smallest meaningful validation: lint → typecheck → single spec → smoke → regression | [skills/test-run.md](../../.claude/skills/test-run.md) |
| impact-analysis | Pre-edit risk gate for shared infrastructure (core/, fixtures/, playwright.config.ts) | [skills/impact-analysis.md](../../.claude/skills/impact-analysis.md) |
| review-checklist | 13-item quality gate enforced by `test-reviewer-agent` | [skills/review-checklist.md](../../.claude/skills/review-checklist.md) |
| summary-generation | Fixed 8-section end-of-turn report; ≤300 words; every agent ends with this | [skills/summary-generation.md](../../.claude/skills/summary-generation.md) |
| clarification-protocol | HITL question template for the CP-5 checkpoint and ad-hoc escalations | [skills/clarification-protocol.md](../../.claude/skills/clarification-protocol.md) |

**graphify-query.** Thin wrapper over the built-in `/graphify` skill and the `graphify` CLI (`graphify query/affected/explain/path/prs`). Adds project-specific rules on top: cross-repo queries are the default, writes only land in `playwright-e2e/`. Graph freshness is automatic — the post-commit/post-checkout git hooks rebuild the graph (gate G1); manual refresh only for uncommitted bulk edits: `graphify update .`. Does NOT duplicate the built-in skill's content.

**test-run.** Picks the smallest meaningful validation that gives confidence: lint and typecheck first (seconds), then single-spec runs (`npx playwright test <file>`), then smoke (`npm run test:smoke`), then full regression. Surfaces traces and videos from `test-results/`. Hands failures back to the caller — fixes belong to `stabilization-agent`.

**impact-analysis.** Risk gate before editing shared infrastructure. Uses `graphify affected "Symbol"` (CLI) or `mcp__graphify__get_neighbors` inbound to count dependents — then confirms the caller list with Grep (the graph suggests; grep confirms) — and classifies risk as low (0-3 deps), medium (4-15), or high (16+ or core/auth-base touched). Fan-in >15 inbound dependents escalates to HITL. For medium and high risk, recommends add-instead-of-replace patterns and serialisation across worktrees.

**review-checklist.** The 13 items enforced verbatim: no `waitForTimeout`, stable locators (no `nth-child`), `expect` only in tests, independent tests, no credentials in code, `mergeTests` for cross-module composition, owner-feature seeding rule, fixtures over `beforeAll`, types in `types.ts`, no `process.env` outside `core/config/env.ts`, test intent documented, G5 discovery (`graphify-query`/`impact-analysis`) before shared-file edits, and `npm run lint:arch` green. Failing any item flips the test status to `failed_review`.

**summary-generation.** Fixed 8-section template (Goal · Work completed · Files changed · Commands executed · Progress updated · Blockers · Risks · Next step). Capped at 300 words. Every agent ends with this so the orchestrator can chain decisions without re-reading transcripts.

---

## NOT custom — already-installed pieces

These are present in the project and referenced by the custom system, but were NOT added by us. **Do not rename or modify them** — the custom agents and skills depend on them by name.

### Built-in Playwright agents (came with Claude Code)

| Name | What it does |
|---|---|
| playwright-test-planner | Create comprehensive Playwright test plans for a web application |
| playwright-test-generator | Generate Playwright test code from a planned test case |
| playwright-test-healer | Debug and fix failing Playwright tests |

These ship with Claude Code's Playwright integration. The custom system intentionally does not duplicate their function — when the user needs raw Playwright test generation against a live browser via MCP, those agents are the right tool. The custom `test-authoring-agent` is purpose-built for authoring feature-first specs using the repo's layer patterns + Graphify, and consciously avoids the live-browser path.

> **Note (un-archived 2026-06-24):** `playwright-test-planner` was briefly archived by the 2026-06-23 agent audit, then restored — it is used (with generator/healer) to investigate/heal failing migrated tests via the live-browser MCP. Their `mcp__playwright-test__*` server **is** registered (in `playwright-e2e/.mcp.json`); the audit's "not registered" note checked the wrong .mcp.json. To use these agents, run Claude Code from `playwright-e2e/` so it loads that MCP config.

### Built-in Graphify skill and CLI

The seven global GitNexus skills were retired with the 2026-06-12 migration (see `docs/30-decisions/2026-06-12-migrate-gitnexus-to-graphify.md`). Their place is taken by the built-in `/graphify` skill plus the `graphify` CLI (`graphify query/affected/explain/path/prs`). The MCP server is named `graphify` (root `.mcp.json`) and exposes: `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, `shortest_path`, `list_prs`, `get_pr_impact`, `triage_prs`.

The graph lives at `graphify-out/graph.json` (3,262 nodes / 5,949 edges / 197 communities, first indexed 2026-06-12; counts drift as the hook rebuilds). It now includes the `playwright-e2e/docs/` team memory (decisions, domain gotchas, work-log incidents), so code↔decision↔domain queries resolve in one pass. Freshness is automatic — post-commit/post-checkout git hooks rebuild the graph (gate G1).

The custom skill `graphify-query` is the project's thin wrapper — it delegates to the built-in skill/CLI and adds RemotePass-specific rules.

### Other globally installed skills

These appear in the available-skills list during sessions but are not part of the migration system. Listed here so readers understand what is and is not migration-related.

| Skill | Source | Purpose |
|---|---|---|
| rp-search · rp-show · rp-list · rp-help · rp-refresh | `rp-scribe` CLI (personal install at `~/.claude/bin/rp-scribe`) | Look up RemotePass API endpoint specs from Scribe HTML docs |
| rp-memory · memory-read · memory-update · progress-tracking | Personal skills (`~/.claude/skills/`; split out of the repo in QA-281) | Capture/read durable RemotePass QA knowledge to team or personal memory; migration progress tracking |
| meeting-memory · onboarding-memory · morning-digest | Personal skills (`~/.claude/skills/`) | Capture meeting/onboarding outcomes; daily context sweep |
| claude-finish | Personal skill (`~/.claude/skills/`) | Wrap-up workflow (push memory branches, open PRs) |
| update-config · keybindings-help · fewer-permission-prompts | Built-in helpers | Configure Claude Code settings, keybindings, permissions |
| verify · simplify · loop · schedule · run · init · review · security-review | Built-in helpers | Generic Claude Code workflow skills |
| claude-api | Built-in helper | Build / debug / migrate Claude API + Anthropic SDK code |

These remain available to the user at all times; the custom system does not depend on them, but `test-authoring-agent` and `page-object-fixture-agent` use `rp-search` / `rp-show` for the API-spec-gate.

---

## Cross-cutting gates

Every custom agent enforces three gates. The skill files contain the operative procedures; this section is the audit trail.

1. **Graphify-gate (G5, discovery-before-edit).** Touching legacy code or shared abstractions runs discovery first — `query_graph` / `get_neighbors` (or CLI `graphify affected`), then confirm the caller list with Grep. The graph suggests; grep confirms. Cross-repo queries are the default. In the three-layer gate model this is a Layer 2 agent procedure; Layer 1 is automatic (G1 graph rebuild hook, G2 `tsc --noEmit` pre-commit, G3 affected tests) and Layer 3 is HITL (CP-5 + fan-in>15 escalation) — full definitions in `GUARDRAILS.md` §2 and `docs/30-decisions/2026-06-12-migrate-gitnexus-to-graphify.md`.
2. **API-spec-gate.** Writing or extending `client.ts` or `types.ts` calls `rp-search` and `rp-show` first to verify the endpoint shape. No guessing from legacy code.
3. **Worktree isolation.** One agent = one worktree = one branch = one PR. Shared-infrastructure edits run alone, with other batches paused. See [docs/20-engineering/git-worktree-multi-agent.md](git-worktree-multi-agent.md).

Team-memory capture is no longer an in-repo gate — it runs via the personal `/rp-memory` skill (`~/.claude/skills/`). The migration record in `docs/test-migration/` is frozen history.

Full text of the gates lives in [.claude/README.md](../../.claude/README.md).

---

## How to extend

### Adding a new custom agent

1. Create `playwright-e2e/.claude/agents/<name>.md` with the standard frontmatter (`name`, `description`, `model`, `tools`) and the seven-section body (Purpose · When to invoke · Inputs · Procedure · Outputs · Hand-off rules · Anti-patterns).
2. Append a row to the table in "Custom agents (9)" above and bump the count in the header.
3. Add a short paragraph in the relevant tier subsection.
4. Run the personal `/rp-memory commit` to refresh the auto-generated index in `docs/MEMORY.md` and commit on the `ai-memory-DD.MM.YY` branch.

### Adding a new custom skill

1. Create `playwright-e2e/.claude/skills/<name>.md` with the standard frontmatter and the six-section body (Purpose · When to invoke · Inputs · Procedure · Outputs · Anti-patterns).
2. Append a row to the table in "Custom skills (6 …)" and bump the count.
3. Add a paragraph in the per-skill section.
4. Run the personal `/rp-memory commit`.

### Modifying an existing entry

1. Update the agent or skill file in place; keep the YAML frontmatter `description` aligned with the new behaviour.
2. Refresh the corresponding row and paragraph in this registry.
3. Update this file's `metadata.updatedAt` in the frontmatter.

### Retiring an entry

1. Move the file out of `.claude/agents/` or `.claude/skills/`.
2. Remove the corresponding row and paragraph from this registry.
3. Decrement the count in the section header.
4. Record the rationale in a new `docs/30-decisions/YYYY-MM-DD-<author>-retire-<name>.md`.

The registry is the audit trail. Drift from `.claude/` is detected manually until CI enforcement is added.

---

## Migration record (frozen history)

The migration system also shipped state and tracking files that are not agents or skills. The migration completed in 2026 and these are now **frozen history** — no longer actively written. Listed here so readers do not go hunting:

| File | Role | Origin |
|---|---|---|
| `docs/test-migration/inventory.json` | Catalogue of every legacy test with its final status | written during migration by the retired `progress-tracking` skill |
| `docs/test-migration/progress.json` | Aggregate roll-up per feature | written during migration by the retired `progress-tracking` skill |
| `docs/test-migration/progress.md` | Human-readable mirror of `progress.json` | regenerated during migration |
| `docs/test-migration/scenarios/<feature>.md` | Business-intent doc per feature | written during migration by the retired `scenario-extraction-agent` |
| `docs/test-migration/architecture-mapping.md` | Legacy artefact → new-framework form | written during migration by the retired `architecture-mapping-agent` |
| `docs/test-migration/dashboard/app.py` plus `dashboard/state/*` | Streamlit dashboard at `http://localhost:8501` (lives inside `test-migration/` so it travels with the migration data; `.venv/` is the only ignored piece) | orchestrator wrote `state/*` during migration |

JSON schemas: `docs/test-migration/templates/inventory.schema.json` and `progress.schema.json`. Status enum: `pending`, `in_progress`, `migrated`, `rewritten`, `merged`, `skipped_obsolete`, `blocked`, `failed_review`, `done`.
