import { Client as SSHClient, ClientChannel } from 'ssh2';
import mysql from 'mysql2/promise';
import dns from 'dns';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { env } from '@core/config/env';
import { logVerbose } from '@utils/helpers/logger';
import { DatabaseConfig, getDbConfig } from './db-config';

const dnsLookup = promisify(dns.lookup);

/**
 * SSH tunnel + mysql2 connection, ported (shape) from the legacy
 * `utils/database/db-connection-manager.ts`, scoped down to the single
 * `remotewise_db` database per docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md.
 * Read-only by contract — `otp.ts` is the only caller and issues exactly one
 * SELECT. Not exported directly; use `getDbConnection()`.
 */
class DatabaseConnection {
  private sshConnection: SSHClient | null = null;
  private dbConnection: mysql.Connection | null = null;
  private readonly config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.sshConnection = new SSHClient();
      this.sshConnection.on('error', (err) => { reject(err); });
      this.sshConnection.on('ready', () => {
        this.onSshReady().then(resolve, reject);
      });

      const keyPath = path.resolve(env.sshKeyPath);
      this.sshConnection.connect({
        host:         env.sshHost,
        port:         env.sshPort ?? 22,
        username:     env.sshUser,
        privateKey:   fs.readFileSync(keyPath),
        readyTimeout: 30_000,
        algorithms: {
          serverHostKey: [
            'ssh-rsa',
            'ssh-dss',
            'ecdsa-sha2-nistp256',
            'ssh-ed25519',
            'rsa-sha2-512',
            'rsa-sha2-256',
          ],
        },
      });
    });
  }

  /** Runs once the SSH tunnel is ready: resolve host → forward the port → open the DB connection. */
  private async onSshReady(): Promise<void> {
    logVerbose(`[core/db] SSH connection ready for ${this.config.name}`);

    // Resolve hostname locally so the bastion receives an IP, not a DNS name.
    let dbHost = this.config.host;
    try {
      const { address } = await dnsLookup(dbHost);
      dbHost = address;
    } catch {
      logVerbose(`[core/db] DNS lookup failed for ${dbHost}, using hostname as-is`);
    }

    const stream = await this.forwardOut(dbHost);
    this.dbConnection = await mysql.createConnection({
      stream,
      user:     this.config.user,
      password: this.config.password,
      database: this.config.database,
    });
    logVerbose(`[core/db] DB connected to ${this.config.name} via SSH tunnel`);
  }

  private forwardOut(dbHost: string): Promise<ClientChannel> {
    return new Promise((resolve, reject) => {
      this.sshConnection!.forwardOut('127.0.0.1', 0, dbHost, this.config.port, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(stream);
      });
    });
  }

  /** Read-only query. `otp.ts` is the sole caller — never add a write path here. */
  async query<T>(sql: string, params?: (string | number)[]): Promise<T> {
    if (!this.dbConnection) await this.connect();
    const [rows] = await this.dbConnection!.execute(sql, params);
    return rows as T;
  }

  async close(): Promise<void> {
    if (this.dbConnection) await this.dbConnection.end();
    if (this.sshConnection) this.sshConnection.end();
  }
}

let connection: DatabaseConnection | null = null;

/** Lazily creates (once per process) and returns the singleton `remotewise_db` connection. */
export function getDbConnection(): DatabaseConnection {
  connection ??= new DatabaseConnection(getDbConfig());
  return connection;
}
