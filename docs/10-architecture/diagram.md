---
id: b42dc55e-badc-590e-9232-0702a02281ba
name: framework-architecture-diagram
description: "Layer diagrams for playwright-e2e — Core → Client/Builder → seeding → Pages/Fixtures → Tests; reuse, DRY-routing and scaling diagrams; feature-first layout (features/<feature>/{client,seeding,pages,fixtures,tests}); API/UI split, frontoffice/backoffice; no Flow/Facade"
metadata:
  type: project
  category: architecture
  tags: ["playwright", "diagram", "layers", "architecture", "mermaid", "feature-first", "seeding", "fixtures"]
---

# Architecture Diagram: remotepass-qa

> **Feature keying:** every `features/<X>/` in the diagrams is a **user-facing feature** (`auth`, `contracts`, `payments`, `time-tracking`, …), never a backend microservice. See [`30-decisions/2026-05-22-dmytro-feature-first-layout.md`](../30-decisions/2026-05-22-dmytro-feature-first-layout.md) for the feature-first vs layer-first decision, and [`30-decisions/2026-05-25-dmytro-feature-over-microservice-division.md`](../30-decisions/2026-05-25-dmytro-feature-over-microservice-division.md) for the feature-vs-microservice rule.

> **No Flow/Facade layer.** Multi-step API composition lives in stateless `seeding.ts` helpers; reusable preconditions with lifecycle live in factory state-fixtures; Pages are injected via fixtures (DI); cross-feature tests combine fixtures with `mergeTests`. See [`30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md`](../30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md).

## Layers and reuse (dependencies point downward)

Arrows go only downward. The more arrows converge on a brick, the more it is reused — `client` and `seeding` are the main reuse points.

```mermaid
flowchart TD
    subgraph core["core (no domain)"]
        BASE[BaseApiClient · config · types]
    end
    subgraph feat["features/expenses"]
        CLIENT["client.ts<br/>Layer 1 · HTTP"]
        BUILDER["builders<br/>Layer 2 · data"]
        SEED["seeding.ts<br/>Layer 3 · composition"]
        FIX["fixtures.ts<br/>Layer 4 · DI + cleanup"]
        POM["pages<br/>Layer 5 · POM"]
        APISPEC["tests/api<br/>Layer 6 · API spec"]
        UISPEC["tests/ui<br/>Layer 6 · UI spec"]
    end
    CLIENT --> BASE
    POM --> BASE
    SEED --> CLIENT
    SEED -. uses .-> BUILDER
    FIX --> SEED
    FIX --> POM
    APISPEC --> SEED
    APISPEC --> BUILDER
    UISPEC --> FIX
    UISPEC --> POM
    UISPEC --> BUILDER
```

---

## Where repeated code goes — DRY routing

When code repeats, run it through this funnel. This is the maintenance rule: there is no Flow — reusable API chains go to `seeding.ts`.

```mermaid
flowchart TD
    Q{Code repeats?}
    Q -->|no, 1 test| SPEC["Keep it in the spec"]
    Q -->|yes| Q2{What kind of code?}
    Q2 -->|test-data construction| BUILDER["Builder / factory"]
    Q2 -->|single-screen action| POM["Method in the POM"]
    Q2 -->|API chain| Q3{Needs cleanup?}
    Q2 -->|spans more than 1 feature| OWNER["seeding.ts in the OWNER feature<br/>+ mergeTests"]
    Q3 -->|no| SEED["Function in seeding.ts"]
    Q3 -->|yes| FIX["State fixture<br/>wraps seeding"]
```

---

## One seeding helper across API and UI (no duplication)

A single `seeding.ts` helper serves both test types: API specs call it directly; UI specs go through a factory state-fixture that wraps it and adds cleanup.

```mermaid
flowchart LR
    APISPEC["API spec"] -->|calls directly| SEED["createExpenseViaApi<br/>(seeding.ts)"]
    UISPEC["UI spec"] -->|via fixture| FIX["seedExpense<br/>(fixture)"]
    FIX -->|wraps + cleanup| SEED
    SEED -->|composition over| CLIENT["ExpensesClient"]
```

---

## Feature Structure (API vs UI + role split)

```mermaid
graph TD
    M["Feature: features/<feature>/\n(e.g. contracts, expenses, time-tracking)"]
    M --> A["tests/api/\ntoken-driven tests — any role"]
    M --> U["tests/ui/"]
    U --> FO["frontoffice/\ncontractor + client tests"]
    U --> BO["backoffice/\nadmin tests"]

    A --> T1["<feature>.spec.ts @smoke"]
    A --> T2["<feature>.spec.ts @regression"]
    FO --> T3["<page>.spec.ts @smoke"]
    BO --> T4["<admin>.spec.ts @critical"]

    SC["scripts/<feature>/\n(repo root, NOT a test lane)"]
    SC --> S1["seed-something.ts"]
    SC --> S2["cleanup-sandbox.ts"]
```

> `<feature>` is always a **user-facing capability**, never a backend microservice — see [`30-decisions/2026-05-25-dmytro-feature-over-microservice-division.md`](../30-decisions/2026-05-25-dmytro-feature-over-microservice-division.md).
> Selective runs are done via test tags (`--grep @smoke`) and Playwright projects (`--project=api`), not via separate folders. Standalone `npx tsx` utilities live in repo-root `scripts/`, not under `tests/`.

---

## Scaling to N features

Every feature has the same shape (Client / Builder / seeding / Pages / Fixtures / Tests). Cross-feature tests compose fixtures with `mergeTests`. One runner runs everything.

```mermaid
flowchart TD
    CORE["core + fixtures/base"]
    subgraph M["features/* — same shape each"]
        A["auth"]
        C["contracts"]
        E["expenses"]
        P["payments"]
    end
    A --> CORE
    C --> CORE
    E --> CORE
    P --> CORE
    X["Cross-feature spec"] -->|mergeTests| C
    X -->|mergeTests| E
    RUNNER["playwright.config<br/>projects: api + ui"] -. runs .-> M
```

**No existing file is modified when adding a new feature** — a new `features/<feature>/` folder owns all its layers, and cross-feature tests reach it via `mergeTests`.
