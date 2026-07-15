---
id: f9403f7a-6e7f-594a-9912-411654e5ab17
name: legacy-service-map
description: "Legacy test-framework API client map — ~30 clients under services/api/ grouped by domain: what each covers and which feature uses it; migration reference for typed features/<m>/client.ts"
metadata:
  type: reference
  category: domain
  tags: ["legacy", "api", "service-map", "migration", "clients"]
  author: dmytro
  createdAt: 2026-06-10T14:34:13Z
  updatedAt: 2026-06-10T14:34:13Z
  expiresAt: null
---

# Legacy Service Map

Reference map of the legacy `test-framework` API client layer (discovered during the
production-investigation phase, 2026-06-10, on the combined base main + feature/time-tracking).
This is **platform-domain knowledge for migration planning** — what surface each client covers —
not a record of old-framework code decisions. Each client becomes (part of) a typed
`features/<feature>/client.ts` per `docs/test-migration/architecture-mapping.md`.

## Common

| Client | Covers |
|---|---|
| `common/AuthAPI` | Login (client/worker/admin token bootstrap); used by every fixture |
| `common/BaseAPI` | Base HTTP class: request context, auth headers, logging, retry (`getWithRetry`) + write wrapping (`sendWrite`), multipart |

## Admin

| Client | Covers |
|---|---|
| `admin/AdminAPI` | Admin test-login JWT, KYB/KYC approval, company update/approve, 2FA disable, transfer list/confirm, `sign_as_provider` |
| `admin/AdminEorAPI` | Admin-side EOR contract operations |

## Registration & onboarding

| Client | Covers |
|---|---|
| `client-registration/ClientRegistrationAPI` | Client sign-up steps (used by client-registration feature) |
| `worker-registration/WorkerRegistrationAPI` | Worker/contractor sign-up (worker OTP is DB-read, no 9999 bypass) |
| `payments-e2e/ClientOnboardingAPI` | Client KYB submit, client info, invite contractor (prereqs seeding) |
| `payments-e2e/ContractorOnboardingAPI` | Contractor KYC submit, activate account (prereqs seeding) |

## Contracts & EOR & DE

| Client | Covers |
|---|---|
| `contracts/ContractsAPI` | Contractor-type contract CRUD |
| `openapi/contracts/ContractsAPI` | Parallel OpenAPI-derived contracts surface (duplicate to reconcile during migration) |
| `eor/EORAPI` | EOR contract read by string ref, currency catalogue, salary-currency edit (PATCH /contract/fulltime/{id}), amendment add, client signature |
| `eor/EorContractAPI` / `eor/EorEmployeeAPI` / `eor/EorFormAPI` / `eor/EorPaymentAPI` | EOR sub-surfaces: contract lifecycle, employee data, forms, EOR payments |
| `de-contract/DEContractAPI` / `de-employee/DEEmployeeAPI` / `de-entity/DEEntityAPI` | Direct-Employee contract, employee, entity management |

## Money movement (payments-e2e suite)

| Client | Covers |
|---|---|
| `payments/PaymentsAPI` | Generic contract payments: pending approvals, adjustments, PAYG/milestone submit-approve, invoices, quote→transfer primitives |
| `payments-e2e/PaymentProcessingAPI` | Quote→task→transfer async state machine, per-method submit (SEPA/ACH/card), admin confirm |
| `payments-e2e/PaymentMethodSetupAPI` | Client payment-instrument attach/list/delete; SEPA SetupIntent; ACH link token |
| `payments-e2e/AdminPaymentMethodsAPI` | Admin enable/disable company payment methods |
| `payments-e2e/WithdrawalAPI` | Contractor wallet balances, withdrawal methods by currency/amount, prepare/confirm withdrawal |
| `payments-e2e/WithdrawalMethodSetupAPI` | Bank fields (dynamic per currency), save bank account, Paysend card, PayPal/Payoneer/Coinbase OAuth initiation |
| `payments-e2e/AdminWithdrawalMethodsAPI` | Admin enable/disable contractor withdrawal methods + prereqs admin helpers |
| `payments-e2e/AdminApprovalsAPI` | Admin payment/withdrawal approval queues |

## Other features

| Client | Covers |
|---|---|
| `expenses/ExpensesAPI` | Expense categories, currencies, receipt upload (multipart `photo`), add/approve expense |
| `time-tracking/TimeTrackingAPI` | Policies (CRUD, workers by contract-id, wizard fields), TWO session surfaces (legacy clockIn/Out — dead; current time-sessions), manual entries, timesheet report |
| `time-off/TimeOffAPI` | PTO / public-holiday policies (used by HRIS seeding) |
| `invoices/InvoiceAPI` | Invoice list (dual query+body date params), bulk download (async export job), export polling |
| (branch) `audit-trail`, `notifications` clients | Added by feature/time-tracking via AuthFixture convenience methods |

Related: [[sandbox-api-architecture]] (monolith vs microservices base URLs), [[payments-lifecycle]],
[[eor-contract-currency-and-amendments]], [[time-tracking-api-behavior]].
