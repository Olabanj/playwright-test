import fs from 'fs';
import path from 'path';
import type { LoginAccount } from '@fixtures/base.fixture';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Run-scoped login cache written once by `global-setup.ts` and read by
 * `fixtures/base.fixture.ts` worker fixtures so a full Playwright run performs
 * exactly ONE login per role instead of one per worker. Machine-local,
 * gitignored (`.auth/`) — never committed.
 */
export interface AuthCache {
  client:     LoginAccount;
  contractor: LoginAccount;
  createdAt:  string;
}

// core/auth/ -> up two levels -> playwright-e2e/.auth/accounts.json
const CACHE_FILE = path.resolve(__dirname, '../../.auth/accounts.json');

export function readAuthCache(): AuthCache | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as AuthCache;
  } catch {
    return null;
  }
}

export function writeAuthCache(cache: AuthCache): void {
  logVerbose(`[auth-cache] writing ${CACHE_FILE}`);
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

export function readCachedAccount(role: 'client' | 'contractor'): LoginAccount | undefined {
  return readAuthCache()?.[role];
}

export const AUTH_CACHE_FILE = CACHE_FILE;
