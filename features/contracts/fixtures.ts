import { Page } from '@playwright/test';
import { baseTest, injectUiAuthFromAccount } from '@fixtures/base.fixture';
import { logVerbose } from '@utils/helpers/logger';
import { AdminClient } from '@features/admin/api-client';
import { RegisteredClient } from '@features/onboarding/types';
import { ContractsClient } from '@features/contracts/clients/api-client';
import { PaymentClient } from '@features/contracts/clients/payment-client';
import { AdminEorClient } from '@features/contracts/clients/admin-eor-client';
import { EorClient } from '@features/contracts/clients/eor-client';
import { DeClient } from '@features/contracts/clients/de-client';
import {
  createFinishedClient,
  createFixedContractViaApi,
  createMilestoneContractViaApi,
  createPaygContractViaApi,
  createCorContractViaApi,
  createDeContract,
  createDeEntity,
  createEorContract,
  registerContractorWorker,
  signContractorToOngoing as signContractorToOngoingViaApi,
  CreateCorContractOptions,
  CreateDeContractOptions,
  CreateDeEntityOptions,
  CreateEorContractOptions,
  SeededDeEntity,
} from '@features/contracts/seeding';
import { ContractorContractInput, CreatedContract, LifecycleWorker } from '@features/contracts/types';
import { BulkImportPage } from '@features/contracts/pages/frontoffice/BulkImportPage';
import { BulkImportReviewPage } from '@features/contracts/pages/frontoffice/BulkImportReviewPage';
import { BulkImportEditSidebar } from '@features/contracts/pages/frontoffice/BulkImportEditSidebar';
import { BulkImportModals } from '@features/contracts/pages/frontoffice/BulkImportModals';
import { FixedContractPage } from '@features/contracts/pages/frontoffice/FixedContractPage';
import { PaygContractPage } from '@features/contracts/pages/frontoffice/PaygContractPage';
import { MilestonesContractPage } from '@features/contracts/pages/frontoffice/MilestonesContractPage';
import { CORContractPage } from '@features/contracts/pages/frontoffice/CORContractPage';
import { DEContractPage } from '@features/contracts/pages/frontoffice/DEContractPage';
import { EorContractPage } from '@features/contracts/pages/frontoffice/EorContractPage';
import { ContractDetailPage } from '@features/contracts/pages/frontoffice/ContractDetailPage';

/** Seed a contractor contract (Fixed/PAYG/Milestone) via API; returns the created id/ref. */
export type SeedContractFn = (input?: ContractorContractInput) => Promise<CreatedContract>;

/** Seed a Contractor-of-Record contract (Fixed/PAYG/Milestone with `is_cor: true`) via API; returns the created id/ref. */
export type SeedCorContractFn = (opts?: CreateCorContractOptions) => Promise<CreatedContract>;

/** Seed an EOR contract via API; returns `null` on the `EOR_REGIONAL_CONFIG_ABSENT` self-skip sentinel (see `seeding.ts`). */
export type SeedEorContractFn = (opts?: CreateEorContractOptions) => Promise<CreatedContract | null>;

/** Seed a DE contract (+ its DE entity) via API; returns `null` on the `DE_ENTITY_JURISDICTION_ABSENT` self-skip sentinel. */
export type SeedDeContractFn = (opts?: { entity?: CreateDeEntityOptions; contract?: CreateDeContractOptions }) => Promise<CreatedContract | null>;

/**
 * Register a fresh self-signup contractor worker; returns `null` on the OTP-DB
 * sentinel (see `seedContractorWorker` fixture doc) — callers must self-skip.
 */
export type SeedContractorWorkerFn = (slug?: string) => Promise<LifecycleWorker | null>;

/** Sign an already-created contractor contract (Fixed/PAYG/Milestone) through to Ongoing. */
export type SignContractorToOngoingFn = (params: {
  contractId:    number;
  contractRef:   string;
  worker:        LifecycleWorker;
  signatoryName: string;
}) => Promise<boolean>;

export interface ContractsFixtures {
  /** Contracts API client authenticated as the client/company (EOR flows run as the client). */
  contractsClient: ContractsClient;

  /**
   * Money-movement client authenticated as the SAME base `clientAccount` as
   * `contractsClient` — the COR lightweight deposit path (`signCorToOngoing` →
   * `processCorDepositPayment`) runs its payment calls on this. Separated from
   * `contractsClient` in the 2026-07-09 client boundary re-audit (payments are a
   * distinct backend boundary); same token, so behaviour is unchanged.
   */
  paymentClient: PaymentClient;

  /** Shared AdminClient, authenticated via the admin test-login key. */
  adminClient: AdminClient;

  /**
   * A brand-new client (fresh signup via `createFinishedClient`) with the
   * contract-creation preconditions met: 2FA disabled, KYB approved, KYC
   * verified, company approved, global payroll enabled. Test-scoped — one fresh
   * registration per test so parallel contract-creation tests never contend on
   * account-level admin state (D3, docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md).
   */
  contractsFinishedClient: RegisteredClient;

  /**
   * ContractsClient authenticated as `contractsFinishedClient` — deliberately
   * NOT the shared base `clientAccount` (that account is reused by bulk-import
   * tests and is not guaranteed to have contract-creation preconditions met).
   */
  finishedContractsClient: ContractsClient;

  /**
   * Factory state-fixture: create a Fixed contractor contract on the finished
   * client's account. Cleanup: best-effort `cancelContract` (`.catch()`) —
   * contracts can only be cancelled, not deleted (inherited sandbox debt from
   * the legacy suite, not a regression to fix here).
   */
  seedFixedContract: SeedContractFn;

  /** Same as `seedFixedContract`, for a PAYG contractor contract. */
  seedPaygContract: SeedContractFn;

  /** Same as `seedFixedContract`, for a Milestone contractor contract. */
  seedMilestoneContract: SeedContractFn;

  /**
   * Factory state-fixture: create a Contractor-of-Record contract (Fixed by
   * default; `opts.type` for PAYG/Milestone) on the finished client's
   * account. Idempotently enables COR on the account (`AdminClient.enableCor`)
   * the first time it's called in a test — COR stays a type-specific gate, NOT
   * baked into `createFinishedClient` (seeding.ts JSDoc). This only creates
   * the contract; driving it to Ongoing is `signCorToOngoing` (seeding.ts,
   * imported directly by specs — no fixture wrapper, mirroring
   * `signEorToOngoing`/`signDeToOngoing`). Cleanup: best-effort
   * `cancelContract` (`.catch()`), same rationale as `seedFixedContract`.
   */
  seedCorContract: SeedCorContractFn;

  /** EOR create-time client, authenticated as `contractsFinishedClient` (same rationale as `finishedContractsClient`). */
  eorClient: EorClient;

  /** EOR-only admin surface (quote/SOW/partner/specialist), authenticated via the admin test-login key. */
  adminEorClient: AdminEorClient;

  /** DE entity + contract create-time client, authenticated as `contractsFinishedClient`. */
  deClient: DeClient;

  /**
   * Factory state-fixture: create an EOR contract on the finished client's
   * account. Cleanup: best-effort `cancelContract` (`.catch()`) — EOR contracts
   * and registered workers have **no delete endpoint at all** (inherited sandbox
   * debt from the legacy suite, ported verbatim as a comment there; not a
   * regression to fix here). Returns `null` when the seed function hits the
   * `EOR_REGIONAL_CONFIG_ABSENT` self-skip sentinel — the spec should self-skip.
   */
  seedEorContract: SeedEorContractFn;

  /**
   * Factory state-fixture: create a DE entity + DE contract on the finished
   * client's account. Cleanup: best-effort `cancelContract` for the contract and
   * `deleteEntity` for the entity (both `.catch()`) — DE entity deletion
   * availability varies by environment (legacy `DEEntityAPI.deleteEntity` already
   * treats it as best-effort). Returns `null` when entity creation hits the
   * `DE_ENTITY_JURISDICTION_ABSENT` self-skip sentinel.
   */
  seedDeContract: SeedDeContractFn;

  /**
   * Factory state-fixture: register a fresh contractor worker via self-signup
   * (Flow B: signup → OTP verify → profile), the precondition for signing a
   * Fixed/PAYG/Milestone/COR contract as the worker
   * (docs/30-decisions/2026-07-08-dmytro-db-otp-layer.md). Returns `null` when
   * the OTP DB tunnel is unavailable (SSH/DB env absent, tunnel unreachable, or
   * no OTP row yet) — a documented self-skip sentinel, NOT an error; specs must
   * `test.skip(worker === null, ...)`. TODO(api-preconditions): retire once a
   * worker-side OTP bypass ships.
   *
   * No automated cleanup: registered workers have **no delete endpoint**
   * (inherited sandbox debt from the legacy suite, not a regression) —
   * teardown only logs the created worker(s) for manual cleanup.
   */
  seedContractorWorker: SeedContractorWorkerFn;

  /**
   * Sign an already-created contractor contract (from `seedFixedContract` /
   * `seedPaygContract` / `seedMilestoneContract`) through to Ongoing on behalf
   * of a `seedContractorWorker`-registered worker: invite → client sign →
   * worker sign → poll Ongoing. No cleanup of its own — the contract's
   * lifecycle (cancellation) is owned by whichever `seed*Contract` fixture
   * created it.
   */
  signContractorToOngoing: SignContractorToOngoingFn;

  /**
   * A `page` already authenticated as the client (company) user, ready to navigate
   * the frontoffice for bulk-import UI flows. Auth is injected via localStorage
   * (Redux-Persist rehydration) — no login form required.
   * The page is test-scoped (fresh per test = clean wizard state);
   * the underlying auth comes from the worker-scoped base `clientAccount` (no re-login).
   */
  bulkImportClientPage: Page;

  /** BulkImportPage POM bound to the client-authenticated page. */
  bulkImportPage: BulkImportPage;

  /** BulkImportReviewPage POM bound to the client-authenticated page. */
  bulkImportReview: BulkImportReviewPage;

  /** BulkImportEditSidebar POM bound to the client-authenticated page. */
  bulkImportSidebar: BulkImportEditSidebar;

  /** BulkImportModals POM bound to the client-authenticated page. */
  bulkImportModals: BulkImportModals;

  /**
   * Single-contract wizard POMs (Fixed/PAYG/Milestones/COR/DE/EOR), each bound
   * to the same client-authenticated `bulkImportClientPage` — the wizards are
   * entered directly via `ROUTES.contractCreate`, no list-page click-through.
   */
  fixedContractPage: FixedContractPage;

  /** Same DI pattern as `fixedContractPage`, for the PAYG contract wizard. */
  paygContractPage: PaygContractPage;

  /** Same DI pattern as `fixedContractPage`, for the Milestones contract wizard. */
  milestonesContractPage: MilestonesContractPage;

  /** Same DI pattern as `fixedContractPage`, for the Contractor-of-Record wizard. */
  corContractPage: CORContractPage;

  /** Same DI pattern as `fixedContractPage`, for the Direct Employee wizard. */
  deContractPage: DEContractPage;

  /** Same DI pattern as `fixedContractPage`, for the EOR contract wizard. */
  eorContractPage: EorContractPage;

  /**
   * Shared contract-detail POM (Ongoing-badge check), bound to the same
   * client-authenticated `bulkImportClientPage`. Consolidates the per-type
   * `gotoContractDetail`/`ongoingBadge` duplication from the legacy wizard
   * POMs into a single page reused across all 6 wizard flows.
   */
  contractDetailPage: ContractDetailPage;
}

export const test = baseTest.extend<ContractsFixtures>({
  // Reuses the worker-scoped base `clientAccount` (run-cached by global-setup, or a single
  // live login per worker as fallback) — no extra login round-trip for this feature.
  contractsClient: async ({ clientAccount }, use) => {
    const client = new ContractsClient();
    await client.init(clientAccount.token);
    await use(client);
    await client.dispose();
  },

  paymentClient: async ({ clientAccount }, use) => {
    const client = new PaymentClient();
    await client.init(clientAccount.token);
    await use(client);
    await client.dispose();
  },

  adminClient: async ({}, use) => {
    const client = new AdminClient();
    await client.initWithAdminToken();
    await use(client);
    await client.dispose();
  },

  contractsFinishedClient: async ({ adminClient }, use) => {
    const client = await createFinishedClient(adminClient);
    await use(client);
  },

  finishedContractsClient: async ({ contractsFinishedClient }, use) => {
    const client = new ContractsClient();
    await client.init(contractsFinishedClient.token);
    await use(client);
    await client.dispose();
  },

  seedFixedContract: async ({ finishedContractsClient }, use) => {
    const created: number[] = [];
    const seed: SeedContractFn = async (input) => {
      const contract = await createFixedContractViaApi(finishedContractsClient, input);
      created.push(contract.id);
      return contract;
    };
    await use(seed);
    for (const id of created.splice(0)) {
      await finishedContractsClient
        .cancelContract(id)
        .catch((err: unknown) => { logVerbose(`[seedFixedContract] cleanup failed for id=${id}: ${String(err)}`); });
    }
  },

  seedPaygContract: async ({ finishedContractsClient }, use) => {
    const created: number[] = [];
    const seed: SeedContractFn = async (input) => {
      const contract = await createPaygContractViaApi(finishedContractsClient, input);
      created.push(contract.id);
      return contract;
    };
    await use(seed);
    for (const id of created.splice(0)) {
      await finishedContractsClient
        .cancelContract(id)
        .catch((err: unknown) => { logVerbose(`[seedPaygContract] cleanup failed for id=${id}: ${String(err)}`); });
    }
  },

  seedMilestoneContract: async ({ finishedContractsClient }, use) => {
    const created: number[] = [];
    const seed: SeedContractFn = async (input) => {
      const contract = await createMilestoneContractViaApi(finishedContractsClient, input);
      created.push(contract.id);
      return contract;
    };
    await use(seed);
    for (const id of created.splice(0)) {
      await finishedContractsClient
        .cancelContract(id)
        .catch((err: unknown) => { logVerbose(`[seedMilestoneContract] cleanup failed for id=${id}: ${String(err)}`); });
    }
  },

  seedCorContract: async ({ adminClient, finishedContractsClient }, use) => {
    const created: number[] = [];
    let corEnabled = false;
    const seed: SeedCorContractFn = async (opts) => {
      if (!corEnabled) {
        const companyId = await finishedContractsClient.getCompanyId();
        await adminClient.enableCor(companyId);
        corEnabled = true;
      }
      const contract = await createCorContractViaApi(finishedContractsClient, opts);
      created.push(contract.id);
      return contract;
    };
    await use(seed);
    for (const id of created.splice(0)) {
      await finishedContractsClient
        .cancelContract(id)
        .catch((err: unknown) => { logVerbose(`[seedCorContract] cleanup failed for id=${id}: ${String(err)}`); });
    }
  },

  eorClient: async ({ contractsFinishedClient }, use) => {
    const client = new EorClient();
    await client.init(contractsFinishedClient.token);
    await use(client);
    await client.dispose();
  },

  adminEorClient: async ({}, use) => {
    const client = new AdminEorClient();
    await client.initWithAdminToken();
    await use(client);
    await client.dispose();
  },

  deClient: async ({ contractsFinishedClient }, use) => {
    const client = new DeClient();
    await client.init(contractsFinishedClient.token);
    await use(client);
    await client.dispose();
  },

  seedEorContract: async ({ eorClient, finishedContractsClient }, use) => {
    const created: number[] = [];
    const seed: SeedEorContractFn = async (opts) => {
      const contract = await createEorContract(eorClient, opts);
      if (contract) created.push(contract.id);
      return contract;
    };
    await use(seed);
    for (const id of created.splice(0)) {
      await finishedContractsClient
        .cancelContract(id)
        .catch((err: unknown) => { logVerbose(`[seedEorContract] cleanup failed for id=${id}: ${String(err)}`); });
    }
  },

  seedDeContract: async ({ deClient, finishedContractsClient }, use) => {
    const createdContractIds: number[] = [];
    const createdEntityIds: number[] = [];
    const seed: SeedDeContractFn = async (opts) => {
      const entity: SeededDeEntity | null = await createDeEntity(deClient, opts?.entity);
      if (!entity) return null;
      createdEntityIds.push(entity.id);
      const contract = await createDeContract(deClient, entity, opts?.contract);
      createdContractIds.push(contract.id);
      return contract;
    };
    await use(seed);
    for (const id of createdContractIds.splice(0)) {
      await finishedContractsClient
        .cancelContract(id)
        .catch((err: unknown) => { logVerbose(`[seedDeContract] contract cleanup failed for id=${id}: ${String(err)}`); });
    }
    for (const id of createdEntityIds.splice(0)) {
      await deClient
        .deleteEntity(id)
        .catch((err: unknown) => { logVerbose(`[seedDeContract] entity cleanup failed for id=${id}: ${String(err)}`); });
    }
  },

  seedContractorWorker: async ({ adminClient }, use) => {
    const registered: LifecycleWorker[] = [];
    const seed: SeedContractorWorkerFn = async (slug = 'contractor') => {
      const worker = await registerContractorWorker(adminClient, slug);
      if (worker) registered.push(worker);
      return worker;
    };
    await use(seed);
    if (registered.length) {
      logVerbose(
        `[seedContractorWorker] ${registered.length} worker(s) require manual cleanup (no delete API): ${registered
          .map((w) => `userId=${w.userId} ${w.email}`)
          .join(', ')}`,
      );
    }
  },

  signContractorToOngoing: async ({ finishedContractsClient }, use) => {
    const sign: SignContractorToOngoingFn = (params) =>
      signContractorToOngoingViaApi({ contracts: finishedContractsClient, ...params });
    await use(sign);
  },

  // Test-scoped: each test gets a FRESH page (clean wizard state, no leftover navigation).
  // Auth is injected from the worker-scoped base `clientAccount` — zero extra logins per test.
  bulkImportClientPage: async ({ page, clientAccount }, use) => {
    await injectUiAuthFromAccount(page, clientAccount);
    await use(page);
  },

  bulkImportPage: async ({ bulkImportClientPage }, use) => {
    await use(new BulkImportPage(bulkImportClientPage));
  },

  bulkImportReview: async ({ bulkImportClientPage }, use) => {
    await use(new BulkImportReviewPage(bulkImportClientPage));
  },

  bulkImportSidebar: async ({ bulkImportClientPage }, use) => {
    await use(new BulkImportEditSidebar(bulkImportClientPage));
  },

  bulkImportModals: async ({ bulkImportClientPage }, use) => {
    await use(new BulkImportModals(bulkImportClientPage));
  },

  fixedContractPage: async ({ bulkImportClientPage }, use) => {
    await use(new FixedContractPage(bulkImportClientPage));
  },

  paygContractPage: async ({ bulkImportClientPage }, use) => {
    await use(new PaygContractPage(bulkImportClientPage));
  },

  milestonesContractPage: async ({ bulkImportClientPage }, use) => {
    await use(new MilestonesContractPage(bulkImportClientPage));
  },

  corContractPage: async ({ bulkImportClientPage }, use) => {
    await use(new CORContractPage(bulkImportClientPage));
  },

  deContractPage: async ({ bulkImportClientPage }, use) => {
    await use(new DEContractPage(bulkImportClientPage));
  },

  eorContractPage: async ({ bulkImportClientPage }, use) => {
    await use(new EorContractPage(bulkImportClientPage));
  },

  contractDetailPage: async ({ bulkImportClientPage }, use) => {
    await use(new ContractDetailPage(bulkImportClientPage));
  },
});

export { expect } from '@playwright/test';
