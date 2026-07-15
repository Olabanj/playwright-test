import { test, expect } from '@features/onboarding/fixtures';
import { buildCompanySettingsRequiredData } from '@features/onboarding/builders/company.builder';
import { TOAST } from '@features/onboarding/constants';

// A freshly-registered client opens the Company Info settings tab, fills all
// required fields, saves, and sees the success toast. Ported from legacy
// company-profile.spec.ts.
//
// NOTE: the legacy "Complete company profile" activity card no longer exists in
// the product — the activity onboarding checklist now shows only confirm-details
// / identity / first-contract (verified live), and API registration already
// populates company info. The tab is therefore reached directly by URL instead
// of via the (removed) card; the save-and-toast assertion is unchanged.
// TODO(api-preconditions): replace UI nav to /settings/info with an API/deep-link
// precondition when one exists.
test.describe('Onboarding — Company Profile @ui @smoke', () => {
  test('saves company profile with all required fields', async ({ companyInfoTabPage }) => {
    const data = buildCompanySettingsRequiredData();

    await companyInfoTabPage.open();
    await expect(companyInfoTabPage.companyLegalNameInput).toBeVisible();

    await companyInfoTabPage.fillAllRequiredFields(data);
    await companyInfoTabPage.clickSave();

    await expect(companyInfoTabPage.successToast(TOAST.UPDATED_SUCCESSFULLY)).toBeVisible();
  });
});
