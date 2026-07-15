---
name: your-skill-slug              # kebab-case; MUST equal dir name (folder skill) or file basename (single-file)
description: >                     # ~100 words, one paragraph — THE sole triggering signal.
  What this skill does in one or two sentences, then explicit trigger enumeration:
  "Use when <condition A>, <condition B>, or the user says <phrase C>."
metadata:
  owner: your-slug                 # author slug (dmytro, baha, aleyna, …)
  capability: review               # one of: memory | session-lifecycle | context-intake | code-intelligence | migration-workflow | review
  status: draft                    # draft | active | deprecated
  linear: QA-000                   # originating/tracking issue, or null
  eval:
    status: none                   # none | golden-set | passing  (start at none until QA-283)
    ref: null                      # path/id of the golden set; non-null once status != none
    lastPassRate: null             # 0.0–1.0, only when status = passing
    lastRun: null                  # ISO-8601, only when status = passing
---

# Your Skill Title

One-line summary of what the skill is for.

## Trigger

- When to invoke this skill.
- Explicit trigger phrases the user or an agent would say.
- Conditions in the workflow that call for it.

## Inputs

- What the skill needs to run (task description, file paths, ids, options).

## Procedure

1. Ordered steps. (This section is optional — drop it if the skill has no meaningful flow.)
2. Keep steps deterministic and prose-first; no helper scripts beyond pre-Claude bootstrap.

## Outputs

- What the skill produces: files written, reports returned, state changed.

## Tools & MCPs

- Built-in tools used (Read, Grep, Glob, Bash, Edit, Write).
- MCP servers relied on (e.g. `remotepass-qa` / `graphify`, `remotepass-backend`, `playwright-test`) — or "none".

## Guardrails

- Hard rules the skill must never violate.
- Anti-patterns to avoid.

## Examples

- **Invoke:** `<how it is triggered>` → **Outcome:** `<what happens>`.

## Evaluation

- `none — pending QA-283.` (Replace with the golden-set location once QA-283 lands and `metadata.eval.status` changes.)
