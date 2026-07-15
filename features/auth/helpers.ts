import type { LoginAccount } from '@fixtures/base.fixture';
import { loginAccount } from '@fixtures/base.fixture';

/**
 * Feature-local login helper owned by the auth feature.
 *
 * Thin wrapper over the canonical `loginAccount` in `@fixtures/base.fixture`
 * (shared infra), kept here so existing/external callers of
 * `loginAsClientAccount()` don't need to know about base.fixture directly.
 * Prefer the worker-scoped base `clientAccount` fixture in new feature
 * fixtures — it's cached once per run by `global-setup.ts`.
 */
export async function loginAsClientAccount(): Promise<LoginAccount> {
  return loginAccount('client');
}
