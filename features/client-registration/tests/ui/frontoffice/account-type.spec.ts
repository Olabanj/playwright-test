import { test, expect } from '@features/client-registration/fixtures';
import { EXISTING_CLIENT_EMAIL, REGISTRATION_ERRORS } from '@features/client-registration/constants';
import {
  uniqueSignupEmail,
  invalidSignupEmail,
} from '@features/client-registration/builders/signup.builder';

// Account Type is the first sign-up step; none of these create an account, so
// generated emails are throwaway. Ported from legacy AccountType-Step1.1.spec.ts.
// (The cross-step "proceed to next step" test is deferred to the Step 1.2 chunk.)
test.describe('Client Registration — Account Type, Step 1.1 @ui @smoke', () => {
  test.beforeEach(async ({ signUpPage }) => {
    await signUpPage.open();
  });

  test.describe('Positive', () => {
    test('shows the sign-up page with all required elements', async ({ signUpPage, page }) => {
      await expect(page).toHaveURL(/\/signup/);
      await expect(signUpPage.companyOption).toBeVisible();
      await expect(signUpPage.contractorOption).toBeVisible();
      await expect(signUpPage.employeeOption).toBeVisible();
      await expect(signUpPage.emailInput).toBeVisible();
      await expect(signUpPage.emailInput).toBeEnabled();
      await expect(signUpPage.googleSignUpButton).toBeVisible();
    });

    test('shows all three account types with descriptions', async ({ signUpPage }) => {
      await expect(signUpPage.companyOption).toBeVisible();
      await expect(signUpPage.companyDescription).toBeVisible();
      await expect(signUpPage.contractorOption).toBeVisible();
      await expect(signUpPage.contractorDescription).toBeVisible();
      await expect(signUpPage.employeeOption).toBeVisible();
      await expect(signUpPage.employeeDescription).toBeVisible();
    });

    test('accepts a valid email format', async ({ signUpPage }) => {
      const email = uniqueSignupEmail();
      await signUpPage.enterEmail(email);

      await expect(signUpPage.emailInput).toHaveValue(email);
    });

    test('shows the Terms of Service text', async ({ signUpPage }) => {
      await expect(signUpPage.termsText).toBeVisible();
    });
  });

  test.describe('Negative', () => {
    test('rejects an invalid email format', async ({ signUpPage }) => {
      await signUpPage.enterEmail(invalidSignupEmail());
      await signUpPage.acceptTerms();
      await signUpPage.clickNext();

      await expect(signUpPage.errorToast(REGISTRATION_ERRORS.INVALID_EMAIL)).toBeVisible();
    });

    test('rejects an empty email', async ({ signUpPage }) => {
      await signUpPage.acceptTerms();
      await signUpPage.clickNext();
      
      await expect(signUpPage.errorToast(REGISTRATION_ERRORS.EMAIL_REQUIRED)).toBeVisible();
    });

    test('rejects an already-registered email', async ({ signUpPage }) => {
      await signUpPage.enterEmail(EXISTING_CLIENT_EMAIL);
      await signUpPage.acceptTerms();
      await signUpPage.clickNext();

      await expect(signUpPage.errorToast(REGISTRATION_ERRORS.EMAIL_ALREADY_REGISTERED)).toBeVisible();
    });

    test('does not proceed without accepting Terms', async ({ signUpPage }) => {
      await signUpPage.enterEmail(uniqueSignupEmail());
      await signUpPage.clickNext();

      await expect(signUpPage.errorToast(REGISTRATION_ERRORS.TERMS_NOT_ACCEPTED)).toBeVisible();
    });
  });
});
