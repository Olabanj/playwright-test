---
id: layer-responsibilities
name: layer-responsibilities
description: "Single reference for humans and AI: what every file/layer in a feature is responsible for, where each kind of logic lives, how it is reused without duplication, and where it must NOT live. Covers core, client, types, builders, seeding, pages, fixtures, tests; why seeding exists; cross-feature seeding reuse; the no-duplication rule; one-off setup goes in the spec; the test composes from bricks + mergeTests; per-test data cleanup."
metadata:
  type: project
  category: engineering
  tags: ["architecture", "responsibilities", "layers", "seeding", "fixtures", "reuse", "ai-first", "feature-first"]
  author: dmytro
  createdAt: 2026-06-19
---

# Layer & File Responsibilities

The single map of **what each file in a feature is for**. For any piece of logic it lets a human — or an AI agent — answer three questions: **where does it live, how is it reused, and does it belong in the test?**

> **Why this matters.** This framework is built to be written and extended largely by AI agents. That only works if every file has exactly one responsibility and reuse happens **by reference, never by copy**. The detailed architecture of each file type is reviewed and approved file-by-file, in this order: **client → seeding → page → builder → fixtures → tests**. This document is the contract those reviews enforce.

A feature is a folder `features/<feature>/` that owns all its layers. There is **no Flow/Facade layer** — see [`../30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md`](../30-decisions/2026-06-17-dmytro-remove-flow-facade-layers.md).

## Where each kind of logic lives

| Kind of logic | Home | How it is reused | In the test? |
|---|---|---|---|
| One HTTP request | `client.ts` | imported / injected as a fixture | no |
| Multi-step API composition | `seeding.ts` (owner feature) | **import** from the owner feature | no |
| Single-screen UI action | `pages/` (POM) | injected as a page fixture (DI) | no |
| Test-data construction | `builders/` | imported | no |
| Wiring + lifecycle + cleanup | `fixtures.ts` | declared as a fixture in the test (DI) | no |
| Cross-feature fixture assembly | `mergeTests` | in the spec | — |
| The scenario + `expect` | the test | not reused — it *is* the test | yes |

The test holds **only** the scenario and assertions. Everything reusable lives one layer down and is referenced.

## What each file is responsible for

### `core/` — foundation
- **Responsibility:** HTTP mechanics, typed config (`env`), endpoints, `BasePage`, shared types. No domain knowledge.
- **Reused by:** every feature. **Must not:** know about any feature.

### `client.ts` — API client (one per backend boundary)
- **Responsibility:** one method = one HTTP request, returns `ApiResponse<T>`.
- **Reused by:** `seeding.ts`, fixtures, API specs.
- **Must not:** combine multiple requests (that is `seeding.ts`), contain `expect`, import another feature's files.

#### Client return conventions

`BaseApiClient` deliberately never throws on a non-2xx response — negative tests assert
status codes directly (e.g. `time-tracking/tests/api/sessions.error-handling.spec.ts`
expects `404`). A `throw` in the base class would break them. So each client method
picks **one** of three return conventions, on purpose:

| Convention | Method returns | Success check | Use when |
|------------|----------------|---------------|----------|
| **A — mapped value + guard** | a domain value (id, mapped object, `void`) | calls `assertOk` / `assertOkWithId` from `@core/http/assertOk` | a **mutation** the caller expects to succeed; failure should throw, not return a bad value (`signup`, `addExpense`, `approveExpense`). |
| **B — mapped value, no guard** | a domain value (usually a list/object) | none — trusts the read | a **read** whose only sane failure is an exception already raised by transport, or where an empty result is valid (`getCategories`, `getCurrencies`, `listContractorExpenses`). |
| **C — raw `ApiResponse<T>`** | the unwrapped `ApiResponse` | none — the **caller/test** asserts status | the test needs the status code or full body to assert on (negative tests, sign handshakes): `auth.login` / `auth.logout`, `contracts.clientSign` / `contracts.createCurrencyAmendment`, `admin.signAsProvider`. |

Rules:
- Mutations default to **A**. Reads default to **B**. Only choose **C** when a test must
  inspect the raw status/body — never use **C** just to skip writing a guard.
- The success guard for **A** is the shared `assertOk(res, label)` /
  `assertOkWithId(res, label)` in `@core/http/assertOk` — **do not re-implement**
  `if (res.status !== 200 …) throw` inline.
- `assertOk` is **opt-in**: a new mutation author can forget it. That is the accepted
  cost of keeping the no-throw transport contract. A lint rule may enforce it later;
  the base class must not throw.
- **Precondition-read exception (A on a GET).** A *read whose failure makes the test
  unrunnable* — a non-2xx or an empty body means the precondition the test depends on
  does not exist — may use convention **A** (guard + return the unwrapped value), even
  though it is a GET. Example: `ContractsClient.getContract(ref)` calls `assertOk` and
  throws when `body.data` is absent, because a spec that asked for a specific contract
  cannot proceed without it. Use this only when the missing data is an unrecoverable
  setup error, not a valid empty result (a valid-empty read stays on **B**).

#### The convention-C marker (canonical form)

Every convention-C method carries **one** canonical one-line comment directly above its
signature, so a reader sees the contract without inspecting the body:

```typescript
// convention C — raw ApiResponse; caller/test asserts; no assertOk.
async clientSign(...): Promise<ApiResponse<ContractMutationResponse>> { ... }
```

When **every** method in a client is convention C by design (e.g. `TimeTrackingClient`,
whose specs assert `.status` + `.body.result.*` on every call), state it **once** in the
class header instead of repeating the marker — the per-method marker is only for clients
that mix conventions A/B/C.

#### Logging in clients

Transport is logged **once, automatically** by `BaseApiClient.request()` /
`postMultipart()` — `HTTP {method} {url} → {status} ({ms}ms)` on every call. Clients
must not duplicate that.

- A **mutation / composition with domain arguments** logs **one semantic line** at entry:
  `[<Client>] <method> <key-args>` — e.g. `[ExpensesClient] addExpense contract=42 amount=99`.
  The value is the **domain arguments**, not the URL or status.
- A **mutation with no domain arguments does NOT log** (e.g. `auth.logout`,
  `time-tracking.checkHealth`) — there is nothing to correlate beyond the call itself, and
  the transport line already covers it. A bare `logVerbose('[Client] method')` is a
  **duplicate of transport** — remove it.
- Pure **read** methods may omit the semantic line (the transport line already shows the
  call); when reads in a client *do* log, they log **uniformly** — either all reads carry
  the semantic line or none do, not a mix.
- Do **not** move this into a transport interceptor: the domain arguments (`amount=99`)
  would be lost.

### `types.ts` — domain shapes
- **Responsibility:** request/response/picklist types for the feature. No `any` in response shapes.
- **Reused by:** client, seeding, fixtures, tests.

### `builders/` — test data
- **Responsibility:** fluent construction of test-data objects, with defaults. Unique, identifiable names (e.g. `PW <ts>`).
- **Reused by:** seeding, fixtures, tests.
- **Must not:** make HTTP calls or have side effects.

### `seeding.ts` — API composition (replaces Flow)
- **Responsibility:** stateless functions that combine several client calls into one reusable business sequence to reach a precondition/state.
- **Reused by:** API specs (directly) and fixtures (which wrap them and add cleanup). Reused **across features by import** (see below).
- **Must not:** contain `expect`, touch the browser/`page`, or own cleanup (lifecycle is the fixture's job).

### `pages/` — Page Object Model (POM v4)
- **Responsibility:** locators + actions for **one screen**. Multi-step methods are fine if they stay within that screen.
- **Reused by:** UI specs, via a page fixture (DI).
- **Must not:** take an API client, navigate to another screen, contain `expect`, or be `new`-ed inside a test.

**Page-layer rules (uniform across all POMs):**
- **Logging:** every action method (any `async` method that drives the browser) calls
  `logVerbose('<PageName>.<method> <args>')` at entry — e.g.
  `logVerbose('AddExpenseModal.submit')`. This is the page equivalent of the client
  semantic line; it gives a UI-action trace. (Pure getters/locators do not log.)
- **Navigation:** navigate only through `this.goto(path)` inherited from `BasePage`,
  passing a `ROUTES.*` constant — **never** call `this.page.goto(...)` directly. `goto`
  centralises base-URL handling and load-state waits.
- **Imports:** reference other feature files through the `@features/...` alias, never a
  relative `../../` path that climbs out of the current directory.

### `core/ui/BasePage.ts` — shared page foundation
- **Responsibility:** `goto`, common waits, and **cross-cutting UI components** every screen
  shares — toasts in particular: `errorToast` (`.toast-error`) and `successToast`
  (`.toast-success`) live here as `BasePage` getters.
- **Must not be duplicated:** a feature page must **not** re-declare `successToast` /
  `errorToast` locally — inherit them from `BasePage`. Add a new cross-cutting component to
  `BasePage` once a second screen needs it (rule of two).

### `fixtures.ts` — DI + lifecycle
- **Responsibility:** provide ready-made pages/clients (DI) and **factory state-fixtures** that wrap seeding helpers and clean up on teardown.
- **Reused by:** the feature's specs; combined across features with `mergeTests`.
- **Must not:** contain `expect` or the composition logic itself (that lives in `seeding.ts`; the fixture only wires + cleans up).

**Fixture rules (uniform across features):**
- **Naming — avoid `mergeTests` collisions.** A worker-scoped login-account fixture is
  named `<feature>ClientAccount` (e.g. `contractsClientAccount`, `timeTrackingClientAccount`),
  never a bare `clientAccount` — two features merged via `mergeTests` must not collide on a
  generic name. (Exception: auth's `authedClient` keeps its name — it documents the auth
  *state*, not a per-feature account.)
- **No duplicated login helper.** A fixture that needs a logged-in account imports
  `loginAsClientAccount` from `@features/auth/helpers` (the auth owner feature) — it does
  **not** re-declare the same login round-trip locally. `base.fixture` (shared infra) stays
  untouched.
- **Sentinel for sandbox preconditions.** A factory state-fixture that discovers a
  sandbox-resident precondition (a contract of a given type, an existing entity) **may**
  return a sentinel (`0` / `[]`) when the precondition is absent, so the spec self-skips.
  This is an explicit exception to the `assertOkWithId` "succeed-or-throw" expectation —
  document the sentinel and its meaning in the fixture's JSDoc so specs know to guard on it.

### `tests/` — specs
- **Responsibility:** declare the fixtures it needs, perform the scenario, assert. Arrange → act → assert.
- **Must not:** hold any reusable logic, create clients/pages directly, or call `page.goto` outside a page method.
- **Must not import `fs` / Node built-ins.** File and filesystem work (reading fixtures
  files, receipts, multipart payloads) belongs in a client/seeding/builder, not in a spec.
  A spec that needs a file receives it through a fixture or builder. *(Rule stated now;
  enforcement and any existing-spec fixes are deferred to the cleanup phase.)*

## Why we need `seeding.ts`

A test usually needs the system in a specific starting state (a contract exists, an expense is pending, …). Building that state inline in every test means repeating the same chain of API calls everywhere. `seeding.ts` is the **single home** for those reusable chains: written once, called by API specs directly and by UI fixtures for setup. It is the reuse point that keeps multi-step setup out of the tests — the role the old Flow layer used to serve, but as plain stateless functions instead of a class.

## Reusing a seeding helper across features

If feature A needs a chain that already exists in feature B, **import it — never copy it.** The helper has one definition, in its **owner feature** (the feature whose entity it produces). Consumers import:

```typescript
// features/expenses/seeding.ts
import { createContract } from '@features/contracts/seeding';   // reuse, don't duplicate
```

- **Ownership rule:** a helper lives in the `seeding.ts` of the feature whose entity it returns (`createExpenseViaApi` → expenses, `createContract` → contracts).
- **DAG rule:** `seeding.ts` may import other features' `client`/`seeding`, but the graph must stay acyclic. If A→B and B→A would form, move the shared part down to `core/` or inject it via a fixture instead of importing.

## How we avoid duplication

One rule: **every reusable piece has exactly one home, and the test references it.**

- Need it once, in one test → assemble it **inline in the spec** (compose client/builder/page calls directly; no extraction). One-off cleanup goes in `try/finally`.
- A second test needs the same chain → lift it down to its layer: API chain → `seeding.ts`; single-screen steps → a page method; precondition needing cleanup → a state fixture; data → a builder.
- Already exists in another feature → **import it**.

This "rule of two" prevents both duplication and premature abstraction: start inline, extract on the second consumer.

## The test composes from bricks

The test does not contain logic — it stacks ready-made bricks:

```typescript
test('contractor sees a seeded expense @regression', async ({ seedExpense, expensesPage }) => {
  const expense = await seedExpense(new ExpenseBuilder().build()); // arrange: builder + state fixture
  await expensesPage.open();                                       // act: page
  await expensesPage.clickDetailsForExpense(expense.name);         // act: page
  await expect(expensesPage.detailsName).toContainText(expense.name); // assert
});
```

When a test needs fixtures from more than one feature, combine them with `mergeTests` (see [`composition-patterns.md`](composition-patterns.md)):

```typescript
const test = mergeTests(authTest, expensesTest);
```

## Data cleanup

Test data is cleaned **per test**, in fixture teardown (state fixtures track what they created and delete it). One-off data created in a spec is deleted in `try/finally`. A standalone orphan sweep by unique-name + age is the safety net for crashes. Full rationale: [`../30-decisions/2026-06-19-dmytro-per-test-data-cleanup.md`](../30-decisions/2026-06-19-dmytro-per-test-data-cleanup.md).

## Scalability & AI-first intent

Because every file has one responsibility and reuse is by reference, the framework scales by **adding a feature folder of the same shape** — no existing file changes (cross-feature reuse is by import + `mergeTests`). This is also what makes the framework safe for AI agents to extend: an agent can place any new logic correctly by asking the three questions at the top, and a reviewer (human or agent) can check each file against the single responsibility defined here. The per-file architecture is approved one file type at a time using this document as the contract.

## See also

- [`overview.md`](../10-architecture/overview.md) — high-level layers and patterns.
- [`composition-patterns.md`](composition-patterns.md) — concrete `mergeTests`, cross-feature seeding, and DAG examples.
- [`testing-patterns.md`](testing-patterns.md) — the per-layer ✅/❌ contracts.
