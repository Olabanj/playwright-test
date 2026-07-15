---
id: 4be5cd8b-3a84-5966-89c9-94aa6a0c1b8b
name: local-setup
description: "Prerequisites, install steps, required env var names, path aliases, and verified commands for playwright-e2e local development"
metadata:
  type: reference
  category: engineering
  tags: ["setup", "install", "env-vars", "commands", "prerequisites", "node", "playwright"]
---

# Local Setup

## Prerequisites

- Node.js (check `.nvmrc` in repo root for pinned version)
- npm
- `npx tsx` — for running standalone scripts outside Playwright

## Install

```bash
npm install
npx playwright install   # install browser binaries for UI tests
```

## Required Environment Variables (.env)

Do not store actual values here. Create a `.env` file in the repo root with these keys:

```bash
# API
API_BASE_URL=                  # RemotePass API base URL (sandbox or staging)
TIME_TRACKING_API_URL=         # AWS Lambda endpoint for time tracking
E2E_SECRET_KEY=                # bypass key for automated tests
OPENAPI_BASE_URL=              # OpenAPI integration base URL

# Test users (sandbox accounts)
CLIENT_EMAIL=
CLIENT_PASSWORD=
WORKER_EMAIL=
WORKER_PASSWORD=

# Admin (for seeder scripts)
ADMIN_LOGIN_KEY=

# Database (for OTP fetching in seeder scripts)
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=

# SSH tunnel (for remote DB access)
SSH_HOST=
SSH_USER=
SSH_KEY_PATH=

# Optional
VERBOSE=true    # enables logVerbose() output
```

## Run Tests

```bash
npx playwright test                        # all projects (api + frontoffice + backoffice)
npx playwright test --project=api          # API tests only
npx playwright test --project=frontoffice  # front-office UI only (contractor + client)
npx playwright test --project=backoffice   # back-office UI only (admin)
npx playwright test --grep @smoke          # @smoke across all projects
npx playwright test --grep @regression     # full regression
```

### UI mode and the `specs/` folder

`npx playwright test --ui` opens Playwright's interactive UI runner. From version 1.50+, the first launch auto-creates a top-level `specs/` folder (`specs/README.md` with the text "directory for test plans"). This is Playwright's **Test Plans / Copilot codegen** feature — you write a Markdown plan, Playwright generates a `.spec.ts` from it.

**We do not use Playwright's codegen.** Our test-generation path is the `/generate-test` skill plus the four AI subagents documented in [10-architecture/integration-plan.md](../10-architecture/integration-plan.md). The `specs/` folder is therefore gitignored and intentionally empty:

```
# .gitignore
specs/                  # auto-created by Playwright `--ui` mode; not used by our workflow
```

If you see `specs/` reappear after running `--ui`, it is expected — git already ignores it. Do not commit anything in it.

`seed.spec.ts` files (created by `npx playwright codegen` or the "Record new test" button in `--ui`) are also gitignored via `**/seed.spec.ts` — they are codegen recording targets, not real tests. If a recording produces something worth keeping, copy the body into a properly-named spec under the right `features/<X>/tests/...` folder and delete the seed file.

`.playwright-mcp/` (snapshot artifacts from the Playwright MCP browser used by Claude during debugging) is gitignored for the same reason.

## Run Standalone Scripts

```bash
npx tsx scripts/{module-a}/your-script.ts
```

> `scripts/` lives at the repo root, NOT under `tests/`. These are utilities (seeders, sandbox cleanup), not Playwright specs.

## Path Aliases

Configured in `tsconfig.json` and `playwright.config.ts`:

| Alias | Points to |
|-------|-----------|
| `@core/*` | `./core/*` |
| `@fixtures` | `./fixtures/index.ts` |
| `@fixtures/*` | `./fixtures/*` |
| `@features/*` | `./features/*` |
| `@utils/*` | `./utils/*` |
