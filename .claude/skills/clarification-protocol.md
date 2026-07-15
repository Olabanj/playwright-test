---
name: clarification-protocol
description: >
  Reusable template for HITL (Human-in-the-Loop) questions. Any agent uses this skill to escalate a
  decision to the user in a uniform Context → Decision → Options → Recommendation format. Required by
  GUARDRAILS.md §3 and the orchestrator's HITL Protocol. Use at the orchestrator checkpoints
  (CP-1…CP-5), when a §1 prohibition is at risk, when discovery shows fan-in >15, or when memory and
  observed code conflict.
metadata:
  owner: dmytro
  capability: context-intake
  status: active
  linear: null
  eval:
    status: none
    ref: null
    lastPassRate: null
    lastRun: null
---

# Clarification Protocol

## Purpose

Every Human-in-the-Loop checkpoint in the migration system looks the same to the user. This skill fixes the format so the user is never surprised by how a question is shaped, can answer fast, and the answer is easy to record as an ADR if it turns out to be durable.

## Trigger

- Mandatory at the five orchestrator checkpoints (CP-1…CP-5 — see `../agents/personal-engineering-orchestrator.md` §HITL Protocol).
- Mandatory when any §1 prohibition in `../../GUARDRAILS.md` is at risk of being triggered.
- Mandatory when discovery shows fan-in >15 inbound dependents on a symbol to be edited (`graphify affected` / `get_neighbors`), or when memory and observed code conflict.
- Optional when an agent is genuinely uncertain between two valid paths and the choice has user-visible consequences.

Do **not** invoke for routine ambiguities that the agent's own procedure already covers. HITL noise is a real cost.

## Inputs

- The agent invoking the skill.
- The triggering event (checkpoint code, gate name, or short description).
- The decision space: 2–4 mutually exclusive options.
- A recommendation with one-line rationale.

## Procedure

Compose the question in this exact shape. No extra prose around it.

```
**HITL — <checkpoint code or trigger name>**

**Context**
<2–3 lines: what just happened, which agent returned, what state changed,
which file/test/branch is affected. Include paths and ids, not contents.>

**Decision needed**
<one sentence — the question.>

**Options**
1. <Option A> — <one-line trade-off>
2. <Option B> — <one-line trade-off>
3. <Option C> — <one-line trade-off>  (optional)
4. <Option D> — <one-line trade-off>  (optional)

**Recommendation**
Option <N> — <one-line reason>.
```

After the message is posted:

1. Stop. Do not start follow-up work. Do not assume the recommendation will be accepted.
2. When the user answers, log the answer to `docs/test-migration/dashboard/state/activity.jsonl` (the per-batch activity channel) with the checkpoint code, options offered, and the chosen option.
3. If the answer reveals a durable rule (something that will recur), additionally capture it via the personal `/rp-memory` skill — and, for an architectural decision, write an ADR under `docs/30-decisions/` (the `qa-architect-agent` owns ADR authoring).
4. Resume the agent's procedure from where it paused.

## Outputs

- A single user-facing message in the template above.
- An `activity.jsonl` entry recording the question, options, and resolution.
- Optionally an ADR or memory update if the decision is durable.

## Tools & MCPs

- Built-in tools: `Edit`/`Write` (append the resolution to `docs/test-migration/dashboard/state/activity.jsonl`).
- No MCP servers. May hand off to the personal `/rp-memory` skill (or `qa-architect-agent` for an ADR) when the answer is durable.

## Examples

- **Invoke:** CP-5 push authorization — batch green, review APPROVED → **Outcome:** posts the `HITL — CP-5` block (Context / Decision needed / Options / Recommendation), stops, and on the user's answer logs the choice to `activity.jsonl`.

## Evaluation

none — pending QA-283.

## Guardrails

- Asking open-ended questions ("what should I do?"). The user picks from a list; the agent does the thinking up to that point.
- More than four options. If you have five, the question is not yet ripe — go think more.
- Hiding the recommendation. Always state your preferred path; the user can override.
- Asking the same question twice within a session. Cache the answer in `activity.jsonl` and reuse it.
- Posting the question and then continuing to work in parallel. Stop and wait.
- Using this skill for trivial confirmations ("about to read the file, OK?"). Reserve it for the checkpoints and §1/§3 triggers defined in `../../GUARDRAILS.md`.
