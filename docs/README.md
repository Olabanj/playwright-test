# RemotePass QA Team Memory

> **For framework architecture, start here:** [`10-architecture/plan.md`](10-architecture/plan.md) — folder structure, layer rules, code examples.
>
> **For governance rules** (what to save, frontmatter, commit workflow): [`_meta/memory-rules.md`](_meta/memory-rules.md).
>
> **For the index of everything:** [`MEMORY.md`](MEMORY.md) — auto-generated, one line per file.

This folder is the shared long-term memory for the QA automation team's AI assistant (Claude Code).

Every time we make a decision — about architecture, tooling, workflow, code patterns, or test strategy — it gets recorded here. The AI reads this folder at the start of every session and uses it as context. Six engineers contribute in parallel through a single Claude Code skill, [`/rp-memory`](60-skills/rp-memory/SKILL.md), that listens to the conversation, captures durable knowledge with your approval, and commits it on a shared branch.

---

## Why This Exists

**The goal:** build one AI "brain" that deeply understands our product, our problems, and our engineering decisions. Over time, as the team writes code and communicates with it, the AI passively learns — and becomes progressively more useful and accurate.

**Why does this matter?**

- The AI remembers **why** we made specific choices, not just what the code looks like.
- Future sessions don't have to rediscover decisions that were already made.
- New team members can onboard faster by reading this folder.
- When we ask the AI to write or review code, it already knows our patterns, our constraints, and our non-negotiable rules.

The cost is small — a one-line approval each time the skill proposes a record — and it compounds. The more we use it, the more it saves.

---

## How the AI Uses This Memory (RAG)

The memory works through **RAG — Retrieval-Augmented Generation**.

The model is not re-trained. Instead, relevant files are loaded into context at the start of each session, giving the AI the equivalent of "reading the briefing" before it starts working.

**Why this is cost-effective:**

| Approach | Tokens per session | Quality |
|----------|-------------------|---------|
| No memory — explain everything from scratch each time | 2,000–5,000 tokens of repeated context | Inconsistent — the AI forgets past decisions |
| RAG with MD files — load relevant files into context ← **current** | 300–800 tokens | Consistent — the AI already knows the rules |
| RAG with Qdrant — semantic search, load only the most relevant chunks ← **future** | 50–200 tokens | Consistent + scales to hundreds of files without growing context |

**Bottom line:** we invest a small amount of tokens now (writing memory) to save large amounts later (not re-explaining the same context every session). The more we use it, the more useful it becomes.

When the knowledge base grows too large to load all files at once, we connect **Qdrant** (a vector database). Instead of loading every file, the AI searches for the most relevant ones by semantic similarity and loads only those. The frontmatter in every file (`id`, `name`, `description`, `metadata.tags`) is already designed for this — no restructuring needed when we make the switch. Thresholds and the switch plan are at the bottom of this README.

---

## How It Works (the short version)

1. **Claude Code reads this folder** at the start of every session via `/rp-memory` (passively, no command needed).
2. **As you work**, the skill listens — when something durable surfaces (a decision, a process rule, a domain term, a meeting outcome), it queues a candidate without interrupting.
3. **You flush the queue** with `/rp-memory flush` (or any natural moment like "save what we learned"). The skill proposes each record and asks for approval one by one.
4. **You commit** with `/rp-memory commit` (or "commit memory"). The skill runs `git pull --rebase` and `git commit` — it **never pushes**.
5. **Before closing the session**, `/claude-finish` captures any leftover knowledge, regenerates the index, pushes the branch, and opens or updates the PR for team review.
6. **PR review** ensures only durable, accurate, in-scope knowledge merges to `main`.

One trigger (`/rp-memory`) handles passive capture, meeting outcomes, and ad-hoc knowledge intake — nothing else to remember.

---

## Two Memory Destinations — Nothing Gets Lost

Every piece of knowledge extracted from a session or meeting is classified and routed automatically. Nothing is discarded — it either goes to the team or stays private. Anything that should never be saved (secrets, raw transcripts, non-English content, old `test-framework` code decisions) is dropped.

| Knowledge type | Where it goes |
|---|---|
| Standup decisions, team process rules, domain terms, durable rationale | **Team memory** — `playwright-e2e/docs/` (GitHub) |
| 1:1 conversation details, personal context, private feedback | **Personal memory** — your local `personalMemoryPath` (never pushed) |
| A 1:1 decision later confirmed by the team | **Both** — full context to personal; sanitized decision to team |
| Personal explorations, draft ideas not yet validated | **Personal memory** (local only) |

**Team memory** (`playwright-e2e/docs/`) is visible to everyone via this GitHub repository — it goes through PR review.

**Personal memory** is on your machine only. It is never committed, never pushed, never shared. It preserves the full context behind decisions, including details inappropriate for a shared repo.

The skill applies this classification automatically before writing. **When uncertain, knowledge defaults to personal memory** — it is always better to preserve something privately than to discard it. You can always promote a personal record to team later by saying so explicitly.

---

## Memory Scope — Critical Rule

This memory is **exclusively for the `playwright-e2e/` project** (the new framework).

**Dmytro** writes architectural and code decisions here (he works in playwright-e2e).

**Other team members** (Baha, Aleyna, Sergiy, Lukman, Slahudeen) work in the old `test-framework`. They can contribute here:
- Meeting outcomes and team decisions
- Domain knowledge and product context
- Process rules and blockers

They should **NOT** write architectural or code decisions here — those belong to their own project. Mixing the two projects' knowledge will confuse the AI and produce wrong suggestions. The `/rp-memory` skill has a guard that refuses team writes if invoked outside `playwright-e2e/docs/`.

---

## Install Skills (one-time setup per machine)

You have two options depending on how broadly you want the skills to be available. Both are run from `playwright-e2e/`.

### Option A — Global (skills work in any project on your machine)

```bash
cd playwright-e2e
npm run install-skills
```

This symlinks `rp-memory` and `claude-finish` into `~/.claude/skills/`. After running, restart Claude Code.

### Option B — Project-local (skills only when Claude Code is launched from this project)

```bash
cd playwright-e2e
npm run install-skills:local
```

This symlinks into `playwright-e2e/.claude/skills/` (gitignored, local to your machine). Launch Claude Code from inside `playwright-e2e/` to pick them up. Useful if you have other projects with conflicting skill names, or if you don't want global tools.

**Both options use symlinks**, so `git pull` automatically updates the skills for everyone. You never reinstall.

### First run

The first time you invoke `/rp-memory`, the skill writes `~/.claude/rp-memory.config.json` after asking two questions:

| Field | What it is | Example |
|---|---|---|
| `personalMemoryPath` | Absolute path to your private memory folder (never committed) | `~/.claude/projects/-Users-<you>-WebstormProjects-test-framework/memory` |
| `authorSlug` | Lower-case kebab id agreed with the team in Slack — used in filenames and the `author` frontmatter field | `dmytro`, `baha`, `aleyna`, `sergiy`, `lukman`, `slahudeen` |

Schema lives in [`60-skills/rp-memory/config-schema.json`](60-skills/rp-memory/config-schema.json).

### Skills available after setup

| Skill | When to use |
|---|---|
| `/rp-memory` | Always loaded. Watches passively; you don't have to call it most of the time. |
| `/rp-memory flush` | Review the session's queued candidates one by one. |
| `/rp-memory commit` | Stage and commit the team-memory files written this session. Runs `git pull --rebase` first. **Never pushes.** |
| `/claude-finish` | Before closing the session — flushes the queue, pushes the branch, opens or updates the PR. |

---

## How to Add to the Memory

You don't write memory files by hand. Just have the conversation in Claude Code. When something durable comes up, the skill silently queues it. At a natural break, run `/rp-memory flush` (or just say "save what we learned"). The skill walks each candidate, shows the proposed frontmatter and body, and writes it only after you say `yes` / `save` / `approve`.

When you want to commit:

```
You: commit memory
```

The skill replies with the list of files, you approve, it runs `git pull --rebase` and `git commit`. Nothing is pushed. At the end of the session you run `/claude-finish` to push and open the PR.

If you must write a file by hand (e.g. bootstrapping a new long-lived doc), follow the frontmatter schema in [`_meta/memory-rules.md`](_meta/memory-rules.md). Generate the `id` with this one-liner:

```bash
python3 -c 'import uuid,sys; print(uuid.uuid5(uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8"), sys.argv[1]+":"+sys.argv[2]))' "<category>" "<name>"
```

---

## What Goes Here

**Save:**
- Architecture decisions and the reasoning behind them.
- Team process rules (PR workflow, fixture approach, client creation rules, communication conventions).
- Technical decisions (why we chose a pattern, tool, or approach).
- Standup outcomes: who owns what, decisions made, blockers, priorities.
- RemotePass domain knowledge: terminology, contract types, platform behavior.
- Open questions worth tracking across sessions.

**Do NOT save:**
- Small talk, greetings, jokes, or casual conversation.
- 1:1 conversation details or private chat content (those go to personal memory).
- Passwords, API keys, tokens, credentials, or any secrets.
- Personal information or HR-related content.
- Temporary task notes or one-off debugging details.
- Full raw transcripts or speaker-by-speaker dumps.
- **Any language other than English.**
- Code or architectural decisions from the old `test-framework` — that project is separate.

When uncertain → personal memory, not team memory.

---

## How Six Engineers Work in Parallel Without Conflicts

We use a single shared branch (`ai-memory-DD.MM.YY`) that all six engineers commit to throughout the day. Three mechanisms keep it clean:

### 1. File-per-record layout

| Folder | One file per... | Example |
|---|---|---|
| `30-decisions/` | One **decision** | `2026-05-15-dmytro-drop-3-lane.md` |
| `50-work-log/` | One **day** | `2026-05-15.md` |
| `10-architecture/`, `20-engineering/`, `40-domain/`, `_meta/` | One **topic** | `glossary.md`, `automation-strategy.md` |

Two engineers writing decisions on the same day touch two different files — no conflict possible.

### 2. Auto-generated `MEMORY.md` index

The index file has a hand-written header (folder structure description) and an auto-generated block between markers:

```markdown
<!-- AUTO-GENERATED START -->
... (the skill rewrites this on every commit)
<!-- AUTO-GENERATED END -->
```

Nobody edits the auto-generated block by hand. The `/rp-memory` skill rebuilds it from frontmatter before every commit. Result: the index is always in sync and can't have line-by-line merge conflicts.

### 3. `git pull --rebase` before every commit

The skill fetches and rebases before staging your changes. If a conflict surfaces (two engineers updating the same long-lived file like the glossary on the same day — rare), the skill:

1. Aborts the rebase automatically (`git rebase --abort`).
2. Leaves your changes safe in the working tree (unstaged).
3. Reports which file conflicted.
4. Asks you to resolve it by hand, then re-run `/rp-memory commit`.

In practice, with this design, real conflicts happen maybe once a month — and the skill makes them safe to resolve.

---

## File Structure

```
playwright-e2e/docs/
├── README.md                ← you are here
├── MEMORY.md                ← auto-generated index (do not edit by hand)
├── _meta/memory-rules.md    ← governance rules (read first)
├── 10-architecture/         ← framework design, diagrams, plans (1 topic per file)
├── 20-engineering/          ← team workflow, patterns, setup (1 topic per file)
├── 30-decisions/            ← 1 decision per file: YYYY-MM-DD-<author>-<topic>.md
├── 40-domain/               ← product glossary, RemotePass knowledge (1 topic per file)
├── 50-work-log/             ← 1 day per file: YYYY-MM-DD.md
└── 60-skills/               ← Claude Code skills
    ├── rp-memory/           ← the memory skill (SKILL.md, install.sh, config-schema.json, README.md)
    └── claude-finish.md     ← session-end push + PR
```

---

## Future: Qdrant Vector Search

Today the AI loads `MEMORY.md` and a few directly-relevant files. This works while the index fits in context. We will switch to **Qdrant** (vector DB) when any of these is true:

- More than 200 files in `docs/`.
- `MEMORY.md` exceeds 50 KB.
- The AI starts missing relevant records during retrieval.

**What changes at the switch:**

1. Ship a dedicated indexer (separate PR — Python script or Lambda) that embeds and upserts every file, keyed by frontmatter `id`.
2. Wire indexing into a post-merge hook on `main` (or CI).
3. Flip `useQdrant: true` in each user's config.

**What does not change:**

- `SKILL.md`, frontmatter, file paths, commit/PR flow — all the same.
- Files in git remain the **source of truth**; Qdrant is a derived index that can always be rebuilt.
- `/rp-memory` retrieval routes through Qdrant transparently — same skill, no flow changes for users.

The frontmatter (`id`, `type`, `category`, `tags`, `author`, `createdAt`, `updatedAt`) is already shaped to be Qdrant payload — no migration of existing records.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/rp-memory` doesn't appear in Claude Code | `cd playwright-e2e && npm run install-skills` (or `install-skills:local`), then restart Claude Code. |
| "Not inside playwright-e2e/" error | You're in the wrong directory. `cd` to inside the repo and try again. |
| Rebase conflict during commit | The skill aborts the rebase automatically. Resolve the conflict by hand, then re-run `/rp-memory commit`. |
| Skill keeps asking for config on every run | Permissions on `~/.claude/rp-memory.config.json` — your user must own and be able to write it. |
| `MEMORY.md` not updating | The skill regenerates it before every commit. If you wrote a file outside the skill, ask `/rp-memory` to "refresh the index" and it will rewrite the auto-generated block. |
| Need to remove a record | Open the file, delete it, ask `/rp-memory` to regenerate the index. Commit normally. |

---

## References

- Skill body (instructions Claude reads): [`60-skills/rp-memory/SKILL.md`](60-skills/rp-memory/SKILL.md)
- Skill README (how to use, troubleshooting): [`60-skills/rp-memory/README.md`](60-skills/rp-memory/README.md)
- Governance and frontmatter schema: [`_meta/memory-rules.md`](_meta/memory-rules.md)
- Config schema: [`60-skills/rp-memory/config-schema.json`](60-skills/rp-memory/config-schema.json)
- Auto-generated index: [`MEMORY.md`](MEMORY.md)
