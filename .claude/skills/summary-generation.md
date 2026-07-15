---
name: summary-generation
description: >
  Generate the ≤300-word end-of-turn summary every agent returns. Fixed 8-section template. Keeps
  orchestrator context lean. Use as the final step of every sub-agent's procedure, and for the
  orchestrator's own end-of-turn message when work concluded a phase.
metadata:
  owner: dmytro
  capability: review
  status: active
  linear: null
  eval:
    status: none
    ref: null
    lastPassRate: null
    lastRun: null
---

# Summary Generation

## Purpose

Sub-agents must hand back compact, structured reports — not raw context. This skill enforces the single fixed format every agent uses to close out work, so the orchestrator can chain decisions without re-reading transcripts.

## Trigger

- The final step of every sub-agent's procedure (`repo-intelligence`, `qa-architect`, `test-authoring`, `page-object-fixture`, `stabilization`, `test-reviewer`, `docs-knowledge`, `english-explanation`).
- The orchestrator's own end-of-turn message when work concluded a phase.

## Inputs

- The goal of the agent's run (one sentence — restate it).
- The actions taken (paths touched, commands run, decisions made).
- Outputs produced (files, JSON changes, scenario docs, fixtures).
- Any blockers, risks, or open questions surfaced.

## Procedure

1. Restate the goal verbatim — even one sentence prevents drift in long sessions.
2. Fill each section. Empty sections render as `none`.
3. Keep total length under 300 words. Cut adjectives before facts.
4. Use absolute file paths from the repo root (e.g. `features/auth/client.ts`, not `client.ts`).
5. Reference test ids, feature names, and status transitions explicitly so the orchestrator can chain decisions without re-reading the transcript.
6. End with one concrete next-step sentence — what should happen next, by whom (orchestrator, another agent, the user).

## Output template

```
Goal: <one sentence restating the goal>

Work completed:
- <bulleted, ≤6 items>

Files changed:
- <path> (<created|modified|deleted>)

Commands executed:
- <command> → <exit-code summary>

Progress updated:
- <feature>: <test-id> <old-status> -> <new-status>  (repeat per test)
- inventory.json: <yes|no> · progress.json: <yes|no> · progress.md: <yes|no>

Blockers:
- <id>: <reason> (or "none")

Risks:
- <risk> (or "none")

Next step:
- <one sentence>
```

## Outputs

- A single text block matching the template above, ≤300 words, in English.
- No file writes. (The orchestrator copies the relevant lines into `dashboard/state/activity.jsonl` if needed.)

## Tools & MCPs

- None. This skill only formats text the invoking agent already holds; no tools or MCP servers.

## Examples

- **Invoke:** `test-authoring-agent` finishes a 4-test batch → **Outcome:** returns the 8-section block (Goal, Work completed, Files changed, Commands executed, Progress updated, Blockers, Risks, Next step) under 300 words for the orchestrator to chain on.

## Evaluation

none — pending QA-283.

## Guardrails

- Free-form prose summaries. Use the template literally — sections in order, headers verbatim.
- Restating tool outputs verbatim. Summarise; the transcript already exists if anyone needs it.
- Long "lessons learned" reflections in the summary. Those belong in team memory (the personal `/rp-memory` skill), not here.
- Padding sections to look thorough. `none` is a valid value.
- Non-English text in the summary. Even if the user writes in another language, agent-to-agent summaries are English (consistent with team memory governance).
- Forgetting the Next-step line. The chain breaks without it.
