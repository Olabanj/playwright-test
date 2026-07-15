---
name: project-decisions
description: Template for project decisions. Real decisions live as one-file-per-decision in docs/30-decisions/ — this file documents the schema and gives an example.
metadata:
  type: project
---

# Project decisions — schema and example

> **Real decisions live in `docs/30-decisions/YYYY-MM-DD-author-topic.md`** (one decision per file).
> This template documents the format and an example entry.

## Frontmatter

```yaml
---
date: 2026-MM-DD
author: <name or agent>
status: accepted | superseded | superseded-by-YYYY-MM-DD-...
topic: short-kebab-case
related: [other-decision-slug, ...]
---
```

## Body sections

```markdown
# <Decision title — one sentence>

## Context
<Two or three sentences: what problem prompted the decision, what was the situation.>

## Decision
<One paragraph: what was decided.>

## Why
<Why this option over alternatives. Cite incidents, constraints, deadlines.>

## How to apply
<Concrete rules. When the decision binds future work, this is the operative section.>

## Alternatives considered
<One line per rejected option with a one-line reason.>

## Supersedes
<Link to the older decision, if any.>
```

## Example

`docs/30-decisions/2026-05-22-architect-feature-first-layout.md`:

```markdown
---
date: 2026-05-22
author: architect
status: accepted
topic: feature-first-layout
related: [composition-pattern]
---

# Feature-first module layout adopted for playwright-e2e

## Context
The legacy framework groups tests by lane (api/ui) and helpers by type. As the codebase grew, cross-cutting helpers became god-files and module boundaries blurred.

## Decision
All new code lives under `features/<domain>/{client.ts, types.ts, seeding.ts, builders/, pages/, fixtures.ts, tests/api/, tests/ui/}`. Cross-cutting is reserved for `core/`, base `fixtures/`, `utils/`.

## Why
Single-module changes touch one folder. Ownership is unambiguous. Cross-module composition is explicit via `mergeTests` rather than implicit via shared globals.

## How to apply
- New modules mirror `features/auth/` exactly.
- No spec files outside `features/<domain>/tests/`.
- Cross-cutting only in `core/`, `fixtures/`, `utils/`.

## Alternatives considered
- Per-lane top-level layout (`tests/api`, `tests/ui`): rejected — re-creates the legacy pain.
- Per-microservice layout: rejected — tests divide by feature, not by service.

## Supersedes
<none>
```
