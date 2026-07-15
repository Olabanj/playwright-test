import { test, expect } from '@features/client-registration/fixtures';
import { signupCompany } from '@features/client-registration/builders/signup.builder';

// Step 3 ("Company info"). Reached via the atCompanyInfoStep precondition fixture
// (UI navigation through Steps 1.1 -> 1.2 -> 2 -> Register — see ADR
// 2026-06-24-api-preconditions). Ported from legacy CompanyInfo-Step3.spec.ts.
test.describe('Client Registration — Company Info, Step 3 @ui @smoke', () => {
  test.fixme(true, 'QA-443: signup wizard flow broken/flaky (shifting subset each run) — see QA-451');
  test('reaches the Company Info step', async ({ atCompanyInfoStep }) => {
    await expect(atCompanyInfoStep.heading).toBeVisible();
    await expect(atCompanyInfoStep.infoAlert).toBeVisible();
    await expect(atCompanyInfoStep.legalNameInput).toBeVisible();
  });

  // TODO(cleanup): this test completes a real registration (lands on /activity) and
  // leaves the created client account behind — there is no API teardown today.
  // Delete the account via API in teardown once a backend path exists.
  test('completes registration after filling all Company Info fields', async ({ atCompanyInfoStep, page }) => {
    const company = signupCompany();

    await atCompanyInfoStep.enterLegalName(company.legalName);
    await atCompanyInfoStep.selectType(company.type);
    await atCompanyInfoStep.enterRegistrationNumber(company.registrationNumber);
    await atCompanyInfoStep.enterNumberOfEmployees(company.numberOfEmployees);
    await atCompanyInfoStep.selectCurrency(company.currency);
    await atCompanyInfoStep.enterAddress(company.address);
    await atCompanyInfoStep.selectCountry(company.country);
    await atCompanyInfoStep.enterCity(company.city);
    await atCompanyInfoStep.clickNext();

    await expect(atCompanyInfoStep.heading).toBeHidden({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/activity/);
  });
});
