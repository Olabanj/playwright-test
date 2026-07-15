# ADR 2026-06-30 — Shared `assertOk` + explicit client return & logging conventions

**Status:** Accepted · **Decider:** Dmytro · **Context:** Architectural unification (Part A, A1–A3) across all 6 feature clients

## Context
An architecture review of the feature-first framework (canon: `features/expenses/`)
found the skeleton mature; the gap is **inconsistent application** of patterns across the
6 API clients, not the structure itself.

Three concrete symptoms:

1. **Duplicated error handling.** A `success-or-throw` guard
   (`if (status !== 200 || body?.success === false) throw …`) is hand-rolled in ~13
   places (admin ×3, contracts ×2, expenses ×4, onboarding ×2, plus duplicates). The
   exact same helper already exists privately as `OnboardingClient.assertOk`. There is
   no shared version in `core/`.
2. **Three return conventions chosen ad hoc** — mapped-value+guard, mapped-value-no-guard
   (reads), and raw `ApiResponse` (sign handshakes / negative tests) — with no written rule.
3. **Inconsistent `logVerbose`.** Transport is already logged once in
   `BaseApiClient.request()`; on top of it 40 per-method `logVerbose` lines exist
   (time-tracking 19, expenses 7, …, auth 0), many of them bare `'[Client] method'`
   strings that just duplicate the transport line.

A hard constraint frames all three: `ApiResponse<T>` **deliberately does not throw** on
non-2xx, because negative tests assert status codes directly (e.g.
`time-tracking/tests/api/sessions.error-handling.spec.ts` expects `404`). A `throw` in
the base class would break those tests. So the fix cannot be "make the base class throw".

## Decision

1. **Shared guard in `core/http/assertOk.ts`** — two free functions, opt-in, no logging:
   - `assertOk(res, label): void` — throws unless `200 ≤ status < 300` and the body did
     not flag `success: false`.
   - `assertOkWithId(res, label): number` — `assertOk` plus extract `body.data?.id ?? body.id`,
     throwing if absent (for create-mutations like `addExpense`).

   These are **free functions, not wired into `BaseApiClient`** — the no-throw transport
   contract is preserved. The 13 inline guards migrate to these (Batches 2–4), and the
   private `OnboardingClient.assertOk` is removed in favour of the core version.

2. **Document the three return conventions (A/B/C)** in
   `docs/20-engineering/layer-responsibilities.md` (`client.ts` section): mutations default
   to A (guard), reads to B (no guard), and C (raw `ApiResponse`) only when a test must
   inspect the status/body. Convention C members are unchanged by design:
   `auth.login` / `auth.logout`, `contracts.clientSign` / `contracts.createCurrencyAmendment`,
   `admin.signAsProvider`.

3. **Document the `logVerbose` rule** in the same doc: one semantic line
   `[<Client>] <method> <key-args>` per mutation/composition; reads may omit it; bare
   no-arg lines that duplicate transport are removed. Not moved into an interceptor —
   domain args (`amount=99`) would be lost.

## Consequences
- One definition of the success guard; new mutations import it instead of re-deriving it.
- **Accepted trade-off:** `assertOk` is opt-in, so a new-mutation author can forget to call
  it. That is the price of keeping the no-throw contract. Mitigation is a future lint rule
  ("a void/number-returning client mutation must call `assertOk`"), **not** a base-class throw.
- The success window widens from `status === 200` to `200–299`; for the affected mutations
  (all expect 200) this is strictly safer — a 201/204 success no longer wrongly throws — and
  negative tests are unaffected because they live on convention C and assert codes themselves.
- Convention C and skipped tests are untouched. payments-e2e (branch `ai-memory-code-2-test`)
  is out of scope (source of truth = `main`).
- Rollout is batched under gates G2 (`tsc`) / `lint:arch` / G3 (affected tests) / G8 (cap 3–5):
  Batch 1 = this foundation (file + docs + ADR, no client edits); Batches 2–4 migrate the
  clients (expenses+auth, admin+onboarding, contracts+time-tracking).
