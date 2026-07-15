import { test, expect } from '@features/auth/fixtures';
import { env } from '@core/config/env';

test.describe('Auth — UI (front-office)', () => {
  test('client logs in via UI @smoke', async ({ loginPage, page }) => {
    await loginPage.open();
    await loginPage.login(env.clientEmail, env.clientPassword);

    await expect(page).not.toHaveURL(/\/login/);
  });

  test('client logs out via UI @smoke', async ({ loginPage, page }) => {
    test.fixme(true, 'QA-443: frontoffice UI element-interaction failure, see ticket for symptom — QA-453');
    await loginPage.open();
    await loginPage.login(env.clientEmail, env.clientPassword);
    await loginPage.clickLogout();

    await expect(page).toHaveURL(/\/login/);
  });
});
