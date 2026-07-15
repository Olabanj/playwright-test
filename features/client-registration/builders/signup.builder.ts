/**
 * Sign-up data builders for client-registration. Thin feature wrappers over the
 * shared faker primitives in @utils/data/user-faker — same export names the
 * fixtures and specs already use, so only the generation source changed.
 */
import {
  generatePerson,
  generatePhoneNumber,
  generateClientEmail,
  generateCompanyInfo,
  type Person,
  type CompanyData,
} from '@utils/data/user-faker';
import { DEFAULT_SIGNUP_COUNTRY } from '@features/client-registration/constants';

export type SignupPerson = Person;
export type SignupCompany = CompanyData;

/** A unique, valid client sign-up email. */
export function uniqueSignupEmail(): string {
  return generateClientEmail();
}

/** A syntactically invalid email, for negative validation tests. */
export function invalidSignupEmail(): string {
  return 'not-valid-email';
}

/** Unique alpha-only person names for sign-up form fills. */
export function signupPerson(): SignupPerson {
  return generatePerson();
}

/** A UAE-format phone number that passes the sign-up form validation. */
export function signupPhone(): string {
  return generatePhoneNumber();
}

/** Company registration details for the Company Info step. */
export function signupCompany(): SignupCompany {
  // Pin the country to the one the form actually selects (single feature source).
  return { ...generateCompanyInfo(), country: DEFAULT_SIGNUP_COUNTRY };
}
