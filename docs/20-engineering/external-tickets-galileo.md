---
id: 4ec8048b-fefa-59d6-a60c-a2a59440bf29
name: external-tickets-galileo
description: "Cross-team Galileo tickets affecting QA autotests — currently GAL-35 OTP-bypass-9999 not honored on contractor/worker sandbox signup; assigned to Roman as agentic-flow test drive"
metadata:
  type: reference
  category: engineering
  tags: ["linear", "galileo", "external-tickets", "otp", "sandbox", "agentic-flow"]
  author: dmytro
  createdAt: 2026-05-26T08:00:00Z
  updatedAt: 2026-05-26T08:00:00Z
  expiresAt: null
---

# Cross-team tickets in Linear "Galileo" project

QA has no Jira access for backend tickets and the team has not migrated to Linear yet, so cross-team work that affects our autotests is tracked under the **Galileo** Linear project. Assign Roman by default — he is also using these as test cases for his own agentic flow.

## Open tickets

### GAL-35 — OTP bypass code 9999 not honored on contractor/worker signup in sandbox
- Linear: `https://linear.app/remotep/issue/GAL-35`
- Filed: 2026-05-25 by Dmytro
- Channel announcement: `#qa-techteam` (2026-05-25 13:25 IDT), `<!channel>` ping
- Owner: Roman (test-driving agentic flow)
- **Impact on QA:** when this fix lands, every autotest that currently signs up sandbox contractor/worker accounts using bypass code `9999` will start failing — those flows need to be migrated to the new OTP logic. Treat fix announcement as a forced-migration trigger for the relevant specs.
- Related team memory: [[otp-bypass-client-vs-worker]]

## How to apply
- Before writing a new sandbox signup helper, check this list — if a related GAL ticket is open, design the helper so the OTP code is configurable, not hard-coded.
- When a GAL ticket is closed, run the relevant autotests against sandbox the same day to surface migrations needed.
- When adding new GAL tickets here, include: link, owner, what breaks for QA when it lands, related test files.
