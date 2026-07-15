# ADR 2026-06-26 — Centralize UI routes in `core/ui/routes.ts`

**Status:** Accepted · **Decider:** Dmytro · **Context:** Cleanup phase, B3 (route centralization)

## Context
URL path literals (`/login`, `/expenses`, `/activity`, `/settings/info`,
`/time-tracking`, `/signup`, `/contract/bulk-creation` and its `/upload` / `/review`
sub-routes, the `**/registration-document` redirect target) were scattered as raw
strings across many page objects and feature fixtures. The same path appeared in
multiple files (e.g. `/login` in `LoginPage.goto` and as a `waitForURL` predicate;
`/activity` in both `ActivityPage` and `onboarding/fixtures.ts`). There was no single
source of truth, so a product route change meant a grep-and-pray sweep, and typos in
a literal would only surface as a runtime navigation failure.

These routes are consumed by **three or more** features (auth, onboarding, contracts,
expenses, time-tracking) and by shared fixtures — a genuine cross-feature concern,
not a per-feature one. That clears the "≥3 consumers" bar for a shared abstraction
(not premature: the duplication already exists and spans features).

## Decision
Introduce a single typed route map at `core/ui/routes.ts`:

```ts
export const ROUTES = {
  login: '/login',
  signup: '/signup',
  expenses: '/expenses',
  activity: '/activity',
  companyInfo: '/settings/info',
  timeTracking: '/time-tracking',
  bulkCreation: '/contract/bulk-creation',
} as const;
```

Placement is `core/` (not a per-feature `constants.ts`) precisely because the routes
are cross-feature; `core/ui/` is the established home for shared UI infrastructure
(`BasePage`, layout components). Page objects and fixtures import `ROUTES` and pass
`ROUTES.x` to `goto()`.

Scope boundaries:
- `goto` navigation targets are centralized.
- `waitForURL` **glob predicates** (`**/contract/bulk-creation/review`,
  `**/registration-document`, etc.) stay inline for now — they are match patterns,
  not navigation targets, and several are sub-paths/redirect targets with no `goto`
  counterpart. Promoting them is a later, separate step if duplication grows.
- A `href="..."` locator selector is a DOM assertion concern, not a route — left inline.

## Consequences
- One edit point when a product route changes; typos become compile errors via the
  `as const` typed map, not runtime navigation timeouts.
- New screens add one `ROUTES` entry and reference it — discoverable, greppable.
- `core/ui/routes.ts` is a leaf module (no imports), safe for any layer to consume.
- No behaviour change: literals map 1:1 to existing strings; affected UI specs stay green.
