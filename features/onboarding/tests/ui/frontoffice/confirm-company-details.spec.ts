import { test, expect } from '@features/onboarding/fixtures';
import { buildCompanyRegistrationDocData } from '@features/onboarding/builders/company.builder';

// A freshly-registered client (via API + 2FA disabled) opens the Confirm Company
// Details form from the activity page, fills it with a "Yes" authorized signatory,
// uploads the registration document, submits, and the activity card flips to
// "In progress". Ported from legacy confirm-company-details.spec.ts.
test.describe('Onboarding — Confirm Company Details @ui @smoke', () => {
  test('submits company details and shows In Progress status', async ({
    activityPage,
    confirmCompanyDetailsPage,
  }) => {
    const docData = buildCompanyRegistrationDocData();

    await activityPage.clickConfirmCompanyDetails();
    await expect(confirmCompanyDetailsPage.pageHeading).toBeVisible();

    await confirmCompanyDetailsPage.fillRequiredFieldsWithYesSignatory(docData);
    await confirmCompanyDetailsPage.submit();

    await expect(activityPage.confirmCompanyDetailsCard).toContainText('In progress');
  });
});
