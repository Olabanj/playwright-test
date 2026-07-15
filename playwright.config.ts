import { defineConfig, devices } from '@playwright/test';
import { env } from './core/config/env';

export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  testDir: './features',
  fullyParallel: true,
  forbidOnly: env.isCi,
  // One local retry too: the shared sandbox is flaky under load (UI sign-up flows),
  // so a single retry absorbs transient timeouts without masking deterministic bugs.
  retries: env.isCi ? 2 : 1,
  // Cap local parallelism: the shared sandbox chokes under many concurrent
  // sign-up/UI flows (spurious timeouts/500s). 4 is safe; raise cautiously.
  workers: env.isCi ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Fail fast on a hung action/navigation instead of eating the whole test budget.
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'api',
      testMatch: '**/features/**/tests/api/**/*.spec.ts',
    },
    {
      name: 'frontoffice',
      testMatch: '**/features/**/tests/ui/frontoffice/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: env.frontofficeUrl,
      },
    },
    {
      name: 'backoffice',
      testMatch: '**/features/**/tests/ui/backoffice/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: env.backofficeUrl,
      },
    },
  ],
});
