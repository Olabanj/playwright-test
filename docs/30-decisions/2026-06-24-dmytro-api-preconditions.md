---
id: api-preconditions
name: api-preconditions
description: "Test preconditions and postconditions are set up and torn down via the API, never by driving the UI. UI is exercised only for the behaviour under test. Multi-step UI navigation as a precondition (e.g. the sign-up wizard) is a temporary exception used only where no API path exists, and is flagged to migrate to API-based setup."
metadata:
  type: decision
  category: architecture
  status: accepted
  author: dmytro
  createdAt: 2026-06-24
  tags: ["preconditions", "postconditions", "fixtures", "seeding", "api", "ui", "composition"]
---

# Preconditions & postconditions go through the API, not the UI

## Decision

Every test's **preconditions** (the state it needs to start) and **postconditions**
(cleanup) are established through the **API**, via factory state-fixtures backed by
`seeding.ts`. The **UI is driven only for the behaviour under test** — never to
reach a starting state that an API call could produce.

Driving the UI through unrelated screens just to arrive at the screen under test is
forbidden as the default: it is slow, brittle (breaks on unrelated selector churn),
and couples a test to flows it isn't testing.

## Temporary exception — multi-step UI wizards with no API entry point

Some flows have **no API to pre-create an intermediate state** — most notably the
client **sign-up wizard** (Account Type → Verify Email → General Info → Company
Info): there is no account yet, so "be at Step 2" cannot (today) be seeded via API.

For these, a **UI-navigation precondition fixture** (`atGeneralInfoStep`, etc.) that
walks the wizard to the required step is allowed **as a temporary measure**, so the
migration is not blocked.

**Every such UI-precondition fixture must carry a TODO referencing this ADR**:
> `// TODO(api-preconditions): replace UI navigation with API-based setup once a
> sign-up/partial-onboarding API path exists. See 2026-06-24-dmytro-api-preconditions.`

When a backend path appears (seed a partially-onboarded account, or a deep-link/token
that lands the user mid-wizard), these fixtures move to `seeding.ts` + API.

## Why

UI preconditions are the single biggest source of slow, flaky suites: a Step-2 test
failing because a Step-1 selector changed is a false signal. API setup is fast,
stable, and keeps each test honest about what it actually verifies. The exception is
scoped narrowly (no-API-path wizards) and time-boxed by the mandatory TODO so it does
not silently become the norm.

## How to apply

- Reusable precondition that an API can produce → factory state-fixture wrapping
  `seeding.ts` (API). This is the default for every feature.
- Cleanup/teardown → API in the fixture teardown (per [[2026-06-19-dmytro-per-test-data-cleanup]]).
- Precondition with no API path (sign-up wizard) → UI-navigation fixture **with the
  mandatory TODO** above. Treat as debt, not a pattern to copy.
- A test should drive the UI only for the step/feature it asserts on.
