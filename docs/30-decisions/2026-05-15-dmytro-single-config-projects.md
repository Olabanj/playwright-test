---
id: 53f1c2db-5dcb-544e-b266-b37c0fac5648
name: single-config-projects
description: "Single playwright.config.ts with projects[] (api, frontoffice, backoffice) — not multiple config files"
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "config", "playwright", "projects"]
  author: dmytro
  createdAt: 2026-05-15T00:00:00Z
  updatedAt: 2026-05-15T00:00:00Z
  expiresAt: null
---

# Single playwright.config.ts with projects[] — Not Multiple Config Files

**Decision:** Use one `playwright.config.ts` with three `projects[]` entries: `api`, `frontoffice`, `backoffice`. Do not create separate `playwright.config.api.ts` / `playwright.config.ui.ts` files.

**Context:** RemotePass has two UIs — front-office (contractor + client) and back-office (admin only). Both need different `baseURL`. API tests need no browser. These map naturally to Playwright projects.

**Why:** Multiple config files are not idiomatic Playwright. The `projects[]` array is the official mechanism for this split. Separate files duplicate shared settings (reporter, timeout, retries, globalSetup) and require `--config` on every command.

**How to apply:**
- All new test suites go into `tests/modules/{module}/api/` or `tests/modules/{module}/ui/frontoffice/` or `ui/backoffice/`.
- `testMatch` in each project targets the right subfolder automatically.
- Never add a second config file — extend `projects[]` if a new runner is needed.
