---
id: aa339c4f-a4e3-57d3-bb03-d923836c035d
name: payment-tab-visibility
description: "Payment tab in company settings is hidden until client adds at least 1 payment method during a payment — intentional design; Stripe pm_ ID constraint is a separate API test issue"
metadata:
  type: reference
  category: domain
  tags: ["payment", "company-settings", "stripe", "test-setup", "soft-assertion"]
  author: dmytro
  createdAt: 2026-05-22T11:01:00Z
  updatedAt: 2026-05-22T11:01:00Z
  expiresAt: null
---

# Payment Tab Visibility

## Platform Behavior (intentional)

The "Payment" tab in company settings is **hidden by default**.
It appears only after the client has added at least one payment method (ACH, SEPA, or credit/debit card) during a payment flow.

**Setup for tests**: enable payment methods in admin panel, then process one payment — add any payment method (e.g. SEPA). Tab will appear from that point on.

Confirmed by Slahudeen: "there is a business logic behind it and that's how it is designed."

## Stripe pm_ Constraint (separate API test issue)

The credit card API test (QA-185 / PR #88) has a dual path:

| Client | Outcome |
|---|---|
| `lukman+gg` account | `success: true` — card actually saved, Payment tab appears |
| Fresh seeded client | `success: false` — `pm_` ID rejected (belongs to `lukman+gg`'s Stripe customer) |

Test is written as a soft assertion — passes in both cases. For fresh seeded clients it only verifies the endpoint is reachable, not that a card is saved.

**Not a bug** — Stripe payment method IDs are tied to the Stripe customer that created them. To properly test card saving on a fresh client, a matching Stripe `pm_` ID for that customer is needed (sandbox only).
