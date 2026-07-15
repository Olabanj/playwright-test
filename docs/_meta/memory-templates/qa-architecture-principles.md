---
name: qa-architecture-principles
description: Durable QA / AQA architectural rules. Read by qa-architect-agent before design decisions.
metadata:
  type: feedback
---

# QA architecture principles

## Core rules

1. **Test pyramid.** API tests cover business invariants; UI tests cover user-visible behavior. Push as much verification down to the API layer as the contract allows.
2. **Tests are documentation.** A test name reads as a sentence describing user intent. If a future reader needs the source to understand the intent, the name is wrong.
3. **Independence.** Each test sets up its own state. No ordering dependencies. No shared mutable state across tests.
4. **Determinism over coverage.** A flaky test is worse than a missing test. If determinism cannot be achieved, the test goes to `blocked` rather than `done`.
5. **Auto-wait everywhere.** Never `waitForTimeout` / `setTimeout`. Assertions provide the wait.
6. **Locator stability.** `getByRole` / `getByLabel` / `getByTestId` / `getByPlaceholder`. No `nth-child`, no brittle CSS chains.
7. **Premature abstraction is the enemy.** Three concrete consumers, then abstract. Two is a coincidence, one is YAGNI.
8. **Compose, don't centralise.** Cross-module composition via `mergeTests`, not via god-files.
9. **Root cause over symptom.** A failing test reveals a bug somewhere: in the test, in the abstraction, or in the product. Always classify and fix the layer where it belongs.

## Why these rules

Each rule traces to a past incident or a project decision in `docs/30-decisions/`. When in doubt, cite the ADR — the rule is downstream of the rationale, not the other way around.

## How to apply

- The reviewer enforces these via the 13-item checklist (`.claude/skills/review-checklist.md`).
- The architect agent invokes these when adjudicating pattern choices.
- The migration agent encodes them as anti-patterns it must avoid per spec.
