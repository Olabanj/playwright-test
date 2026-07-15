# Auth — Login & Logout Scenarios (API + Frontoffice UI)

## User intent
As a platform user (client), I want to authenticate and end my session — both
programmatically (API token) and through the web UI — so that protected areas
are reachable when signed in and unreachable after signing out.

## Preconditions
- A client account exists with known credentials (read via `core/config/env.ts`).
- For UI flows, the app is reachable and the login page renders.

## Steps (intent only)

### API
1. Log in as the client with email + password; receive a session token.
2. With the token, call logout; the session is invalidated.

### UI (frontoffice)
1. Open the login page, enter email + password, submit.
2. Confirm the app navigates away from `/login` (signed-in state).
3. From the user menu, choose Logout; confirm the app returns to `/login`.

## Expected outcome
- Login returns a non-empty token (length > 20).
- Logout resolves without error and the session no longer authenticates.
- UI login leaves `/login`; UI logout returns to `/login`.

## Edge cases / variants
- Login response body may return the account directly or as an array — the first
  element is used (`base.fixture.loginAs`).
- UI auth in other specs is injected from an API token (login form skipped) for
  speed; these specs exercise the real form on purpose.

## Domain notes
- Token is read from `response.body.data` (login response shape).
- OTP bypass differs for client vs worker — see `docs/40-domain/otp-bypass-client-vs-worker.md`.
