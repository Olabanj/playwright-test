---
id: ebe955a0-3501-583f-8681-3d14e4c75780
name: drop-3-lane
description: "Drop 3-lane (scripts/probes/verify) — tests live flat under tests/modules/{module}/{api|ui}/, selective runs via tags + git branches"
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "structure", "3-lane", "tags", "playwright"]
  author: dmytro
  createdAt: 2026-05-15T00:00:00Z
  updatedAt: 2026-05-15T00:00:00Z
  expiresAt: null
---

# Drop 3-Lane (scripts/probes/verify) — Use Tags + Branches Instead

**Decision:** Tests live directly under `tests/modules/{module-a}/api/` and `tests/modules/{module-a}/ui/{frontoffice|backoffice}/`. No `probes/` or `verify/` subfolders. Standalone utility scripts (seeders, sandbox cleanup, manual `npx tsx` tools) live in a repo-root `scripts/` folder, which is NOT under `tests/` and is NOT a Playwright lane.

**Why:** The 3-lane (`scripts/probes/verify`) split was inherited from the old `test-framework` repo. With a proper git workflow (feature branch → PR review → merge to main) and Playwright test tags (`@smoke`, `@regression`, `@critical`), the probes/verify distinction is redundant ceremony — WIP tests live in feature branches, selective runs are done by tags. Playwright officially documents only a flat `tests/` directory plus tag-based filtering; the 3-lane pattern is not in their docs and creates folder ceremony that the team will not maintain.

**How to apply:**
- Never create `probes/` or `verify/` subfolders inside `tests/`.
- Use `@smoke` / `@regression` / `@critical` tags for selective runs (e.g. `npx playwright test --grep @smoke`).
- Use git feature branches for WIP tests; PR review gates what merges to main.
- `scripts/` at the repo root is for `npx tsx` utilities only (seeders, sandbox cleanup) — never `.spec.ts` files.
