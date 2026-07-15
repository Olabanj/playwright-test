# Agent Model & Effort Calibration

> **Provenance.** This calibration was produced on **2026-06-26** by **Claude Opus 4.8** running in **ultracode** mode. Opus reviewed every one of the (then) 17 agents in this directory and assigned each a default `model` + `effort` via a multi-agent workflow: one analyst per agent read the agent's full definition, an adversarial verifier challenged each choice in both directions (under-provisioned vs. wasted buffer), and an Opus synthesis pass enforced cross-agent consistency. The per-agent reasoning lives in the workflow transcript, not here — this file records the **result** and the **rule** so it can be re-derived or revised.
>
> **Post-migration update (QA-281, 2026-07-07).** Five migration-only agents were retired once the migration completed: `architecture-mapping-agent`, `scenario-extraction-agent`, `test-inventory-agent`, `personal-memory-agent`, `daily-work-assistant`. Their rows are removed from the table below. **12 agents remain** (9 custom + the 3 built-in Playwright agents). The +14.7% aggregate-buffer figure was computed over the original 17-agent set and is left as historical context.

## The rule (how defaults were chosen)

1. **Quality first, then a power buffer.** For each agent we found the *ideal* tier — the cheapest `model`+`effort` at which it does its real job **well and confidently** — and then added a small **power reserve on top** so it reliably performs. The buffer is **not** cost-minimisation; it is deliberate headroom.
2. **One effort step ≈ +15% power.** So "add ~10–20% power" = bump effort one step **above** ideal — *but only when the task can actually use the extra reasoning*. Where the task is mechanical, read-only, or output-ceilinged (the answer is bounded by an external log / a verbatim rule / a fixed template), the buffer is **withheld** and the agent stays at ideal.
3. **Model jumps are not buffers.** `haiku → sonnet → opus` is a large capability jump, not a 15% nudge. A model is raised **only** when the lower model genuinely cannot do the job at quality (e.g. the orchestrator's sole-control role), never as routine padding.
4. **The orchestrator can bump at runtime.** Defaults provision for the **typical** task. When a *specific* task is unusually hard, `personal-engineering-orchestrator` (opus) raises that single sub-agent's `model`/`effort` at call time via the Agent-tool override. This is why the hot-path generators sit at `medium` rather than `high` — their rare hard cases are the textbook runtime-bump scenario.

**Aggregate power buffer across the original 17 agents: ≈ +14.7% over the pure-ideal baseline** — squarely inside the intended 10–20% band. (12 agents remain after the QA-281 pruning.)

## Final defaults

| Agent | Model | Effort | Buffer | Note |
|-------|-------|--------|:--:|------|
| `personal-engineering-orchestrator` | opus | medium | applied (model) | Sole control of shared-infra serialization + sub-agent tier-selection (CP-3 removed) → opus warranted; effort stays medium for broad coordination |
| `qa-architect-agent` | opus | max | applied | Binding ADRs across the framework; rare + highest-stakes, so max is cheap insurance (backtracking on contradictory doc sets) |
| `test-reviewer-agent` | sonnet | high | applied | Verdict gates every batch; high catches semantic drift / severity classification |
| `stabilization-agent` | sonnet | high | applied | Bug classification (test/abstraction/product/env) is the non-mechanical step; errors compound at high cadence |
| `playwright-test-healer` | sonnet | high | applied | Snapshot diagnosis + selector-strategy choice benefit from depth |
| `test-authoring-agent` | sonnet | high | applied | TS correctness, LOC-005, mergeTests namespacing, TODO-scope reasoning |
| `page-object-fixture-agent` | sonnet | high | applied | Dedup (graph+grep), 9+ anti-patterns, tsc + lint:arch |
| `playwright-test-planner` | sonnet | high | applied | Scenario completeness is open-ended coverage analysis |
| `repo-intelligence-agent` | sonnet | medium | **withheld** | Read-only; output bounded at ≤7 bullets |
| `playwright-test-generator` | sonnet | medium | **withheld** | Output ceiling fixed by the MCP execution log |
| `docs-knowledge-agent` | haiku | medium | applied | Light editorial judgment (cross-links, CLAUDE.md bloat-avoidance) |
| `english-explanation-agent` | haiku | medium | applied | Anti-calque rewriting + 4-mode register selection |

**Consistency anchors:** the five complexity-3 pipeline workers (`test-reviewer`, `stabilization`, `playwright-test-healer`, `test-authoring`, `page-object-fixture`) are deliberately matched at **sonnet/high**. The two durable-artefact haiku agents (`docs-knowledge`, `english-explanation`) are matched at **haiku/medium**.

## Hard rule preserved

Editing **`CLAUDE.md`** requires **opus**. `docs-knowledge-agent` (haiku) maintains ordinary docs; any edit that touches `CLAUDE.md` itself is routed to the opus `personal-engineering-orchestrator`, not done at the haiku tier.

## Decision points (revisit if the assumption changes)

1. **Orchestrator `opus/medium` vs `sonnet/high`** — opus is justified *only while CP-3 (human batch-plan gate) is removed* and the orchestrator is the sole check on consequential parallel-worktree decisions. If a human CP-3 gate is restored, downgrade to `sonnet/high`.
2. **`qa-architect-agent` `max` vs `xhigh`** — max is cheap on a rare agent. For strict ideal-only on rare agents, drop to `opus/xhigh`; the only loss is backtracking headroom on internally-contradictory ADR inputs.

## Cost model used (relative, for the buffer math)

- Model price/token: `haiku ≈ 1`, `sonnet ≈ 4`, `opus ≈ 20`.
- Effort capability multiplier (each step ≈ +15% power): `low 1.00`, `medium 1.15`, `high 1.32`, `xhigh 1.52`, `max 1.75`.

These are order-of-magnitude assumptions for tier comparison, not billing figures.
