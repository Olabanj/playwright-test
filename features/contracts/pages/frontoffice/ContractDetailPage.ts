import { BasePage } from '@core/ui/BasePage';
import { ROUTES } from '@core/ui/routes';
import { logVerbose } from '@utils/helpers/logger';

/**
 * Shared contract-detail screen.
 *
 * Consolidates the Ongoing-badge check that the legacy wizard POMs duplicated
 * per contract type (only `CORContractPage` carried `gotoContractDetail` +
 * `ongoingBadge` — ported here once instead of copying it into all 6 wizard
 * POMs). Every wizard fixture (`fixedContractPage`, `paygContractPage`, …)
 * pairs with this single `contractDetailPage` for post-signature verification.
 */
export class ContractDetailPage extends BasePage {
  readonly ongoingBadge = this.page.getByText('Ongoing').first();

  async gotoContractDetail(contractId: number | string): Promise<void> {
    logVerbose(`ContractDetailPage.gotoContractDetail contractId=${contractId}`);
    await this.goto(ROUTES.contractDetail(contractId));
  }

  /**
   * Non-throwing convenience check — swallows visibility timeouts to `false`
   * for use in wizard step conditionals. Specs asserting the Ongoing state as
   * the behaviour under test should assert `ongoingBadge` directly instead
   * (`await expect(contractDetailPage.ongoingBadge).toBeVisible()`).
   */
  async isOngoing(): Promise<boolean> {
    logVerbose('ContractDetailPage.isOngoing');
    return this.ongoingBadge.isVisible({ timeout: 10_000 }).catch(() => false);
  }
}
