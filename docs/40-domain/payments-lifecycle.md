---
id: 99e1ad7b-e728-5dce-a730-61c6ad575fca
name: payments-lifecycle
description: "End-to-end money-movement domain: async payment state machine (quote→task→transfer→admin confirm→release), payment/withdrawal method matrices, Stripe/Plaid sandbox mechanics, dynamic bank fields, admin gates, known backend defects (QA-20/131/132)"
metadata:
  type: reference
  category: domain
  tags: ["payments", "withdrawal", "stripe", "plaid", "admin", "state-machine", "sandbox"]
  author: dmytro
  createdAt: 2026-06-10T14:34:13Z
  updatedAt: 2026-06-10T14:34:13Z
  expiresAt: null
---

# Payments Lifecycle (Pay-in + Pay-out)

Discovered during legacy payments-e2e suite investigation (2026-06-10), source: `tests/modules/payments-e2e/` (#119, QA-1→QA-50) + `KNOWN-ISSUES.md`.

## Async payment state machine (client pay-in)

`POST /api/transaction/quotes` (payment_item_ids + payment_method_id) → **task poll** → transfer create → **transfer poll** → **admin confirms** the transaction → **admin releases** the transfer (paginate `transfer/list` → `transfer/confirm`) → funds land in the contractor wallet.

- A seeded adjustment becomes payable only after a platform **background job** flips `is_processable=true` — poll it, never sleep.
- Admin release is a **separate second admin step** after confirm; auto-processed (absent) transfers count as success.

## Method matrices

- **Payment methods (client):** Bank Transfer (default-on, no toggle), Credit/Debit Card, SEPA, ACH, Coinbase + **Wise & Mercury globally enabled with no admin toggle**.
- **Withdrawal methods (contractor):** PayPal, Bank Transfer, Payoneer, Coinbase, Paysend/Instant Card, Digital Currency Transfer, RemotePass Card (env-gated).

## Sandbox mechanics

- **Stripe:** SEPA via SetupIntent confirm; card tokenize via publishable key (`payment_user_agent` Stripe.js marker). A `pm_` token is **bound to the Stripe customer that created it** — on a fresh client the attach may report not-saved (soft assertions).
- **Plaid (ACH):** `/sandbox/public_token/create` → `/accounts/get` → platform `/payment/method/ach/setup` → processor token — bypasses browser Plaid Link. Needs PLAID_CLIENT_ID/SECRET.
- **Admin SPA auth bypass:** JWT from `GET /api/admin/login/test/<ADMIN_LOGIN_KEY>` pre-set into `persist:root` localStorage before SPA boot (Google SSO bypassed).
- **Bank withdrawal fields are dynamic and currency-driven** — `/bank/fields` returns different field groups per currency pair (e.g. USD→USD vs USD→NGN).

## Surfaces

- Outgoing contractor **withdrawals do NOT appear on admin Pending Transfers** (that page is inbound client→contractor payment transfers only); withdrawals live on the admin **Withdrawals** tab. Proven by sandbox probing.
- Withdrawal lifecycle: prepare (quote) → confirm (wallet debits, txn 'Withdraw Requested') → admin advances to Confirmed/Paid.

## Known backend defects (carried as xfail in the legacy suite)

- QA-20: Paysend card registration + Instant Card Payout `/prepare` return 500.
- QA-131: duplicate IBAN accepted; `/bank/fields` hangs on unknown currency.
- QA-132: Digital Currency Transfer confirm returns 500.
- No-ticket gaps: admin company update silently accepts bad company id; duplicate `/payment/method/add` leaks raw SQL error; `/transaction/quotes` accepts unknown paymentAccountId and already-processed items; withdraw-methods endpoint ignores the currency path param.

Related: [[payment-tab-visibility]] (tab hidden until first payment method), [[legacy-service-map]], 20-engineering/payments-agent-test-data.md.
