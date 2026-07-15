import dotenv from 'dotenv';
import path from 'path';

const envName = process.env.ENV ?? 'local';
const envFile = envName === 'local' ? '.env' : `.env.${envName}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env variable: ${key} (env: ${envName})`);
  }
  return value;
}

function flag(key: string): boolean {
  const value = process.env[key];
  return value === 'true' || value === '1';
}

export const env = {
  envName,

  apiBaseUrl:     requireEnv('API_BASE_URL'),
  frontofficeUrl: requireEnv('FRONTOFFICE_URL'),
  backofficeUrl:  requireEnv('BACKOFFICE_URL'),

  clientEmail:    requireEnv('CLIENT_EMAIL'),
  clientPassword: requireEnv('CLIENT_PASSWORD'),
  workerEmail:    requireEnv('WORKER_EMAIL'),
  workerPassword: requireEnv('WORKER_PASSWORD'),
  adminEmail:     process.env.ADMIN_EMAIL ?? '',
  adminPassword:  process.env.ADMIN_PASSWORD ?? '',

  e2eSecretKey:   process.env.E2E_SECRET_KEY ?? '',
  /** Admin test-login key for GET /api/admin/login/test/<key> (onboarding KYB approval, disable-2FA). */
  adminLoginKey:  process.env.ADMIN_LOGIN_KEY ?? '',
  /** Optional EOR contract for the salary-currency edit flow (Pending-company-signature). Tests skip if unset. */
  eorContractId:  process.env.EOR_CONTRACT_ID ? Number(process.env.EOR_CONTRACT_ID) : undefined,
  eorContractRef: process.env.EOR_CONTRACT_REF ?? '',
  /** Optional Fixed contractor contract id for worker-assignment tests. Tests self-skip via live
   *  discovery if unset and no Fixed contracts exist on sandbox. */
  ttFixedContractId: process.env.TT_FIXED_CONTRACT_ID ? Number(process.env.TT_FIXED_CONTRACT_ID) : undefined,
  /**
   * Optional per_hour (PAYG) worker contract id override for session tests.
   * TODO(api-preconditions): when unset, the session fixture discovers it via live lookup
   *   (getContracts as worker). Set this to the known worker per_hour contract id (e.g. 17457)
   *   to skip discovery and make session tests faster in CI.
   */
  ttWorkerContractId: process.env.TT_WORKER_CONTRACT_ID ? Number(process.env.TT_WORKER_CONTRACT_ID) : undefined,

  /** Separate AWS host for the Time Tracking microservice (NOT API_BASE_URL). */
  timeTrackingApiUrl: requireEnv('TIME_TRACKING_API_URL'),

  /**
   * Optional — gated DB-OTP read layer (core/db), see
   * docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md. All optional and NEVER
   * required: local absence self-skips the dependent worker-registration flow,
   * it is not a bug. DB/SSH secrets are CI-only today (D4 in that ADR).
   */
  sshHost:    process.env.SSH_HOST ?? '',
  sshPort:    process.env.SSH_PORT ? Number(process.env.SSH_PORT) : undefined,
  sshUser:    process.env.SSH_USER ?? '',
  sshKeyPath: process.env.SSH_KEY_PATH ?? '',
  dbHost:     process.env.DB_HOST ?? '',
  dbPort:     process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  dbUser:     process.env.DB_USER ?? '',
  dbPassword: process.env.DB_PASSWORD ?? '',

  verbose: flag('VERBOSE') || flag('DEBUG'),
  isCi:    flag('CI'),
} as const;

export type Env = typeof env;
