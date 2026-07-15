# ADR 2026-06-25 — Enforce WAIT-002 for `waitForTimeout` (close the gate gap)

**Status:** Accepted · **Decider:** Dmytro · **Context:** Ф3 contracts specialist review

## Context
`eslint/architecture-rules.json` listed **WAIT-002** ("No manual timers — setTimeout / waitForTimeout",
status `enforced`) with `enforced_by: "eslint:no-restricted-syntax (setTimeout) + playwright/no-wait-for-timeout"`.
But `eslint/architecture.mjs` `GLOBAL_SYNTAX_BANS` only banned `setTimeout` — the
`playwright/no-wait-for-timeout` rule was **never registered** in the flat config. Net: `page.waitForTimeout(...)`
passed `lint:arch` with no error. The `migration-reviewer-agent` caught this during the Ф3 review; the one
real usage (`features/contracts/pages/frontoffice/BulkImportPage.ts` — a sanctioned verbatim-port settle
delay, already tagged `TODO(flaky)`) had passed by **gap, not by exception**.

## Decision
Enforce `waitForTimeout` via `no-restricted-syntax` (no new plugin) with selector
`CallExpression[callee.property.name='waitForTimeout']`. This bans `*.waitForTimeout(...)` (page/frame)
but deliberately does **not** match `test.setTimeout(...)` (legitimate per-test timeout config — its callee
property is `setTimeout`, and `test.setTimeout` is config, not a manual timer). The catalog `enforced_by`
was corrected to describe the real mechanism.

The single sanctioned usage (`BulkImportPage.waitForUploadSuccess` settle delay) carries an explicit
`// eslint-disable-next-line no-restricted-syntax -- WAIT-002 sanctioned settle delay (TODO(flaky)); ADR 2026-06-25-dmytro-wait002-enforce`
— now an explicit, auditable exception rather than a silent hole. A golden regression case was added
(`eslint/__fixtures__/arch-gate.test.mjs`).

## Consequences
- The gate is now honest: future `waitForTimeout` is blocked at `lint:arch` / pre-commit.
- Cleanup-phase TODO: replace the `BulkImportPage` settle delay with a deterministic signal (row-count /
  network response) and remove the disable, per the migration defer-fixes convention.
- No behaviour change to passing tests (no `.ts` logic touched beyond the disable comment).
