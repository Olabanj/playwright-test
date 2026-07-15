---
id: ed01ddba-42ec-5828-aa31-2ca1f2387ac5
name: framework-architecture-overview
description: "8-pattern target architecture for playwright-e2e — single Playwright runner, layer contracts, feature-first module layout (features/<feature>/ owns all layers), tests keyed by user-facing feature not backend microservice, current vs target state"
metadata:
  type: project
  category: architecture
  tags: ["playwright", "architecture", "patterns", "layers", "framework-design", "feature-first"]
---

# remotepass-qa — Framework Architecture

> **Per-file responsibilities.** For what each file is for, where each kind of logic lives, and how to reuse without duplicating, see [`../20-engineering/layer-responsibilities.md`](../20-engineering/layer-responsibilities.md).

> **How code is organised.** Layers are conceptual (Tests → Fixtures → Page/seeding → Client/Builder → Core), but on disk the framework is **feature-first**: each feature owns its slice across all layers (`features/<feature>/{client,seeding,pages,builders,fixtures,tests}`). Features are user-facing capabilities (`auth`, `contracts`, `expenses`, …) — never backend microservices, even during the ongoing monolith → microservices migration. See [`30-decisions/2026-05-22-dmytro-feature-first-layout.md`](../30-decisions/2026-05-22-dmytro-feature-first-layout.md) (feature-first vs layer-first) and [`30-decisions/2026-05-25-dmytro-feature-over-microservice-division.md`](../30-decisions/2026-05-25-dmytro-feature-over-microservice-division.md) (feature-keyed, not service-keyed) for the rationale.

```mermaid
flowchart TB
    subgraph S3["LAYER 3 — TESTS  (specification only, no setup code)"]
        direction LR
        API_TEST["🧪 API test\ntest({ seedContract, contractBuilder })\n→ expect(contractId).toBeDefined()"]
        UI_TEST["🖥️ UI test\ntest({ contractsPage, seedContract, contractBuilder })\n→ expect(rows).toHaveCount(1)"]
    end

    subgraph S23["LAYER 2→3 — FIXTURES  (lifecycle + auto-cleanup)"]
        FIX_BASE["🔑 base.fixture.ts\nlogin once per parallel worker\n(worker scope)"]
        FIX_API["api.fixture.ts\nseeding · builders · auto-cleanup"]
        FIX_UI["ui.fixture.ts\npages · seeding · auto-cleanup"]
    end

    subgraph S2["LAYER 1→2 — COMPOSITION + UI  (seeding helpers + pages)"]
        SEED["🧩 seeding.ts\nstateless API composition\nREUSED in both API and UI tests"]
        POM["📄 Page Object v4\nlocators · actions\nnot expect()  ·  not goto() in tests"]
    end

    subgraph S1["LAYER 1 — HTTP + DATA  (atomic operations)"]
        CLIENT["🌐 API Client\n1 method = 1 HTTP request\nApiResponse‹T› instead of any"]
        BUILDER["🏗️ Builder\ncontract.fixed().usd().monthly().build()\ndata only, no HTTP"]
    end

    subgraph S0["LAYER 0 — FOUNDATION  (no business logic)"]
        CORE["⚙️  BaseApiClient · env · ENDPOINTS · api.types.ts"]
    end

    API_TEST --> FIX_API
    UI_TEST  --> FIX_UI
    FIX_API  --> FIX_BASE
    FIX_UI   --> FIX_BASE
    FIX_API  --> SEED
    FIX_UI   --> SEED
    FIX_UI   --> POM
    SEED     --> CLIENT
    SEED     --> BUILDER
    CLIENT   --> CORE
    POM      --> CORE

    style S3  fill:#1e293b,stroke:#38bdf8,color:#f1f5f9
    style S23 fill:#1e3a5f,stroke:#60a5fa,color:#f1f5f9
    style S2  fill:#1e4620,stroke:#4ade80,color:#f1f5f9
    style S1  fill:#3b1f52,stroke:#c084fc,color:#f1f5f9
    style S0  fill:#3b2200,stroke:#fb923c,color:#f1f5f9
```

## One sentence per layer

| Layer | What it does |
|-------|-------------|
| **Tests** | Only declares required fixtures and contains `expect()` — no setup code |
| **Fixtures** | DI of pages/clients; factory state-fixtures seed preconditions and delete everything created after the test |
| **seeding** | Stateless helpers wrapping several client calls into one reusable sequence; reused by API specs *and* by fixtures for UI setup |
| **Page Object** | Encapsulates locators and actions; `expect()` — only in tests, `goto()` — only inside the page |
| **API Client** | One method = one HTTP request; typed `ApiResponse<T>` instead of `any` |
| **Builder** | Fluent test data creation without HTTP calls |
| **Core** | Technical foundation: HTTP mechanics, config, types — nothing about RemotePass |

## Patterns at a Glance

| Pattern | Lives in (feature-first layout) |
|---------|---------|
| ISTQB Three-Layer Architecture | `features/<feature>/{client,seeding,pages,tests}` — every feature owns all layers |
| API Composition | `features/<feature>/seeding.ts` — stateless helpers; reused by API specs and wrapped by factory fixtures (no Flow/Facade — see [2026-06-17 ADR](../30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md)) |
| Builder Pattern | `features/<feature>/builders/` |
| Fixture Pattern | `features/<feature>/fixtures.ts` (Playwright `test.extend()`, factory state-fixtures, `mergeTests`) + cross-cutting `fixtures/base.fixture.ts` |
| Page Object Model v4 | `features/<feature>/pages/{frontoffice,backoffice}/` — injected via fixtures (DI) |
| API Client Pattern | `features/<feature>/client.ts` (one file per backend boundary inside the feature — features that span multiple services hold multiple client files) |
| **Config Pattern** | `core/config/env.ts` — single typed entry point for env vars, no `process.env` elsewhere |
