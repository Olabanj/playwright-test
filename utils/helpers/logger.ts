import { env } from '@core/config/env';

export function logVerbose(...args: unknown[]): void {
  if (env.verbose) {
     
    console.log('[verbose]', ...args);
  }
}
