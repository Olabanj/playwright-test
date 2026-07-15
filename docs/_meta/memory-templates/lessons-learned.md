---
name: lessons-learned
description: Durable lessons surfaced during migration. One file per lesson under docs/40-domain/ or docs/20-engineering/ depending on scope.
metadata:
  type: feedback
---

# Lessons learned — schema and examples

> Real lessons live alongside their topic — domain lessons in `docs/40-domain/<topic>.md`, engineering lessons in `docs/20-engineering/<topic>.md`. This template documents the format.

## When to record a lesson

- A migration broke twice in the same way.
- A debugging session revealed a non-obvious behavior of the product or the framework.
- A choice that seemed safe turned out to be expensive — or one that seemed expensive turned out to be cheap.
- A team-process step that the playbook missed.

## Format

```markdown
# <Lesson title — one sentence>

## What happened
<Two or three sentences: the situation, the surprise.>

## Root cause
<Why it happened. Cite files / commits / decisions.>

## Lesson
<The takeaway as a positive rule: "When X, prefer Y." Avoid negative phrasing.>

## How to apply
<Where this rule kicks in. Which agent/skill enforces it from now on.>

## Date
`2026-MM-DD`
```

## Example

`docs/20-engineering/migration-batch-size.md`:

```markdown
# Keep migration batches at 3-5 tests, not 10-12

## What happened
A batch of 12 tests went green in CI but produced three days of review-fix cycles. The reviewer kept finding the same checklist failures across half the batch.

## Root cause
Batch size larger than 5 amortises the migrator's confirmation bias. The reviewer's signal arrives too late; the migrator has already encoded the mistake into more tests.

## Lesson
Keep batches at 3-5 tests. Review and stabilization cost dominate the day with bigger batches.

## How to apply
- `test-authoring-agent` enforces the upper bound.
- `personal-engineering-orchestrator` rejects requests for larger batches.
- Reviewer caps approval at 5 tests per turn.

## Date
`2026-05-22`
```
