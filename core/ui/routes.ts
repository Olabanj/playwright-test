/**
 * Single source of truth for UI navigation routes.
 *
 * Cross-feature concern (consumed by auth, onboarding, contracts, expenses,
 * time-tracking page objects + fixtures), so it lives in core/ui — see
 * docs/30-decisions/2026-06-26-dmytro-centralize-routes.md.
 *
 * Scope: `goto()` navigation targets. `waitForURL` glob predicates and DOM-locator
 * hrefs are intentionally NOT centralized here (they are match patterns / selectors,
 * not navigation targets).
 */
export const ROUTES = {
  login: '/login',
  signup: '/signup',
  expenses: '/expenses',
  activity: '/activity',
  companyInfo: '/settings/info',
  timeTracking: '/time-tracking',
  bulkCreation: '/contract/bulk-creation',
  /**
   * Single-contract creation wizard entry (sibling of `bulkCreation`).
   * Confirmed against the product router:
   * `apps/user/src/routes/allRoutes.jsx` — `{ path: '/contract/create', ... }`
   * (frontend-monorepo, remotepass product repo mirror).
   */
  contractCreate: '/contract/create',
  /**
   * Contract detail page — id passed as `?id=` query param.
   * Confirmed against the product router:
   * `apps/user/src/routes/allRoutes.jsx` — `{ path: '/contract/detail', component: ContractPage }`.
   */
  contractDetail: (id: number | string) => `/contract/detail?id=${id}`,
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
