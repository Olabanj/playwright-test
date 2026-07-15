---
id: fada8f70-163e-5dd6-a02b-2d1b18ee6e1c
name: 2026-06-02-dmytro-new-projects-on-new-architecture
description: "Framework cutover: ongoing projects (time-tracking, payments) finish on the old framework and merge to main; all new projects start on the new playwright-e2e architecture from 2026-06-03; Dmytro migrates existing tests in parallel (~1–1.5 wk); both frameworks coexist in one repo"
metadata:
  type: feedback
  category: decisions
  tags: ["migration", "cutover", "new-projects", "coexistence", "architecture"]
  author: dmytro
  createdAt: 2026-06-02T11:00:00Z
  updatedAt: 2026-06-02T11:00:00Z
  expiresAt: null
---

# Decision — New projects on the new architecture, ongoing projects finish on the old

**Date:** 2026-06-02 (confirmed in standup, driven by Slahudeen as acting lead)

## Decision
1. **Both frameworks coexist in one repo** — `playwright-e2e/` is a folder inside the main repo.
2. **Ongoing projects finish on the OLD framework** — time-tracking and payments stay on the legacy framework and are safely merged to `main` once their architecture-change PRs are reviewed.
3. **All NEW projects start on the NEW architecture** from 2026-06-03. Anyone starting new work uses `playwright-e2e/`.
4. **Dmytro migrates existing tests in parallel** (time-tracking + payment-seeder tests) into the new architecture over ~1–1.5 weeks, so migration is not a blocker for new work. Once migrated, tests move into the `playwright-e2e/` folder.

## New projects kicked off (start 2026-06-03)
- **Connected bank accounts** — straightforward (add all bank account types, verify). Assigned to **Sergiy solo** (already knows payments).
- **Contract creation end-to-end** — everyone except Dmytro and Sergiy. Scope decision: **target the main contract-creation flow first**, defer the more complex variant (Slahudeen's "C"/CoR scope — exact term unclear from transcript) to avoid over-complicating; once main creation is done ~50% of the prerequisites for the deferred part are already in place.
- Generic issues created on **Linear**; team is free to add their own issues (not hardcoded).

## Why
Using AI + multiple engineers per project, finishing the legacy tracks and cutting new work to the new architecture immediately avoids investing more effort in the old framework, while parallel migration keeps the new framework from blocking delivery.

## Related
- Builds on [[migration-plan]] (module-by-module migration roadmap) and [[2026-05-22-dmytro-feature-first-layout]].
