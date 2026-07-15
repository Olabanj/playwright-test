import { generateWorkerData } from '@utils/data/user-faker';
import { CURRENCY_IDS, CurrencyCode, SANDBOX_TAX_RESIDENCE_UAE } from '../constants';
import { ContractorContractInput } from '../types';

/**
 * Fluent builder for a Milestone contractor contract's create-time data. No
 * HTTP — pure data construction. `signatoryId`/`templateId` are
 * account-specific and resolved dynamically by `seeding.ts`, not by this
 * builder. Worker name/email reuse the team's uniqueness convention verbatim
 * (root CLAUDE.md "Worker Factory Rules").
 *
 * No `.withPayCycle()` here (unlike Fixed/PAYG): a Milestone contract has no
 * recurring frequency/occurrence — it bills per deliverable, confirmed by the
 * legacy `createMilestoneContract` payload, which carries no frequency fields.
 */
export class MilestoneContractBuilder {
  private data: Partial<ContractorContractInput> = {};

  withContractorName(name: string): this {
    this.data.contractorName = name;
    return this;
  }

  withCurrency(code: CurrencyCode): this {
    this.data.currencyId = CURRENCY_IDS[code];
    return this;
  }

  withMilestones(milestones: { name: string; amount: number }[]): this {
    this.data.milestones = milestones;
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
   * dedicated `ContractsClient.createCorMilestoneContract` always sends
   * `is_cor: true` regardless — see `ContractorContractCreateData.isCor` JSDoc.
   */
  asCor(): this {
    this.data.isCor = true;
    return this;
  }

  build(): ContractorContractInput {
    const worker = generateWorkerData('milestone-contractor');
    const defaults: ContractorContractInput = {
      contractorName:  `${worker.firstName} ${worker.lastName}`,
      contractorEmail: worker.email,
      currencyId:      CURRENCY_IDS.USD,
      taxResidenceId:  SANDBOX_TAX_RESIDENCE_UAE,
      contractName:    `QA Milestone ${Date.now()}`,
      milestones: [
        { name: 'Phase 1', amount: 500 },
        { name: 'Phase 2', amount: 500 },
      ],
    };
    return { ...defaults, ...this.data };
  }
}
