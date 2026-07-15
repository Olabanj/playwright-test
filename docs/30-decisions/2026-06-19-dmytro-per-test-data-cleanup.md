---
id: per-test-data-cleanup
name: per-test-data-cleanup
description: "Test data is cleaned per test via fixture teardown (primary), with an out-of-run orphan sweep by unique-name + age as a safety net. Each state fixture tracks what it created and deletes it on teardown; one-off setup in a spec uses try/finally. End-of-run bulk delete by name prefix is rejected as the primary mechanism because it is unsafe under parallel runs and a shared sandbox."
metadata:
  type: decision
  category: engineering
  status: accepted
  tags: ["cleanup", "fixtures", "test-data", "isolation", "parallel", "sandbox", "playwright"]
  author: dmytro
  createdAt: 2026-06-19
---

# Clean test data per test (fixture teardown), with an orphan sweep as a safety net

## Decision

Test data a spec creates is deleted **per test**, in **fixture teardown** — not in one bulk pass at the end of the run.

1. **Primary — per-test teardown.** Every state fixture (e.g. `seedExpense`) tracks the ids it created and deletes them after `use()`. Each test leaves the sandbox as it found it.
2. **One-off in a spec — `try/finally`.** Data created inline for a single test is deleted in a `finally` block so cleanup runs even when an assertion fails.
3. **Safety net — an orphan sweep.** A standalone script deletes leftover test data by **unique-name prefix + age** (older than N hours). It runs **outside** any test run (nightly cron or manual), never inline at end-of-run. It catches data leaked by hard crashes where teardown never ran.

## Why per-test, not "delete everything at the end"

| | Per-test teardown (primary) | End-of-run bulk delete by name prefix |
|---|---|---|
| Test isolation | ✅ each test restores the sandbox | ❌ data accumulates across the whole run |
| Parallel runs | ✅ only ever deletes the ids that test created | ⚠️ can delete another worker's in-flight data → flaky |
| Shared sandbox (teammates) | ✅ touches only your own ids | ❌ a broad prefix deletes a colleague's concurrent-run data |
| Hard crash | ✅ teardown runs (and the orphan sweep covers the rest) | accumulates until the end |
| Determinism | ✅ mid-run queries see a clean state | ❌ earlier tests pollute later ones |

**Decisive factor: parallel runs + a shared sandbox.** An end-of-run "delete all by prefix" is only safe when nothing else is running; under parallel workers (or a teammate's concurrent run) it races and can destroy live data. Per-test teardown only ever touches the ids that test created, so it is parallel-safe by construction.

## How to apply

- **Reusable precondition with lifecycle** → a state fixture that tracks created ids and deletes them on teardown. Reference: `seedExpense` in `features/expenses/fixtures.ts`.
- **One-off in a spec** → create via the client inline, delete in `try/finally`.
- **Never rely on teardown alone** — a killed process leaks data; the orphan sweep is the backstop.
- **Enabler — unique, identifiable names.** Builders use a timestamped name (`PW <ts>`), seeders use `qa+...`. This lets both teardown and the sweep target data precisely, and lets the sweep filter by age so it never touches another run's live data.

## References

- [`../20-engineering/layer-responsibilities.md`](../20-engineering/layer-responsibilities.md) — where cleanup sits among the layers.
- [`../20-engineering/composition-patterns.md`](../20-engineering/composition-patterns.md) — state fixtures wrapping seeding helpers.
- [`2026-05-13-dmytro-fresh-test-data-dynamic-fixtures.md`](2026-05-13-dmytro-fresh-test-data-dynamic-fixtures.md) — dynamic fixtures / fresh data direction this builds on.
- [`2026-06-17-dmytro-remove-flow-facade-layers.md`](2026-06-17-dmytro-remove-flow-facade-layers.md) — seeding + factory state-fixtures model.
