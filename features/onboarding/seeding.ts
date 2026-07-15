import { logVerbose } from '@utils/helpers/logger';
import { OnboardingClient } from './api-client';
import { buildClientRegistrationData, buildKybSubmissionData } from './builders/company.builder';
import { COMPANY_TYPE_ID, COUNTRY_ID, CURRENCY_ID } from './constants';
import { ClientRegistrationData, RegisteredClient } from './types';

/**
 * Stateless API composition for the onboarding domain. registerFreshClient runs
 * the full sign-up handshake over OnboardingClient and returns the token + ids —
 * no DB lookup (userId is decoded from the JWT, companyId from the API response),
 * replacing the legacy db-connection-manager dependency.
 */

function requireLookup(map: Record<string, number>, key: string, label: string): number {
  const value = map[key];
  if (value === undefined) {
    throw new Error(`Unknown ${label}: "${key}". Known: ${Object.keys(map).join(', ')}`);
  }
  return value;
}

/** Decode the integer user id from a JWT `sub` claim (pure — no I/O). */
function decodeUserIdFromJwt(jwt: string): number {
  const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8')) as { sub?: string | number };
  const userId = Number.parseInt(String(payload.sub), 10);
  if (Number.isNaN(userId)) {
    throw new Error(`JWT 'sub' claim is not an integer: ${String(payload.sub)}`);
  }
  return userId;
}

/**
 * Register a brand-new client via API: signup → verify → update personal info →
 * update company info. Manages the unauthenticated→authenticated context switch
 * and disposes the client on completion. Returns token + userId + companyId.
 */
export async function registerFreshClient(
  regData: ClientRegistrationData = buildClientRegistrationData(),
): Promise<RegisteredClient> {
  logVerbose(`[seeding] registerFreshClient ${regData.email}`);
  const client = new OnboardingClient();
  try {
    await client.init();
    await client.signup(regData.email);
    const token = await client.verify(regData.email);
    const userId = decodeUserIdFromJwt(token);

    await client.dispose();
    await client.init(token);

    await client.updateClient({
      firstName: regData.person.firstName,
      lastName:  regData.person.lastName,
      countryId: requireLookup(COUNTRY_ID, regData.country, 'country'),
      email:     regData.email,
      phone:     regData.phone,
      password:  regData.password,
    });

    const companyId = await client.updateCompany({
      name:           regData.company.legalName,
      countryId:      requireLookup(COUNTRY_ID, regData.company.country, 'company country'),
      typeId:         requireLookup(COMPANY_TYPE_ID, regData.company.type, 'company type'),
      nbEmployees:    regData.company.numberOfEmployees,
      address:        regData.company.address,
      registrationNo: regData.company.registrationNumber,
      currencyId:     requireLookup(CURRENCY_ID, regData.company.currency, 'currency'),
      city:           regData.company.city,
    });

    return { regData, token, userId, companyId };
  } finally {
    await client.dispose();
  }
}

/**
 * Submit KYB for an already-registered client — required before an admin can
 * approve it (the backend rejects approveCompanyKyb with "Company KYB status
 * must be submitted" otherwise). Public entry point for other features (e.g.
 * contracts) that need a finished/approved client precondition; re-inits a
 * short-lived OnboardingClient with the caller's token since registerFreshClient
 * disposes its own client on return.
 */
export async function submitKybForClient(client: RegisteredClient): Promise<void> {
  logVerbose(`[seeding] submitKybForClient ${client.regData.email}`);
  const onboarding = new OnboardingClient();
  try {
    await onboarding.init(client.token);
    await onboarding.submitKyb(buildKybSubmissionData());
  } finally {
    await onboarding.dispose();
  }
}
