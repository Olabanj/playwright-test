## User intent

Prove the RemotePass money-movement lifecycle works end-to-end against a sandbox: a client can be enabled for and can attach every supported payment method, pay a contractor through each one with the right admin approvals, and a contractor can be enabled for and attach every supported withdrawal method and withdraw funds out — with admin confirmation gates at each privileged step. Client-side (pay-in) and contractor-side (pay-out) are exercised as one continuous cycle so money flows in, lands in the contractor wallet, and flows out.

## Preconditions

- A finished client account: registered, KYB submitted + admin-approved, KYC verified, 2FA disabled, company approved.
- A finished contractor account: registered (OTP read from DB on first seed), KYC verified, 2FA disabled, baseline withdrawal methods enabled.
- An Ongoing fixed-rate contract between them, backdated so it sits inside an active payroll cycle (USD by default).
- Admin access (token-injected admin session) for all enable/approve/confirm/release steps.
- Sandbox Stripe (SEPA + card) and Plaid (ACH) test credentials available; a wallet that can be funded by processing a payment.
- The two execution lanes (API and UI) each own a separate seeded client+contractor so their transactions never co-mingle.

## Steps (intent only)

1. Admin enables the toggleable payment methods on the client company; confirm Bank Transfer is on by default and globally-enabled methods (Wise, Mercury) need no toggle.
2. Admin enables the withdrawal methods on the contractor.
3. Seed adjustment payments on the contract to create payable line items; wait for the platform background job to mark each payable.
4. Client attaches payment instruments: SEPA (provider SetupIntent confirm then platform attach), Credit/Debit Card (provider tokenize then attach), ACH (provider processor token then attach); verify they appear in the saved-methods list.
5. Client processes a payment through each method: request a quote for the payable item, run the async quote/transfer state machine, then admin confirms the transaction and releases the transfer so funds reach the contractor wallet.
6. Contractor attaches withdrawal instruments: a bank account (dynamic currency-driven fields, SWIFT/IBAN), a card-payout registration, and initiates OAuth-based methods (PayPal, Payoneer, Coinbase) to the point of the provider redirect.
7. Contractor withdraws: read wallet balance, list eligible withdrawal methods for the currency/amount, prepare a withdrawal quote, confirm it (wallet debits, status becomes 'Withdraw Requested'), then admin advances/confirms it on the Withdrawals tab past 'Withdraw Requested' to Paid.

## Expected outcome

- Every enabled payment method persists on the company and is selectable; disabling by omission removes it.
- Each attached instrument appears in the client's saved methods; soft-deleting removes it from the active set.
- Each payable item processes successfully through its method, the transaction is admin-confirmed, the transfer is released, and the contractor wallet balance increases.
- Every enabled withdrawal method persists on the contractor; each instrument is saved and surfaced in Saved Methods / accounts.
- A confirmed withdrawal debits the wallet, creates a 'Withdraw Requested' transaction, and after admin processing moves to Confirmed/Paid and leaves the requested bucket.
- Unauthorized/invalid callers (non-admin, contractor on client endpoints, bad tokens, malformed/empty payloads, over-balance or below-minimum amounts) are rejected with the correct status.

## Edge cases / variants

- Negative/auth-guard coverage on every endpoint: 401 unauthenticated, 403/401 non-admin and contractor-on-client, empty/malformed payloads, non-existent IDs, amount bounds (zero, negative, below $5 min, above wallet balance), invalid currency.
- Idempotency / dedup: re-applying the same method set is a no-op; re-attaching an already-attached instrument must not duplicate; consumed quote IDs and already-processed items must be rejected; double-confirm of a withdrawal rejected.
- Provider-binding constraint: a payment-method token is bound to the Stripe customer that created it — on a fresh client the attach may report not-saved; assertions soften to endpoint-reachable.
- Method-specific deferrals: SEPA settlement and ACH-via-Link are async/multi-step in sandbox (covered at API attach layer, not full UI processing); OAuth withdrawals (PayPal/Payoneer/Coinbase) only assert the initiation/redirect, not headless OAuth completion; RemotePass Card paths gated on the contractor actually owning a card.
- Known backend defects asserted as expected-fail sentinels (silent-accept of bad company ID, duplicate IBAN, duplicate /add SQL leak, currency path param ignored).

## Domain notes

- Payment processing is an async state machine: quote -> task poll -> transfer create -> transfer poll -> admin confirm -> admin release. A platform background job must advance a seeded adjustment to a 'payable/processable' state before it can be paid; this lag is polled, never slept through.
- Admin is the gatekeeper for enabling methods, confirming transactions, releasing transfers, and confirming withdrawals. The admin SPA uses Google SSO bypassed in tests via a test-login JWT pre-set into SPA storage.
- The 'Payment' tab in company settings is intentionally hidden until the client adds at least one payment method during a payment flow.
- An outgoing contractor withdrawal does NOT appear on admin Pending Transfers (that surface is for inbound client->contractor payment transfers); withdrawals live on the admin Withdrawals tab.
- Bank withdrawal fields are dynamic and currency-driven (e.g. USD->USD vs USD->NGN return different field groups). Bank Transfer is enabled by default for clients; Wise/Mercury are globally enabled with no admin toggle.
- Sandbox API is partly monolith, partly microservices — the API-client layer must tolerate multiple base URLs; tests stay feature-grouped regardless.

## Migration decision

Migrate as a single feature-first `payments` module that owns the whole pay-in + pay-out lifecycle, preserving the ordered 01->07 pipeline semantics and per-lane (API/UI) seeded-account isolation. Port the API service classes into the new feature module's client layer (splitting by backend service boundary only inside that layer), keep Stripe/Plaid/transfer-release/payments-resolver as feature test helpers, and port the POMs as the UI surface. Carry the KNOWN-ISSUES markers verbatim (test.fail sentinels, test.fixme sandbox-500s, environment gates) and link each to its tracking ticket. Gate migration on the external dependencies that make this suite non-hermetic: Stripe/Plaid sandbox keys, admin test-login key, DB tunnel for first-seed OTP, and a fundable wallet.
