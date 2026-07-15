import { baseTest } from '@fixtures/base.fixture';
import { AuthClient } from '@features/auth/api-client';
import { LoginPage } from '@features/auth/pages/LoginPage';

export interface AuthTestFixtures {
  /** AuthClient with NO token — for login/registration specs that authenticate themselves. */
  guestAuthClient: AuthClient;
  /** AuthClient pre-authenticated with the worker-scoped client token — for authed calls (logout). */
  authedClient: AuthClient;
  loginPage: LoginPage;
}

export const test = baseTest.extend<AuthTestFixtures>({
  guestAuthClient: async ({}, use) => {
    const client = new AuthClient();
    await client.init();
    await use(client);
    await client.dispose();
  },

  authedClient: async ({ clientToken }, use) => {
    const client = new AuthClient();
    await client.init(clientToken);
    await use(client);
    await client.dispose();
  },

  // DI for Pages: the page object arrives ready-made as a fixture.
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect } from '@playwright/test';
