---
name: active-projects
description: Snapshot of in-flight initiatives. Refreshed by the orchestrator. Decays fast — verify against progress.json before acting.
metadata:
  type: project
---

# Active projects

> Refreshed by the orchestrator. Always verify against `docs/test-migration/progress.json` before acting — this file decays fast.

## Initiative: Legacy → playwright-e2e migration

- **Status:** in_progress
- **Source of truth:** `docs/test-migration/progress.json`
- **Current feature:** `<feature>` _(filled at session start)_
- **Last batch:** `<date>` — `<count>` tests migrated
- **Open blockers:** _(see `progress.json` blockers section)_
- **Next step:** _(filled by the orchestrator)_

## Initiative: Agentic system bootstrap

- **Status:** completed
- **Outcome:** 14 agents + 8 skills + 7 memory templates + dashboard live at `http://localhost:8501`.
- **Anchor docs:** `playwright-e2e/.claude/README.md`, `docs/test-migration/README.md`.

## Initiative: Test-framework documentation hygiene

- **Status:** ongoing
- **Owner:** `docs-knowledge-agent`
- **Trigger:** after every accepted ADR or pattern change.

## Format for a new initiative

```markdown
## Initiative: <one-line title>

- **Status:** planning | in_progress | paused | done | abandoned
- **Owner:** <agent or person>
- **Source of truth:** <file or system>
- **Goal:** <one sentence>
- **Constraints:** <bulleted>
- **Open questions:** <bulleted>
- **Last updated:** YYYY-MM-DD
```
