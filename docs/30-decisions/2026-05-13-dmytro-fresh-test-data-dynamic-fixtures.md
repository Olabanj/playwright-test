---
id: 18c6b79c-c1df-5ea7-90f9-651db7df2387
name: fresh-test-data-dynamic-fixtures
description: "Avoid arbitrary sandbox accounts — create fresh setup or use dynamic fixtures that verify conditions, creating missing setup if needed"
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "fixtures", "test-data", "sandbox", "reliability"]
  author: dmytro
  createdAt: 2026-05-13T00:00:00Z
  updatedAt: 2026-05-13T00:00:00Z
  expiresAt: null
---

# Prefer Fresh Test Data and Dynamic Fixtures

**Decision:** Automation should avoid arbitrary existing sandbox accounts. Tests should create fresh clients/setup, or use dynamic fixtures that verify an existing object satisfies the required conditions before reusing it. If conditions are not met, the fixture creates the missing setup and returns it.

**Why:** Existing sandbox accounts may be broken, deactivated, or polluted by prior test runs. Fresh or condition-checked setup makes daily/nightly automation reliable.

**How to apply:** Fixtures should accept required-condition parameters (e.g. contract type, policy config, enabled features) and either find a matching object or create one. Never hardcode a specific existing sandbox account ID.
