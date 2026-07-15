import { logVerbose } from '@utils/helpers/logger';
import { isDbEnvPresent } from './db-config';
import { getDbConnection } from './db-connection-manager';

interface OtpRow {
  otp?: string | null;
}

/**
 * Gated, read-only worker-OTP lookup — `SELECT otp FROM users WHERE email = ?`.
 * See docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md.
 *
 * SENTINEL: resolves to `null` — never throws — when (a) the SSH/DB env vars
 * are absent, (b) the SSH tunnel is unreachable, or (c) no row/OTP is found.
 * Callers (contractor worker-registration seeding) MUST treat `null` as
 * "precondition unavailable" and self-skip the dependent flow
 * (`test.skip(worker === null, ...)`), never as an error — this mirrors the
 * repo's sandbox-precondition sentinel pattern (see CLAUDE.md "Sentinel
 * self-skip"). Every dependent flow carries a `TODO(api-preconditions)` marker
 * referencing this ADR.
 *
 * Never add a second query or any write here — this accessor is intentionally
 * single-purpose (read-only OTP retrieval only).
 */
export async function getOtpFromDatabase(email: string): Promise<string | null> {
  logVerbose(`[core/db] getOtpFromDatabase ${email}`);

  if (!isDbEnvPresent()) {
    logVerbose('[core/db] getOtpFromDatabase: SSH/DB env vars not set — sentinel null (self-skip)');
    return null;
  }

  try {
    const db = getDbConnection();
    const rows = await db.query<OtpRow[]>('SELECT otp FROM users WHERE email = ? LIMIT 1', [email]);
    const otp = rows[0]?.otp;
    if (!otp) return null;
    return otp;
  } catch (err) {
    logVerbose(`[core/db] getOtpFromDatabase: tunnel/query failed — sentinel null (${String(err)})`);
    return null;
  }
}
