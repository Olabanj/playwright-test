# Test Framework Strategy — presentation and workshop (2026-06-16)

Materials for a local presentation (open the markdown in an editor + share the screen).

## TL;DR

Over a month on the team I studied the **old framework** (legacy, hundreds of tests) and the **new one**
(`playwright-e2e/`, a clean feature-first architecture). My thesis: porting legacy line by line is
slow and fraught with pitfalls. The better approach is to **rebuild** the tests on the new architecture with
the help of AI, taking only the *flow/intent* from legacy, verifying that the flows work, and reconciling them with
the backend. To this end we have built: an **agentic system** (orchestrator + 14 sub-agents), safety
**gates** (G1–G8 + HITL), and **self-learning Graphify memory** (a graph of code + team memory,
auto-rebuilt on commit).

Two forks for the next 2 weeks:

- **Plan A (recommended)** — migration: we adopt the new architecture and start the agentic pipeline.
- **Plan B (not recommended)** — we stay in the legacy repo and fix it in place.

## Ready-made presentation

**[test-framework-strategy.pptx](test-framework-strategy.pptx)** — 12 slides with speaker notes
in Russian (for reading during the talk). Opens in PowerPoint / Keynote / Google Slides.
The notes are in presenter mode (Presenter Notes). The markdown docs below are the source of truth and an expanded
version of the same material.

## Reading order

| # | File | What's inside |
|---|------|-----------|
| 1 | [00-talk-track.md](00-talk-track.md) | Talk script by "slides" — what to say |
| 2 | [01-architecture-rationale.md](01-architecture-rationale.md) | Architecture by layers and patterns — **why** it's done this way |
| 3 | [02-workshop-test-case-to-autotest.md](02-workshop-test-case-to-autotest.md) | Workshop "from a test case to an autotest" (the `expenses` case) |
| 4 | [03-plan-A-migration-2-weeks.md](03-plan-A-migration-2-weeks.md) | Plan A — full migration (recommended) |
| 5 | [04-plan-B-fix-current-2-weeks.md](04-plan-B-fix-current-2-weeks.md) | Plan B — fix legacy in place (not recommended) |
| 6 | [05-old-vs-new-comparison.md](05-old-vs-new-comparison.md) | Old vs new arch. — "gap → solution → benefit" tables (why migrate) |

## How to run the meeting

1. Go through `00-talk-track.md` top to bottom (≈15–20 min).
2. On the "Architecture" block, optionally open `01-architecture-rationale.md` for depth.
3. Run the workshop using `02-workshop-test-case-to-autotest.md` (≈10–15 min), opening the actual files.
4. Show both forks (`03`/`04`) and close with a request for a decision on Plan A.
