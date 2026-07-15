---
name: ci-cd-pipeline
description: >
  Playwright CI/CD configuration skill. Use whenever setting up GitHub Actions,
  configuring test runs in CI, fixing tests that pass locally but fail in CI,
  or optimising test pipeline performance. Trigger for: "set up CI", "GitHub
  Actions for Playwright", "tests fail in CI", "run tests on PR", "parallel
  CI", "sharding", "store auth in CI", "CI environment variables".
---

# CI/CD Pipeline Skill

---

## Standard GitHub Actions Config

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run Playwright tests
        run: npx playwright test
        env:
          BASE_URL: ${{ secrets.BASE_URL }}
          TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
          CI: true

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

      - name: Upload test traces (on failure)
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-traces
          path: test-results/
          retention-days: 7
```

---

## playwright.config.ts — CI Aware

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html'],
    ['list'],
    ...(process.env.CI ? [['github'] as any] : []),
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

---

## Sharding (Parallel Across Machines)

```yaml
# Split tests across 4 CI machines
strategy:
  matrix:
    shard: [1, 2, 3, 4]

steps:
  - name: Run Playwright tests (shard ${{ matrix.shard }}/4)
    run: npx playwright test --shard=${{ matrix.shard }}/4
```

---

## Auth State in CI

```yaml
# Store auth as CI secret (base64 encoded)
- name: Create auth file
  run: |
    mkdir -p playwright/.auth
    echo '${{ secrets.PLAYWRIGHT_AUTH_STATE }}' > playwright/.auth/user.json
```

```bash
# Encode your local auth file for the secret
base64 playwright/.auth/user.json | pbcopy
```

---

## Common CI Failures & Fixes

| Problem | Fix |
|---|---|
| Browser not found | `npx playwright install --with-deps` |
| Tests timeout | Increase `navigationTimeout` in config |
| Auth fails | Check `TEST_EMAIL` / `TEST_PASSWORD` secrets |
| Flaky tests | Set `retries: 2` in CI config |
| Out of memory | Reduce `workers` to 1 or 2 |
| Port conflict | Add `pkill -f node` before test step |
| storageState missing | Run setup project first via `dependencies` |
