/**
 * Onboarding data builders — pure faker data, no HTTP. Reuses the shared
 * user-faker primitives and adds the onboarding-specific company forms
 * (registration document + company settings). Ported from the legacy
 * fixtures/data/company-faker.ts + user-faker.ts (registration composite).
 */
import { faker } from '@faker-js/faker';
import { generateClientEmail, generateCompanyInfo, generatePerson, DEFAULT_COUNTRY } from '@utils/data/user-faker';
import { COUNTRY_ID, DEFAULT_KYB_SUBMISSION, DEFAULT_PASSWORD } from '@features/onboarding/constants';
import {
  ClientRegistrationData,
  CompanyRegistrationDocData,
  CompanySettingsRequiredData,
  SubmitKybPayload,
} from '@features/onboarding/types';

/**
 * UAE phone in full international form for the registration API. The API field
 * takes the country code inline (unlike the UI intl-tel widget, which prepends
 * +971 itself), so we send the full '971…' value here.
 */
function apiPhoneNumber(): string {
  return '971544' + faker.string.numeric(6);
}

/** A complete client sign-up data set (Saudi Arabia / LLC / USD by default). */
export function buildClientRegistrationData(): ClientRegistrationData {
  return {
    email:    generateClientEmail(),
    password: DEFAULT_PASSWORD,
    country:  DEFAULT_COUNTRY,
    person:   generatePerson(),
    phone:    apiPhoneNumber(),
    company:  generateCompanyInfo(),
  };
}

/** Data for the "Confirm company details" form (/registration-document). */
export function buildCompanyRegistrationDocData(
  overrides?: Partial<CompanyRegistrationDocData>,
): CompanyRegistrationDocData {
  return {
    companyLinkedin:       `https://linkedin.com/company/${faker.string.alphanumeric(10)}`,
    companyWebsite:        faker.internet.url(),
    personalLinkedin:      `https://linkedin.com/in/${faker.string.alphanumeric(10)}`,
    isAuthorizedSignatory: true,
    signatoryCountry:      DEFAULT_COUNTRY,
    ...overrides,
  };
}

/** Data for the API `submitKyb` precondition (Saudi Arabia signatory by default). */
export function buildKybSubmissionData(overrides?: Partial<SubmitKybPayload>): SubmitKybPayload {
  return {
    ...DEFAULT_KYB_SUBMISSION,
    isAuthorizedSignatory: true,
    signatoryCountryId:    COUNTRY_ID['Saudi Arabia'],
    ...overrides,
  };
}

/** Required fields for the Company Info settings tab (/settings/info). */
export function buildCompanySettingsRequiredData(
  overrides?: Partial<CompanySettingsRequiredData>,
): CompanySettingsRequiredData {
  return {
    legalName:          faker.company.name(),
    companyType:        'LLC',
    registrationNumber: faker.string.numeric(10),
    numberOfEmployees:  '50',
    currency:           'USD',
    address:            faker.location.streetAddress(),
    country:            DEFAULT_COUNTRY,
    city:               faker.location.city(),
    ...overrides,
  };
}
