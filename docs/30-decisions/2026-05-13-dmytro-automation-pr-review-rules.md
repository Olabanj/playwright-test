---
id: fc281632-639b-5365-ba71-2b6ce1619d98
name: automation-pr-review-rules
description: "Automation PR reviewers must run impacted tests, post results in PR review channel, include gap analysis — not rely on AI/fast approval"
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "pr-review", "process", "automation", "quality"]
  author: dmytro
  createdAt: 2026-05-13T00:00:00Z
  updatedAt: 2026-05-13T00:00:00Z
  expiresAt: null
---

# Run Tests and Use Gap Analysis Before Automation PR Approval

**Decision:** Automation PR reviewers must not rely only on AI review or fast approval. Reviewers must: run impacted tests, use the PR review channel workflow, and include gap analysis/test coverage context before approving or moving work to completed.

**Why:** A standup review found that an automation PR had been approved even though a test failed when rerun. Fast AI-only review misses coverage gaps and intermittent failures.

**How to apply:** Before approving any automation PR: (1) run the impacted tests locally, (2) post results in the PR review channel, (3) include a short gap analysis note in the PR review.
