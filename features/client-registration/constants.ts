/**
 * Client-registration (sign-up) constants — ported from the legacy
 * utils/constants/client-registration.constants.ts.
 */

export const ACCOUNT_TYPES = {
  COMPANY: 'company',
  CONTRACTOR: 'contractor',
  EMPLOYEE: 'employee',
} as const;

export const ACCOUNT_TYPE_LABELS = {
  COMPANY: "I'm a Company",
  CONTRACTOR: "I'm a Contractor",
  EMPLOYEE: "I'm an Employee",
} as const;

export const ACCOUNT_TYPE_DESCRIPTIONS = {
  COMPANY: 'I want to hire and pay',
  CONTRACTOR: 'I want to work compliantly',
  EMPLOYEE: 'I am hired through RemotePass',
} as const;

/** Test-bypass verification code configured in the sandbox environment. */
export const BYPASS_VERIFICATION_CODE = '9999';

/** A client email already registered in the sandbox (existing-email negative test). */
export const EXISTING_CLIENT_EMAIL = 'sergiy+ksacompany@remotepass.com';

/** Throwaway sign-up form defaults (these flows never complete registration). */
export const DEFAULT_SIGNUP_PASSWORD = 'Test123@';
export const DEFAULT_SIGNUP_COUNTRY = 'Saudi Arabia';

export const REGISTRATION_ERRORS = {
  INVALID_EMAIL: 'The email must be a valid email address.',
  EMAIL_REQUIRED: 'Email is required',
  EMAIL_ALREADY_REGISTERED: 'Email already registered.',
  TERMS_NOT_ACCEPTED: 'You need to agree to the Terms of Service and the Use Policy',
  REQUIRED_FIELDS: 'Make sure you fill all required fields before you register.',
  PASSWORD_REQUIRED: 'Password field is required.',
  INVALID_CODE: 'Invalid code',
} as const;
