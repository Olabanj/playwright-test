# GUARDRAILS — Agentic Migration System

> Hard limits for the 14-agent migration system inside `playwright-e2e/`. Every agent MUST read this before acting. Violations require escalation, not a workaround.

## Scope

Applies to all agents under `.claude/agents/` and all skills under `.claude/skills/` when operating inside `playwright-e2e/`. The graph reads the whole monorepo, but edits land here.

Companion documents:
- `.claude/README.md` — system map, model tiering, end-to-end flow.
- `.claude/skills/review-checklist.md` — 14-item quality gate (the *what* of a green test).
- `.claude/skills/clarification-protocol.md` — reusable template for HITL questions.
- `docs/_meta/memory-rules.md` — memory governance.
- `docs/20-engineering/git-worktree-multi-agent.md` — worktree isolation rules.

---

## 1. Hard Prohibitions (NEVER)

These are absolute. There is no "minor exception" — if you hit one of these, stop and escalate via `clarification-protocol`.

- Never modify files outside `playwright-e2e/`.
- Never `git push` without explicit human approval (see §3, CP-5).
- Never delete a legacy test to silence a failure. A failing test becomes `blocked` with a documented reason — see `stabilization-agent`.
- Never commit secrets, `.env`, credentials, tokens, or real customer data.
- Never run destructive git (`reset --hard`, `branch -D`, `push --force`, `clean -f`, `checkout --`) without explicit human approval.
- Never ignore a high fan-in signal: if discovery (`get_neighbors` / `graphify affected`) shows >15 inbound dependents on a symbol, escalate before editing (G5/HITL).
- Never rename a public symbol without verifying via `tsc --noEmit` + affected tests afterwards (G2). Find-and-replace alone is prohibited; the compiler run is the safety net.
- Never delete or break cleanup of resources another spec depends on — clean up only resources your own spec created (payment-methods cleanup lesson, 2026-05-25).
- Never skip pre-commit hooks (`--no-verify`, `--no-gpg-sign`). The pre-commit `tsc` gate (G2), the architecture gate (`npm run lint:arch`), and the post-commit graph rebuild (G1) are part of the safety system.
- Never write team memory, ADRs, or `docs/` in any language other than English.
- Never let two agents work in parallel on shared-infra (`core/`, `fixtures/` base, `_common/`, `playwright.config.ts`, `BaseAPI`, `AuthFixture`). Serialise — see `docs/20-engineering/git-worktree-multi-agent.md`.
- Never invent batch sizes greater than 5. The 3–5 rule is fixed by review and stabilization cost.

## 2. Mandatory Gates (cross-cutting — every agent enforces)

Formalised from `.claude/README.md`. Each gate is a precondition; skipping one is a §1 violation.

The gate system has three layers (redesigned 2026-06-12, see `docs/30-decisions/2026-06-12-migrate-gitnexus-to-graphify.md`): **Layer 1 — automatic** (G1 graph rebuild on commit via git hook; G2 `tsc --noEmit` pre-commit; **architecture gate `npm run lint:arch` pre-commit** — boundaries + FS checks per `eslint/architecture-rules.json`; G3 affected verify-lane tests green before batch commit), **Layer 2 — agent procedures** (the numbered gates below), **Layer 3 — HITL** (§3). Layer 1 runs without agent participation; never duplicate it as a manual step.

1. **Graphify-gate (G5, discovery-before-edit).** Reading or editing legacy code, shared abstractions, or public symbols requires discovery first: `mcp__graphify__query_graph` / `get_node` / `get_neighbors` (or CLI `graphify affected "Symbol"`), then a Grep cross-check of the caller list. The graph suggests; grep confirms. Verification of the edit itself is G2+G3 (compiler + tests), not a graph call.
2. **API-spec-gate (G6).** Before writing or updating `client.ts`, `types.ts`, or any spec touching an endpoint, call `rp-search` / `rp-show` to verify endpoint shape. No guessing.
3. **Batch cap (G8).** 3–5 tests per batch; before committing, compare `git diff --stat` against the approved batch plan — only planned files may appear. Unplanned files = stop and escalate.
4. **Worktree isolation.** One batch = one worktree = one branch = one PR. The orchestrator owns worktree creation. Before merging parallel worktrees, run `graphify prs --conflicts` to flag PRs sharing graph communities (merge-order risk).
5. **Token-efficient delegation.** Orchestrator passes file paths and IDs, not file contents. Workers return ≤300-word summaries via `summary-generation`.
6. **No memory pollution.** Team memory in `docs/` is English-only and project-scoped — no legacy-framework artefacts, no personal items.
7. **Project scope.** Writes happen only inside `playwright-e2e/`.
8. **HITL-gate.** Orchestrator pauses at the human checkpoints listed in §3.

> Team-memory capture is handled by the personal `/rp-memory` skill (in `~/.claude/skills/`), not an in-repo gate. The completed-migration record in `docs/test-migration/` is frozen history, not a live progress gate.

## 3. High-Risk Operations — HITL Approval Required

These operations are **not** executed autonomously. The agent stops and asks the user via the `clarification-protocol` skill. The full protocol lives in `.claude/agents/personal-engineering-orchestrator.md` §HITL Protocol.

**Semi-autonomous mode (active 2026-06-23):** the only human gate during migration is **CP-5 (push/PR)**. CP-3 is removed — the orchestrator self-selects 3–5 test batches per the approved migration plan and proceeds without per-batch approval. The safety net that replaces the human batch-check: the deterministic gates (G2 `tsc`, `lint:arch` architecture gate, G3 affected tests) block automatically, the G8 batch cap stays enforced, and the orchestrator MUST log the batch plan to `dashboard/state/activity.jsonl` BEFORE starting each batch (auditable after the fact).

| Code | Checkpoint | Status |
|---|---|---|
| CP-1 | Inventory Review — after a test-list/classification slice is produced | DEFERRED (Phase 2) |
| CP-2 | Architecture Gap — after gap analysis reports missing abstractions | DEFERRED (Phase 2) |
| CP-3 | Batch Plan Approval — before `test-authoring-agent` | REMOVED (semi-auto) — replaced by activity-log audit line + gates |
| CP-4 | Review Failure Escalation — after `test-reviewer-agent` with ≥3 FAILED items or any CRITICAL severity | DEFERRED (Phase 2) |
| CP-5 | Push / PR Authorization — before `git push` or `gh pr create` | **ACTIVE** |

Additional ad-hoc triggers (active in both phases) — escalate via `clarification-protocol` whenever any of these occur:

- Memory and observed code conflict (memory says X, code says Y).
- Discovery shows fan-in >15 inbound dependents on the symbol to be edited (`get_neighbors` / `graphify affected`).
- A decision is required that is not covered by any existing ADR under `docs/30-decisions/`.
- A worktree merge conflict that is not a trivial textual conflict, or `graphify prs --conflicts` flags overlapping communities between open PRs.

Rationale for the phased rollout: see `docs/30-decisions/2026-05-27-hitl-protocol-for-agentic-migration.md`.

## 4. Escalation Protocol

When a §1 rule is broken, a gate cannot be satisfied, or a blocker is hit:

1. **STOP.** Do not try to work around the obstacle.
2. **Document.** Capture the blocker: file path, line number, error text, and the gate or rule that fired. Keep it under 5 lines.
3. **Ask via `clarification-protocol`.** Use the standard template (Context → Decision needed → Options → Recommendation).
4. **Wait for explicit decision.** Do not proceed on assumed intent. Silence is not approval.
5. **Record the decision.** If the answer is non-obvious, write an ADR under `docs/30-decisions/` (the `qa-architect-agent` owns ADR authoring; durable non-architectural notes go via the personal `/rp-memory` skill).

## 5. Approval Authority

| Role | Can approve |
|---|---|
| User (Dmytro) | Push, merge, deletion, parking of tests, architecture changes, new ADRs, scope expansion |
| `qa-architect-agent` | May propose architectural ADRs and pattern extensions; cannot finalise |
| `test-reviewer-agent` | APPROVE / APPROVE_WITH_NOTES / FAILED_REVIEW — never push, never merge |
| Any other agent | Bounded by its `tools:` frontmatter; nothing outside that list |

## 6. Verification

Every agent must be able to answer "yes" to these before reporting completion:

- All §2 gates that apply to my action were invoked, with evidence in the work-log or summary.
- No §1 prohibition was triggered.
- Any §3 high-risk operation went through `clarification-protocol`.
- `tsc --noEmit` is clean and affected verify-lane tests are green (G2/G3).
- `git diff --stat` matches the approved batch plan — no unplanned files (G8).
- For pushes/PRs: `graphify prs --conflicts` and `get_pr_impact` were attached to the CP-5 request.

If the answer to any of these is "no" or "unsure", stop and escalate.
