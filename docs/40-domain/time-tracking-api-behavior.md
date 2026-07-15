---
id: 390c1747-bfb8-510f-9d33-3cdb2f5b12bf
name: time-tracking-api-behavior
description: "Time-tracking API quirks: manual entry vs tracker share one endpoint but differ in payload; undocumented submit-after-end step required for client visibility"
metadata:
  type: reference
  category: domain
  tags: ["time-tracking", "api", "manual-entry", "tracker", "undocumented-endpoint"]
  author: dmytro
  createdAt: 2026-05-20T00:00:00Z
  updatedAt: 2026-06-10T14:34:13Z
  expiresAt: null
---

# Time-Tracking API Behavior

Discovered during standup 2026-05-20 (Baha).

## Manual Entry vs Tracker — Same Endpoint, Different Payload

Manual time entry and tracker **both use the same endpoint** but differ in what they send:

| Mode | Payload |
|------|---------|
| Manual entry | Sends `start_time` + `end_time` — backend records the explicit interval |
| Tracker | Sends only `timezone` — backend starts the timer automatically |

Backend distinguishes the two modes by the presence of `start_time`/`end_time` in the request.

**Why it matters for tests:** these must be treated as separate test flows even though they share one endpoint. Mixing them in a single spec causes false coverage.

## Undocumented: Submit-After-End-Session Step

After ending a tracker session, the worker must call a separate **submit** endpoint before the session appears to the client. This is **not in the old Swagger documentation**.

- End session → session exists on worker side only
- Submit session → session becomes visible to client for approval
- Without submit, tests that check client-side visibility will fail silently

## Policies, Session APIs and Quirks (investigation 2026-06-10)

Discovered while cataloguing the legacy suite (incl. the expanded feature/time-tracking branch):

- **Policies are assigned by CONTRACT id, not worker id** — the `policy.workers` array stores contract ids; policy-by-contract resolution and worker assignment all key on contracts.
- **`timeBasis` enum diverges between create and read**: create accepts `flexible | schedule_window | total_hours`, but some read endpoints report `fixed | flexible` — an undocumented inconsistency to verify per endpoint.
- **Two parallel session APIs coexist in `TimeTrackingAPI`**: the legacy `clockIn/clockOut/pauseSession/resumeSession/getActiveSession` surface (the whole legacy `sessions.spec` describe is skipped — effectively dead) and the current **time-sessions** surface (`createTimeSession / pauseTimeSession / resumeTimeSession / endTimeSession / getActiveTimeSessionByContract`). Migrate only the latter.
- **Active-session lookup is contract-scoped**: `GET /time-sessions/contracts/{id}/active` returns **204** when no active session exists.
- **Completed auto-tracker sessions currently return `endTime=null`** — a live backend bug (legacy TC carries a TODO).
- **Three system default policies** exist per company; deletion is blocked and worker-type is locked on them (PD-13481).
- **8 worker types** are accepted on policy create/PATCH; policy wizard scope-2 adds granularity per worker type and overtime multiplier options. Cross-compatibility-group type changes should be rejected (PD-13413, currently xfail) and `keepWorkers=true` on type change is ignored by BE (PD-12929, xfail).
- **Schedule-window policies enforce day windows on manual entries** — out-of-window days are rejected with a human-readable error containing the day name (PD-11419/11755/11380/11417); decimal overtime thresholds are accepted (PD-13703).
