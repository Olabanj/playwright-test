import { Page } from '@playwright/test';
import { baseTest, injectUiAuthFromAccount, LoginAccount } from '@fixtures/base.fixture';
import { ROUTES } from '@core/ui/routes';
import { AuthClient } from '@features/auth/api-client';
import { AdminClient } from '@features/admin/api-client';
import { registerFreshClient } from '@features/onboarding/seeding';
import { RegisteredClient } from '@features/onboarding/types';
import { ActivityPage } from '@features/onboarding/pages/frontoffice/ActivityPage';
import { ConfirmCompanyDetailsPage } from '@features/onboarding/pages/frontoffice/ConfirmCompanyDetailsPage';
import { CompanyInfoTabPage } from '@features/onboarding/pages/frontoffice/CompanyInfoTabPage';

export interface OnboardingFixtures {
  adminClient:               AdminClient;
  /** Precondition: a brand-new client registered via API with 2FA disabled. */
  registeredClient:          RegisteredClient;
  /** A `page` authenticated as the freshly-registered client, landed on /activity. */
  onboardingPage:            Page;
  activityPage:              ActivityPage;
  confirmCompanyDetailsPage: ConfirmCompanyDetailsPage;
  companyInfoTabPage:        CompanyInfoTabPage;
}

export const test = baseTest.extend<OnboardingFixtures>({
  adminClient: async ({}, use) => {
    const client = new AdminClient();
    await client.initWithAdminToken();
    await use(client);
    await client.dispose();
  },

  // Register a fresh client via API, then disable 2FA via admin so the SPA
  // session can be injected (a fresh client has 2FA on, and /api/login withholds
  // the token until it is disabled). No cleanup — sandbox sign-up clients are
  // throwaway, matching the legacy onboarding fixture.
  // TODO(api-preconditions): the page lands on /activity by UI navigation; revisit
  // if a deep-link / API session-seed path becomes available.
  registeredClient: async ({ adminClient }, use) => {
    const reg = await registerFreshClient();
    await adminClient.disable2fa(reg.userId);
    await use(reg);
  },

  onboardingPage: async ({ page, registeredClient }, use) => {
    const auth = new AuthClient();
    await auth.init();
    const res = await auth.login(registeredClient.regData.email, registeredClient.regData.password);
    const data = res.body?.data as unknown;
    const account = (Array.isArray(data) ? data[0] : data) as LoginAccount;
    await auth.dispose();
    if (!account?.token) {
      throw new Error(`fresh-client login returned no token (2FA still enabled?): ${JSON.stringify(res.body)}`);
    }
    await injectUiAuthFromAccount(page, account);
    await page.goto(ROUTES.activity, { waitUntil: 'domcontentloaded' });
    await use(page);
  },

  activityPage: async ({ onboardingPage }, use) => {
    await use(new ActivityPage(onboardingPage));
  },
  confirmCompanyDetailsPage: async ({ onboardingPage }, use) => {
    await use(new ConfirmCompanyDetailsPage(onboardingPage));
  },
  companyInfoTabPage: async ({ onboardingPage }, use) => {
    await use(new CompanyInfoTabPage(onboardingPage));
  },
});

export { expect } from '@playwright/test';
