---
id: b8af8121-b693-52d6-9d51-b9cebe416533
name: migration-plan
description: "Migration plan from legacy test-framework to playwright-e2e — four phases (foundation, module migration by priority, AI tooling, wrap-up); tracked in Linear project linked below; supersedes ad-hoc per-module porting"
metadata:
  type: project
  category: architecture
  tags: ["migration", "roadmap", "phases", "linear", "test-framework"]
  author: dmytro
  createdAt: 2026-05-19T00:00:00Z
  updatedAt: 2026-05-19T00:00:00Z
  expiresAt: null
---

# Migration Plan — test-framework → playwright-e2e

## Goal

Replace the legacy `test-framework` (structural debt: 3-lane folders, scattered configs, mixed assertions, no flows, no builders) with the new `playwright-e2e/` framework built on the ISTQB three-layer architecture and the 8 patterns documented in `overview.md`, `plan.md`, `diagram.md`. Migrate the existing test surface **module by module or by business flow**, rewriting each unit from scratch against the new architecture rather than mechanically porting code.

## Tracking

Linear project: [playwright-e2e: Framework Rewrite & Migration from test-framework](https://linear.app/remotep/project/playwright-e2e-framework-rewrite-and-migration-from-test-framework-be288bcf74f3).

One issue per migration unit. Filter / group by the `phase-*` labels on QA team.

## Migration unit

Each Linear issue covers one of:

- **Module** — single isolated module (e.g. `time-off`).
- **Flow** — business flow that crosses multiple modules. The issue body lists `Touches modules: <comma-separated>`.

Order in Phase 2 is **priority-driven**, not size-driven. What unblocks team work soonest goes first. Difficulty is a hint, not a contract — reshuffle as priorities change.

## Phase 0 — Already done

Captured as `phase-0-done` issues with state Completed:

- Architecture documentation (`docs/10-architecture/`: overview, plan, diagram).
- Engineering docs (`docs/20-engineering/`: automation strategy, testing patterns, local setup).
- Decision records (`docs/30-decisions/`).
- Domain glossary (`docs/40-domain/glossary.md`).
- Team memory system (`/rp-memory` skill, auto-regenerated `MEMORY.md`, `_meta/memory-rules.md`).
- Integration plan draft (`docs/10-architecture/integration-plan.md`, finalized in Phase 3).

## Phase 1 — Foundation

Blocks every migration unit. Issues labelled `phase-1-foundation`:

1. Bootstrap workspace — `package.json`, `tsconfig.json`, path aliases, lint/format.
2. Single `playwright.config.ts` with three projects (`api`, `frontoffice`, `backoffice`).
3. `core/config/env.ts` — typed env loader, the only entry point that reads `process.env`.
4. Core HTTP client (the BaseAPI replacement) — fetch wrapper, retries, structured logging, auth header injection. No business logic.
5. Base `test.extend()` fixtures — auth, request, page; login once per worker; auto-cleanup.
6. CI integration — GitHub Actions matrix job per project, tag filtering, artifacts.
7. Team review of architecture docs (mandatory before next demo, per decision `2026-05-18-dmytro-mandatory-architecture-review.md`).

## Phase 2 — Migration (priority-driven)

Issues labelled `phase-2-migration`. The current ordering hint at project creation time:

1. `time-tracking` core — active team work; first tests we want green in CI.
2. `payments` core — second active track; Sergiy's tests ready to port.
3. Flow: contractor registration → contract sign → first payment — proves layered architecture wiring end-to-end.
4. `contracts` — base for payments and time-tracking flows.
5. `onboarding` (KYC + KYB + signatures) — used by most flow-issues.
6. `time-off` (PTO + Public Holiday policies) — self-contained domain.
7. `expenses` — medium complexity.
8. Flow: EOR onboarding + payroll — hardest end-to-end; locales + multi-phase.
9. `eor` + DE-specific modules — closes remaining surface.

### Module-issue body convention

Every Phase 2 issue starts with:

```markdown
**Type:** module | flow
**Touches modules:** <comma-separated list — only for flow-issues>
**Why now:** <one line — what blocks or what business need this unlocks>
```

### Module-issue checklist

```markdown
- [ ] Inventory old test cases (count, file paths, tags)
- [ ] API client (Layer 1) — one method per endpoint
- [ ] Builders for module's domain entities
- [ ] Reusable composition in `seeding.ts` (stateless) wrapped by factory state-fixtures — no Flow layer
- [ ] Pages (POM v4) — frontoffice and/or backoffice
- [ ] Fixtures — module-scoped, auto-cleanup
- [ ] API tests — tagged @smoke / @regression / @critical
- [ ] UI tests — principal flows only
- [ ] Gap analysis vs old framework coverage (before/after)
- [ ] Update docs/40-domain/glossary.md if new terms surfaced
- [ ] PR review per automation-pr-review-rules.md
```

### Flow-issue checklist

```markdown
- [ ] Map the flow: list every API call + UI step
- [ ] Confirm all touched modules have at least their API clients in place (link blockers)
- [ ] Add or extend reusable composition in `seeding.ts` (stateless) wrapped by factory state-fixtures — no Flow layer
- [ ] Add or extend Pages if UI is involved
- [ ] Add or extend Fixtures for cross-module setup/cleanup
- [ ] API test (happy path + 1-2 negative)
- [ ] UI test (principal path)
- [ ] Gap analysis vs equivalent flow in old framework
- [ ] PR review per automation-pr-review-rules.md
```

## Phase 3 — AI tooling & shared skills

Issues labelled `phase-3-ai-tooling`:

- Finalize the integration plan (`docs/10-architecture/integration-plan.md`).
- Shared `/generate-test` skill — Linear ticket + Swagger spec → proposed test cases aligned with the 8 patterns.
- Planner / generator / healer subagents — coverage of a module end-to-end.
- Shared PR-review skill — fixed rule set (logVerbose, naming, path aliases, no `process.env` outside `core/config/env.ts`, gap-analysis link).
- **Architecture-guard skill** — dedicated skill whose only job is enforcing the architectural patterns (layer contracts, no `expect()` in pages/fixtures, no `goto()` in tests, builders without HTTP, single config, single env entry point, API composition via `seeding.ts` with no Flow/Facade layer, POM v4, tag discipline). Distinct from PR-review skill — code conventions vs architectural invariants.
- Long Term Memory: Qdrant readiness — switch the memory index to Qdrant past the thresholds documented in `_meta/memory-rules.md`.

## Phase 4 — Wrap-up

Issues labelled `phase-4-wrap-up`:

- Decommission `test-framework` once every module is migrated and CI has been green for a week.
- Migration retrospective — capture lessons in `docs/50-work-log/`; update `docs/20-engineering/automation-strategy.md` if patterns shifted.

## Governing decisions

This plan is anchored to the decisions in `docs/30-decisions/`:

- `2026-05-15-dmytro-drop-3-lane.md` — flat layout + tags, no scripts/probes/verify ceremony.
- `2026-05-15-dmytro-single-config-projects.md` — single `playwright.config.ts` with `projects[]`.
- `2026-05-15-dmytro-follow-playwright-best-practices.md` — anchor every pattern to official Playwright docs.
- `2026-05-14-dmytro-fresh-client-per-spec.md` — fresh client per spec until full suite consolidates.
- `2026-05-13-dmytro-automation-pr-review-rules.md` — run impacted tests + gap analysis + channel posting before approval.
- `2026-05-13-dmytro-communication-in-channels-not-dms.md` — all PR/progress talk in channels.
- `2026-05-06-dmytro-gap-analysis-before-after.md` — gap analysis before starting and after PR is raised.
- `2026-05-18-dmytro-mandatory-architecture-review.md` — team must review architecture docs before next demo.

## Architecture PR

🚧 Work in progress on branch `ai-memory-1`. Raise after the mandatory team review of `docs/10-architecture/` completes. The Linear project description has a placeholder under "Architecture PR" — fill it with the PR URL once opened.
