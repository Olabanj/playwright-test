---
id: 63b920aa-8fe4-5a48-8651-b8f8c9ffdc4b
name: 2026-05-25-baha-auto-clockout-test-parked
description: "Auto-clockout time-tracking test parked: comment out until backend offers an instant-trigger endpoint; Baha's prototype trigger endpoint blocked by repo write-access and pushback from backend"
metadata:
  type: project
  category: decisions
  tags: ["time-tracking", "auto-clockout", "blocked", "backend-coordination"]
  author: baha
  createdAt: 2026-05-26T08:00:00Z
  updatedAt: 2026-05-26T08:00:00Z
  expiresAt: null
---

# Auto-clockout test parked until backend trigger exists

> Note: captured from the standup transcript on 2026-05-25 (not yet corroborated by a Slack thread — `unverified-via-slack`). Reflect any Slack follow-up here.

## Context
Time-tracking feature includes **max-allowed end time / auto-clockout**: the platform auto-ends a session each hour. A faithful end-to-end test would have to wait up to 1 hour, which is unacceptable in CI.

Baha's first proposal (suggested by Claude) was to isolate this test into a nightly-only run. Baha rejected that and instead built a backend endpoint in the time-tracking service that triggers the auto-clockout immediately on demand — allowing the test to run in seconds.

## Blocker
- Baha has **no write access** to the time-tracking repo, so the endpoint cannot be merged from his side.
- Muhammad (backend) pushed back with the question "why not just use the normal end-session endpoint?" and concluded the test "will not be in the best shape" if the trigger endpoint is not adopted.
- Roman did not follow up. No backend ownership confirmed.

## Decision (Slahudeen, on the call)
Comment out the auto-clockout test for now. Re-enable when one of:
1. The trigger endpoint lands in time-tracking backend, OR
2. An alternative test approach is agreed with backend.

The test is **not deleted** — it stays in source, just disabled, so the open question is visible and not lost.

## How to apply
- Do not silently drop the test. Tag it `.skip` with an inline comment pointing to this decision file.
- When migrating tests to the new framework, carry this skipped test across — the new framework should not "fix" it by deleting; it remains a tracked gap.
- If the backend trigger endpoint lands, re-enable and add coverage for the trigger endpoint itself.
