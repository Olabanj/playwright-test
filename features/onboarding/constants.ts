import path from 'path';

/**
 * Platform lookup tables mapping human-readable values to ids (sourced from
 * /api/static/list; ported from the legacy ClientRegistrationAPI). Kept minimal —
 * extend as new countries/currencies are exercised.
 */
export const COUNTRY_ID: Record<string, number> = {
  'Saudi Arabia':         194,
  'United Arab Emirates': 233,
};

export const CURRENCY_ID: Record<string, number> = {
  USD: 1,
  SAR: 2,
};

export const COMPANY_TYPE_ID: Record<string, number> = {
  LLC: 2,
};

/** Test-bypass verification code configured in the sandbox environment. */
export const BYPASS_VERIFICATION_CODE = '9999';

/** Default sign-up password (matches the legacy DEFAULT_PASSWORD). */
export const DEFAULT_PASSWORD = 'Test123@';

/** Toast text shown after a successful company-profile save. */
export const TOAST = {
  UPDATED_SUCCESSFULLY: 'Updated Successfully',
} as const;

/** Dummy PDF used for the registration-document file input. */
export const REGISTRATION_DOC_PATH = path.resolve(
  process.cwd(),
  'features/onboarding/fixtures/files/test-document.pdf',
);

/**
 * Default KYB submission fields (sandbox-accepted static values; ported from
 * the legacy seeder's SEEDER_KYB_URLS). signatoryCountryId defaults to
 * COUNTRY_ID['Saudi Arabia'] (== legacy SANDBOX_SAUDI_ARABIA_COUNTRY_ID = 194).
 */
export const DEFAULT_KYB_SUBMISSION = {
  companyLinkedin:  'https://linkedin.com/company/qa-remotepass',
  companyWebsite:   'https://qa.remotepass.com',
  personalLinkedin: 'https://linkedin.com/in/qa-tester',
  signatoryName:    'QA Test Signatory',
} as const;
