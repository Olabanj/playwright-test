---
id: e5f0a7c1-3b9d-5b3a-9c12-7a4d2f0b8e11
name: memory-rules
description: "Content governance rules for playwright-e2e/docs — what to save, what to skip, scope boundaries, frontmatter schema, contribution and commit workflow, Qdrant threshold"
metadata:
  type: reference
  category: meta
  tags: ["rules", "governance", "scope", "contribution", "content", "qdrant"]
  author: dmytro
  createdAt: 2026-05-14T15:32:00Z
  updatedAt: 2026-07-02T12:50:26Z
  expiresAt: null
---

# Memory Rules

Rules for contributing to the QA team AI memory in `playwright-e2e/docs/`. The `/rp-memory` skill reads this file at the start of every run — keep it authoritative.

---

## Language

**English only.** No exceptions. Every file in this folder must be written in English.

---

## What to Save

Save only durable work and project knowledge:

- Architecture decisions and the reasoning behind them.
- Team process rules: PR workflow, fixture approach, client creation rules, communication conventions.
- Technical decisions: why we chose a pattern, tool, or approach.
- Distilled standup outcomes: decisions made, durable blockers, priorities — extracted into `30-decisions/`, `40-domain/`, or `20-engineering/`. No per-person chronicle (see People Policy).
- RemotePass domain knowledge: terminology, contract types, platform behavior.
- Open questions worth tracking across sessions.

---

## What NOT to Save

- Small talk, greetings, jokes, or casual conversation.
- 1:1 conversation details or private chat content.
- Passwords, API keys, tokens, credentials, or any secrets.
- Personal information or HR-related content — see **People Policy** below for the full list (health, absences and their reasons, hours/compensation, whereabouts, personal life, assessments).
- Temporary debugging details or one-off task notes.
- Full raw transcripts or long speaker-by-speaker dumps.
- Code snippets or architectural decisions from the old `test-framework`.
- Anything non-English.

When in doubt → personal memory, not team memory.

---

## People Policy

Team memory records facts about the project, not about people's lives.

**Allowed — professional attribution by first name:**
- Decision authorship (`author:` frontmatter, ADR filenames).
- Who found a bug, raised a blocker, or owns a workstream at the time of writing.
- Who made or presented a decision.

**Banned — personal circumstances (applies to file bodies AND frontmatter `description`):**
- Health: sick leave, illness, medical details.
- Absences: both the fact AND the reason of OOO / vacation / travel. Calendar and Slack are the source of truth for availability.
- Working hours and compensation (e.g. "compensating 3h").
- Whereabouts and travel.
- Personal life details (family, events, celebrations).
- Performance or emotional assessments of people.
- 1:1 conversation content.

**Litmus test:** would this line be fine if the repo became readable org-wide — and in five years? If in doubt, leave it out (or route it to personal memory).

Rationale and scope: see [2026-07-02-dmytro-people-policy-worklog-retirement](../30-decisions/2026-07-02-dmytro-people-policy-worklog-retirement.md).

---

## Scope Boundaries — Critical Rule

Two projects exist in this repo. Their memory **must never be mixed**:

| | playwright-e2e/ (new framework) | test-framework (old) |
|---|---|---|
| Who works there | Dmytro | Rest of team |
| Architecture decisions | Dmytro only → write here | Belong in test-framework docs |
| Code patterns / "why we wrote it this way" | Dmytro only → write here | Belong in test-framework |
| Standup decisions / team process | Anyone → write here | Also write here |
| Domain knowledge | Anyone → write here | Also write here |

**Why:** Most of the team works in the old `test-framework`. Mixing their code decisions into playwright-e2e memory will confuse the AI and produce wrong suggestions for the new architecture.

---

## Team vs Personal Memory

Two destinations, classified per record:

| Destination | Content | Path | Git |
|---|---|---|---|
| **Team** | Architecture, team process, domain, standup outcomes, durable rationale | `playwright-e2e/docs/<category-folder>/` | Yes — branch `ai-memory-DD.MM.YY` |
| **Personal** | 1:1 content, individual preferences, exploratory drafts, ambiguously private | User's `personalMemoryPath` (set on first run) | No — never committed |

Default to **Personal** when uncertain. The skill never moves a record from personal to team automatically — only the user can promote.

---

## File Structure

| Folder | Content | One-file-per-... |
|--------|---------|---|
| `10-architecture/` | Framework design, Mermaid diagrams, implementation plan | Topic |
| `20-engineering/` | Team workflow, testing patterns, local setup | Topic |
| `30-decisions/` | Durable decisions with rationale | **Decision** (one decision per file) |
| `40-domain/` | RemotePass terminology and product knowledge | Topic |
| `50-work-log/` | **RETIRED 2026-07-02** — frozen archive, no new entries (see People Policy + ADR 2026-07-02-dmytro-people-policy-worklog-retirement) | **Day** (one day per file) |
| `_meta/` | Meta files: this rules file, future schema/index helpers | Topic |

**Why file-per-record for decisions and work-log:** with six engineers writing in parallel, append-only monolith files cause merge conflicts on the last lines every day. File-per-record means concurrent writes touch different files and never conflict.

---

## Frontmatter Schema (required on every file)

```yaml
---
id: <uuid-v5 — see the deterministic one-liner below (the personal /rp-memory skill generates it automatically)>
name: kebab-case-slug
description: "one line — used by retrieval and the auto-generated index"
metadata:
  type: project | feedback | reference
  category: architecture | engineering | decisions | domain | work-log | meta
  tags: ["tag1", "tag2"]
  author: <authorSlug from ~/.claude/rp-memory.config.json>
  createdAt: <ISO-8601 UTC, set once at creation>
  updatedAt: <ISO-8601 UTC, refreshed on every edit>
  expiresAt: null
---
```

`type` values:
- `project` — current state, events, decisions.
- `feedback` — rules, coding conventions, PR rules.
- `reference` — endpoints, glossaries, external tools, links.

**`id` is mandatory.** It is the primary key for the future Qdrant index and stays stable across renames. Generate it deterministically (`/rp-memory` does this automatically; the one-liner if you need it manually):

```bash
python3 -c 'import uuid,sys; print(uuid.uuid5(uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8"), sys.argv[1]+":"+sys.argv[2]))' "<category>" "<name>"
```

The namespace UUID is fixed — never change it once records exist, or every `id` will shift.

---

## Filename Conventions

| Folder | Pattern | Example |
|---|---|---|
| `30-decisions/` | `YYYY-MM-DD-<authorSlug>-<short-topic>.md` | `2026-05-15-dmytro-drop-3-lane.md` |
| `50-work-log/` (retired — no new entries) | `YYYY-MM-DD.md` | `2026-05-15.md` |
| Other | `<short-topic>.md` | `automation-strategy.md` |

---

## Auto-Generated MEMORY.md Index

`docs/MEMORY.md` has a hand-written header and an auto-generated body between markers:

```markdown
<!-- AUTO-GENERATED START -->
... entries collected from frontmatter ...
<!-- AUTO-GENERATED END -->
```

**Never edit the auto-generated block by hand.** It is rebuilt by the `/rp-memory` skill before every team-memory commit (Claude scans frontmatter of every file under `docs/` and rewrites the block). This is what keeps the index conflict-free when six people commit in parallel.

---

## Commit Workflow (team memory only)

Run by the `/rp-memory` skill, never invoked manually. Personal memory is never committed.

1. User explicitly approves a commit ("commit memory" or `/rp-memory commit`).
2. Switch to or stay on the day's `ai-memory-DD.MM.YY` branch. If on `main`: create `ai-memory-<today>` (e.g. `ai-memory-15.05.26`). If today's branch already exists on `origin`, check it out.
3. `git fetch origin` — if offline, warn and commit locally only.
4. `git pull --rebase origin <current-branch>` — on conflict: `git rebase --abort`, leave changes unstaged, instruct the user to resolve manually.
5. Refresh `MEMORY.md` — scan frontmatter of every file and rewrite the block between the auto-generated markers.
6. `git add playwright-e2e/docs/`
7. `git commit -m "memory: <one-line summary>"`
8. **Do not push.** The user runs `/claude-finish` to push and open a PR.

---

## Qdrant Threshold

Today the AI loads `MEMORY.md` and a few referenced files directly. This works until the index outgrows the context budget. Switch to Qdrant when **any** of these is true:

- `find playwright-e2e/docs -name '*.md' | wc -l` > 200.
- `MEMORY.md` exceeds 50 KB.
- The AI starts missing relevant records during retrieval (concrete reports from the team).

To switch:
1. Stand up Qdrant (Docker or managed) and write the URL to each user's `~/.claude/rp-memory.config.json`.
2. Ship a dedicated indexer (separate PR — Python script or Lambda) that embeds and upserts every file, keyed by frontmatter `id`.
3. Wire indexing into a post-merge hook (or CI on `main`).
4. Flip `useQdrant: true` for every team member.
5. `/rp-memory` retrieval routes through Qdrant — no skill changes needed.

The frontmatter schema above is already Qdrant payload — no migration of existing files.

---

## For Skills: Write-Back Rules

When `/rp-memory` (or `/claude-finish`) writes to memory:

1. Always search existing records first (Grep over frontmatter `description` and bodies) — **update them rather than duplicate**.
2. Use the correct category folder; the filename follows the patterns above.
3. Always generate `id` (deterministic uuid5) and include the full frontmatter.
4. Never bypass the approval gate — present the proposed record and wait for `yes`/`save`/`approve` before writing.
5. Never write architecture/code decisions unless the user works in `playwright-e2e/`.
6. Never write 1:1, private, or non-English content to team memory.
7. Never push — the user runs `/claude-finish` to push and open a PR.
