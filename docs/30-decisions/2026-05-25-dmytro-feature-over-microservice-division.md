---
id: cf17942e-ddaf-5b62-bea1-37a1c7e67138
name: feature-over-microservice-division
description: "Tests in playwright-e2e/ are divided by user-facing feature, never by backend microservice — even while the platform migrates from monolith to microservices. API clients are the only layer that may mirror service boundaries. Resolves the open question left in 10-architecture/plan.md."
metadata:
  type: decision
  category: architecture
  status: accepted
  supersedes: ["the open question at the bottom of 10-architecture/plan.md (Implementation Order)"]
  tags: ["architecture", "modules", "feature-first", "microservices", "test-organization", "migration"]
  author: dmytro
  createdAt: 2026-05-25T00:00:00Z
  updatedAt: 2026-05-25T00:00:00Z
  expiresAt: null
---

# Tests divide by feature, never by microservice

## Decision

Folders under `playwright-e2e/features/` are named after **user-facing features** (`auth`, `contracts`, `expenses`, `time-tracking`, `onboarding`, …), not after backend services.

This holds permanently, including throughout the in-progress monolith → microservices migration on the backend. When backend splits a feature across multiple services, **the test module does not split**. When backend merges services, **the test module does not merge**.

The only layer where backend topology may surface is the API client layer (`features/<feature>/client.ts` or, if multiple services back one feature, multiple client files inside the same module). Tests, builders, seeding, pages, and fixtures stay feature-keyed.

## Why

1. **Tests follow the user, not the infrastructure.** A feature like "hire a direct employee" must not fragment into 5 test folders just because the backend split it across 5 services. The user perceives one feature; the tests describe that one feature.
2. **Stability across backend refactors.** Service boundaries move. A feature in the monolith today becomes its own service in six months, then absorbs an adjacent service a year later. Feature-keyed test folders survive every step. Service-keyed folders force a test-tree refactor on every backend reshuffle — pure overhead, no coverage gain.
3. **Cross-service flows are first-class.** Creating a contract may hit monolith + payments service + KYC service in a single user flow. A feature-keyed test owns that flow end-to-end through one `seeding.ts` helper composing multiple API clients. A service-keyed split would require the same flow to be authored in three places, or to live in some artificial "shared" folder that defeats the structure.
4. **Composition pattern depends on it.** `mergeTests()` + owner-module rule + constructor injection (see [`composition-patterns.md`](../20-engineering/composition-patterns.md) and [`2026-05-22-dmytro-feature-first-layout.md`](2026-05-22-dmytro-feature-first-layout.md)) assume feature modules. If modules track services, every cross-service business operation needs an arbitrary "owner" choice that has nothing to do with the user. Feature-keyed modules give a natural owner: the module whose feature produces the final business entity.

## Two axes, not one

Test organisation and API client organisation are **separate concerns** with separate keys:

| Layer | Keyed by | Example folders |
|---|---|---|
| `playwright-e2e/features/<X>/tests/` | **feature** | `contracts`, `expenses`, `time-off`, `onboarding`, `payments` |
| API client files inside a module | **backend boundary, where relevant** | one module may hold `ContractsClient` + `DeContractClient` + `PaymentsClient` if the feature spans services |

A single feature test reaches across multiple service-keyed API clients via fixture composition. This is the intended pattern.

## How to apply

- **New test** → place under `features/<feature>/` where `<feature>` is the user-facing capability, not the backend boundary.
- **Backend splits a service** → no test folder moves. At most, the affected `client.ts` gains a sibling client file inside the same module; the module's flow, builders, pages, fixtures, and tests are untouched.
- **Backend merges services** → same answer. No test folder moves.
- **One feature truly spans many services** → one module folder still; multiple client files inside it; one Flow that composes them.
- **Ambiguous case** ("is this a feature or a service?") → ask "does a real user describe this as something they do?" Yes → feature. No (queue worker, scheduled job, internal admin-only tool with no user-facing surface) → still goes in a feature module if it backs a user feature; otherwise place under the closest feature, never create a service-keyed top-level folder.

## Why this is the right time to lock it in

The old `test-framework` already organises tests by feature (`tests/modules/{client-registration, contracts, expenses, integration-setup, onboarding, time-tracking}/`) and has done so successfully across the monolith-to-services transition that has already started on the backend. The new `playwright-e2e/` framework continues this — explicitly, with rationale, not by accident.

Locking the rule now (Phase 2 of the migration, only 2 modules built so far) is cheap. Locking it after 10 modules exist would mean either accepting two conventions side by side or doing a painful rename.

## Resolves

This decision closes the **"Open question — module split strategy"** left at the bottom of [`10-architecture/plan.md`](../10-architecture/plan.md#implementation-order). That note said the split (business module vs microservice) was deferred until 2–3 real domains existed. With `auth` and `contracts` migrated and `time-tracking` next, the choice is now made.

## References

- [2026-05-22-dmytro-feature-first-layout.md](2026-05-22-dmytro-feature-first-layout.md) — the orthogonal decision that established `features/<domain>/{client,flow,pages,tests}` over layer-first folders. This decision adds the "what is `<domain>`?" answer to that one.
- [composition-patterns.md](../20-engineering/composition-patterns.md) — the `mergeTests` + owner-feature seeding + fixture-injection mechanics that make feature-first viable for cross-service flows.
- [10-architecture/overview.md](../10-architecture/overview.md), [10-architecture/diagram.md](../10-architecture/diagram.md), [10-architecture/plan.md](../10-architecture/plan.md) — architecture docs updated 2026-05-25 to reflect this decision.
- Old framework precedent: `test-framework/tests/modules/{client-registration,contracts,expenses,integration-setup,onboarding,time-tracking}/` already follows the feature-keyed convention.
