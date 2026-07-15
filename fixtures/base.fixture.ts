import { test as base, Page } from '@playwright/test';
import { env } from '@core/config/env';
import { AuthClient } from '@features/auth/api-client';
import { readCachedAccount } from '@core/auth/auth-cache';
import { delay } from '@core/http/delay';
import { logVerbose } from '@utils/helpers/logger';

export type UserRole = 'client' | 'contractor' | 'admin';

/** Login API account object — a single account, or an array when the email maps to several roles. */
export interface LoginAccount { token?: string; [key: string]: unknown; }

export interface BaseWorkerFixtures {
  clientAccount:     LoginAccount;
  contractorAccount: LoginAccount;
  clientToken:       string;
  contractorToken:   string;
}

export interface BaseTestFixtures {
  /** A `page` already authenticated as the contractor (worker), ready to navigate the frontoffice. */
  contractorPage: Page;
}

function credentialsFor(role: UserRole): { email: string; password: string } {
  switch (role) {
    case 'client':     return { email: env.clientEmail, password: env.clientPassword };
    case 'contractor': return { email: env.workerEmail, password: env.workerPassword };
    case 'admin':      return { email: env.adminEmail,  password: env.adminPassword  };
  }
}

const MAX_LOGIN_RETRIES = 2;
const RETRY_WINDOW_MS = 30_000;
const DEFAULT_RETRY_AFTER_MS = 2_000;

function retryAfterMs(headers: Record<string, string>): number {
  const raw = headers['retry-after'] ?? headers['Retry-After'];
  const seconds = raw ? Number(raw) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_RETRY_AFTER_MS;
}

/**
 * Canonical login round-trip, shared by every worker-scoped account fixture and
 * `global-setup.ts`. 429-aware: honors `Retry-After` (seconds; falls back to a
 * fixed delay when absent) and retries a bounded number of times within a short
 * window before giving up with a clear error — a safety net for the shared
 * sandbox's login throttle, not a substitute for the run-level login cache.
 */
export async function loginAccount(role: UserRole): Promise<LoginAccount> {
  const { email, password } = credentialsFor(role);
  const client = new AuthClient();
  await client.init();
  try {
    const deadline = Date.now() + RETRY_WINDOW_MS;
    let attempt = 0;
    for (;;) {
      const response = await client.login(email, password);

      if (response.status === 429) {
        if (attempt >= MAX_LOGIN_RETRIES || Date.now() >= deadline) {
          throw new Error(`Login throttled (429) for role=${role} after ${attempt + 1} attempt(s)`);
        }
        const waitMs = retryAfterMs(response.headers);
        logVerbose(`[base.fixture] loginAccount role=${role} got 429, retrying in ${waitMs}ms`);
        await delay(waitMs);
        attempt += 1;
        continue;
      }

      const data = response.body.data as LoginAccount | LoginAccount[] | undefined;
      const account = Array.isArray(data) ? data[0] : data;
      if (response.status !== 200 || !account?.token) {
        throw new Error(`Login failed for role=${role}: status=${response.status}`);
      }
      return account;
    }
  } finally {
    await client.dispose();
  }
}

export async function loginAs(role: UserRole): Promise<string> {
  return (await loginAccount(role)).token!;
}

/** Cached account for the run (written once by global-setup) if present, else a live login. */
async function resolveAccount(role: 'client' | 'contractor'): Promise<LoginAccount> {
  const cached = readCachedAccount(role);
  if (cached) return cached;
  return loginAccount(role);
}

/**
 * Seed the app's Redux-Persist `persist:root` localStorage (Account.user + token)
 * via an init script so the SPA rehydrates as logged-in on first navigation —
 * no login form, no extra API login. Proven path ported from the legacy
 * UIFixture.injectAuthState. Reuses an already-fetched login account.
 */
export async function injectUiAuthFromAccount(page: Page, account: LoginAccount): Promise<void> {
  const token = account.token!;

  const persistRoot = {
    Login:   JSON.stringify({ error: '', loading: false, loginToken: null }),
    Account: JSON.stringify({
      registrationError: null,
      message:           null,
      loading:           false,
      OTPError:          null,
      OTPmessage:        null,
      OTPloading:        false,
      data:              null,
      lastPath:          null,
      user:              account,
      loggedIn:          true,
      originalUser:      account,
    }),
    userProfile: JSON.stringify({}),
    Withdraw:    JSON.stringify({}),
    _persist:    JSON.stringify({ version: -1, rehydrated: true }),
  };

  await page.addInitScript(
    ({ persistRoot, token }) => {
      localStorage.setItem('persist:root', JSON.stringify(persistRoot));
      localStorage.setItem('tfa_reminder', token);
    },
    { persistRoot, token },
  );

  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

export const baseTest = base.extend<BaseTestFixtures, BaseWorkerFixtures>({
  // Prefer the run-level cache written once by global-setup (one login per role
  // for the whole run); fall back to a live login when the cache is absent
  // (e.g. a single spec run without globalSetup, or a stale/missing cache file).
  clientAccount: [
    async ({}, use) => {
      await use(await resolveAccount('client'));
    },
    { scope: 'worker' },
  ],
  contractorAccount: [
    async ({}, use) => {
      await use(await resolveAccount('contractor'));
    },
    { scope: 'worker' },
  ],
  clientToken: [
    async ({ clientAccount }, use) => {
      await use(clientAccount.token!);
    },
    { scope: 'worker' },
  ],
  contractorToken: [
    async ({ contractorAccount }, use) => {
      await use(contractorAccount.token!);
    },
    { scope: 'worker' },
  ],
  contractorPage: async ({ page, contractorAccount }, use) => {
    await injectUiAuthFromAccount(page, contractorAccount);
    await use(page);
  },
});
