import * as fs from 'fs';
import { BaseApiClient } from '@core/http/BaseApiClient';
import { assertOk, assertOkWithId } from '@core/http/assertOk';
import { ENDPOINTS } from '@core/config/endpoints';
import { logVerbose } from '@utils/helpers/logger';
import { BYPASS_VERIFICATION_CODE, REGISTRATION_DOC_PATH } from './constants';
import { CompanyUpdateResponse, MutationResponse, SubmitKybPayload, VerifyResponse } from './types';

export interface UpdateClientPayload {
  firstName: string;
  lastName:  string;
  countryId: number;
  email:     string;
  phone:     string;
  password:  string;
}

export interface UpdateCompanyPayload {
  name:           string;
  countryId:      number;
  typeId:         number;
  nbEmployees:    string;
  address:        string;
  registrationNo: string;
  currencyId:     number;
  city:           string;
}

/**
 * Typed HTTP client for the client sign-up API. One method = one request; the
 * multi-step registration handshake (and the unauth→auth context switch) is
 * composed in seeding.ts (registerFreshClient), not here.
 *
 * Endpoints from legacy ClientRegistrationAPI; client/company updates are
 * multipart/form-data (the platform sets fields via form posts).
 */
export class OnboardingClient extends BaseApiClient {
  /** Step 1 — register the email (unauthenticated). */
  async signup(email: string): Promise<void> {
    logVerbose(`[OnboardingClient] signup ${email}`);
    const res = await this.post<MutationResponse>(ENDPOINTS.registration.signup, {
      email,
      source_path: 'signup',
      source_data: {},
    });
    assertOk(res, 'signup');
  }

  /** Step 2 — verify the OTP; returns the client auth token. */
  async verify(email: string, otp: string = BYPASS_VERIFICATION_CODE): Promise<string> {
    logVerbose(`[OnboardingClient] verify ${email}`);
    const res = await this.post<VerifyResponse>(ENDPOINTS.registration.verify, { email, otp });
    assertOk(res, 'verify');
    const token = res.body?.data?.token;
    if (!token) {
      throw new Error(`verify returned no token (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return token;
  }

  /** Step 3 — personal info (multipart; requires the auth token from verify). */
  async updateClient(data: UpdateClientPayload): Promise<void> {
    logVerbose(`[OnboardingClient] updateClient email=${data.email}`);
    const res = await this.postMultipart<MutationResponse>(ENDPOINTS.registration.clientUpdate, {
      first_name: data.firstName,
      last_name:  data.lastName,
      country_id: String(data.countryId),
      email:      data.email,
      phone:      data.phone,
      password:   data.password,
    });
    assertOk(res, 'updateClient');
  }

  /** Step 4 — company info (multipart); returns the new company id. */
  async updateCompany(data: UpdateCompanyPayload): Promise<number> {
    logVerbose(`[OnboardingClient] updateCompany name=${data.name}`);
    const res = await this.postMultipart<CompanyUpdateResponse>(ENDPOINTS.registration.companyUpdate, {
      name:            data.name,
      country_id:      String(data.countryId),
      type_id:         String(data.typeId),
      nb_employees:    data.nbEmployees,
      address:         data.address,
      registration_no: data.registrationNo,
      currency_id:     String(data.currencyId),
      city:            data.city,
    });
    return assertOkWithId(res, 'updateCompany');
  }

  /**
   * Step 5 — submit KYB (multipart; requires the auth token). Sets the company's
   * KYB status to "submitted" so an admin can subsequently approve it via
   * AdminClient.approveCompanyKyb. Endpoint confirmed via rp-search/rp-show +
   * cross-check against legacy ClientOnboardingAPI.submitKyb (G6, 2026-07-08) —
   * same /api/company/update endpoint as updateCompany, different field set.
   */
  async submitKyb(data: SubmitKybPayload): Promise<void> {
    logVerbose(`[OnboardingClient] submitKyb signatory=${data.signatoryName}`);
    const res = await this.postMultipart<MutationResponse>(ENDPOINTS.registration.companyUpdate, {
      linkedin_profile_url:          data.companyLinkedin,
      website_url:                   data.companyWebsite,
      personal_linkedin_profile_url: data.personalLinkedin,
      is_authorized_signatory:       data.isAuthorizedSignatory ? '1' : '0',
      signatory_name:                data.signatoryName,
      signatory_country_id:          String(data.signatoryCountryId),
      registration_document: {
        name:     'registration-document.pdf',
        mimeType: 'application/pdf',
        buffer:   fs.readFileSync(REGISTRATION_DOC_PATH),
      },
    });
    assertOk(res, 'submitKyb');
  }
}
