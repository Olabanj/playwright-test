import { test, expect } from '@features/contracts/fixtures';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { createFixedContractViaApi, signContractorToOngoing } from '@features/contracts/seeding';
import { FixedContractBuilder } from '@features/contracts/builders/fixed-contract.builder';
import { CurrencyCode, PAY_CYCLES, PayCycle } from '@features/contracts/constants';
import { LifecycleWorker } from '@features/contracts/types';
import { isDbEnvPresent } from '@core/db/db-config';

// Contracts API — Full Cycle Matrix (pay-cycle × currency).
// Ported VERBATIM, kept permanently skipped (Playwright's designated
// not-yet-green test marker — see each test declaration below), from legacy
// tests/modules/contracts/api/verify/full-cycle-matrix.spec.ts — dimensional
// coverage for the Fixed contractor type:
//   - all 4 pay cycles (Monthly, Weekly, Every 2 Weeks, Twice a Month) in USD
//   - currency variants: ≥1 AED and ≥1 EUR (cross-currency from the company
//     currency)
//
// Every test stays marked not-yet-green — this is a structural re-expression
// in the new architecture (builder `.withPayCycle()`/`.withCurrency()` +
// `signContractorToOngoing` seeding composition), not a green-ification.
// Heavy + flaky (each variant registers a fresh worker via SSH-OTP self-signup,
// docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md), so this stays
// @regression @slow, out of the @critical full-cycle gate (full-cycle.spec.ts).
//
// Structural change from legacy: the legacy suite resolved raw
// frequencyId/occurrenceId/firstPaymentDate itself and called a bespoke
// `runContractorLifecycleToOngoing` helper with them. Here the pay-cycle
// mapping lives in `FixedContractBuilder.withPayCycle()` (constants.ts
// `PAY_CYCLES`) and creation/sign-to-Ongoing reuse the existing
// `createFixedContractViaApi` / `signContractorToOngoing` seeding helpers —
// no bespoke lifecycle helper, no reimplemented date math.

/** Build + create + sign one Fixed matrix variant to Ongoing. Never runs for real — every caller below is marked not-yet-green. */
async function runFixedMatrixCase(
  contractsClient: ContractsClient,
  worker: LifecycleWorker,
  opts: { label: string; currency: CurrencyCode; cycle: PayCycle },
): Promise<void> {
  const input = new FixedContractBuilder()
    .withCurrency(opts.currency)
    .withPayCycle(opts.cycle)
    .withContractName(`QA Matrix ${opts.label} ${Date.now()}`)
    .build();
  const created = await createFixedContractViaApi(contractsClient, input);
  try {
    const signatory = await contractsClient.getSignatory();

    const reachedOngoing = await signContractorToOngoing({
      contracts:     contractsClient,
      contractId:    created.id,
      contractRef:   created.ref,
      worker,
      signatoryName: signatory.name,
    });

    expect(reachedOngoing).toBe(true);
  } finally {
    await contractsClient.cancelContract(created.id).catch(() => undefined);
  }
}

test.describe('Contracts API — Full Cycle Matrix (Fixed pay-cycle × currency) @api', () => {
  for (const spec of PAY_CYCLES) {
    test.fixme(
      `Fixed ${spec.cycle} (USD) → Ongoing @regression @slow`,
      async ({ contractsClient, seedContractorWorker }) => {
        test.setTimeout(180_000);
        test.skip(
          !isDbEnvPresent(),
          'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
        );

        const worker = await seedContractorWorker(`matrix-${spec.cycle.toLowerCase().replace(/\s+/g, '-')}`);
        test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

        await runFixedMatrixCase(contractsClient, worker!, { label: spec.cycle, currency: 'USD', cycle: spec.cycle });
      },
    );
  }

  test.fixme(
    'Fixed Monthly (AED — cross-currency) → Ongoing @regression @slow',
    async ({ contractsClient, seedContractorWorker }) => {
      test.setTimeout(180_000);
      test.skip(
        !isDbEnvPresent(),
        'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
      );

      const worker = await seedContractorWorker('matrix-aed');
      test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

      await runFixedMatrixCase(contractsClient, worker!, { label: 'AED', currency: 'AED', cycle: 'Monthly' });
    },
  );

  test.fixme(
    'Fixed Monthly (EUR — cross-currency) → Ongoing @regression @slow',
    async ({ contractsClient, seedContractorWorker }) => {
      test.setTimeout(180_000);
      test.skip(
        !isDbEnvPresent(),
        'DB-OTP tunnel env not present — TODO(api-preconditions), see 2026-07-08-dmytro-db-otp-layer',
      );

      const worker = await seedContractorWorker('matrix-eur');
      test.skip(worker === null, 'worker OTP DB tunnel unavailable — see 2026-07-08-dmytro-db-otp-layer');

      await runFixedMatrixCase(contractsClient, worker!, { label: 'EUR', currency: 'EUR', cycle: 'Monthly' });
    },
  );
});
