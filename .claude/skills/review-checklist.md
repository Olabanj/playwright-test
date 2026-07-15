---
name: review-checklist
description: >
  13-item quality checklist applied by test-reviewer-agent to every new or changed test. Failing
  any item flips status to failed_review. Use after test-authoring-agent finishes a batch and
  before the orchestrator marks tests done, after stabilization-agent reports a fix, or before any
  PR touching features/<domain>/tests/ is merged.
metadata:
  owner: dmytro
  capability: review
  status: active
  linear: null
  eval:
    status: none
    ref: null
    lastPassRate: null
    lastRun: null
---

# Review Checklist

## Purpose

A new or changed spec is only `done` when it passes architecture, Playwright-quality, and process gates. This skill enforces a fixed checklist, leaving no room for interpretation drift between reviewers.

## Trigger

- After `test-authoring-agent` finishes a batch and before the orchestrator marks tests `done`.
- After `stabilization-agent` reports a fix — re-run the checklist on the fixed spec.
- Before any PR that touches `features/<domain>/tests/` is merged.

## Inputs

- Path to the new or changed spec file.
- The feature it belongs to and the intent it exercises.
- The change set introduced (touched fixtures, clients, pages, types).

## Procedure

Iterate the 13 items in order. Mark each pass / fail / not-applicable with a one-line reason.

1. **No `waitForTimeout`.** No `page.waitForTimeout`, no `setTimeout`. Use Playwright auto-wait + assertions.
2. **Stable locators.** No `nth-child`, no brittle CSS chains, no XPath unless the DOM forces it. Prefer `getByRole`, `getByLabel`, `getByTestId`, `getByPlaceholder`.
3. **Assertions only in tests.** Page Objects expose locators + actions; `expect` lives in `tests/`, never in `pages/`.
4. **Independent tests.** No ordering dependency. Each test sets up its own state via fixtures or builders. No shared mutable state across tests in a file.
5. **No credentials in code.** No real emails, passwords, tokens. All secrets read via `core/config/env.ts`. No `process.env.*` elsewhere.
6. **`mergeTests` for cross-module composition.** Single-module test imports `test` from `@features/<X>/fixtures`. Cross-module test uses Playwright's `mergeTests`.
7. **Owner-module Flow rule.** When a Flow needs another module, the owner module owns the Flow via constructor injection. No client-composes-client, no page-knows-about-other-module.
8. **Fixtures preferred over `beforeAll`.** Authenticated contexts, seeded data, builder instances — all via fixtures. `beforeAll` is reserved for genuinely once-per-file setup with no test isolation cost.
9. **Types in `types.ts`.** Request, response, picklist types live in `features/<domain>/types.ts`. No inline `any` for response shapes. No interface declared inside a test file.
10. **Typed config only.** `process.env` is read in `core/config/env.ts` and nowhere else. Test code reads `env.<key>`.
11. **Test intent is documented.** The spec name and structure (or a linked scenario/feature doc) clearly describe the behaviour under test. A reviewer can tell what the test proves without reading the implementation.
12. **G5 discovery done before shared-file edits.** If the change touched `core/`, `fixtures/`, `_common/`, `playwright.config.ts`, or renamed a public symbol, `graphify-query` or `impact-analysis` was invoked first (graph discovery + Grep cross-check), `tsc --noEmit` is clean, and cleanup only touches resources this spec created. Verify via the agent's summary or commit message reference.
13. **Architecture lint passed.** `npm run lint:arch` is green for the new/changed files (boundaries + FS checks per `eslint/architecture-rules.json`). No `eslint-disable` of an architecture rule unless an ADR explicitly permits the exception (cite it). A violation here is deterministic — it does not move to `done` until clean.

## Outputs

- A 13-row table: item · pass/fail/n-a · one-line reason.
- Overall verdict: APPROVE / FAILED_REVIEW.
- If FAILED_REVIEW: list the failing items, each with the file/line where it broke, and the verdict the orchestrator acts on.

## Tools & MCPs

- Built-in tools: `Read`, `Grep` (inspect the spec + touched layers), `Bash` (`npm run lint:arch`, `tsc --noEmit`).
- May consult the `remotepass-qa` MCP / `get_pr_impact` for item 12 discovery evidence.

## Examples

- **Invoke:** reviewing `features/expenses/tests/api/add-expense.spec.ts` after a batch → **Outcome:** 13-row pass/fail table; item 1 fails on a `waitForTimeout` → verdict FAILED_REVIEW.

## Evaluation

none — pending QA-283.

## Guardrails

- Skipping items because they look obviously fine. Every item gets a line.
- Approving with "minor issues" notes. There is no "minor" — either it passes or it does not.
- Re-interpreting item wording per case. Read the rule literally.
- Reviewer also being the migrator. The reviewer agent should be a separate invocation, ideally a separate Claude turn, to keep the eye fresh.
- Allowing `test.skip` as a substitute for fixing a failure. A skipped test is not done; it is `blocked` with a recorded reason.
