import { test, expect } from '@features/client-registration/fixtures';
import { REGISTRATION_ERRORS, DEFAULT_SIGNUP_PASSWORD, DEFAULT_SIGNUP_COUNTRY } from '@features/client-registration/constants';
import { signupPerson, signupPhone } from '@features/client-registration/builders/signup.builder';

// Step 2 ("Your Information"). Reached via the `atGeneralInfoStep` precondition
// fixture (UI navigation through Step 1 — see ADR 2026-06-24-api-preconditions).
// Ported from legacy GeneralInfo-Step2.spec.ts. The two "proceed to Company Info"
// tests are deferred to the Step 3 (Company Info) chunk.
test.describe('Client Registration — General Info, Step 2 @ui @smoke', () => {
  test.fixme(true, 'QA-443: signup wizard flow broken/flaky (shifting subset each run) — see QA-451');
  test.describe('Positive', () => {
    test('displays the General Info form with all required fields', async ({ atGeneralInfoStep }) => {
      await expect(atGeneralInfoStep.heading).toBeVisible();
      await expect(atGeneralInfoStep.firstNameInput).toBeVisible();
      await expect(atGeneralInfoStep.middleNameInput).toBeVisible();
      await expect(atGeneralInfoStep.lastNameInput).toBeVisible();
      await expect(atGeneralInfoStep.countryDropdown).toBeVisible();
      await expect(atGeneralInfoStep.phoneNumberInput).toBeVisible();
      await expect(atGeneralInfoStep.passwordInput).toBeVisible();
      await expect(atGeneralInfoStep.registerButton).toBeVisible();
    });

    test('lands on the "Your Information" step', async ({ atGeneralInfoStep }) => {
      await expect(atGeneralInfoStep.heading).toBeVisible();
    });

    test('accepts valid data in all fields', async ({ atGeneralInfoStep }) => {
      const person = signupPerson();

      await atGeneralInfoStep.enterFirstName(person.firstName);
      await atGeneralInfoStep.enterMiddleName(person.middleName);
      await atGeneralInfoStep.enterLastName(person.lastName);
      await atGeneralInfoStep.selectCountry(DEFAULT_SIGNUP_COUNTRY);
      await atGeneralInfoStep.enterPhoneNumber(signupPhone());
      await atGeneralInfoStep.enterPassword(DEFAULT_SIGNUP_PASSWORD);

      await expect(atGeneralInfoStep.firstNameInput).toHaveValue(person.firstName);
      await expect(atGeneralInfoStep.middleNameInput).toHaveValue(person.middleName);
      await expect(atGeneralInfoStep.lastNameInput).toHaveValue(person.lastName);
      await expect(atGeneralInfoStep.passwordInput).toHaveValue(DEFAULT_SIGNUP_PASSWORD);
    });

    test('reaches Company Info after submitting without a middle name', async ({ atGeneralInfoStep, companyInfoPage }) => {
      const person = signupPerson();

      await atGeneralInfoStep.enterFirstName(person.firstName);
      await atGeneralInfoStep.enterLastName(person.lastName);
      await atGeneralInfoStep.selectCountry(DEFAULT_SIGNUP_COUNTRY);
      await atGeneralInfoStep.enterPhoneNumber(signupPhone());
      await atGeneralInfoStep.enterPassword(DEFAULT_SIGNUP_PASSWORD);
      await atGeneralInfoStep.clickRegister();

      await expect(companyInfoPage.heading).toBeVisible();
    });

    test('proceeds to Company Info after filling all fields', async ({ atGeneralInfoStep, companyInfoPage }) => {
      const person = signupPerson();

      await atGeneralInfoStep.enterFirstName(person.firstName);
      await atGeneralInfoStep.enterMiddleName(person.middleName);
      await atGeneralInfoStep.enterLastName(person.lastName);
      await atGeneralInfoStep.selectCountry(DEFAULT_SIGNUP_COUNTRY);
      await atGeneralInfoStep.enterPhoneNumber(signupPhone());
      await atGeneralInfoStep.enterPassword(DEFAULT_SIGNUP_PASSWORD);
      await atGeneralInfoStep.clickRegister();

      await expect(companyInfoPage.heading).toBeVisible();
    });
  });

  test.describe('Negative', () => {
    test('rejects an empty form', async ({ atGeneralInfoStep }) => {
      await atGeneralInfoStep.clickRegister();

      await expect(atGeneralInfoStep.heading).toBeVisible();
      await expect(atGeneralInfoStep.errorToast(REGISTRATION_ERRORS.REQUIRED_FIELDS)).toBeVisible();
    });

    test('rejects a missing first name', async ({ atGeneralInfoStep }) => {
      const person = signupPerson();

      await atGeneralInfoStep.enterLastName(person.lastName);
      await atGeneralInfoStep.selectCountry(DEFAULT_SIGNUP_COUNTRY);
      await atGeneralInfoStep.enterPhoneNumber(signupPhone());
      await atGeneralInfoStep.enterPassword(DEFAULT_SIGNUP_PASSWORD);
      await atGeneralInfoStep.clickRegister();

      await expect(atGeneralInfoStep.errorToast(REGISTRATION_ERRORS.REQUIRED_FIELDS)).toBeVisible();
    });

    test('rejects a missing last name', async ({ atGeneralInfoStep }) => {
      const person = signupPerson();

      await atGeneralInfoStep.enterFirstName(person.firstName);
      await atGeneralInfoStep.selectCountry(DEFAULT_SIGNUP_COUNTRY);
      await atGeneralInfoStep.enterPhoneNumber(signupPhone());
      await atGeneralInfoStep.enterPassword(DEFAULT_SIGNUP_PASSWORD);
      await atGeneralInfoStep.clickRegister();

      await expect(atGeneralInfoStep.errorToast(REGISTRATION_ERRORS.REQUIRED_FIELDS)).toBeVisible();
    });

    test('rejects a missing country', async ({ atGeneralInfoStep }) => {
      const person = signupPerson();

      await atGeneralInfoStep.enterFirstName(person.firstName);
      await atGeneralInfoStep.enterLastName(person.lastName);
      await atGeneralInfoStep.enterPhoneNumber(signupPhone());
      await atGeneralInfoStep.enterPassword(DEFAULT_SIGNUP_PASSWORD);
      await atGeneralInfoStep.clickRegister();

      await expect(atGeneralInfoStep.errorToast(REGISTRATION_ERRORS.REQUIRED_FIELDS)).toBeVisible();
    });

    test('rejects a missing phone number', async ({ atGeneralInfoStep }) => {
      const person = signupPerson();

      await atGeneralInfoStep.enterFirstName(person.firstName);
      await atGeneralInfoStep.enterLastName(person.lastName);
      await atGeneralInfoStep.selectCountry(DEFAULT_SIGNUP_COUNTRY);
      await atGeneralInfoStep.enterPassword(DEFAULT_SIGNUP_PASSWORD);
      await atGeneralInfoStep.clickRegister();

      await expect(atGeneralInfoStep.errorToast(REGISTRATION_ERRORS.REQUIRED_FIELDS)).toBeVisible();
    });

    test('rejects a missing password', async ({ atGeneralInfoStep }) => {
      const person = signupPerson();

      await atGeneralInfoStep.enterFirstName(person.firstName);
      await atGeneralInfoStep.enterLastName(person.lastName);
      await atGeneralInfoStep.selectCountry(DEFAULT_SIGNUP_COUNTRY);
      await atGeneralInfoStep.enterPhoneNumber(signupPhone());
      await atGeneralInfoStep.clickRegister();

      await expect(atGeneralInfoStep.errorToast(REGISTRATION_ERRORS.PASSWORD_REQUIRED)).toBeVisible();
    });
  });
});
