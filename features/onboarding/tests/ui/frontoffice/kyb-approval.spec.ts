import { test, expect } from '@features/onboarding/fixtures';
import { buildCompanyRegistrationDocData } from '@features/onboarding/builders/company.builder';

// Full onboarding lifecycle: a freshly-registered client confirms company
// details, an admin approves KYB via API (companyId comes from the registration
// response — no DB lookup), and after reload the "Confirm company details" card
// is gone. Ported from legacy client-full-onboarding.spec.ts.
test.describe('Onboarding — Full Flow with KYB Approval @ui @regression', () => {
  test('completes onboarding and approves KYB successfully', async ({
    activityPage,
    confirmCompanyDetailsPage,
    adminClient,
    registeredClient,
  }) => {
    const docData = buildCompanyRegistrationDocData();

    await activityPage.clickConfirmCompanyDetails();
    await expect(confirmCompanyDetailsPage.pageHeading).toBeVisible();
    await confirmCompanyDetailsPage.fillRequiredFieldsWithYesSignatory(docData);
    await confirmCompanyDetailsPage.submit();
    await expect(activityPage.confirmCompanyDetailsCard).toContainText('In progress');

    await adminClient.approveCompanyKyb(registeredClient.companyId);

    await activityPage.reload();
    await expect(activityPage.confirmCompanyDetailsCard).toBeHidden();
  });
});
