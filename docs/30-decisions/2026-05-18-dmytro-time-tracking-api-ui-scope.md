---
id: 54130f26-1e33-5ea0-9f84-01ca2809449a
name: 2026-05-18-dmytro-time-tracking-api-ui-scope
description: "Time tracking automation: 2-week API-first phase, then 2-week UI phase — clarified after scope confusion in standup"
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "time-tracking", "scope", "api", "ui", "coverage"]
  author: dmytro
  createdAt: 2026-05-18T00:00:00Z
  updatedAt: 2026-05-18T00:00:00Z
  expiresAt: null
---

# Decision: Time Tracking Automation — API-First, Then UI (Two Phases)

Time tracking automation is split into two explicit phases:

1. **Phase 1 (2 weeks):** API coverage — target ~100% of API scenarios.
2. **Phase 2 (2 weeks):** UI coverage — main flows; not all API combinations are replicated in UI.

**Why:** Slahudeen confirmed this was the original plan, communicated at project start but not clearly retained by the whole team. Baha and Aleyna were unaware of the explicit two-phase split (they were working API + UI in parallel based on ticket structure). Sergiy vaguely remembered it but agreed the split wasn't clearly documented.

**Clarification on coverage:** API should cover 100%. UI covers principal flows — e.g. for policies, API tests all contract types while UI tests only one selection per creation.

**Deadline context:** Arda is preparing to release time tracking to clients (German client waiting). Team aims to complete current phase by Wednesday 2026-05-20 review checkpoint.
