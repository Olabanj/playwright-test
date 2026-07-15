---
id: 955aef15-764a-5165-bff2-217a04099b6c
name: gap-analysis-before-after
description: "Use AI gap analysis on Linear issue before implementation and against the PR after — tickets are a starting point, not a ceiling"
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "process", "linear", "coverage", "gap-analysis"]
  author: dmytro
  createdAt: 2026-05-06T00:00:00Z
  updatedAt: 2026-05-06T00:00:00Z
  expiresAt: null
---

# Use Gap Analysis Before Starting and After Completing Automation Work

**Decision:** Assign the Linear issue before starting work. Ask Claude Code to analyze the Linear issue before implementation. After creating the PR, ask Claude Code to compare the Linear issue against completed work to identify missing coverage.

**Why:** Tickets are a starting point, not a ceiling. Coverage gaps are easy to miss without explicit analysis.

**How to apply:** (1) Assign issue → (2) analyze issue with AI → (3) implement → (4) raise PR → (5) run gap analysis against completed work.
