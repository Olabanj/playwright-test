---
id: f82f9ff5-f7a2-5143-b308-dfe9c82a077e
name: automation-strategy
description: "Team QA automation workflow — fresh-client rule, fixture approach, PR review rules, sandbox data strategy, coverage guidance, communication rules"
metadata:
  type: feedback
  category: engineering
  tags: ["workflow", "automation", "fixtures", "pr-review", "sandbox", "payments", "time-tracking", "communication"]
---

# Automation Strategy

## Operating Model

- The QA team is moving from ticket-by-ticket manual verification toward project-based automation, planning, and tooling.
- Quality is treated as a shared responsibility: automation should help engineers and QA add or update tests rather than route all checking back to QA.
- The long-term direction is an agent-assisted workflow where clear specs, requirements, and project memory let engineers or QA ask an agent to create or update tests.
- The current automation model is not a seeded/demo-only project; the team is writing actual tests and should understand the larger flow behind each ticket.

## Active Projects (priority order)

1. **Payments flow** — highest priority; end-to-end client payment methods and contractor withdrawal methods.
2. **Time tracking** — parallel priority; API-first, then UI.
3. **playwright-e2e** (new framework architecture) — Dmytro's project, built in parallel while others continue in test-framework.

## Fixture and Environment Setup

- **Dynamic fixtures**: a test declares required conditions (policy type, contract type, enabled features); the fixture returns a matching existing object if safe, or creates the missing setup.
- **Fresh data preferred**: avoid arbitrary existing accounts — they may be broken, deactivated, or polluted by prior runs.
- Daily creation of sandbox clients is acceptable. Use project-identifying keywords in generated client emails/names (e.g. a payments keyword for clients created by payment tests).
- Long-term goal: fully ephemeral environments — create, test, destroy. Implement after 2–3 projects stabilize.

## Fresh Client Per Spec — Firm Decision (2026-05-14)

Each payments spec file must create a new fresh client. **Reason:** existing clients have different settings per environment — tests pass locally but fail on other engineers' environments.

Once all payment flows are complete, specs will be merged into a suite where a single client is created by the client onboarding spec and shared across the full run.

**Confirmed by:** Sergiy and Lukman.

## PR Review Rules

- Do not rely only on AI review or fast approval.
- Reviewers must: run impacted tests, use the PR review channel workflow, include gap analysis/test coverage context.
- Keep reviews focused on critical/classic issues; avoid spending whole days on non-critical AI feedback.
- At least one automation PR was approved even though a test failed when rerun — this is a known quality signal.

## Coverage Guidance

- Tickets are a starting point, not a ceiling.
- If linked prerequisites (client onboarding, contractor onboarding, payment-method enabling, contract setup) are needed to achieve a project goal, cover the minimum useful behavior instead of leaving obvious gaps.
- Large feature areas can become separate projects later.
- Admin payment-method enabling should use a freshly created/onboarded client, not an arbitrary existing account.

## Communication Rules (2026-05-14)

All PR-related and progress discussions must happen in dedicated project channels — not DMs.

**Reason:** DM-only communication on the time-tracking project left four teammates with zero context. Slahudeen flagged this on 2026-05-14.

**Rules:**
- Post PR links immediately when raised.
- Use the PR review channel workflow.
- All coordination visible to the full team.

## Gap Analysis Workflow

1. Assign the Linear issue before starting work.
2. Ask Claude Code to analyze the Linear issue before implementation.
3. After creating the PR, ask Claude Code to compare the Linear issue against completed work to identify missing coverage.

## Test Documentation Gap (2026-05-14)

No formal test case registry (TestRail, Excel, etc.) exists beyond Linear tickets. Slahudeen is looking into a plan. Test cases with steps are critical for AI-assisted code generation and for verifying coverage completeness. Slahudeen has added a test coverage template on Linear as a first step.

## AI-Assisted Automation Guidelines

- Start by building shared ground: rules, context, fixtures, helpers, understanding of generated code.
- Evaluate AI review feedback critically — avoid repeated review loops for non-critical comments.
- The team should understand generated code before merging.
- Team members should assign Linear issues to themselves before starting work.
