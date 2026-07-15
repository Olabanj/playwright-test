import { env } from '@core/config/env';

/**
 * DB connection config for the gated, read-only DB-OTP accessor
 * (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md). This layer is scoped
 * to exactly one database and one query (worker OTP read) — it is NOT a
 * general-purpose DB layer. All values come from optional env keys and may be
 * empty; callers must check `isDbEnvPresent()` before using this config.
 */
export interface DatabaseConfig {
  name:     string;
  host:     string;
  port:     number;
  user:     string;
  password: string;
  database: string;
}

/** True when every SSH/DB env var this layer needs is present. */
export function isDbEnvPresent(): boolean {
  return Boolean(env.sshHost && env.sshUser && env.sshKeyPath && env.dbHost && env.dbUser);
}

/** Config for the `remotewise_db` database (users/OTP) — the only DB this layer reads. */
export function getDbConfig(): DatabaseConfig {
  return {
    name:     'remotewise_db',
    host:     env.dbHost,
    port:     env.dbPort ?? 3306,
    user:     env.dbUser,
    password: env.dbPassword,
    database: 'remotewise_db',
  };
}
