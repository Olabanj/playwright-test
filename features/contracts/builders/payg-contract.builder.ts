import { generateWorkerData } from '@utils/data/user-faker';
import { CURRENCY_IDS, CurrencyCode, PAY_CYCLES, PayCycle, SANDBOX_TAX_RESIDENCE_UAE } from '../constants';
import { ContractorContractInput } from '../types';

const DEFAULT_START_OFFSET_DAYS = 7;
const DEFAULT_FIRST_PAYMENT_OFFSET_DAYS = 37;
const DEFAULT_AMOUNT = 50;
/** rate_id: 1 = hourly (the API's default rate). */
const DEFAULT_RATE_ID = 1;

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fluent builder for a PAYG (pay-as-you-go) contractor contract's create-time
 * data. No HTTP — pure data construction. `signatoryId`/`templateId` are
 * account-specific and resolved dynamically by `seeding.ts`, not by this
 * builder. Worker name/email reuse the team's uniqueness convention verbatim
 * (root CLAUDE.md "Worker Factory Rules").
 */
export class PaygContractBuilder {
  private data: Partial<ContractorContractInput> = {};

  withContractorName(name: string): this {
    this.data.contractorName = name;
    return this;
  }

  /** Rate amount in dollars (per `rateId` unit — hourly by default). */
  withAmount(amount: number): this {
    this.data.amount = amount;
    return this;
  }

  /** Rate id (1 = hourly, 5 = monthly). */
  withRateId(rateId: number): this {
    this.data.rateId = rateId;
    return this;
  }

  withCurrency(code: CurrencyCode): this {
    this.data.currencyId = CURRENCY_IDS[code];
    return this;
  }

  /** Sets frequency/occurrence ids for a named pay cycle (e.g. 'Weekly'). */
  withPayCycle(cycle: PayCycle): this {
    const spec = PAY_CYCLES.find((p) => p.cycle === cycle);
    if (!spec) {
      throw new Error(`PaygContractBuilder.withPayCycle: unknown cycle "${cycle}"`);
    }
    this.data.frequencyId = spec.frequencyId;
    this.data.occurrenceId = spec.occurrenceId;
    return this;
  }

  withTaxResidence(countryId: number): this {
    this.data.taxResidenceId = countryId;
    return this;
  }

  withContractName(name: string): this {
    this.data.contractName = name;
    return this;
  }

  /**
   * Marks this contract as Contractor-of-Record (`is_cor: true`) — COR is not
   * a separate contract type, just a flag on Fixed/PAYG/Milestone (Phase 5).
   * The flag on the built payload is informational (assertions/defaults); the
   * dedicated `ContractsClient.createCorPaygContract` always sends
   * `is_cor: true` regardless — see `ContractorContractCreateData.isCor` JSDoc.
   */
  asCor(): this {
    this.data.isCor = true;
    return this;
  }

  build(): ContractorContractInput {
    const worker = generateWorkerData('payg-contractor');
    const monthly = PAY_CYCLES.find((p) => p.cycle === 'Monthly')!;
    const defaults: ContractorContractInput = {
      contractorName:   `${worker.firstName} ${worker.lastName}`,
      contractorEmail:  worker.email,
      currencyId:       CURRENCY_IDS.USD,
      amount:           DEFAULT_AMOUNT,
      rateId:           DEFAULT_RATE_ID,
      startDate:        daysFromNow(DEFAULT_START_OFFSET_DAYS),
      firstPaymentDate: daysFromNow(DEFAULT_FIRST_PAYMENT_OFFSET_DAYS),
      frequencyId:      monthly.frequencyId,
      occurrenceId:     monthly.occurrenceId,
      taxResidenceId:   SANDBOX_TAX_RESIDENCE_UAE,
      contractName:     `QA PAYG ${Date.now()}`,
    };
    return { ...defaults, ...this.data };
  }
}
