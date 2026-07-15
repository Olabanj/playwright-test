---
id: 1acbc4ac-a878-53e3-9b3f-8301bcb37820
name: fresh-client-per-spec
description: "Each payments spec creates a fresh client until full suite consolidates; avoids polluted sandbox state per engineer"
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "payments", "client-creation", "fixtures", "sandbox"]
  author: dmytro
  createdAt: 2026-05-14T00:00:00Z
  updatedAt: 2026-05-14T00:00:00Z
  expiresAt: null
---

# Fresh Client Per Spec — Firm Decision (Payments)

**Decision:** Each payments spec file must create a new fresh client for now. Once all payment flows are complete and the full suite runs together, specs will be merged into a suite where a single client is created by the client onboarding spec and shared across the full run.

**Why:** Existing sandbox clients have different settings per environment — tests pass locally but fail on other engineers' environments due to polluted/broken state.

**How to apply:** Any new payment spec file must include client creation in `beforeAll`. Do not reuse existing sandbox accounts for payments automation.

**Confirmed by:** Sergiy and Lukman (standup 2026-05-14).
