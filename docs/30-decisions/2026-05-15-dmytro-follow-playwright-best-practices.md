---
id: b19e2f19-6648-59ef-bcae-e1d39322f60c
name: follow-playwright-best-practices
description: "Always follow official Playwright docs; never copy patterns from the old test-framework without explicit validation"
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "playwright", "best-practices", "old-framework"]
  author: dmytro
  createdAt: 2026-05-15T00:00:00Z
  updatedAt: 2026-05-15T00:00:00Z
  expiresAt: null
---

# Always Follow Playwright Best Practices — Do Not Copy Old Framework

**Decision:** All architectural and config decisions must be anchored to official Playwright documentation or established community practice. Patterns from the existing `test-framework` repo must not be carried over without explicit validation.

**Why:** The existing `test-framework` has structural debt (no flow layer, no builder pattern, broken config approach, manual auth instead of fixtures). We are building a clean-slate replacement — copying from it reproduces the same problems.

**How to apply:** If a suggested pattern diverges from Playwright best practice, challenge it with arguments before implementing. This applies to config, fixtures, auth, reporters, test structure, and folder layout.
