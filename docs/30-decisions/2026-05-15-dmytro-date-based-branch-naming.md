---
id: 8b14bc15-5e25-540b-ae4b-af30b7785118
name: date-based-branch-naming
description: "Team-memory branches use ai-memory-DD.MM.YY (e.g. ai-memory-15.05.26) — one branch per day, shared by everyone."
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "git", "branch-naming", "convention", "memory"]
  author: dmytro
  createdAt: 2026-05-15T00:00:00Z
  updatedAt: 2026-05-15T00:00:00Z
  expiresAt: null
---

# Team-Memory Branches Named by Date — `ai-memory-DD.MM.YY`

**Decision:** Team-memory branches use the date format `ai-memory-DD.MM.YY` (e.g. `ai-memory-16.05.26`). One branch per day, shared by everyone who commits memory that day. PR title can include the date.

**Why:**
- Date-based names make it obvious at a glance what a branch contains and how old it is.
- Every engineer can compute today's branch name independently with no coordination — `date +%d.%m.%y`.
- When six engineers commit on the same day, they all land on the same `ai-memory-<today>` branch, which is exactly the conflict-resolution model the skill was built for.

**How to apply:**
- `/rp-memory` and `/claude-finish` implement this automatically: when on `main`, they compute today's `DD.MM.YY` and check out `ai-memory-<today>` (creating or reusing an existing remote branch).
- When already on a previous day's branch at session start, stay on it — don't auto-switch. Only switch when starting from `main`.
- PR titles can include the date: `memory: <summary> (DD.MM.YY)`.
