import { baseTest } from '@fixtures/base.fixture';
import { SignUpPage } from '@features/client-registration/pages/frontoffice/SignUpPage';
import { VerifyEmailPage } from '@features/client-registration/pages/frontoffice/VerifyEmailPage';
import { GeneralInfoPage } from '@features/client-registration/pages/frontoffice/GeneralInfoPage';
import { CompanyInfoPage } from '@features/client-registration/pages/frontoffice/CompanyInfoPage';
import {
  uniqueSignupEmail,
  signupPerson,
  signupPhone,
} from '@features/client-registration/builders/signup.builder';
import {
  BYPASS_VERIFICATION_CODE,
  DEFAULT_SIGNUP_PASSWORD,
  DEFAULT_SIGNUP_COUNTRY,
} from '@features/client-registration/constants';

export interface ClientRegistrationFixtures {
  signUpPage: SignUpPage;
  verifyEmailPage: VerifyEmailPage;
  generalInfoPage: GeneralInfoPage;
  companyInfoPage: CompanyInfoPage;
  /** A unique throwaway sign-up email for the test (no account is completed). */
  signupEmail: string;
  /** Precondition: the wizard driven to the Verify Email step (Step 1.2). */
  atVerifyEmailStep: VerifyEmailPage;
  /** Precondition: the wizard driven to the General Info step (Step 2). */
  atGeneralInfoStep: GeneralInfoPage;
  /** Precondition: the wizard driven to the Company Info step (Step 3). */
  atCompanyInfoStep: CompanyInfoPage;
}

export const test = baseTest.extend<ClientRegistrationFixtures>({
  // DI for Pages: the page object arrives ready-made as a fixture.
  signUpPage: async ({ page }, use) => {
    await use(new SignUpPage(page));
  },
  verifyEmailPage: async ({ page }, use) => {
    await use(new VerifyEmailPage(page));
  },
  generalInfoPage: async ({ page }, use) => {
    await use(new GeneralInfoPage(page));
  },
  companyInfoPage: async ({ page }, use) => {
    await use(new CompanyInfoPage(page));
  },

  signupEmail: async ({}, use) => {
    await use(uniqueSignupEmail());
  },

  // Precondition fixtures: walk the sign-up wizard to a given step. Layered so each
  // builds on the previous.
  // TODO(api-preconditions): replace this UI navigation with API-based setup once a
  // sign-up / partial-onboarding API path exists. See
  // docs/30-decisions/2026-06-24-dmytro-api-preconditions.md.
  atVerifyEmailStep: async ({ signUpPage, verifyEmailPage, signupEmail }, use) => {
    await signUpPage.open();
    await signUpPage.selectAccountType('company');
    await signUpPage.enterEmail(signupEmail);
    await signUpPage.acceptTerms();
    await signUpPage.clickNext();
    await verifyEmailPage.heading.waitFor({ state: 'visible' });

    await use(verifyEmailPage);
  },

  atGeneralInfoStep: async ({ atVerifyEmailStep, generalInfoPage }, use) => {
    await atVerifyEmailStep.enterVerificationCode(BYPASS_VERIFICATION_CODE);
    await generalInfoPage.heading.waitFor({ state: 'visible' });

    await use(generalInfoPage);
  },

  atCompanyInfoStep: async ({ atGeneralInfoStep, companyInfoPage }, use) => {
    const person = signupPerson();
    await atGeneralInfoStep.enterFirstName(person.firstName);
    await atGeneralInfoStep.enterLastName(person.lastName);
    await atGeneralInfoStep.selectCountry(DEFAULT_SIGNUP_COUNTRY);
    await atGeneralInfoStep.enterPhoneNumber(signupPhone());
    await atGeneralInfoStep.enterPassword(DEFAULT_SIGNUP_PASSWORD);
    await atGeneralInfoStep.clickRegister();
    await companyInfoPage.heading.waitFor({ state: 'visible' });

    await use(companyInfoPage);
  },
});

export { expect } from '@playwright/test';
