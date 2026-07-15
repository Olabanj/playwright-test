---
name: test-run
description: >
  Run the smallest possible validation that proves a change works — lint, typecheck, single spec,
  or full suite. Picks the level matching the change. Use after a test is authored or rewritten,
  after a shared abstraction changed, while stabilizing a flaky failure, or before the orchestrator
  marks a test done.
metadata:
  owner: dmytro
  capability: migration-workflow
  status: active
  linear: null
  eval:
    status: none
    ref: null
    lastPassRate: null
    lastRun: null
---

# Test Run

## Purpose

Time is the most expensive thing in a migration loop. This skill chooses the cheapest validation step that still gives confidence: type errors before a test run; one affected spec before the full suite; smoke tag before regression.

## Trigger

- A test has just been migrated or rewritten.
- A shared abstraction (fixture, client, page object) changed.
- The stabilization agent is investigating a flaky failure.
- Before the orchestrator marks a test `done`.

## Inputs

- Change scope: single file · single module · cross-module · shared infra · config.
- Affected paths.
- Tag filter (optional): `@smoke`, `@regression`, `@deep`, `@critical`, `@slow`.

## Procedure

1. Inspect `package.json` `scripts` for available commands. Typical entries:
   - `npm run lint:arch` — **architecture gate** (eslint-plugin-boundaries + FS checks); fast, no type-info. Enforces the feature-first rules in `eslint/architecture-rules.json`.
   - `npm run lint` — full gold-standard ESLint (type-aware) over source.
   - `npm run typecheck` — `tsc --noEmit`.
   - `npm test` — full Playwright suite.
   - `npm run test:api` — API-only verify lane.
   - `npm run test:smoke` — `@smoke`-tagged subset.
   - `npm run test:regression` — `@regression`-tagged subset.
2. Pick the smallest meaningful level for the change:
   - Single test file: `npx playwright test <file>`.
   - Single module: `npx playwright test features/<domain>/tests/`.
   - Cross-module / shared infra: `npm run test:smoke` first; if green, escalate to `npm run test:regression`.
   - Config / fixtures / `core/`: typecheck first (`npm run typecheck`); then full smoke.
3. For any `playwright-e2e/` source change, run **`npm run lint:arch`** (architecture gate) + `npm run lint` + `npm run typecheck` BEFORE any Playwright invocation — they are seconds, the test run is minutes, and `lint:arch` is the same gate the pre-commit hook enforces (failing early saves a blocked commit). A `lint:arch` failure is a hard stop: fix the violation (see `eslint/architecture-rules.json`), never suppress it with `eslint-disable`.
4. Capture: command, exit code, pass/fail counts, names of failing tests, first stack-trace line per failure.
5. For Playwright failures: surface the trace, video, and screenshot paths from `test-results/` rather than re-running with verbose flags.
6. Hand back failures to the caller — do not attempt fixes here. Fixes belong to `stabilization-agent`.

## Outputs

- Command(s) executed.
- Pass / fail counts.
- Failing-test list with first-line traces.
- Recommended next action: re-run, escalate to stabilization, mark `blocked`, or hand back to the orchestrator as passing.

## Tools & MCPs

- Built-in tools: `Read` (`package.json` scripts, `test-results/`), `Bash` (`npm run lint:arch|lint|typecheck`, `npx playwright test …`).
- Optionally the `playwright-test` MCP for interactive debugging (not required for the cheap-first path).

## Examples

- **Invoke:** one spec just migrated in `features/expenses/tests/api/` → **Outcome:** runs `lint:arch` + `typecheck` (seconds), then `npx playwright test features/expenses/tests/api/add-expense.spec.ts`, reports pass/fail counts and first-line traces, recommends the next action.

## Evaluation

none — pending QA-283.

## Guardrails

- Running the full suite when a single spec would do — wastes minutes per migration step.
- Skipping lint / typecheck because "it usually passes" — they catch breakage cheaper than the runner.
- Re-running with `--debug` or `--headed` blindly. Open the trace zip first.
- Silencing failures by changing assertions to match observed behavior. That belongs to `stabilization-agent` with a root-cause analysis.
- Adding `test.skip` to hide a red test. If it is genuinely blocked, the test goes to `blocked` status, with a recorded blocker.
- Running without first activating the project's Node version — verify with `node --version` against `.nvmrc`.
