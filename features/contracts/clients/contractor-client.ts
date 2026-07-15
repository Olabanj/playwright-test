import * as fs from 'fs';
import { BaseApiClient } from '@core/http/BaseApiClient';
import { assertOk, assertOkWithId } from '@core/http/assertOk';
import { ENDPOINTS } from '@core/config/endpoints';
import { logVerbose } from '@utils/helpers/logger';
import {
  DeOnboardingData,
  DeProfileData,
  EorProfileData,
  WorkerRegistrationData,
} from '../types';

interface MutationResponse { success?: boolean; message?: string; data?: Record<string, unknown>; }
interface VerifyResponse { success?: boolean; data?: { token?: string }; }
interface LoginResponse { success?: boolean; data?: { token?: string }; }
interface ActivationResponse { success?: boolean; data?: { id?: number }; }
interface UploadResponse { success?: boolean; data?: { path?: string }; }

/** USD currency id — used for the employee profile currency (not the salary currency). */
const PROFILE_CURRENCY_USD_ID = 1;
/** First Abu Dhabi Bank routing code used in UAE IBANs (AE format). */
const FIRST_ABU_DHABI_BANK_CODE = '033';

/**
 * Typed HTTP client for the contractor/employee self-service backend boundary:
 * `/api/contractor/*` (signup/verify/update), `accounts.bankCreate`,
 * `storage.tempFileUpload` and `auth.login`. One method = one request.
 *
 * Merged in the 2026-07-09 client boundary re-audit from three clients that all
 * spoke to this same boundary (legacy `WorkerRegistrationAPI` +
 * `DEEmployeeAPI` + the EOR-employee self-service half of `EorEmployeeAPI`):
 *   - Contractor self-registration (Flow B): signup / verify / activateProfile /
 *     completeContractorProfile.
 *   - DE employee onboarding: completeOnboarding / uploadMolIdCard /
 *     completeDeEmployeeProfile / createDeBankAccount.
 *   - EOR employee self-service: activateAccount / login /
 *     completeEorEmployeeProfile / createEorBankAccount.
 *
 * The flow-specific profile-completion and bank-account methods are kept as
 * DISTINCT methods (not collapsed into one `completeProfile`/`createBankAccount`)
 * because their payloads genuinely differ per flow — DE sends `mol_id_card` +
 * `contractor_type: 'direct-employee'`, EOR sends `contractor_type: 'employee'`;
 * DE bank-account takes an external IBAN, EOR self-generates a UAE IBAN and sends
 * `dateOfBirth`. Collapsing them would change the HTTP payload, which this
 * behaviour-preserving re-audit does not do.
 *
 * The OTP DB read and the multi-step orchestration (signup → OTP → verify →
 * activate → complete, and the DE/EOR onboarding sequences) live in `seeding.ts`
 * — this client never reads the DB and never orchestrates. Endpoints confirmed
 * via rp-scribe (G6, 2026-07-08): `other-endpoints-POSTapi-contractor-{signup,
 * verify,update}`.
 */
export class ContractorClient extends BaseApiClient {
  // ─── Contractor self-registration (Flow B) — legacy WorkerRegistrationAPI ───

  /** Step 1 — send the OTP to the contractor's email (unauthenticated). */
  async signup(email: string): Promise<void> {
    logVerbose(`[ContractorClient] signup ${email}`);
    const res = await this.post<MutationResponse>(ENDPOINTS.contractor.signup, {
      email,
      source_path: 'register',
    });
    assertOk(res, 'signup');
  }

  /** Step 2 — verify the OTP (read from remotewise_db via `core/db/otp.ts`); returns the contractor's auth token. */
  async verify(email: string, otp: string): Promise<string> {
    logVerbose(`[ContractorClient] verify ${email}`);
    const res = await this.post<VerifyResponse>(ENDPOINTS.contractor.verify, { email, otp });
    assertOk(res, 'verify');
    const token = res.body.data?.token;
    if (!token) {
      throw new Error(`verify returned no token (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return token;
  }

  /**
   * Step 3a — initial account activation (multipart; requires the token from
   * `verify`). `new_contractor_onboard: 'true'` marks the first-time
   * activation call — same response shape (`data.id`) as `activateAccount` /
   * `completeOnboarding` against this same endpoint. Returns the new user id.
   */
  async activateProfile(data: WorkerRegistrationData): Promise<number> {
    logVerbose(`[ContractorClient] activateProfile email=${data.email}`);
    const res = await this.postMultipart<ActivationResponse>(ENDPOINTS.contractor.update, {
      new_contractor_onboard: 'true',
      first_name:             data.firstName,
      last_name:              data.lastName,
      email:                  data.email,
      country_id:             String(data.countryId ?? 231),
      phone:                  data.phone,
      password:               data.password,
    });
    return assertOkWithId(res, 'activateProfile');
  }

  /**
   * Step 3b — complete the KYC profile fields (tax residence, citizenship,
   * document, DOB, etc.) required before the contractor can sign a contract.
   */
  async completeContractorProfile(data: WorkerRegistrationData): Promise<void> {
    logVerbose(`[ContractorClient] completeContractorProfile email=${data.email}`);
    const res = await this.postMultipart<MutationResponse>(ENDPOINTS.contractor.update, {
      first_name:               data.firstName,
      last_name:                data.lastName,
      phone:                    data.phone,
      address:                  '123 QA Test Street',
      city:                     'Dubai',
      zip_code:                 '12345',
      country_id:               String(data.countryId ?? 231),
      title:                    'Mr',
      Country_of_Tax_Residence: String(data.countryId ?? 231),
      Country_of_Citizenship:   String(data.countryId ?? 231),
      document_number:          `QA${Date.now()}`,
      document_type:            '2',
      birth_date:               '1990-01-01',
      currency_id:              '1',
      contractor_type:          'individual',
    });
    assertOk(res, 'completeContractorProfile');
  }

  // ─── Direct Employee (DE) onboarding — legacy DEEmployeeAPI ───

  /** Initial DE onboarding via the invite wizard. Returns the new user id. */
  async completeOnboarding(data: DeOnboardingData): Promise<number> {
    logVerbose(`[ContractorClient] completeOnboarding email=${data.email}`);
    const res = await this.postMultipart<{ success?: boolean; data?: { id?: number } }>(ENDPOINTS.contractor.update, {
      new_contractor_onboard: 'true',
      first_name:             data.firstName,
      last_name:              data.lastName,
      email:                  data.email,
      country_id:             String(data.countryId),
      phone:                  data.phone,
      password:               data.password,
    });
    return assertOkWithId(res, 'completeOnboarding');
  }

  /** Upload the MOL ID card image. Returns the stored file path. */
  async uploadMolIdCard(imagePath: string): Promise<string> {
    logVerbose(`[ContractorClient] uploadMolIdCard ${imagePath}`);
    const res = await this.postMultipart<UploadResponse>(ENDPOINTS.storage.tempFileUpload, {
      file: { name: 'mol-id-card.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(imagePath) },
      type: 'mol_id_cards',
    });
    assertOk(res, 'uploadMolIdCard');
    const path = res.body.data?.path;
    if (!path) {
      throw new Error(`uploadMolIdCard: no path in response (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return path;
  }

  /** Complete the DE employee profile (General Info). */
  async completeDeEmployeeProfile(data: DeProfileData): Promise<void> {
    logVerbose(`[ContractorClient] completeDeEmployeeProfile firstName=${data.firstName}`);
    const res = await this.postMultipart<MutationResponse>(ENDPOINTS.contractor.update, {
      mol_id_card:              data.molIdCardPath,
      mol_id:                   data.molId,
      first_name:               data.firstName,
      last_name:                data.lastName,
      Country_of_Tax_Residence: String(data.countryId),
      Country_of_Citizenship:   String(data.countryId),
      document_number:          data.documentNumber,
      document_type:            '2',
      birth_date:               '1990-01-01',
      phone:                    data.phone,
      address:                  '123 Test Street Dubai',
      currency_id:              '1',
      city:                     'Dubai',
      country_id:               String(data.countryId),
      contractor_type:          'direct-employee',
    });
    assertOk(res, 'completeDeEmployeeProfile');
  }

  /** Create a UAE bank account for the DE employee (external IBAN supplied by the caller). */
  async createDeBankAccount(iban: string, holderName: string): Promise<void> {
    logVerbose(`[ContractorClient] createDeBankAccount iban=${iban}`);
    const res = await this.post<MutationResponse>(ENDPOINTS.accounts.bankCreate, {
      currency:          'USD',
      accountHolderName: holderName,
      type:              'swift_code',
      legalType:         'PRIVATE',
      address: { country: 'AE', city: 'Dubai', firstLine: '123 Test Street', state: 'DU' },
      swiftCode: 'FABAAEAD',
      iban,
      bankName: 'First Abu Dhabi Bank',
    });
    assertOk(res, 'createDeBankAccount');
  }

  // ─── EOR employee self-service — legacy EorEmployeeAPI (self-service half) ───

  /**
   * Activate an EOR employee account using the invite token from the invitation
   * URL. Authenticated with the ONE-TIME invite token via the shared
   * `requestAsToken` primitive — NOT this client's own bearer (the client isn't
   * `init()`'d with a session token yet at this point in the flow). Returns the
   * new employee's user id (`data.id` — same `/api/contractor/update` response
   * shape as `completeOnboarding`), needed by the caller to disable 2FA via
   * `AdminClient.disable2fa` before the employee's first `login()` — the
   * freshly-activated employee is 2FA-gated and `login()` otherwise returns
   * `{success:true, data:{"2fa":true}}` with no token.
   */
  async activateAccount(inviteToken: string, email: string, password: string): Promise<number> {
    logVerbose(`[ContractorClient] activateAccount email=${email}`);
    const res = await this.requestAsToken<{ success?: boolean; data?: { id?: number } }>(
      inviteToken,
      'POST',
      ENDPOINTS.contractor.update,
      { email, password },
    );
    return assertOkWithId(res, 'activateAccount');
  }

  /** Login with email/password. Returns the JWT bearer token. */
  async login(email: string, password: string): Promise<string> {
    logVerbose(`[ContractorClient] login email=${email}`);
    const res = await this.post<LoginResponse>(ENDPOINTS.auth.login, { email, password });
    assertOk(res, 'login');
    const token = res.body.data?.token;
    if (!token) {
      throw new Error(`login: no token in response (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return token;
  }

  /** Complete the EOR employee general-info profile. `document_type: 2` (Passport) marks KYC fields complete. */
  async completeEorEmployeeProfile(data: EorProfileData): Promise<void> {
    logVerbose(`[ContractorClient] completeEorEmployeeProfile firstName=${data.firstName}`);
    const res = await this.postMultipart<MutationResponse>(ENDPOINTS.contractor.update, {
      first_name:               data.firstName,
      last_name:                data.lastName,
      Country_of_Tax_Residence: String(data.countryId),
      Country_of_Citizenship:   String(data.countryId),
      document_number:          data.documentNumber,
      document_type:            '2',
      birth_date:               '1990-01-01',
      phone:                    data.phone,
      address:                  '123 QA Test Street',
      currency_id:              String(PROFILE_CURRENCY_USD_ID),
      city:                     data.city ?? 'QA City',
      country_id:               String(data.countryId),
      contractor_type:          'employee',
    });
    assertOk(res, 'completeEorEmployeeProfile');
  }

  /**
   * Create a USD bank account for the EOR employee via First Abu Dhabi Bank (UAE
   * IBAN) — universally accepted since all EOR countries are patched to
   * `is_salary_payable_in_usd = true`. Self-generates the IBAN (unlike
   * `createDeBankAccount`, which takes one from the caller).
   */
  async createEorBankAccount(holderName: string, currency = 'USD'): Promise<void> {
    logVerbose(`[ContractorClient] createEorBankAccount holderName=${holderName} currency=${currency}`);
    const res = await this.post<MutationResponse>(ENDPOINTS.accounts.bankCreate, {
      currency,
      accountHolderName: holderName,
      dateOfBirth:       '1990-01-01T00:00:00.000Z',
      type:              'swift_code',
      legalType:         'PRIVATE',
      address: { country: 'AE', city: 'Dubai', firstLine: '123 QA Test Street', state: 'DU' },
      swiftCode: 'FABAAEAD',
      iban:      this.generateUaeIban(),
      bankName:  'First Abu Dhabi Bank',
    });
    assertOk(res, 'createEorBankAccount');
  }

  /** Generate a valid UAE IBAN (AE format, First Abu Dhabi Bank, bank code 033). */
  private generateUaeIban(): string {
    const account = Math.floor(Math.random() * 1e15).toString().padStart(16, '0');
    const bban    = FIRST_ABU_DHABI_BANK_CODE + account; // 19 digits
    // ISO 13616: move BBAN to front, append country digits (AE → A=10, E=14 → "1014") + "00", mod-97.
    const testStr = bban + '1014' + '00';
    let mod = 0;
    for (const ch of testStr) mod = (mod * 10 + parseInt(ch, 10)) % 97;
    const check = String(98 - mod).padStart(2, '0');
    return `AE${check}${bban}`;
  }
}
