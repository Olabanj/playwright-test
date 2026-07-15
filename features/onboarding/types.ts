// Single source of truth for onboarding-domain data + wire shapes.
// Data builders live in builders/company.builder.ts; HTTP lives in client.ts.

import type { Person, CompanyData } from '@utils/data/user-faker';

/** Full client sign-up data set (API mirror of the UI wizard). */
export interface ClientRegistrationData {
  email:    string;
  password: string;
  country:  string;
  person:   Person;
  phone:    string;
  company:  CompanyData;
}

/** "Confirm company details" form (/registration-document). */
export interface CompanyRegistrationDocData {
  companyLinkedin:       string;
  companyWebsite:        string;
  personalLinkedin:      string;
  isAuthorizedSignatory: boolean;
  signatoryCountry:      string;
  taxNumber?:            string;
}

/**
 * KYB submission over the API (mirrors the "Confirm company details" form but
 * keyed by id, not display name) — required precondition before an admin can
 * approve KYB. Ported from the legacy ClientOnboardingAPI.submitKyb.
 */
export interface SubmitKybPayload {
  companyLinkedin:       string;
  companyWebsite:        string;
  personalLinkedin:      string;
  isAuthorizedSignatory: boolean;
  signatoryName:         string;
  signatoryCountryId:    number;
}

/** Required fields on the Company Info settings tab (/settings/info). */
export interface CompanySettingsRequiredData {
  legalName:         string;
  companyType:       string;
  registrationNumber: string;
  numberOfEmployees: string;
  currency:          string;
  address:           string;
  country:           string;
  city:              string;
}

/**
 * Result of registering a fresh client via API. All three identifiers come from
 * the API (no DB lookup): userId is decoded from the verify-token JWT `sub`,
 * companyId from the company-update response.
 */
export interface RegisteredClient {
  regData:   ClientRegistrationData;
  token:     string;
  userId:    number;
  companyId: number;
}

// --- Loose wire-response wrappers (the API nests under `data`). ---
export interface VerifyResponse        { success?: boolean; data?: { token?: string }; }
export interface CompanyUpdateResponse { success?: boolean; data?: { id?: number }; }
export interface MutationResponse      { success?: boolean; }
