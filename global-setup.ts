// Playwright globalSetup — runs once before the whole suite. Logs in the
// client and contractor roles exactly ONCE for the entire run and caches the
// full accounts to a gitignored file (`.auth/accounts.json`); every worker's
// fixtures (see fixtures/base.fixture.ts) read from that cache instead of
// re-logging in. This is what brings login volume back to legacy parity
// (one login per role per run) and avoids the sandbox's login throttle.
//
// Relative imports on purpose (mirrors playwright.config.ts): path aliases
// are not guaranteed to resolve in the globalSetup entry point.
import { loginAccount } from './fixtures/base.fixture';
import { readAuthCache, writeAuthCache } from './core/auth/auth-cache';

const FRESH_CACHE_WINDOW_MS = 5 * 60 * 1000;

export default async function globalSetup(): Promise<void> {
  const existing = readAuthCache();
  if (existing) {
    const age = Date.now() - new Date(existing.createdAt).getTime();
    if (age >= 0 && age < FRESH_CACHE_WINDOW_MS) {
      console.log(`[global-setup] reusing auth cache from ${existing.createdAt} (age ${Math.round(age / 1000)}s)`);
      return;
    }
  }

  console.log('[global-setup] logging in client and contractor once for this run...');
  const client = await loginAccount('client');
  const contractor = await loginAccount('contractor');

  writeAuthCache({ client, contractor, createdAt: new Date().toISOString() });
  console.log('[global-setup] auth cache written');
}
