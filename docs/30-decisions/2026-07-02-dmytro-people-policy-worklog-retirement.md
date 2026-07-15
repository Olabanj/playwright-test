---
id: 7eab14fb-eafe-599a-92fc-984fd317d9cc
name: 2026-07-02-dmytro-people-policy-worklog-retirement
description: "People Policy for team memory: professional attribution allowed, personal circumstances banned (incl. all absence facts/reasons); docs/50-work-log/ retired to personal memory; full PII sweep of docs/ without git-history rewrite."
metadata:
  type: project
  category: decisions
  tags: ["people-policy", "pii", "work-log", "governance", "memory"]
  author: dmytro
  createdAt: 2026-07-02T12:50:19Z
  updatedAt: 2026-07-02T12:50:19Z
  expiresAt: null
---

# ADR — People Policy for team memory + retirement of `docs/50-work-log/`

## Status

Accepted (2026-07-02).

## Context

An audit (2026-07-02) of the team memory in `playwright-e2e/docs/` found HR / personal-circumstance
leaks concentrated in `docs/50-work-log/`: sick-leave mentions, out-of-office reasons, hours
compensation arrangements, and individuals' whereabouts. This content is exactly what
`memory-rules.md` bans ("Personal information or HR-related content"), yet it kept flowing in.

Contributing causes:

1. **Internal contradiction in `memory-rules.md`.** "What to Save" explicitly encourages
   "Standup outcomes: who owns what, decisions made, blockers, priorities" while "What NOT to
   Save" bans Personal/HR content. Standup summaries naturally carry absence facts and reasons,
   so writers had a rule that simultaneously invited and forbade the same content.
2. **Zero PII rules in the memory-writing agents/skills.** None of the agents or skills that
   write memory (`/rp-memory`, `/morning-digest`, meeting/onboarding memory) carried any
   people/PII filtering instruction — they faithfully transcribed whatever the transcript said.
3. **Leak amplification.** Frontmatter `description` lines fan the leaked content out into the
   auto-generated `MEMORY.md` index and into the Graphify knowledge graph (docs/ is indexed),
   so a single leaked sentence surfaces in every retrieval pass.

## Decision

1. **`docs/50-work-log/` is retired.** Daily standup logs move to personal-only memory. Any
   durable residue in existing work-log files (decisions, engineering findings, domain facts)
   is extracted into the proper homes — `30-decisions/`, `40-domain/`, `20-engineering/` —
   before the folder is frozen.
2. **People Policy — names.** Professional attribution is allowed (who decided X, who owns Y,
   who reviewed Z). Personal circumstances of any named person are banned (health, family,
   location/whereabouts, working-hours arrangements, compensation, mood, private plans).
3. **Absences are fully banned.** Both the *fact* of an absence (sick leave, OOO, day off) and
   the *reason* for it are Personal/HR content and must never enter team memory. If a decision
   depends on availability, record the decision, not the absence.
4. **Cleanup = full file sweep, no history rewrite.** Every existing file under `docs/`
   (bodies *and* frontmatter `description` lines) is swept for People Policy violations. Git
   history is intentionally NOT rewritten: the severity of the leaked content does not justify
   a `git filter-repo` pass that would break every clone and worktree of the shared repo.

## Consequences

- A **People Policy** section is added to `docs/_meta/memory-rules.md`, resolving the
  "standup outcomes" vs "no Personal/HR content" contradiction: outcomes yes, circumstances no.
- All memory-writing agents and skills are patched to reference the People Policy before
  writing any record that names a person.
- `docs/50-work-log/` is frozen with an archive README explaining the retirement and pointing
  to the new homes for durable residue.
- Existing files are swept in place, including frontmatter `description` lines, so the leak
  amplifiers are cleaned at the source.
- `MEMORY.md` is regenerated from the cleaned frontmatter; the Graphify graph rebuilds
  automatically on commit (G1), so the index and graph stop surfacing the leaked content.

## Links

- `docs/_meta/memory-rules.md` — People Policy section (added by this decision).
- Supersedes the work-log convention in memory-rules v1 (`50-work-log/` folder, one-file-per-day
  filename pattern, and "standup outcomes" save guidance as previously worded).
