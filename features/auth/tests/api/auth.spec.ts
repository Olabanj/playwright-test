import { test, expect } from '@features/auth/fixtures';
import { loginAs } from '@fixtures/base.fixture';

test.describe('Auth — API', () => {
  test('logs in as client and gets a token @smoke', async () => {
    const token = await loginAs('client');

    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(20);
  });

  test('logs out and invalidates the session @smoke', async ({ authedClient }) => {
    // authedClient is the token-scoped AuthClient fixture (init→use→dispose lives in
    // the fixture, not the test). Convention C: logout returns the raw ApiResponse.
    await expect(authedClient.logout()).resolves.not.toThrow();
  });
});
