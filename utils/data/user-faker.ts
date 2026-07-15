/**
 * Shared faker-based test-data primitives — person, phone, email, company.
 *
 * Ported from the legacy fixtures/data/user-faker.ts so the new framework
 * generates the same realistic, validation-passing data. Cross-feature: reused by
 * client-registration today and onboarding/contracts/payments later.
 *
 * Pure data — no HTTP, no Playwright. Lives in utils so any feature builder can use it.
 */
import { faker } from '@faker-js/faker';

/** Default registration country (matches the legacy DEFAULT_COUNTRY). */
export const DEFAULT_COUNTRY = 'Saudi Arabia';

export interface Person {
  firstName: string;
  middleName: string;
  lastName: string;
}

export interface CompanyData {
  legalName: string;
  type: string;
  registrationNumber: string;
  numberOfEmployees: string;
  currency: string;
  address: string;
  country: string;
  city: string;
}

/** Random person with alphabetic-only first/last names (the API rejects non-alpha). */
export function generatePerson(): Person {
  return {
    firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
    lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
    middleName: faker.person.middleName().replace(/[^a-zA-Z]/g, ''),
  };
}

/**
 * UAE mobile, NATIONAL significant number only (no country code): the sign-up
 * phone field is an intl-tel-input with +971 already selected, so it prepends the
 * code itself. The legacy value '971544…' double-prefixed the code (+971 971…),
 * failing validation — here we return '54' + 7 digits (valid UAE prefix).
 */
export function generatePhoneNumber(): string {
  return '54' + faker.string.numeric(7);
}

/** A unique, valid client sign-up email. */
export function generateClientEmail(): string {
  return `qa+signup-${Date.now()}${faker.string.numeric(3)}@remotepass.com`;
}

export interface WorkerData {
  email:     string;
  firstName: string;
  lastName:  string;
  phone:     string;
  role:      string;
}

/**
 * Converts a numeric timestamp to an all-alpha string so it can be safely
 * embedded in a name field that rejects digits (0→a, 1→b, … 9→j).
 * Ported verbatim from the legacy seeder's `tsToAlpha` (root CLAUDE.md
 * "Worker Factory Rules") — the single team convention for worker uniqueness.
 */
function tsToAlpha(ts: number): string {
  return String(ts).replace(/\d/g, (d) => String.fromCharCode(97 + Number(d)));
}

/**
 * Generates unique worker/contractor registration data.
 * Email format:    `qa+seeder-{role-slug}-{timestamp}-{rand}@remotepass.com`
 * lastName format: `Worker{tsAlpha}` — alpha-only, unique per timestamp
 * (root CLAUDE.md "Worker Factory Rules" — the team's established convention,
 * reused verbatim rather than inventing a new one).
 */
export function generateWorkerData(role: string): WorkerData {
  const timestamp = Date.now();
  const slug = role.toLowerCase().replace(/\s+/g, '-');
  const alpha = tsToAlpha(timestamp);
  // Random 3-digit suffix guards against same-millisecond collisions in parallel runs.
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return {
    email:     `qa+seeder-${slug}-${timestamp}-${rand}@remotepass.com`,
    firstName: 'QA',
    lastName:  `Worker${alpha}`,
    // Full E.164 WITHOUT the leading '+': worker/employee onboarding endpoints
    // (e.g. WorkerRegistrationClient.activateProfile) reject the national-only
    // format this used to return ('54XXXXXXX') with "Invalid given phone number"
    // (confirmed 2026-07-08) — UAE country code '971' + the '544' mobile prefix,
    // matching the known-good legacy seeder format
    // (tests/modules/integration-setup/helpers/user-faker.ts::generateWorkerData).
    // Note: this is a distinct concern from `generatePhoneNumber` above, which
    // stays national-only for the sign-up intl-tel-input widget.
    phone:     '971544' + faker.string.numeric(6),
    role,
  };
}

/**
 * Generate a valid UAE IBAN (AE format, First Abu Dhabi Bank, bank code 033).
 * Mirrors the algorithm already used privately by `EorEmployeeClient` (ISO
 * 13616 mod-97 checksum) — exposed here as the shared primitive per
 * architecture-mapping.md line 118 ("Hardcoded legacy data ... UAE IBAN" ->
 * builders extending `@utils/data/user-faker`), since DE employee bank-account
 * seeding (`DeEmployeeClient.createBankAccount`) is now a second consumer.
 */
export function generateUaeIban(): string {
  const FIRST_ABU_DHABI_BANK_CODE = '033';
  const account = Math.floor(Math.random() * 1e15).toString().padStart(16, '0');
  const bban = FIRST_ABU_DHABI_BANK_CODE + account; // 19 digits
  // ISO 13616: move BBAN to front, append country digits (AE → A=10, E=14 → "1014") + "00", mod-97.
  const testStr = bban + '1014' + '00';
  let mod = 0;
  for (const ch of testStr) mod = (mod * 10 + parseInt(ch, 10)) % 97;
  const check = String(98 - mod).padStart(2, '0');
  return `AE${check}${bban}`;
}

/** Realistic company registration details. */
export function generateCompanyInfo(): CompanyData {
  return {
    legalName: faker.company.name(),
    type: 'LLC',
    registrationNumber: faker.string.numeric(10),
    numberOfEmployees: '50',
    currency: 'USD',
    address: faker.location.streetAddress(),
    country: DEFAULT_COUNTRY,
    city: faker.location.city(),
  };
}
