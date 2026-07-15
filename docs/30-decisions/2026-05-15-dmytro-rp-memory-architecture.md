---
id: 74b8b651-e075-5b3e-abf1-917743afb47d
name: rp-memory-architecture
description: "Single /rp-memory skill for all durable knowledge capture. File-per-record, auto-generated MEMORY.md index, approval-first, never auto-pushes. Two install modes; bootstrap config."
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "memory", "skill", "rp-memory", "architecture", "rag"]
  author: dmytro
  createdAt: 2026-05-15T00:00:00Z
  updatedAt: 2026-05-15T00:00:00Z
  expiresAt: null
---

# rp-memory Skill Architecture

**Decision:** One Claude Code skill — `/rp-memory` — captures all durable knowledge for the team. `/claude-finish` handles session-end push and PR.

**Why a single skill:**
- Engineers do not need to remember which trigger fits which situation; the skill classifies automatically.
- One source of truth for governance, classification, and write rules.
- Easier to maintain and onboard new team members.

**Why file-per-record (decisions and work-log):**
- Six engineers commit in parallel to a shared branch. Append-only monolith files (the previous `decision-log.md`, `2026-05.md`) cause line-by-line merge conflicts on every commit.
- File-per-record means two concurrent writes touch different files — no conflict possible.
- Filename pattern: `30-decisions/YYYY-MM-DD-<authorSlug>-<topic>.md`, `50-work-log/YYYY-MM-DD.md`.

**Why auto-generated `MEMORY.md`:**
- The hand-written index was the single biggest source of conflicts on the shared branch.
- The skill rebuilds the block between `<!-- AUTO-GENERATED START -->` and `<!-- AUTO-GENERATED END -->` from each file's frontmatter before every commit.
- The manual header above the start marker is preserved.

**Why approval-first, never auto-push:**
- The skill queues candidates passively without interrupting the conversation.
- Every record is shown for explicit `yes`/`save`/`approve` before disk write.
- Commits require explicit "commit memory" approval.
- `git push` is delegated to `/claude-finish` so a final review happens before the PR opens.

**Why two install modes:**
- Option A — global (`~/.claude/skills/`): skills available in every project on the machine. Default.
- Option B — project-local (`playwright-e2e/.claude/skills/`, gitignored): skills only load when Claude Code launches from inside `playwright-e2e/`. Useful when other projects need different skill versions.
- Both use symlinks; `git pull` updates the skill body automatically.

**Why everything is in `SKILL.md` instead of shell scripts:**
- Claude has built-in tools (Read, Glob, Grep, Edit, Bash) that already perform every step (search, regenerate index, classify, commit).
- Shell scripts added brittleness (`awk` multi-line bugs, heredoc escaping, `python3` PATH assumptions) without buying us anything.
- Only `install.sh` survives — it runs before Claude is launched, so it cannot be a Claude-driven step.

**Why a bootstrap config (`~/.claude/rp-memory.config.json`):**
- Each engineer has their own `personalMemoryPath` and `authorSlug` — both must be persistent across sessions.
- Schema documented in `60-skills/rp-memory/config-schema.json`.

**Why Qdrant is deferred but the schema is ready:**
- Today's volume (~30 files) fits in context; loading `MEMORY.md` + a few referenced files is cheap.
- Thresholds for the switch: >200 files, or >50 KB in `MEMORY.md`, or the AI starts missing relevant records.
- Frontmatter already includes `id` (uuid5), `type`, `category`, `tags`, `author`, `createdAt`, `updatedAt` — directly usable as Qdrant payload.
- Switching is a single later PR that adds an indexer and flips `useQdrant: true`. No changes to `SKILL.md`, files, or commit flow.

**How to apply:**
- All new memory entries go through `/rp-memory`. Don't write files by hand unless bootstrapping a long-lived doc — and even then use the frontmatter schema in `_meta/memory-rules.md`.
- All commits to team memory run through `git pull --rebase` first (built into the skill). On conflict, the skill aborts the rebase and leaves changes safe.
- `npm run install-skills` (global) or `npm run install-skills:local` (project-local) from `playwright-e2e/`. Re-run only when adding skills; updates come via `git pull`.
