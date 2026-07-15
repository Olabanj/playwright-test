---
id: 3d2b7f4a-1c6e-5a9d-8b02-6f3c1e7a5d90
name: skill-rules
description: "Canonical contract for authoring SKILL.md files in playwright-e2e — frontmatter schema (nested metadata block), body-section contract, conventions for locations/naming/invocation/progressive-disclosure, eval and status enums, the capability taxonomy, and the QA-282 registry stub. The skill linter (tools/skill-lint.mjs) enforces the machine-checkable subset."
metadata:
  type: reference
  category: meta
  tags: ["rules", "governance", "skills", "contract", "template", "lint"]
  author: dmytro
  createdAt: 2026-07-07T00:00:00Z
  updatedAt: 2026-07-07T00:00:00Z
  expiresAt: null
---

# Skill Rules

The contract every `SKILL.md` in `playwright-e2e/` is authored to. It mirrors the role `memory-rules.md` plays for team memory: a single authoritative file that fixes the shape so skills are uniform, discoverable, testable, and machine-readable for the registry (QA-282). Every future skill is written to this contract, and `tools/skill-lint.mjs` (`npm run lint:skills`) enforces the machine-checkable subset.

Introduced by [QA-281](https://linear.app/remotep/issue/QA-281). Copyable skeleton: [`skill-templates/SKILL.md`](skill-templates/SKILL.md).

---

## Language

**English only.** Code, prose, comments, examples — every committed skill artifact is English, consistent with `memory-rules.md` and the repo-wide English-only release gate.

---

## Two locations, one contract

Skills live in two places. Both obey this contract; only audience and packaging differ.

| Location | Audience | Packaging | Loaded by |
|---|---|---|---|
| `.claude/skills/` | Project-local agent helpers | Single-file (`<name>.md`) | Present in-repo; read directly by sub-agents |
| `~/.claude/skills/` | Personal / operator skills | Folder-style (`<name>/SKILL.md` + companions) or single-file | The user's global Claude Code config; not shipped in this repo |

The personal skills (`rp-memory`, `morning-digest`, `claude-finish`, `memory-read`, `memory-update`, `progress-tracking`) were split out of the repo in QA-281 — they remain tools the user runs and still follow this contract, but they no longer live under version control here. Folder-style is used when a skill ships companions (README, config schema, `references/`); single-file is the default for helpers with no companions.

---

## Frontmatter schema

`name` and `description` are the **only** loader-facing top-level keys — the Claude Code skill loader reads these and ignores everything else. All governance metadata lives under a single nested `metadata:` map (mirrors the trusted `memory-rules.md` precedent; a nested map is the safest way to carry extra keys the loader will ignore).

```yaml
---
name: kebab-case-slug              # REQUIRED. Equals dir name (folder skills) or file basename (single-file).
description: >                     # REQUIRED. ~100 words, one paragraph. THE sole triggering signal;
  What the skill does, then explicit trigger enumeration: "Use when <A>, <B>, <phrase C>."
metadata:                          # REQUIRED by contract (ignored by the loader).
  owner: <authorSlug>              # REQUIRED. Same slug vocabulary as memory author (dmytro, baha, …).
  capability: <label>              # REQUIRED. One value from the closed taxonomy below.
  status: draft | active | deprecated   # REQUIRED. Skill lifecycle.
  linear: <ISSUE-KEY | null>       # OPTIONAL. Originating/tracking issue, e.g. QA-281.
  eval:                            # REQUIRED — the QA-283 forward pointer.
    status: none | golden-set | passing   # REQUIRED. Default `none` until QA-283 lands.
    ref: <path-or-id | null>       # REQUIRED once status != none; null while none.
    lastPassRate: <0.0–1.0 | null> # OPTIONAL. Only when status=passing.
    lastRun: <ISO-8601 | null>     # OPTIONAL.
---
```

### `name`
Kebab-case slug. MUST equal the directory name (folder skills) or the file basename (single-file skills). The linter enforces this.

### `description`
One paragraph, ~100 words (linter caps at ~120). This is the **sole triggering signal** the loader uses — state what the skill does, then enumerate triggers explicitly: `Use when <A>, <B>, <phrase C>.` No banned personal content (same People Policy as `memory-rules.md`).

### `metadata.owner`
Author slug from the shared vocabulary used by memory (`dmytro`, `baha`, `aleyna`, …).

### `metadata.capability` — closed taxonomy
Exactly one value. The linter enforces membership. The six-label enum is fixed; examples below are the **project** skills that ship in `.claude/skills/`. The `memory` and `session-lifecycle` labels are reserved for the personal skills (`rp-memory`, `memory-read`, `memory-update`, `claude-finish`, `morning-digest`) that live in `~/.claude/skills/` — those follow this same contract even though they no longer ship in the repo.

| Label | Project skills (`.claude/skills/`) |
|---|---|
| `memory` | — (reserved; personal `rp-memory`, `memory-read`, `memory-update`) |
| `session-lifecycle` | — (reserved; personal `claude-finish`) |
| `context-intake` | clarification-protocol (personal: `morning-digest`) |
| `code-intelligence` | graphify-query, impact-analysis |
| `migration-workflow` | test-run |
| `review` | review-checklist, summary-generation |

Adding a new label is a deliberate change: extend the taxonomy here **and** in `tools/skill-lint.mjs` in the same PR.

### `metadata.status`
Skill lifecycle: `draft` (in progress, not relied on) · `active` (in use) · `deprecated` (kept for reference, being retired).

### `metadata.linear`
Originating or tracking issue key (e.g. `QA-281`), or `null`.

### `metadata.eval` — QA-283 forward pointer
Every skill declares how it is evaluated. This feeds the QA-282 registry health column.

- `status`: `none` (default — the QA-283 golden-set harness does not exist yet) · `golden-set` (a golden set exists) · `passing` (evaluated and green).
- `ref`: path or id of the golden set. MUST be non-null once `status != none`; `null` while `none`.
- `lastPassRate` / `lastRun`: optional, only meaningful when `status = passing`.

Every skill starts at `eval.status: none, ref: null` until QA-283 lands the harness.

---

## Body-section contract

Ordered H2 sections. Required unless marked optional. Extra H2 sections beyond these are tolerated (e.g. helpers keeping their `## Purpose`) — the linter only asserts the required ones are present.

| # | Heading | Req | Purpose |
|---|---|---|---|
| — | `# <Title>` + 1-line intro | ✓ | Human title and one-line summary. |
| 1 | `## Trigger` | ✓ | When to invoke — trigger phrases and conditions (was "When to invoke" in helpers). |
| 2 | `## Inputs` | ✓ | What the skill needs to run. |
| 3 | `## Procedure` | optional | Ordered steps, when the skill has non-trivial flow. |
| 4 | `## Outputs` | ✓ | What the skill produces (files, reports, state changes). |
| 5 | `## Tools & MCPs` | ✓ | Built-in tools (Read/Grep/Bash/…) and MCP servers (`graphify`/`remotepass-qa`, `playwright-test`, …) the skill relies on. |
| 6 | `## Guardrails` | ✓ | Hard rules + anti-patterns (merge of the old "Hard rules" + "Anti-patterns"). |
| 7 | `## Examples` | ✓ | At least one short invocation + expected outcome. |
| 8 | `## Evaluation` | ✓ | Mirrors `metadata.eval`: golden-set location, or "none — pending QA-283". |

**Progressive disclosure:** body under 500 lines (linter-enforced). Overflow → `references/` (folder skills only). Prose-first — no new helper scripts; scripts only for pre-Claude bootstrap (e.g. `install.sh`).

---

## Conventions

- **Naming:** slug is kebab-case; equals dir/file basename. One skill = one concern.
- **Invocation:** a skill is triggered by its `description` (loader) or invoked by name from an agent. Trigger phrases go in `## Trigger`, not only in the description.
- **Location choice:** project-local agent helper → `.claude/skills/` (single-file, shipped in-repo); personal/operator skill → the user's `~/.claude/skills/` (folder-style when it ships companions), not version-controlled here.
- **Behaviour preservation:** refactoring a skill to this contract is structural — do not rewrite the prose or change behaviour in the same change.

---

## Lint (`npm run lint:skills`)

`tools/skill-lint.mjs` is a dependency-free ESM validator (mirrors `tools/arch-checks.mjs`). It globs `.claude/skills/*.md` (personal skills in `~/.claude/skills/` are not version-controlled here and are not linted), and per file asserts:

- `name` present and equals dir/file basename.
- `description` present, non-empty, ≤ ~120 words.
- `metadata.owner` present; `metadata.capability` ∈ taxonomy; `metadata.status` ∈ {draft, active, deprecated}; `metadata.eval.status` ∈ {none, golden-set, passing}; `eval.ref` non-null when `status != none`.
- All required H2 headings present.
- Body < 500 lines.

Violations report as `SKILL-NNN` codes and exit non-zero. The script ships now; wiring it into pre-commit / CI is a later step.

---

## Registry (QA-282) — stub

The nested `metadata:` block is machine-readable so a future skills registry ([QA-282](https://linear.app/remotep/issue/QA-282)) can enumerate every skill with its owner, capability, status, and eval health without parsing prose. QA-282 will build that registry (a generated index over all `SKILL.md` frontmatter); this contract only guarantees the data is present and well-shaped. Not built here.

---

## Evaluation (QA-283) — forward pointer

Every skill's `metadata.eval` and `## Evaluation` section point at the golden-set harness that [QA-283](https://linear.app/remotep/issue/QA-283) will build. Until it lands, every skill is `eval.status: none`. When QA-283 ships, skills gain a golden set and flip to `golden-set` then `passing`, updating `ref`/`lastPassRate`/`lastRun`.
